"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CalendarDays, ChevronDown, AlertTriangle, BarChart3, ArrowLeft } from 'lucide-react';
import type { Quote, Invoice } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/api-client';
import { format, isPast, isSameDay, parse, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

const formatCurrency = (value: number) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type DisplayItem = (Quote & { isInvoice?: false }) | (Invoice & { isInvoice: true });


const MonthCardSkeleton = () => (
    <Card>
        <CardHeader className="pb-2">
            <CardTitle className="text-lg"><div className="h-6 w-3/4 bg-muted rounded animate-pulse" /></CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            <div>
                <div className="h-4 w-1/2 bg-muted rounded animate-pulse mb-1" />
                <div className="h-8 w-3/4 bg-muted rounded animate-pulse" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
                <div className="h-5 w-20 bg-muted rounded-full animate-pulse" />
                <div className="h-5 w-20 bg-muted rounded-full animate-pulse" />
            </div>
        </CardContent>
    </Card>
);

export default function BillingHubPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [showPastMonths, setShowPastMonths] = useState(false);

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

    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro de Carregamento', description: e.message });
    } finally {
      setIsDataLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
    if (authLoading) return;
    if (!user || !user.expensesAccess) {
      router.push('/dashboard');
    } else {
      fetchAllData();
    }
  }, [user, authLoading, router, fetchAllData]);
  
  const { currentAndFutureMonths, pastMonths } = useMemo(() => {
    const allItems: DisplayItem[] = [
        ...invoices.map(inv => ({...inv, isInvoice: true as const})),
        ...quotes.filter(q => q.paymentStatus !== 'Pago' && !q.invoiceId).map(q => ({...q, isInvoice: false as const}))
    ];
    
    const expensesByMonth = allItems.reduce((acc, item) => {
      const monthKey = item.billingDueDate ? format(parseISO(item.billingDueDate), 'yyyy-MM') : 'no-due-date';

      if (!acc[monthKey]) {
        acc[monthKey] = {
          totalValue: 0,
          pendingCount: 0,
          overdueCount: 0,
          itemCount: 0,
        };
      }
      
      acc[monthKey].itemCount++;
      const itemValue = item.isInvoice ? item.totalValue : ((item.valorFinal || 0) + (item.icmsValor || 0));
      acc[monthKey].totalValue += itemValue;
      
      const paymentStatus = item.isInvoice ? item.status : item.paymentStatus || 'Pendente';
      if (paymentStatus !== 'Pago') {
        acc[monthKey].pendingCount++;
        const dueDate = item.billingDueDate ? parseISO(item.billingDueDate) : null;
        if (dueDate && isPast(dueDate) && !isSameDay(dueDate, new Date())) {
          acc[monthKey].overdueCount++;
        }
      }

      return acc;
    }, {} as Record<string, { totalValue: number; pendingCount: number; overdueCount: number; itemCount: number; }>);
    
    const now = new Date();
    const existingMonthKeys = Object.keys(expensesByMonth);

    for (let i = -1; i < 12; i++) { // From last month to next 12
        const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const monthKey = format(monthDate, 'yyyy-MM');
        if (!existingMonthKeys.includes(monthKey)) {
            existingMonthKeys.push(monthKey);
        }
    }
    
    const allMonths = [...new Set(existingMonthKeys)]
      .filter(monthKey => monthKey !== 'no-due-date')
      .map(monthKey => {
      const monthDate = parse(monthKey, 'yyyy-MM', new Date());
      const monthData = expensesByMonth[monthKey] || { totalValue: 0, pendingCount: 0, overdueCount: 0, itemCount: 0 };
      
      return {
        name: format(monthDate, "MMMM 'de' yyyy", { locale: ptBR }),
        key: monthKey,
        data: monthData,
        isPast: isPast(endOfMonth(monthDate)) && !isWithinInterval(now, { start: startOfMonth(monthDate), end: endOfMonth(monthDate) }),
        isCurrent: isWithinInterval(now, { start: startOfMonth(monthDate), end: endOfMonth(monthDate) }),
      };
    }).filter(m => m.data.itemCount > 0);

    const currentAndFutureMonths = allMonths
      .filter(m => !m.isPast)
      .sort((a, b) => a.key.localeCompare(b.key));
    
    const pastMonths = allMonths
      .filter(m => m.isPast)
      .sort((a, b) => b.key.localeCompare(a.key));

    return { currentAndFutureMonths, pastMonths };

  }, [invoices, quotes]);

  const MonthCard = ({ month }: { month: any }) => (
      <Link href={`/financial/billing/${month.key}`} className="flex group">
          <Card className={cn("flex flex-col w-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1", { "border-red-500 border-2": month.data.overdueCount > 0, "border-yellow-500": month.data.overdueCount === 0 && month.data.pendingCount > 0, })}>
            <CardHeader className="pb-2">
                <CardTitle className="capitalize text-lg flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" /> {month.name}
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
                <div>
                    <p className="text-sm text-muted-foreground">Valor em Aberto</p>
                    <p className="text-2xl font-bold">{formatCurrency(month.data.totalValue)}</p>
                </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary">{month.data.itemCount} cobranças</Badge>
                    <Badge variant={month.data.pendingCount > 0 ? 'default' : 'secondary'} className={cn({'bg-yellow-500 text-white': month.data.pendingCount > 0})}>
                        {month.data.pendingCount} pendentes
                    </Badge>
                     <Badge variant={month.data.overdueCount > 0 ? 'destructive' : 'secondary'} className={cn({'animate-pulse': month.data.overdueCount > 0})}>
                        {month.data.overdueCount} atrasadas
                    </Badge>
                  </div>
            </CardContent>
          </Card>
      </Link>
    );

  return (
    <main className="container mx-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.push('/financial')} 
            className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <div className="h-4 w-px bg-border hidden md:block" />
          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-primary whitespace-nowrap">Gestão de Cobranças</h1>
            <p className="text-xs text-muted-foreground hidden md:block">Selecione um mês para ver os detalhes ou agrupe múltiplas cobranças em uma única fatura.</p>
          </div>
        </div>
        <div className="flex gap-2">
           <Button onClick={() => router.push('/financial/billing/summary')} size="sm">
                <BarChart3 className="mr-2 h-4 w-4"/> Ver Resumo
            </Button>
        </div>
      </div>
      
       {isDataLoading ? (
             <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-8">
                {Array.from({ length: 8 }).map((_, index) => <MonthCardSkeleton key={index} />)}
            </div>
        ) : (
            <>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-8">
                    {currentAndFutureMonths.map(month => <MonthCard key={month.key} month={month} />)}
                </div>

                {pastMonths.length > 0 && (
                  <div className="my-8">
                     {!showPastMonths && (
                        <div className="text-center">
                            <Button variant="secondary" onClick={() => setShowPastMonths(true)}>
                                <ChevronDown className="mr-2 h-4 w-4"/>
                                Mostrar Meses Anteriores ({pastMonths.length})
                            </Button>
                        </div>
                     )}
                     {showPastMonths && (
                        <>
                         <Separator className="mb-8" />
                         <h2 className="text-2xl font-semibold text-primary mb-6 text-center">Meses Anteriores Pendentes</h2>
                         <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {pastMonths.map(month => <MonthCard key={month.key} month={month} />)}
                        </div>
                       </>
                     )}
                  </div>
                )}
            </>
        )}
    </main>
  );
}
