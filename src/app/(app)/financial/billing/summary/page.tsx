
"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BackButton } from '@/components/BackButton';
import { Input } from '@/components/ui/input';
import { Loader2, DollarSign, HandCoins, Banknote, AlertTriangle, ArrowLeft } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { subDays, format, parse, parseISO, startOfDay, endOfDay, isPast, isSameDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/api-client';
import type { Quote, Invoice } from '@/lib/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const formatCurrency = (value: number) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type DisplayItem = (Quote & { isInvoice?: false }) | (Invoice & { isInvoice: true });

export default function BillingSummaryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);

  const [dateRange, setDateRange] = useState<DateRange>({ from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) });
  const [startDateStr, setStartDateStr] = useState(dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : '');
  const [endDateStr, setEndDateStr] = useState(dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : '');

  const fetchAllData = useCallback(async () => {
    setIsDataLoading(true);
    try {
        const [quotesRes, invoicesRes] = await Promise.all([
             authFetch('/api/quotes?status=billing_all'),
             authFetch('/api/billing/invoices')
        ]);
        if (!quotesRes.ok || !invoicesRes.ok) throw new Error("Falha ao carregar dados de cobrança.");
        setQuotes(await quotesRes.json());
        setInvoices(await invoicesRes.json());
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
      fetchAllData();
    }
  }, [user, authLoading, router, fetchAllData]);

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
    if (!dateRange.from || !dateRange.to) return { totalBilled: 0, totalPaid: 0, balanceDue: 0, overdueCount: 0, chartData: [] };

    const allItems: DisplayItem[] = [
        ...invoices.map(inv => ({...inv, isInvoice: true as const})),
        ...quotes.filter(q => q.paymentStatus !== 'Pago' && !q.invoiceId).map(q => ({...q, isInvoice: false as const}))
    ];

    const filteredItems = allItems.filter(item => {
        if (!item.billingDueDate) return false;
        const dueDate = parseISO(item.billingDueDate);
        return dueDate >= dateRange.from! && dueDate <= dateRange.to!;
    });
    
    let totalBilled = 0;
    let totalPaid = 0;
    let overdueCount = 0;

    filteredItems.forEach(item => {
      const totalDue = item.isInvoice ? item.totalValue : ((item.valorFinal || 0) + (item.icmsValor || 0));
      totalBilled += Math.round(totalDue * 100) / 100;
      totalPaid += Math.round((item.paidAmount || 0) * 100) / 100;

      const dueDate = item.billingDueDate ? parseISO(item.billingDueDate) : new Date();
      const isOverdue = isPast(dueDate) && !isSameDay(dueDate, new Date());
      const paymentStatus = item.isInvoice ? item.status : item.paymentStatus || 'Pendente';
      
      if (isOverdue && paymentStatus !== 'Pago') {
        overdueCount++;
      }
    });

    const byClient = filteredItems.reduce((acc, item) => {
        const client = item.tomador;
        if (!acc[client]) {
            acc[client] = 0;
        }
        acc[client] += item.isInvoice ? item.totalValue : ((item.valorFinal || 0) + (item.icmsValor || 0));
        return acc;
    }, {} as Record<string, number>);

    const chartData = Object.entries(byClient).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 10);

    return {
        totalBilled: Math.round(totalBilled * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        balanceDue: Math.round((totalBilled - totalPaid) * 100) / 100,
        overdueCount,
        chartData
    };
  }, [invoices, quotes, dateRange]);


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
          <h1 className="text-3xl font-bold text-primary">Resumo de Cobranças</h1>
          <p className="text-muted-foreground">Analise suas receitas por período e por cliente.</p>
        </div>
        <BackButton href="/financial/billing" label="Voltar para Gestão de Cobranças" className="mb-0 mt-2" />
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
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Faturado</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatCurrency(summaryData.totalBilled)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Recebido</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-green-600">{formatCurrency(summaryData.totalPaid)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Saldo Devedor</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-orange-500">{formatCurrency(summaryData.balanceDue)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Cobranças Vencidas</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-destructive">{summaryData.overdueCount}</p></CardContent></Card>
      </div>

       <Card>
        <CardHeader><CardTitle>Top 10 Clientes por Faturamento</CardTitle></CardHeader>
        <CardContent className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={summaryData.chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(value) => `R$ ${Number(value / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }}/>
              <Tooltip formatter={(value) => formatCurrency(Number(value))}/>
              <Legend />
              <Bar dataKey="value" name="Valor Faturado" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </main>
  );
}
