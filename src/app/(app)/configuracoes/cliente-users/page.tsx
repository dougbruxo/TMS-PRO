"use client";

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { SubClientManagement } from '@/components/SubClientManagement';

export default function ClienteUsersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (user.role !== 'cliente' && user.role !== 'admin' && user.subRole !== 'ADM') {
        router.push('/dashboard');
      }
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Apenas donos e subs do tipo ADM enxergam a página de usuários
  if (user.role !== 'cliente' && user.role !== 'admin' && user.subRole !== 'ADM') {
    return null;
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary mb-2">Usuários da Conta</h1>
        <p className="text-muted-foreground">
          Crie contas de acesso para sua equipe de logística interna ou administrativa.
        </p>
      </div>

      <SubClientManagement />
    </div>
  );
}
