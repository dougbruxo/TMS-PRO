
"use client";

import { useEffect, useState, Suspense, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Printer, FileText, Search, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import type { Driver, Vehicle, CompanyProfile, Quote } from '@/lib/types';
import { CollectionOrderDocument } from '@/components/CollectionOrderDocument';
import { DriverManagement } from '@/components/DriverManagement';
import { authFetch } from '@/lib/api-client';

const collectionOrderSchema = z.object({
  driverId: z.string().min(1, 'Motorista é obrigatório.'),
  collectFrom: z.string().min(1, 'Empresa de coleta é obrigatória.'),
  collectAddress: z.string().min(1, 'Endereço de coleta é obrigatório.'),
  deliverTo: z.string().min(1, 'Empresa de entrega é obrigatória.'),
  deliverAddress: z.string().min(1, 'Endereço de entrega é obrigatório.'),
  volumes: z.string().min(1, 'Volumes é obrigatório.'),
  weight: z.string().min(1, 'Peso é obrigatório.'),
  requester: z.string().optional(),
  contact: z.string().optional(),
  nfNumber: z.string().optional(),
  observations: z.string().optional(),
  quoteCode: z.string().optional(),
});

export type CollectionOrderData = z.infer<typeof collectionOrderSchema>;

const getInitials = (name: string = '') => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

function CollectionOrderPageContent() {
  const { user, companyProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);

  const [searchedDrivers, setSearchedDrivers] = useState<Driver[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [documentData, setDocumentData] = useState<CollectionOrderData | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [isDriverSearchOpen, setIsDriverSearchOpen] = useState(false);
  const [isAddDriverDialogOpen, setIsAddDriverDialogOpen] = useState(false);
  const [driverSearchTerm, setDriverSearchTerm] = useState('');
  
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isQuoteSearchOpen, setIsQuoteSearchOpen] = useState(false);
  const [quoteSearchTerm, setQuoteSearchTerm] = useState('');
  const [isSearchingQuote, setIsSearchingQuote] = useState(false);
  const [searchedQuotes, setSearchedQuotes] = useState<Quote[]>([]);
  const quoteSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isEmbedded = searchParams.get('embedded') === 'true';

  const form = useForm<CollectionOrderData>({
    resolver: zodResolver(collectionOrderSchema),
    defaultValues: {
      driverId: '', collectFrom: '', collectAddress: '', deliverTo: '',
      deliverAddress: '', volumes: '', weight: '', requester: '',
      contact: '', nfNumber: '', observations: '', quoteCode: '',
    },
  });

  const fetchData = useCallback(async () => {
    setIsDataLoading(true);
    try {
        const [driversRes, vehiclesRes] = await Promise.all([
            authFetch('/api/drivers'),
            authFetch('/api/fleet'),
        ]);
        if (!driversRes.ok || !vehiclesRes.ok) throw new Error("Failed to load data.");
        setDrivers(await driversRes.json());
        setVehicles(await vehiclesRes.json());
    } catch(e: any) {
        toast({variant: 'destructive', title: 'Error', description: e.message});
    } finally {
        setIsDataLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
    if (!authLoading) {
        fetchData();
    }
  }, [authLoading, fetchData]);

  const searchDrivers = useCallback(async (term: string) => {
    if (term.length < 2) {
      setSearchedDrivers([]);
      return;
    }
    setIsSearching(true);
    try {
      const response = await authFetch(`/api/drivers/search?term=${encodeURIComponent(term)}`);
      if (response.ok) {
        setSearchedDrivers(await response.json());
      } else {
        setSearchedDrivers([]);
      }
    } catch (error) {
      console.error("Failed to search for drivers:", error);
      toast({ variant: 'destructive', title: 'Erro de Busca', description: 'Não foi possível buscar os motoristas.' });
    } finally {
      setIsSearching(false);
    }
  }, [toast]);
  
  const handleDriverSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const term = event.target.value;
    setDriverSearchTerm(term);

    if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
        searchDrivers(term);
    }, 500); // Debounce de 500ms
  };

  const searchQuotes = useCallback(async (term: string) => {
    if (term.length < 2) {
      setSearchedQuotes([]);
      return;
    }
    setIsSearchingQuote(true);
    try {
      const response = await authFetch(`/api/quotes/search?term=${encodeURIComponent(term)}`);
      if (response.ok) {
        setSearchedQuotes(await response.json());
      } else {
        setSearchedQuotes([]);
      }
    } catch (error) {
      console.error("Failed to search for quotes:", error);
      toast({ variant: 'destructive', title: 'Erro de Busca', description: 'Não foi possível buscar as cotações.' });
    } finally {
      setIsSearchingQuote(false);
    }
  }, [toast]);

  const handleQuoteSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const term = event.target.value;
    setQuoteSearchTerm(term);

    if (quoteSearchTimeoutRef.current) {
        clearTimeout(quoteSearchTimeoutRef.current);
    }
    
    quoteSearchTimeoutRef.current = setTimeout(() => {
        searchQuotes(term);
    }, 500);
  };

  const handleSelectQuote = (quote: Quote) => {
    form.setValue('collectFrom', quote.remetente || quote.tomador || '');
    form.setValue('collectAddress', quote.enderecoColeta || '');
    form.setValue('deliverTo', quote.empresaDestino || quote.destinatario || '');
    form.setValue('deliverAddress', quote.enderecoEntrega || '');
    form.setValue('volumes', (quote.volumeCount || quote.quantidade || '').toString());
    form.setValue('weight', (quote.peso || '').toString());
    form.setValue('requester', quote.responsavelSolicitante || quote.solicitante || quote.tomador || '');
    form.setValue('contact', quote.contato || '');
    form.setValue('nfNumber', quote.nfNumber || '');
    form.setValue('observations', quote.obs || '');
    form.setValue('quoteCode', quote.quoteCode || '');

    setIsQuoteSearchOpen(false);
    toast({ title: 'Cotação Selecionada', description: `Dados da cotação ${quote.quoteCode || ''} preenchidos com sucesso.` });
  };


  useEffect(() => {
    const paramsData: Partial<CollectionOrderData> = {};
    searchParams.forEach((value, key) => {
        if (key in form.getValues()) {
            (paramsData as any)[key] = value;
        }
    });

    if (Object.keys(paramsData).length > 0) {
      form.reset(current => ({ ...current, ...paramsData }));
      if (!isEmbedded) {
        toast({ title: 'Dados da Cotação Carregados', description: 'Preencha os campos restantes e gere a Ordem de Coleta.'});
      }
    }
  }, [searchParams, form, toast, isEmbedded]);
  
  const onSubmit = (data: CollectionOrderData) => {
    if (selectedDriver) {
      setDocumentData(data);
      
      setTimeout(() => {
          const originalTitle = document.title;
          const quoteString = data.quoteCode ? `Cotacao_${data.quoteCode}` : 'Ordem_de_Coleta';
          // Sanitize the delivery name to remove invalid characters for filenames if needed
          const destString = data.deliverTo ? `_${data.deliverTo.replace(/[^a-zA-Z0-9\s]/g, '').trim()}` : '';
          document.title = `${quoteString}${destString}`;
          
          window.print();
          
          // Restore after a short delay to ensure print dialog catches it
          setTimeout(() => { document.title = originalTitle; }, 1000);
      }, 500);
    } else {
        toast({ variant: 'destructive', title: 'Erro', description: 'Selecione um motorista válido.'});
    }
  };

  if (authLoading || isDataLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
          @media print { 
              body * { visibility: hidden; } 
              .printable-document, .printable-document * { visibility: visible; } 
              .printable-document { position: absolute; left: 0; top: 0; width: 100%; height: 100%; padding: 2rem; } 
              .no-print { display: none; } 
          }
      `}</style>
      
      <main className="container mx-auto p-4 md:p-8 no-print">
          {!isEmbedded && (
            <div>
                <Button variant="outline" onClick={() => router.push('/documents')} className="mb-4">
                  &larr; Voltar para Documentos
                </Button>
                <h1 className="text-3xl font-bold text-primary mb-2">Ordem de Coleta</h1>
                <p className="text-muted-foreground">Preencha os dados abaixo para gerar o documento.</p>
            </div>
          )}
          
          <Card className="max-w-4xl mx-auto mt-8">
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle>Gerar Ordem de Coleta</CardTitle>
                  <CardDescription>Preencha os dados para criar uma nova Ordem de Coleta para um motorista.</CardDescription>
                </div>
                <Dialog open={isQuoteSearchOpen} onOpenChange={setIsQuoteSearchOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline"><Search className="mr-2 h-4 w-4" /> Buscar Cotação (Opcional)</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Selecionar Cotação</DialogTitle></DialogHeader>
                    <Input placeholder="Buscar por cliente, destino, nº cotação..." value={quoteSearchTerm} onChange={handleQuoteSearchChange} />
                    <ScrollArea className="h-72 mt-4">
                      {isSearchingQuote ? (
                        <div className="flex justify-center items-center h-full">
                            <Loader2 className="h-6 w-6 animate-spin"/>
                        </div>
                      ) : searchedQuotes.map(q => (
                        <div key={q.id} onClick={() => handleSelectQuote(q)} className="flex flex-col gap-1 p-3 rounded-lg cursor-pointer hover:bg-accent mb-2 border">
                          <div className="flex justify-between">
                              <p className="font-semibold text-sm">{q.tomador}</p>
                              <span className="text-xs font-mono">{q.quoteCode}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{q.cidadeOrigem} &rarr; {q.cidadeDestino}</p>
                          <p className="text-xs">Veículo: {q.veiculo} | Resp: {q.responsavelSolicitante || 'N/A'}</p>
                        </div>
                      ))}
                      {!isSearchingQuote && searchedQuotes.length === 0 && quoteSearchTerm.length >= 2 && (
                          <div className="text-center p-4 text-muted-foreground text-sm">Nenhuma cotação encontrada.</div>
                      )}
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Motorista</Label>
                  <div className="flex gap-2 items-center">
                    <Input readOnly value={selectedDriver?.name || 'Nenhum motorista selecionado'} />
                    <Dialog open={isDriverSearchOpen} onOpenChange={setIsDriverSearchOpen}>
                      <DialogTrigger asChild>
                        <Button type="button" variant="outline" size="icon"><Search className="h-4 w-4" /></Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Selecionar Motorista</DialogTitle></DialogHeader>
                        <Input placeholder="Buscar por nome ou placa..." value={driverSearchTerm} onChange={handleDriverSearchChange} />
                        <ScrollArea className="h-72 mt-4">
                          {isSearching ? (
                            <div className="flex justify-center items-center h-full">
                                <Loader2 className="h-6 w-6 animate-spin"/>
                            </div>
                          ) : searchedDrivers.map(d => (
                            <div key={d.id} onClick={() => { form.setValue('driverId', d.id); setSelectedDriver(d); setIsDriverSearchOpen(false); }} className="flex items-center gap-4 p-2 rounded-lg cursor-pointer hover:bg-accent">
                              <Avatar><AvatarFallback>{getInitials(d.name)}</AvatarFallback></Avatar>
                              <div><p className="font-semibold">{d.name}</p><p className="text-xs text-muted-foreground">{d.licensePlate}</p></div>
                            </div>
                          ))}
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                    <Dialog open={isAddDriverDialogOpen} onOpenChange={setIsAddDriverDialogOpen}>
                        <DialogTrigger asChild>
                            <Button type="button" variant="outline" size="icon"><UserPlus className="h-4 w-4" /></Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-7xl h-[90vh] flex flex-col">
                            <DialogHeader>
                                <DialogTitle>Gerenciar Motoristas</DialogTitle>
                                <DialogDescription>Adicione ou edite um motorista. As alterações serão refletidas nesta tela.</DialogDescription>
                            </DialogHeader>
                            <div className="flex-grow overflow-y-auto">
                                <DriverManagement />
                            </div>
                        </DialogContent>
                    </Dialog>
                  </div>
                  {form.formState.errors.driverId && <p className="text-sm font-medium text-destructive">{form.formState.errors.driverId.message}</p>}
                </div>
                
                {selectedDriver && (
                  <div className="grid md:grid-cols-2 gap-6 pt-2">
                    <div className="space-y-2">
                      <Label>Placa do Veículo</Label>
                      <Input readOnly value={selectedDriver.licensePlate || 'Não vinculado'} />
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo do Veículo</Label>
                      <Input readOnly value={selectedDriver.vehicleType || 'Não informado'} />
                    </div>
                  </div>
                )}
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2"><Label>Coletar em (Remetente)</Label><Input {...form.register('collectFrom')} />{form.formState.errors.collectFrom && <p className="text-sm font-medium text-destructive">{form.formState.errors.collectFrom.message}</p>}</div>
                  <div className="space-y-2"><Label>Endereço de Coleta</Label><Textarea {...form.register('collectAddress')} />{form.formState.errors.collectAddress && <p className="text-sm font-medium text-destructive">{form.formState.errors.collectAddress.message}</p>}</div>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2"><Label>Entregar para (Destinatário)</Label><Input {...form.register('deliverTo')} />{form.formState.errors.deliverTo && <p className="text-sm font-medium text-destructive">{form.formState.errors.deliverTo.message}</p>}</div>
                  <div className="space-y-2"><Label>Endereço de Entrega</Label><Textarea {...form.register('deliverAddress')} />{form.formState.errors.deliverAddress && <p className="text-sm font-medium text-destructive">{form.formState.errors.deliverAddress.message}</p>}</div>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2"><Label>Volumes</Label><Input {...form.register('volumes')} />{form.formState.errors.volumes && <p className="text-sm font-medium text-destructive">{form.formState.errors.volumes.message}</p>}</div>
                  <div className="space-y-2"><Label>Peso</Label><Input {...form.register('weight')} />{form.formState.errors.weight && <p className="text-sm font-medium text-destructive">{form.formState.errors.weight.message}</p>}</div>
                </div>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="space-y-2"><Label>Solicitante (Opcional)</Label><Input {...form.register('requester')} /></div>
                  <div className="space-y-2"><Label>Contato (Opcional)</Label><Input {...form.register('contact')} /></div>
                  <div className="space-y-2"><Label>Nº da NF (Opcional)</Label><Input {...form.register('nfNumber')} /></div>
                </div>
                <div className="space-y-2"><Label>Observações (Opcional)</Label><Textarea {...form.register('observations')} /></div>
              </CardContent>
              <CardFooter>
                <Button type="submit"><Printer className="mr-2 h-4 w-4"/> Gerar e Imprimir</Button>
              </CardFooter>
            </form>
          </Card>
      </main>

      {documentData && selectedDriver && (
        <div className="printable-document">
          <CollectionOrderDocument data={documentData} driver={selectedDriver} companyProfile={companyProfile} />
        </div>
      )}
    </>
  );
}

export default function CollectionOrderPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <CollectionOrderPageContent />
    </Suspense>
  );
}
