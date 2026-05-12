
"use client";

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { DriverManagement } from '@/components/DriverManagement';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
      <Button variant="outline" onClick={() => router.push('/cadastros')} className="mb-8">
        &larr; Voltar para Cadastros
      </Button>
      <h1 className="text-3xl font-bold text-primary mb-8">Gerenciar Motoristas</h1>
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
