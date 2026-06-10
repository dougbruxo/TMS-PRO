
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { CompanyManagement } from '@/components/CompanyManagement';
import { Loader2, Building } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

export default function ManageCustomersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user || !user.settingsAccess) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  if (authLoading || !user || !user.settingsAccess) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="container mx-auto p-4 md:p-8">
      <PageHeader
        icon={<Building className="h-4 w-4" />}
        badge="Registros Mestres"
        titlePrefix="Cadastro de"
        titleHighlight="Clientes"
        description="Gerencie as empresas parceiras, clientes e suas configurações."
        backHref="/cadastros"
        backLabel="Voltar para Cadastros"
      />
      
      <CompanyManagement />
    </main>
  );
}
