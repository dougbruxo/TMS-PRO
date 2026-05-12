
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { UserManagement } from '@/components/UserManagement';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { User, ActivityRecord } from '@/lib/types';
import { authFetch } from '@/lib/api-client';

export default function ManageUsersPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [loginHistory, setLoginHistory] = useState<ActivityRecord[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);

  const fetchAllData = useCallback(async () => {
    setIsDataLoading(true);
    try {
      const [usersRes, historyRes] = await Promise.all([
        authFetch('/api/users'),
        authFetch('/api/history')
      ]);

      if (!usersRes.ok || !historyRes.ok) {
        throw new Error('Falha ao carregar dados dos usuários.');
      }

      setUsers(await usersRes.json());
      setLoginHistory(await historyRes.json());
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Erro de Carregamento',
        description: e.message,
      });
    } finally {
      setIsDataLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser || currentUser.role !== 'admin') {
      router.push('/dashboard');
      return;
    }
    fetchAllData();
  }, [currentUser, authLoading, router, fetchAllData]);

  if (authLoading || !currentUser) {
    return (
        <div className="flex h-full items-center justify-center">
             <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }
  
  return (
    <main className="container mx-auto p-4 md:p-8">
      <div className="flex items-center gap-4 mb-8">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => router.push('/settings')} 
          className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <div className="h-4 w-px bg-border hidden md:block" />
        <h1 className="text-xl font-bold text-primary whitespace-nowrap">Gerenciar Usuários</h1>
      </div>
      
      <UserManagement 
        users={users} 
        loginHistory={loginHistory} 
        onDataMutated={fetchAllData} 
        isLoading={isDataLoading}
      />
    </main>
  );
}
