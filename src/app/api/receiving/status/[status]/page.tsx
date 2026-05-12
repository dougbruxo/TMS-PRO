
"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  ArrowRight,
  ClipboardCheck,
  PackageCheck,
  Search,
  Upload,
  Undo2,
  Printer
} from 'lucide-react';
import type { Quote, LabelData, Driver, NfeData } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { printLabels } from '@/lib/print';
import { QuoteCard } from '@/components/QuoteCard';

const getQuoteCode = (quote: Quote) => quote.quoteCode || `LEGACY-${quote.id.slice(0, 5)}`;

const statusMap: Record<string, { title: string; filter: (q: Quote) => boolean }> = {
    'awaiting-receipt': { title: 'Aguardando Recebimento', filter: (q) => q.status === 'Aguardando Recebimento' },
    'in-warehouse': { title: 'No Galpão', filter: (q) => ['No Galpão', 'Aguardando Saída'].includes(q.status) },
    'dispatched': { title: 'Saídas Recentes', filter: (q) => ['Em Rota', 'Entregue', 'Finalizado'].includes(q.status) }
};


export default function ReceivingStatusPage() {
  const { user, loading: authLoading, companyProfile } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  
  const statusParam = Array.isArray(params.status) ? params.status[0] : params.status;
  const currentView = statusMap[statusParam];

  const fetchAllData = useCallback(async () => {
    setIsDataLoading(true);
    try {
        const res = await fetch('/api/quotes?limit=10000');
        if (!res.ok) throw new Error("Falha ao carregar cotações.");
        setQuotes(await res.json());
    } catch(e: any) {
        toast({variant: 'destructive', title: 'Erro de Carregamento', description: e.message});
    } finally {
        setIsDataLoading(false);
    }
  }, [toast]);

  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [isConfirmReceiveOpen, setIsConfirmReceiveOpen] = useState(false);
  const [isDispatchRequestOpen, setIsDispatchRequestOpen] = useState(false);
  const [filter, setFilter] = useState('');
  
  const [nfNumber, setNfNumber] = useState('');
  const [nfeKey, setNfeKey] = useState('');
  const [volumeCount, setVolumeCount] = useState<number | string>('');
  const [remetente, setRemetente] = useState('');
  const [remetenteEndereco, setRemetenteEndereco] = useState('');
  const [destinatario, setDestinatario] = useState('');
  const [destinatarioEndereco, setDestinatarioEndereco] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingNfe, setIsFetchingNfe] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [quoteToRevert, setQuoteToRevert] = useState<Quote | null>(null);

  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [isObsDialogOpen, setIsObsDialogOpen] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!user || !user.receivingAccess) {
        router.push('/dashboard');
      } else {
        fetchAllData();
      }
    }
  }, [user, authLoading, router, fetchAllData]);

  const filteredQuotes = useMemo(() => {
    if (!currentView || !quotes) return [];
    let relevantQuotes = quotes.filter(currentView.filter);
    
    if (!filter) return relevantQuotes;
    const lowercasedFilter = filter.toLowerCase();

    return relevantQuotes.filter(quote =>
        (quote.remetente && quote.remetente.toLowerCase().includes(lowercasedFilter)) ||
        (quote.cidadeDestino && quote.cidadeDestino.toLowerCase().includes(lowercasedFilter)) ||
        (getQuoteCode(quote) && getQuoteCode(quote).toLowerCase().includes(lowercasedFilter)) ||
        (quote.nfNumber && quote.nfNumber.toLowerCase().includes(lowercasedFilter))
    );
  }, [quotes, currentView, filter]);

  const resetFormFields = () => {
      setNfNumber('');
      setVolumeCount('');
      setNfeKey('');
      setRemetente('');
      setRemetenteEndereco('');
      setDestinatario('');
      setDestinatarioEndereco('');
  }

  const handleOpenReceiveDialog = (quote: Quote) => {
    setSelectedQuote(quote);
    resetFormFields();
    setRemetente(quote.remetente); 
    setIsConfirmReceiveOpen(true);
  };
  
  const handleOpenDispatchRequestDialog = (quote: Quote) => {
    setSelectedQuote(quote);
    setIsDispatchRequestOpen(true);
  };

   const handleOpenDialog = (quote: Quote, dialogSetter: React.Dispatch<React.SetStateAction<boolean>>) => {
    setSelectedQuote(quote);
    dialogSetter(true);
  };
  
  const handleCloseDialog = (dialogSetter: React.Dispatch<React.SetStateAction<boolean>>) => {
    dialogSetter(false);
    setTimeout(() => setSelectedQuote(null), 300);
  };

  const handleUpdate = async (quote: Quote, updates: Partial<Quote>, action: string, details: string) => {
      setIsSubmitting(true);
      try {
        const response = await fetch(`/api/quotes/${quote.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...updates, history: [...(quote.history || []), { id: `hist-${Date.now()}`, timestamp: new Date().toISOString(), userId: user!.id, username: user!.username, action, details }] }),
        });
        if(response.ok) {
            toast({ title: 'Sucesso!', description: details });
            await fetchAllData();
            return true;
        } else {
             throw new Error('Não foi possível atualizar a cotação.');
        }
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Erro', description: error.message });
        return false;
      } finally {
        setIsSubmitting(false);
      }
  };

  const handleXmlFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        const xmlContent = e.target?.result as string;
        await handleFetchNfeDataFromXml(xmlContent);
    };
    reader.readAsText(file);
  };

  const handleFetchNfeDataFromXml = async (xmlContent: string) => {
    setIsFetchingNfe(true);
    try {
        const response = await fetch('/api/nfe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/xml' },
            body: xmlContent,
        });
        if(response.ok) {
            const data: NfeData = await response.json();
            setNfNumber(data.nfNumber);
            setVolumeCount(data.volumeCount);
            setRemetente(data.remetente);
            setRemetenteEndereco(data.remetenteEndereco);
            setDestinatario(data.destinatario);
            setDestinatarioEndereco(data.destinatarioEndereco);
            toast({ title: 'Dados da NF-e carregados com sucesso!' });
        } else {
            const error = await response.json();
            throw new Error(error.message || 'Falha ao processar XML.');
        }
    } catch(e: any) {
        toast({ variant: 'destructive', title: 'Erro ao Ler XML', description: e.message });
    } finally {
        setIsFetchingNfe(false);
    }
  };
  
  const handleFetchNfeDataFromKey = async () => {
    if (!nfeKey || nfeKey.length !== 44) {
        toast({ variant: 'destructive', title: 'Chave Inválida', description: 'Por favor, insira uma chave de acesso com 44 dígitos.' });
        return;
    }
    setIsFetchingNfe(true);
    try {
        const response = await fetch(`/api/nfe?key=${nfeKey}`);
        if(response.ok) {
            const data: NfeData = await response.json();
            setNfNumber(data.nfNumber);
            setVolumeCount(data.volumeCount);
            setRemetente(data.remetente);
            setRemetenteEndereco(data.remetenteEndereco);
            setDestinatario(data.destinatario);
            setDestinatarioEndereco(data.destinatarioEndereco);
            toast({ title: 'Dados da NF-e carregados com sucesso!' });
        } else {
            const error = await response.json();
            throw new Error(error.message || 'Falha ao buscar dados da chave.');
        }
    } catch(e: any) {
        toast({ variant: 'destructive', title: 'Erro ao Buscar Chave', description: e.message });
    } finally {
        setIsFetchingNfe(false);
    }
  };


  const handleConfirmReceive = async () => {
    if (!selectedQuote || !nfNumber || !volumeCount) {
        toast({ variant: 'destructive', title: 'Campos em Falta', description: 'Número da NF e Quantidade de Volumes são obrigatórios.' });
        return;
    }
    const updates = {
      status: 'No Galpão' as const,
      nfNumber: nfNumber,
      volumeCount: Number(volumeCount),
      remetente: remetente || selectedQuote.remetente,
      destinatario: destinatario || selectedQuote.empresaDestino,
      enderecoColeta: remetenteEndereco || selectedQuote.enderecoColeta,
      enderecoEntrega: destinatarioEndereco || selectedQuote.enderecoEntrega,
    };
    
    await handleUpdate(selectedQuote, updates, 'RECEBIDO_GALPAO', 'Carga recebida fisicamente no galpão.');
    
    const labelData: LabelData = {
        quoteCode: getQuoteCode(selectedQuote),
        nf: nfNumber,
        totalVolumes: Number(volumeCount),
        remetenteName: updates.remetente,
        origem: updates.enderecoColeta || selectedQuote.cidadeOrigem,
        destinatarioName: updates.destinatario,
        entrega: updates.enderecoEntrega || selectedQuote.cidadeDestino
    };

    printLabels(labelData as any, companyProfile);
    setIsConfirmReceiveOpen(false);
  };
  
  const handleDispatchRequest = async () => {
    if (!selectedQuote) return;
    const success = await handleUpdate(selectedQuote, { status: 'Aguardando Saída' }, 'SOLICITACAO_SAIDA', 'Solicitação de saída do galpão enviada para a equipe operacional.');
    if (success) {
      setIsDispatchRequestOpen(false);
    }
  };

  const handleConfirmDispatch = async (quote: Quote) => {
    await handleUpdate(quote, { status: 'Em Rota' }, 'SAIDA_GALPAO_CONFIRMADA', 'Saída física da carga do galpão confirmada.');
  };

  const handleConfirmRevert = async () => {
    if (!quoteToRevert || !quoteToRevert.operationalHistory || quoteToRevert.operationalHistory.length === 0) return;
    setIsSubmitting(true);
    try {
        const lastEvent = quoteToRevert.operationalHistory[quoteToRevert.operationalHistory.length - 1];
        const newHistory = quoteToRevert.operationalHistory.slice(0, -1);
        const newStatus = newHistory.length > 0 ? newHistory[newHistory.length - 1].status : 'Fechada';

        const updates: Partial<Quote> = { status: newStatus, operationalHistory: newHistory };
        if(lastEvent.expense) {
            updates.totalExpense = (quoteToRevert.totalExpense || 0) - lastEvent.expense;
        }

        await handleUpdate(quoteToRevert, updates, 'ETAPA_REVERTIDA', `Etapa operacional revertida para '${newStatus}'.`);
        toast({ title: 'Sucesso!', description: 'A etapa operacional foi revertida.' });
    } catch(e) {
        // handleUpdate já mostra o toast de erro
    } finally {
        setQuoteToRevert(null);
        setIsSubmitting(false);
    }
  };

  const QuoteListCard = ({ quote }: { quote: Quote }) => {
    
    let manageAction;
    let manageLabel = '';

    switch(statusParam) {
        case 'awaiting-receipt':
            manageAction = () => handleOpenReceiveDialog(quote);
            manageLabel = 'Confirmar Recebimento';
            break;
        case 'in-warehouse':
            if (quote.status === 'No Galpão') {
                manageAction = () => handleOpenDispatchRequestDialog(quote);
                manageLabel = 'Solicitar Saída';
            } else if (quote.status === 'Aguardando Saída') {
                manageAction = () => handleConfirmDispatch(quote);
                manageLabel = 'Confirmar Saída';
            }
            break;
        default:
            manageAction = undefined;
    }


    return (
        <QuoteCard 
            key={quote.id} 
            quote={quote}
            drivers={[]}
            currentUser={user!}
            onOpenManage={manageAction}
            onOpenDetails={(q) => handleOpenDialog(q, setIsDetailsDialogOpen)}
            onOpenHistory={(q) => handleOpenDialog(q, setIsHistoryDialogOpen)}
            onOpenObs={(q) => handleOpenDialog(q, setIsObsDialogOpen)}
            onSetQuoteToRevert={setQuoteToRevert}
            isSubmitting={isSubmitting}
        >
             <CardFooter className="p-2 pt-0 flex flex-col gap-2">
                {['No Galpão', 'Aguardando Saída', 'Em Rota', 'Em Carregamento', 'Entregue', 'Finalizado'].includes(quote.status) && (
                    <Button className="w-full" variant="secondary" onClick={() => {
                      const labelData: LabelData = {
                          quoteCode: getQuoteCode(quote),
                          nf: quote.nfNumber || 'N/A',
                          totalVolumes: quote.volumeCount || 0,
                          remetenteName: quote.remetente,
                          origem: quote.enderecoColeta || quote.cidadeOrigem,
                          destinatarioName: quote.destinatario || quote.empresaDestino,
                          entrega: quote.enderecoEntrega || quote.cidadeDestino
                      };
                      printLabels(labelData, companyProfile);
                    }}>
                        <Printer className="mr-2 h-4 w-4" /> Reimprimir Etiquetas
                    </Button>
                )}
            </CardFooter>
        </QuoteCard>
    );
  };

  if (isDataLoading || !currentView || authLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <main className="container mx-auto p-4 md:p-8">
          <Button variant="outline" onClick={() => router.push('/receiving')} className="mb-8">
          &larr; Voltar para a Área de Recebimento
          </Button>
          <div className="space-y-4 mb-8">
              <h1 className="text-3xl font-bold text-primary">{currentView.title}</h1>
              <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                      placeholder="Filtrar por remetente, destino, nº cotação ou nº NF..."
                      value={filter}
                      onChange={e => setFilter(e.target.value)}
                      className="pl-10"
                  />
              </div>
          </div>
          
          {filteredQuotes.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredQuotes.map(quote => <QuoteListCard key={quote.id} quote={quote} />)}
              </div>
          ) : (
              <div className="text-center py-16 border-dashed border-2 rounded-lg">
                  <p className="text-muted-foreground">Nenhuma carga encontrada para esta etapa.</p>
              </div>
          )}
      
      <Dialog open={isConfirmReceiveOpen} onOpenChange={setIsConfirmReceiveOpen}>
        <DialogContent className="max-w-xl">
            <DialogHeader>
                <DialogTitle>Confirmar Recebimento da Carga</DialogTitle>
                <DialogDescription>
                    Cotação: {selectedQuote?.quoteCode || 'N/A'}. <br/>
                    Use uma das opções abaixo para preencher os dados da nota.
                </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="key" className="w-full pt-4">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="key">Por Chave de Acesso</TabsTrigger>
                    <TabsTrigger value="xml">Por XML</TabsTrigger>
                </TabsList>
                <TabsContent value="key" className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label htmlFor="nfeKey">Chave de Acesso da NF-e (44 dígitos)</Label>
                        <div className="flex gap-2">
                            <Input id="nfeKey" value={nfeKey} onChange={(e) => setNfeKey(e.target.value)} placeholder="Cole a chave de 44 dígitos aqui" />
                            <Button onClick={handleFetchNfeDataFromKey} disabled={isFetchingNfe} variant="outline" size="icon">
                                {isFetchingNfe ? <Loader2 className="h-4 w-4 animate-spin"/> : <Search className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="xml" className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label htmlFor="xml-upload">Importar Ficheiro XML</Label>
                        <Input id="xml-upload" type="file" accept=".xml" ref={fileInputRef} onChange={handleXmlFileSelect} className="hidden" />
                        <Button onClick={() => fileInputRef.current?.click()} disabled={isFetchingNfe} variant="outline" className="w-full">
                            {isFetchingNfe ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4" />}
                            Selecionar Ficheiro XML
                        </Button>
                    </div>
                </TabsContent>
            </Tabs>

            <div className="space-y-4 py-4 border-t">
                <div className="space-y-2">
                    <Label htmlFor="nfNumber">Número da Nota Fiscal</Label>
                    <Input id="nfNumber" value={nfNumber} onChange={(e) => setNfNumber(e.target.value)} placeholder="Preenchido automaticamente ou digite" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="volumeCount">Quantidade de Volumes</Label>
                    <Input id="volumeCount" type="number" value={volumeCount} onChange={(e) => setVolumeCount(e.target.value)} placeholder="Ex: 10" />
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild><Button type="button" variant="secondary" disabled={isSubmitting}>Cancelar</Button></DialogClose>
                <Button onClick={handleConfirmReceive} disabled={isSubmitting || isFetchingNfe}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Confirmar e Imprimir Etiquetas
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDispatchRequestOpen} onOpenChange={setIsDispatchRequestOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Solicitar Saída da Carga?</AlertDialogTitle>
                <AlertDialogDescription>
                    A cotação <Badge variant="secondary">{selectedQuote?.quoteCode}</Badge> será marcada como "Aguardando Saída" e a equipe operacional será notificada para agendar o próximo motorista.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDispatchRequest} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                    Confirmar Solicitação
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

       <QuoteCard.DetailsDialog quote={selectedQuote} isOpen={isDetailsDialogOpen} onOpenChange={() => handleCloseDialog(setIsDetailsDialogOpen)} />
      <QuoteCard.HistoryDialog quote={selectedQuote} isOpen={isHistoryDialogOpen} onOpenChange={() => handleCloseDialog(setIsHistoryDialogOpen)} />
      <QuoteCard.ObservationsDialog quote={selectedQuote} isOpen={isObsDialogOpen} onOpenChange={() => handleCloseDialog(setIsObsDialogOpen)} onSubmit={handleUpdate} isSubmitting={isSubmitting} />

      <AlertDialog open={!!quoteToRevert} onOpenChange={(open) => !open && setQuoteToRevert(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Retroceder Etapa?</AlertDialogTitle>
            <AlertDialogDescription>
                Tem a certeza que deseja retroceder a cotação "{quoteToRevert?.quoteCode}" para a etapa anterior?
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRevert} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Confirmar"}
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
