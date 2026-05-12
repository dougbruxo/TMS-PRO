"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/api-client';
import { Loader2, PlusCircle, Trash2, CheckCircle2, AlertCircle, RefreshCw, ChevronDown, Layers, AlertTriangle, Eye, Package, SplitSquareHorizontal, ArrowRight, ArrowLeft } from 'lucide-react';
import type { StockItem, ReceivingBatch } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { printPalletLabels } from '@/lib/print';
import { useAuth } from '@/hooks/use-auth';

interface ConferenceModalProps {
    batchId: string;
    isOpen: boolean;
    onClose: (mutated: boolean) => void;
}

export function ReceivingConferenceModal({ batchId, isOpen, onClose }: ConferenceModalProps) {
    const { toast } = useToast();
    const { companyProfile } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [batch, setBatch] = useState<ReceivingBatch | null>(null);
    const [items, setItems] = useState<any[]>([]);
    const [availablePallets, setAvailablePallets] = useState<any[]>([]);
    const [positions, setPositions] = useState<any[]>([]);

    // Conference State
    const [isPalletized, setIsPalletized] = useState<boolean>(false);
    const [palletCount, setPalletCount] = useState<number | ''>(1);
    const [consolidateWith, setConsolidateWith] = useState<string>('NEW');
    const [addedItems, setAddedItems] = useState<any[]>([]);

    const [palletAllocations, setPalletAllocations] = useState<Record<number, string>>({});
    const [selectedPallet, setSelectedPallet] = useState<number | null>(null);

    const [confirmActionModal, setConfirmActionModal] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        actionType: 'AUTO_ALLOCATE' | 'UNIFY_POSITION' | null;
    }>({ isOpen: false, title: '', description: '', actionType: null });


    // Montar State
    const [palletAssignments, setPalletAssignments] = useState<{ uid: string, itemId: string, name: string, sku: string, quantity: number, palletNumber: number }[]>([]);
    const [activePallet, setActivePallet] = useState<number>(1);
    const [selectedLeft, setSelectedLeft] = useState<string[]>([]);
    const [leftAmounts, setLeftAmounts] = useState<Record<string, number>>({});
    const [selectedRight, setSelectedRight] = useState<string[]>([]);
    const [rightAmounts, setRightAmounts] = useState<Record<string, number>>({});
    
    // Actions State
    const [isRemoveItemModalOpen, setIsRemoveItemModalOpen] = useState(false);

    useEffect(() => {
        if (isOpen && batchId) {
            loadData();
        }
    }, [isOpen, batchId]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            // Load Batch Data
            const res = await authFetch(`/api/stock/receiving/${batchId}`);
            if (res.ok) {
                const data = await res.json();
                setBatch(data.batch);
                const mappedItems = data.items.map((i: any) => {
                    const qty = i.quantity || i.quantityNf || 0;
                    return {
                        ...i,
                        uid: i.id || Math.random().toString(36).substr(2, 9),
                        quantity: qty,
                        originalQuantity: qty, // Crucial for pallet assembly logic
                        notes: i.conferenceNotes || '',
                        removed: false
                    };
                });
                setItems(mappedItems);
                setAvailablePallets(data.availablePallets);
                // Inicializar palletCount com o volume da NF (nfQVol) se disponível
                if (data.batch.nfQVol && data.batch.nfQVol > 0) {
                    setPalletCount(data.batch.nfQVol);
                }
                
                if (data.batch.unitType === 'PALETES') {
                    setIsPalletized(true);
                } else {
                    setIsPalletized(false);
                }
            }

            // Load Positions
            const posRes = await authFetch('/api/stock/positions');
            if (posRes.ok) {
                setPositions(await posRes.json());
            }

        } catch (error) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao carregar dados da conferência.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleQuantityChange = (uid: string, qty: number | '') => {
        setItems(prev => prev.map(item => item.uid === uid ? { ...item, quantity: qty as number } : item));
    };

    const handleNotesChange = (uid: string, notes: string) => {
        setItems(prev => prev.map(item => item.uid === uid ? { ...item, notes } : item));
    };

    const handlePositionChange = (uid: string, positionId: string) => {
        setItems(prev => prev.map(item => item.uid === uid ? { ...item, positionId } : item));
    };

    const toggleItemRemoved = (uid: string) => {
        setItems(prev => prev.map(item => item.uid === uid ? { ...item, removed: !item.removed } : item));
    };

    const addManualItem = () => {
        setAddedItems(prev => [...prev, {
            id: `manual-${Date.now()}`,
            sku: '',
            name: '',
            quantity: 1,
            positionId: '',
        }]);
    };

    const updateManualItem = (id: string, field: string, value: any) => {
        setAddedItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const removeManualItem = (id: string) => {
        setAddedItems(prev => prev.filter(item => item.id !== id));
    };

    const handleAutoAllocateMontar = () => {
        if (batch?.status !== 'Montar') return;

        const activeItems = items.filter(i => !i.removed);
        if (activeItems.length === 0) return;

        const numPallets = Number(batch?.nfQVol) || 1;
        
        const newAssignments: any[] = [];
        const remainingItems = activeItems.map(item => ({
            ...item,
            remQty: item.originalQuantity || item.quantity
        }));

        let currentItemIdx = 0;
        
        for (let palletNum = 1; palletNum <= numPallets; palletNum++) {
            const remainingPallets = numPallets - palletNum + 1;
            const remainingTotal = remainingItems.reduce((sum, i) => sum + i.remQty, 0);
            
            // Average units per pallet from the remaining pool
            const targetQty = Math.ceil(remainingTotal / remainingPallets);
            
            let assignedToThisPallet = 0;
            
            while (assignedToThisPallet < targetQty && currentItemIdx < remainingItems.length) {
                const item = remainingItems[currentItemIdx];
                const needed = targetQty - assignedToThisPallet;
                const toTake = Math.min(item.remQty, needed);
                
                if (toTake > 0) {
                    newAssignments.push({
                        uid: Math.random().toString(),
                        itemId: item.id,
                        name: item.name,
                        sku: item.sku,
                        quantity: toTake,
                        palletNumber: palletNum
                    });
                    
                    item.remQty -= toTake;
                    assignedToThisPallet += toTake;
                }
                
                if (item.remQty <= 0) {
                    currentItemIdx++;
                }
            }
        }

        // Se sobrou algum item por causa de arredondamento, joga no ultimo palete
        while (currentItemIdx < remainingItems.length) {
            const item = remainingItems[currentItemIdx];
            if (item.remQty > 0) {
                newAssignments.push({
                    uid: Math.random().toString(),
                    itemId: item.id,
                    name: item.name,
                    sku: item.sku,
                    quantity: item.remQty,
                    palletNumber: numPallets
                });
                item.remQty = 0;
            }
            currentItemIdx++;
        }

        setPalletAssignments(newAssignments);
        toast({ title: 'Alocação Automática', description: `Todos os SKUs foram distribuídos em ${numPallets} paletes.` });
    };

    const getAvailableQty = (itemId: string) => {
        const item = items.find(i => i.id === itemId);
        const assigned = palletAssignments.filter(a => a.itemId === itemId).reduce((sum, a) => sum + a.quantity, 0);
        const total = item?.originalQuantity || item?.quantity || 0;
        return total - assigned;
    };

    const handleMoveRight = () => {
        if (selectedLeft.length === 0) return;
        
        const newAssignments = [...palletAssignments];
        
        selectedLeft.forEach(itemId => {
            const moveQty = leftAmounts[itemId] !== undefined ? leftAmounts[itemId] : getAvailableQty(itemId);
            if (moveQty <= 0) return;
            const available = getAvailableQty(itemId);
            const actualMove = Math.min(moveQty, available);
            if (actualMove <= 0) return;
            
            const existingIdx = newAssignments.findIndex(a => a.itemId === itemId && a.palletNumber === activePallet);
            if (existingIdx >= 0) {
                newAssignments[existingIdx].quantity += actualMove;
            } else {
                const item = items.find(i => i.id === itemId);
                if (item) {
                    newAssignments.push({
                        uid: Math.random().toString(),
                        itemId: item.id,
                        name: item.name,
                        sku: item.sku,
                        quantity: actualMove,
                        palletNumber: activePallet
                    });
                }
            }
        });
        
        setPalletAssignments(newAssignments);
        setSelectedLeft([]);
        setLeftAmounts({});
    };

    const handleMoveLeft = () => {
        if (selectedRight.length === 0) return;
        
        let newAssignments = [...palletAssignments];
        
        selectedRight.forEach(uid => {
            const assignment = palletAssignments.find(a => a.uid === uid);
            if (!assignment) return;
            const returnQty = rightAmounts[uid] !== undefined ? rightAmounts[uid] : assignment.quantity;
            if (returnQty <= 0) return;
            
            const existingIdx = newAssignments.findIndex(a => a.uid === uid);
            if (existingIdx >= 0) {
                newAssignments[existingIdx].quantity -= returnQty;
                if (newAssignments[existingIdx].quantity <= 0) {
                    newAssignments.splice(existingIdx, 1);
                }
            }
        });
        
        setPalletAssignments(newAssignments);
        setSelectedRight([]);
        setRightAmounts({});
    };

    const handlePalletAllocationChange = (palletNumber: number, positionId: string) => {
        const existingPallet = Object.entries(palletAllocations).find(([_, id]) => id === positionId);
        
        if (existingPallet && Number(existingPallet[0]) !== palletNumber) {
            const posName = positions.find(p => p.id === positionId)?.name || positionId;
            toast({
                variant: 'destructive',
                title: 'Posição Indisponível (Em uso)',
                description: `A posição ${posName} já foi definida para o Palete ${existingPallet[0]}.`
            });
            return;
        }

        setPalletAllocations(prev => ({ ...prev, [palletNumber]: positionId }));
    };

    const handleConfirm = async () => {
        if (!batch) return;

        if (batch.status === 'Posicionar') {
            const uniquePallets = Array.from(new Set(items.map(i => i.palletNumber))).filter(Boolean) as number[];
            
            // Validação 1: Posições duplicadas no form (na mesma tela)
            const usedPositions = new Set<string>();
            for (const posId of Object.values(palletAllocations)) {
                if (posId) {
                    if (usedPositions.has(posId)) {
                        toast({ variant: 'destructive', title: 'Erro de Alocação', description: `Não é possível definir a mesma posição para múltiplos paletes no recebimento.` });
                        return;
                    }
                    usedPositions.add(posId);
                }
            }

            // Validação 2: Verificar posições vazias/faltantes
            const missingAllocations = uniquePallets.filter(p => !palletAllocations[p]);
            if (missingAllocations.length > 0) {
                setConfirmActionModal({
                    isOpen: true,
                    title: 'Posições Faltantes',
                    description: `Faltam definir posições para ${missingAllocations.length} palete(s). Deseja que o sistema defina as posições automaticamente (utilizando posições vazias)?`,
                    actionType: 'AUTO_ALLOCATE'
                });
                return;
            }

            // Validação 3: Verificar ocupação física das posições selecionadas (Unificar)
            const occupiedPositions = Object.values(palletAllocations)
                .map(posId => positions.find(p => p.id === posId))
                .filter(p => p && p.status !== 'Vazio');
                
            if (occupiedPositions.length > 0) {
                setConfirmActionModal({
                    isOpen: true,
                    title: 'Posição Ocupada',
                    description: `A(s) posição(ões) ${occupiedPositions.map(p => p?.name).join(', ')} já estão ocupadas fisicamente. Deseja unificar os paletes nestas posições?`,
                    actionType: 'UNIFY_POSITION'
                });
                return;
            }
        }

        executeConfirm();
    };

    const handleAutoAllocateAndValidate = () => {
        const uniquePallets = Array.from(new Set(items.map(i => i.palletNumber))).filter(Boolean) as number[];
        const emptyPositions = positions.filter(p => p.status === 'Vazio');
        const usedInForm = new Set(Object.values(palletAllocations).filter(Boolean));
        let availableEmpty = emptyPositions.filter(p => !usedInForm.has(p.id));
        
        let newAllocations = { ...palletAllocations };
        let hasError = false;

        for (const pallet of uniquePallets) {
            if (!newAllocations[pallet]) {
                if (availableEmpty.length === 0) {
                    hasError = true;
                    break;
                }
                const pos = availableEmpty.shift();
                if (pos) newAllocations[pallet] = pos.id;
            }
        }

        if (hasError) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Não há posições vazias suficientes no armazém para alocar os paletes.' });
            return;
        }

        setPalletAllocations(newAllocations);

        const occupiedPositions = Object.values(newAllocations)
                .map(posId => positions.find(p => p.id === posId))
                .filter(p => p && p.status !== 'Vazio');
                
        if (occupiedPositions.length > 0) {
            setTimeout(() => {
                setConfirmActionModal({
                    isOpen: true,
                    title: 'Posição Ocupada',
                    description: `A(s) posição(ões) ${occupiedPositions.map(p => p?.name).join(', ')} já estão ocupadas fisicamente. Deseja unificar os paletes nestas posições?`,
                    actionType: 'UNIFY_POSITION'
                });
            }, 100);
            return;
        }

        executeConfirm(newAllocations);
    };

    const executeConfirm = async (overrideAllocations?: Record<number, string>) => {
        if (!batch) return;

        setIsSubmitting(true);
        const finalAllocations = overrideAllocations || palletAllocations;

        try {
            const payload = batch.status === 'Posicionar' ? {
                action: 'posicionar',
                palletAllocations: Object.entries(finalAllocations).map(([palletNumber, positionId]) => ({
                    palletNumber: Number(palletNumber),
                    positionId
                }))
            } : batch.status === 'Montar' ? {
                action: 'montar',
                palletAssignments: palletAssignments.map(a => ({
                    itemId: a.itemId,
                    palletNumber: a.palletNumber,
                    quantity: a.quantity
                }))
            } : {
                action: 'conferir',
                items: items.map(i => ({
                    id: i.id,
                    quantity: Number(i.quantity) || 0,
                    positionId: i.positionId,
                    conferenceNotes: i.notes,
                    removed: i.removed
                })),
                palletConfig: isPalletized ? {
                    isPalletized: true,
                    palletCount: Number(palletCount) || 1,
                    consolidateWith: consolidateWith === 'NEW' ? undefined : consolidateWith
                } : { isPalletized: false },
                addedItems: addedItems.map(i => ({
                    sku: i.sku,
                    name: i.name,
                    quantity: Number(i.quantity) || 0,
                    positionId: i.positionId
                }))
            };

            const res = await authFetch(`/api/stock/receiving/${batchId}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                toast({
                    title: 'Conferência Concluída',
                    description: data.message,
                    variant: data.hasDivergence ? 'destructive' : 'default'
                });
                if (data.labels && data.labels.length > 0) {
                    toast({ title: 'Gerando Etiquetas', description: 'Abrindo visualização de impressão...' });
                    try {
                        await printPalletLabels(data.labels, companyProfile?.logoUrl);
                    } catch (e) {
                        toast({ variant: 'destructive', title: 'Erro de Impressão', description: 'Não foi possível gerar as etiquetas.' });
                    }
                }
                onClose(true);
            } else {
                const err = await res.json();
                toast({ variant: 'destructive', title: 'Erro', description: err.error });
            }

        } catch (error) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao confirmar conferência.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const hasDivergence = items.some(i => i.removed || i.quantity !== i.quantityNf) || addedItems.length > 0;

    return (
        <>
        <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose(false)}>
            <DialogContent className="max-w-[98vw] w-[98vw] max-h-[95vh] flex flex-col p-6">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-blue-600" />
                        {batch?.status === 'Posicionar' 
                            ? `Alocação de Paletes - NF ${batch?.nfNumber}` 
                            : batch?.status === 'Montar'
                            ? `Montagem de Paletes - NF ${batch?.nfNumber}`
                            : `Conferência Física - NF ${batch?.nfNumber}`}
                    </DialogTitle>
                    <DialogDescription>
                        {batch?.status === 'Posicionar' 
                            ? 'Defina a posição no estoque para cada palete recebido.'
                            : batch?.status === 'Montar'
                            ? 'Organize os SKUs nos paletes físicos. Arraste ou altere o número do palete de cada item.'
                            : 'Revise os itens importados do XML, ajuste as quantidades reais recebidas e defina a posição final no estoque.'}
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex-1 flex justify-center items-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                ) : batch && (
                    <div className="flex-1 min-h-0 overflow-hidden flex flex-col gap-4">

                        {batch.status === 'Posicionar' ? (
                            <>
                            <div className="flex-1 overflow-auto border rounded-md">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-background z-10">
                                        <TableRow>
                                            <TableHead>Palete</TableHead>
                                            <TableHead>Qtd. Itens (SKUs)</TableHead>
                                            <TableHead>Qtd. Total Volumes</TableHead>
                                            <TableHead className="w-64">Posição Destino</TableHead>
                                            <TableHead className="w-16 text-center">Itens</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {Array.from(new Set(items.map(i => i.palletNumber))).filter(Boolean).sort((a: any, b: any) => a - b).map(palletNumber => {
                                            const palletItems = items.filter(i => i.palletNumber === palletNumber);
                                            const skuCount = palletItems.length;
                                            const totalVolumes = palletItems.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
                                            return (
                                                <TableRow key={palletNumber as number} className="hover:bg-blue-50/50">
                                                    <TableCell className="font-medium">
                                                        <div className="flex items-center gap-2">
                                                            <Package className="w-4 h-4 text-blue-600" />
                                                            Palete {palletNumber as number}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>{skuCount} tipos</TableCell>
                                                    <TableCell className="font-mono">{totalVolumes} un.</TableCell>
                                                    <TableCell>
                                                        <Select
                                                            value={palletAllocations[palletNumber as number] || ''}
                                                            onValueChange={(val) => handlePalletAllocationChange(palletNumber as number, val)}
                                                        >
                                                            <SelectTrigger className="h-8">
                                                                <SelectValue placeholder="Selecione a Posição..." />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {positions.map(pos => (
                                                                    <SelectItem key={pos.id} value={pos.id}>
                                                                        {pos.name} {pos.status !== 'Vazio' ? `(${pos.status})` : ''}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 w-7 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                                                            onClick={() => setSelectedPallet(palletNumber as number)}
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Dialog de Detalhes do Palete */}
                            <Dialog open={selectedPallet !== null} onOpenChange={(open) => !open && setSelectedPallet(null)}>
                                <DialogContent className="max-w-lg">
                                    <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2">
                                            <Package className="w-5 h-5 text-blue-600" />
                                            Palete {selectedPallet} — Composição
                                        </DialogTitle>
                                        <DialogDescription>
                                            Itens que compõem este palete (distribuídos automaticamente na conferência).
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="max-h-[400px] overflow-auto border rounded-md">
                                        <Table>
                                            <TableHeader className="sticky top-0 bg-background z-10">
                                                <TableRow>
                                                    <TableHead>Produto</TableHead>
                                                    <TableHead className="w-16 text-center">SKU</TableHead>
                                                    <TableHead className="w-24 text-center">Quantidade</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {items.filter(i => i.palletNumber === selectedPallet).map(item => (
                                                    <TableRow key={item.id}>
                                                        <TableCell>
                                                            <div className="font-medium text-sm">{item.name}</div>
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <span className="font-mono text-xs text-muted-foreground">{item.sku}</span>
                                                        </TableCell>
                                                        <TableCell className="text-center font-mono font-semibold">{item.quantity}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    <div className="flex justify-between items-center pt-2 text-sm text-muted-foreground">
                                        <span>{items.filter(i => i.palletNumber === selectedPallet).length} tipos de produto</span>
                                        <span className="font-semibold text-foreground">
                                            Total: {items.filter(i => i.palletNumber === selectedPallet).reduce((s, i) => s + (Number(i.quantity) || 0), 0)} volumes
                                        </span>
                                    </div>
                                </DialogContent>
                            </Dialog>
                            </>
                        ) : batch.status === 'Montar' ? (
                            /* ===== VIEW: MONTAR PALETES ===== */
                            <div className="flex-1 flex flex-row gap-2 overflow-hidden py-1">
                                {/* Left Side: SKUs Pendentes */}
                                <div className="flex-[5] flex flex-col border rounded-md overflow-hidden bg-slate-50/50 relative">
                                    <div className="bg-slate-100 p-2 border-b font-semibold text-sm shadow-sm z-20">
                                        SKUs Disponíveis
                                    </div>
                                    <div className="flex-1 overflow-auto">
                                        <Table>
                                            <TableHeader className="sticky top-0 bg-slate-100 z-10 shadow-sm border-b">
                                                <TableRow>
                                                    <TableHead className="w-8 px-2"></TableHead>
                                                    <TableHead className="px-2">Produto</TableHead>
                                                    <TableHead className="w-20 text-center px-1">Disp.</TableHead>
                                                    <TableHead className="w-20 text-center px-1">Mover</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {items.filter(i => !i.removed && getAvailableQty(i.id) > 0).map((item) => {
                                                    const available = getAvailableQty(item.id);
                                                    const isSelected = selectedLeft.includes(item.id);
                                                    const amount = leftAmounts[item.id] !== undefined ? leftAmounts[item.id] : available;
                                                    
                                                    return (
                                                    <TableRow key={item.id} className={`${isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-100/50'}`}>
                                                        <TableCell className="px-2">
                                                            <input 
                                                                type="checkbox" 
                                                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                                checked={isSelected}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setSelectedLeft(prev => [...prev, item.id]);
                                                                    } else {
                                                                        setSelectedLeft(prev => prev.filter(id => id !== item.id));
                                                                    }
                                                                }}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="px-2">
                                                            <div className="flex flex-col">
                                                                <span className="font-medium text-xs leading-tight line-clamp-1">{item.name}</span>
                                                                <span className="text-[10px] text-muted-foreground">{item.sku}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-center font-mono text-sm px-1">{available}</TableCell>
                                                        <TableCell className="text-center px-1">
                                                            <Input 
                                                                type="number" 
                                                                min="0"
                                                                max={available}
                                                                className="w-14 text-center font-mono mx-auto h-7 text-xs px-1" 
                                                                value={amount} 
                                                                onChange={(e) => setLeftAmounts(prev => ({ ...prev, [item.id]: e.target.value === '' ? '' : Number(e.target.value) }))}
                                                                disabled={!isSelected}
                                                            />
                                                        </TableCell>
                                                    </TableRow>
                                                    );
                                                })}
                                                {items.filter(i => !i.removed && getAvailableQty(i.id) > 0).length === 0 && (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="text-center text-muted-foreground h-32 text-sm">
                                                            Nenhum SKU disponível para alocação.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>

                                {/* Middle: Setas */}
                                <div className="flex flex-col items-center justify-center gap-4 px-1">
                                    <Button 
                                        variant={selectedLeft.length > 0 ? "default" : "outline"} 
                                        size="icon" 
                                        className="h-10 w-10 rounded-full shadow-sm"
                                        onClick={handleMoveRight}
                                        disabled={selectedLeft.length === 0}
                                    >
                                        <ArrowRight className="w-5 h-5" />
                                    </Button>
                                    <Button 
                                        variant={selectedRight.length > 0 ? "default" : "outline"} 
                                        size="icon" 
                                        className="h-10 w-10 rounded-full shadow-sm"
                                        onClick={handleMoveLeft}
                                        disabled={selectedRight.length === 0}
                                    >
                                        <ArrowLeft className="w-5 h-5" />
                                    </Button>
                                </div>

                                {/* Right Side: Montagem do Palete */}
                                <div className="flex-[5] flex flex-col border rounded-md overflow-hidden bg-amber-50/30 border-amber-200 relative">
                                    <div className="bg-amber-100 p-2 border-b border-amber-200 flex items-center justify-between shadow-sm z-20">
                                        <span className="font-semibold text-sm text-amber-900">Palete:</span>
                                        <div className="flex items-center gap-2">
                                            <Button variant="outline" size="sm" className="h-7 text-xs bg-white text-blue-600 border-blue-200 hover:bg-blue-50" onClick={handleAutoAllocateMontar}>
                                                <Layers className="w-3 h-3 mr-1" /> Auto-Distribuir
                                            </Button>
                                            <Select value={String(activePallet)} onValueChange={(val) => setActivePallet(Number(val))}>
                                                <SelectTrigger className="h-7 w-20 bg-white text-xs border-amber-300 font-semibold text-amber-900 px-2">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Array.from({ length: Number(batch.nfQVol) || 1 }, (_, i) => i + 1).map(n => (
                                                        <SelectItem key={n} value={String(n)}>P{n}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-auto">
                                        <Table>
                                            <TableHeader className="sticky top-0 bg-amber-100 z-10 shadow-sm border-b border-amber-200">
                                                <TableRow>
                                                    <TableHead className="w-8 px-2"></TableHead>
                                                    <TableHead className="text-amber-900 px-2">Produto</TableHead>
                                                    <TableHead className="w-16 text-center text-amber-900 px-1">No P{activePallet}</TableHead>
                                                    <TableHead className="w-20 text-center text-amber-900 px-1">Retornar</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {palletAssignments.filter(a => a.palletNumber === activePallet).map((assignment) => {
                                                    const isSelected = selectedRight.includes(assignment.uid);
                                                    const amount = rightAmounts[assignment.uid] !== undefined ? rightAmounts[assignment.uid] : assignment.quantity;
                                                    
                                                    return (
                                                    <TableRow key={assignment.uid} className={`${isSelected ? 'bg-amber-100/80' : 'hover:bg-amber-50'}`}>
                                                        <TableCell className="px-2">
                                                            <input 
                                                                type="checkbox" 
                                                                className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                                                checked={isSelected}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setSelectedRight(prev => [...prev, assignment.uid]);
                                                                    } else {
                                                                        setSelectedRight(prev => prev.filter(uid => uid !== assignment.uid));
                                                                    }
                                                                }}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="px-2">
                                                            <div className="flex flex-col">
                                                                <span className="font-medium text-xs leading-tight line-clamp-1">{assignment.name}</span>
                                                                <span className="text-[10px] text-muted-foreground">{assignment.sku}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-center font-mono text-sm px-1">{assignment.quantity}</TableCell>
                                                        <TableCell className="text-center px-1">
                                                            <Input 
                                                                type="number" 
                                                                min="0"
                                                                max={assignment.quantity}
                                                                className="w-14 text-center font-mono mx-auto h-7 text-xs px-1" 
                                                                value={amount} 
                                                                onChange={(e) => setRightAmounts(prev => ({ ...prev, [assignment.uid]: e.target.value === '' ? '' : Number(e.target.value) }))}
                                                                disabled={!isSelected}
                                                            />
                                                        </TableCell>
                                                    </TableRow>
                                                    );
                                                })}
                                                {palletAssignments.filter(a => a.palletNumber === activePallet).length === 0 && (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="text-center text-amber-700/50 h-32 text-sm">
                                                            O Palete {activePallet} está vazio.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-auto border rounded-md">
                            <Table>
                                <TableHeader className="sticky top-0 bg-background z-10">
                                    <TableRow>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Produto</TableHead>
                                        <TableHead className="w-24">Qtd. NF</TableHead>
                                        <TableHead className="w-24">Qtd. Real</TableHead>
                                        {batch.unitType !== 'PALETES' && <TableHead className="w-48">Posição Destino</TableHead>}
                                        <TableHead>Observações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.map(item => (
                                        <TableRow key={item.uid} className={item.removed ? 'opacity-50 bg-red-50/50' : item.quantity !== item.quantityNf ? 'bg-orange-50/50' : ''}>
                                            <TableCell>
                                                <Button
                                                    variant={item.removed ? "destructive" : "outline"}
                                                    size="sm"
                                                    onClick={() => toggleItemRemoved(item.uid)}
                                                    className="w-full text-xs"
                                                >
                                                    {item.removed ? 'Faltante' : 'Recebido'}
                                                </Button>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium text-sm">{item.name}</div>
                                                <div className="text-xs text-muted-foreground font-mono">{item.sku}</div>
                                            </TableCell>
                                            <TableCell className="text-center font-mono bg-slate-50">{item.quantityNf}</TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={e => handleQuantityChange(item.uid, e.target.value === '' ? '' : Number(e.target.value))}
                                                    disabled={item.removed}
                                                    className="h-8 font-mono text-center"
                                                />
                                            </TableCell>
                                            {batch.unitType !== 'PALETES' && (
                                                <TableCell>
                                                    <Select
                                                        value={item.positionId}
                                                        onValueChange={(val) => handlePositionChange(item.uid, val)}
                                                        disabled={item.removed}
                                                    >
                                                        <SelectTrigger className="h-8">
                                                            <SelectValue placeholder="Selecione..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {positions.map(pos => (
                                                                <SelectItem key={pos.id} value={pos.id}>
                                                                    {pos.name} {pos.status !== 'Vazio' ? `(${pos.status})` : ''}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                            )}
                                            <TableCell>
                                                <Input
                                                    placeholder="Avaria, validade..."
                                                    value={item.notes}
                                                    onChange={e => handleNotesChange(item.uid, e.target.value)}
                                                    disabled={item.removed}
                                                    className="h-8"
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}

                                    {/* Manual Added Items */}
                                    {addedItems.map((item, idx) => (
                                        <TableRow key={item.id} className="bg-blue-50/50">
                                            <TableCell>
                                                <Badge className="bg-blue-600">Extra</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <Input
                                                        placeholder="Nome do Produto"
                                                        className="h-8 text-sm"
                                                        value={item.name}
                                                        onChange={e => updateManualItem(item.id, 'name', e.target.value)}
                                                    />
                                                    <Input
                                                        placeholder="SKU (opcional)"
                                                        className="h-7 text-xs font-mono"
                                                        value={item.sku}
                                                        onChange={e => updateManualItem(item.id, 'sku', e.target.value)}
                                                    />
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center font-mono bg-slate-50">0</TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={e => updateManualItem(item.id, 'quantity', e.target.value === '' ? '' : Number(e.target.value))}
                                                    className="h-8 font-mono text-center"
                                                />
                                            </TableCell>
                                            {!isPalletized ? (
                                                <TableCell>
                                                    <Select
                                                        value={item.positionId}
                                                        onValueChange={(val) => updateManualItem(item.id, 'positionId', val)}
                                                    >
                                                        <SelectTrigger className="h-8">
                                                            <SelectValue placeholder="Selecione..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {positions.map(pos => (
                                                                <SelectItem key={pos.id} value={pos.id}>
                                                                    {pos.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                            ) : (
                                                <TableCell className="text-muted-foreground text-xs italic">Alocação em paletes</TableCell>
                                            )}
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" onClick={() => removeManualItem(item.id)} className="text-red-500">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                                </Table>
                            </div>
                        )}

                    </div>
                )}

                <DialogFooter className="mt-4 pt-4 border-t flex flex-col xl:flex-row items-center justify-between w-full gap-4">
                    <div className="flex items-center gap-3">
                        {batch?.status !== 'Posicionar' && batch?.status !== 'Montar' && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="bg-slate-50">
                                        Ações <ChevronDown className="w-4 h-4 ml-2" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                    <DropdownMenuItem onClick={addManualItem} className="cursor-pointer">
                                        <PlusCircle className="w-4 h-4 mr-2 text-blue-600" />
                                        <span>Adicionar Item Extra</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setIsRemoveItemModalOpen(true)} className="cursor-pointer">
                                        <Trash2 className="w-4 h-4 mr-2 text-red-600" />
                                        <span className="text-red-600">Remover Item (Faltante)</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        {hasDivergence && (
                            <Badge variant="destructive" className="flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> Divergência
                            </Badge>
                        )}
                    </div>

                    {batch?.status === 'Pendente' && (
                        <div className="flex flex-1 items-center justify-around gap-6 xl:border-x xl:px-6 border-slate-200 w-full xl:w-auto">
                            {/* Toggle Paletização */}
                            <div className="flex items-center gap-2 whitespace-nowrap">
                                <input
                                    type="checkbox"
                                    id="isPalletized"
                                    className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                                    checked={isPalletized}
                                    onChange={(e) => setIsPalletized(e.target.checked)}
                                />
                                <Label htmlFor="isPalletized" className="text-sm font-medium text-slate-700 cursor-pointer select-none">
                                    Tratar como Paletes
                                </Label>
                            </div>

                            {/* Qtd Paletes + Consolidar (só quando paletes ativo) */}
                            {isPalletized && (
                                <>
                                    <div className="flex items-center gap-2 whitespace-nowrap border-l pl-4 border-slate-200">
                                        <Layers className="w-4 h-4 text-blue-600" />
                                        <div className="text-xs text-slate-600">
                                            <span className="font-semibold text-blue-800">{items.filter(i => !i.removed).length}</span> SKUs
                                            <span className="mx-1 text-muted-foreground">•</span>
                                            <span className="font-semibold text-blue-800">{items.filter(i => !i.removed).reduce((sum, i) => sum + (Number(i.quantity) || 0), 0)}</span> Itens
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 whitespace-nowrap">
                                        <Label className="text-xs">Qtd Paletes:</Label>
                                        <Input
                                            type="number"
                                            min="1"
                                            value={palletCount}
                                            onChange={e => setPalletCount(e.target.value === '' ? '' : Number(e.target.value))}
                                            className="h-8 w-16 text-center"
                                        />
                                    </div>
                                    {availablePallets.length > 0 && (
                                        <div className="flex items-center gap-2">
                                            <Select value={consolidateWith} onValueChange={setConsolidateWith}>
                                                <SelectTrigger className="h-8 w-[140px] whitespace-nowrap">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="NEW">Novos Paletes</SelectItem>
                                                    {availablePallets.map(p => (
                                                        <SelectItem key={p.positionId} value={p.positionId}>
                                                            {p.positionName}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    <div className="flex items-center gap-2 mt-2 xl:mt-0 whitespace-nowrap">
                        <Button variant="outline" onClick={() => onClose(false)} disabled={isSubmitting}>Cancelar</Button>
                        <Button onClick={handleConfirm} disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                            {batch?.status === 'Pendente' && isPalletized ? 'Avançar para Montagem' : batch?.status === 'Pendente' && !isPalletized ? 'Concluir Conferência' : batch?.status === 'Montar' ? 'Avançar para Posicionamento' : 'Confirmar Posições'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Modal: Remover Item (Faltante) */}
        <Dialog open={isRemoveItemModalOpen} onOpenChange={setIsRemoveItemModalOpen}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Trash2 className="w-5 h-5 text-red-600" />
                        Remover Item
                    </DialogTitle>
                    <DialogDescription>
                        Identificou falta de um produto físico em relação à NF? 
                        Selecione abaixo para marcá-lo como "Faltante".
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 flex flex-col gap-4">
                    <Select onValueChange={(val) => {
                        toggleItemRemoved(val);
                        setIsRemoveItemModalOpen(false);
                    }}>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione um produto..." />
                        </SelectTrigger>
                        <SelectContent>
                            {items.filter(i => !i.removed).map(item => (
                                <SelectItem key={item.uid} value={item.uid}>
                                    {item.name} <span className="text-muted-foreground text-xs ml-2">({item.quantityNf} UN)</span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsRemoveItemModalOpen(false)}>Cancelar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Modal: Ação de Confirmação (Posicionar Paletes) */}
        <AlertDialog open={confirmActionModal.isOpen} onOpenChange={(open) => !open && setConfirmActionModal(prev => ({ ...prev, isOpen: false }))}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{confirmActionModal.title}</AlertDialogTitle>
                    <AlertDialogDescription>{confirmActionModal.description}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Voltar e Revisar</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={() => {
                            if (confirmActionModal.actionType === 'AUTO_ALLOCATE') {
                                handleAutoAllocateAndValidate();
                            } else if (confirmActionModal.actionType === 'UNIFY_POSITION') {
                                executeConfirm();
                            }
                        }}
                    >
                        Sim, Continuar
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        </>
    );
}
