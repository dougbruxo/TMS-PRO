
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';

/**
 * Guard de isolamento de rotas do cliente.
 * 
 * Apenas usuários com role 'cliente' ou 'sub-cliente' podem acessar as rotas /cliente/*.
 * Usuários admin/user são redirecionados para o dashboard da transportadora.
 * Isso previne o bug onde um admin faz login após um cliente e herda a rota /cliente/dashboard
 * devido a uma race condition na navegação.
 */
export default function ClienteRouteGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) return; // O layout pai (app) já cuida de redirecionar para login

    const isClientRole = user.role === 'cliente' || user.role === 'sub-cliente';
    if (!isClientRole) {
      // Redirecionar para o dashboard correto da transportadora
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isClientRole = user.role === 'cliente' || user.role === 'sub-cliente';
  if (!isClientRole) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
