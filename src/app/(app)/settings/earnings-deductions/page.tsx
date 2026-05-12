
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EarningDeductionManagement } from '@/components/EarningDeductionManagement';
import type { EarningDeductionType } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/api-client';

export default function ManageEarningsDeductionsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [earningDeductionTypes, setEarningDeductionTypes] = useState<EarningDeductionType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await authFetch('/api/earnings-deductions');
      if (!res.ok) throw new Error('Falha ao buscar itens de proventos/descontos.');
      setEarningDeductionTypes(await res.json());
    } catch(e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !user.settingsAccess || !user.talentsAccess) {
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
        <Button variant="outline" onClick={() => router.push('/hr')} className="mb-8">
            &larr; Voltar para Recursos Humanos
        </Button>
        <h1 className="text-3xl font-bold text-primary mb-8">Gerenciar Proventos e Descontos</h1>
        
        <EarningDeductionManagement 
            earningDeductionTypes={earningDeductionTypes} 
            onDataMutated={fetchData} 
        />

      </main>
  );
}
