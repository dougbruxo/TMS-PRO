"use client";

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { authFetch } from '@/lib/api-client';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function SupportLockBanner() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  
  const [data, setData] = useState<{ hasPending: boolean, isLocked: boolean, pendingCount: number } | null>(null);

  const checkPending = useCallback(async () => {
    if (!user || (user.role !== 'user' && user.role !== 'admin')) return;
    try {
      const res = await authFetch('/api/quotes/support-pending');
      if (res.ok) {
        setData(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  }, [user]);

  useEffect(() => {
    checkPending();
    const interval = setInterval(checkPending, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [checkPending]);

  if (!data?.hasPending) return null;

  // Se já estivermos na tela de análise, o aviso é menos invasivo
  const isAnalisePage = pathname.includes('/quotes/analise');

  return (
    <div className={`w-full flex items-center justify-between px-4 py-2 border-b text-sm ${
      data.isLocked ? 'bg-red-600 text-white border-red-700 font-medium' : 'bg-amber-100 text-amber-900 border-amber-300'
    }`}>
      <div className="flex items-center gap-3">
        <AlertTriangle className={`h-5 w-5 ${data.isLocked ? 'text-white translate-y-[-1px] animate-pulse' : 'text-amber-600'}`} />
        <div>
          {data.isLocked ? (
            <span>
              <strong>ATENÇÃO (Suporte Dedicado):</strong> Você tem <strong>{data.pendingCount}</strong> cotação(ões) do seu cliente aguardando aprovação. <br className="md:hidden" />
              Por favor, priorize esta análise para não travar o cliente.
            </span>
          ) : (
            <span>
              <strong>Pendências B2B:</strong> Existem {data.pendingCount} cotação(ões) de clientes aguardando análise e aprovação.
            </span>
          )}
        </div>
      </div>
      {!isAnalisePage && (
        <Button 
          variant={data.isLocked ? "secondary" : "default"} 
          size="sm" 
          onClick={() => router.push('/quotes/analise')}
          className="ml-4 flex-shrink-0"
        >
          Resolver Agora <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
