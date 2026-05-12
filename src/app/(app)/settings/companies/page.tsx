
"use client";

import { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { CompanyProfileManagement } from '@/components/CompanyProfileManagement';
import { Loader2, Info, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import type { CompanyProfile } from '@/lib/types';
import { authFetch } from '@/lib/api-client';

function CompanyProfilePageContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [profiles, setProfiles] = useState<CompanyProfile[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  
  const isFirstLogin = useMemo(() => searchParams.get('first-login') === 'true', [searchParams]);

  const fetchProfiles = useCallback(async () => {
    setIsDataLoading(true);
    try {
      const response = await authFetch('/api/company-profile');
      if (!response.ok) {
        throw new Error('Falha ao carregar perfis da empresa.');
      }
      setProfiles(await response.json());
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro de Carregamento', description: e.message });
    } finally {
      setIsDataLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !user.settingsAccess) {
      router.push('/dashboard');
      return;
    }
    fetchProfiles();
  }, [user, authLoading, router, fetchProfiles]);

  if (authLoading || isDataLoading || !user || !user.settingsAccess) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="container mx-auto p-4 md:p-8">
      {!isFirstLogin ? (
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.push('/settings')} 
            className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <div className="h-4 w-px bg-border hidden md:block" />
          <h1 className="text-xl font-bold text-primary whitespace-nowrap">Dados da Empresa</h1>
        </div>
      ) : (
        <>
          <Alert className="mb-8 border-primary">
            <Info className="h-4 w-4" />
            <AlertTitle>Configuração Inicial Necessária</AlertTitle>
            <AlertDescription>
              Bem-vindo! Antes de começar, por favor, configure os dados da sua empresa. Estas informações serão usadas em todo o sistema.
            </AlertDescription>
          </Alert>
          <h1 className="text-3xl font-bold text-primary mb-8">Dados da Empresa</h1>
        </>
      )}
      
      <CompanyProfileManagement 
        profiles={profiles}
        onDataMutated={fetchProfiles}
        isFirstLogin={isFirstLogin}
      />
    </main>
  );
}

export default function ManageCompanyProfilesPage() {
    return (
        <Suspense fallback={<div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <CompanyProfilePageContent />
        </Suspense>
    )
}
