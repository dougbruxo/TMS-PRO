
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, ArrowLeft, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VehicleManagement } from '@/components/VehicleManagement';
import type { Vehicle } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/PageHeader';

export default function ManageVehiclesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await authFetch('/api/vehicles');
      if (!res.ok) throw new Error('Falha ao buscar veículos.');
      setVehicles(await res.json());
    } catch(e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'admin' || !user.settingsAccess) {
      router.push('/dashboard');
    } else {
      fetchData();
    }
  }, [user, authLoading, router, fetchData]);

  if (authLoading || !user) {
    return (
        <div className="flex h-full items-center justify-center">
             <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
      <main className="container mx-auto p-4 md:p-8">
        <PageHeader
          icon={<Truck className="h-4 w-4" />}
          badge="Administração do Sistema"
          titlePrefix="Gerenciar"
          titleHighlight="Veículos"
          description="Adicione, edite ou remova tipos de veículos e suas especificações no sistema."
          backHref="/settings"
          backLabel="Voltar para Configurações"
        />
        
        <VehicleManagement vehicles={vehicles} onDataMutated={fetchData} isLoading={isLoading} />

      </main>
  );
}
