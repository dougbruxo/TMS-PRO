
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExpenseCategoryManagement } from '@/components/ExpenseCategoryManagement';
import type { ExpenseCategory } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/api-client';

export default function ManageExpenseCategoriesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
        const res = await authFetch('/api/expense-categories');
        if (!res.ok) throw new Error("Falha ao buscar categorias de despesa.");
        setExpenseCategories(await res.json());
    } catch(e: any) {
        toast({variant: 'destructive', title: 'Erro', description: e.message});
    } finally {
        setIsLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
    if (authLoading) return;
    if (!user || !user.settingsAccess || !user.expensesAccess) {
      router.push('/dashboard');
    } else {
        fetchData();
    }
  }, [user, authLoading, router, fetchData]);

  if (authLoading || isLoading || !user) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="container mx-auto p-4 md:p-8">
      <Button variant="outline" onClick={() => router.push('/settings')} className="mb-8">
        &larr; Voltar para Configurações
      </Button>
      <h1 className="text-3xl font-bold text-primary mb-8">Gerenciar Categorias de Despesa</h1>
      
      <ExpenseCategoryManagement 
        expenseCategories={expenseCategories}
        onDataMutated={fetchData}
      />
    </main>
  );
}
