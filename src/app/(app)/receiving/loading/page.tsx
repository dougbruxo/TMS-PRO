"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Truck, ScanLine, CheckCircle, Package, Printer, ListTodo } from 'lucide-react';
import type { Manifest, Driver, Quote } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { printLoadingManifest } from '@/lib/print';
import { PageHeader } from '@/components/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { authFetch } from '@/lib/api-client';

const getQuoteCode = (quote: Quote) => quote.quoteCode || `LEGACY-${quote.id.slice(0, 5)}`;

export default function LoadingManagementPage() {
  const { user, loading: authLoading, companyProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [manifests, setManifests] = useState<Manifest[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const searchParams = useSearchParams();
  const quoteCodeFilter = searchParams.get('quoteCode');
  
  const [selectedManifest, setSelectedManifest] = useState<Manifest | null>(null);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [scannedBarcodes, setScannedBarcodes] = useState<Record<string, string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isRemainingVolumesOpen, setIsRemainingVolumesOpen] = useState(false);

  // Estados para bipagem de cotações individuais
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [isQuoteManageOpen, setIsQuoteManageOpen] = useState(false);
  const [scannedQuoteBarcodes, setScannedQuoteBarcodes] = useState<string[]>([]);
  const [isQuoteRemainingVolumesOpen, setIsQuoteRemainingVolumesOpen] = useState(false);

  const fetchAllData = useCallback(async () => {
    setIsDataLoading(true);
    try {
        const [manifestsRes, driversRes, quotesRes] = await Promise.all([
            authFetch('/api/manifests'),
            authFetch('/api/drivers?limit=10000'),
            authFetch('/api/quotes?limit=10000'),
        ]);
        if (!manifestsRes.ok || !driversRes.ok || !quotesRes.ok) throw new Error('Falha ao carregar dados.');
        
        setManifests(await manifestsRes.json());
        setDrivers(await driversRes.json());
        setQuotes(await quotesRes.json());

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

  // Scroll automático para a cotação destacada via pesquisa
  useEffect(() => {
      if (!isDataLoading && quoteCodeFilter) {
          const el = document.getElementById(`quote-card-${quoteCodeFilter}`);
          if (el) {
              setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
          }
      }
  }, [isDataLoading, quoteCodeFilter]);
  
  const getQuoteDriverInfo = (quote: Quote) => {
    if (!quote.driverId) return null;
    const driver = drivers.find(d => d.id === quote.driverId);
    return {
      name: quote.driverName || driver?.name || 'Não atribuído',
      licensePlate: driver?.licensePlate || 'N/A'
    };
  };

  const pendingManifests = useMemo(() => {
    return manifests.filter(m => m.status === 'Pendente');
  }, [manifests]);

  const pendingQuotes = useMemo(() => {
    // Cotações avulsas são as que estão no status "Aguardando Saída" e não pertencem a nenhum romaneio em carregamento/andamento.
    // Como romaneios pendentes bloqueiam cotações, as cotações em romaneios assumem "Em Carregamento".
    // Portanto, qualquer cotação que permaneça com "Aguardando Saída" é considerada avulsa para saída direta.
    return quotes.filter(q => q.status === 'Aguardando Saída');
  }, [quotes]);
  
  const handleOpenManageDialog = (manifest: Manifest) => {
    setSelectedManifest(manifest);
    const initialScans: Record<string, string[]> = {};
    manifest.quotes.forEach(q => {
        initialScans[q.quoteId] = q.scannedBarcodes || [];
    });
    setScannedBarcodes(initialScans);
    setIsManageOpen(true);
  };

  const handleOpenQuoteManageDialog = (quote: Quote) => {
    setSelectedQuote(quote);
    setScannedQuoteBarcodes(quote.scannedBarcodes || []);
    setIsQuoteManageOpen(true);
  };
  
  const handleBarcodeScan = useCallback((barcode: string) => {
    if (!barcode.trim() || !selectedManifest) return;

    let found = false;
    for (const quote of selectedManifest.quotes) {
        const expectedPrefix = `${quote.nfNumber}-`;
        if (barcode.startsWith(expectedPrefix)) {
            const quoteId = quote.quoteId;

            const volumeNumberStr = barcode.substring(expectedPrefix.length).toUpperCase();
            
            // Suporte para a função Bip ALL em Romaneios
            if (volumeNumberStr === 'ALL') {
                const canUseAll = user?.role === 'admin' || user?.subPermissions?.receiving?.canUseScannerAllFunction;
                if (!canUseAll) {
                    toast({ 
                        variant: 'destructive', 
                        title: 'Acesso Negado', 
                        description: 'Você não tem permissão para usar a função de bipar ALL (Saída do Galpão).' 
                    });
                    return;
                }
                
                const allBarcodes = Array.from({ length: quote.totalVolumes }, (_, i) => `${expectedPrefix}${i + 1}`);
                setScannedBarcodes(prev => ({
                    ...prev,
                    [quoteId]: allBarcodes
                }));
                toast({ title: 'Todos os Volumes Lidos!', description: `A função ALL bipou ${quote.totalVolumes} volumes.` });
                found = true;
                break;
            }

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
                toast({ title: 'Volume Lido', description: `Volume ${volumeNumber} da cotação ${quote.quoteCode} adicionado.` });
                return { ...prev, [quoteId]: [...currentScans, barcode] };
            });

            found = true;
            break; 
        }
    }

    if (!found) {
        toast({
            variant: 'destructive',
            title: 'Volume não encontrado',
            description: 'Este código de barras não pertence a nenhuma cotação neste romaneio.'
        });
    }
  }, [selectedManifest, user, toast]);

  const handleQuoteBarcodeScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuote) return;

    const barcodeInput = (e.target as any).elements.quoteBarcode;
    const barcode = barcodeInput.value.trim().toUpperCase();
    if (!barcode) return;

    const quoteCode = getQuoteCode(selectedQuote);
    const expectedPrefixNF = `${selectedQuote.nfNumber}-`.toUpperCase();
    const expectedPrefixQuote = `${quoteCode}-`.toUpperCase();
    
    let matchedPrefix = '';
    if (barcode.startsWith(expectedPrefixNF)) matchedPrefix = expectedPrefixNF;
    else if (barcode.startsWith(expectedPrefixQuote)) matchedPrefix = expectedPrefixQuote;
    
    if (!matchedPrefix) {
        toast({ variant: 'destructive', title: 'Código Inválido', description: `O código deve iniciar com ${expectedPrefixNF} ou ${expectedPrefixQuote}` });
        barcodeInput.value = '';
        return;
    }

    const volumeNumberStr = barcode.substring(matchedPrefix.length).toUpperCase();
    const totalVolumes = selectedQuote.volumeCount || 0;
    
    // Suporte para a função Bip ALL em Cotações Avulsas
    if (volumeNumberStr === 'ALL') {
        const canUseAll = user?.role === 'admin' || user?.subPermissions?.receiving?.canUseScannerAllFunction;
        if (!canUseAll) {
            toast({ 
                variant: 'destructive', 
                title: 'Acesso Negado', 
                description: 'Você não tem permissão para usar a função de bipar ALL (Saída do Galpão).' 
            });
            barcodeInput.value = '';
            return;
        }
        
        const allBarcodes = Array.from({ length: totalVolumes }, (_, i) => `${matchedPrefix}${i + 1}`);
        setScannedQuoteBarcodes(allBarcodes);
        toast({ title: 'Todos os Volumes Lidos!', description: `A função ALL bipou ${totalVolumes} volumes.` });
        barcodeInput.value = '';
        return;
    }

    const volumeNumber = parseInt(volumeNumberStr, 10);
    if (isNaN(volumeNumber) || volumeNumber < 1 || volumeNumber > totalVolumes) {
        toast({ variant: 'destructive', title: 'Volume Inválido', description: `O número do volume "${volumeNumberStr}" não é válido.` });
        barcodeInput.value = '';
        return;
    }

    if (scannedQuoteBarcodes.includes(barcode)) {
        toast({ variant: 'default', title: 'Duplicado', description: `O volume ${volumeNumber} já foi lido.` });
        barcodeInput.value = '';
        return;
    }

    setScannedQuoteBarcodes(prev => [...prev, barcode]);
    toast({ title: 'Volume Lido!', description: `Volume ${volumeNumber} de ${totalVolumes} adicionado.` });
    barcodeInput.value = '';
  };
  
  const handleMasterScan = (e: React.FormEvent) => {
      e.preventDefault();
      const barcodeInput = (e.target as any).elements.masterBarcode;
      const barcode = barcodeInput.value;
      handleBarcodeScan(barcode);
      barcodeInput.value = '';
  };
  
  const remainingVolumes = useMemo(() => {
    if (!selectedManifest) return [];
    
    const remaining: { quoteCode: string; nfNumber: string; destinatario: string; missingVolumes: string[] }[] = [];

    selectedManifest.quotes.forEach(quote => {
        const expectedVolumes = Array.from({ length: quote.totalVolumes }, (_, i) => `${quote.nfNumber}-${i + 1}`);
        const scanned = scannedBarcodes[quote.quoteId] || [];
        const missing = expectedVolumes.filter(barcode => !scanned.includes(barcode));

        if (missing.length > 0) {
            remaining.push({
                quoteCode: quote.quoteCode,
                nfNumber: quote.nfNumber,
                destinatario: quote.destinatario,
                missingVolumes: missing.sort((a, b) => {
                    const numA = parseInt(a.split('-').pop() || '0');
                    const numB = parseInt(b.split('-').pop() || '0');
                    return numA - numB;
                }),
            });
        }
    });

    return remaining;
  }, [selectedManifest, scannedBarcodes]);

  const quoteRemainingVolumes = useMemo(() => {
    if (!selectedQuote) return [];
    const totalVolumes = selectedQuote.volumeCount || 0;
    const expected = Array.from({ length: totalVolumes }, (_, i) => `${selectedQuote.nfNumber}-${i + 1}`);
    return expected.filter(barcode => !scannedQuoteBarcodes.includes(barcode));
  }, [selectedQuote, scannedQuoteBarcodes]);


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

        const response = await authFetch(`/api/manifests/${selectedManifest.id}`, {
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

  const handleFinalizeQuoteLoading = async () => {
    if (!selectedQuote || !user) return;

    const totalVolumes = selectedQuote.volumeCount || 0;
    if (scannedQuoteBarcodes.length !== totalVolumes) {
        toast({ variant: 'destructive', title: 'Volumes Pendentes', description: 'Ainda há volumes pendentes de leitura para esta cotação.' });
        return;
    }

    setIsSubmitting(true);
    try {
        const operationalEvent = {
            action: 'SAIDA_GALPAO_CONFIRMADA',
            details: `Saída física da cotação avulsa confirmada via bipagem por ${user.username}.`,
            status: 'Em Rota',
        };

        const response = await authFetch(`/api/quotes/${selectedQuote.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'Em Rota',
                scannedVolumes: scannedQuoteBarcodes.length,
                scannedBarcodes: scannedQuoteBarcodes,
                user,
                operationalEvent,
            }),
        });

        if (response.ok) {
            toast({ title: 'Sucesso!', description: 'Saída da cotação avulsa confirmada fisicamente!' });
            setIsQuoteManageOpen(false);
            await fetchAllData();
        } else {
            const errData = await response.json();
            throw new Error(errData.message || 'Falha ao finalizar saída da cotação.');
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
    <main className="container mx-auto p-4 md:p-8 relative overflow-hidden">
        {/* Efeitos de desfoque e brilho aurora neon atrás dos cards */}
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/15 rounded-full blur-[100px] pointer-events-none -z-10 animate-float-blur-1" />
        <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-purple-500/15 rounded-full blur-[120px] pointer-events-none -z-10 animate-float-blur-2" />

        <PageHeader
            icon={<Truck className="h-4 w-4" />}
            badge="Carregamento"
            titlePrefix="Gerenciar"
            titleHighlight="Carregamento"
            description="Confirme a saída e o carregamento dos romaneios ou cotações avulsas."
            backHref="/receiving"
            backLabel="Voltar para Área de Recebimento"
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full mt-6">
            {/* Coluna de Romaneios Pendentes */}
            <div className="space-y-6 border border-border/10 bg-card/10 backdrop-blur-md rounded-3xl p-6 shadow-sm">
                <div className="flex items-center justify-between pb-4 border-b border-border/10">
                    <h2 className="text-xl font-bold flex items-center gap-2.5 text-foreground">
                        <Truck className="h-5 w-5 text-primary animate-pulse" />
                        Romaneios Pendentes
                    </h2>
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-0 rounded-lg font-semibold text-xs px-2.5 py-1">
                        {pendingManifests.length}
                    </Badge>
                </div>

                {pendingManifests.length > 0 ? (
                    <div className="grid sm:grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in-50 duration-300">
                        {pendingManifests.map(manifest => {
                            const totalVolumes = manifest.quotes.reduce((acc, q) => acc + q.totalVolumes, 0);
                            return (
                                <Card key={manifest.id} className="flex flex-col border border-border/40 bg-card/45 backdrop-blur-2xl shadow-xl rounded-2xl relative overflow-hidden p-6 hover:shadow-2xl hover:border-primary/20 transition-all duration-300">
                                    <CardHeader className="p-0 pb-4">
                                        <CardTitle className="flex items-center gap-3 text-lg font-bold text-foreground">
                                            <Truck className="h-5 w-5 text-primary" />
                                            {manifest.manifestCode}
                                        </CardTitle>
                                        <CardDescription className="text-sm text-muted-foreground mt-1">
                                            Motorista: {manifest.driverName} | Placa: {manifest.driverLicensePlate}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex-grow p-0 py-2 flex flex-wrap gap-2">
                                        <Badge variant="outline" className="border-border/30 bg-background/25">Cotações: {manifest.quotes.length}</Badge>
                                        <Badge variant="secondary" className="bg-primary/10 text-primary border-0">Volumes: {totalVolumes}</Badge>
                                    </CardContent>
                                    <CardFooter className="p-0 pt-4 mt-auto">
                                        <Button className="w-full bg-primary/90 hover:bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/25 rounded-xl py-5 transition-all duration-300 hover:scale-[1.02]" onClick={() => handleOpenManageDialog(manifest)}>
                                            <ScanLine className="mr-2 h-4 w-4" /> Gerenciar Carregamento
                                        </Button>
                                    </CardFooter>
                                </Card>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-16 border border-dashed border-border/30 rounded-2xl bg-card/5 backdrop-blur-md animate-in fade-in-50 duration-300">
                        <p className="text-muted-foreground text-sm">Nenhum romaneio pendente para carregamento.</p>
                    </div>
                )}
            </div>

            {/* Coluna de Cotações Avulsas */}
            <div className="space-y-6 border border-border/10 bg-card/10 backdrop-blur-md rounded-3xl p-6 shadow-sm">
                <div className="flex items-center justify-between pb-4 border-b border-border/10">
                    <h2 className="text-xl font-bold flex items-center gap-2.5 text-foreground">
                        <Package className="h-5 w-5 text-indigo-400 animate-pulse" />
                        Cotações Avulsas
                    </h2>
                    <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-400 border-0 rounded-lg font-semibold text-xs px-2.5 py-1">
                        {pendingQuotes.length}
                    </Badge>
                </div>

                {pendingQuotes.length > 0 ? (
                    <div className="grid sm:grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in-50 duration-300">
                        {pendingQuotes.map(quote => {
                            const totalVolumes = quote.volumeCount || 0;
                            const driverInfo = getQuoteDriverInfo(quote);
                            const isHighlighted = quoteCodeFilter && (quote.quoteCode === quoteCodeFilter);
                            return (
                                <Card
                                    key={quote.id}
                                    id={`quote-card-${quote.quoteCode}`}
                                    className={`flex flex-col border backdrop-blur-2xl shadow-xl rounded-2xl relative overflow-hidden p-6 hover:shadow-2xl transition-all duration-300 ${
                                        isHighlighted
                                            ? 'border-indigo-400 bg-indigo-500/10 shadow-indigo-500/30 ring-2 ring-indigo-400/50'
                                            : 'border-border/40 bg-card/45 hover:border-indigo-500/20'
                                    }`}
                                >
                                    <CardHeader className="p-0 pb-4">
                                        <CardTitle className="flex items-center gap-3 text-lg font-bold text-foreground">
                                            <Package className="h-5 w-5 text-indigo-400" />
                                            {getQuoteCode(quote)}
                                        </CardTitle>
                                        <CardDescription className="text-sm text-muted-foreground mt-1">
                                            Destinatário: {quote.destinatario || quote.empresaDestino || 'N/A'}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex-grow p-0 py-2 flex flex-col gap-2">
                                        <div className="flex flex-wrap gap-2">
                                            <Badge variant="outline" className="border-border/30 bg-background/25">NF: {quote.nfNumber || 'N/A'}</Badge>
                                            <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-400 border-0">Volumes: {totalVolumes}</Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Destino: {quote.cidadeDestino || 'N/A'}
                                        </p>
                                        {driverInfo && (
                                            <div className="mt-3 p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10 text-xs text-indigo-300/90 space-y-1">
                                                <p className="font-semibold flex items-center gap-1.5">
                                                    <Truck className="h-3.5 w-3.5 text-indigo-400" /> Motorista: {driverInfo.name}
                                                </p>
                                                <p className="text-[11px] text-indigo-400/80">Placa: {driverInfo.licensePlate}</p>
                                            </div>
                                        )}
                                    </CardContent>
                                    <CardFooter className="p-0 pt-4 mt-auto">
                                        <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-md shadow-indigo-600/20 rounded-xl py-5 transition-all duration-300 hover:scale-[1.02]" onClick={() => handleOpenQuoteManageDialog(quote)}>
                                            <ScanLine className="mr-2 h-4 w-4" /> Gerenciar Saída
                                        </Button>
                                    </CardFooter>
                                </Card>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-16 border border-dashed border-border/30 rounded-2xl bg-card/5 backdrop-blur-md animate-in fade-in-50 duration-300">
                        <p className="text-muted-foreground text-sm">Nenhuma cotação avulsa aguardando saída física.</p>
                    </div>
                )}
            </div>
        </div>
        
        {/* Diálogo de Bipagem de Romaneio */}
        {selectedManifest && (
             <Dialog open={isManageOpen} onOpenChange={setIsManageOpen}>
                <DialogContent className="max-w-4xl h-[90vh] flex flex-col border border-border/40 bg-card/95 backdrop-blur-3xl rounded-3xl shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">Gerenciar Carregamento: {selectedManifest.manifestCode}</DialogTitle>
                        <DialogDescription>
                            Faça a leitura dos códigos de barras de cada volume. O formato esperado é <span className="font-mono text-primary">NF-VOLUME</span> (ex: 12345-1).
                        </DialogDescription>
                    </DialogHeader>
                    
                    <form onSubmit={handleMasterScan} className="flex-shrink-0">
                        <div className="flex gap-2 items-center">
                            <Input
                              name="masterBarcode"
                              placeholder="Bipar etiqueta mestre aqui..."
                              autoFocus
                              className="text-lg h-12 rounded-xl border-border/50 bg-background/50 focus-visible:ring-primary"
                            />
                            <Button type="submit" size="lg" className="rounded-xl h-12 font-semibold">Adicionar</Button>
                        </div>
                    </form>
                    
                     <Button variant="outline" onClick={() => setIsRemainingVolumesOpen(true)} className="mt-2 w-full justify-center rounded-xl border-border/40 hover:bg-muted/50">
                        <ListTodo className="mr-2 h-4 w-4 text-primary" />
                        Ver Volumes Pendentes ({remainingVolumes.reduce((acc, curr) => acc + curr.missingVolumes.length, 0)})
                    </Button>

                    <div className="flex-grow overflow-y-auto pr-4 space-y-4 mt-4">
                        {selectedManifest.quotes.map(quote => {
                            const scannedCount = scannedBarcodes[quote.quoteId]?.length || 0;
                            const isComplete = scannedCount === quote.totalVolumes;
                            return (
                                <div key={quote.quoteId} className="border border-border/30 rounded-xl p-4 bg-muted/20 flex justify-between items-center transition-all duration-300">
                                    <div>
                                        <p className="font-semibold text-foreground">{quote.destinatario}</p>
                                        <p className="text-xs text-muted-foreground">{quote.cidadeDestino} | NF: {quote.nfNumber}</p>
                                    </div>
                                    <Badge variant={isComplete ? 'default' : 'secondary'} className={isComplete ? 'bg-green-600/90 text-white border-0' : 'bg-muted border-border/40'}>
                                        <Package className="mr-2 h-4 w-4"/> {scannedCount} / {quote.totalVolumes}
                                    </Badge>
                                </div>
                            )
                        })}
                    </div>
                     <DialogFooter className="mt-auto pt-4 border-t border-border/20">
                        <DialogClose asChild><Button variant="secondary" className="rounded-xl" disabled={isSubmitting}>Cancelar</Button></DialogClose>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button disabled={isSubmitting} className="rounded-xl font-semibold bg-primary hover:bg-primary/95 text-primary-foreground">
                                    <CheckCircle className="mr-2 h-4 w-4" /> Finalizar e Imprimir
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-2xl border border-border/40 bg-card/95 backdrop-blur-2xl">
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Finalizar Carregamento?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Isto irá marcar o romaneio como "Em Rota" e mover todas as cotações para a próxima etapa. Confirma?
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleFinalizeLoading} disabled={isSubmitting} className="rounded-xl bg-primary text-primary-foreground">
                                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Confirmar'}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </DialogFooter>
                </DialogContent>
             </Dialog>
        )}

        {/* Diálogo de Bipagem de Cotação Avulsa */}
        {selectedQuote && (
             <Dialog open={isQuoteManageOpen} onOpenChange={setIsQuoteManageOpen}>
                <DialogContent className="max-w-4xl h-[90vh] flex flex-col border border-border/40 bg-card/95 backdrop-blur-3xl rounded-3xl shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">Confirmar Saída: {getQuoteCode(selectedQuote)}</DialogTitle>
                        <DialogDescription>
                            Bipe todos os volumes da cotação avulsa para atestar e confirmar a saída do galpão. O formato esperado é <span className="font-mono text-primary">NF-VOLUME</span> (ex: 12345-1).
                        </DialogDescription>
                    </DialogHeader>
                    
                    <form onSubmit={handleQuoteBarcodeScan} className="flex-shrink-0">
                        <div className="flex gap-2 items-center">
                            <Input
                              name="quoteBarcode"
                              placeholder="Bipar etiqueta de volume aqui..."
                              autoFocus
                              className="text-lg h-12 rounded-xl border-border/50 bg-background/50 focus-visible:ring-primary"
                            />
                            <Button type="submit" size="lg" className="rounded-xl h-12 font-semibold">Adicionar</Button>
                        </div>
                    </form>
                    
                     <Button variant="outline" onClick={() => setIsQuoteRemainingVolumesOpen(true)} className="mt-2 w-full justify-center rounded-xl border-border/40 hover:bg-muted/50">
                        <ListTodo className="mr-2 h-4 w-4 text-indigo-400" />
                        Ver Volumes Pendentes ({quoteRemainingVolumes.length})
                     </Button>

                    <div className="flex-grow flex flex-col justify-center items-center p-6 mt-4 border border-dashed border-border/30 bg-muted/10 rounded-xl relative overflow-hidden">
                        <div className="text-center space-y-2">
                            <Package className="h-16 w-16 text-indigo-400 mx-auto animate-pulse" />
                            <h3 className="text-2xl font-bold text-foreground">Leitura de Volumes</h3>
                            <p className="text-5xl font-extrabold text-primary tracking-tight mt-2">
                                {scannedQuoteBarcodes.length} / {selectedQuote.volumeCount || 0}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {scannedQuoteBarcodes.length === (selectedQuote.volumeCount || 0) 
                                    ? "Excelente! Todos os volumes lidos com sucesso." 
                                    : "Bipe os volumes pendentes para liberar a confirmação de saída."}
                            </p>
                        </div>
                    </div>

                     <DialogFooter className="mt-auto pt-4 border-t border-border/20">
                        <DialogClose asChild><Button variant="secondary" className="rounded-xl" disabled={isSubmitting}>Cancelar</Button></DialogClose>
                        <Button 
                            onClick={handleFinalizeQuoteLoading} 
                            disabled={isSubmitting || scannedQuoteBarcodes.length !== (selectedQuote.volumeCount || 0)} 
                            className="rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20"
                        >
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4" />}
                            Finalizar Saída
                        </Button>
                    </DialogFooter>
                </DialogContent>
             </Dialog>
        )}
        
        {/* Modal de Volumes Pendentes de Romaneio */}
        <Dialog open={isRemainingVolumesOpen} onOpenChange={setIsRemainingVolumesOpen}>
            <DialogContent className="max-w-2xl border border-border/40 bg-card/95 backdrop-blur-2xl rounded-2xl shadow-xl">
                <DialogHeader>
                    <DialogTitle className="font-bold text-lg">Volumes Pendentes de Leitura</DialogTitle>
                    <DialogDescription>
                        Lista de todos os volumes que ainda não foram bipados para o romaneio {selectedManifest?.manifestCode}.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] mt-4">
                    <div className="space-y-4 pr-4">
                        {remainingVolumes.length > 0 ? (
                            remainingVolumes.map(quoteInfo => (
                                <div key={quoteInfo.quoteCode} className="space-y-1">
                                    <h4 className="font-semibold text-sm text-foreground">{quoteInfo.destinatario} ({quoteInfo.quoteCode})</h4>
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {quoteInfo.missingVolumes.map(barcode => (
                                            <Badge key={barcode} variant="secondary" className="bg-muted text-xs border border-border/40">{barcode}</Badge>
                                        ))}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-8">
                                <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                                <p className="font-semibold text-foreground">Todos os volumes foram lidos!</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>
                <DialogFooter className="pt-4 border-t border-border/10">
                    <DialogClose asChild>
                        <Button variant="outline" className="rounded-xl">Fechar</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Modal de Volumes Pendentes de Cotação Avulsa */}
        <Dialog open={isQuoteRemainingVolumesOpen} onOpenChange={setIsQuoteRemainingVolumesOpen}>
            <DialogContent className="max-w-2xl border border-border/40 bg-card/95 backdrop-blur-2xl rounded-2xl shadow-xl">
                <DialogHeader>
                    <DialogTitle className="font-bold text-lg">Volumes Pendentes da Cotação</DialogTitle>
                    <DialogDescription>
                        Lista de volumes pendentes de bipe para {selectedQuote && getQuoteCode(selectedQuote)}.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] mt-4">
                    <div className="space-y-4 pr-4">
                        {quoteRemainingVolumes.length > 0 ? (
                            <div className="space-y-1">
                                <h4 className="font-semibold text-sm text-foreground">
                                    {selectedQuote && (selectedQuote.destinatario || selectedQuote.empresaDestino)}
                                </h4>
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {quoteRemainingVolumes.map(barcode => (
                                        <Badge key={barcode} variant="secondary" className="bg-muted text-xs border border-border/40">{barcode}</Badge>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-8">
                                <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                                <p className="font-semibold text-foreground">Todos os volumes foram lidos!</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>
                <DialogFooter className="pt-4 border-t border-border/10">
                    <DialogClose asChild>
                        <Button variant="outline" className="rounded-xl">Fechar</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <style>{`
          @keyframes floatBlur1 {
            0%, 100% {
              transform: translate(0, 0) scale(1);
              background-color: hsl(var(--primary) / 0.15);
            }
            25% {
              transform: translate(120px, 60px) scale(1.15);
              background-color: rgba(99, 102, 241, 0.18);
            }
            50% {
              transform: translate(40px, 160px) scale(0.95);
              background-color: rgba(236, 72, 153, 0.14);
            }
            75% {
              transform: translate(-80px, 100px) scale(1.08);
              background-color: rgba(59, 130, 246, 0.18);
            }
          }

          @keyframes floatBlur2 {
            0%, 100% {
              transform: translate(0, 0) scale(1);
              background-color: rgba(168, 85, 247, 0.15);
            }
            33% {
              transform: translate(-100px, -120px) scale(1.1);
              background-color: rgba(59, 130, 246, 0.16);
            }
            66% {
              transform: translate(80px, -60px) scale(0.9);
              background-color: rgba(236, 72, 153, 0.14);
            }
          }

          .animate-float-blur-1 {
            animation: floatBlur1 28s infinite ease-in-out alternate !important;
          }

          .animate-float-blur-2 {
            animation: floatBlur2 38s infinite ease-in-out alternate !important;
          }
        `}</style>
    </main>
  );
}
