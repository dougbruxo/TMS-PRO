"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { ClientPartnerManagement } from '@/components/ClientPartnerManagement';
import { Loader2, Building2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

export default function ClientPartnersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    const isClienteGroup = user.role === 'cliente' || user.role === 'sub-cliente';
    const hasSubRolePermission = user.role === 'sub-cliente' ? user.subRole === 'ADM' : true;

    if (!isClienteGroup || !hasSubRolePermission || !user.clientPartnersAccess) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Prevent render if not allowed
  const isClienteGroup = user.role === 'cliente' || user.role === 'sub-cliente';
  const hasSubRolePermission = user.role === 'sub-cliente' ? user.subRole === 'ADM' : true;

  if (!isClienteGroup || !hasSubRolePermission || !user.clientPartnersAccess) {
    return null;
  }

  return (
    <main className="container mx-auto p-4 md:p-8 space-y-8">
      <PageHeader
        icon={<Building2 className="h-4 w-4" />}
        badge="Gestão de Parceiros"
        titlePrefix="Clientes e"
        titleHighlight="Fornecedores"
        description="Cadastre seus Principais Parceiros de Negócio para uso recorrente nas cotações."
      />

      <ClientPartnerManagement />
    </main>
  );
}
