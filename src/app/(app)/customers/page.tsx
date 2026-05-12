
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { CompanyManagement } from '@/components/CompanyManagement';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
      <Button variant="outline" onClick={() => router.push('/cadastros')} className="mb-8">
        &larr; Voltar para Cadastros
      </Button>
      <h1 className="text-3xl font-bold text-primary mb-8">Cadastro de Clientes</h1>
      
      <CompanyManagement />
    </main>
  );
}
