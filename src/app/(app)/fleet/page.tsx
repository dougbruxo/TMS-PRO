
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { FleetManagement } from '@/components/FleetManagement';
import { Loader2, Truck } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

export default function ManageFleetPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user || !user.driverManagementAccess) {
      router.push('/dashboard');
      return;
    }
  }, [user, authLoading, router]);

  if (authLoading || !user) {
    return (
        <div className="flex h-full items-center justify-center">
             <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
      <main className="container mx-auto p-4 md:p-8">
        <PageHeader
          icon={<Truck className="h-4 w-4" />}
          badge="Registros Mestres"
          titlePrefix="Gerenciar"
          titleHighlight="Frota"
          description="Cadastre e gerencie os veículos da sua frota e agregados."
          backHref="/cadastros"
          backLabel="Voltar para Cadastros"
        />
        
        <FleetManagement />

      </main>
  );
}
