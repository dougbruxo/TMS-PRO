
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OccurrenceTypeManagement } from '@/components/OccurrenceTypeManagement';
import type { OccurrenceType } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/api-client';

export default function ManageOccurrenceTypesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [occurrenceTypes, setOccurrenceTypes] = useState<OccurrenceType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    try {
        const res = await authFetch('/api/occurrences');
        if (!res.ok) throw new Error("Failed to fetch occurrence types");
        setOccurrenceTypes(await res.json());
    } catch(e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
        setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !user.settingsAccess) {
      router.push('/dashboard');
      return;
    }
    fetchAllData();
  }, [user, authLoading, router, fetchAllData]);

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
        <h1 className="text-3xl font-bold text-primary mb-8">Gerenciar Tipos de Ocorrência</h1>
        
        <OccurrenceTypeManagement 
            occurrenceTypes={occurrenceTypes} 
            onDataMutated={fetchAllData} 
        />

      </main>
  );
}
