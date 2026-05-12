
"use client";

import { useState, useMemo, useEffect, ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, PlusCircle, Trash2, CheckCircle2, Search, Edit, MoreHorizontal, MoveRight, Receipt, DollarSign, Printer, Move } from 'lucide-react';
import { printPalletLabels } from '@/lib/print';
import type { StockPosition, StockItem, Quote, BillingHistoryEvent, ClientCompany, ReceivingBatch, StockMovement, StoragePricingSettings } from '@/lib/types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogTrigger, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, differenceInDays, parseISO, addDays } from 'date-fns';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Label } from './ui/label';
import { useAuth } from '@/hooks/use-auth';
import { v4 as uuidv4 } from 'uuid';

import { authFetch } from '@/lib/api-client';
import { StockDashboard } from './StockDashboard';
import { WarehouseMap } from './WarehouseMap';
import { StockMovementHistory } from './StockMovementHistory';
import { ReceivingManagement } from './ReceivingManagement';
import { LayoutGrid, History, BarChart3, ChevronRight } from 'lucide-react';
import { Checkbox } from './ui/checkbox';

const positionFormSchema = z.object({
  name: z.string().min(1, 'O nome da posição é obrigatório.').regex(/^([A-Z]\d+|RECEBIMENTO)$/, 'Formato inválido. Use uma letra seguida por números (ex: A1, B12) ou RECEBIMENTO.'),
  status: z.enum(['Vazio', 'Ocupado', 'Manutenção']),
  quoteCode: z.string().optional(),
});

const itemFormSchema = z.object({
  sku: z.string().min(1, 'SKU é obrigatório.'),
  name: z.string().min(3, 'Nome é obrigatório.'),
  description: z.string().optional(),
  quantity: z.coerce.number().min(1, 'Quantidade deve ser pelo menos 1.'),
  positionId: z.string().min(1, 'Selecione uma posição.'),
  companyId: z.string().optional(),
  nfNumber: z.string().optional(),
  batch: z.string().optional(),
  expirationDate: z.string().optional(),
  reason: z.string().optional(),
});


interface StockManagementProps {
  positions: StockPosition[];
  items: StockItem[];
  receivingBatches: ReceivingBatch[];
  movements: StockMovement[];
  onDataMutated: () => void;
  isLoadingPositions: boolean;
  hasMorePositions: boolean;
  onLoadMorePositions: () => void;
  historyDate: string;
  setHistoryDate: (date: string) => void;
}

const statusColors = {
  Vazio: 'bg-green-600',
  Ocupado: 'bg-orange-500',
  Manutenção: 'bg-gray-500',
}

export function StockManagement({ positions, items, receivingBatches, movements, onDataMutated, isLoadingPositions, hasMorePositions, onLoadMorePositions, historyDate, setHistoryDate }: StockManagementProps) {
  const { user, companyProfile } = useAuth();
  const [isPositionFormOpen, setIsPositionFormOpen] = useState(false);
  const [isItemFormOpen, setIsItemFormOpen] = useState(false);
  const [isMoveItemOpen, setIsMoveItemOpen] = useState(false);
  const [isBillingOpen, setIsBillingOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<StockPosition | null>(null);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [itemToMove, setItemToMove] = useState<StockItem | null>(null);
  const [positionToBill, setPositionToBill] = useState<StockPosition | null>(null);
  const [newPositionId, setNewPositionId] = useState('');
  const [itemToDelete, setItemToDelete] = useState<StockItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Bulk actions states
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('activeStockTab') || 'dashboard';
    }
    return 'dashboard';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('activeStockTab', activeTab);
    }
  }, [activeTab]);

  const [clientCompanies, setClientCompanies] = useState<ClientCompany[]>([]);

  useEffect(() => {
    async function loadCompanies() {
      try {
        const res = await authFetch('/api/my-companies');
        // Para admins, my-companies pode não trazer todas, a não ser que façam busca admin. 
        if (res.ok) {
          const clients = await res.json();
          setClientCompanies(clients);
        }
      } catch (e) { }
    }
    loadCompanies();
  }, []);

  const [positionFilter, setPositionFilter] = useState('');
  const [itemFilter, setItemFilter] = useState('');
  const [viewingPosition, setViewingPosition] = useState<StockPosition | null>(null);

  const [dailyRate, setDailyRate] = useState(10);
  const [totalValue, setTotalValue] = useState(0);
  const [billingDueDate, setBillingDueDate] = useState('');

  const [dailyRateMasked, setDailyRateMasked] = useState('R$ 10,00');
  const [totalValueMasked, setTotalValueMasked] = useState('R$ 0,00');

  const [includePicking, setIncludePicking] = useState(false);
  const [includePacking, setIncludePacking] = useState(false);
  const [includeUnloading, setIncludeUnloading] = useState(false);
  const [pricingSettings, setPricingSettings] = useState<StoragePricingSettings | null>(null);

  useEffect(() => {
    async function loadPricing() {
      try {
        const res = await authFetch('/api/settings/storage-pricing');
        if (res.ok) {
          const data = await res.json();
          setPricingSettings(data);
        }
      } catch (e) { }
    }
    loadPricing();
  }, []);

  const positionForm = useForm<z.infer<typeof positionFormSchema>>({
    resolver: zodResolver(positionFormSchema),
  });

  const itemForm = useForm<z.infer<typeof itemFormSchema>>({
    resolver: zodResolver(itemFormSchema),
  });

  const watchedPositionStatus = positionForm.watch('status');

  const toggleItemSelection = (itemId: string) => {
    setSelectedItemIds(prev =>
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const filteredItems = useMemo(() => {
    if (!itemFilter) return items;
    const lower = itemFilter.toLowerCase();
    return items.filter(item =>
      String(item.sku || '').toLowerCase().includes(lower) ||
      String(item.name || '').toLowerCase().includes(lower) ||
      String(item.companyName || '').toLowerCase().includes(lower) ||
      String(item.nfNumber || '').toLowerCase().includes(lower) ||
      String(item.batch || '').toLowerCase().includes(lower)
    );
  }, [items, itemFilter]);

  const toggleAllItems = () => {
    if (selectedItemIds.length === filteredItems.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(filteredItems.map(i => i.id));
    }
  };

  const filteredPositions = useMemo(() => {
    if (!positionFilter) return positions;
    const lowercasedFilter = positionFilter.toLowerCase();
    return positions.filter(pos =>
      pos.name.toLowerCase().includes(lowercasedFilter) ||
      (pos.quoteCode && pos.quoteCode.toLowerCase().includes(lowercasedFilter))
    );
  }, [positions, positionFilter]);


  const handleOpenPositionForm = (position: StockPosition | null) => {
    if (!position) return;
    setEditingPosition(position);
    positionForm.reset({
      name: position.name,
      status: position.status,
      quoteCode: position.quoteCode || '',
    });
    setIsPositionFormOpen(true);
  };

  const handleOpenItemForm = (item: StockItem | null) => {
    setEditingItem(item);
    if (item) {
      itemForm.reset({
        ...item,
        sku: String(item.sku || ''),
        nfNumber: item.nfNumber !== undefined && item.nfNumber !== null ? String(item.nfNumber) : undefined,
        batch: item.batch !== undefined && item.batch !== null ? String(item.batch) : undefined,
      });
    } else {
      itemForm.reset({ sku: '', name: '', description: '', quantity: 1, positionId: '', companyId: '', nfNumber: '' });
    }
    setIsItemFormOpen(true);
  }

  const handleOpenMoveDialog = (item: StockItem) => {
    setItemToMove(item);
    setNewPositionId('');
    setIsMoveItemOpen(true);
  };

  const handleOpenBillingDialog = (position: StockPosition) => {
    const storageDays = position.occupiedAt ? differenceInDays(new Date(), parseISO(position.occupiedAt)) : 0;
    const initialRate = pricingSettings?.pricePerPosition || 10;
    const calculatedValue = storageDays * initialRate;

    setPositionToBill(position);
    setDailyRate(initialRate);
    setDailyRateMasked(formatCurrency(initialRate));
    setIncludePicking(false);
    setIncludePacking(false);
    setIncludeUnloading(false);
    setTotalValue(calculatedValue);
    setTotalValueMasked(formatCurrency(calculatedValue));
    setBillingDueDate(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
    setIsBillingOpen(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  const handleCurrencyChange = (e: ChangeEvent<HTMLInputElement>, setter: (value: number) => void, maskSetter: (value: string) => void) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    if (!rawValue) {
      setter(0);
      maskSetter(formatCurrency(0));
      return;
    }
    const numericValue = Number(rawValue) / 100;
    setter(numericValue);
    maskSetter(formatCurrency(numericValue));
  };

  useEffect(() => {
    if (positionToBill && positionToBill.occupiedAt) {
      const storageDays = differenceInDays(new Date(), parseISO(positionToBill.occupiedAt));
      let newTotal = storageDays * dailyRate;

      if (includePicking) newTotal += (pricingSettings?.pickingRate || 0);
      if (includePacking) newTotal += (pricingSettings?.packingRate || 0);
      if (includeUnloading) newTotal += (pricingSettings?.unloadingRate || 0);

      setTotalValue(newTotal);
      setTotalValueMasked(formatCurrency(newTotal));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyRate, positionToBill, includePicking, includePacking, includeUnloading, pricingSettings]);


  const handlePositionSubmit = async (values: z.infer<typeof positionFormSchema>) => {
    setIsSubmitting(true);

    try {
      const endpoint = editingPosition ? `/api/stock/positions/${editingPosition.id}` : '/api/stock/positions';
      const method = editingPosition ? 'PUT' : 'POST';

      const response = await authFetch(endpoint, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha ao salvar a posição.');
      }
      toast({ title: 'Sucesso!', description: `Posição ${values.name} ${editingPosition ? 'atualizada' : 'criada'}.` });
      setIsPositionFormOpen(false);
      onDataMutated();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleItemSubmit = async (values: z.infer<typeof itemFormSchema>) => {
    setIsSubmitting(true);
    try {
      const endpoint = editingItem ? `/api/stock/items/${editingItem.id}` : '/api/stock/items';
      const method = editingItem ? 'PUT' : 'POST';

      // Add reason if it's an update
      if (editingItem && !values.reason) {
        values.reason = 'Ajuste manual via interface';
      }

      const response = await authFetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      toast({ title: 'Sucesso!', description: `Item ${editingItem ? 'atualizado' : 'criado'}.` });
      setIsItemFormOpen(false);
      onDataMutated();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMoveItem = async () => {
    if (!itemToMove && selectedItemIds.length === 0) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Selecione pelo menos um item.' });
      return;
    }
    if (!newPositionId) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Selecione uma nova posição.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const itemsToUpdate = itemToMove ? [itemToMove] : items.filter(i => selectedItemIds.includes(i.id));

      const targetPosition = positions.find(p => p.id === newPositionId);
      const targetName = targetPosition?.name || newPositionId;

      const promises = itemsToUpdate.map(item =>
        authFetch(`/api/stock/items/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...item,
            positionId: newPositionId,
            isMoveOperation: true,
            reason: `Movimentação para posição ${targetName}`
          }),
        })
      );

      const results = await Promise.all(promises);
      const failed = results.filter(r => !r.ok);

      if (failed.length > 0) {
        // Extract actual error message from the first failed response
        let errorDetail = '';
        try {
          const errorData = await failed[0].json();
          errorDetail = errorData.message || '';
        } catch { }
        throw new Error(errorDetail || `Falha ao mover ${failed.length} itens.`);
      }

      toast({ title: 'Sucesso!', description: `${itemsToUpdate.length} item(s) movidos com sucesso.` });
      setIsMoveItemOpen(false);
      setItemToMove(null);
      setSelectedItemIds([]);
      onDataMutated();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleBulkDelete = async () => {
    if (selectedItemIds.length === 0) return;

    setIsSubmitting(true);
    try {
      const promises = selectedItemIds.map(id =>
        authFetch(`/api/stock/items/${id}`, { method: 'DELETE' })
      );

      const results = await Promise.all(promises);
      const failed = results.filter(r => !r.ok);

      if (failed.length > 0) {
        throw new Error(`Falha ao dar baixa em ${failed.length} itens.`);
      }

      toast({ title: 'Sucesso!', description: `Baixa realizada para ${selectedItemIds.length} itens.` });
      setSelectedItemIds([]);
      onDataMutated();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateBilling = async () => {
    if (!positionToBill || !user) return;
    setIsSubmitting(true);

    try {
      const billingHistoryEvent: BillingHistoryEvent = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        userId: user.id,
        username: user.username,
        action: 'CRIADA',
        details: `Cobrança de armazenagem criada com vencimento em ${format(new Date(billingDueDate), 'dd/MM/yyyy')}.`
      };

      const storageDays = differenceInDays(new Date(), parseISO(positionToBill.occupiedAt!));
      let obsMessage = `Cobrança referente a ${storageDays} dias de armazenagem da cotação ${positionToBill.quoteCode} na posição ${positionToBill.name}.`;

      const extraServices = [];
      if (includePicking) extraServices.push(`Separação (R$ ${pricingSettings?.pickingRate || 0})`);
      if (includePacking) extraServices.push(`Embalagem (R$ ${pricingSettings?.packingRate || 0})`);
      if (includeUnloading) extraServices.push(`Descarga/Mov. (R$ ${pricingSettings?.unloadingRate || 0})`);

      if (extraServices.length > 0) {
        obsMessage += ` Custos adicionais: ${extraServices.join(', ')}.`;
      }

      const storageQuote = {
        freightMode: 'armazenagem' as const,
        remetente: `Armazenagem - Posição ${positionToBill.name}`,
        tomador: 'A Definir', // O usuário precisará definir quem é o tomador
        cidadeOrigem: 'Galpão',
        cidadeDestino: 'Galpão',
        veiculo: 'N/A',
        valorProduto: 0,
        totalFrete: totalValue,
        valorFinal: totalValue,
        status: 'Fechada',
        billingDueDate: new Date(billingDueDate).toISOString(),
        paymentStatus: 'Pendente' as const,
        billingHistory: [billingHistoryEvent],
        obs: obsMessage,
        // Preencher outros campos obrigatórios com valores padrão
        userId: user.id,
      };

      const response = await authFetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storageQuote),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha ao criar cotação de armazenagem.');
      }

      toast({ title: 'Sucesso!', description: 'Cobrança de armazenagem gerada e enviada para o financeiro.' });
      setIsBillingOpen(false);
      onDataMutated();

    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    setIsSubmitting(true);
    try {
      const response = await authFetch(`/api/stock/items/${itemToDelete.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }
      toast({ title: 'Sucesso!', description: 'Item apagado.' });
      onDataMutated();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setItemToDelete(null);
      setIsSubmitting(false);
    }
  };

  const handleViewPositionItems = (position: StockPosition) => {
    setViewingPosition(position);
  };

  const itemsInViewingPosition = useMemo(() => {
    if (!viewingPosition) return [];
    return items.filter(item => item.positionId === viewingPosition.id);
  }, [viewingPosition, items]);

  const availablePositions = useMemo(() => {
    return positions.filter(p => p.status === 'Vazio');
  }, [positions]);



  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6 h-auto p-1 bg-muted/50 backdrop-blur-sm">
          <TabsTrigger value="dashboard" className="py-2 gap-2"><BarChart3 className="w-4 h-4" /> Dashboard</TabsTrigger>
          <TabsTrigger value="map" className="py-2 gap-2"><LayoutGrid className="w-4 h-4" /> Mapa</TabsTrigger>
          <TabsTrigger value="items" className="py-2 gap-2 relative">
            📦 Inventário
            {(() => {
              const expiredCount = items.filter(i => {
                if (!i.expirationDate) return false;
                try { return differenceInDays(parseISO(i.expirationDate), new Date()) < 0; } catch { return false; }
              }).length;
              return expiredCount > 0 ? (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                  {expiredCount > 9 ? '9+' : expiredCount}
                </span>
              ) : null;
            })()}
          </TabsTrigger>
          <TabsTrigger value="positions" className="py-2 gap-2">📍 Posições</TabsTrigger>
          <TabsTrigger value="receiving" className="py-2 gap-2">📥 Recebimento</TabsTrigger>
          <TabsTrigger value="history" className="py-2 gap-2"><History className="w-4 h-4" /> Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <StockDashboard
            positions={positions}
            items={items}
            movements={movements}
            receivingBatches={receivingBatches}
            onNavigateToTab={setActiveTab}
          />
        </TabsContent>

        <TabsContent value="receiving" className="space-y-4">
          <ReceivingManagement onDataMutated={onDataMutated} />
        </TabsContent>

        <TabsContent value="map">
          <WarehouseMap positions={positions} onPositionClick={handleViewPositionItems} />
        </TabsContent>

        <TabsContent value="positions">
          <Card>
            <CardHeader className="sm:flex-row sm:items-center sm:justify-between">
              <div className='mb-4 sm:mb-0'>
                <CardTitle>Posições de Paletes</CardTitle>
                <CardDescription>Crie e gerencie as localizações físicas no seu armazém.</CardDescription>
              </div>
              <div className='flex gap-2'>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar posição ou cotação..."
                    value={positionFilter}
                    onChange={(e) => setPositionFilter(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Posição</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Cotação Associada</TableHead>
                      <TableHead>Dias Armazenado</TableHead>
                      <TableHead>Última Atualização</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPositions.map((pos) => {
                      const storageDays = pos.occupiedAt ? differenceInDays(new Date(), parseISO(pos.occupiedAt)) : 0;
                      return (
                        <TableRow key={pos.id}>
                          <TableCell className="font-bold">{pos.name}</TableCell>
                          <TableCell>
                            <Badge
                              className={`${statusColors[pos.status]} ${pos.status === 'Ocupado' ? 'cursor-pointer' : ''}`}
                              onClick={pos.status === 'Ocupado' ? () => handleViewPositionItems(pos) : undefined}
                            >
                              {pos.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{pos.quoteCode || 'N/A'}</TableCell>
                          <TableCell>{storageDays > 0 ? `${storageDays} dia(s)` : 'N/A'}</TableCell>
                          <TableCell>{format(new Date(pos.updatedAt), 'dd/MM/yyyy HH:mm')}</TableCell>
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
                                {pos.status === 'Ocupado' && (
                                  <DropdownMenuItem onClick={() => handleOpenBillingDialog(pos)} className="cursor-pointer">
                                    <DollarSign className="mr-2 h-4 w-4" /> Cobrança
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => handleOpenPositionForm(pos)} className="cursor-pointer">
                                  <Edit className="mr-2 h-4 w-4" /> Editar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
                {isLoadingPositions && <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>}
              </div>
              {hasMorePositions && !isLoadingPositions && <div className="text-center mt-4"><Button onClick={onLoadMorePositions}>Carregar Mais</Button></div>}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="items">
          <Card className="relative">
            {selectedItemIds.length > 0 && (
              <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg animate-in fade-in slide-in-from-top-4 duration-300">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm font-bold">{selectedItemIds.length} selecionados</span>
                <div className="w-px h-4 bg-primary-foreground/30 mx-2" />
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setIsMoveItemOpen(true)}
                >
                  Mover em Massa
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-7 text-xs bg-red-600 hover:bg-red-700 border-none"
                    >
                      Baixa em Massa
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar Baixa em Massa?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Você está prestes a dar baixa em {selectedItemIds.length} itens simultaneamente. Esta ação registrará a saída definitiva destes itens do estoque.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive hover:bg-destructive/90">
                        Confirmar Baixa
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 hover:bg-white/10"
                  onClick={() => setSelectedItemIds([])}
                >
                  ×
                </Button>
              </div>
            )}
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Itens em Estoque</CardTitle>
                <CardDescription>Cadastre e gerencie os itens individuais armazenados.</CardDescription>
              </div>
              <div className="flex gap-2 flex-wrap items-center">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar itens..."
                    value={itemFilter}
                    onChange={(e) => setItemFilter(e.target.value)}
                    className="pl-9 w-full sm:w-[250px]"
                  />
                </div>
                <Button onClick={() => handleOpenItemForm(null)}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Novo Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedItemIds.length === filteredItems.length && filteredItems.length > 0}
                          onCheckedChange={toggleAllItems}
                        />
                      </TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Lote / Validade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Posição</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map(item => (
                      <TableRow key={item.id} className={selectedItemIds.includes(item.id) ? 'bg-primary/5' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={selectedItemIds.includes(item.id)}
                            onCheckedChange={() => toggleItemSelection(item.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono">{item.sku}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{item.name}</span>
                            {item.nfNumber && <span className="text-[10px] text-muted-foreground">NF: {item.nfNumber}</span>}
                          </div>
                        </TableCell>
                        <TableCell>{item.companyName || '--'}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 text-xs">
                            <span>Lote: {item.batch || '--'}</span>
                            {item.expirationDate ? (() => {
                              const daysLeft = differenceInDays(parseISO(item.expirationDate), new Date());
                              const isExpired = daysLeft < 0;
                              const isCritical = daysLeft >= 0 && daysLeft <= 7;
                              const isWarning = daysLeft > 7 && daysLeft <= 30;
                              return (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] font-bold px-1.5 py-0.5 w-fit ${isExpired
                                    ? 'text-red-600 bg-red-100 dark:bg-red-900/30 border-red-300 animate-pulse'
                                    : isCritical
                                      ? 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 border-orange-300'
                                      : isWarning
                                        ? 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 border-amber-300'
                                        : 'text-muted-foreground'
                                    }`}
                                >
                                  {isExpired ? '⛔ ' : isCritical ? '⚠️ ' : isWarning ? '🔶 ' : ''}
                                  {format(parseISO(item.expirationDate), 'dd/MM/yy')}
                                  {isExpired ? ` (${Math.abs(daysLeft)}d venc.)` : daysLeft <= 30 ? ` (${daysLeft}d)` : ''}
                                </Badge>
                              );
                            })() : <span className="text-muted-foreground">Sem validade</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.status === 'Em Conferência' ? 'secondary' : 'default'} className={item.status === 'Em Conferência' ? 'bg-orange-100 text-orange-800 border-none' : 'bg-emerald-100 text-emerald-800 border-none'}>
                            {item.status || 'Armazenado'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-bold text-center">
                          <div className="flex flex-col items-center">
                            <span>{item.quantity}</span>
                            {item.reserved && item.quantity === 0 && (
                              <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200 mt-1">
                                Reservado
                              </Badge>
                            )}
                            {item.unitType === 'PALETES' && <span className="block text-[10px] text-muted-foreground font-normal">({item.palletCount || 1} PLTs)</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-muted/50">{item.positionName}</Badge>
                        </TableCell>
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
                              <DropdownMenuItem onClick={() => handleOpenMoveDialog(item)} className="cursor-pointer">
                                <Move className="mr-2 h-4 w-4" /> Mover
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleOpenItemForm(item)} className="cursor-pointer">
                                <Edit className="mr-2 h-4 w-4" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setItemToDelete(item)} className="text-destructive cursor-pointer focus:text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>

                          <AlertDialog open={itemToDelete?.id === item.id} onOpenChange={(open) => !open && setItemToDelete(null)}>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Apagar Item?</AlertDialogTitle>
                                <AlertDialogDescription>Tem certeza que deseja apagar o item {item.name}?</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteItem} className="bg-destructive hover:bg-destructive/90">Apagar</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="history">
          <StockMovementHistory movements={movements} historyDate={historyDate} setHistoryDate={setHistoryDate} />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <Dialog open={isPositionFormOpen} onOpenChange={setIsPositionFormOpen}>
        <DialogContent><DialogHeader><DialogTitle>{editingPosition ? 'Editar' : 'Nova'} Posição de Palete</DialogTitle></DialogHeader>
          <Form {...positionForm}><form onSubmit={positionForm.handleSubmit(handlePositionSubmit)} className="space-y-4">
            <FormField control={positionForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nome da Posição</FormLabel><FormControl><Input placeholder="Ex: A1, B12" {...field} disabled /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={positionForm.control} name="status" render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="Vazio">Vazio</SelectItem>
                    <SelectItem value="Ocupado">Ocupado</SelectItem>
                    <SelectItem value="Manutenção">Manutenção</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            {watchedPositionStatus === 'Ocupado' && (
              <FormField control={positionForm.control} name="quoteCode" render={({ field }) => (
                <FormItem>
                  <FormLabel>Vincular Cotação (pelo código)</FormLabel>
                  <FormControl>
                    <Input placeholder="Digite o código da cotação" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}
            <DialogFooter className="pt-4">
              <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form></Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isItemFormOpen} onOpenChange={setIsItemFormOpen}>
        <DialogContent><DialogHeader><DialogTitle>{editingItem ? 'Editar' : 'Novo'} Item</DialogTitle></DialogHeader>
          <Form {...itemForm}><form onSubmit={itemForm.handleSubmit(handleItemSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={itemForm.control} name="sku" render={({ field }) => (<FormItem><FormLabel>SKU</FormLabel><FormControl><Input placeholder="Cód. do Produto" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={itemForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nome do Item</FormLabel><FormControl><Input placeholder="Nome do produto" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <FormField control={itemForm.control} name="description" render={({ field }) => (<FormItem><FormLabel>Descrição (Opcional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={itemForm.control} name="quantity" render={({ field }) => (<FormItem><FormLabel>Quantidade</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={itemForm.control} name="positionId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Posição</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      {availablePositions.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      {/* Se editando e mantendo a posição, exibe ela também */}
                      {editingItem && !availablePositions.find(p => p.id === editingItem.positionId) && (
                        <SelectItem key={editingItem.positionId} value={editingItem.positionId}>{editingItem.positionName}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={itemForm.control} name="companyId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Empresa (Opcional)</FormLabel>
                  <Select onValueChange={(val) => {
                    field.onChange(val);
                  }} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      {clientCompanies.map(c => <SelectItem key={c.id} value={c.id!}>{c.nomeFantasia || c.razaoSocial}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={itemForm.control} name="nfNumber" render={({ field }) => (<FormItem><FormLabel>No. NF-e</FormLabel><FormControl><Input placeholder="Opcional" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={itemForm.control} name="batch" render={({ field }) => (<FormItem><FormLabel>Lote</FormLabel><FormControl><Input placeholder="Ex: ABC-123" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={itemForm.control} name="expirationDate" render={({ field }) => (<FormItem><FormLabel>Data de Validade</FormLabel><FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
            </div>

            {editingItem && (
              <FormField control={itemForm.control} name="reason" render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo do Ajuste (Obrigatório)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Correção de quantidade, Mudança de lote..." {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}
            <DialogFooter className="pt-4">
              <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingItem ? 'Salvar' : 'Criar Item'}
              </Button>
            </DialogFooter>
          </form></Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isMoveItemOpen} onOpenChange={setIsMoveItemOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover Item de Estoque</DialogTitle>
            <DialogDescription>Mover <span className="font-semibold">{itemToMove?.name}</span> da posição <span className="font-semibold">{itemToMove?.positionName}</span>.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="newPosition">Nova Posição (Vazia)</Label>
            <Select onValueChange={setNewPositionId} value={newPositionId}>
              <SelectTrigger id="newPosition"><SelectValue placeholder="Selecione a nova posição..." /></SelectTrigger>
              <SelectContent>
                {availablePositions.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary" disabled={isSubmitting}>Cancelar</Button></DialogClose>
            <Button onClick={handleMoveItem} disabled={isSubmitting || !newPositionId}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Movimentação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Position Items Dialog */}
      <Dialog open={!!viewingPosition} onOpenChange={(open) => !open && setViewingPosition(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Itens na Posição: {viewingPosition?.name}</DialogTitle>
            <DialogDescription>Cotação associada: {viewingPosition?.quoteCode || 'Nenhuma'}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-80 mt-4">
            {itemsInViewingPosition.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Qtd</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemsInViewingPosition.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono">{item.sku}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">Nenhum item alocado nesta posição.</p>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={async () => {
              if (!viewingPosition) return;
              const item = itemsInViewingPosition[0];
              const isPallet = !!item?.palletNumber;

              const nfNumber = item?.nfNumber || 'S/N';
              const palletNumber = item?.palletNumber || '1';
              const companyName = item?.companyName || 'N/A';

              const labelData = isPallet ? {
                id: `PAL-${nfNumber}-${palletNumber}`,
                title: `NF: ${nfNumber} | Palete: ${palletNumber}`,
                subtitle: `Posição: ${viewingPosition.name}`,
                footer: `Data: ${new Date().toLocaleDateString('pt-BR')} | ${companyName.substring(0, 20)}`,
                barcodeValue: `PAL-${nfNumber}-${palletNumber}`
              } : {
                id: `POS-${viewingPosition.id}`,
                title: `Posição: ${viewingPosition.name}`,
                subtitle: `Cotação: ${viewingPosition.quoteCode || 'S/N'}`,
                footer: `Data: ${new Date().toLocaleDateString('pt-BR')}`,
                barcodeValue: `POS-${viewingPosition.id}`
              };

              try {
                await printPalletLabels([labelData], companyProfile?.logoUrl);
              } catch (e) {
                toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao imprimir etiqueta.' });
              }
            }}>
              <Printer className="w-4 h-4 mr-2" />
              Reimprimir Etiqueta
            </Button>
            <DialogClose asChild><Button variant="outline">Fechar</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBillingOpen} onOpenChange={setIsBillingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar Cobrança de Armazenagem</DialogTitle>
            <DialogDescription>
              Posição: {positionToBill?.name} | Cotação: {positionToBill?.quoteCode}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Dias Armazenado</Label>
                <Input value={positionToBill?.occupiedAt ? differenceInDays(new Date(), parseISO(positionToBill.occupiedAt)) : 0} readOnly />
              </div>
              <div className="space-y-2">
                <Label htmlFor="daily-rate">Valor Diária (R$)</Label>
                <Input
                  id="daily-rate"
                  value={dailyRateMasked}
                  onChange={(e) => handleCurrencyChange(e, setDailyRate, setDailyRateMasked)}
                />
              </div>
            </div>

            <div className="flex flex-col space-y-3 py-2 border-y my-2">
              <Label className="text-muted-foreground">Custos Operacionais Adicionais</Label>
              <div className="flex items-center space-x-2">
                <Checkbox id="include-picking" checked={includePicking} onCheckedChange={(checked) => setIncludePicking(checked as boolean)} />
                <Label htmlFor="include-picking" className="font-normal cursor-pointer text-sm">Adicionar Taxa de Separação (Picking)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="include-packing" checked={includePacking} onCheckedChange={(checked) => setIncludePacking(checked as boolean)} />
                <Label htmlFor="include-packing" className="font-normal cursor-pointer text-sm">Adicionar Taxa de Embalagem (Packing)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="include-unloading" checked={includeUnloading} onCheckedChange={(checked) => setIncludeUnloading(checked as boolean)} />
                <Label htmlFor="include-unloading" className="font-normal cursor-pointer text-sm">Adicionar Taxa de Descarga (Unloading)</Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="total-value">Valor Total da Cobrança (R$)</Label>
              <Input
                id="total-value"
                value={totalValueMasked}
                onChange={(e) => handleCurrencyChange(e, setTotalValue, setTotalValueMasked)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due-date">Data de Vencimento</Label>
              <Input id="due-date" type="date" value={billingDueDate} onChange={e => setBillingDueDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary" disabled={isSubmitting}>Cancelar</Button></DialogClose>
            <Button onClick={handleGenerateBilling} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Gerar e Enviar para Cobrança
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
