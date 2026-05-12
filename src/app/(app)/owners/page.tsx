"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { OwnerManagement } from '@/components/OwnerManagement';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
      <Button variant="outline" onClick={() => router.push('/cadastros')} className="mb-8">
        &larr; Voltar para Cadastros
      </Button>
      <h1 className="text-3xl font-bold text-primary mb-8">Gerenciar Proprietários</h1>
      
      <OwnerManagement />
    </main>
  );
}
