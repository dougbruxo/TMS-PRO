"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, ArrowLeft, CheckCircle, Package, ArrowRight, Warehouse, PackageCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Quote, OperationalEvent } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { authFetch } from '@/lib/api-client';

type CollectionItem = {
    id: string;
    remetente: string;
    cidadeOrigem: string;
    enderecoColeta?: string;
    cidadeDestino: string;
    enderecoEntrega?: string;
    nfNumber: string;
    totalVolumes: number;
    isCollected: boolean;
    quoteCode: string;
    lastAction?: string; // New field to determine next step
};

export default function CollectionsPage() {
  const { user, companyProfile, loading: authLoading } = useAuth();
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quoteToConfirm, setQuoteToConfirm] = useState<CollectionItem | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const response = await authFetch(`/api/driver-portal/data?driverId=${user.id}`);
      if (!response.ok) throw new Error('Falha ao carregar os dados.');
      const data = await response.json();
      
      const collectionsFromApi: CollectionItem[] = (data.collections || []).map((q: Quote & { lastAction?: string }) => ({
        id: q.id,
        remetente: q.remetente,
        cidadeOrigem: q.cidadeOrigem,
        cidadeDestino: q.cidadeDestino,
        enderecoColeta: q.enderecoColeta,
        enderecoEntrega: q.enderecoEntrega,
        nfNumber: q.nfNumber || 'N/A',
        totalVolumes: q.volumeCount || q.quantidade || 0,
        isCollected: q.status !== 'Coleta',
        quoteCode: q.quoteCode || 'S/C',
        lastAction: q.lastAction,
      }));

      setCollections(collectionsFromApi);

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

  const handleConfirmCollection = async () => {
    if (!quoteToConfirm || !user) return;

    setIsSubmitting(true);

    const isDirectDelivery = quoteToConfirm.lastAction === 'COLETA_PARA_ENTREGA_DIRETA';
    const nextStatus = isDirectDelivery ? 'Em Rota' : 'Aguardando Recebimento';
    const eventDetails = isDirectDelivery 
        ? 'Carga coletada pelo motorista para entrega direta ao destino.'
        : 'Carga coletada pelo motorista e a caminho do galpão.';

    const operationalEvent: Partial<OperationalEvent> = {
        action: 'COLETA_REALIZADA',
        details: eventDetails,
        status: nextStatus,
        driverId: user.id,
        driverName: user.username,
    };
    const body = { status: nextStatus, user, operationalEvent };

    try {
        const response = await authFetch(`/api/quotes/${quoteToConfirm.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Falha ao confirmar a coleta.');
        }
        
        if (isDirectDelivery) {
            toast({ title: 'Coleta Confirmada!', description: 'A carga agora está em suas entregas ativas.' });
        } else {
            toast({ title: 'Sucesso!', description: 'Coleta confirmada. A carga está a caminho do galpão.' });
        }
        await fetchData(); // Refresh list
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
        setIsSubmitting(false);
        setQuoteToConfirm(null);
    }
  };

  const collectionActionButton = (collection: CollectionItem) => {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
           <Button 
                size="sm" 
                className="w-full"
                variant={collection.isCollected ? 'secondary' : 'default'}
                onClick={() => !collection.isCollected && setQuoteToConfirm(collection)}
                disabled={collection.isCollected || isSubmitting}
            >
                {collection.isCollected ? <CheckCircle className="mr-2 h-4 w-4 text-green-500"/> : <CheckCircle className="mr-2 h-4 w-4" />}
                {collection.isCollected ? 'Coletado' : 'Confirmar Coleta'}
            </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Confirmar Coleta?</AlertDialogTitle>
                <AlertDialogDescription>
                    Você confirma que a carga da cotação {quoteToConfirm?.quoteCode} foi coletada com sucesso?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmCollection} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Confirmar'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <Button variant="outline" onClick={() => router.push('/driver-portal')} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para o Portal
      </Button>

       <Card>
        <CardHeader>
          <CardTitle>Minhas Coletas Ativas</CardTitle>
          <CardDescription>
            Cargas pendentes de coleta. Após confirmar, elas seguirão para o próximo destino.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : collections.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma coleta ativa encontrada.</p>
          ) : (
             <div className="space-y-3">
                {collections.map(collection => {
                    const isDirectDelivery = collection.lastAction === 'COLETA_PARA_ENTREGA_DIRETA';
                    const destination = isDirectDelivery ? (collection.enderecoEntrega || collection.cidadeDestino) : companyProfile?.cidade;
                    const destinationIcon = isDirectDelivery ? <PackageCheck className="h-3 w-3" /> : <Warehouse className="h-3 w-3" />;

                    return (
                        <div key={collection.id} className="flex flex-col p-3 border rounded-md space-y-3">
                            <div className="w-full">
                              {collectionActionButton(collection)}
                            </div>
                            <div>
                                <p className="font-semibold">{collection.remetente}</p>
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                    {collection.enderecoColeta || collection.cidadeOrigem} <ArrowRight className="h-3 w-3"/> {destinationIcon} {destination}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary"><Package className="h-3 w-3 mr-1" /> {collection.totalVolumes} vol.</Badge>
                                <Badge variant="outline">NF: {collection.nfNumber}</Badge>
                                <Badge variant="outline" className='bg-blue-500/10 border-blue-500/50 text-blue-800 dark:text-blue-300'>{collection.quoteCode}</Badge>
                            </div>
                        </div>
                    )
                })}
             </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
