

"use client";

import { useEffect, useState, useMemo, useCallback, useRef, ChangeEvent } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { authFetch } from '@/lib/api-client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  Search,
  DollarSign,
  UserPlus,
  UserSearch,
  Save,
  PlusCircle,
  Upload,
  Trash2,
  Calendar as CalendarIcon,
  ClipboardCheck,
} from 'lucide-react';
import type { Quote, QuoteStatus, Driver, OperationalEvent, User } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { QuoteCard } from '@/components/QuoteCard';
import { v4 as uuidv4 } from 'uuid';
import { addDays, format, parseISO } from 'date-fns';
import { DriverManagement } from '@/components/DriverManagement';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { getQuoteCode } from '@/lib/utils';
import { NfeViewerDialog } from '@/components/NfeViewerDialog';
import { NfeDivergenceDialog, NfeDivergenceData } from '@/components/NfeDivergenceDialog';
import { NfeAttachmentDialog } from '@/components/NfeAttachmentDialog';
import { FileText } from 'lucide-react';
import { StarRating } from '@/components/StarRating';


const statusLabelMap: Record<string, string> = {
    'coleta': 'Coleta',
    'no-galpao': 'No Galpão',
    'em-rota': 'Em Rota',
    'entregue': 'Entregue',
    'finalizado': 'Finalizado'
};

const operationalStatuses: QuoteStatus[] = ['Coleta', 'No Galpão', 'Em Rota', 'Entregue', 'Finalizado'];

const QuoteCardSkeleton = () => (
    <Card className="flex flex-col">
        <CardHeader className="p-4 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="flex-grow p-4 pt-0 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <div className="pt-4 text-center">
                <Skeleton className="h-8 w-3/4 mx-auto" />
            </div>
        </CardContent>
        <CardFooter className="p-2 pt-0 flex justify-end gap-1">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
        </CardFooter>
    </Card>
);


export default function StatusDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]); // Assuming a simple structure for now
  const [isDataLoading, setIsDataLoading] = useState(true);

  const statusParam = (Array.isArray(params.status) ? params.status[0] : params.status) as string;
  const currentStatus = (statusLabelMap as Record<string, string>)[statusParam] as QuoteStatus;
  const quoteCodeFilter = searchParams.get('quoteCode');
  
  const fetchData = useCallback(async () => {
    setIsDataLoading(true);
    try {
        const [quotesRes, driversRes, vehiclesRes] = await Promise.all([
            authFetch(`/api/quotes?t=${Date.now()}`),
            authFetch('/api/drivers'),
            authFetch('/api/vehicles'),
        ]);
        if (!quotesRes.ok || !driversRes.ok || !vehiclesRes.ok) throw new Error("Falha ao carregar dados.");
        setQuotes(await quotesRes.json());
        setDrivers(await driversRes.json());
        setVehicles(await vehiclesRes.json());
    } catch (e: any) {
        toast({variant: 'destructive', title: 'Erro de Carregamento', description: e.message});
    } finally {
        setIsDataLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
    if (!authLoading && user?.operationalAccess) {
        fetchData();
    }
  }, [user, authLoading, fetchData]);


  const [filter, setFilter] = useState('');
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isObsDialogOpen, setIsObsDialogOpen] = useState(false);
  const [obsText, setObsText] = useState('');
  const [quoteToRevert, setQuoteToRevert] = useState<Quote | null>(null);
  const [quoteForProofAction, setQuoteForProofAction] = useState<Quote | null>(null);

  const [selectedQuoteForXml, setSelectedQuoteForXml] = useState<Quote | null>(null);
  const [isNfeAttachmentOpen, setIsNfeAttachmentOpen] = useState(false);
  const [isNfeViewerOpen, setIsNfeViewerOpen] = useState(false);
  const [xmlContentToView, setXmlContentToView] = useState('');
  const [nfeChaveToView, setNfeChaveToView] = useState('');
  const [isDivergenceDialogOpen, setIsDivergenceDialogOpen] = useState(false);
  const [divergenceData, setDivergenceData] = useState<NfeDivergenceData | null>(null);

  const [isDriverSearchOpen, setIsDriverSearchOpen] = useState(false);
  const [driverSearchTerm, setDriverSearchTerm] = useState('');
  const [searchedDrivers, setSearchedDrivers] = useState<Driver[]>([]);
  const [isSearchingDrivers, setIsSearchingDrivers] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isManifestDialogOpen, setIsManifestDialogOpen] = useState(false);
  const [manifestDriverId, setManifestDriverId] = useState('');
  const [selectedQuoteIdsForManifest, setSelectedQuoteIdsForManifest] = useState<string[]>([]);
  const [manifestConsultationNumber, setManifestConsultationNumber] = useState('');
  const [isAddDriverDialogOpen, setIsAddDriverDialogOpen] = useState(false);

  const [isGenerateOCDialogOpen, setIsGenerateOCDialogOpen] = useState(false);
  const [ocUrl, setOcUrl] = useState('');

  const [availableStatuses, setAvailableStatuses] = useState<QuoteStatus[]>([]);
  const [nextStatus, setNextStatus] = useState<QuoteStatus>('Coleta');
  const [nfNumber, setNfNumber] = useState('');
  const [volumeCount, setVolumeCount] = useState<number | string>('');
  const [expense, setExpense] = useState(0);
  const [maskedExpense, setMaskedExpense] = useState('R$ 0,00');
  const [driverId, setDriverId] = useState<string | undefined>(undefined);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [consultationNumber, setConsultationNumber] = useState('');
  const [billingDueDate, setBillingDueDate] = useState('');
  const [driverRating, setDriverRating] = useState(0);

  const proofFileInputRef = useRef<HTMLInputElement>(null);

  const selectedDriverName = useMemo(() => {
    if (selectedDriver) return selectedDriver.name;
    if (!driverId) return '';
    const driver = drivers.find(d => d.id === driverId);
    if(driver) return driver.name;
    const searchedDriver = searchedDrivers.find(d => d.id === driverId);
    return searchedDriver?.name || '';
  }, [driverId, drivers, searchedDrivers, selectedDriver]);

  const searchDrivers = useCallback(async (term: string) => {
    if (term.length < 2) {
      setSearchedDrivers([]);
      return;
    }
    setIsSearchingDrivers(true);
    try {
      const response = await authFetch(`/api/drivers/search?term=${encodeURIComponent(term)}`);
      if (response.ok) {
        setSearchedDrivers(await response.json());
      } else {
        setSearchedDrivers([]);
      }
    } catch (error: any) {
      console.error("Failed to search for drivers:", error);
      toast({ variant: 'destructive', title: 'Erro de Busca', description: 'Não foi possível buscar os motoristas.' });
    } finally {
      setIsSearchingDrivers(false);
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

    const handleOpenManageDialog = useCallback((quote: Quote) => {
        setSelectedQuote(quote);

        const canSkipSteps = (user?.role === 'admin' || user?.role === 'user') || quote.freightMode === 'dedicado';
        const effectiveStatus = quote.status === 'Fechada' ? 'Coleta' : quote.status;
        const currentStatusIndex = operationalStatuses.indexOf(effectiveStatus);

        let statusesToShow: QuoteStatus[] = [];
        let defaultNextStatus: QuoteStatus;

        if (canSkipSteps && currentStatusIndex < operationalStatuses.length - 1) {
            statusesToShow = operationalStatuses.slice(currentStatusIndex + 1);
            defaultNextStatus = statusesToShow[0];
        } else {
            let nextLogicalStatus: QuoteStatus;
            if (effectiveStatus === 'No Galpão') {
                nextLogicalStatus = 'Em Rota';
            } else if (effectiveStatus === 'Entregue') {
                nextLogicalStatus = 'Finalizado';
            } else if (effectiveStatus === 'Coleta') {
                nextLogicalStatus = 'No Galpão';
            } else {
                nextLogicalStatus = effectiveStatus;
            }
            statusesToShow = [nextLogicalStatus];
            defaultNextStatus = nextLogicalStatus;
        }

        setAvailableStatuses(statusesToShow);
        setNextStatus(defaultNextStatus);

        if (quote.status === 'Fechada') {
            setBillingDueDate(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
        }

        setNfNumber(quote.nfNumber || '');
        setVolumeCount(quote.volumeCount || quote.quantidade || '');
        setExpense(0);
        setMaskedExpense('R$ 0,00');
        
        // Sempre pre-popular o último motorista selecionado (ex: persiste o motorista da Coleta para a Rota)
        const sortedHistory = [...(quote.operationalHistory || [])].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        const latestDriverEvent = sortedHistory.find(h => h.driverId);
        if (latestDriverEvent) {
            setDriverId(latestDriverEvent.driverId);
            setSelectedDriver({
                id: latestDriverEvent.driverId,
                name: latestDriverEvent.driverName || ''
            } as Driver);
        } else {
            setDriverId(undefined);
            setSelectedDriver(null);
        }
        
        setConsultationNumber('');
        setDriverRating(0);
        setIsManageDialogOpen(true);
    }, [user]);

  
  const handleOpenDetailsDialog = useCallback((quote: Quote) => {
    setSelectedQuote(quote);
    setIsDetailsDialogOpen(true);
  }, []);

  const handleOpenHistoryDialog = useCallback((quote: Quote) => {
    setSelectedQuote(quote);
    setIsHistoryDialogOpen(true);
  }, []);

  const handleOpenObsDialog = useCallback((quote: Quote) => {
    setSelectedQuote(quote);
    setObsText(quote.obs || '');
    setIsObsDialogOpen(true);
  }, []);
  
  const handleCurrencyChange = (e: ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    const numericValue = Number(rawValue) / 100;
    setExpense(numericValue);
    setMaskedExpense(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numericValue));
  };


    const handleUpdateOperationalStatus = useCallback(async () => {
        if (!selectedQuote || !user) return;
        
        setIsSubmitting(true);

        const expenseValue = expense;
        const selectedDriver = drivers.find(d => d.id === driverId);
        const canSkipSteps = (user?.role === 'admin' || user?.role === 'user') || selectedQuote.freightMode === 'dedicado';

        let eventAction: string = 'ETAPA_OPERACIONAL';
        let details: string = `Status alterado para ${nextStatus}.`;
        
        const updates: Partial<Quote> = { status: nextStatus, nfNumber, volumeCount: Number(volumeCount) };
        
        if (selectedQuote.status === 'Fechada') {
            if (nextStatus === 'No Galpão') {
                if (driverId) {
                    updates.status = 'Coleta';
                    eventAction = 'ATRIBUICAO_COLETA_GALPAO';
                    details = `Motorista ${selectedDriver?.name} atribuído para coleta para o galpão.`;
                } else {
                    updates.status = 'Aguardando Recebimento';
                    eventAction = 'ENVIO_DIRETO_GALPAO';
                    details = `Carga enviada para o galpão, aguardando recebimento.`;
                }
            } else if (nextStatus === 'Em Rota' && canSkipSteps) {
                if (!driverId) {
                    toast({ variant: 'destructive', title: 'Motorista Necessário', description: 'É necessário selecionar um motorista para uma entrega direta.' });
                    setIsSubmitting(false);
                    return;
                }
                updates.status = 'Coleta';
                eventAction = 'COLETA_PARA_ENTREGA_DIRETA';
                details = `Motorista ${selectedDriver?.name} atribuído para coleta e entrega direta.`;
            } else {
                updates.status = 'Coleta';
                details = `Cotação movida para coleta com motorista ${selectedDriver?.name || 'não definido'}.`;
            }
        } else if (selectedQuote.status === 'No Galpão' && nextStatus === 'Em Rota') {
            updates.status = 'Aguardando Saída';
            eventAction = 'SOLICITACAO_SAIDA_GALPAO';
            details = `Solicitação de saída do galpão enviada para a equipe de Recebimento.`;
        }


        if (updates.status === 'Finalizado') {
            updates.closedAt = new Date().toISOString();
        }

        if (expenseValue > 0) details += ` Despesa adicionada: ${expenseValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`;
        if (selectedDriver) details += ` Motorista: ${selectedDriver.name}.`;
        if (consultationNumber) details += ` N° Consulta: ${consultationNumber}.`;

        const operationalEventData: Partial<OperationalEvent> = {
            action: eventAction,
            details: details,
            expense: expenseValue > 0 ? expenseValue : undefined,
            driverId: selectedDriver ? selectedDriver.id : undefined,
            driverName: selectedDriver ? selectedDriver.name : undefined,
            consultationNumber: consultationNumber,
        };
        
        const body = {
            ...updates,
            user,
            operationalEvent: operationalEventData,
            driverRating: driverRating > 0 ? driverRating : undefined,
        };

        try {
            const response = await authFetch(`/api/quotes/${selectedQuote.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Falha ao atualizar a cotação.');
            }
            toast({ title: 'Sucesso!', description: 'Status operacional da cotação atualizado.' });
            setIsManageDialogOpen(false);
            await fetchData();
        } catch(error: any) {
             toast({ variant: 'destructive', title: 'Erro', description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    }, [selectedQuote, user, expense, driverId, nextStatus, consultationNumber, drivers, toast, fetchData, nfNumber, volumeCount]);
    

    
    const handleConfirmRevert = useCallback(async () => {
        if (!quoteToRevert || !quoteToRevert.operationalHistory || !user) return;
    
        setIsSubmitting(true);
        const sortedHistory = [...quoteToRevert.operationalHistory].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const lastEvent = sortedHistory.length > 0 ? sortedHistory[sortedHistory.length - 1] : null;
    
        const newHistory = lastEvent ? sortedHistory.slice(0, -1) : [];
        const prevStatus = newHistory.length > 0 ? newHistory[newHistory.length - 1].status : 'Fechada';
        
        let newTotalExpense = quoteToRevert.totalExpense || 0;
    
        if (lastEvent && lastEvent.expense && lastEvent.expense > 0) {
            newTotalExpense = Math.max(0, newTotalExpense - lastEvent.expense);
        }
    
        const body: any = {
            status: prevStatus,
            operationalHistory: newHistory,
            totalExpense: newTotalExpense,
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
            await fetchData();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro', description: error.message });
        } finally {
            setQuoteToRevert(null);
            setIsSubmitting(false);
        }
    }, [quoteToRevert, user, toast, fetchData]);
    
    const handleSaveObservations = useCallback(async () => {
        if (!selectedQuote || !user) return;
        setIsSubmitting(true);
        try {
            const response = await authFetch(`/api/quotes/${selectedQuote.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ obs: obsText, user }),
            });
            if (response.ok) {
                toast({ title: 'Sucesso!', description: 'Observações atualizadas.' });
                setIsObsDialogOpen(false);
                await fetchData();
            } else {
                throw new Error('Falha ao salvar observações.');
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Erro', description: e.message });
        } finally {
            setIsSubmitting(false);
        }
    }, [selectedQuote, obsText, user, toast, fetchData]);
    
    const handleGenerateOC = useCallback((quote: Quote) => {
        const params = new URLSearchParams({
            embedded: 'true',
            collectFrom: quote.remetente,
            collectAddress: quote.enderecoColeta || '',
            deliverTo: quote.empresaDestino || quote.destinatario || '',
            deliverAddress: quote.enderecoEntrega || '',
            volumes: String(quote.quantidade || quote.volumeCount || ''),
            weight: String(quote.peso || ''),
            requester: quote.responsavelSolicitante || '',
            contact: quote.contato || '',
            nfNumber: quote.nfNumber || '',
            quoteCode: quote.quoteCode || '',
        });
        setOcUrl(`/documents/collection-order?${params.toString()}`);
        setIsGenerateOCDialogOpen(true);
      }, []);

    const handleCreateManifest = useCallback(async () => {
        if (!manifestDriverId || selectedQuoteIdsForManifest.length === 0 || !manifestConsultationNumber.trim()) {
            toast({ variant: 'destructive', title: 'Erro de Validação', description: 'Selecione um motorista, ao menos uma cotação e insira o número da consulta.' });
            return;
        }
        setIsSubmitting(true);
        try {
            const response = await authFetch('/api/manifests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ driverId: manifestDriverId, quoteIds: selectedQuoteIdsForManifest, consultationNumber: manifestConsultationNumber }),
            });
            if (response.ok) {
                toast({ title: 'Sucesso!', description: 'Romaneio criado e cotações movidas para carregamento.' });
                await fetchData();
                setIsManifestDialogOpen(false);
                setSelectedQuoteIdsForManifest([]);
                setManifestDriverId('');
                setManifestConsultationNumber('');
            } else {
                throw new Error(await response.text());
            }
        } catch(e: any) {
            toast({ variant: 'destructive', title: 'Erro ao criar Romaneio', description: e.message });
        } finally {
            setIsSubmitting(false);
        }
    }, [manifestDriverId, selectedQuoteIdsForManifest, manifestConsultationNumber, toast, fetchData]);
    
    const handleProofFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !quoteForProofAction || !user) return;

        setIsSubmitting(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('user', JSON.stringify(user));

        try {
            const response = await authFetch(`/api/quotes/${quoteForProofAction.id}/upload-proof`, {
                method: 'POST',
                body: formData,
            });

            if(response.ok) {
                toast({ title: 'Sucesso!', description: 'Comprovante de entrega anexado.' });
                await fetchData();
            } else {
                const errorData = await response.json();
                console.error("DEBUG: Resposta de erro do Servidor:", errorData);
                throw new Error(`Falha no upload: ${errorData.message}`);
            }
        } catch(e: any) {
            toast({ variant: 'destructive', title: 'Erro', description: `Não foi possível anexar o comprovante: ${e.message}` });
        } finally {
            setIsSubmitting(false);
            setQuoteForProofAction(null);
        }
    };
    
    const handleDeleteProof = async (quoteParam: Quote, url?: string) => {
        if (!user) return;
        setIsSubmitting(true);
        try {
            const deleteUrl = `/api/quotes/${quoteParam.id}/upload-proof?user=${encodeURIComponent(JSON.stringify(user))}${url ? `&url=${encodeURIComponent(url)}` : ''}`;
            const response = await authFetch(deleteUrl, { method: 'DELETE' });
            if (response.ok) {
                toast({ title: 'Sucesso!', description: 'Comprovante de entrega removido.' });
                await fetchData();
            } else {
                 const errorData = await response.json();
                throw new Error(errorData.message || 'Falha ao remover.');
            }
        } catch(e: any) {
            toast({ variant: 'destructive', title: 'Erro', description: e.message || 'Não foi possível remover o comprovante.' });
        } finally {
            setIsSubmitting(false);
        }
    }

    const triggerProofUpload = (quote: Quote) => {
        setQuoteForProofAction(quote);
        if (proofFileInputRef.current) {
            proofFileInputRef.current.click();
        }
    };

    const handleTriggerXmlUpload = (quote: Quote) => {
        setSelectedQuoteForXml(quote);
        setIsNfeAttachmentOpen(true);
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
                await fetchData();
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

    const handleXmlObtained = async (xmlContent: string) => {
        if (!selectedQuoteForXml || !user) return;
        setIsSubmitting(true);
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
            
            const nfeParties = { emitente: extractParty('emit'), destinatario: extractParty('dest') };
            
            const nfeWeight = Number(pesoB || 0);
            const nfeVolumes = Number(qVol || 0);
            const quoteWeight = Number(selectedQuoteForXml.peso || 0);
            const quoteVolumes = Number(selectedQuoteForXml.volumeCount || selectedQuoteForXml.quantidade || 0);
            
            const hasWeightConflict = quoteWeight > 0 && nfeWeight > 0 && Math.abs(quoteWeight - nfeWeight) > 0.1;
            const hasVolumeConflict = quoteVolumes > 0 && nfeVolumes > 0 && quoteVolumes !== nfeVolumes;

            if (hasWeightConflict || hasVolumeConflict) {
                 setDivergenceData({ quoteWeight, quoteVolumes, nfeWeight, nfeVolumes, xmlContent, nfeParties } as NfeDivergenceData & { nfeParties: any });
                 setIsSubmitting(false);
                 setIsDivergenceDialogOpen(true);
                 return;
            }

            const finalWeight = quoteWeight > 0 ? quoteWeight : nfeWeight;
            const finalVolumes = quoteVolumes > 0 ? quoteVolumes : nfeVolumes;
            
            await proceedWithXmlUpload(finalWeight, finalVolumes, xmlContent, nNF, chNFe, selectedQuoteForXml.id, nfeParties);
        } catch(err: any) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível processar o XML.' });
            setIsSubmitting(false);
            setSelectedQuoteForXml(null);
        }
    };

    const handleViewNfe = (quote: Quote) => {
        setXmlContentToView(quote.nfeXml || '');
        setNfeChaveToView(quote.nfeChave || '');
        setIsNfeViewerOpen(true);
    };

    const filteredAndSortedQuotes = useMemo(() => {
        if (!quotes) return [];
        let relevantQuotes = quotes.filter(q => {
            if (currentStatus === 'Coleta') {
                return ['Fechada', 'Coleta', 'Aguardando Recebimento'].includes(q.status);
            }
            if (currentStatus === 'No Galpão') {
                return ['No Galpão', 'Aguardando Saída', 'Em Carregamento'].includes(q.status);
            }
            return q.status === currentStatus;
        });

        if (quoteCodeFilter) {
          return relevantQuotes.filter(quote => getQuoteCode(quote) === quoteCodeFilter);
        }
    
        if (!filter) return relevantQuotes;
        const lowercasedFilter = filter.toLowerCase();
    
        return relevantQuotes.filter(quote => {
            const standardSearch = 
                quote.remetente?.toLowerCase().includes(lowercasedFilter) ||
                quote.cidadeDestino?.toLowerCase().includes(lowercasedFilter) ||
                (getQuoteCode(quote) && getQuoteCode(quote).toLowerCase().includes(lowercasedFilter)) ||
                (quote.nfNumber && quote.nfNumber.toLowerCase().includes(lowercasedFilter));
    
            if (standardSearch) return true;
    
            const driverIdsInQuote = new Set(quote.operationalHistory?.map(e => e.driverId).filter(Boolean));
            if (driverIdsInQuote.size === 0) return false;
    
            for (const driverId of driverIdsInQuote) {
                const driver = drivers.find(d => d.id === driverId);
                if (driver) {
                    if (driver.name.toLowerCase().includes(lowercasedFilter)) return true;
                    if (driver.licensePlate?.toLowerCase().includes(lowercasedFilter)) return true;
                }
            }
            return false;
        });
    }, [quotes, currentStatus, filter, drivers, quoteCodeFilter]);
    

  const handleConfirmDispatch = useCallback(async (quote: Quote) => {
    if (!user) return;
    setIsSubmitting(true);
    const operationalEvent: Partial<OperationalEvent> = {
        action: 'SAIDA_GALPAO_CONFIRMADA',
        details: 'Saída física da carga do galpão confirmada.',
        status: 'Em Rota'
    };
    try {
        const response = await authFetch(`/api/quotes/${quote.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Em Rota', user, operationalEvent }),
        });
        if (response.ok) {
            toast({ title: 'Sucesso!', description: 'Cotação movida para "Em Rota".' });
            await fetchData();
        } else {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Falha ao confirmar saída.');
        }
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
        setIsSubmitting(false);
    }
  }, [user, toast, fetchData]);

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
        await fetchData();
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
        setIsSubmitting(false);
    }
};

const handleManualConfirmDelivery = async (quote: Quote) => {
     if (!user) return;
    
    const operationalEvent: Partial<OperationalEvent> = {
        action: 'ENTREGA_MANUAL',
        details: `Entrega confirmada manualmente por ${user.username}. Comprovante pode estar ausente.`,
        status: 'Entregue',
    };
    
    try {
        setIsSubmitting(true);
        const response = await authFetch(`/api/quotes/${quote.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'Entregue',
                deliveredAt: new Date().toISOString(),
                user,
                operationalEvent,
            }),
        });
        if (!response.ok) throw new Error('Falha ao confirmar entrega');
        toast({ title: 'Sucesso!', description: 'Entrega confirmada manualmente.' });
        await fetchData();
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
        setIsSubmitting(false);
    }
};


  if (authLoading || !user) {
    return (
        <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  const effectiveStatusForDialog = selectedQuote?.status === 'Fechada' ? 'Coleta' : selectedQuote?.status;
  const showDriverFields = effectiveStatusForDialog === 'Coleta' || nextStatus === 'Coleta' || effectiveStatusForDialog === 'Em Rota' || nextStatus === 'Em Rota';
  const showBillingDateField = selectedQuote?.status === 'Aberta';
  const showNfAndVolumeFields = selectedQuote?.status === 'Fechada' || selectedQuote?.status === 'Aberta';

  
  return (
    <main className="container mx-auto p-4 md:p-8">
        <input type="file" ref={proofFileInputRef} className="hidden" onChange={handleProofFileSelect} accept="image/*,.pdf"/>
        
        <NfeAttachmentDialog
            isOpen={isNfeAttachmentOpen}
            onOpenChange={setIsNfeAttachmentOpen}
            onXmlObtained={handleXmlObtained}
            title={`Anexar NF-e para ${selectedQuoteForXml?.quoteCode || 'Cotação'}`}
        />
        
        <NfeViewerDialog isOpen={isNfeViewerOpen} onOpenChange={setIsNfeViewerOpen} xmlContent={xmlContentToView} nfeChave={nfeChaveToView} />
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

        {quoteCodeFilter ? (
          <Button variant="outline" onClick={() => router.push(`/operational/status/${statusParam}`)} className="mb-8">
            &larr; Ver todas as cotações
          </Button>
        ) : (
          <Button variant="outline" onClick={() => router.push('/operational')} className="mb-8">
            &larr; Voltar para Área Operacional
          </Button>
        )}
        <div className="space-y-4 mb-8">
            <QuoteCard.PageTitle currentStatus={currentStatus} />
            {!quoteCodeFilter && (
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        placeholder="Filtrar por remetente, destino, nº cotação, nº NF, motorista ou placa..."
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        className="pl-10"
                    />
                </div>
            )}
        </div>
        
        {isDataLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {Array.from({ length: 8 }).map((_, index) => <QuoteCardSkeleton key={index} />)}
            </div>
        ) : filteredAndSortedQuotes.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredAndSortedQuotes.map(quote => {
                    const quoteIsActionable = ['Fechada', 'Coleta', 'No Galpão', 'Entregue'].includes(quote.status);
                    return (
                        <QuoteCard 
                            key={quote.id} 
                            quote={quote}
                            drivers={drivers}
                            currentUser={user}
                            onOpenManage={handleOpenManageDialog}
                            onOpenDetails={handleOpenDetailsDialog}
                            onOpenHistory={handleOpenHistoryDialog}
                            onOpenObs={handleOpenObsDialog}
                            onGenerateOC={handleGenerateOC}
                            onSetQuoteToRevert={setQuoteToRevert}

                            onUploadProof={triggerProofUpload}
                            onDeleteProof={handleDeleteProof}
                            onConfirmDispatch={handleConfirmDispatch}
                            isSubmitting={isSubmitting}
                            isManageActionDisabled={!quoteIsActionable}
                            onManualConfirmCollection={handleManualConfirmCollection}
                            onManualConfirmDelivery={handleManualConfirmDelivery}
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
                             </CardFooter>
                        </QuoteCard>
                    )
                })}
            </div>
        ) : (
             <div className="text-center py-16 border-dashed border-2 rounded-lg">
                <p className="text-muted-foreground">Nenhuma cotação encontrada para este status.</p>
             </div>
        )}
      
      <Dialog open={isGenerateOCDialogOpen} onOpenChange={setIsGenerateOCDialogOpen}>
        <DialogContent className="max-w-7xl h-[90vh] flex flex-col">
            <DialogHeader>
            <DialogTitle>Gerar Ordem de Coleta</DialogTitle>
            <DialogDescription>Preencha os dados abaixo e imprima a Ordem de Coleta.</DialogDescription>
            </DialogHeader>
            <div className="flex-grow border-0">
            <iframe src={ocUrl} className="w-full h-full border-0" title="Gerar Ordem de Coleta"/>
            </div>
        </DialogContent>
      </Dialog>

       <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerenciar Cotação: {selectedQuote?.quoteCode}</DialogTitle>
            <DialogDescription>
                Atualize o status operacional, adicione despesas e informações do motorista.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="next-status">Próximo Status</Label>
                 <Select value={nextStatus} onValueChange={(value) => setNextStatus(value as QuoteStatus)}>
                    <SelectTrigger id="next-status">
                        <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                        {availableStatuses.map(status => (
                            <SelectItem key={status} value={status}>{status}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
              </div>

               {showNfAndVolumeFields && (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="nfNumber">Nº da NF (Opcional)</Label>
                            <Input id="nfNumber" value={nfNumber} onChange={(e) => setNfNumber(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="volumeCount">Qtd. Volumes</Label>
                            <Input id="volumeCount" type="number" value={volumeCount} onChange={(e) => setVolumeCount(e.target.value)} />
                        </div>
                    </div>
                )}

               <div className="space-y-2">
                    <Label htmlFor="expense">Adicionar Despesa (Opcional)</Label>
                    <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="expense"
                            placeholder="R$ 0,00"
                            value={maskedExpense}
                            onChange={handleCurrencyChange}
                            className="pl-10"
                        />
                    </div>
                </div>
                
                {showDriverFields && (
                    <div className="space-y-4 rounded-md border p-4">
                         <div className="space-y-2">
                            <Label htmlFor="driverId">Motorista (Opcional)</Label>
                             <div className="flex gap-2">
                                <Input
                                    id="driverId"
                                    readOnly
                                    value={selectedDriverName}
                                    placeholder="Nenhum motorista selecionado"
                                    className="flex-grow"
                                />
                                <Button type="button" variant="outline" size="icon" onClick={() => setIsDriverSearchOpen(true)}><UserSearch className="h-4 w-4"/></Button>
                                <Button type="button" variant="outline" size="icon" onClick={() => setIsAddDriverDialogOpen(true)}><UserPlus className="h-4 w-4"/></Button>
                             </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="consultationNumber">Nº da Consulta GR (Opcional)</Label>
                            <Input
                                id="consultationNumber"
                                value={consultationNumber}
                                onChange={(e) => setConsultationNumber(e.target.value)}
                                placeholder="Até 14 dígitos"
                                maxLength={14}
                            />
                        </div>
                    </div>
                )}
                {((nextStatus === 'Finalizado' || nextStatus === 'No Galpão') && selectedDriverName) && (
                    <div className="space-y-2 p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/20 rounded-md">
                        <Label className="text-yellow-800 dark:text-yellow-500 font-semibold mb-1 block">Avaliar Motorista</Label>
                        <p className="text-xs text-yellow-700 dark:text-yellow-600 mb-2">Avalie o desempenho do motorista <strong>{selectedDriverName}</strong> nesta etapa.</p>
                        <StarRating value={driverRating} onChange={setDriverRating} size={32} />
                    </div>
                )}
          </div>
          <DialogFooter>
              <DialogClose asChild><Button type="button" variant="secondary" disabled={isSubmitting}>Cancelar</Button></DialogClose>
              <Button onClick={handleUpdateOperationalStatus} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Atualizar Status
              </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <QuoteCard.DetailsDialog
        quote={selectedQuote}
        isOpen={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
      />
       <QuoteCard.HistoryDialog
        quote={selectedQuote}
        isOpen={isHistoryDialogOpen}
        onOpenChange={setIsHistoryDialogOpen}
      />

      <AlertDialog open={!!quoteToRevert} onOpenChange={(open) => !open && setQuoteToRevert(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Retroceder Etapa?</AlertDialogTitle>
            <AlertDialogDescription>
                Tem a certeza que deseja retroceder a cotação "{quoteToRevert?.quoteCode}" para a etapa anterior?
                Qualquer despesa associada a esta etapa será removida.
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

       <Dialog open={isObsDialogOpen} onOpenChange={setIsObsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Observações da Cotação: {selectedQuote?.quoteCode}</DialogTitle>
            <DialogDescription>
                Adicione ou edite as observações para esta cotação.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Textarea 
                value={obsText}
                onChange={(e) => setObsText(e.target.value)}
                rows={8}
                placeholder="Insira as observações aqui..."
            />
          </div>
          <DialogFooter>
              <DialogClose asChild>
                  <Button type="button" variant="secondary" disabled={isSubmitting}>Cancelar</Button>
              </DialogClose>
              <Button onClick={handleSaveObservations} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar Observações
              </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <QuoteCard.ManifestDialog
        isOpen={isManifestDialogOpen}
        onOpenChange={setIsManifestDialogOpen}
        drivers={drivers}
        quotesForManifest={quotes.filter(q => q.status === 'No Galpão')}
        onConfirm={handleCreateManifest}
        isSubmitting={isSubmitting}
        driverId={manifestDriverId}
        setDriverId={setManifestDriverId}
        selectedQuoteIds={selectedQuoteIdsForManifest}
        setSelectedQuoteIds={setSelectedQuoteIdsForManifest}
        consultationNumber={manifestConsultationNumber}
        setConsultationNumber={setManifestConsultationNumber}
      />

      <QuoteCard.DriverSearchDialog
        isOpen={isDriverSearchOpen}
        onOpenChange={setIsDriverSearchOpen}
        drivers={searchedDrivers}
        isLoading={isSearchingDrivers}
        onSelectDriver={(driver) => {
            setSelectedDriver(driver as Driver);
            setDriverId((driver as Driver).id);
            setIsDriverSearchOpen(false);
            setDriverSearchTerm('');
            setSearchedDrivers([]);
        }}
        searchTerm={driverSearchTerm}
        onSearchTermChange={handleDriverSearchChange}
       />
       
        <Dialog open={isAddDriverDialogOpen} onOpenChange={setIsAddDriverDialogOpen}>
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


        <AlertDialog open={!!quoteForProofAction && !!quoteForProofAction.proofOfDeliveryUrl} onOpenChange={(open) => !open && setQuoteForProofAction(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Remover Comprovante?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Tem a certeza que deseja remover o comprovante de entrega desta cotação? Apenas administradores podem executar esta ação.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => { if(quoteForProofAction) handleDeleteProof(quoteForProofAction); }} disabled={isSubmitting || user?.role !== 'admin'} className="bg-destructive hover:bg-destructive/90">
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                        Remover
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </main>
  );
}

