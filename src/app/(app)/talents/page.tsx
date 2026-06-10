

"use client";

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { TalentManagement } from '@/components/TalentManagement';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BackButton } from '@/components/BackButton';
import type { Talent, HiringType, User } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/api-client';

function ManageTalentsContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const quickEditId = searchParams.get('quickEdit') || undefined;
  
  const { toast } = useToast();
  
  const [talents, setTalents] = useState<Talent[]>([]);
  const [hiringTypes, setHiringTypes] = useState<HiringType[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [talentsRes, hiringTypesRes, usersRes] = await Promise.all([
        authFetch('/api/talents'),
        authFetch('/api/hiring-types'),
        authFetch('/api/users'),
      ]);
      if (!talentsRes.ok || !hiringTypesRes.ok || !usersRes.ok) throw new Error('Falha ao carregar dados de talentos.');
      setTalents(await talentsRes.json());
      setHiringTypes(await hiringTypesRes.json());
      setUsers(await usersRes.json());
    } catch(e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
    if (authLoading) return;
    if (!user || !user.talentsAccess) {
      router.push('/dashboard');
    } else {
      fetchData();
    }
  }, [user, authLoading, router, fetchData]);
  
  const apiAction = async (endpoint: string, method: 'POST' | 'PUT' | 'DELETE', body?: any) => {
    try {
        const response = await authFetch(endpoint, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Falha na operação.');
        }
        await fetchData(); // Refresh data on success
        return true;
    } catch (e: any) {
        toast({ variant: 'destructive', title: "Erro na Operação", description: e.message });
        return false;
    }
  };

  const addTalent = async (data: Omit<Talent, 'id'>) => {
    const success = await apiAction('/api/talents', 'POST', data);
    if (success) toast({ title: 'Sucesso!', description: 'Talento adicionado.' });
    return success;
  };

  const updateTalent = async (id: string, data: Partial<Talent>) => {
     const success = await apiAction(`/api/talents/${id}`, 'PUT', data);
    if (success) toast({ title: 'Sucesso!', description: 'Talento atualizado.' });
    return success;
  };

  const deleteTalent = async (id: string) => {
    const success = await apiAction(`/api/talents/${id}`, 'DELETE');
    if (success) toast({ title: 'Sucesso!', description: 'Talento removido.' });
    return success;
  };


  if (authLoading || isLoading || !user || !user.talentsAccess) {
    return (
        <div className="flex h-full items-center justify-center">
             <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <main className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-start flex-wrap gap-4 mb-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-primary">Gerenciar Talentos</h1>
          <p className="text-muted-foreground text-sm">
            Cadastre, analise currículos e gerencie candidatos do seu banco de talentos.
          </p>
        </div>
        <BackButton href="/hr" label="Voltar para RH" className="mb-0 mt-2" />
      </div>
      
      <TalentManagement 
        talents={talents} 
        hiringTypes={hiringTypes}
        users={users}
        onAdd={addTalent}
        onUpdate={updateTalent}
        onDelete={deleteTalent}
        quickEditId={quickEditId}
        onQuickEditComplete={() => router.replace('/talents')}
      />
    </main>
  );
}

export default function ManageTalentsPage() {
    return (
        <Suspense fallback={<div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <ManageTalentsContent />
        </Suspense>
    );
}
