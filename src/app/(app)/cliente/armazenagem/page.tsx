"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Search, Package, Clock, ShieldCheck } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import { Input } from '@/components/ui/input';
import { authFetch } from '@/lib/api-client';
import type { StockItem, ClientCompany } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Send, FilePlus, Edit, Trash2 } from 'lucide-react';
import { ExpeditionRequestForm } from '@/components/ExpeditionRequestForm';
import { ManualExpeditionForm } from '@/components/ManualExpeditionForm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WarehouseMap } from '@/components/WarehouseMap';
import type { ExpeditionRequest, StockPosition, ReceivingBatch } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export default function ClienteArmazenagemPage() {
    const [items, setItems] = useState<StockItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all');
    const [isExpeditionFormOpen, setIsExpeditionFormOpen] = useState(false);
    const [isManualFormOpen, setIsManualFormOpen] = useState(false);
    const [companies, setCompanies] = useState<ClientCompany[]>([]);

    const [expeditions, setExpeditions] = useState<ExpeditionRequest[]>([]);
    const [isLoadingExpeditions, setIsLoadingExpeditions] = useState(true);
    const [editingDraft, setEditingDraft] = useState<ExpeditionRequest | null>(null);
    const [viewingPosition, setViewingPosition] = useState<StockPosition | null>(null);

    const [receivingBatches, setReceivingBatches] = useState<ReceivingBatch[]>([]);
    const [isLoadingReceiving, setIsLoadingReceiving] = useState(true);

    const { toast } = useToast();

    useEffect(() => {
        const loadDocs = async () => {
            setIsLoading(true);
            try {
                const compRes = await authFetch('/api/my-companies');
                if (compRes.ok) {
                    const c = await compRes.json();
                    setCompanies(c);
                }

                // If this is a client, we will fetch stock items that belong to them.
                // Our GET /api/stock will need filtering. Wait, we don't have a specific API for it, 
                // but if we call /api/stock, we can either adapt it to filter by role, or pass a flag.
                // Let's pass '?clientMode=1'
                const stockRes = await authFetch('/api/stock/items?clientMode=1');
                if (stockRes.ok) {
                    const data = await stockRes.json();
                    // items API directly returns the array
                    setItems(data || []);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        const loadExpeditions = async () => {
            setIsLoadingExpeditions(true);
            try {
                const res = await authFetch('/api/expeditions');
                if (res.ok) {
                    const data = await res.json();
                    setExpeditions(data || []);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoadingExpeditions(false);
            }
        };

        const loadReceiving = async () => {
            setIsLoadingReceiving(true);
            try {
                const res = await authFetch('/api/stock/receiving');
                if (res.ok) {
                    const data = await res.json();
                    setReceivingBatches(data || []);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoadingReceiving(false);
            }
        };

        loadDocs();
        loadExpeditions();
        loadReceiving();
    }, []);

    const filteredItems = useMemo(() => {
        return items.filter(i => {
            const searchLower = search.toLowerCase();
            const matchesSearch = 
                String(i.name || '').toLowerCase().includes(searchLower) ||
                String(i.sku || '').toLowerCase().includes(searchLower) ||
                String(i.nfNumber || '').toLowerCase().includes(searchLower);
            const matchesComp = selectedCompanyId === 'all' || i.companyId === selectedCompanyId;
            return matchesSearch && matchesComp;
        });
    }, [items, search, selectedCompanyId]);

    const clientPositions = useMemo(() => {
        const posMap = new Map<string, StockPosition>();
        filteredItems.forEach(item => {
            if (!item.positionId || !item.positionName) return;
            if (!posMap.has(item.positionId)) {
                posMap.set(item.positionId, {
                    id: item.positionId,
                    name: item.positionName,
                    status: 'Ocupado',
                    updatedAt: new Date().toISOString(),
                });
            }
        });
        return Array.from(posMap.values());
    }, [filteredItems]);

    const itemsInViewingPosition = useMemo(() => {
        if (!viewingPosition) return [];
        return filteredItems.filter(item => item.positionId === viewingPosition.id);
    }, [viewingPosition, filteredItems]);

    const handleDeleteDraft = async (id: string) => {
        // Removido confirm() nativo para debugar se o navegador estava bloqueando
        toast({ title: 'Processando exclusão...' });
        try {
            const res = await authFetch(`/api/expeditions/${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast({ title: 'Pedido excluído com sucesso' });
                setExpeditions(prev => prev.filter(e => e.id !== id));
            } else {
                const data = await res.json().catch(() => ({}));
                toast({ variant: 'destructive', title: 'Erro ao excluir', description: data.error || 'Erro desconhecido' });
            }
        } catch (err: any) {
            console.error(err);
            toast({ variant: 'destructive', title: 'Erro', description: err.message });
        }
    };

    if (isLoading) {
        return <div className="p-8 flex items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;
    }

    return (
        <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2">Meu Estoque</h1>
                    <p className="text-muted-foreground">Visualize os itens armazenados na transportadora de forma segura e crie pedidos de carga.</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => { setEditingDraft(null); setIsManualFormOpen(true); }} className="bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50" variant="outline">
                        <FilePlus className="w-4 h-4 mr-2" /> Montar Pedido
                    </Button>
                    <Button onClick={() => setIsExpeditionFormOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                        <Send className="w-4 h-4 mr-2" /> Expedir via XML
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="mapa" className="w-full">
                <TabsList className="mb-6 w-full sm:w-auto flex overflow-x-auto justify-start">
                    <TabsTrigger value="mapa">
                        🗺️ Mapa Visual
                    </TabsTrigger>
                    <TabsTrigger value="estoque">
                        📦 Itens em Estoque
                    </TabsTrigger>
                    <TabsTrigger value="romaneios">
                        📋 Lista de Pedidos
                    </TabsTrigger>
                    <TabsTrigger value="entradas">
                        📥 Entradas (NFs)
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="entradas" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Entradas de Armazém</CardTitle>
                            <CardDescription>Acompanhe as Notas Fiscais que deram entrada em seu estoque.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoadingReceiving ? (
                                <div className="flex justify-center p-8"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>
                            ) : receivingBatches.length === 0 ? (
                                <div className="text-center py-10 text-muted-foreground flex flex-col items-center">
                                    <Package className="w-12 h-12 mb-4 text-muted-foreground/50" />
                                    <p>Nenhuma nota fiscal de entrada localizada.</p>
                                </div>
                            ) : (
                                <div className="border rounded-md">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Data de Entrada</TableHead>
                                                <TableHead>Nota Fiscal</TableHead>
                                                <TableHead>Empresa</TableHead>
                                                <TableHead>Qtd. Linhas NF</TableHead>
                                                <TableHead>Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {receivingBatches.map(batch => (
                                                <TableRow key={batch.id}>
                                                    <TableCell suppressHydrationWarning>{new Date(batch.importedAt).toLocaleDateString('pt-BR')}</TableCell>
                                                    <TableCell className="font-bold">{batch.nfNumber}</TableCell>
                                                    <TableCell>{batch.companyName || '--'}</TableCell>
                                                    <TableCell>{batch.totalItemsNf}</TableCell>
                                                    <TableCell>
                                                        <span className={`px-2 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide ${batch.status === 'Pendente' ? 'bg-yellow-100 text-yellow-800' :
                                                            batch.status === 'Montar' ? 'bg-orange-100 text-orange-800' :
                                                                batch.status === 'Posicionar' ? 'bg-blue-100 text-blue-800' :
                                                                    batch.status === 'Finalizado' ? 'bg-emerald-100 text-emerald-800' :
                                                                        'bg-gray-100 text-gray-800'
                                                            }`}>
                                                            {batch.status}
                                                        </span>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="estoque" className="space-y-6">

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <Card className="bg-indigo-50/50 border-indigo-100">
                            <CardHeader className="py-4">
                                <CardDescription className="font-semibold text-indigo-700 flex items-center">
                                    <Package className="w-4 h-4 mr-2" /> Total de Itens
                                </CardDescription>
                                <CardTitle className="text-2xl text-indigo-900">{filteredItems.length}</CardTitle>
                            </CardHeader>
                        </Card>
                        <Card className="bg-emerald-50/50 border-emerald-100">
                            <CardHeader className="py-4">
                                <CardDescription className="font-semibold text-emerald-700 flex items-center">
                                    <Clock className="w-4 h-4 mr-2" /> Tempo Médio
                                </CardDescription>
                                <CardTitle className="text-2xl text-emerald-900" suppressHydrationWarning>
                                    {filteredItems.length > 0
                                        ? Math.round(filteredItems.reduce((acc, curr) => acc + differenceInDays(new Date(), parseISO(curr.lastActivity)), 0) / filteredItems.length)
                                        : 0} dias
                                </CardTitle>
                            </CardHeader>
                        </Card>
                        <Card className="bg-amber-50/50 border-amber-100">
                            <CardHeader className="py-4">
                                <CardDescription className="font-semibold text-amber-700 flex items-center">
                                    <ShieldCheck className="w-4 h-4 mr-2" /> Status
                                </CardDescription>
                                <CardTitle className="text-2xl text-amber-900">Protegido</CardTitle>
                            </CardHeader>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div>
                                    <CardTitle>Painel de Itens</CardTitle>
                                    <CardDescription>Consulte seus produtos, lotes e quantidades.</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    {companies.length > 1 && (
                                        <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                                            <SelectTrigger className="w-[200px]">
                                                <SelectValue placeholder="Todas as empresas" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Todas as Empresas</SelectItem>
                                                {companies.map(c => (
                                                    <SelectItem key={c.id} value={c.id!}>{c.nomeFantasia || c.razaoSocial}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                    <div className="relative w-64">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            type="text"
                                            placeholder="Buscar (nome, SKU, NF)..."
                                            className="pl-9"
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {filteredItems.length === 0 ? (
                                <div className="text-center py-10 text-muted-foreground flex flex-col items-center">
                                    <Package className="w-12 h-12 mb-4 text-muted-foreground/50" />
                                    <p>Nenhum item armazenado encontrado para sua conta.</p>
                                </div>
                            ) : (
                                <div className="border rounded-md">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>SKU</TableHead>
                                                <TableHead>Nome</TableHead>
                                                {companies.length > 1 && <TableHead>Empresa</TableHead>}
                                                <TableHead>Lote / Validade</TableHead>
                                                <TableHead>Nota Fiscal</TableHead>
                                                <TableHead className="text-right">Quantidade</TableHead>
                                                <TableHead>Situação</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredItems.map(item => (
                                                <TableRow key={item.id}>
                                                    <TableCell className="font-mono">{item.sku}</TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">{item.name}</span>
                                                            <span className="text-[10px] text-muted-foreground" suppressHydrationWarning>
                                                                No galpão há {differenceInDays(new Date(), parseISO(item.lastActivity))} dias
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    {companies.length > 1 && <TableCell>{item.companyName || '--'}</TableCell>}
                                                    <TableCell>
                                                        <div className="flex flex-col text-xs">
                                                            <span className="font-semibold">Lote: {item.batch || '--'}</span>
                                                            {item.expirationDate ? (
                                                                <span className={differenceInDays(parseISO(item.expirationDate), new Date()) < 30 ? 'text-red-600 font-bold' : 'text-muted-foreground'}>
                                                                    Val: {new Date(item.expirationDate).toLocaleDateString('pt-BR')}
                                                                </span>
                                                            ) : (
                                                                <span className="text-muted-foreground">Sem validade</span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>{item.nfNumber || '--'}</TableCell>
                                                    <TableCell className="font-bold text-right">{item.quantity}</TableCell>
                                                    <TableCell>
                                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${item.status === 'Em Conferência' ? 'text-orange-700 bg-orange-100' : 'text-emerald-700 bg-emerald-100'}`}>
                                                            {item.status || 'Armazenado'}
                                                        </span>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="romaneios" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Pedidos de Carga</CardTitle>
                            <CardDescription>Acompanhe os pedidos de expedição e rascunhos salvos.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoadingExpeditions ? (
                                <div className="flex justify-center p-8"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>
                            ) : expeditions.length === 0 ? (
                                <div className="text-center py-10 text-muted-foreground flex flex-col items-center">
                                    <FilePlus className="w-12 h-12 mb-4 text-muted-foreground/50" />
                                    <p>Você ainda não criou nenhum pedido de carga.</p>
                                </div>
                            ) : (
                                <div className="border rounded-md">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Data</TableHead>
                                                <TableHead>Referência / NF</TableHead>
                                                <TableHead>Itens</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Ações</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {expeditions.map(exp => (
                                                <TableRow key={exp.id}>
                                                    <TableCell>{new Date(exp.requestedAt).toLocaleDateString('pt-BR')}</TableCell>
                                                    <TableCell>
                                                        <div className="font-medium">{exp.name || 'Pedido sem nome'}</div>
                                                        <div className="text-xs text-muted-foreground">NF: {Array.from(new Set(exp.items.map(i => i.outboundNfNumber).filter(Boolean))).join(', ') || '--'}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="font-semibold">{exp.items.reduce((acc, curr) => acc + curr.quantityRequested, 0)}</span> und.
                                                        <span className="text-xs text-muted-foreground ml-1">({exp.items.length} skus)</span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${exp.status === 'Rascunho' ? 'bg-gray-100 text-gray-800' :
                                                            exp.status === 'Pendente' ? 'bg-yellow-100 text-yellow-800' :
                                                                exp.status === 'Em Separação' ? 'bg-blue-100 text-blue-800' :
                                                                    exp.status === 'Cancelado' ? 'bg-red-100 text-red-800' :
                                                                        'bg-emerald-100 text-emerald-800'
                                                            }`}>
                                                            {exp.status}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {(exp.status === 'Rascunho' || exp.status === 'Pendente') && (
                                                            <div className="flex justify-end gap-2">
                                                                {exp.status === 'Rascunho' && (
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50" onClick={() => { setEditingDraft(exp); setIsManualFormOpen(true); }} title="Editar Rascunho">
                                                                        <Edit className="w-4 h-4" />
                                                                    </Button>
                                                                )}
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-800 hover:bg-red-50" onClick={() => handleDeleteDraft(exp.id)} title={exp.status === 'Pendente' ? "Excluir e retornar ao estoque" : "Excluir rascunho"}>
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="mapa" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Mapa do Armazém</CardTitle>
                            <CardDescription>Visualize onde seus paletes estão armazenados fisicamente.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <WarehouseMap
                                positions={clientPositions}
                                onPositionClick={setViewingPosition}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={!!viewingPosition} onOpenChange={(open) => !open && setViewingPosition(null)}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Itens na Posição: {viewingPosition?.name}</DialogTitle>
                        <DialogDescription>Listagem de seus itens armazenados nesta posição física.</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-80 mt-4">
                        {itemsInViewingPosition.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>SKU</TableHead>
                                        <TableHead>Item</TableHead>
                                        <TableHead>Lote / Val</TableHead>
                                        <TableHead className="text-right">Qtd</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {itemsInViewingPosition.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-mono">{item.sku}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{item.name}</span>
                                                    <span className="text-[10px] text-muted-foreground">NF: {item.nfNumber || 'S/N'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col text-xs">
                                                    <span>{item.batch || '--'}</span>
                                                    <span className="text-muted-foreground">{item.expirationDate ? new Date(item.expirationDate).toLocaleDateString('pt-BR') : ''}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-bold text-right">{item.quantity}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <p className="text-center text-muted-foreground py-8">Nenhum item seu alocado nesta posição.</p>
                        )}
                    </ScrollArea>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Fechar</Button></DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ExpeditionRequestForm
                isOpen={isExpeditionFormOpen}
                onOpenChange={setIsExpeditionFormOpen}
                onSuccess={() => {
                    // Optional: reload stock data
                }}
            />

            {isManualFormOpen && (
                <ManualExpeditionForm
                    isOpen={isManualFormOpen}
                    onOpenChange={(open) => {
                        setIsManualFormOpen(open);
                        if (!open) setEditingDraft(null);
                    }}
                    stockItems={items}
                    existingDraft={editingDraft}
                    onSuccess={async () => {
                        // Reload expeditions
                        const res = await authFetch('/api/expeditions');
                        if (res.ok) setExpeditions(await res.json());
                    }}
                />
            )}
        </div>
    );
}
