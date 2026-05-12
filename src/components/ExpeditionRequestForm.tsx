"use client";

import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Loader2, Send } from 'lucide-react';
import { parseNfeXml } from '@/lib/xml-parser';
import { NfeAttachmentDialog } from '@/components/NfeAttachmentDialog';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/api-client';

interface ExpeditionRequestFormProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function ExpeditionRequestForm({ isOpen, onOpenChange, onSuccess }: ExpeditionRequestFormProps) {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isNfeAttachmentOpen, setIsNfeAttachmentOpen] = useState(false);
    const [xmlContent, setXmlContent] = useState<string | null>(null);
    const [parsedData, setParsedData] = useState<any | null>(null);
    const [availableStockBySku, setAvailableStockBySku] = useState<Record<string, any[]>>({});
    const [itemSelections, setItemSelections] = useState<Record<string, { itemId: string, quantity: number }[]>>({});
    const [isLoadingStock, setIsLoadingStock] = useState(false);

    const handleXmlObtained = (xmlContentString: string) => {
        setXmlContent(xmlContentString);
        try {
            const parsed = parseNfeXml(xmlContentString);
            if (parsed.errors.length > 0) {
                toast({
                    variant: 'destructive',
                    title: 'Erro no XML',
                    description: parsed.errors.join(', ')
                });
                resetForm();
                return;
            }
            setParsedData(parsed);
            toast({ title: 'NF-e Carregada', description: `NF-e ${parsed.dadosNfe.numero} identificada e pronta para envio.` });
        } catch (err) {
            toast({ variant: 'destructive', title: 'Falha no Parse', description: 'Ocorreu um erro ao processar os dados da NF-e.' });
            resetForm();
        }
    };

    const resetForm = () => {
        setXmlContent(null);
        setParsedData(null);
        setAvailableStockBySku({});
        setItemSelections({});
    };

    const loadAvailableStock = async (skus: string[]) => {
        setIsLoadingStock(true);
        try {
            // Fetch all stock for client
            const res = await authFetch('/api/stock/items?clientMode=1');
            if (res.ok) {
                const allItems: any[] = await res.json();
                const grouped: Record<string, any[]> = {};
                skus.forEach(sku => {
                    grouped[sku] = allItems
                      .filter(i => i.sku === sku && i.quantity > 0)
                      .sort((a, b) => {
                          const dateA = a.expirationDate ? new Date(a.expirationDate).getTime() : Infinity;
                          const dateB = b.expirationDate ? new Date(b.expirationDate).getTime() : Infinity;
                          return dateA - dateB; // FEFO sort
                      });
                });
                setAvailableStockBySku(grouped);
                
                // Default: Auto-select FEFO
                const initialSelections: Record<string, any[]> = {};
                skus.forEach(sku => {
                    const reqQty = parsedData?.produtos.find((p: any) => p.codigo === sku)?.quantidade || 0;
                    initialSelections[sku] = autoSelectFefo(grouped[sku] || [], reqQty);
                });
                setItemSelections(initialSelections);
            }
        } catch (err) {
            console.error('Error loading stock for skus:', err);
        } finally {
            setIsLoadingStock(false);
        }
    };

    const autoSelectFefo = (stockItems: any[], requiredQty: number) => {
        let remaining = requiredQty;
        const selected: { itemId: string, quantity: number }[] = [];
        for (const item of stockItems) {
            if (remaining <= 0) break;
            const amount = Math.min(item.quantity, remaining);
            selected.push({ itemId: item.id, quantity: amount });
            remaining -= amount;
        }
        return selected;
    };

    useEffect(() => {
        if (parsedData && parsedData.produtos) {
            const skus = Array.from(new Set(parsedData.produtos.map((p: any) => p.codigo))) as string[];
            loadAvailableStock(skus);
        }
    }, [parsedData]);

    const handleConfirmRequest = async () => {
        if (!xmlContent || !parsedData) return;
        
        setIsSubmitting(true);
        try {
            // Mapeando itens da Nfe com lotes selecionados
            const requestedItems = parsedData.produtos.map((p: any) => {
                const selections = itemSelections[p.codigo] || [];
                return {
                    sku: p.codigo,
                    description: p.descricao,
                    quantityRequested: p.quantidade,
                    resolvedQuantity: 0,
                    stockItemIds: selections.map(s => s.itemId),
                    // We can also pass the explicit distribution if the backend supports it
                    batchSelections: selections 
                };
            });

            const payload = {
                fractionalNfNumber: parsedData.dadosNfe.numero,
                fractionalNfeXml: xmlContent,
                items: requestedItems,
            };

            const response = await authFetch('/api/expeditions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Falha ao solicitar expedição');
            }

            toast({ title: 'Sucesso', description: 'Solicitação de expedição enviada ao armazém!' });
            onOpenChange(false);
            if (onSuccess) onSuccess();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro ao enviar pedido', description: error.message });
        } finally {
            setIsSubmitting(false);
            resetForm();
        }
    };

    return (
        <>
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open && !isSubmitting) resetForm();
            if (!isSubmitting) onOpenChange(open);
        }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Solicitar Expedição (Fulfillment)</DialogTitle>
                    <DialogDescription>Faça o upload do XML da sua Nota Fiscal de Venda. Nossa equipe separará os itens correspondentes do seu estoque.</DialogDescription>
                </DialogHeader>

                <div className="py-6 flex flex-col items-center justify-center">
                    {!parsedData ? (
                        <div 
                            className="border-2 border-dashed border-gray-300 rounded-lg p-10 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition w-full"
                            onClick={() => setIsNfeAttachmentOpen(true)}
                        >
                            <Upload className="w-10 h-10 text-muted-foreground mb-4" />
                            <p className="text-sm font-medium text-gray-700 text-center">Clique para obter NF-e da Carga Fracionada</p>
                            <p className="text-xs text-muted-foreground mt-1 text-center">(Arquivo XML ou Chave de Acesso)</p>
                        </div>
                    ) : (
                        <div className="w-full space-y-4">
                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-center justify-between">
                                <div className="flex items-center">
                                    <FileText className="w-8 h-8 text-blue-600 mr-3" />
                                    <div>
                                        <p className="font-medium text-blue-900">Nota Fiscal Nº {parsedData.dadosNfe.numero}</p>
                                        <p className="text-sm text-blue-700">{parsedData.produtos.length} item(ns) identificados</p>
                                    </div>
                                </div>
                                <Button variant="ghost" size="sm" onClick={resetForm} disabled={isSubmitting} className="text-blue-800 hover:text-blue-900">
                                    Trocar
                                </Button>
                            </div>

                            <div className="max-h-[300px] overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-gray-200">
                                {parsedData.produtos.map((p: any, idx: number) => {
                                    const stock = availableStockBySku[p.codigo] || [];
                                    const selections = itemSelections[p.codigo] || [];
                                    const selectedQty = selections.reduce((acc, s) => acc + s.quantity, 0);
                                    const isComplete = selectedQty >= p.quantidade;

                                    return (
                                        <div key={`${p.codigo}-${idx}`} className="text-sm border rounded-md p-3 space-y-2">
                                            <div className="flex justify-between items-start">
                                                <div className="font-semibold">{p.descricao} <span className="text-xs text-muted-foreground font-normal">({p.codigo})</span></div>
                                                <div className="text-xs font-bold px-2 py-0.5 rounded bg-muted">Qtd: {p.quantidade}</div>
                                            </div>
                                            
                                            <div className="space-y-1">
                                                {isLoadingStock ? (
                                                    <div className="flex items-center text-[10px] text-muted-foreground">
                                                        <Loader2 className="w-3 h-3 animate-spin mr-1" /> Carregando estoque...
                                                    </div>
                                                ) : stock.length > 0 ? (
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Lotes Alocados (FEFO):</p>
                                                        {selections.map(sel => {
                                                            const item = stock.find(s => s.id === sel.itemId);
                                                            return (
                                                                <div key={sel.itemId} className="flex justify-between items-center text-xs bg-emerald-50 text-emerald-800 p-1.5 rounded border border-emerald-100">
                                                                    <span>Lote: <span className="font-bold">{item?.batch || 'N/A'}</span></span>
                                                                    <span className="font-bold">{sel.quantity} un.</span>
                                                                </div>
                                                            );
                                                        })}
                                                        {!isComplete && (
                                                            <div className="text-[10px] text-red-500 font-bold bg-red-50 p-1 rounded border border-red-100">
                                                                ⚠️ Estoque insuficiente! (Faltam {p.quantidade - selectedQty} unidades)
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="text-[10px] text-red-500 font-bold bg-red-50 p-1 rounded border border-red-100">
                                                        ❌ Produto não encontrado no estoque!
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
                    <Button onClick={handleConfirmRequest} disabled={!parsedData || isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        Concluir Solicitação
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        <NfeAttachmentDialog
            isOpen={isNfeAttachmentOpen}
            onOpenChange={setIsNfeAttachmentOpen}
            onXmlObtained={handleXmlObtained}
            title="Importar dados da NF-e"
        />
        </>
    );
}
