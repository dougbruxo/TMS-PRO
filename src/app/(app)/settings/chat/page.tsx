"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HubUserManagement } from '@/components/chat/HubUserManagement';
import type { HubUser, User } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/api-client';
import { BackButton } from '@/components/BackButton';

export default function ManageChatHubsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [hubs, setHubs] = useState<HubUser[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [hubsRes, usersRes] = await Promise.all([
        authFetch('/api/chat/hubs'),
        authFetch('/api/users'),
      ]);
      if (!hubsRes.ok || !usersRes.ok) {
        throw new Error('Falha ao carregar dados do chat.');
      }
      setHubs(await hubsRes.json());
      setUsers(await usersRes.json());
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !user.settingsAccess) {
      router.push('/dashboard');
    } else {
      fetchData();
    }
  }, [user, authLoading, router, fetchData]);

  if (authLoading || isLoading) {
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
          <h1 className="text-3xl font-bold text-primary">Gerenciar Hubs de Comunicação</h1>
          <p className="text-muted-foreground">Configure os canais de chat e permissões de acesso dos operadores e clientes.</p>
        </div>
        <BackButton href="/settings" label="Voltar para Configurações" className="mb-0 mt-2" />
      </div>
      
      <HubUserManagement 
        hubs={hubs}
        allUsers={users}
        onDataMutated={fetchData}
      />
    </main>
  );
}
