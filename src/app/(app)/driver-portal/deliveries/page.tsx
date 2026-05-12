
"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, ArrowLeft, Upload, CheckCircle, Package, Camera, Image as ImageIcon, Warehouse } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Manifest, Quote } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { authFetch } from '@/lib/api-client';

type DeliveryItem = {
    id: string;
    destinatario: string;
    cidadeDestino: string;
    enderecoEntrega?: string;
    nfNumber: string;
    totalVolumes: number;
    status: Quote['status'];
    proofOfDeliveryUrl?: string;
    isDelivered: boolean;
    manifestCode?: string;
};

export default function DeliveriesPage() {
  const { user, companyProfile, loading: authLoading } = useAuth();
  const [allDeliveries, setAllDeliveries] = useState<DeliveryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [isUploadChoiceOpen, setIsUploadChoiceOpen] = useState(false);
  const [quoteToConfirmWarehouse, setQuoteToConfirmWarehouse] = useState<DeliveryItem | null>(null);


  const fetchData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const response = await authFetch(`/api/driver-portal/data?driverId=${user.id}`);
      if (!response.ok) throw new Error('Falha ao carregar os dados.');
      const data = await response.json();
      
      const deliveriesFromManifests: DeliveryItem[] = (data.manifests || [])
        .filter((m: Manifest) => m.status === 'Em Rota')
        .flatMap((m: Manifest) => m.quotes.map(q => ({
            id: q.quoteId,
            destinatario: q.destinatario,
            cidadeDestino: q.cidadeDestino,
            enderecoEntrega: q.enderecoEntrega,
            nfNumber: q.nfNumber,
            totalVolumes: q.totalVolumes,
            status: q.status,
            proofOfDeliveryUrl: q.proofOfDeliveryUrl,
            isDelivered: q.status === 'Entregue' || !!q.proofOfDeliveryUrl,
            manifestCode: m.manifestCode,
        })));
        
      const individualDeliveries: DeliveryItem[] = (data.individualDeliveries || []).map((q: Quote) => {
        const isDeliveryToWarehouse = q.status === 'Aguardando Recebimento';
        return {
          id: q.id,
          destinatario: isDeliveryToWarehouse ? (companyProfile?.razaoSocial || 'Galpão DezLog') : (q.destinatario || q.empresaDestino),
          cidadeDestino: isDeliveryToWarehouse ? (companyProfile?.cidade || 'N/A') : q.cidadeDestino,
          enderecoEntrega: isDeliveryToWarehouse ? (companyProfile?.endereco || 'Endereço do Galpão') : q.enderecoEntrega,
          nfNumber: q.nfNumber || 'N/A',
          totalVolumes: q.volumeCount || 0,
          status: q.status,
          proofOfDeliveryUrl: q.proofOfDeliveryUrl,
          isDelivered: q.status === 'Entregue' || !!q.proofOfDeliveryUrl,
        }
      });

      setAllDeliveries([...deliveriesFromManifests, ...individualDeliveries]);

    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast, companyProfile]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [fetchData, user]);

  const uploadProof = async (file: File | null | undefined) => {
    if (!file || !selectedQuoteId || !user) return;

    setIsUploadChoiceOpen(false);
    setIsSubmitting(true);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('user', JSON.stringify(user));

    try {
      const response = await authFetch(`/api/quotes/${selectedQuoteId}/upload-proof`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha no upload do comprovativo.');
      }
      
      toast({ title: 'Sucesso!', description: 'Comprovativo de entrega anexado e status atualizado.' });
      await fetchData(); // Refresh data
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro de Upload', description: e.message });
    } finally {
      setIsSubmitting(false);
      setSelectedQuoteId(null);
      // Reset file inputs
      if(cameraInputRef.current) cameraInputRef.current.value = '';
      if(galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    uploadProof(event.target.files?.[0]);
  };
  
  const triggerUploadChoice = (quoteId: string) => {
    setSelectedQuoteId(quoteId);
    setIsUploadChoiceOpen(true);
  };
  
  const handleConfirmWarehouseDelivery = async () => {
    if (!quoteToConfirmWarehouse || !user) return;
    setIsSubmitting(true);
    try {
        const response = await authFetch(`/api/quotes/${quoteToConfirmWarehouse.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'Entregue no Galpão',
                user,
                operationalEvent: {
                    action: 'CHEGADA_GALPAO_CONFIRMADA',
                    details: 'Motorista confirmou a chegada no galpão para entrega da carga.',
                    status: 'Entregue no Galpão'
                }
            }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Falha ao confirmar entrega no galpão.');
        }
        toast({ title: 'Sucesso!', description: 'Chegada no galpão confirmada. A equipe de recebimento foi notificada.' });
        await fetchData(); // Refresh list
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
        setIsSubmitting(false);
        setQuoteToConfirmWarehouse(null);
    }
  };
  
  const deliveryActionButton = (delivery: DeliveryItem) => {
    if (delivery.status === 'Aguardando Recebimento') {
      return (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              size="sm"
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={() => setQuoteToConfirmWarehouse(delivery)}
              disabled={isSubmitting}
            >
              <Warehouse className="mr-2 h-4 w-4" />
              Confirmar Entrega no Galpão
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Entrega no Galpão?</AlertDialogTitle>
              <AlertDialogDescription>
                Isto irá notificar a equipe de recebimento que você chegou para descarregar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmWarehouseDelivery} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Confirmar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );
    }

    return (
        <Button 
            size="sm" 
            className="w-full"
            variant={delivery.isDelivered ? 'secondary' : 'default'}
            onClick={() => !delivery.isDelivered && triggerUploadChoice(delivery.id)}
            disabled={delivery.isDelivered || isSubmitting}
        >
            {isSubmitting && selectedQuoteId === delivery.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : (delivery.isDelivered ? <CheckCircle className="mr-2 h-4 w-4 text-green-500"/> : <Upload className="mr-2 h-4 w-4" />)}
            {delivery.isDelivered ? 'Entregue' : 'Dar Baixa'}
        </Button>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <input 
        type="file" 
        ref={cameraInputRef} 
        className="hidden" 
        onChange={handleFileSelection} 
        accept="image/*"
        capture="environment"
      />
      <input 
        type="file" 
        ref={galleryInputRef} 
        className="hidden" 
        onChange={handleFileSelection} 
        accept="image/*,.pdf"
      />

      <Button variant="outline" onClick={() => router.push('/driver-portal')} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para o Portal
      </Button>

       <Card>
        <CardHeader>
          <CardTitle>Minhas Entregas Ativas</CardTitle>
          <CardDescription>
            Todas as suas entregas que estão atualmente em rota.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : allDeliveries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma entrega ativa encontrada.</p>
          ) : (
             <div className="space-y-3">
                {allDeliveries.map(delivery => (
                    <div key={delivery.id} className="flex flex-col p-3 border rounded-md space-y-3">
                        <div className="w-full">
                           {deliveryActionButton(delivery)}
                        </div>
                        <div>
                            <p className="font-semibold">{delivery.destinatario}</p>
                            <p className="text-sm text-muted-foreground">{delivery.enderecoEntrega || delivery.cidadeDestino}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary"><Package className="h-3 w-3 mr-1" /> {delivery.totalVolumes} vol.</Badge>
                            <Badge variant="outline">NF: {delivery.nfNumber}</Badge>
                            {delivery.manifestCode && <Badge variant="outline" className='bg-blue-500/10 border-blue-500/50 text-blue-800 dark:text-blue-300'>{delivery.manifestCode}</Badge>}
                        </div>
                    </div>
                ))}
             </div>
          )}
        </CardContent>
      </Card>
      
       <Dialog open={isUploadChoiceOpen} onOpenChange={setIsUploadChoiceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anexar Comprovativo de Entrega</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-6">
            <Button
              variant="outline"
              className="h-24 flex-col gap-2"
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera className="h-8 w-8" />
              <span>Abrir Câmera</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex-col gap-2"
              onClick={() => galleryInputRef.current?.click()}
            >
              <ImageIcon className="h-8 w-8" />
              <span>Galeria de Ficheiros</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
