
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Manifest } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ManifestList } from '@/components/ManifestList';
import { authFetch } from '@/lib/api-client';

export default function LoadingManifestsPage() {
  const { user } = useAuth();
  const [manifests, setManifests] = useState<Manifest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();

  const fetchData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const response = await authFetch(`/api/driver-portal/data?driverId=${user.id}`);
      if (!response.ok) throw new Error('Falha ao carregar os dados.');
      const data = await response.json();
      setManifests((data.manifests || []).filter((m: Manifest) => m.status === 'Pendente'));
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [fetchData, user]);

  return (
    <div className="p-4 md:p-6 space-y-6">
       <Button variant="outline" onClick={() => router.push('/driver-portal/manifests')} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
      </Button>
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <ManifestList 
            title="Romaneios para Carregamento" 
            manifests={manifests} 
            emptyMessage="Nenhum romaneio em carregamento." 
            showPrintButton={false}
        />
      )}
    </div>
  );
}
