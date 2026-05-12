"use client";

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { FleetOptionsManager } from '@/components/FleetOptionsManager';
import { Loader2 } from 'lucide-react';

const optionTypesMap: Record<string, string> = {
  brands: 'Marcas',
  models: 'Modelos',
  colors: 'Cores',
  bodyTypes: 'Tipos de Carroceria',
  anttCategories: 'Categorias ANTT',
  vehicleTypes: 'Tipo de Veículo',
};

export default function FleetOptionTypePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const type = params.type as string;
  const name = optionTypesMap[type];

  useEffect(() => {
    if (!authLoading && !user?.settingsAccess) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  if (!name) {
    if (typeof window !== 'undefined') {
        router.push('/settings/fleet-options');
    }
    return null;
  }
  
  if (authLoading || !user) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="container mx-auto p-4 md:p-8">
      <Button variant="outline" onClick={() => router.push('/settings/fleet-options')} className="mb-8">
        &larr; Voltar para Opções da Frota
      </Button>
      
      <FleetOptionsManager optionType={type} optionName={name} />
    </main>
  );
}
