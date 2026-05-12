"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { StoragePricingManagement } from '@/components/StoragePricingManagement';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function StoragePricingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (authLoading) return;

    if (!user || user.role !== 'admin' || !user.settingsAccess) {
      toast({
        variant: "destructive",
        title: "Acesso Negado",
        description: "Você não tem permissão para acessar esta página.",
      });
      router.push('/dashboard');
    }
  }, [user, authLoading, router, toast]);

  if (authLoading || !user || user.role !== 'admin' || !user.settingsAccess) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6">
      <StoragePricingManagement />
    </div>
  );
}
