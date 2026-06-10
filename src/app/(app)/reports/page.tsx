
"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, DollarSign, TrendingDown, Award, Search, FileText, Printer, BarChart3 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { DateRange } from 'react-day-picker';
import { subDays, format, parse, parseISO, startOfDay, endOfDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/api-client';
import type { Quote, User } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export default function ReportsPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);

  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });
  
  const [selectedUserId, setSelectedUserId] = useState('all');

  const fetchAllData = useCallback(async () => {
    setIsDataLoading(true);
    try {
        const [quotesRes, usersRes] = await Promise.all([
             authFetch('/api/quotes'),
             authFetch('/api/users')
        ]);
        if (!quotesRes.ok || !usersRes.ok) throw new Error("Failed to fetch report data");
        setQuotes(await quotesRes.json());
        setUsers(await usersRes.json());
    } catch(e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
        setIsDataLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
    if(authLoading) return;
    if(!currentUser || currentUser.role !== 'admin') {
      router.push('/dashboard');
      return;
    }
    fetchAllData();
  }, [currentUser, authLoading, router, fetchAllData]);

  const { filteredQuotes, totalNetProfit, totalExpenses, totalSalesBonus } = useMemo(() => {
    if (!dateRange.from || isNaN(dateRange.from.getTime()) || !dateRange.to || isNaN(dateRange.to.getTime())) {
        return { filteredQuotes: [], totalNetProfit: 0, totalExpenses: 0, totalSalesBonus: 0 };
    }
    
    const start = startOfDay(dateRange.from);
    const end = endOfDay(dateRange.to);

    const relevantQuotes = quotes.filter(quote => {
        const quoteDate = parseISO(quote.closedAt || quote.data);
        const userMatch = selectedUserId === 'all' || String(quote.userId) === selectedUserId || String(quote.creatorId) === selectedUserId;
        return quote.status === 'Finalizado' && userMatch && quoteDate >= start && quoteDate <= end;
    });
    
    let totalNetProfit = 0;
    let totalExpenses = 0;
    let totalSalesBonus = 0;

    relevantQuotes.forEach(quote => {
        const netProfit = (quote.grossProfit || 0) - (quote.totalExpense || 0);
        const quoteUserIdStr = quote.creatorId ? String(quote.creatorId) : String(quote.userId);
        const user = users.find(u => u.id === quoteUserIdStr);
        const bonusPercentage = user?.salesBonusPercentage ? user.salesBonusPercentage / 100 : 0;
        const salesBonus = netProfit > 0 ? netProfit * bonusPercentage : 0;
        
        totalNetProfit += netProfit;
        totalExpenses += (quote.totalExpense || 0);
        totalSalesBonus += salesBonus;
    });

    return { filteredQuotes: relevantQuotes, totalNetProfit, totalExpenses, totalSalesBonus };

  }, [quotes, users, dateRange, selectedUserId]);

  if (authLoading || isDataLoading || !currentUser || currentUser.role !== 'admin') {
    return (
        <div className="flex h-full items-center justify-center">
             <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }
  
  const formatCurrency = (value: number) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <main className="container mx-auto p-4 md:p-8">
      <PageHeader
        icon={<BarChart3 className="h-4 w-4" />}
        badge="Análise de Resultados"
        titlePrefix="Relatório de"
        titleHighlight="Desempenho"
        description="Analise os resultados da equipe e os lucros da operação."
        actions={
          <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4"/>Imprimir</Button>
        }
      />
      
      <Card className="mb-8">
         <CardHeader>
            <CardTitle>Filtros do Relatório</CardTitle>
            <div className="flex flex-col md:flex-row gap-4 pt-4">
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
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Geral (Todos Usuários)</SelectItem>
                        {users.filter(u => u.role !== 'cliente').map(u => (
                            <SelectItem key={u.id} value={u.id}>{u.username}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
         </CardHeader>
      </Card>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Lucro Líquido Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className={cn("text-2xl font-bold", (totalNetProfit - totalSalesBonus) >= 0 ? "text-green-600" : "text-red-500")}>
                    {formatCurrency(totalNetProfit - totalSalesBonus)}
                </div>
                <p className="text-xs text-muted-foreground">Após todas as despesas</p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total de Despesas</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</div><p className="text-xs text-muted-foreground">Custos operacionais e impostos</p></CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Bônus de Venda</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-blue-600">{formatCurrency(totalSalesBonus)}</div><p className="text-xs text-muted-foreground">Baseado no lucro e na taxa do usuário</p></CardContent>
        </Card>
      </div>

       <Card>
            <CardHeader>
                <CardTitle>Cotações Finalizadas no Período</CardTitle>
                <CardDescription>Lista de cotações que compõem o relatório.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="border rounded-md">
                    <Table>
                        <TableHeader><TableRow><TableHead>Cotação</TableHead><TableHead>Responsável</TableHead><TableHead>Lucro Líquido</TableHead><TableHead>Despesas</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {filteredQuotes.length > 0 ? filteredQuotes.map(quote => {
                                const netProfit = (quote.grossProfit || 0) - (quote.totalExpense || 0);
                                return (
                                    <TableRow key={quote.id}>
                                        <TableCell>{quote.quoteCode}</TableCell>
                                        <TableCell>{quote.usuario}</TableCell>
                                        <TableCell className={cn("font-semibold", netProfit >= 0 ? "text-green-600" : "text-red-500")}>
                                            {formatCurrency(netProfit)}
                                        </TableCell>
                                        <TableCell className="text-red-600">{formatCurrency(quote.totalExpense || 0)}</TableCell>
                                    </TableRow>
                                )
                            }) : (
                                <TableRow><TableCell colSpan={4} className="text-center h-24 text-muted-foreground">Nenhuma cotação finalizada neste período.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>

    </main>
  );
}
