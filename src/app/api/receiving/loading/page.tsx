
"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Truck, ScanLine, CheckCircle, Package, Printer } from 'lucide-react';
import type { Manifest, Driver } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { printLoadingManifest } from '@/lib/print';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";


export default function LoadingManagementPage() {
  const { user, loading: authLoading, companyProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [manifests, setManifests] = useState<Manifest[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  
  const [selectedManifest, setSelectedManifest] = useState<Manifest | null>(null);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [scannedBarcodes, setScannedBarcodes] = useState<Record<string, string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const fetchAllData = useCallback(async () => {
    setIsDataLoading(true);
    try {
        const [manifestsRes, driversRes] = await Promise.all([
            fetch('/api/manifests'),
            fetch('/api/drivers?limit=10000'),
        ]);
        if (!manifestsRes.ok || !driversRes.ok) throw new Error('Falha ao carregar dados.');
        
        setManifests(await manifestsRes.json());
        setDrivers(await driversRes.json());

    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Erro de Carregamento', description: error.message });
    } finally {
        setIsDataLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
      if (!authLoading && user?.receivingAccess) {
          fetchAllData();
      }
  }, [user, authLoading, fetchAllData]);
  
  const pendingManifests = useMemo(() => {
    return manifests.filter(m => m.status === 'Pendente');
  }, [manifests]);
  
  const handleOpenManageDialog = (manifest: Manifest) => {
    setSelectedManifest(manifest);
    const initialScans: Record<string, string[]> = {};
    manifest.quotes.forEach(q => {
        initialScans[q.quoteId] = q.scannedBarcodes || [];
    });
    setScannedBarcodes(initialScans);
    setIsManageOpen(true);
  };
  
    const handleBarcodeScan = (quoteId: string, barcode: string) => {
        if (!barcode.trim() || !selectedManifest) return;
        
        const quote = selectedManifest.quotes.find(q => q.quoteId === quoteId);
        if (!quote || !quote.nfNumber) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Cotação ou número de NF não encontrado para a leitura.' });
            return;
        }

        const expectedPrefix = `${quote.nfNumber}-`;
        if (!barcode.startsWith(expectedPrefix)) {
            toast({ variant: 'destructive', title: 'Código Inválido', description: `O código de barras deve iniciar com o N° da NF: ${quote.nfNumber}` });
            return;
        }

        const volumeNumberStr = barcode.substring(expectedPrefix.length);
        const volumeNumber = parseInt(volumeNumberStr, 10);
        if (isNaN(volumeNumber) || volumeNumber < 1 || volumeNumber > quote.totalVolumes) {
            toast({ variant: 'destructive', title: 'Volume Inválido', description: `O número do volume "${volumeNumberStr}" não é válido para esta cotação.` });
            return;
        }

        setScannedBarcodes(prev => {
            const currentScans = prev[quoteId] || [];
            if (currentScans.includes(barcode)) {
                toast({ variant: 'default', title: 'Duplicado', description: `O volume ${volumeNumber} já foi lido.` });
                return prev;
            }
            if (currentScans.length >= quote.totalVolumes) {
                toast({ variant: 'destructive', title: 'Excesso de Volumes', description: 'Todos os volumes desta cotação já foram lidos.' });
                return prev;
            }
            return { ...prev, [quoteId]: [...currentScans, barcode] };
        });
    };

  const handleFinalizeLoading = async () => {
    if (!selectedManifest) return;

    let allVolumesScanned = true;
    for (const quote of selectedManifest.quotes) {
        const scannedCount = scannedBarcodes[quote.quoteId]?.length || 0;
        if (scannedCount !== quote.totalVolumes) {
            allVolumesScanned = false;
            break;
        }
    }

    if (!allVolumesScanned) {
        toast({ variant: 'destructive', title: 'Volumes Pendentes', description: 'Ainda há volumes pendentes de leitura para uma ou mais cotações.' });
        return;
    }

    setIsSubmitting(true);
    try {
        const updatedQuotesPayload = selectedManifest.quotes.map(q => ({
            ...q,
            scannedVolumes: scannedBarcodes[q.quoteId].length,
            scannedBarcodes: scannedBarcodes[q.quoteId],
        }));

        const response = await fetch(`/api/manifests/${selectedManifest.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Em Rota', quotes: updatedQuotesPayload }),
        });

        if (response.ok) {
            toast({ title: 'Sucesso!', description: 'Carregamento finalizado e romaneio pronto para impressão.' });
            const updatedManifest = { ...selectedManifest, status: 'Em Rota', quotes: updatedQuotesPayload } as Manifest;
            if(companyProfile) {
                printLoadingManifest(updatedManifest, companyProfile);
            }
            setIsManageOpen(false);
            await fetchAllData();
        } else {
            throw new Error('Falha ao finalizar o carregamento.');
        }

    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
        setIsSubmitting(false);
    }
  };


  if (isDataLoading || authLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  return (
    <main className="container mx-auto p-4 md:p-8">
        <Button variant="outline" onClick={() => router.push('/receiving')} className="mb-8">
          &larr; Voltar para a Área de Recebimento
        </Button>
        <h1 className="text-3xl font-bold text-primary mb-2">Gerenciar Carregamento</h1>
        <p className="text-muted-foreground mb-8">Confirme o carregamento dos volumes para os romaneios pendentes.</p>
        
        {pendingManifests.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pendingManifests.map(manifest => {
                    const totalVolumes = manifest.quotes.reduce((acc, q) => acc + q.totalVolumes, 0);
                    return (
                        <Card key={manifest.id} className="flex flex-col">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-3">
                                    <Truck className="h-6 w-6 text-primary" />
                                    {manifest.manifestCode}
                                </CardTitle>
                                <CardDescription>
                                    Motorista: {manifest.driverName} | Placa: {manifest.driverLicensePlate}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex-grow">
                                <Badge>Cotações: {manifest.quotes.length}</Badge>
                                <Badge variant="secondary" className="ml-2">Volumes: {totalVolumes}</Badge>
                            </CardContent>
                            <CardFooter>
                                <Button className="w-full" onClick={() => handleOpenManageDialog(manifest)}>
                                    <ScanLine className="mr-2 h-4 w-4" /> Gerenciar Carregamento
                                </Button>
                            </CardFooter>
                        </Card>
                    );
                })}
            </div>
        ) : (
            <div className="text-center py-16 border-dashed border-2 rounded-lg">
                <p className="text-muted-foreground">Nenhum romaneio pendente para carregamento.</p>
            </div>
        )}
        
        {selectedManifest && (
             <Dialog open={isManageOpen} onOpenChange={setIsManageOpen}>
                <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Gerenciar Carregamento: {selectedManifest.manifestCode}</DialogTitle>
                        <DialogDescription>
                            Faça a leitura dos códigos de barras de cada volume. O formato esperado é <span className="font-mono">NF-VOLUME</span> (ex: 12345-1).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-grow overflow-y-auto pr-4 space-y-4">
                        {selectedManifest.quotes.map(quote => {
                            const scannedCount = scannedBarcodes[quote.quoteId]?.length || 0;
                            const isComplete = scannedCount === quote.totalVolumes;
                            return (
                                <div key={quote.quoteId} className="border rounded-lg p-4 space-y-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold">{quote.destinatario}</p>
                                            <p className="text-sm text-muted-foreground">{quote.cidadeDestino} | NF: {quote.nfNumber}</p>
                                        </div>
                                        <Badge variant={isComplete ? 'default' : 'secondary'} className={isComplete ? 'bg-green-600' : ''}>
                                            <Package className="mr-2 h-4 w-4"/> {scannedCount} / {quote.totalVolumes}
                                        </Badge>
                                    </div>
                                    <form onSubmit={(e) => { e.preventDefault(); handleBarcodeScan(quote.quoteId, (e.target as any).elements.barcode.value); (e.target as any).elements.barcode.value = ''; }}>
                                        <Input
                                          name="barcode"
                                          placeholder="Ler código de barras do volume..."
                                          autoFocus={quote.quoteId === selectedManifest.quotes[0].quoteId}
                                          disabled={isComplete}
                                        />
                                    </form>
                                </div>
                            )
                        })}
                    </div>
                     <DialogFooter>
                        <DialogClose asChild><Button variant="secondary" disabled={isSubmitting}>Cancelar</Button></DialogClose>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button disabled={isSubmitting}>
                                    <CheckCircle className="mr-2 h-4 w-4" /> Finalizar e Imprimir
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Finalizar Carregamento?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Isto irá marcar o romaneio como "Em Rota" e mover todas as cotações para a próxima etapa. Confirma?
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleFinalizeLoading} disabled={isSubmitting}>
                                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Confirmar'}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </DialogFooter>
                </DialogContent>
             </Dialog>
        )}
    </main>
  );
}
