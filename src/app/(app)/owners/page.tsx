"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { OwnerManagement } from '@/components/OwnerManagement';
import { Loader2, Briefcase } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

export default function ManageOwnersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user || !user.driverManagementAccess) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);


  if (authLoading || !user || !user.driverManagementAccess) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="container mx-auto p-4 md:p-8">
      <PageHeader
        icon={<Briefcase className="h-4 w-4" />}
        badge="Registros Mestres"
        titlePrefix="Gerenciar"
        titleHighlight="Proprietários"
        description="Cadastre proprietários de veículos para vincular à frota."
        backHref="/cadastros"
        backLabel="Voltar para Cadastros"
      />
      
      <OwnerManagement />
    </main>
  );
}
