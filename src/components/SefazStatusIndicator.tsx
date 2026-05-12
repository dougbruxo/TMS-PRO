"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { ServerCrash, Server, Loader2, AlertTriangle, Activity } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

interface SefazStatus {
  online: boolean;
  cStat?: string;
  xMotivo?: string;
  ambiente?: string;
  uf?: string;
  message?: string;
}

export function SefazStatusIndicator() {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const { data: status, isLoading, isError, error, refetch, isFetching } = useQuery<SefazStatus>({
    queryKey: ['sefaz-status'],
    queryFn: async () => {
      const token = localStorage.getItem('sessionToken');
      const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await authFetch('/api/sefaz/status', { headers });
      if (!res.ok) {
        throw new Error('Falha ao consultar SEFAZ');
      }
      return res.json();
    },
    enabled: false, // Só consulta sob demanda
    retry: 0
  });

  const handleTestConnection = async () => {
    toast({ title: 'Consultando SEFAZ', description: 'Aguarde, testando conexão com a SEFAZ...' });
    const result = await refetch();
    if (result.isError) {
      toast({ title: 'Erro', description: 'Erro de comunicação com o servidor local.', variant: 'destructive' });
    } else if (result.data) {
      if (result.data.online) {
        toast({ title: 'SEFAZ Online', description: result.data.message || 'Operando normalmente.' });
      } else {
        toast({ title: 'SEFAZ Inoperante', description: result.data.message || 'Serviço temporariamente indisponível.', variant: 'destructive' });
      }
    }
  };

  if (!user || user.role === 'driver' || user.role === 'cliente' || user.role === 'sub-cliente') {
    return null;
  }

  return (
    <Button 
      variant="outline" 
      onClick={handleTestConnection} 
      disabled={isFetching}
      className="flex items-center gap-2 bg-background/50 hover:bg-background/80"
    >
      {isFetching ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : isError ? (
         <AlertTriangle className="h-4 w-4 text-amber-500" />
      ) : status?.online ? (
        <Server className="h-4 w-4 text-green-500" />
      ) : status && !status.online ? (
        <ServerCrash className="h-4 w-4 text-red-500" />
      ) : (
        <Activity className="h-4 w-4 text-primary" />
      )}
      Testar Conexão SEFAZ
    </Button>
  );
}
