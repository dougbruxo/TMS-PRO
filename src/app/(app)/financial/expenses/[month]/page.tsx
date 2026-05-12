
"use client";

import { useEffect, useMemo, useCallback, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExpenseManagement } from '@/components/ExpenseManagement';
import { format, parse, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Expense, ExpenseCategory } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/api-client';

export default function MonthExpensesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const monthKey = Array.isArray(params.month) ? params.month[0] : params.month;
  
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
        const [expensesRes, categoriesRes] = await Promise.all([
            authFetch(`/api/expenses?monthYear=${monthKey}`),
            authFetch('/api/expense-categories')
        ]);
        if (!expensesRes.ok || !categoriesRes.ok) {
            throw new Error("Falha ao carregar dados de despesas.");
        }
        setExpenses(await expensesRes.json());
        setExpenseCategories(await categoriesRes.json());
    } catch(e: any) {
        toast({ variant: 'destructive', title: 'Erro de Carregamento', description: e.message });
    } finally {
        setIsLoading(false);
    }
  }, [toast, monthKey]);
  
  useEffect(() => {
    if (authLoading) return;
    if (!user || !user.expensesAccess) {
      router.push('/dashboard');
    } else {
      fetchData();
    }
  }, [user, authLoading, router, fetchData]);


  const addExpense = async (data: Partial<Expense>): Promise<boolean> => {
    try {
        const response = await authFetch('/api/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...data, userId: user!.id, user: { username: user!.username } }),
        });
        if (!response.ok) throw new Error(await response.text());
        fetchData();
        return true;
    } catch (e: any) {
        toast({ variant: 'destructive', title: "Erro na Operação", description: e.message });
        return false;
    }
  }

  const monthDate = parse(monthKey, 'yyyy-MM', new Date());

  if (authLoading || isLoading || !user || !user.expensesAccess || !isValid(monthDate)) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const monthName = format(monthDate, "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <main className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <Button variant="outline" onClick={() => router.push('/financial/expenses')}>
          &larr; Voltar para o Painel de Despesas
        </Button>
         <Button variant="secondary" onClick={() => router.push('/settings/expense-categories')}>
          Gerir Categorias
        </Button>
      </div>
      <h1 className="text-3xl font-bold text-primary mb-2 capitalize">{monthName}</h1>
      <p className="text-muted-foreground mb-8">Gerencie todas as despesas para o mês selecionado.</p>
      
      <ExpenseManagement 
        monthKey={monthKey}
        expenses={expenses}
        expenseCategories={expenseCategories}
        onDataMutated={fetchData}
        addExpense={addExpense}
      />
    </main>
  );
}
