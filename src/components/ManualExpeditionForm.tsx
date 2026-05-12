"use client";

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Trash2, Save, Send, Search, Package, Layers } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/api-client';
import { Input } from '@/components/ui/input';
import type { StockItem, ExpeditionRequest } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ManualExpeditionFormProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    stockItems: StockItem[];
    onSuccess?: () => void;
    existingDraft?: ExpeditionRequest | null;
}

interface PalletGroup {
    key: string; // e.g. "NF-123-Pallet-2"
    palletNumber: number;
    nfNumber: string;
    companyName: string;
    items: StockItem[];
    totalQuantity: number;
    positionName: string;
}

export function ManualExpeditionForm({ isOpen, onOpenChange, stockItems, onSuccess, existingDraft }: ManualExpeditionFormProps) {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [name, setName] = useState(existingDraft?.name || '');
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [viewMode, setViewMode] = useState<'products' | 'pallets'>('products');
    const [selectedPalletKeys, setSelectedPalletKeys] = useState<Set<string>>(new Set());
    
    // items in the cart: mapping from itemId to quantity
    const [cart, setCart] = useState<Record<string, number>>(() => {
        if (!existingDraft) return {};
        const initialCart: Record<string, number> = {};
        existingDraft.items.forEach(reqItem => {
            reqItem.stockItemIds.forEach(id => {
                if (reqItem.stockItemIds.length === 1) {
                     initialCart[id] = reqItem.quantityRequested;
                } else {
                     initialCart[id] = 1;
                }
            });
        });
        return initialCart;
    });

    const [outboundNfs, setOutboundNfs] = useState<Record<string, string>>(() => {
        if (!existingDraft) return {};
        const initialNfs: Record<string, string> = {};
        existingDraft.items.forEach(reqItem => {
            reqItem.stockItemIds.forEach(id => {
                if (reqItem.outboundNfNumber) {
                    initialNfs[id] = reqItem.outboundNfNumber;
                }
            });
        });
        return initialNfs;
    });

    const availableItems = useMemo(() => {
        const lowerSearch = String(search || '').toLowerCase();
        return stockItems.filter(i => i.quantity > 0 && cart[i.id] === undefined && (
            String(i.name || '').toLowerCase().includes(lowerSearch) || 
            String(i.sku || '').toLowerCase().includes(lowerSearch) ||
            (i.nfNumber && String(i.nfNumber).includes(search)) ||
            (i.batch && String(i.batch).toLowerCase().includes(lowerSearch))
        ));
    }, [stockItems, search, cart]);

    // Group available items by pallet
    const palletGroups = useMemo(() => {
        const groups: Record<string, PalletGroup> = {};
        availableItems.forEach(item => {
            if (item.palletNumber && item.nfNumber) {
                const key = `${item.nfNumber}-PAL-${item.palletNumber}`;
                if (!groups[key]) {
                    groups[key] = {
                        key,
                        palletNumber: item.palletNumber,
                        nfNumber: item.nfNumber,
                        companyName: item.companyName || '--',
                        items: [],
                        totalQuantity: 0,
                        positionName: item.positionName || '--',
                    };
                }
                groups[key].items.push(item);
                groups[key].totalQuantity += item.quantity;
            }
        });
        return Object.values(groups);
    }, [availableItems]);

    const handleAddToCart = (item: StockItem) => {
        if (cart[item.id] !== undefined) return;
        setCart(prev => ({ ...prev, [item.id]: item.quantity }));
    };

    const handleAddSelectedToCart = () => {
        if (selectedIds.size === 0) return;
        const newCart = { ...cart };
        selectedIds.forEach(id => {
            if (newCart[id] === undefined) {
                const item = stockItems.find(i => i.id === id);
                newCart[id] = item ? item.quantity : 1;
            }
        });
        setCart(newCart);
        setSelectedIds(new Set());
    };

    const handleAddPalletToCart = (group: PalletGroup) => {
        const newCart = { ...cart };
        group.items.forEach(item => {
            if (newCart[item.id] === undefined) {
                newCart[item.id] = item.quantity; // Full quantity for pallet
            }
        });
        setCart(newCart);
    };

    const handleAddSelectedPalletsToCart = () => {
        if (selectedPalletKeys.size === 0) return;
        const newCart = { ...cart };
        palletGroups.forEach(group => {
            if (selectedPalletKeys.has(group.key)) {
                group.items.forEach(item => {
                    if (newCart[item.id] === undefined) {
                        newCart[item.id] = item.quantity;
                    }
                });
            }
        });
        setCart(newCart);
        setSelectedPalletKeys(new Set());
    };

    const handleToggleSelection = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleTogglePalletSelection = (key: string) => {
        setSelectedPalletKeys(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const handleSelectAll = () => {
        if (viewMode === 'products') {
            if (selectedIds.size === availableItems.length && availableItems.length > 0) {
                setSelectedIds(new Set());
            } else {
                setSelectedIds(new Set(availableItems.map(i => i.id)));
            }
        } else {
            if (selectedPalletKeys.size === palletGroups.length && palletGroups.length > 0) {
                setSelectedPalletKeys(new Set());
            } else {
                setSelectedPalletKeys(new Set(palletGroups.map(g => g.key)));
            }
        }
    };

    const handleRemoveFromCart = (itemId: string) => {
        setCart(prev => {
            const newCart = { ...prev };
            delete newCart[itemId];
            return newCart;
        });
    };

    const handleChangeQuantity = (itemId: string, qty: number | string, max: number) => {
        if (qty === '') {
            setCart(prev => ({ ...prev, [itemId]: 0 }));
            return;
        }
        const numericQty = typeof qty === 'string' ? parseInt(qty) : qty;
        if (isNaN(numericQty)) return;
        const val = Math.max(0, Math.min(numericQty, max));
        setCart(prev => ({ ...prev, [itemId]: val }));
    };

    const cartItemsList = useMemo(() => {
        return Object.keys(cart).map(id => {
            const item = stockItems.find(i => i.id === id);
            return { itemId: id, quantity: cart[id], item };
        }).filter(c => c.item !== undefined);
    }, [cart, stockItems]);

    const cartPalletGroups = useMemo(() => {
        const groups: Record<string, {
            key: string;
            palletNumber: number;
            nfNumber: string;
            items: { itemId: string, quantity: number, item: StockItem }[];
            totalQuantity: number;
        }> = {};

        cartItemsList.forEach(c => {
            if (c.item?.palletNumber && c.item?.nfNumber) {
                const key = `${c.item.nfNumber}-PAL-${c.item.palletNumber}`;
                if (!groups[key]) {
                    groups[key] = {
                        key,
                        palletNumber: c.item.palletNumber,
                        nfNumber: c.item.nfNumber,
                        items: [],
                        totalQuantity: 0,
                    };
                }
                groups[key].items.push(c as any);
                groups[key].totalQuantity += c.quantity || 0;
            }
        });
        return Object.values(groups);
    }, [cartItemsList]);

    const cartLooseItems = useMemo(() => {
        return cartItemsList.filter(c => !(c.item?.palletNumber && c.item?.nfNumber));
    }, [cartItemsList]);

    const totalQuantity = useMemo(() => {
        return cartItemsList.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
    }, [cartItemsList]);

    const handleSave = async (status: 'Rascunho' | 'Pendente') => {
        if (cartItemsList.length === 0) {
            toast({ variant: 'destructive', title: 'Carrinho vazio', description: 'Adicione itens ao romaneio.' });
            return;
        }
        
        if (cartItemsList.some(c => c.quantity === 0)) {
            toast({ variant: 'destructive', title: 'Quantidade inválida', description: 'Remova os itens com quantidade 0 ou preencha-os.' });
            return;
        }

        const missingNf = cartItemsList.some(c => {
            const isFractional = c.item && c.quantity > 0 && c.quantity < c.item.quantity;
            return isFractional && !outboundNfs[c.itemId];
        });

        if (missingNf) {
            toast({ variant: 'destructive', title: 'Nota Fiscal pendente', description: 'Você deve informar a Nota Fiscal de Saída para os itens fracionados.' });
            return;
        }

        setIsSubmitting(true);
        try {
            const itemsPayload = cartItemsList
                .filter(c => c.item)
                .map(c => ({
                    sku: c.item!.sku,
                    description: c.item!.name,
                    quantityRequested: c.quantity,
                    stockItemIds: [c.itemId],
                    outboundNfNumber: outboundNfs[c.itemId] || (c.item!.nfNumber || '')
                }));

            const payload = {
                name: name || `Pedido ${new Date().toLocaleDateString('pt-BR')}`,
                status,
                items: itemsPayload
            };

            let response;
            if (existingDraft && existingDraft.id) {
                response = await authFetch(`/api/expeditions/${existingDraft.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                response = await authFetch('/api/expeditions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Falha ao salvar pedido');
            }

            toast({ title: 'Sucesso', description: status === 'Rascunho' ? 'Rascunho salvo!' : 'Pedido enviado para expedição!' });
            onOpenChange(false);
            if (onSuccess) onSuccess();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro', description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const currentSelectCount = viewMode === 'products' ? selectedIds.size : selectedPalletKeys.size;
    const currentListLength = viewMode === 'products' ? availableItems.length : palletGroups.length;
    const isAllSelected = currentListLength > 0 && currentSelectCount === currentListLength;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!isSubmitting) onOpenChange(open);
        }}>
            <DialogContent className="w-[97vw] max-w-[97vw] h-[97vh] max-h-[97vh] overflow-hidden flex flex-col gap-0 p-2 sm:p-4">
                <DialogHeader className="pb-0 mb-0">
                    <DialogTitle>{existingDraft ? 'Editar Pedido' : 'Novo Pedido'}</DialogTitle>
                    <DialogDescription className="sr-only">Selecione os itens e quantidades para montar sua ordem de expedição.</DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row gap-2 pt-2 min-h-[400px]">
                    {/* Left Side: Stock Selection */}
                    <div className="flex-1 flex flex-col border rounded-md overflow-hidden">
                        <div className="bg-gray-50 p-3 border-b flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                                <h3 className="font-semibold text-sm">Estoque Disponível</h3>
                                <div className="flex items-center gap-1">
                                    {currentListLength > 0 && (
                                        <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={handleSelectAll}>
                                            {isAllSelected ? 'Desmarcar Todos' : 'Selecionar Tudo'}
                                        </Button>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar por SKU, Nome, Lote ou NF..."
                                        className="pl-8 bg-white h-9"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                </div>
                                <div className="flex bg-white border rounded-md overflow-hidden">
                                    <button 
                                        onClick={() => { setViewMode('products'); setSelectedPalletKeys(new Set()); }}
                                        className={`px-3 py-1 text-xs font-medium flex items-center gap-1.5 transition-colors ${viewMode === 'products' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                                        title="Ver por Produtos"
                                    >
                                        <Package className="w-3.5 h-3.5" /> Produtos
                                    </button>
                                    <button 
                                        onClick={() => { setViewMode('pallets'); setSelectedIds(new Set()); }}
                                        className={`px-3 py-1 text-xs font-medium flex items-center gap-1.5 transition-colors ${viewMode === 'pallets' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                                        title="Ver por Paletes"
                                    >
                                        <Layers className="w-3.5 h-3.5" /> Paletes
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin">
                            {viewMode === 'products' ? (
                                availableItems.length === 0 ? (
                                    <div className="text-center text-sm text-muted-foreground py-8">Nenhum item encontrado.</div>
                                ) : (
                                    availableItems.map(item => (
                                        <div 
                                            key={item.id} 
                                            className={`border rounded p-2 text-sm flex items-center hover:bg-gray-50 transition-colors cursor-pointer ${selectedIds.has(item.id) ? 'bg-indigo-50 border-indigo-200' : ''}`}
                                            onClick={() => handleToggleSelection(item.id)}
                                        >
                                            <div className="mr-3">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedIds.has(item.id)} 
                                                    onChange={() => {}} 
                                                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer pointer-events-none"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-semibold">{item.name}</div>
                                                <div className="text-xs text-muted-foreground flex gap-2 flex-wrap">
                                                    <span>SKU: {item.sku}</span>
                                                    {item.batch && <span>• Lote: {item.batch}</span>}
                                                    {item.nfNumber && <span>• NF: {item.nfNumber}</span>}
                                                    {item.palletNumber && <span>• Palete: {item.palletNumber}</span>}
                                                </div>
                                                <div className="text-xs font-bold text-emerald-600 mt-1">Disponível: {item.quantity}</div>
                                            </div>
                                            <Button 
                                                size="sm" 
                                                variant="secondary"
                                                onClick={(e) => { e.stopPropagation(); handleAddToCart(item); }}
                                                disabled={cart[item.id] !== undefined}
                                                className="ml-2"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))
                                )
                            ) : (
                                palletGroups.length === 0 ? (
                                    <div className="text-center text-sm text-muted-foreground py-8">
                                        Nenhum palete encontrado.
                                        <p className="text-xs mt-1">Itens sem palete atribuído aparecem na visualização por Produtos.</p>
                                    </div>
                                ) : (
                                    palletGroups.map(group => (
                                        <div 
                                            key={group.key} 
                                            className={`border rounded p-3 text-sm hover:bg-gray-50 transition-colors cursor-pointer ${selectedPalletKeys.has(group.key) ? 'bg-indigo-50 border-indigo-200' : ''}`}
                                            onClick={() => handleTogglePalletSelection(group.key)}
                                        >
                                            <div className="flex items-center">
                                                <div className="mr-3">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedPalletKeys.has(group.key)} 
                                                        onChange={() => {}} 
                                                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer pointer-events-none"
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-semibold flex items-center gap-2">
                                                        <Layers className="w-4 h-4 text-indigo-600" />
                                                        Palete {group.palletNumber} — NF: {group.nfNumber}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground mt-0.5">
                                                        {group.companyName} • Posição: {group.positionName}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground mt-1">
                                                        {group.items.length} {group.items.length === 1 ? 'item' : 'itens'} • Total: <span className="font-bold text-emerald-600">{group.totalQuantity} und.</span>
                                                    </div>
                                                    <div className="mt-1.5 flex flex-wrap gap-1">
                                                        {group.items.slice(0, 4).map(item => (
                                                            <span key={item.id} className="text-[10px] bg-gray-100 rounded px-1.5 py-0.5">{item.sku} ({item.quantity})</span>
                                                        ))}
                                                        {group.items.length > 4 && <span className="text-[10px] text-muted-foreground">+{group.items.length - 4} mais</span>}
                                                    </div>
                                                </div>
                                                <Button 
                                                    size="sm" 
                                                    variant="secondary"
                                                    onClick={(e) => { e.stopPropagation(); handleAddPalletToCart(group); }}
                                                    disabled={group.items.every(i => cart[i.id] !== undefined)}
                                                    className="ml-2"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )
                            )}
                        </div>
                        {currentSelectCount > 0 && (
                            <div className="p-3 border-t bg-white">
                                <Button 
                                    className="w-full bg-indigo-600 hover:bg-indigo-700" 
                                    onClick={viewMode === 'products' ? handleAddSelectedToCart : handleAddSelectedPalletsToCart}
                                >
                                    Adicionar Selecionados ({currentSelectCount})
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Right Side: Cart / Romaneio */}
                    <div className="flex-1 flex flex-col border rounded-md overflow-hidden bg-blue-50/30">
                        <div className="bg-blue-100/50 p-3 border-b flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-sm text-blue-900">Itens do Pedido</h3>
                                {cartItemsList.length > 0 && (
                                    <Button variant="ghost" size="sm" className="h-6 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2" onClick={() => setCart({})}>
                                        Limpar Tudo
                                    </Button>
                                )}
                            </div>
                            <Input 
                                placeholder="Nome / Ref. do Pedido (Ex: Reposição SP)" 
                                value={name} 
                                onChange={(e) => setName(e.target.value)}
                                className="h-9 bg-white"
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto p-0 scrollbar-thin">
                            {cartItemsList.length === 0 ? (
                                <div className="text-center text-sm text-muted-foreground py-10 px-4">
                                    Nenhum item adicionado ao pedido ainda.
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-gray-50/50">
                                            <TableHead className="py-2 h-auto text-xs">Item/Lote</TableHead>
                                            <TableHead className="py-2 h-auto text-xs w-[100px] text-center">Qtd.</TableHead>
                                            <TableHead className="py-2 h-auto text-xs w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {viewMode === 'products' ? (
                                            cartItemsList.map(c => (
                                                <TableRow key={c.itemId}>
                                                    <TableCell className="py-2">
                                                        <div className="font-medium text-xs leading-tight">{c.item?.name}</div>
                                                        <div className="text-[10px] text-muted-foreground mt-0.5">SKU: {c.item?.sku} | Lote: {c.item?.batch || '--'}</div>
                                                        {c.item && c.quantity > 0 && (() => {
                                                            const isFractional = c.quantity < c.item.quantity;
                                                            return (
                                                                <div className="mt-1.5">
                                                                    <Input 
                                                                        placeholder={isFractional ? "NF de Saída (Obrigatória)" : `NF Origem: ${c.item.nfNumber || 'S/N'} (Opcional)`} 
                                                                        value={outboundNfs[c.itemId] || ''} 
                                                                        onChange={(e) => setOutboundNfs(prev => ({ ...prev, [c.itemId]: e.target.value }))}
                                                                        className={`h-7 text-[10px] ${isFractional && !outboundNfs[c.itemId] ? 'bg-red-50 border-red-300 placeholder:text-red-400' : 'bg-gray-50 border-gray-200 focus:bg-white'}`}
                                                                        title={isFractional ? "Nota Fiscal de Saída obrigatória para envio fracionado" : "Deixe em branco para manter a NF de Origem"}
                                                                    />
                                                                </div>
                                                            );
                                                        })()}
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        <Input 
                                                            type="number" 
                                                            min={0} 
                                                            max={c.item?.quantity || 1}
                                                            value={c.quantity === 0 ? '' : c.quantity} 
                                                            onChange={(e) => handleChangeQuantity(c.itemId, e.target.value, c.item?.quantity || 1)}
                                                            onFocus={(e) => e.target.select()}
                                                            placeholder="0"
                                                            className={`h-8 text-center text-xs px-1 ${c.quantity === 0 ? 'border-red-400 bg-red-50' : ''}`}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="py-2 text-right">
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleRemoveFromCart(c.itemId)}>
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <>
                                                {cartPalletGroups.map(group => (
                                                    <TableRow key={group.key} className="bg-white hover:bg-gray-50">
                                                        <TableCell className="py-2">
                                                            <div className="font-medium flex items-center gap-2 text-sm">
                                                                <Layers className="w-4 h-4 text-indigo-600" />
                                                                Palete {group.palletNumber} — NF: {group.nfNumber}
                                                            </div>
                                                            <div className="mt-1.5 flex flex-wrap gap-1">
                                                                {group.items.slice(0, 4).map(c => (
                                                                    <span key={c.itemId} className="text-[10px] bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 text-gray-700">{c.item.sku} ({c.quantity})</span>
                                                                ))}
                                                                {group.items.length > 4 && <span className="text-[10px] text-muted-foreground bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5">+{group.items.length - 4} mais</span>}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-2 text-center align-middle">
                                                            <div className="font-bold text-emerald-600 bg-emerald-50 text-xs py-1 rounded w-full">
                                                                {group.totalQuantity} und.
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-2 text-right align-middle">
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => {
                                                                group.items.forEach(c => handleRemoveFromCart(c.itemId));
                                                            }} title="Remover Palete Inteiro">
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                {cartLooseItems.map(c => (
                                                    <TableRow key={c.itemId}>
                                                        <TableCell className="py-2">
                                                            <div className="font-medium text-xs leading-tight">{c.item?.name}</div>
                                                            <div className="text-[10px] text-muted-foreground mt-0.5">SKU: {c.item?.sku} | Lote: {c.item?.batch || '--'}</div>
                                                            {c.item && c.quantity > 0 && (() => {
                                                                const isFractional = c.quantity < c.item.quantity;
                                                                return (
                                                                    <div className="mt-1.5">
                                                                        <Input 
                                                                            placeholder={isFractional ? "NF de Saída (Obrigatória)" : `NF Origem: ${c.item.nfNumber || 'S/N'} (Opcional)`} 
                                                                            value={outboundNfs[c.itemId] || ''} 
                                                                            onChange={(e) => setOutboundNfs(prev => ({ ...prev, [c.itemId]: e.target.value }))}
                                                                            className={`h-7 text-[10px] ${isFractional && !outboundNfs[c.itemId] ? 'bg-red-50 border-red-300 placeholder:text-red-400' : 'bg-gray-50 border-gray-200 focus:bg-white'}`}
                                                                            title={isFractional ? "Nota Fiscal de Saída obrigatória para envio fracionado" : "Deixe em branco para manter a NF de Origem"}
                                                                        />
                                                                    </div>
                                                                );
                                                            })()}
                                                        </TableCell>
                                                        <TableCell className="py-2">
                                                            <Input 
                                                                type="number" 
                                                                min={0} 
                                                                max={c.item?.quantity || 1}
                                                                value={c.quantity === 0 ? '' : c.quantity} 
                                                                onChange={(e) => handleChangeQuantity(c.itemId, e.target.value, c.item?.quantity || 1)}
                                                                onFocus={(e) => e.target.select()}
                                                                placeholder="0"
                                                                className={`h-8 text-center text-xs px-1 ${c.quantity === 0 ? 'border-red-400 bg-red-50' : ''}`}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="py-2 text-right">
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleRemoveFromCart(c.itemId)}>
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </>
                                        )}
                                    </TableBody>
                                </Table>
                            )}
                            {viewMode === 'pallets' && cartItemsList.length > 0 && (
                                <div className="mt-3 p-3 bg-indigo-50 border border-indigo-100 rounded-md text-xs text-indigo-800">
                                    <div className="font-semibold flex items-center gap-1.5 mb-1 text-indigo-900">
                                        <Layers className="w-4 h-4" /> Expedição por Paletes
                                    </div>
                                    <p>Os itens dos paletes selecionados foram adicionados à lista acima. <b>Na etapa de Separação (Picking), basta o operador bipar a etiqueta do Palete (ex: PAL-123-1)</b> para o sistema dar baixa em todos estes itens automaticamente!</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter className="pt-2 flex flex-col sm:flex-row justify-between items-center w-full gap-4">
                    <div className="text-sm font-semibold text-indigo-800 flex-1 flex items-center">
                        Total a Expedir: <span className="ml-2 text-lg">{totalQuantity}</span> <span className="ml-1 font-normal text-muted-foreground text-xs">und.</span>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto justify-end">
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
                        <Button variant="secondary" onClick={() => handleSave('Rascunho')} disabled={isSubmitting || cartItemsList.length === 0} className="flex-1 sm:flex-none">
                            <Save className="mr-2 h-4 w-4" /> Salvar Rascunho
                        </Button>
                        <Button onClick={() => handleSave('Pendente')} disabled={isSubmitting || cartItemsList.length === 0} className="bg-indigo-600 hover:bg-indigo-700 text-white flex-1 sm:flex-none">
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            Enviar para Armazém
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
