"use client";

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, DollarSign, HandCoins, ChevronsUpDown, Check, Users, Package } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { subDays, format, parse, parseISO, startOfDay, endOfDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import type { Quote, User } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { authFetch } from '@/lib/api-client';

const formatCurrency = (value: number) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ClienteMeusFretesPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: quotes = [], isLoading: isLoadingQuotes } = useQuery<Quote[]>({
    queryKey: ['quotes-all'],
    queryFn: async () => {
        const token = localStorage.getItem('sessionToken');
        const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res = await authFetch('/api/quotes', { headers });
        if (!res.ok) throw new Error("Falha ao carregar cotações.");
        return res.json();
    },
    enabled: !!currentUser && !!currentUser.myFreightsAccess,
  });

  const { data: users = [], isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ['sub-cliente-list'],
    queryFn: async () => {
        const token = localStorage.getItem('sessionToken');
        const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res = await authFetch('/api/cliente-users', { headers });
        if (!res.ok) throw new Error("Falha ao carregar usuários.");
        return res.json();
    },
    enabled: !!currentUser && !!currentUser.myFreightsAccess,
  });

  const isDataLoading = isLoadingQuotes || isLoadingUsers;

  const [dateRange, setDateRange] = useState<DateRange>({ from: subDays(new Date(), 29), to: new Date() });
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  
  const [isManagePanelOpen, setIsManagePanelOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<string[]>([]);
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [isTransferUserListOpen, setIsTransferUserListOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'Finalizado' | 'Aberta'>('Finalizado');
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    if (currentUser) {
      setSelectedUserId(currentUser.id);
    }
  }, [currentUser]);

  useEffect(() => {
    if(!authLoading) {
      if(!currentUser || !currentUser.myFreightsAccess) {
        router.push('/cliente/dashboard');
        return;
      }
    }
  }, [currentUser, authLoading, router]);
  
  useEffect(() => {
    setSelectedQuoteIds([]);
  }, [selectedUserId, statusFilter]);

  const { filteredQuotes } = useMemo(() => {
    if (!dateRange.from || isNaN(dateRange.from.getTime()) || !dateRange.to || isNaN(dateRange.to.getTime()) || !selectedUserId) {
        return { filteredQuotes: [] };
    }
    
    const start = startOfDay(dateRange.from);
    const end = endOfDay(dateRange.to);
    const searchLower = searchFilter.toLowerCase();

    const relevantQuotes = quotes.filter(quote => {
        const dateToCheck = quote.status === 'Finalizado' ? quote.closedAt : quote.data;
        if (!dateToCheck) return false;

        const quoteDate = parseISO(dateToCheck);
        
        // No cliente, mostramos ou o filtro selecionado (sub-users) ou o ID do próprio cliente matriz
        const effectiveQueryId = currentUser?.isSubClient ? currentUser?.parentId : currentUser?.id;
        
        // Filtro de segurança: A cotação deve pertencer ao Grupo do Cliente (effectiveUserId)
        // E ser do usuário selecionado no filtro de visão do painel
        const isFromSelectedUser = quote.creatorId === selectedUserId || (selectedUserId === currentUser?.id && quote.userId === currentUser?.id && !quote.creatorId);

        const matchesStatus = statusFilter === 'Finalizado' 
            ? quote.status === 'Finalizado' 
            : (quote.status !== 'Finalizado' && quote.status !== 'Recusada');
        const matchesBase = matchesStatus && quoteDate >= start && quoteDate <= end && isFromSelectedUser;
        
        if (!matchesBase) return false;
        
        if (searchFilter) {
            return (
                 quote.quoteCode?.toLowerCase().includes(searchLower) ||
                 quote.tomador?.toLowerCase().includes(searchLower) ||
                 quote.remetente?.toLowerCase().includes(searchLower) ||
                 quote.destinatario?.toLowerCase().includes(searchLower) ||
                 false
            );
        }
        return true;
    });

    return { filteredQuotes: relevantQuotes };
  }, [quotes, dateRange, selectedUserId, statusFilter, searchFilter, currentUser]);

  const handleTransferQuotes = async () => {
    if (selectedQuoteIds.length === 0 || !targetUserId) {
      toast({ variant: 'destructive', title: 'Erro de Validação', description: 'Selecione as cotações e o colaborador de destino.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('sessionToken');
      const response = await authFetch('/api/quotes/transfer', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ quoteIds: selectedQuoteIds, newUserId: targetUserId }),
      });
      if (!response.ok) throw new Error('Falha ao transferir cotações.');
      
      toast({ title: 'Sucesso!', description: `${selectedQuoteIds.length} cotação(ões) transferida(s) com sucesso.` });
      queryClient.invalidateQueries({ queryKey: ['quotes-all'] });
      
      setSelectedQuoteIds([]);
      setTargetUserId('');
      setIsManagePanelOpen(false);
    } catch(e: any) {
      toast({ variant: 'destructive', title: 'Erro na Transferência', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const selectedUser = users.find(u => u.id === selectedUserId) || (selectedUserId === currentUser?.id ? currentUser : null);
  
  if (authLoading || isDataLoading || !currentUser) {
    return (
        <main className="container mx-auto p-4 md:p-8">
            <div className="flex h-full items-center justify-center pt-20">
              <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
            </div>
        </main>
    );
  }

  // Lista de usuários para o filtro e transferência (Matriz + Sub-clientes)
  const availableUsers = [
      { id: currentUser.isSubClient ? currentUser.parentId : currentUser.id, username: 'MATRIZ / CONTA PRINCIPAL' },
      ...users
  ];

  return (
    <main className="container mx-auto p-4 md:p-8">
        <div className="flex justify-between items-start mb-8 flex-wrap gap-4">
            <div>
                <h1 className="text-3xl font-bold text-primary mb-2">Meus Fretes</h1>
                <p className="text-muted-foreground max-w-2xl">
                    Acompanhe o resumo das cotações da sua equipe e movimentações por período.
                </p>
            </div>
            {(currentUser.role === 'cliente' || (currentUser.role === 'sub-cliente' && currentUser.subRole === 'ADM')) && (
                <Button onClick={() => setIsManagePanelOpen(prev => !prev)}>
                    <Users className="mr-2 h-4 w-4"/> Gerenciar Equipe
                </Button>
            )}
        </div>

        {isManagePanelOpen && (
            <Card className="mb-8 bg-muted/30 border-dashed border-2">
                <CardHeader>
                    <CardTitle>Painel de Gestão Interna</CardTitle>
                    <CardDescription>Transfira cotações entre os colaboradores da sua conta.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div className="space-y-2">
                            <Label>Colaborador de Origem</Label>
                            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    {availableUsers.map(u => (
                                        <SelectItem key={u.id} value={u.id}>{u.username}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'Finalizado' | 'Aberta')}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Finalizado">Finalizadas</SelectItem>
                                    <SelectItem value="Aberta">Em Aberto</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Transferir para</Label>
                            <Popover open={isTransferUserListOpen} onOpenChange={setIsTransferUserListOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" role="combobox" className="w-full justify-between">
                                        {targetUserId ? availableUsers.find(u => u.id === targetUserId)?.username : "Selecione o destino..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                    <Command>
                                        <CommandInput placeholder="Buscar colaborador..." />
                                        <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                                        <CommandList>
                                            <CommandGroup>
                                                {availableUsers.filter(u => u.id !== selectedUserId).map(u => (
                                                    <CommandItem key={u.id} onSelect={() => { setTargetUserId(u.id); setIsTransferUserListOpen(false); }}>
                                                        <Check className={cn("mr-2 h-4 w-4", targetUserId === u.id ? "opacity-100" : "opacity-0")} />
                                                        {u.username}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <Button onClick={handleTransferQuotes} disabled={isSubmitting || selectedQuoteIds.length === 0 || !targetUserId}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Transferir Selecionados
                        </Button>
                    </div>
                </CardContent>
            </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Volume de Fretes</CardTitle>
                    <Package className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{filteredQuotes.length}</div>
                    <p className="text-xs text-muted-foreground">No período selecionado</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Peso Total</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {filteredQuotes.reduce((acc, q) => acc + (q.peso || 0), 0).toLocaleString('pt-BR')} kg
                    </div>
                    <p className="text-xs text-muted-foreground">Somatória de carga</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Custo Total de Frete</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {formatCurrency(filteredQuotes.reduce((acc, q) => acc + (q.valorFinal || 0) + (q.icmsValor || 0), 0))}
                    </div>
                    <p className="text-xs text-muted-foreground">Valor pago à transportadora</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Valor dos Produtos</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {formatCurrency(filteredQuotes.reduce((acc, q) => acc + (q.valorProduto || 0), 0))}
                    </div>
                </CardContent>
            </Card>
        </div>

        <Card className="mb-8">
            <CardHeader>
                <CardTitle>Filtrar Visualização</CardTitle>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div className="space-y-2">
                        <Label>Visualizar dados de:</Label>
                        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                {availableUsers.map(u => (
                                    <SelectItem key={u.id} value={u.id}>{u.username}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>De:</Label>
                        <Input 
                            type="date" 
                            value={dateRange.from && !isNaN(dateRange.from.getTime()) ? format(dateRange.from, 'yyyy-MM-dd') : ''}
                            onChange={e => {
                                const val = e.target.value;
                                if (!val) {
                                    setDateRange(prev => ({...prev, from: undefined}));
                                    return;
                                }
                                const parsed = parse(val, 'yyyy-MM-dd', new Date());
                                if (!isNaN(parsed.getTime())) {
                                    setDateRange(prev => ({...prev, from: parsed}));
                                }
                            }}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Até:</Label>
                        <Input 
                            type="date" 
                            value={dateRange.to && !isNaN(dateRange.to.getTime()) ? format(dateRange.to, 'yyyy-MM-dd') : ''}
                            onChange={e => {
                                const val = e.target.value;
                                if (!val) {
                                    setDateRange(prev => ({...prev, to: undefined}));
                                    return;
                                }
                                const parsed = parse(val, 'yyyy-MM-dd', new Date());
                                if (!isNaN(parsed.getTime())) {
                                    setDateRange(prev => ({...prev, to: parsed}));
                                }
                            }}
                        />
                    </div>
                </div>
            </CardHeader>
        </Card>

        <Card>
            <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <CardTitle>Listagem de Cotações - {statusFilter}</CardTitle>
                    <CardDescription>Cotações atreladas à sua conta no período selecionado.</CardDescription>
                </div>
                <div className="w-full md:max-w-sm">
                    <Input placeholder="Pesquisar por Código, Cliente, Destino..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)} />
                </div>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[60vh] border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {isManagePanelOpen && <TableHead className="w-[50px]"><Checkbox onCheckedChange={(checked) => { setSelectedQuoteIds(checked ? filteredQuotes.map(q => q.id) : []) }} /></TableHead>}
                                <TableHead>Cotação</TableHead>
                                <TableHead>Remetente</TableHead>
                                <TableHead>Destinatário</TableHead>
                                <TableHead>Peso</TableHead>
                                <TableHead>Valor do Frete</TableHead>
                                <TableHead>Data</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredQuotes.length > 0 ? filteredQuotes.map(quote => (
                                <TableRow key={quote.id}>
                                    {isManagePanelOpen && <TableCell><Checkbox checked={selectedQuoteIds.includes(quote.id)} onCheckedChange={(checked) => setSelectedQuoteIds(prev => checked ? [...prev, quote.id] : prev.filter(id => id !== quote.id))} /></TableCell>}
                                    <TableCell><Badge variant="secondary">{quote.quoteCode}</Badge></TableCell>
                                    <TableCell className="max-w-[150px] truncate">{quote.remetente}</TableCell>
                                    <TableCell className="max-w-[150px] truncate">{quote.destinatario}</TableCell>
                                    <TableCell>{quote.peso?.toLocaleString('pt-BR')} kg</TableCell>
                                    <TableCell className="font-semibold">{formatCurrency((quote.valorFinal || 0) + (quote.icmsValor || 0))}</TableCell>
                                    <TableCell>{format(parseISO(statusFilter === 'Finalizado' ? (quote.closedAt || quote.data) : quote.data), 'dd/MM/yyyy')}</TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={isManagePanelOpen ? 7 : 6} className="text-center h-24 text-muted-foreground">Nenhuma cotação encontrada para os filtros selecionados.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </CardContent>
        </Card>
    </main>
  );
}
