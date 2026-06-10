

"use client";

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, DollarSign, HandCoins, ChevronsUpDown, Check, Users, TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
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

export default function MyFreightsPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: quotes = [], isLoading: isLoadingQuotes } = useQuery<Quote[]>({
    queryKey: ['quotes-all'],
    queryFn: async () => {
        const token = localStorage.getItem('sessionToken');
        const res = await authFetch('/api/quotes', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Falha ao carregar cotações.");
        return res.json();
    },
    enabled: !!currentUser && !!currentUser.myFreightsAccess,
  });

  const { data: users = [], isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ['users-list'],
    queryFn: async () => {
        const token = localStorage.getItem('sessionToken');
        const res = await authFetch('/api/users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
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
        router.push('/dashboard');
        return;
      }
    }
  }, [currentUser, authLoading, router]);
  
  useEffect(() => {
    setSelectedQuoteIds([]);
  }, [selectedUserId, statusFilter]);

  const { filteredQuotes, totalNetProfit, totalSalesBonus } = useMemo(() => {
    if (!dateRange.from || isNaN(dateRange.from.getTime()) || !dateRange.to || isNaN(dateRange.to.getTime()) || !selectedUserId) {
        return { filteredQuotes: [], totalNetProfit: 0, totalSalesBonus: 0 };
    }
    
    const start = startOfDay(dateRange.from);
    const end = endOfDay(dateRange.to);
    const searchLower = searchFilter.toLowerCase();

    const relevantQuotes = quotes.filter(quote => {
        const dateToCheck = quote.status === 'Finalizado' ? quote.closedAt : quote.data;
        if (!dateToCheck) return false;

        const quoteDate = parseISO(dateToCheck);
        
        const effectiveQueryId = currentUser?.isSubClient ? currentUser?.parentId : selectedUserId;
        // Match by creatorId (who created) OR userId (who owns), since quotes created for clients have different userId
        const matchesUser = String(quote.creatorId) === effectiveQueryId || String(quote.userId) === effectiveQueryId;
        const matchesStatus = statusFilter === 'Finalizado' 
            ? quote.status === 'Finalizado' 
            : (quote.status !== 'Finalizado' && quote.status !== 'Recusada');
        const matchesBase = matchesStatus && matchesUser && quoteDate >= start && quoteDate <= end;
        
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
    
    const selectedUser = users.find(u => u.id === selectedUserId);
    const bonusPercentage = (selectedUser?.salesBonusPercentage || 0) / 100;

    let totalNetProfit = 0;
    let totalSalesBonus = 0;

    relevantQuotes.forEach(quote => {
        const netProfit = (quote.grossProfit || 0) - (quote.totalExpense || 0);
        const salesBonus = netProfit > 0 ? netProfit * bonusPercentage : 0;
        totalNetProfit += netProfit;
        totalSalesBonus += salesBonus;
    });

    return { filteredQuotes: relevantQuotes, totalNetProfit, totalSalesBonus };
  }, [quotes, users, dateRange, selectedUserId, statusFilter, searchFilter]);

  const handleTransferQuotes = async () => {
    if (selectedQuoteIds.length === 0 || !targetUserId) {
      toast({ variant: 'destructive', title: 'Erro de Validação', description: 'Selecione as cotações e o utilizador de destino.' });
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
      // Invalidate the cache to reload updated quotes
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
  
  const selectedUser = users.find(u => u.id === selectedUserId);
  
  if (authLoading || isDataLoading || !currentUser) {
    return (
        <main className="container mx-auto p-4 md:p-8">
            <div className="flex h-full items-center justify-center">
              <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
            </div>
        </main>
    );
  }

  return (
    <main className="container mx-auto p-4 md:p-8">
      
          <PageHeader
            icon={<TrendingUp className="h-4 w-4" />}
            badge="Desempenho de Vendas"
            titlePrefix="Meus"
            titleHighlight="Fretes"
            description="Acompanhe o resumo das suas cotações e o bônus de vendas por período."
            actions={
              currentUser.role === 'admin' ? (
                <Button onClick={() => setIsManagePanelOpen(prev => !prev)}>
                  <Users className="mr-2 h-4 w-4"/> Gerenciar Cotações
                </Button>
              ) : undefined
            }
          />

          {isManagePanelOpen && (
            <Card className="mb-8 bg-muted/50">
              <CardHeader>
                <CardTitle>Painel de Gestão de Cotações</CardTitle>
                <CardDescription>Transfira cotações de um utilizador para outro.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div className="space-y-2">
                    <Label>Utilizador de Origem</Label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                            {users.filter(u => u.role !== 'cliente').map(u => (
                                <SelectItem key={u.id} value={u.id}>{u.username}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status da Cotação</Label>
                    <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'Finalizado' | 'Aberta')}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Finalizado">Finalizadas</SelectItem>
                            <SelectItem value="Aberta">Em Aberto</SelectItem>
                        </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Transferir para Utilizador</Label>
                    <Popover open={isTransferUserListOpen} onOpenChange={setIsTransferUserListOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="w-full justify-between">
                          {targetUserId ? users.find(u => u.id === targetUserId)?.username : "Selecione o destino..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                          <CommandInput placeholder="Buscar utilizador..." />
                          <CommandEmpty>Nenhum utilizador encontrado.</CommandEmpty>
                          <CommandList>
                            <CommandGroup>
                              {users.filter(u => u.role !== 'cliente' && u.id !== selectedUserId).map(u => (
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
                <p className="text-xs text-muted-foreground">Utilize os checkboxes na tabela abaixo para selecionar as cotações a serem transferidas.</p>
              </CardContent>
            </Card>
          )}

          <Card className="mb-8">
            <CardHeader>
              <CardTitle>
                {selectedUser?.username === currentUser.username ? "Meu Desempenho" : `Desempenho de ${selectedUser?.username}`}
              </CardTitle>
              <div className="flex flex-col md:flex-row gap-4 pt-4">
                <Input 
                  type="date" 
                  value={dateRange.from && !isNaN(dateRange.from.getTime()) ? format(dateRange.from, 'yyyy-MM-dd') : ''}
                  onChange={e => {
                    const val = e.target.value;
                    if (!val) {
                      setDateRange(prev => ({ ...prev, from: undefined }));
                      return;
                    }
                    const parsed = parse(val, 'yyyy-MM-dd', new Date());
                    if (!isNaN(parsed.getTime())) {
                      setDateRange(prev => ({ ...prev, from: parsed }));
                    }
                  }}
                />
                <Input 
                  type="date" 
                  value={dateRange.to && !isNaN(dateRange.to.getTime()) ? format(dateRange.to, 'yyyy-MM-dd') : ''}
                  onChange={e => {
                    const val = e.target.value;
                    if (!val) {
                      setDateRange(prev => ({ ...prev, to: undefined }));
                      return;
                    }
                    const parsed = parse(val, 'yyyy-MM-dd', new Date());
                    if (!isNaN(parsed.getTime())) {
                      setDateRange(prev => ({ ...prev, to: parsed }));
                    }
                  }}
                />
              </div>
            </CardHeader>
          </Card>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {statusFilter === 'Finalizado' ? (
                <>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Lucro Líquido Gerado</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className={cn("text-2xl font-bold", totalNetProfit >= 0 ? "text-green-600" : "text-red-500")}>
                            {formatCurrency(totalNetProfit)}
                          </div>
                          <p className="text-xs text-muted-foreground">Período selecionado</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Bônus de Venda Estimado</CardTitle>
                            <HandCoins className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent><div className="text-2xl font-bold text-blue-600">{formatCurrency(totalSalesBonus)}</div><p className="text-xs text-muted-foreground">Com base no lucro e na taxa de {((selectedUser?.salesBonusPercentage || 0))}%</p></CardContent>
                    </Card>
                </>
            ) : (
                <>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Cotações em Aberto</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent><div className="text-2xl font-bold">{filteredQuotes.length}</div><p className="text-xs text-muted-foreground">No período selecionado</p></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Valor Total em Aberto</CardTitle>
                            <HandCoins className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(filteredQuotes.reduce((acc, q) => acc + (q.valorFinal || 0), 0))}</div>
                            <p className="text-xs text-muted-foreground">Soma das cotações em aberto</p>
                        </CardContent>
                    </Card>
                </>
            )}
          </div>

          <Card>
            <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle>Cotações ({selectedUser?.username})</CardTitle>
                <CardDescription>Lista de cotações que compõem o resumo de desempenho.</CardDescription>
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
                      <TableHead>Cliente</TableHead>
                      {statusFilter === 'Finalizado' ? (
                          <>
                            <TableHead>Lucro Líquido</TableHead>
                            <TableHead>Bônus</TableHead>
                            <TableHead>Data Finalização</TableHead>
                          </>
                      ) : (
                          <>
                            <TableHead>Valor do Frete</TableHead>
                            <TableHead>Data de Criação</TableHead>
                          </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredQuotes.length > 0 ? filteredQuotes.map(quote => {
                      const netProfit = (quote.grossProfit || 0) - (quote.totalExpense || 0);
                      const bonusPercentage = (selectedUser?.salesBonusPercentage || 0) / 100;
                      const salesBonus = netProfit > 0 ? netProfit * bonusPercentage : 0;
                      return (
                        <TableRow key={quote.id}>
                          {isManagePanelOpen && <TableCell><Checkbox checked={selectedQuoteIds.includes(quote.id)} onCheckedChange={(checked) => setSelectedQuoteIds(prev => checked ? [...prev, quote.id] : prev.filter(id => id !== quote.id))} /></TableCell>}
                          <TableCell><Badge variant="secondary">{quote.quoteCode}</Badge></TableCell>
                          <TableCell>{quote.tomador}</TableCell>
                          {statusFilter === 'Finalizado' ? (
                            <>
                                <TableCell className={cn("font-semibold", netProfit >= 0 ? "text-green-600" : "text-red-500")}>
                                  {formatCurrency(netProfit)}
                                </TableCell>
                                <TableCell className="font-semibold text-blue-600">{formatCurrency(salesBonus)}</TableCell>
                                <TableCell>{format(parseISO(quote.closedAt || quote.data), 'dd/MM/yyyy')}</TableCell>
                            </>
                          ) : (
                             <>
                                <TableCell className="font-semibold">{formatCurrency((quote.valorFinal || 0) + (quote.icmsValor || 0))}</TableCell>
                                <TableCell>{format(parseISO(quote.data), 'dd/MM/yyyy')}</TableCell>
                             </>
                          )}
                        </TableRow>
                      )
                    }) : (
                      <TableRow><TableCell colSpan={isManagePanelOpen ? 6 : 5} className="text-center h-24 text-muted-foreground">Nenhuma cotação {statusFilter === 'Finalizado' ? 'finalizada' : 'em aberto'} neste período para o utilizador selecionado.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        
    </main>
  );
}
