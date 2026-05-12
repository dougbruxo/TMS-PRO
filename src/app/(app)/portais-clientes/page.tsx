"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
      <Button variant="outline" onClick={() => router.push('/dashboard')} className="mb-8">
        &larr; Voltar para o Início
      </Button>
      
      <ClientPortalManagement />
    </main>
  );
}
