"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Globe } from 'lucide-react';
import { BackButton } from '@/components/BackButton';
import { ClientPortalManagement } from '@/components/ClientPortalManagement';

export default function ManageClientPortalsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user || (user.role !== 'admin' && !user.clientPortalsAccess)) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  if (authLoading || !user || (user.role !== 'admin' && !user.clientPortalsAccess)) {
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
          <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
            <Globe className="h-8 w-8" /> Gestão de Portais B2B
          </h1>
          <p className="text-muted-foreground">Crie acessos para empresas clientes utilizarem os recursos de Cotação, Avisos e Rastreamento Externo (White-Label).</p>
        </div>
        <BackButton href="/dashboard" label="Voltar ao Painel" className="mb-0 mt-2" />
      </div>
      
      <ClientPortalManagement />
    </main>
  );
}
