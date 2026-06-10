
"use client";

import { useEffect, useState, useMemo, useRef, useCallback, ChangeEvent } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
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
  Printer,
  ChevronDown,
  CheckCircle,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from 'lucide-react';
import type { Quote, LabelData, Driver, NfeData, PricingSettings } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/api-client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { printLabels } from '@/lib/print';
import { QuoteCard } from '@/components/QuoteCard';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { OperationalEvent } from '@/lib/types';
import { NfeViewerDialog } from '@/components/NfeViewerDialog';
import { NfeDivergenceDialog, NfeDivergenceData } from '@/components/NfeDivergenceDialog';
import { FileText } from 'lucide-react';
import { XmlPreviewDialog } from '@/components/XmlPreviewDialog';
import { parseNfeXml, ParsedNfeData } from '@/lib/xml-parser';
import { PageHeader } from '@/components/PageHeader';

const getQuoteCode = (quote: Quote) => quote.quoteCode || `LEGACY-${quote.id.slice(0, 5)}`;

const statusMap: Record<string, { title: string; filter: (q: Quote) => boolean }> = {
    'awaiting-receipt': { title: 'Aguardando Recebimento', filter: (q) => ['Coleta', 'Aguardando Recebimento', 'Entregue no Galpão'].includes(q.status) },
    'in-warehouse': { title: 'No Galpão', filter: (q) => ['No Galpão', 'Aguardando Saída'].includes(q.status) },
    'dispatched': { title: 'Saídas Recentes', filter: (q) => ['Em Rota', 'Entregue', 'Finalizado'].includes(q.status) }
};

function DispatchScanDialog({
  quote,
  isOpen,
  onOpenChange,
  onConfirm,
  isConfirming,
  canUseAll,
}: {
  quote: Quote | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isConfirming: boolean;
  canUseAll?: boolean;
}) {
  const [scannedBarcodes, setScannedBarcodes] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (quote) {
      setScannedBarcodes([]); // Reset on new quote
    }
  }, [quote]);

  if (!quote) return null;

  const totalVolumes = quote.volumeCount || 0;
  const scannedCount = scannedBarcodes.length;
  const isComplete = totalVolumes > 0 && scannedCount === totalVolumes;

  const handleBarcodeScan = (e: React.FormEvent) => {
    e.preventDefault();
    const barcodeInput = (e.target as any).elements.barcode;
    const barcode = barcodeInput.value.trim().toUpperCase();
    
    if (!barcode) return;

    const quoteCode = quote.quoteCode || `LEGACY-${quote.id.slice(0, 5)}`;
    const expectedPrefixNF = `${quote.nfNumber}-`.toUpperCase();
    const expectedPrefixQuote = `${quoteCode}-`.toUpperCase();
    
    let matchedPrefix = '';
    if (barcode.startsWith(expectedPrefixNF)) matchedPrefix = expectedPrefixNF;
    else if (barcode.startsWith(expectedPrefixQuote)) matchedPrefix = expectedPrefixQuote;
    
    if (!matchedPrefix) {
        toast({ variant: 'destructive', title: 'Código Inválido', description: `O código deve iniciar com ${expectedPrefixNF} ou ${expectedPrefixQuote}` });
        barcodeInput.value = '';
        return;
    }

    const volumeNumberStr = barcode.substring(matchedPrefix.length);
    
    if (volumeNumberStr === 'ALL') {
        if (!canUseAll) {
            toast({ variant: 'destructive', title: 'Acesso Negado', description: 'Você não tem permissão para usar a função de bipar ALL.' });
            barcodeInput.value = '';
            return;
        }
        
        const allBarcodes = Array.from({ length: totalVolumes }, (_, i) => `${matchedPrefix}${i + 1}`);
        setScannedBarcodes(allBarcodes);
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

    if (scannedBarcodes.includes(barcode)) {
        toast({ variant: 'default', title: 'Duplicado', description: `O volume ${volumeNumber} já foi lido.` });
        barcodeInput.value = '';
        return;
    }

    setScannedBarcodes(prev => [...prev, barcode]);
    toast({ title: 'Volume Lido!', description: `Volume ${volumeNumber} de ${totalVolumes} adicionado.` });
    barcodeInput.value = '';
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar Saída: {quote.quoteCode}</DialogTitle>
          <DialogDescription>Bipe todos os volumes para confirmar a saída do galpão.</DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="text-center p-4 bg-muted rounded-lg">
            <p className="text-lg font-semibold">Volumes Lidos</p>
            <p className="text-4xl font-bold">{scannedCount} / {totalVolumes}</p>
          </div>
          <form onSubmit={handleBarcodeScan}>
            <Input name="barcode" placeholder="Bipar etiqueta aqui..." autoFocus />
          </form>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="secondary" disabled={isConfirming}>Cancelar</Button></DialogClose>
          <Button onClick={onConfirm} disabled={!isComplete || isConfirming}>
            {isConfirming ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4"/>}
            Finalizar Saída
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


export default function ReceivingStatusPage() {
  const { user, loading: authLoading, companyProfile, pricingSettings } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const statusParam = (Array.isArray(params.status) ? params.status[0] : params.status) as string;
  const currentView = statusMap[statusParam];
  const quoteCodeFilter = searchParams.get('quoteCode');

  // Estados locais para paginação e busca
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [filter, setFilter] = useState('');
  const [debouncedFilter, setDebouncedFilter] = useState('');

  // Efeito de Debounce no filtro textual
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilter(filter);
      setPage(1); // Reinicia para página 1 ao alterar busca
    }, 400);
    return () => clearTimeout(timer);
  }, [filter]);

  // Mapeamento dos status operacionais da API
  const apiStatusString = useMemo(() => {
    switch (statusParam) {
      case 'awaiting-receipt':
        return 'Coleta,Aguardando Recebimento,Entregue no Galpão';
      case 'in-warehouse':
        return 'No Galpão,Aguardando Saída';
      case 'dispatched':
        return 'Em Rota,Entregue,Finalizado';
      default:
        return '';
    }
  }, [statusParam]);

  const fetchAllData = useCallback(async () => {
    if (!apiStatusString) return;
    setIsDataLoading(true);
    try {
        let url = `/api/quotes?paginated=true&status=${encodeURIComponent(apiStatusString)}&page=${page}&limit=${limit}`;
        
        if (quoteCodeFilter) {
            url += `&term=${encodeURIComponent(quoteCodeFilter)}`;
        } else if (debouncedFilter) {
            url += `&term=${encodeURIComponent(debouncedFilter)}`;
        }
        
        const res = await authFetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error("Falha ao carregar cotações.");
        
        const data = await res.json();
        setQuotes(data.quotes || []);
        setTotalCount(data.totalCount || 0);
        setTotalPages(data.totalPages || 0);
    } catch(e: any) {
        toast({variant: 'destructive', title: 'Erro de Carregamento', description: e.message});
    } finally {
        setIsDataLoading(false);
    }
  }, [toast, apiStatusString, page, limit, debouncedFilter, quoteCodeFilter]);

  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [isConfirmReceiveOpen, setIsConfirmReceiveOpen] = useState(false);
  const [isDispatchRequestOpen, setIsDispatchRequestOpen] = useState(false);
  
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
  const [quoteToDispatch, setQuoteToDispatch] = useState<Quote | null>(null);

  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [isObsDialogOpen, setIsObsDialogOpen] = useState(false);

  const [selectedQuoteForXml, setSelectedQuoteForXml] = useState<Quote | null>(null);
  const xmlFileInputRef = useRef<HTMLInputElement>(null);
  const [isNfeViewerOpen, setIsNfeViewerOpen] = useState(false);
  const [xmlContentToView, setXmlContentToView] = useState('');
  const [nfeChaveToView, setNfeChaveToView] = useState('');
  const [isDivergenceDialogOpen, setIsDivergenceDialogOpen] = useState(false);
  const [divergenceData, setDivergenceData] = useState<NfeDivergenceData | null>(null);

  const [isReceiveXmlPreviewOpen, setIsReceiveXmlPreviewOpen] = useState(false);
  const [parsedReceiveXmlData, setParsedReceiveXmlData] = useState<ParsedNfeData | null>(null);
  const [pendingReceiveXmlText, setPendingReceiveXmlText] = useState('');

  const [isGlobalXmlPreviewOpen, setIsGlobalXmlPreviewOpen] = useState(false);
  const [parsedGlobalXmlData, setParsedGlobalXmlData] = useState<ParsedNfeData | null>(null);
  const [pendingGlobalXmlText, setPendingGlobalXmlText] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (!user || !user.receivingAccess) {
        router.push('/dashboard');
      } else {
        fetchAllData();
      }
    }
  }, [user, authLoading, router, fetchAllData]);

  // Usamos os resultados retornados diretamente do backend (já filtrados e paginados)
  const filteredQuotes = useMemo(() => {
    return quotes;
  }, [quotes]);

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
    
    // Pre-fill with existing data
    setNfNumber(quote.nfNumber || '');
    setVolumeCount(quote.volumeCount || quote.quantidade || '');
    setNfeKey('');
    setRemetente(quote.remetente || '');
    setRemetenteEndereco(quote.enderecoColeta || '');
    setDestinatario(quote.destinatario || quote.empresaDestino || '');
    setDestinatarioEndereco(quote.enderecoEntrega || '');

    if (quote.nfeXml) {
        // Aproveita o XML anexado anteriormente para preencher a tela imediatamente
        handleFetchNfeDataFromXml(quote.nfeXml, false);
    }
    
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
        const operationalEvent: Partial<OperationalEvent> = {
            action,
            details,
            status: updates.status || quote.status,
        };
        const response = await authFetch(`/api/quotes/${quote.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...updates, user, operationalEvent }),
        });
        if(response.ok) {
            toast({ title: 'Sucesso!', description: details });
            await fetchAllData();
            return true;
        } else {
             const errorData = await response.json();
             throw new Error(errorData.message || 'Não foi possível atualizar a cotação.');
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
        const parsed = parseNfeXml(xmlContent);
        if (parsed) {
            setParsedReceiveXmlData(parsed);
            setPendingReceiveXmlText(xmlContent);
            setIsReceiveXmlPreviewOpen(true);
        } else {
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível ler o XML.' });
        }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleConfirmReceiveXml = async () => {
       setIsReceiveXmlPreviewOpen(false);
       if (pendingReceiveXmlText) {
            await handleFetchNfeDataFromXml(pendingReceiveXmlText);
       }
  };

  const handleFetchNfeDataFromXml = async (xmlContent: string, showToast = true) => {
    setIsFetchingNfe(true);
    try {
        const response = await authFetch('/api/nfe', {
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
            if (showToast) toast({ title: 'Dados da NF-e carregados com sucesso!' });
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
    const cleanKey = nfeKey.replace(/\D/g, '');
    if (!cleanKey || cleanKey.length !== 44) {
        toast({ variant: 'destructive', title: 'Chave Inválida', description: 'Por favor, insira uma chave de acesso com 44 dígitos.' });
        return;
    }
    setIsFetchingNfe(true);
    try {
        // Buscar dados básicos pela chave (BrasilAPI)
        const response = await authFetch(`/api/nfe?key=${cleanKey}`);
        if (response.ok) {
            const data: NfeData = await response.json();
            setNfNumber(data.nfNumber);
            setVolumeCount(data.volumeCount);
            setRemetente(data.remetente);
            setRemetenteEndereco(data.remetenteEndereco);
            setDestinatario(data.destinatario);
            setDestinatarioEndereco(data.destinatarioEndereco);
            toast({ title: 'Dados carregados', description: 'Dados extraídos da chave com sucesso.' });
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
    if (!selectedQuote || !nfNumber.trim() || !volumeCount || !pricingSettings || !user) {
        toast({ variant: 'destructive', title: 'Campos em Falta', description: 'Número da NF, Quantidade de Volumes são obrigatórios, e você deve estar logado.' });
        return;
    }
    setIsSubmitting(true);

    const updates: Partial<Quote> = {
      status: 'No Galpão' as const,
      nfNumber: nfNumber,
      volumeCount: Number(volumeCount),
      remetente: remetente,
      destinatario: destinatario,
      enderecoColeta: remetenteEndereco,
      enderecoEntrega: destinatarioEndereco,
      nfeChave: nfeKey.replace(/\D/g, '') || undefined,
    };
    
    try {
        const response = await authFetch(`/api/quotes/${selectedQuote.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                ...updates, 
                user,
                operationalEvent: {
                    action: 'RECEBIDO_GALPAO',
                    details: 'Carga recebida fisicamente no galpão e conferida.',
                    status: 'No Galpão'
                }
            }),
        });

        if (!response.ok) {
             const errorData = await response.json();
             throw new Error(errorData.message || 'Não foi possível atualizar a cotação.');
        }

        toast({ title: 'Sucesso!', description: 'Carga recebida no galpão.' });
        
        if (companyProfile && pricingSettings?.printing?.labels) {
            const labelData: LabelData = {
                quoteCode: getQuoteCode(selectedQuote),
                nf: nfNumber,
                totalVolumes: Number(volumeCount),
                remetenteName: updates.remetente || selectedQuote.remetente,
                origem: updates.enderecoColeta || selectedQuote.cidadeOrigem,
                destinatarioName: updates.destinatario || selectedQuote.empresaDestino,
                entrega: updates.enderecoEntrega || selectedQuote.cidadeDestino
            };
            
            try {
                await authFetch('/api/stock/labels', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...labelData, quoteId: selectedQuote.id }),
                });
            } catch (e) { console.error("Failed to save label data:", e); }

            try {
                await printLabels({ labelData, companyProfile, printingSettings: pricingSettings.printing.labels });
            } catch (printError) {
                console.error("Printing failed:", printError);
                toast({ variant: 'destructive', title: 'Erro de Impressão', description: 'Não foi possível imprimir as etiquetas, mas a cotação foi atualizada.' });
            }
        }
        
        setIsConfirmReceiveOpen(false);
        await fetchAllData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleDispatchRequest = async () => {
    if (!selectedQuote || !user) return;
    const success = await handleUpdate(selectedQuote, { status: 'Aguardando Saída' }, 'SOLICITACAO_SAIDA', 'Solicitação de saída do galpão enviada para a equipe operacional.');
    if (success) {
      setIsDispatchRequestOpen(false);
    }
  };

  const handleConfirmDispatch = async () => {
    if (!quoteToDispatch) return;
    const success = await handleUpdate(quoteToDispatch, { status: 'Em Rota' }, 'SAIDA_GALPAO_CONFIRMADA', 'Saída física da carga do galpão confirmada.');
    if (success) {
      setQuoteToDispatch(null);
    }
  };

  const handleConfirmRevert = async () => {
    if (!quoteToRevert || !quoteToRevert.operationalHistory || quoteToRevert.operationalHistory.length === 0) return;
    setIsSubmitting(true);
    
    const sortedHistory = [...quoteToRevert.operationalHistory].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const lastEvent = sortedHistory.length > 0 ? sortedHistory[sortedHistory.length - 1] : null;

    const newHistory = lastEvent ? sortedHistory.slice(0, -1) : [];
    const prevStatus = newHistory.length > 0 ? newHistory[newHistory.length - 1].status : 'Fechada';
    
    let newTotalExpense = quoteToRevert.totalExpense || 0;

    if (lastEvent && lastEvent.expense && lastEvent.expense > 0) {
        newTotalExpense = Math.max(0, newTotalExpense - lastEvent.expense);
    }

    const lastDriverEvent = [...newHistory].reverse().find(e => e.driverId);
    const prevDriverId = lastDriverEvent ? lastDriverEvent.driverId : null;
    const prevDriverName = lastDriverEvent ? lastDriverEvent.driverName : null;

    const body: any = {
        status: prevStatus,
        operationalHistory: newHistory,
        totalExpense: newTotalExpense,
        driverId: prevDriverId,
        driverName: prevDriverName,
        user,
    };

    if (prevStatus === 'Aberta' && quoteToRevert.status === 'Fechada') {
        body.billingDueDate = null;
        body.billingHistory = [];
        body.paymentStatus = null;
    }

    try {
        const response = await authFetch(`/api/quotes/${quoteToRevert.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Falha ao reverter a etapa.');
        }
        
        if (lastEvent?.id) {
            const expenseResponse = await authFetch(`/api/expenses/by-event/${lastEvent.id}`, {
                method: 'DELETE'
            });
            if (!expenseResponse.ok) {
                console.warn(`Falha ao apagar despesa associada ao evento ${lastEvent.id}`);
            }
        }

        toast({ title: 'Sucesso!', description: 'A etapa operacional foi revertida.' });
        await fetchAllData();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
        setQuoteToRevert(null);
        setIsSubmitting(false);
    }
  };
  
  const handleReprintLabels = async (quoteToPrint: Quote) => {
    if (!pricingSettings) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Configurações de impressão não carregadas.' });
      return;
    }
    toast({ title: 'A processar...', description: 'A buscar dados da etiqueta para reimpressão.' });
    try {
        const response = await authFetch(`/api/stock/labels?quoteId=${quoteToPrint.id}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Dados da etiqueta não encontrados.');
        }
        const labelData: LabelData = await response.json();
        await printLabels({ labelData, companyProfile, printingSettings: pricingSettings.printing.labels });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Erro ao Reimprimir', description: e.message });
    }
  };

  const handleTriggerXmlUpload = (quote: Quote) => {
      setSelectedQuoteForXml(quote);
      if (xmlFileInputRef.current) xmlFileInputRef.current.click();
  };

  const proceedWithXmlUpload = async (peso: number, quantidade: number, nfeXml: string, nfNumber: string, nfeChave: string, quoteId: string, nfeParties?: any) => {
      setIsSubmitting(true);
      try {
          const response = await authFetch(`/api/quotes/${quoteId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ nfeXml, peso, volumeCount: quantidade, nfNumber, nfeChave, nfeParties, user }),
          });
          if(response.ok) {
              toast({ title: 'Sucesso!', description: 'Arquivo XML anexado à cotação.' });
              await fetchAllData();
              setIsDivergenceDialogOpen(false);
              setSelectedQuoteForXml(null);
          } else {
              throw new Error('Falha ao anexar XML.');
          }
      } catch(err: any) {
          toast({ variant: 'destructive', title: 'Erro', description: err.message });
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleGlobalXmlFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !selectedQuoteForXml || !user) return;
      setIsSubmitting(true);
      const reader = new FileReader();
      reader.onload = async (e) => {
          const xmlContent = e.target?.result as string;
          const parsed = parseNfeXml(xmlContent);
          if (parsed) {
              setParsedGlobalXmlData(parsed);
              setPendingGlobalXmlText(xmlContent);
              setIsGlobalXmlPreviewOpen(true);
          } else {
              toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível ler o XML.' });
              setSelectedQuoteForXml(null);
          }
          setIsSubmitting(false);
      };
      reader.readAsText(file);
      event.target.value = '';
  };

  const handleConfirmGlobalXml = async () => {
      setIsGlobalXmlPreviewOpen(false);
      if (!pendingGlobalXmlText || !selectedQuoteForXml || !user) return;
      setIsSubmitting(true);
      
      const xmlContent = pendingGlobalXmlText;
      try {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
          const pesoB = xmlDoc.getElementsByTagName("pesoB")[0]?.textContent || xmlDoc.getElementsByTagName("qVol")[0]?.textContent;
          const qVol = xmlDoc.getElementsByTagName("qVol")[0]?.textContent;
          const chNFe = xmlDoc.getElementsByTagName("chNFe")[0]?.textContent || xmlDoc.getElementsByTagName("Id")[0]?.textContent?.replace('NFe', '') || '';
          const nNF = xmlDoc.getElementsByTagName("nNF")[0]?.textContent || '';
          
          // Extração NFe Parties (Emitente / Destinatário)
          const extractParty = (tagName: string) => {
              const tag = xmlDoc.getElementsByTagName(tagName)[0];
              if (!tag) return null;
              const cnpjCpf = tag.getElementsByTagName('CNPJ')[0]?.textContent || tag.getElementsByTagName('CPF')[0]?.textContent || '';
              const name = tag.getElementsByTagName('xNome')[0]?.textContent || '';
              const ie = tag.getElementsByTagName('IE')[0]?.textContent || '';
              const ender = tag.getElementsByTagName(tagName === 'emit' ? 'enderEmit' : 'enderDest')[0];
              let address = '', city = '', state = '', zipCode = '', cMun = '';
              if (ender) {
                  address = `${ender.getElementsByTagName('xLgr')[0]?.textContent || ''}, ${ender.getElementsByTagName('nro')[0]?.textContent || ''} - ${ender.getElementsByTagName('xBairro')[0]?.textContent || ''}`;
                  city = ender.getElementsByTagName('xMun')[0]?.textContent || '';
                  state = ender.getElementsByTagName('UF')[0]?.textContent || '';
                  zipCode = ender.getElementsByTagName('CEP')[0]?.textContent || '';
                  cMun = ender.getElementsByTagName('cMun')[0]?.textContent || '';
              }
              return { cnpjCpf, name, ie, address, city, state, zipCode, cMun };
          };
          
          const emitente = extractParty('emit');
          const destinatario = extractParty('dest');
          
          // Determinar tomador de forma inteligente para visualização de confirmação
          let tomador = null;
          const quoteTomadorLower = (selectedQuoteForXml.tomador || '').toLowerCase().trim();
          const quoteRemetenteLower = (selectedQuoteForXml.remetente || '').toLowerCase().trim();
          const quoteDestinatarioLower = (selectedQuoteForXml.destinatario || '').toLowerCase().trim();
          
          const emitNameLower = (emitente?.name || '').toLowerCase().trim();
          const destNameLower = (destinatario?.name || '').toLowerCase().trim();
          
          if (
            quoteTomadorLower === 'remetente' || 
            (quoteRemetenteLower && (quoteTomadorLower === quoteRemetenteLower || quoteTomadorLower.includes(quoteRemetenteLower) || quoteRemetenteLower.includes(quoteTomadorLower))) ||
            (emitNameLower && (emitNameLower.includes(quoteTomadorLower) || quoteTomadorLower.includes(emitNameLower)))
          ) {
            tomador = emitente;
          } else if (
            quoteTomadorLower === 'destinatario' || 
            (quoteDestinatarioLower && (quoteTomadorLower === quoteDestinatarioLower || quoteTomadorLower.includes(quoteDestinatarioLower) || quoteDestinatarioLower.includes(quoteTomadorLower))) ||
            (destNameLower && (destNameLower.includes(quoteTomadorLower) || quoteTomadorLower.includes(destNameLower)))
          ) {
            tomador = destinatario;
          } else {
            tomador = emitente || destinatario;
          }
          
          const nfeParties = { emitente, destinatario, tomador };
          
          const nfeWeight = Number(pesoB || 0);
          const nfeVolumes = Number(qVol || 0);
          const quoteWeight = Number(selectedQuoteForXml.peso || 0);
          const quoteVolumes = Number(selectedQuoteForXml.volumeCount || selectedQuoteForXml.quantidade || 0);
          
          // Sempre exibir a tela de conferência e confirmação para segurança total
          setDivergenceData({ quoteWeight, quoteVolumes, nfeWeight, nfeVolumes, xmlContent, nfeParties } as any);
          setIsSubmitting(false);
          setIsDivergenceDialogOpen(true);
      } catch(err: any) {
          toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível anexar o XML.' });
          setIsSubmitting(false);
          setSelectedQuoteForXml(null);
      }
  };

  const handleViewNfe = (quote: Quote) => {
      setSelectedQuote(quote);
      setXmlContentToView(quote.nfeXml || '');
      setNfeChaveToView(quote.nfeChave || '');
      setIsNfeViewerOpen(true);
  };

  const handleRemoveNfe = async (quote: Quote) => {
      if (!user) return;
      setIsSubmitting(true);
      try {
          const response = await authFetch(`/api/quotes/${quote.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  nfeXml: null,
                  nfeChave: null,
                  nfNumber: null,
                  peso: 0,
                  volumeCount: 0,
                  user
              }),
          });
          if (response.ok) {
              toast({ title: 'Sucesso!', description: 'NF-e removida com sucesso da cotação.' });
              setIsNfeViewerOpen(false);
              await fetchAllData();
          } else {
              const errorText = await response.text();
              throw new Error(errorText || 'Falha ao remover XML da cotação.');
          }
      } catch(err: any) {
          toast({ variant: 'destructive', title: 'Erro', description: err.message });
      } finally {
          setIsSubmitting(false);
      }
  };


  const handleManualConfirmCollection = async (quote: Quote) => {
    if (!user) return;
    
    const lastDriverEvent = [...(quote.operationalHistory || [])].reverse().find(e => e.driverId);
    if (!lastDriverEvent) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível encontrar o evento de atribuição do motorista.' });
        return;
    }
    
    setIsSubmitting(true);
    const isDirectDelivery = lastDriverEvent.action === 'COLETA_PARA_ENTREGA_DIRETA';
    const nextStatus = isDirectDelivery ? 'Em Rota' : 'Aguardando Recebimento';
    
    const operationalEvent: Partial<OperationalEvent> = {
        action: 'COLETA_MANUAL',
        details: `Coleta confirmada manualmente por ${user.username} em nome de ${lastDriverEvent.driverName}.`,
        status: nextStatus,
    };
    
    try {
        const response = await authFetch(`/api/quotes/${quote.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: nextStatus,
                user,
                operationalEvent,
            }),
        });
        if (!response.ok) throw new Error('Falha ao confirmar coleta');
        toast({ title: 'Sucesso!', description: 'Coleta confirmada manualmente.' });
        await fetchAllData();
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
        setIsSubmitting(false);
    }
  };

  const QuoteListCard = ({ quote }: { quote: Quote }) => {
    
    let manageAction;
    let manageLabel = '';

    switch(statusParam) {
        case 'awaiting-receipt':
            if (quote.status === 'Coleta') {
                // Cotação com motorista atribuído mas coleta não confirmada
                manageAction = undefined;
                manageLabel = 'Aguardando Coleta';
            } else {
                manageAction = () => handleOpenReceiveDialog(quote);
                manageLabel = 'Confirmar Recebimento';
            }
            break;
        case 'in-warehouse':
            if (quote.status === 'No Galpão') {
                manageAction = () => handleOpenDispatchRequestDialog(quote);
                manageLabel = 'Solicitar Saída';
            } else if (quote.status === 'Aguardando Saída') {
                manageAction = () => setQuoteToDispatch(quote);
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
            manageButtonLabel={manageLabel}
            onOpenDetails={(q) => handleOpenDialog(q, setIsDetailsDialogOpen)}
            onOpenHistory={(q) => handleOpenDialog(q, setIsHistoryDialogOpen)}
            onOpenObs={(q) => handleOpenDialog(q, setIsObsDialogOpen)}
            onSetQuoteToRevert={
                statusParam === 'dispatched'
                    ? (quote.status === 'Em Rota' ? setQuoteToRevert : undefined)
                    : setQuoteToRevert
            }
            onManualConfirmCollection={handleManualConfirmCollection}
            isSubmitting={isSubmitting}
        >
             <CardFooter className="p-2 pt-0 flex flex-col gap-2">
                {(quote.nfeXml || quote.nfeChave) ? (
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={() => handleViewNfe(quote)}>
                        <FileText className="mr-2 h-4 w-4" /> Visualizar NF-e
                    </Button>
                ) : (
                    <Button className="w-full" variant="outline" onClick={() => handleTriggerXmlUpload(quote)}>
                        <Upload className="mr-2 h-4 w-4" /> Anexar NF-e (XML)
                    </Button>
                )}
                {['No Galpão', 'Aguardando Saída', 'Em Rota', 'Em Carregamento', 'Entregue', 'Finalizado'].includes(quote.status) && (
                    <Button className="w-full" variant="secondary" onClick={() => handleReprintLabels(quote)}>
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
    <main className="container mx-auto p-4 md:p-8 relative overflow-hidden">
          {/* Efeitos de desfoque e brilho aurora neon atrás dos cards */}
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/15 rounded-full blur-[100px] pointer-events-none -z-10 animate-float-blur-1" />
          <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-purple-500/15 rounded-full blur-[120px] pointer-events-none -z-10 animate-float-blur-2" />

          <input type="file" ref={xmlFileInputRef} className="hidden" onChange={handleGlobalXmlFileSelect} accept=".xml"/>
          
          <NfeViewerDialog 
              isOpen={isNfeViewerOpen} 
              onOpenChange={setIsNfeViewerOpen} 
              xmlContent={xmlContentToView} 
              nfeChave={nfeChaveToView} 
              onRemove={selectedQuote ? () => handleRemoveNfe(selectedQuote) : undefined}
          />
          
          <XmlPreviewDialog 
              isOpen={isReceiveXmlPreviewOpen} 
              onClose={() => {
                  setIsReceiveXmlPreviewOpen(false);
                  setParsedReceiveXmlData(null);
                  setPendingReceiveXmlText('');
              }}
              parsedData={parsedReceiveXmlData}
              onConfirm={handleConfirmReceiveXml}
          />

          <XmlPreviewDialog 
              isOpen={isGlobalXmlPreviewOpen} 
              onClose={() => {
                  setIsGlobalXmlPreviewOpen(false);
                  setParsedGlobalXmlData(null);
                  setPendingGlobalXmlText('');
                  setSelectedQuoteForXml(null);
              }}
              parsedData={parsedGlobalXmlData}
              onConfirm={handleConfirmGlobalXml}
          />

          <NfeDivergenceDialog 
              isOpen={isDivergenceDialogOpen} 
              onOpenChange={setIsDivergenceDialogOpen} 
              data={divergenceData}
              onConfirm={(w, v, xml) => {
                  const parser = new DOMParser();
                  const xmlDoc = parser.parseFromString(xml, "text/xml");
                  const chNFe = xmlDoc.getElementsByTagName("chNFe")[0]?.textContent || xmlDoc.getElementsByTagName("Id")[0]?.textContent?.replace('NFe', '') || '';
                  const nNF = xmlDoc.getElementsByTagName("nNF")[0]?.textContent || '';
                  const nfeParties = (divergenceData as any)?.nfeParties;
                  proceedWithXmlUpload(w, v, xml, nNF, chNFe, selectedQuoteForXml?.id || '', nfeParties);
              }}
          />

          <PageHeader
              icon={<PackageCheck className="h-4 w-4" />}
              badge="Recebimento"
              titlePrefix="Status:"
              titleHighlight={currentView.title}
              description="Gerencie o recebimento, bipagem de volumes e confecção de etiquetas para as cargas nesta etapa operacional."
              backHref={quoteCodeFilter ? `/receiving/status/${statusParam}` : "/receiving"}
              backLabel={quoteCodeFilter ? "Voltar para Status" : "Voltar para Área de Recebimento"}
          />

          <div className="mb-8">
              {quoteCodeFilter ? (
                  <div className="flex items-center gap-3 p-4 bg-primary/5 backdrop-blur-sm border border-primary/20 rounded-xl shadow-sm">
                      <Search className="h-5 w-5 text-primary flex-shrink-0" />
                      <p className="text-sm text-foreground flex-grow">
                          Exibindo resultado da busca: <strong className="text-primary font-mono bg-primary/10 px-2 py-1 rounded-md">{quoteCodeFilter}</strong>
                      </p>
                      <Button variant="outline" size="sm" onClick={() => router.replace(`/receiving/status/${statusParam}`)} className="border-primary/20 hover:bg-primary/10">
                          Limpar Filtro
                      </Button>
                  </div>
              ) : (
                  <div className="relative group max-w-2xl">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input
                          placeholder="Filtrar por remetente, destino, nº cotação ou nº NF..."
                          value={filter}
                          onChange={e => setFilter(e.target.value)}
                          className="pl-10 h-12 bg-card/60 backdrop-blur-xl border-border/50 focus:border-primary/50 focus:ring-primary/20 shadow-sm transition-all"
                      />
                  </div>
              )}
          </div>
          
          {filteredQuotes.length > 0 ? (
              <>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {filteredQuotes.map(quote => <QuoteListCard key={quote.id} quote={quote} />)}
                  </div>
                  {totalPages > 1 && (
                      <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-card/40 backdrop-blur-xl border border-border/50 rounded-xl shadow-lg">
                          <div className="text-sm text-muted-foreground">
                              Exibindo cotações <span className="font-semibold text-foreground">{(page - 1) * limit + 1}</span> a{' '}
                              <span className="font-semibold text-foreground">
                                  {Math.min(page * limit, totalCount)}
                              </span>{' '}
                              de <span className="font-semibold text-foreground">{totalCount}</span>
                          </div>
                          <div className="flex items-center gap-2">
                              <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setPage(1)}
                                  disabled={page === 1}
                                  className="h-9 w-9 p-0 border-border/40 hover:bg-primary/10 transition-colors"
                                  title="Primeira Página"
                              >
                                  <ChevronsLeft className="h-4 w-4" />
                              </Button>
                              <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                                  disabled={page === 1}
                                  className="h-9 w-9 p-0 border-border/40 hover:bg-primary/10 transition-colors"
                                  title="Página Anterior"
                              >
                                  <ChevronLeft className="h-4 w-4" />
                              </Button>
                              <span className="text-sm text-muted-foreground px-2">
                                  Página <span className="font-semibold text-foreground">{page}</span> de{' '}
                                  <span className="font-semibold text-foreground">{totalPages}</span>
                              </span>
                              <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                                  disabled={page === totalPages}
                                  className="h-9 w-9 p-0 border-border/40 hover:bg-primary/10 transition-colors"
                                  title="Próxima Página"
                              >
                                  <ChevronRight className="h-4 w-4" />
                              </Button>
                              <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setPage(totalPages)}
                                  disabled={page === totalPages}
                                  className="h-9 w-9 p-0 border-border/40 hover:bg-primary/10 transition-colors"
                                  title="Última Página"
                              >
                                  <ChevronsRight className="h-4 w-4" />
                              </Button>
                          </div>
                          <div className="flex items-center gap-2">
                              <label htmlFor="limit-select" className="text-sm text-muted-foreground">Itens por página:</label>
                              <select
                                  id="limit-select"
                                  value={limit}
                                  onChange={(e) => {
                                      setLimit(Number(e.target.value));
                                      setPage(1);
                                  }}
                                  className="h-9 rounded-md border border-border/40 bg-card/50 text-sm px-2 focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer"
                              >
                                  <option value={20}>20</option>
                                  <option value={50}>50</option>
                                  <option value={100}>100</option>
                              </select>
                          </div>
                      </div>
                  )}
              </>
          ) : (
              <div className="text-center py-20 border-dashed border-2 border-border/50 bg-card/30 backdrop-blur-sm rounded-xl">
                  <PackageCheck className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground text-lg">Nenhuma carga encontrada para esta etapa.</p>
              </div>
          )}
      
      <Dialog open={isConfirmReceiveOpen} onOpenChange={(open) => { if(!open) resetFormFields(); setIsConfirmReceiveOpen(open)}}>
        <DialogContent className="max-w-xl h-[90vh] flex flex-col">
            <DialogHeader>
                <DialogTitle>Confirmar Recebimento da Carga</DialogTitle>
                <DialogDescription>
                    Cotação: {selectedQuote?.quoteCode || 'N/A'}. <br/>
                    Use uma das opções abaixo para preencher os dados da nota.
                </DialogDescription>
            </DialogHeader>

            <ScrollArea className="flex-1 -mx-6 px-6">
                <div className='py-4'>
                    <Tabs defaultValue="key" className="w-full">
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
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="nfNumber">Número da Nota Fiscal</Label>
                                <Input id="nfNumber" value={nfNumber} onChange={(e) => setNfNumber(e.target.value)} placeholder="Preenchido automaticamente ou digite" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="volumeCount">Quantidade de Volumes</Label>
                                <Input id="volumeCount" type="number" value={volumeCount} onChange={(e) => setVolumeCount(e.target.value)} placeholder="Ex: 10" />
                            </div>
                        </div>
                        <Collapsible>
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" className="w-full justify-between items-center text-sm p-2">
                                    Expandir Detalhes de Endereço
                                    <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                                </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="space-y-4 pt-4 overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                                <div className="space-y-2">
                                    <Label htmlFor="remetente">Remetente</Label>
                                    <Input id="remetente" value={remetente} onChange={(e) => setRemetente(e.target.value)} placeholder="Nome do Remetente" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="remetenteEndereco">Endereço de Coleta</Label>
                                    <Textarea id="remetenteEndereco" value={remetenteEndereco} onChange={(e) => setRemetenteEndereco(e.target.value)} placeholder="Endereço completo de coleta" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="destinatario">Destinatário</Label>
                                    <Input id="destinatario" value={destinatario} onChange={(e) => setDestinatario(e.target.value)} placeholder="Nome do Destinatário" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="destinatarioEndereco">Endereço de Entrega</Label>
                                    <Textarea id="destinatarioEndereco" value={destinatarioEndereco} onChange={(e) => setDestinatarioEndereco(e.target.value)} placeholder="Endereço completo de entrega" />
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    </div>
                </div>
            </ScrollArea>
            <DialogFooter>
                <DialogClose asChild><Button type="button" variant="secondary" disabled={isSubmitting}>Cancelar</Button></DialogClose>
                <Button onClick={handleConfirmReceive} disabled={isSubmitting || isFetchingNfe || !nfNumber.trim() || !volumeCount}>
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

       <DispatchScanDialog
        quote={quoteToDispatch}
        isOpen={!!quoteToDispatch}
        onOpenChange={(open) => { if (!open) setQuoteToDispatch(null); }}
        onConfirm={handleConfirmDispatch}
        isConfirming={isSubmitting}
        canUseAll={user?.subPermissions?.receiving?.canUseScannerAllFunction}
      />

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

    