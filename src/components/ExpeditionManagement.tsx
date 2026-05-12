"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, PlayCircle, MapPin, PackageOpen } from 'lucide-react';
import { authFetch } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import type { ExpeditionRequest } from '@/lib/types';
import { format } from 'date-fns';
import { PickingDialog } from './PickingDialog';

interface ExpeditionManagementProps {
    requests: ExpeditionRequest[];
    isLoading: boolean;
    onDataMutated: () => void;
}

export function ExpeditionManagement({ requests, isLoading, onDataMutated }: ExpeditionManagementProps) {
    const { toast } = useToast();
    const [submittingId, setSubmittingId] = useState<string | null>(null);
    const [pickingRequest, setPickingRequest] = useState<ExpeditionRequest | null>(null);
    const [isPickingDialogOpen, setIsPickingDialogOpen] = useState(false);

    const handleOpenPicking = (req: ExpeditionRequest) => {
        setPickingRequest(req);
        setIsPickingDialogOpen(true);
    };

    const handleConfirmPicking = async (requestId: string) => {
        setSubmittingId(requestId);
        try {
            const res = await authFetch(`/api/expeditions/${requestId}/pick`, { method: 'POST' });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Erro ao realizar integração de fulfillment');
            }
            toast({ title: 'Expedição Finalizada', description: 'Volumes debitados e Frete Fracionado criado com sucesso.' });
            setIsPickingDialogOpen(false);
            setPickingRequest(null);
            onDataMutated();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Falha Operacional', description: error.message });
        } finally {
            setSubmittingId(null);
        }
    };

    if (isLoading) {
        return <div className="text-center py-20"><Loader2 className="animate-spin w-8 h-8 mx-auto text-primary" /></div>;
    }

    if (!requests.length) {
        return (
            <Card className="border-dashed border-2">
                <CardContent className="py-20 flex flex-col items-center justify-center text-muted-foreground">
                    <PackageOpen className="w-12 h-12 mb-4 opacity-70" />
                    <p className="text-lg font-medium">Nenhum Pedido Pendente</p>
                    <p className="text-sm">Os pedidos de expedição gerados pelos clientes do Portal aparecerão aqui.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Operações de Picking</CardTitle>
                    <CardDescription>Visualize e inicie a separação das notas fiscais de venda.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>NF de Venda</TableHead>
                                    <TableHead>Itens / Volumes</TableHead>
                                    <TableHead>Data Solicitação</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {requests.map(req => (
                                    <TableRow key={req.id}>
                                        <TableCell>
                                            <Badge 
                                                variant={req.status === 'Expedido' ? 'default' : req.status === 'Em Separação' ? 'secondary' : 'outline'}
                                                className={req.status === 'Pendente' ? 'text-orange-600 bg-orange-100' : ''}
                                            >
                                                {req.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-medium">{req.clientName}</TableCell>
                                        <TableCell>{Array.from(new Set(req.items.map(i => i.outboundNfNumber).filter(Boolean))).join(', ') || '--'}</TableCell>
                                        <TableCell>{req.items.reduce((acc, curr) => acc + curr.quantityRequested, 0)} vol.</TableCell>
                                        <TableCell>{req.requestedAt ? format(new Date(req.requestedAt), 'dd/MM/yyyy HH:mm') : '--'}</TableCell>
                                        <TableCell className="text-right">
                                            {req.status !== 'Expedido' ? (
                                                <Button 
                                                    size="sm" 
                                                    variant="default"
                                                    className="bg-emerald-600 hover:bg-emerald-700" 
                                                    onClick={() => handleOpenPicking(req)}
                                                    disabled={submittingId === req.id}
                                                >
                                                    {submittingId === req.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <PlayCircle className="w-4 h-4 mr-2"/>}
                                                    Realizar Separação
                                                </Button>
                                            ) : (
                                                 <Button size="sm" variant="outline" onClick={() => window.open('/operational')}>
                                                     <MapPin className="w-4 h-4 mr-2" />
                                                     Ver no Operacional
                                                 </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Picking Conference Dialog */}
            <PickingDialog
                request={pickingRequest}
                isOpen={isPickingDialogOpen}
                onOpenChange={setIsPickingDialogOpen}
                onConfirm={handleConfirmPicking}
                isSubmitting={submittingId !== null}
            />
        </>
    );
}
