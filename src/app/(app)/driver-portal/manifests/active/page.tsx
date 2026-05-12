
"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, ArrowLeft, Upload, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Manifest, Quote } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ManifestList } from '@/components/ManifestList';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { authFetch } from '@/lib/api-client';

export default function ActiveManifestsPage() {
  const { user } = useAuth();
  const [manifests, setManifests] = useState<Manifest[]>([]);
  const [individualDeliveries, setIndividualDeliveries] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const response = await authFetch(`/api/driver-portal/data?driverId=${user.id}`);
      if (!response.ok) throw new Error('Falha ao carregar os dados.');
      const data = await response.json();
      setManifests((data.manifests || []).filter((m: Manifest) => m.status === 'Em Rota'));
      setIndividualDeliveries(data.individualDeliveries || []);
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

  const handleProofUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedQuoteId || !user) return;

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
      if(fileInputRef.current) fileInputRef.current.value = ''; // Reset file input
    }
  };
  
  const triggerUpload = (quoteId: string) => {
    setSelectedQuoteId(quoteId);
    fileInputRef.current?.click();
  };
  
  const handleFinalizeManifest = async (manifestId: string) => {
    setIsSubmitting(true);
    try {
        const response = await authFetch(`/api/manifests/${manifestId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Finalizado' }),
        });
        if (!response.ok) throw new Error('Falha ao finalizar o romaneio.');
        
        toast({ title: 'Romaneio Finalizado!', description: 'O romaneio foi movido para a aba de finalizados.' });
        await fetchData();

    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
        setIsSubmitting(false);
    }
  }

  const deliveryActionButton = (quote: Quote) => {
    const isDelivered = quote.status === 'Entregue' || !!quote.proofOfDeliveryUrl;
    return (
        <Button 
            size="sm" 
            className="w-full"
            variant={isDelivered ? 'secondary' : 'default'}
            onClick={() => !isDelivered && triggerUpload(quote.id)}
            disabled={isDelivered || isSubmitting}
        >
            {isSubmitting && selectedQuoteId === quote.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : (isDelivered ? <CheckCircle className="mr-2 h-4 w-4 text-green-500"/> : <Upload className="mr-2 h-4 w-4" />)}
            {isDelivered ? 'Entregue' : 'Dar Baixa'}
        </Button>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
       <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        onChange={handleProofUpload} 
        accept="image/*,.pdf"
      />
      <Button variant="outline" onClick={() => router.push('/driver-portal/manifests')} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
      </Button>

      {isLoading ? (
          <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <>
            {manifests.length > 0 && (
                <ManifestList 
                title="Romaneios Ativos" 
                manifests={manifests} 
                emptyMessage="Nenhum romaneio ativo."
                showPrintButton={false}
                actionButton={(quote, manifest) => {
                    const fullQuote = individualDeliveries.find(q => q.id === quote.quoteId) || quote;
                    return deliveryActionButton(fullQuote as Quote);
                }}
                footerButton={(manifest: Manifest) => {
                    const allQuotesDelivered = manifest.quotes.every(q => {
                        const fullQuote = individualDeliveries.find(d => d.id === q.quoteId) || q;
                        return fullQuote.status === 'Entregue' || !!fullQuote.proofOfDeliveryUrl;
                    });
                    if (!allQuotesDelivered) return null;

                    return (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button 
                                    className="w-full mt-2" 
                                    disabled={isSubmitting}
                                >
                                    <CheckCircle className="mr-2 h-4 w-4" /> Finalizar Romaneio
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Finalizar Romaneio?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Todas as entregas deste romaneio foram concluídas. Deseja finalizar o romaneio e movê-lo para o histórico de finalizados?
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleFinalizeManifest(manifest.id)} disabled={isSubmitting}>
                                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Confirmar'}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )
                }}
                />
            )}

            {individualDeliveries.length > 0 && (
                <ManifestList
                    title="Entregas Avulsas"
                    manifests={[{
                        id: 'individual-deliveries',
                        manifestCode: 'Entregas Individuais',
                        driverId: user.id,
                        driverName: user.username,
                        driverLicensePlate: '',
                        consultationNumber: '',
                        createdAt: new Date().toISOString(),
                        closedAt: null,
                        status: 'Em Rota',
                        quotes: individualDeliveries.map(q => ({
                            quoteId: q.id,
                            quoteCode: q.quoteCode || '',
                            destinatario: q.destinatario || q.empresaDestino,
                            cidadeDestino: q.cidadeDestino,
                            nfNumber: q.nfNumber || 'N/A',
                            nfeKey: '',
                            totalVolumes: q.volumeCount || 0,
                            scannedVolumes: 0,
                            scannedBarcodes: [],
                        }))
                    }]}
                    emptyMessage=''
                    showPrintButton={false}
                    actionButton={(quote) => {
                        const fullQuote = individualDeliveries.find(q => q.id === quote.quoteId);
                        return fullQuote ? deliveryActionButton(fullQuote) : null;
                    }}
                />
            )}

            {manifests.length === 0 && individualDeliveries.length === 0 && (
                <div className="text-center text-muted-foreground py-16 border rounded-lg">
                    <p>Nenhuma entrega ativa encontrada.</p>
                </div>
            )}
        </>
      )}
    </div>
  );
}
