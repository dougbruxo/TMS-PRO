
"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Archive, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import type { Expense } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { authFetch } from '@/lib/api-client';

const formatCurrency = (value: number) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function FinalizedExpensesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await authFetch('/api/expenses?status=finalizado');
      if (!response.ok) throw new Error('Falha ao carregar despesas finalizadas.');
      const data = await response.json();
      setExpenses(data);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !user.expensesAccess) {
      router.push('/dashboard');
      return;
    }
    fetchData();
  }, [user, authLoading, router, fetchData]);

  const expensesByMonth = useMemo(() => {
    return expenses.reduce((acc, expense) => {
        const monthYear = expense.monthYear;
        if(!acc[monthYear]) {
            acc[monthYear] = {
                monthName: format(parseISO(`${monthYear}-01T12:00:00Z`), "MMMM 'de' yyyy", { locale: ptBR }),
                expenses: []
            };
        }
        acc[monthYear].expenses.push(expense);
        return acc;
    }, {} as Record<string, { monthName: string; expenses: Expense[] }>);
  }, [expenses]);
  
  const sortedMonths = useMemo(() => Object.keys(expensesByMonth).sort().reverse(), [expensesByMonth]);

  if (isLoading || authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="container mx-auto p-4 md:p-8">
      <Button variant="outline" onClick={() => router.push('/financial/expenses')} className="mb-8">
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Painel de Despesas
      </Button>
      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
          <Archive className="h-8 w-8"/>
          Despesas Finalizadas
        </h1>
        <p className="text-muted-foreground">Histórico de todas as despesas de meses que foram finalizados.</p>
      </div>

        {sortedMonths.length > 0 ? (
             <div className="space-y-8">
                {sortedMonths.map(monthKey => {
                    const monthData = expensesByMonth[monthKey];
                    const totalValue = monthData.expenses.reduce((sum, exp) => sum + exp.value, 0);
                    return (
                        <Card key={monthKey}>
                            <CardHeader>
                                <CardTitle className="capitalize">{monthData.monthName}</CardTitle>
                                <CardDescription>Total do Mês: <span className="font-bold">{formatCurrency(totalValue)}</span></CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="max-h-96">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Descrição</TableHead>
                                            <TableHead>Categoria</TableHead>
                                            <TableHead>Vencimento</TableHead>
                                            <TableHead className="text-right">Valor</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {monthData.expenses.map(expense => (
                                            <TableRow key={expense.id}>
                                                <TableCell>{expense.description}</TableCell>
                                                <TableCell>{expense.categoryName}</TableCell>
                                                <TableCell>{format(parseISO(expense.dueDate), 'dd/MM/yyyy')}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(expense.value)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    )
                })}
             </div>
        ) : (
            <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                    <p>Nenhuma despesa finalizada encontrada.</p>
                </CardContent>
            </Card>
        )}
    </main>
  );
}
