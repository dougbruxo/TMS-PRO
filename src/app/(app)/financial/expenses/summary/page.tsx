
"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BackButton } from '@/components/BackButton';
import { Input } from '@/components/ui/input';
import { Loader2, DollarSign, TrendingDown, Clock, AlertTriangle, ArrowLeft } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { subDays, format, parse, parseISO, startOfDay, endOfDay, isPast, isSameDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import type { Expense } from '@/lib/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { authFetch } from '@/lib/api-client';

const formatCurrency = (value: number) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ExpensesSummaryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);

  const [dateRange, setDateRange] = useState<DateRange>({ from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) });
  const [startDateStr, setStartDateStr] = useState(dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : '');
  const [endDateStr, setEndDateStr] = useState(dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : '');

  const fetchExpenses = useCallback(async () => {
    setIsDataLoading(true);
    try {
        const expensesRes = await authFetch('/api/expenses');
        if (!expensesRes.ok) throw new Error("Falha ao carregar despesas.");
        setExpenses(await expensesRes.json());
    } catch(e: any) {
        toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
        setIsDataLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
    if(!authLoading) {
      if(!user || !user.expensesAccess) {
        router.push('/dashboard');
        return;
      }
      fetchExpenses();
    }
  }, [user, authLoading, router, fetchExpenses]);

  const handleApplyDateFilter = () => {
    try {
      const from = startOfDay(parse(startDateStr, 'yyyy-MM-dd', new Date()));
      const to = endOfDay(parse(endDateStr, 'yyyy-MM-dd', new Date()));
      if (isNaN(from.getTime()) || isNaN(to.getTime())) throw new Error('Datas inválidas.');
      setDateRange({ from, to });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro de Data', description: e.message });
    }
  };
  
  const summaryData = useMemo(() => {
    if (!dateRange.from || !dateRange.to) return { totalExpenses: 0, totalPaid: 0, totalPending: 0, totalOverdue: 0, chartData: [] };

    const filteredExpenses = expenses.filter(exp => {
        const dueDate = parseISO(exp.dueDate);
        return dueDate >= dateRange.from! && dueDate <= dateRange.to!;
    });
    
    const { total, paid, pending, overdue } = filteredExpenses.reduce((acc, exp) => {
        acc.total += exp.value;
        acc.paid += exp.paidValue || 0;
        const isOverdue = exp.status === 'pendente' && isPast(parseISO(exp.dueDate)) && !isSameDay(parseISO(exp.dueDate), new Date());
        if (isOverdue) {
            acc.overdue += exp.value - (exp.paidValue || 0);
        }
        return acc;
    }, { total: 0, paid: 0, pending: 0, overdue: 0 });

    const byCategory = filteredExpenses.reduce((acc, exp) => {
        const category = exp.categoryName || 'Sem Categoria';
        if (!acc[category]) {
            acc[category] = 0;
        }
        acc[category] += exp.value;
        return acc;
    }, {} as Record<string, number>);

    const chartData = Object.entries(byCategory).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);

    return {
        totalExpenses: total,
        totalPaid: paid,
        totalPending: total - paid,
        totalOverdue: overdue,
        chartData
    };
  }, [expenses, dateRange]);


  if (authLoading || isDataLoading || !user) {
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
      <div className="flex justify-between items-start flex-wrap gap-4 mb-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-primary">Resumo de Despesas</h1>
          <p className="text-muted-foreground">Analise suas despesas por período e categoria.</p>
        </div>
        <BackButton href="/financial/expenses" label="Voltar para Gestão de Despesas" className="mb-0 mt-2" />
      </div>

      <Card className="mb-8">
        <CardHeader>
            <CardTitle>Filtro por Período de Vencimento</CardTitle>
            <div className="flex flex-col md:flex-row gap-4 pt-4">
                <Input type="date" value={startDateStr} onChange={e => setStartDateStr(e.target.value)}/>
                <Input type="date" value={endDateStr} onChange={e => setEndDateStr(e.target.value)}/>
                <Button onClick={handleApplyDateFilter}>Aplicar Filtro</Button>
              </div>
        </CardHeader>
      </Card>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Previsto</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatCurrency(summaryData.totalExpenses)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Pago</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-green-600">{formatCurrency(summaryData.totalPaid)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Pendente</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-yellow-600">{formatCurrency(summaryData.totalPending)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Atrasado</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-red-600">{formatCurrency(summaryData.totalOverdue)}</p></CardContent></Card>
      </div>
      
      <Card>
        <CardHeader><CardTitle>Despesas por Categoria</CardTitle></CardHeader>
        <CardContent className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={summaryData.chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR')}`} />
              <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }}/>
              <Tooltip formatter={(value) => formatCurrency(Number(value))}/>
              <Legend />
              <Bar dataKey="value" name="Valor da Despesa" fill="hsl(var(--destructive))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </main>
  );
}
