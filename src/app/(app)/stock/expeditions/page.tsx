"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BackButton } from '@/components/BackButton';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/api-client';
import { ExpeditionManagement } from '@/components/ExpeditionManagement';
import type { ExpeditionRequest } from '@/lib/types';

export default function AdministrativeExpeditionsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    
    const [requests, setRequests] = useState<ExpeditionRequest[]>([]);
    const [isDataLoading, setIsDataLoading] = useState(true);

    const fetchRequests = async () => {
        setIsDataLoading(true);
        try {
            const res = await authFetch('/api/expeditions');
            if (res.ok) {
                const data = await res.json();
                setRequests(data);
            } else {
                throw new Error('Falha ao obter requisições');
            }
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Erro', description: error.message });
        } finally {
            setIsDataLoading(false);
        }
    };

    useEffect(() => {
        if (authLoading) return;
        if (!user || (!user.stockAccess && user.role !== 'admin')) {
            router.push('/dashboard');
            return;
        }
        fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, authLoading, router]);

    if(authLoading || (!requests.length && isDataLoading)) {
         return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <main className="container mx-auto p-4 md:p-8">
            <div className="flex justify-between items-start flex-wrap gap-4 mb-8">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold text-primary">Pedidos de Expedição</h1>
                    <p className="text-muted-foreground text-sm">Realize a separação de carga para clientes (Fulfillment).</p>
                </div>
                <BackButton href="/stock" label="Voltar para Estoque" className="mb-0 mt-2" />
            </div>

            <ExpeditionManagement 
                requests={requests}
                isLoading={isDataLoading}
                onDataMutated={fetchRequests}
            />
        </main>
    );
}
