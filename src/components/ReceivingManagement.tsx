"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { authFetch } from '@/lib/api-client';
import { format } from 'date-fns';
import { Loader2, ArrowRight, CheckCircle2, AlertTriangle, FileJson, Package, Trash2, MoreHorizontal, Upload, Layers, Undo2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { ReceivingBatch } from '@/lib/types';
import { ReceivingConferenceModal } from './ReceivingConferenceModal';
import { XmlPreviewDialog } from '@/components/XmlPreviewDialog';
import { parseNfeXml, ParsedNfeData } from '@/lib/xml-parser';
import { NfeAttachmentDialog } from '@/components/NfeAttachmentDialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export function ReceivingManagement({ onDataMutated }: { onDataMutated: () => void }) {
    const [batches, setBatches] = useState<ReceivingBatch[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [showFinalizados, setShowFinalizados] = useState(false);
    const { toast } = useToast();

    // XML import states
    const [isImportXmlOpen, setIsImportXmlOpen] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [parsedXmlData, setParsedXmlData] = useState<ParsedNfeData | null>(null);
    const [selectedXmlFile, setSelectedXmlFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [pendingClientMappingData, setPendingClientMappingData] = useState<any | null>(null);

    const handleXmlObtained = (xmlContent: string) => {
        const parsed = parseNfeXml(xmlContent);
        if (parsed && parsed.errors.length === 0) {
            setParsedXmlData(parsed);
            const file = new File([xmlContent], 'nfe.xml', { type: 'text/xml' });
            setSelectedXmlFile(file);
            setIsPreviewOpen(true);
            setIsImportXmlOpen(false);
        } else {
            toast({ variant: 'destructive', title: 'Erro', description: 'XML inválido, não suportado ou inconsistente.' });
        }
    };

    const loadBatches = async () => {
        setIsLoading(true);
        try {
            const res = await authFetch('/api/stock/receiving');
            if (res.ok) {
                setBatches(await res.json());
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadBatches();
    }, []);

    const handleConferenceClose = (mutated: boolean) => {
        setSelectedBatchId(null);
        if (mutated) {
            loadBatches();
            onDataMutated();
        }
    };

    const handleRevertToPendente = async (id: string) => {
        try {
            const res = await authFetch(`/api/stock/receiving/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ action: 'revert_to_pendente' })
            });
            if (res.ok) {
                toast({ title: 'Sucesso', description: 'O recebimento voltou para a etapa Pendente.' });
                loadBatches();
            } else {
                const err = await res.json();
                toast({ variant: 'destructive', title: 'Erro', description: err.error });
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao retroceder status.' });
        }
    };

    const handleDeleteBatch = async (id: string) => {
        setDeletingId(id);
        try {
            const res = await authFetch(`/api/stock/receiving/${id}`, {
                method: 'DELETE'
            });
            
            if (res.ok) {
                toast({
                    title: 'Lote excluído',
                    description: 'O lote de recebimento foi excluído com sucesso.',
                });
                loadBatches();
                onDataMutated();
            } else {
                const data = await res.json();
                toast({
                    variant: 'destructive',
                    title: 'Erro ao excluir',
                    description: data.error || 'Ocorreu um erro ao excluir o lote.',
                });
            }
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Erro inesperado',
                description: 'Falha na comunicação com o servidor.',
            });
        } finally {
            setDeletingId(null);
            setConfirmDeleteId(null);
        }
    };

    const handleConfirmXmlImport = async (manualCompanyId?: string) => {
        if (!selectedXmlFile) return;
        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('file', selectedXmlFile);
            if (manualCompanyId) {
                formData.append('companyId', manualCompanyId);
            }
            const response = await authFetch('/api/stock/xml', { method: 'POST', body: formData });
            if (response.ok) {
                const result = await response.json();
                toast({ title: 'Sucesso', description: `XML importado. ${result.insertedCount} item(s) adicionado(s) ao estoque (posição: RECEBIMENTO).` });
                setIsImportXmlOpen(false);
                setIsPreviewOpen(false);
                setPendingClientMappingData(null);
                loadBatches();
                onDataMutated();
            } else {
                const errorData = await response.json();
                if (errorData.requiresClientMapping || errorData.requiresBranchMapping) {
                    setPendingClientMappingData(errorData);
                } else {
                    toast({ variant: 'destructive', title: 'Erro', description: errorData.message || 'Falha ao importar XML' });
                    setIsPreviewOpen(false);
                }
            }
        } catch (err) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao processar arquivo.' });
            setIsPreviewOpen(false);
        } finally {
            setIsSubmitting(false);
            if (!pendingClientMappingData) {
               // Only clear if we aren't showing the mapping prompt
               // Wait, the finally block runs after we set it. We should clear only on success or hard error
            }
        }
    };

    // Helper to close preview
    const closePreview = () => {
        setIsPreviewOpen(false);
        setSelectedXmlFile(null);
        setParsedXmlData(null);
        setPendingClientMappingData(null);
    };

    const filteredBatches = showFinalizados ? batches : batches.filter(b => b.status !== 'Finalizado');

    return (
        <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <CardTitle>Recebimento de Mercadorias</CardTitle>
                    <CardDescription>
                        Importe NF-e via XML e gerencie a conferência física dos lotes recebidos.
                    </CardDescription>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center space-x-2">
                        <Checkbox 
                            id="show-finalizados" 
                            checked={showFinalizados} 
                            onCheckedChange={(checked) => setShowFinalizados(!!checked)} 
                        />
                        <Label htmlFor="show-finalizados" className="text-sm font-normal text-muted-foreground cursor-pointer">
                            Mostrar Finalizados
                        </Label>
                    </div>
                    <Button onClick={() => setIsImportXmlOpen(true)}>
                        <Upload className="mr-2 h-4 w-4" /> Importar NF-e (XML)
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                ) : batches.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground border border-dashed rounded-lg">
                        <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="font-medium">Nenhum lote de recebimento encontrado.</p>
                        <p className="text-sm mt-1">Clique em "Importar NF-e (XML)" acima para iniciar o processo de recebimento.</p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Status</TableHead>
                                <TableHead>NF-e</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Qtd / Vol</TableHead>
                                <TableHead>Data de Importação</TableHead>
                                <TableHead className="text-right">Ação</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredBatches.map(batch => (
                                <TableRow key={batch.id}>
                                    <TableCell>
                                        <Badge variant={batch.status === 'Pendente' ? 'secondary' : batch.status === 'Montar' ? 'outline' : batch.status === 'Posicionar' ? 'outline' : batch.status === 'Com Divergência' ? 'destructive' : 'default'} className={batch.status === 'Montar' ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' : batch.status === 'Posicionar' ? 'bg-orange-100 text-orange-800 hover:bg-orange-200' : ''}>
                                            {batch.status === 'Pendente' && <AlertTriangle className="w-3 h-3 mr-1 inline" />}
                                            {batch.status === 'Montar' && <Layers className="w-3 h-3 mr-1 inline" />}
                                            {batch.status === 'Posicionar' && <ArrowRight className="w-3 h-3 mr-1 inline" />}
                                            {batch.status === 'Com Divergência' && <AlertTriangle className="w-3 h-3 mr-1 inline" />}
                                            {batch.status === 'Finalizado' && <CheckCircle2 className="w-3 h-3 mr-1 inline" />}
                                            {batch.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <FileJson className="w-4 h-4 text-slate-400" />
                                            {batch.nfNumber}
                                        </div>
                                    </TableCell>
                                    <TableCell>{batch.companyName || 'N/A'}</TableCell>
                                    <TableCell>{batch.unitType}</TableCell>
                                    <TableCell>
                                        {batch.unitType === 'PALETES' ? (
                                            <div className="flex flex-col">
                                                <span className="font-semibold">{batch.nfQVol || '?'} Paletes</span>
                                                <span className="text-xs text-muted-foreground">{batch.totalItemsNf} tipos de SKU</span>
                                            </div>
                                        ) : (
                                            <span>{batch.totalItemsReal || batch.totalItemsNf} Itens</span>
                                        )}
                                    </TableCell>
                                    <TableCell>{format(new Date(batch.importedAt), 'dd/MM/yyyy HH:mm')}</TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">Abrir menu</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => setSelectedBatchId(batch.id)} className="cursor-pointer">
                                                    {batch.status === 'Pendente' ? (
                                                        <><ArrowRight className="mr-2 h-4 w-4 text-blue-600" /> Conferir SKUs</>
                                                    ) : batch.status === 'Montar' ? (
                                                        <><Layers className="mr-2 h-4 w-4 text-yellow-600" /> Montar Paletes</>
                                                    ) : batch.status === 'Posicionar' ? (
                                                        <><ArrowRight className="mr-2 h-4 w-4 text-orange-600" /> Posicionar Paletes</>
                                                    ) : (
                                                        <><CheckCircle2 className="mr-2 h-4 w-4" /> Ver Detalhes</>
                                                    )}
                                                </DropdownMenuItem>
                                                {batch.status === 'Montar' && (
                                                    <DropdownMenuItem onClick={() => handleRevertToPendente(batch.id)} className="cursor-pointer text-amber-700">
                                                        <Undo2 className="mr-2 h-4 w-4 text-amber-600" /> Retroceder para Pendente
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem 
                                                    onClick={() => setConfirmDeleteId(batch.id)} 
                                                    disabled={deletingId === batch.id}
                                                    className="text-destructive cursor-pointer focus:text-destructive"
                                                >
                                                    {deletingId === batch.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />} Excluir
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>

                                        <AlertDialog open={confirmDeleteId === batch.id} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Apagar Lote de Recebimento?</AlertDialogTitle>
                                                    <AlertDialogDescription>Tem certeza que deseja apagar a conferência da NF {batch.nfNumber}? Esta ação não pode ser desfeita.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel onClick={() => setConfirmDeleteId(null)} disabled={deletingId === batch.id}>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteBatch(batch.id)} disabled={deletingId === batch.id} className="bg-destructive hover:bg-destructive/90">
                                                        {deletingId === batch.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Apagar
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>

            {selectedBatchId && (
                <ReceivingConferenceModal 
                    batchId={selectedBatchId} 
                    isOpen={!!selectedBatchId} 
                    onClose={handleConferenceClose} 
                />
            )}

            <NfeAttachmentDialog
                isOpen={isImportXmlOpen}
                onOpenChange={setIsImportXmlOpen}
                onXmlObtained={handleXmlObtained}
                title="Importar NF-e"
                description="Importe dados da NF-e para iniciar a conferência física dos lotes recebidos."
            />

            <XmlPreviewDialog
                isOpen={isPreviewOpen}
                onClose={closePreview}
                onConfirm={handleConfirmXmlImport}
                parsedData={parsedXmlData}
                isLoading={isSubmitting}
                pendingClientMappingData={pendingClientMappingData}
            />
        </Card>
    );
}
