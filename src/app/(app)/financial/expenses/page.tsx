
"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, ArrowRight, CalendarDays, Check, Archive, ChevronDown, AlertTriangle, BarChart3 } from 'lucide-react';
import type { Expense } from '@/lib/types';
import { format, getYear, isSameDay, isTomorrow, isPast, parse, getMonth, isSameMonth, endOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { GlobalSearch } from '@/components/GlobalSearch';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { authFetch } from '@/lib/api-client';

const renderExpenseResult = (expense: any) => (
    <div>
        <div className="flex justify-between items-start">
            <div>
                <p className="font-semibold">{expense.isGroup ? `${expense.description} (Grupo Recorrente)` : expense.description}</p>
                <p className="text-sm text-muted-foreground">
                    {expense.isGroup ? `${expense.count} despesas encontradas.` : `Vencimento: ${format(new Date(expense.dueDate), 'dd/MM/yy')}`}
                </p>
            </div>
            <div className="text-right">
                <Badge variant="secondary">{expense.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Badge>
                <p className="text-xs text-muted-foreground mt-1">Status: {expense.status}</p>
            </div>
        </div>
    </div>
);

const handleExpenseResultClick = (expense: any, router: any) => {
    if (expense.isGroup || !expense.monthYear || expense.monthYear === 'Recorrente') {
        router.push(`/financial/expenses`);
        return;
    }
    const monthYear = expense.monthYear || format(new Date(expense.dueDate), 'yyyy-MM');
    router.push(`/financial/expenses/${monthYear}`);
};

const MonthCardSkeleton = () => (
    <Card>
        <CardHeader className="flex-row items-center gap-4 space-y-0 pb-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="flex-grow space-y-2">
                <Skeleton className="h-5 w-3/4" />
            </div>
        </CardHeader>
        <CardContent className="space-y-4">
            <div>
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-8 w-3/4 mt-1" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
            </div>
        </CardContent>
    </Card>
);


export default function ExpensesDashboardPage() {
  const { user, loading: authLoading, refreshAllData } = useAuth(); 
  const router = useRouter();
  const [showPastMonths, setShowPastMonths] = useState(false);
  const { toast } = useToast();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinalizing, setIsFinalizing] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
        const res = await authFetch('/api/expenses');
        if (!res.ok) throw new Error("Falha ao carregar despesas.");
        setExpenses(await res.json());
    } catch(e: any) {
        toast({variant: 'destructive', title: 'Erro', description: e.message});
    } finally {
        setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !user.expensesAccess) {
        router.push('/dashboard');
    } else {
        fetchData();
    }
  }, [user, authLoading, router, fetchData]);
  
  const handleFinalizeMonth = async (monthKey: string) => {
    if (!user) return;
    setIsFinalizing(true);
    const expensesToFinalize = expenses.filter(e => e.monthYear === monthKey && e.status !== 'finalizado');
    
    try {
        for (const exp of expensesToFinalize) {
          const res = await authFetch(`/api/expenses/${exp.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'finalizado', user }),
          });
          if(!res.ok) throw new Error(`Falha ao finalizar a despesa ${exp.description}`);
        }
        await fetchData();
        toast({ title: 'Sucesso!', description: `Despesas do mês ${monthKey} finalizadas.`})
    } catch(e: any) {
        toast({variant: 'destructive', title: 'Erro', description: e.message});
    } finally {
        setIsFinalizing(false);
    }
  };

  const { currentAndFutureMonths, pastMonths, finalizedMonthsCount } = useMemo(() => {
    if(!expenses) return { currentAndFutureMonths: [], pastMonths: [], finalizedMonthsCount: 0 };
    
    const expensesByMonth = expenses.reduce((acc, expense) => {
      const monthYear = expense.monthYear || (expense.dueDate ? format(parseISO(expense.dueDate), 'yyyy-MM') : null);
      if (!monthYear) return acc;
      if (!acc[monthYear]) {
        acc[monthYear] = {
          totalValue: 0,
          pendingCount: 0,
          paidCount: 0,
          finalizedCount: 0,
          dueSoonCount: 0,
          overdueCount: 0,
          expenseCount: 0,
        };
      }
      
      acc[monthYear].expenseCount++;
      acc[monthYear].totalValue += expense.value;
      
      const dueDate = parseISO(expense.dueDate);
      const isOverdue = expense.status === 'pendente' && isPast(dueDate) && !isSameDay(dueDate, new Date());

      if (isOverdue) {
        acc[monthYear].overdueCount++;
      } else if (expense.status === 'pendente') {
          acc[monthYear].pendingCount++;
          if (isSameDay(dueDate, new Date()) || isTomorrow(dueDate)) {
              acc[monthYear].dueSoonCount++;
          }
      } else if (expense.status === 'pago') {
          acc[monthYear].paidCount++;
      } else if (expense.status === 'finalizado') {
          acc[monthYear].finalizedCount++;
      }

      return acc;
    }, {} as Record<string, { totalValue: number; pendingCount: number; paidCount: number; finalizedCount: number; dueSoonCount: number, overdueCount: number, expenseCount: number }>);
    
    const now = new Date();
    const existingMonthKeys = Object.keys(expensesByMonth);

    for (let i = 0; i < 12; i++) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const monthKey = format(monthDate, 'yyyy-MM');
        if (!existingMonthKeys.includes(monthKey)) {
            existingMonthKeys.push(monthKey);
        }
    }
    
    const allMonths = [...new Set(existingMonthKeys)].map(monthKey => {
      const monthDate = parse(monthKey, 'yyyy-MM', new Date());
      const monthData = expensesByMonth[monthKey] || { totalValue: 0, pendingCount: 0, paidCount: 0, finalizedCount: 0, dueSoonCount: 0, overdueCount: 0, expenseCount: 0 };
      
      const isFinalized = monthData.finalizedCount > 0 && monthData.finalizedCount >= monthData.expenseCount && monthData.expenseCount > 0;

      return {
        name: format(monthDate, 'MMMM \'de\' yyyy', { locale: ptBR }),
        key: monthKey,
        data: monthData,
        isPast: isPast(endOfMonth(monthDate)) && !isSameMonth(monthDate, new Date()),
        isCurrent: isSameMonth(monthDate, new Date()),
        isFinalized: isFinalized,
      };
    });

    const currentAndFutureMonthsUnsorted = allMonths.filter(m => !m.isPast && !m.isFinalized);
    const pastMonthsUnsorted = allMonths.filter(m => m.isPast && !m.isFinalized);
    const finalizedMonthsCount = allMonths.filter(m => m.isFinalized).length;

    const currentAndFutureMonths = currentAndFutureMonthsUnsorted.sort((a, b) => a.key.localeCompare(b.key));
    const currentMonth = currentAndFutureMonths.find(m => m.isCurrent);
    if(currentMonth) {
        const index = currentAndFutureMonths.findIndex(m => m.key === currentMonth.key);
        if(index > 0) {
            const [item] = currentAndFutureMonths.splice(index, 1);
            currentAndFutureMonths.unshift(item);
        }
    }

    const pastMonths = pastMonthsUnsorted.sort((a, b) => b.key.localeCompare(a.key));

    return { currentAndFutureMonths, pastMonths, finalizedMonthsCount };
  }, [expenses]);
  
  if (authLoading || !user) {
    return (
        <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }
  
  const MonthCard = ({ month }: { month: any }) => {
    const hasOverdue = month.data.overdueCount > 0;
    const hasDueSoon = month.data.dueSoonCount > 0;
    const canBeFinalized = month.isPast && month.data.pendingCount === 0 && month.data.overdueCount === 0 && !month.isFinalized && month.data.expenseCount > 0;

    return (
      <Link href={`/financial/expenses/${month.key}`} className="flex group">
          <Card className={cn(
              "flex flex-col w-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1",
              {
              "border-red-500 border-2": hasOverdue,
              "border-yellow-500": !hasOverdue && hasDueSoon,
              "border-green-500": month.isFinalized
          })}>
            <CardHeader className="flex-row items-center gap-4 space-y-0 pb-2">
                {month.isFinalized ? <Archive className="h-8 w-8 text-green-500" /> : <CalendarDays className="h-8 w-8 text-primary" />}
                <div className="flex-grow">
                    <CardTitle className="capitalize text-lg">{month.name}</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
                <div>
                    <p className="text-sm text-muted-foreground">Despesa Total</p>
                    <p className="text-2xl font-bold">{month.data.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground">Pendentes:</span>
                    <Badge variant={hasDueSoon && !hasOverdue ? 'default' : 'secondary'} className={cn({'bg-yellow-500 text-white': hasDueSoon && !hasOverdue})}>
                        {month.data.pendingCount}
                    </Badge>
                    <span className="text-sm text-muted-foreground">Atrasadas:</span>
                     <Badge variant={hasOverdue ? 'destructive' : 'secondary'} className={cn({'animate-pulse': hasOverdue})}>
                        {month.data.overdueCount}
                    </Badge>
                  </div>
            </CardContent>
            {canBeFinalized && (
              <CardFooter className="p-4 pt-0">
                  <Button 
                    className="w-full" 
                    variant="outline" 
                    onClick={(e) => {
                      e.preventDefault(); 
                      handleFinalizeMonth(month.key);
                    }} 
                    disabled={isFinalizing}
                  >
                      {isFinalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="ml-2 h-4 w-4" />}
                      Finalizar Mês
                  </Button>
              </CardFooter>
            )}
          </Card>
      </Link>
    )
  }

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
            <h1 className="text-xl font-bold text-primary whitespace-nowrap">Gestão de Despesas</h1>
            <p className="text-xs text-muted-foreground hidden md:block">Visualize e gerencie as despesas da empresa mês a mês.</p>
          </div>
        </div>
        <div className="flex gap-2">
            <Button onClick={() => router.push('/financial/expenses/summary')} size="sm">
                <BarChart3 className="mr-2 h-4 w-4"/> Ver Resumo
            </Button>
        </div>
      </div>
         <div className="mb-8">
            <Link href="/financial/expenses/finalized">
                <Button variant="secondary" size="lg">
                    <Archive className="mr-2 h-5 w-5" />
                    Ver Meses Finalizados ({finalizedMonthsCount})
                </Button>
            </Link>
        </div>

        <GlobalSearch<Expense>
            placeholder="Buscar por descrição, categoria, valor..."
            availableStatusFilters={['pendente', 'pago', 'atraso']}
            basePath="/financial/expenses"
            apiPath="/api/expenses/search"
            renderResult={renderExpenseResult}
            onResultClick={handleExpenseResultClick}
        />

        {isLoading ? (
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
