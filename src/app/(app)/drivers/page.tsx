
"use client";

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { DriverManagement } from '@/components/DriverManagement';
import { Loader2, UserSearch } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

function ManageDriversContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const quickEditId = searchParams.get('quickEdit') || undefined;

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
        icon={<UserSearch className="h-4 w-4" />}
        badge="Registros Mestres"
        titlePrefix="Gerenciar"
        titleHighlight="Motoristas"
        description="Adicione, edite ou remova motoristas e gerencie seus acessos."
        backHref="/cadastros"
        backLabel="Voltar para Cadastros"
      />
      <DriverManagement 
        quickEditId={quickEditId} 
        onQuickEditComplete={() => {
          if (typeof window !== 'undefined') {
            window.history.replaceState(null, '', '/drivers');
          }
        }} 
      />
    </main>
  );
}

export default function ManageDriversPage() {
    return (
        <Suspense fallback={<div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <ManageDriversContent />
        </Suspense>
    );
}
