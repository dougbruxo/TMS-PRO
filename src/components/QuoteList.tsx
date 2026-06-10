
"use client";

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Printer, Trash2, Search, CheckCircle, Circle, DollarSign, Edit, User as UserIcon, Phone, Mail, Loader2, AlertTriangle, RefreshCw, Plus, History, PackageCheck, Truck, Warehouse, Move, Eye, XCircle, FileText, Calendar as CalendarIcon, ArrowUp, Copy, MoreVertical, ArrowRightLeft } from 'lucide-react';
import type { Quote, QuoteHistoryEvent, QuoteStatus, User } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
import { printQuote } from '@/lib/print';
import { NfeViewerDialog } from './NfeViewerDialog';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { cn } from '@/lib/utils';
import { WhatsAppIcon } from './WhatsAppIcon';
import { format, addDays, isValid, parse } from 'date-fns';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { authFetch } from '@/lib/api-client';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface QuoteListProps {
  onRedoQuote: (quote: Quote) => void;
  onQuoteMutated: () => void;
  quotes: Quote[];
  onCloneQuote?: (quote: Quote) => void;
  onCloseQuote: (quote: Quote, enderecoColeta: string, enderecoEntrega: string, billingDueDate: string) => Promise<boolean>;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
}

const statusDetails: Record<QuoteStatus, { icon: React.ReactNode; color: string; label: string }> = {
  'Aberta': { icon: <Circle className="h-3 w-3" />, color: 'bg-blue-500', label: 'Aberta' },
  'Em Análise': { icon: <AlertTriangle className="h-4 w-4" />, color: 'bg-amber-500', label: 'Em Análise' },
  'Fechada': { icon: <PackageCheck className="h-4 w-4" />, color: 'bg-indigo-500', label: 'Fechada' },
  'Coleta': { icon: <Truck className="h-4 w-4" />, color: 'bg-cyan-500', label: 'Coleta' },
  'Aguardando Recebimento': { icon: <AlertTriangle className="h-4 w-4" />, color: 'bg-yellow-500 animate-pulse', label: 'Aguard. Recebimento' },
  'Entregue no Galpão': { icon: <AlertTriangle className="h-4 w-4" />, color: 'bg-blue-600 animate-pulse', label: 'Entregue no Galpão' },
  'No Galpão': { icon: <Warehouse className="h-4 w-4" />, color: 'bg-orange-500', label: 'No Galpão' },
  'Aguardando Saída': { icon: <AlertTriangle className="h-4 w-4" />, color: 'bg-yellow-500 animate-pulse', label: 'Aguard. Saída' },
  'Em Carregamento': { icon: <Truck className="h-4 w-4 animate-pulse" />, color: 'bg-blue-600', label: 'Em Carregamento' },
  'Em Rota': { icon: <Move className="h-4 w-4" />, color: 'bg-purple-500', label: 'Em Rota' },
  'Entregue': { icon: <CheckCircle className="h-4 w-4" />, color: 'bg-yellow-600', label: 'Entregue' },
  'Finalizado': { icon: <CheckCircle className="h-4 w-4" />, color: 'bg-green-600', label: 'Finalizado' },
};

const getQuoteCode = (quote: Quote) => {
  if (quote.quoteCode) return quote.quoteCode;
  const date = new Date(quote.data);
  return `LEGACY-${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
}

const shortenCompanyName = (name: string): string => {
  if (!name) return "";
  
  // Remove CNPJ patterns if any exist
  let cleanName = name.replace(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g, '');
  
  // Remove common corporate suffixes
  cleanName = cleanName.replace(/\s+(LTDA|LTD|S\/A|S\.A\.|ME|EPP|EIRELI)\b/gi, '');
  
  // Handle patterns like "E COM. ...", "E IND. ...", "E SERVIÇOS"
  const matchStop = cleanName.match(/(.+?)\s+E\s+(COM\.?|IND\.?|SERV|TRANS|EXP|CONSTR)/i);
  if (matchStop) {
    cleanName = matchStop[1];
  } else {
    // If there is no specific E COM, check if there's a generic " E COMÉRCIO" or similar
    const genericMatches = [
      /(.+?)\s+E\s+COMÉRCIO/i,
      /(.+?)\s+E\s+INDÚSTRIA/i,
      /(.+?)\s+E\s+SERVIÇOS/i,
      /(.+?)\s+E\s+CONVENIENCIA/i
    ];
    for (const regex of genericMatches) {
      const match = cleanName.match(regex);
      if (match) {
        cleanName = match[1];
        break;
      }
    }
  }
  
  // Split on hyphens or slashes if they demarcate secondary details
  const splitters = [" - ", " / "];
  for (const splitter of splitters) {
    if (cleanName.includes(splitter)) {
      cleanName = cleanName.split(splitter)[0];
    }
  }
  
  return cleanName.trim();
};


const generateTextBody = (quote: Quote, forWhatsApp: boolean, companyProfile?: any) => {
  const quoteDate = new Date(quote.data);
  const hour = quoteDate.getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const quoteCode = getQuoteCode(quote);

  const valorTotalComImpostos = (quote.valorFinal || quote.totalFrete) + (quote.icmsValor || 0);

  const boldStart = forWhatsApp ? '*' : '';
  const boldEnd = forWhatsApp ? '*' : '';
  const solicitante = quote.responsavelSolicitante || quote.solicitante || quote.tomador;

  const quoteDataObj = new Date(quote.data);
  const dataFormatada = quoteDataObj.toLocaleDateString('pt-BR');
  const horaFormatada = quoteDataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  let finalMessage = `Olá ${solicitante}, ${greeting}!

Muito obrigado pelo seu contato.
Segue cotação: ${boldStart}${quoteCode}${boldEnd}

${boldStart}Tomador:${boldEnd} ${quote.tomador}
${boldStart}Remetente:${boldEnd} ${quote.remetente || quote.tomador}
${boldStart}Data:${boldEnd} ${dataFormatada} às ${horaFormatada}
${boldStart}Usuário:${boldEnd} ${quote.usuario}
${boldStart}Origem:${boldEnd} ${quote.cidadeOrigem}
${boldStart}Destino:${boldEnd} ${quote.cidadeDestino}
${boldStart}Veículo:${boldEnd} ${quote.veiculo}
${boldStart}Solicitante:${boldEnd} ${solicitante}
`;

  if (quote.status === 'Fechada' && (quote.desconto || 0) > 0) {
    const totalOriginal = quote.totalFrete + (quote.icmsValor || 0);
    finalMessage += `${boldStart}Total Original:${boldEnd} ${totalOriginal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n`;
    finalMessage += `${boldStart}Desconto:${boldEnd} -${(quote.desconto || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n`;
  }

  finalMessage += `${boldStart}Valor Final:${boldEnd} ${valorTotalComImpostos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n`;
  finalMessage += `${boldStart}Prazo de entrega:${boldEnd} Até ${String(quote.prazoEntrega).padStart(2, '0')} dias\n`;
  finalMessage += `${boldStart}Observações:${boldEnd} ${quote.obs || "Nenhuma"}`;

  if (companyProfile) {
    finalMessage += `\n\nAtenciosamente,\n${boldStart}${companyProfile.razaoSocial}${boldEnd}`;
    if (companyProfile.website) {
      finalMessage += `\n${companyProfile.website}`;
    }
  }

  return finalMessage;
};

export function QuoteList({ onRedoQuote, onQuoteMutated, quotes, onCloneQuote, onCloseQuote, onLoadMore, hasMore, isLoading }: QuoteListProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [isSearching, setIsSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Quote[] | null>(null);

  const [activeGlow, setActiveGlow] = useState(false);
  const triggerButtonClickAnimation = () => {
    setActiveGlow(true);
    setTimeout(() => {
      setActiveGlow(false);
    }, 650);
  };

  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);
  const [isNfeViewerOpen, setIsNfeViewerOpen] = useState(false);
  const [xmlContentToView, setXmlContentToView] = useState('');
  const [nfeChaveToView, setNfeChaveToView] = useState('');
  const [isDiscountDialogOpen, setIsDiscountDialogOpen] = useState(false);
  const [discountValue, setDiscountValue] = useState(0);
  const [maskedDiscountValue, setMaskedDiscountValue] = useState('R$ 0,00');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [companyProfile, setCompanyProfile] = useState<any>(null);

  const [enderecoColeta, setEnderecoColeta] = useState('');
  const [enderecoEntrega, setEnderecoEntrega] = useState('');
  const [billingDueDate, setBillingDueDate] = useState('');

  // Transfer quote state
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [quoteToTransfer, setQuoteToTransfer] = useState<Quote | null>(null);
  const [transferTargetUserId, setTransferTargetUserId] = useState('');
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await authFetch('/api/company-profile/default');
        if (res.ok) setCompanyProfile(await res.json());
      } catch (e) { }
    };
    fetchProfile();
  }, []);

  const isAdmin = user?.role === 'admin';

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setIsSearching(true);
    const token = localStorage.getItem('sessionToken');
    try {
      const response = await authFetch(`/api/quotes/search?term=${encodeURIComponent(searchTerm)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const results = await response.json();
        setSearchResults(results);
        if (results.length === 0) {
          toast({ title: 'Nenhum resultado', description: 'Nenhuma cotação encontrada para o termo pesquisado.' })
        }
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao buscar cotações.' })
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro de Rede', description: 'Não foi possível conectar ao servidor.' })
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSearchResults(null);
  };

  const quotesToDisplay = useMemo(() => {
    if (searchResults !== null) {
      return searchResults;
    }
    if (user?.role === 'user') {
        const canViewOthers = user?.subPermissions?.freight?.canViewOthersQuotes ?? true;
        const canViewMine = user?.subPermissions?.freight?.canViewMyQuotes ?? true;
        if (canViewOthers) return quotes;
        if (canViewMine) return quotes.filter(q => q.userId === user.id);
        return [];
    }
    if (user?.role === 'cliente' || user?.role === 'sub-cliente') {
      const targetUserId = user.isSubClient ? user.parentId : user.id;
      return quotes.filter(q => q.userId === targetUserId);
    }
    return quotes;
  }, [searchResults, quotes, user]);

  const removeQuote = async (quote: Quote) => {
    setIsSubmitting(true);
    const token = localStorage.getItem('sessionToken');
    const response = await authFetch(`/api/quotes/${quote.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (response.ok) {
      toast({ title: 'Sucesso!', description: 'Cotação removida.' });
      setSearchResults(null);
      setSearchTerm('');
      onQuoteMutated();
    } else {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível remover a cotação.' });
    }
    setIsSubmitting(false);
  };

  const handleApproveQuote = async (quote: Quote) => {
    if (!user || (user.role !== 'admin' && user.role !== 'user')) {
      toast({ variant: 'destructive', title: 'Ação não permitida' });
      return;
    }
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('sessionToken');
      const response = await authFetch(`/api/quotes/${quote.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'Aberta', user }),
      });
      if (!response.ok) throw new Error("Falha ao aprovar cotação.");
      toast({ title: 'Cotação Aprovada', description: 'O status da cotação agora é "Aberta".' });
      setSearchResults(null);
      setSearchTerm('');
      onQuoteMutated();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível aprovar a cotação.' });
    }
    setIsSubmitting(false);
  };

  const handleRejectQuote = async (quote: Quote, reason: string) => {
    if (!user || (user.role !== 'admin' && user.role !== 'user')) return;
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('sessionToken');
      const response = await authFetch(`/api/quotes/${quote.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'Recusada', obs: `Reprovada: ${reason}`, user }),
      });
      if (!response.ok) throw new Error("Falha ao reprovar cotação.");
      toast({ title: 'Cotação Reprovada', description: 'A cotação foi recusada.' });
      onQuoteMutated();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível reprovar a cotação.' });
    }
    setIsSubmitting(false);
  };

  const handleReopenQuote = async (quote: Quote) => {
    setIsSubmitting(true);
    const token = localStorage.getItem('sessionToken');
    try {
      const response = await authFetch(`/api/quotes/${quote.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: 'Aberta',
          desconto: 0,
          valorFinal: quote.totalFrete,
          user,
        }),
      });
      if (!response.ok) throw new Error("Falha ao reabrir cotação.");

      toast({ title: 'Cotação Reaberta', description: 'O status da cotação foi alterado para "Aberta".' });
      setSearchResults(null);
      setSearchTerm('');
      onQuoteMutated();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível reabrir a cotação.' });
    }
    setIsSubmitting(false);
  };

  const handleApplyDiscount = async () => {
    if (!selectedQuote || !user) return;
    setIsSubmitting(true);
    const token = localStorage.getItem('sessionToken');
    try {
      const response = await authFetch(`/api/quotes/${selectedQuote.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ desconto: discountValue, user }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Falha ao aplicar desconto.");
      }

      toast({ title: 'Sucesso!', description: 'Desconto aplicado com sucesso.' });
      setSearchResults(null);
      setSearchTerm('');
      onQuoteMutated();
      setIsDiscountDialogOpen(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao Aplicar Desconto', description: e.message });
    }
    setIsSubmitting(false);
  };


  const sendWhatsApp = (quote: Quote) => {
    const text = generateTextBody(quote, true, companyProfile);
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        alert("Texto da cotação copiado! Você será redirecionado para o WhatsApp.");
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
      }).catch(err => {
        console.error("Erro ao copiar:", err);
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
      });
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  const sendEmail = (quote: Quote) => {
    if (!quote.email) {
      toast({
        variant: 'destructive',
        title: 'E-mail não encontrado',
        description: 'Edite a cotação para adicionar o e-mail do solicitante.',
      });
      return;
    }
    const subject = `Cotação de Frete DezLog - N° ${getQuoteCode(quote)}`;
    const body = generateTextBody(quote, false, companyProfile);
    window.location.href = `mailto:${quote.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const getFinalValue = (quote: Quote) => {
    return (quote.valorFinal || quote.totalFrete) + (quote.icmsValor || 0);
  }

  const handleOpenHistoryDialog = async (quote: Quote) => {
    setSelectedQuote(quote);
    setIsHistoryDialogOpen(true);

    if (!quote.history || quote.history.length === 0) {
      setIsLoadingHistory(true);
      try {
        const response = await authFetch(`/api/quotes/${quote.id}`);
        if (response.ok) {
          const fullQuote = await response.json();
          setSelectedQuote(fullQuote);
        }
      } catch (e) {
        console.error("Falha ao buscar histórico da cotação", e);
      } finally {
        setIsLoadingHistory(false);
      }
    }
  };

  const handleOpenCloseDialog = (quote: Quote) => {
    setSelectedQuote(quote);
    setEnderecoColeta(quote.enderecoColeta || '');
    setEnderecoEntrega(quote.enderecoEntrega || '');
    setBillingDueDate(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
    setIsCloseDialogOpen(true);
  };

  const handleOpenDiscountDialog = (quote: Quote) => {
    setSelectedQuote(quote);
    setDiscountValue(quote.desconto || 0);
    setMaskedDiscountValue((quote.desconto || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    setIsDiscountDialogOpen(true);
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
        onQuoteMutated();
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

  const handleCloseQuote = async () => {
    if (!selectedQuote || !enderecoColeta.trim() || !enderecoEntrega.trim() || !billingDueDate.trim()) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Todos os campos são obrigatórios.' });
      return;
    }
    setIsSubmitting(true);
    const success = await onCloseQuote(selectedQuote, enderecoColeta, enderecoEntrega, billingDueDate);
    if (success) {
      setIsCloseDialogOpen(false);
      // Limpar resultados da busca para que a lista principal (recém-atualizada) seja exibida
      setSearchResults(null);
      setSearchTerm('');
    }
    setIsSubmitting(false);
  }

  const handleOpenTransferDialog = async (quote: Quote) => {
    setQuoteToTransfer(quote);
    setTransferTargetUserId('');
    setIsTransferDialogOpen(true);
    setIsLoadingUsers(true);
    try {
      const res = await authFetch('/api/users');
      if (res.ok) {
        const users: User[] = await res.json();
        // Filter out disabled users and the current quote owner
        setAvailableUsers(users.filter(u => !u.disabled && u.id !== quote.userId && (u.role === 'admin' || u.role === 'user')));
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os usuários.' });
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleTransferQuote = async () => {
    if (!quoteToTransfer || !transferTargetUserId) return;
    setIsTransferring(true);
    try {
      const res = await authFetch('/api/quotes/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteIds: [quoteToTransfer.id], newUserId: transferTargetUserId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Falha ao transferir cotação.');
      }
      toast({ title: 'Sucesso!', description: 'Cotação transferida com sucesso.' });
      setIsTransferDialogOpen(false);
      setSearchResults(null);
      setSearchTerm('');
      onQuoteMutated();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setIsTransferring(false);
    }
  };

  const canDeleteQuote = (quote: Quote): boolean => {
    if (user?.role === 'cliente' || user?.role === 'sub-cliente') {
      return quote.status === 'Em Análise';
    }
    if (quote.status === 'Fechada' && !isAdmin) {
      return false;
    }
    if (user?.role === 'user' && !user?.subPermissions?.freight?.canDeleteQuote) {
      return false;
    }
    const targetUserId = user?.isSubClient ? user?.parentId : user?.id;
    return isAdmin || targetUserId === quote.userId;
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Cotações Salvas</h2>
        <div className="mt-6 p-4 border border-border/40 rounded-xl bg-card shadow-sm relative overflow-visible">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-center gap-4 w-full">
            <div className="relative flex-grow w-full rounded-xl overflow-hidden border border-muted/50 bg-background/40 backdrop-blur-md input-glow-pulse-focus transition-all duration-300">
              {/* Interior Shimmer effect */}
              <div className="input-interior-shimmer" />
              
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground z-20 search-icon-animate transition-all duration-300" />
              
              <Input
                placeholder="Filtrar por cliente, destino, veículo, nº cotação..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 h-11 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 relative z-10 w-full transition-all duration-300 text-foreground placeholder:text-muted-foreground/70"
                disabled={isSearching}
              />
            </div>
            {searchResults !== null && (
              <Button type="button" variant="ghost" onClick={clearSearch} className="w-full sm:w-auto h-11">
                <XCircle className="mr-2 h-4 w-4" />
                Limpar Busca
              </Button>
            )}
            <Button 
              type="submit" 
              className={cn(
                "w-full sm:w-auto h-11 premium-search-btn rounded-xl transition-all duration-300",
                activeGlow && "blooming"
              )}
              disabled={isSearching}
              onClick={triggerButtonClickAnimation}
            >
              {/* Inner premium blooming light burst */}
              {activeGlow && <span className="premium-btn-bloom" />}
              
              <span className="relative z-10 flex items-center justify-center">
                {isSearching ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Search className="mr-2 h-5 w-5" />}
                {isSearching ? 'Buscando...' : 'Buscar'}
              </span>
            </Button>
          </form>
        </div>
      </div>

      {isLoading && quotesToDisplay.length === 0 ? (
        <div className="text-center py-16">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Carregando cotações...</p>
        </div>
      ) : quotesToDisplay && quotesToDisplay.length > 0 ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {quotesToDisplay.map(quote => {
              const statusInfo = statusDetails[quote.status] || { icon: <Circle className="h-3 w-3" />, color: 'bg-gray-500', label: quote.status };
              const cardBgColor = quote.status === 'Finalizado' ? 'border-green-500/25 bg-green-500/5 hover:border-green-500/45 dark:bg-green-950/20' :
                quote.status === 'Em Análise' ? 'border-amber-500/25 bg-amber-500/5 hover:border-amber-500/45 dark:bg-amber-950/20' : '';
              return (
                <Card key={quote.id} className={cn("flex flex-col border border-border/40 bg-card/45 backdrop-blur-2xl shadow-xl transition-all duration-500 relative overflow-hidden group rounded-2xl hover:shadow-primary/15 hover:-translate-y-1.5 hover:border-primary/50", cardBgColor)}>
                  {/* Efeito de revelação de gradiente aurora suave no hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                  
                  <CardHeader className="relative z-10 px-4 py-3 pb-1 space-y-1.5">
                    {/* Row 1: Quote Code & Status Badge */}
                    <div className="flex items-center justify-between w-full gap-2">
                      <span className="font-bold text-xs tracking-tight text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 shadow-sm font-mono whitespace-nowrap">
                        {getQuoteCode(quote)}
                      </span>
                      <div className="flex items-center gap-1">
                        <Badge
                          variant={'default'}
                          className={cn('text-[10px] font-semibold px-2 py-0.5 text-white', statusInfo.color)}
                        >
                          {statusInfo.icon && <span className="mr-1">{statusInfo.icon}</span>}
                          {statusInfo.label}
                        </Badge>
                        {isAdmin && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 premium-card-btn p-0">
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenTransferDialog(quote)}>
                                <ArrowRightLeft className="mr-2 h-4 w-4" />
                                Transferir Cotação
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>

                    {/* Row 2: Shortened Tomador Name */}
                    <div className="w-full">
                      <CardTitle 
                        className="text-sm font-bold text-foreground truncate block max-w-full leading-tight" 
                        title={quote.tomador}
                      >
                        {shortenCompanyName(quote.tomador)}
                      </CardTitle>
                    </div>

                    {/* Row 3: Date & User info */}
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(quote.data).toLocaleDateString('pt-BR')} - {quote.usuario}
                    </div>
                  </CardHeader>

                  <CardContent className="flex-grow space-y-1.5 px-4 py-2 pt-0 pb-2 text-xs">
                    {quote.freightMode === 'armazenagem' ? (
                      // ── STORAGE CARD BODY
                      <>
                        <div className="flex items-center gap-2 mb-1">
                          <Warehouse className="h-3.5 w-3.5 text-indigo-500" />
                          <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wide">Serviço de Armazenagem</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                          {(quote.quantidade || 0) > 0 && (
                            <div className="flex justify-between col-span-2"><span className="text-muted-foreground">Posições (Paletes):</span> <strong>{quote.quantidade} un.</strong></div>
                          )}
                          {(quote.peso || 0) > 0 && (
                            <div className="flex justify-between"><span className="text-muted-foreground">Peso:</span> <strong>{quote.peso} kg</strong></div>
                          )}
                          {(quote.cubagem || 0) > 0 && (
                            <div className="flex justify-between"><span className="text-muted-foreground">Cubagem:</span> <strong>{(quote.cubagem || 0).toFixed(2)} m³</strong></div>
                          )}
                          <div className="flex justify-between col-span-2"><span className="text-muted-foreground">Período:</span> <strong>{quote.prazoEntrega || 30} dias</strong></div>
                        </div>
                        <div className="text-center pt-2">
                          {(quote.desconto || 0) > 0 ? (
                            <div>
                              <p className="text-[10px] text-muted-foreground">
                                Total Original: <span className="line-through">{(quote.totalFrete).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                              </p>
                              <p className="text-[10px] text-red-500">
                                Desconto: -{(quote.desconto || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </p>
                              <p className="text-xl font-bold text-indigo-600">
                                {getFinalValue(quote).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </p>
                            </div>
                          ) : (
                            <p className="text-xl font-bold text-indigo-600">
                              {getFinalValue(quote).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                          )}
                        </div>
                      </>
                    ) : (
                      // ── FREIGHT CARD BODY
                      <>
                        <div className="flex justify-between"><span>Origem:</span> <strong>{quote.cidadeOrigem}</strong></div>
                        <div className="flex justify-between"><span>Destino:</span> <strong>{quote.cidadeDestino}</strong></div>
                        <div className="flex justify-between items-center">
                          <span>Veículo:</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{quote.veiculo}</Badge>
                        </div>
                        <div className="text-center pt-2">
                          {quote.desconto > 0 ? (
                            <div>
                              <p className="text-[10px] text-muted-foreground">
                                Total Original: <span className="line-through">{(quote.totalFrete + (quote.icmsValor || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                              </p>
                              <p className="text-[10px] text-red-500">
                                Desconto: -{(quote.desconto || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </p>
                              <p className="text-xl font-bold text-primary">
                                {getFinalValue(quote).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </p>
                            </div>
                          ) : (
                            <div>
                              <p className="text-xl font-bold text-primary">
                                {getFinalValue(quote).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </p>
                              {(quote.icmsValor || 0) > 0 && (
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                  <span>Frete: {quote.totalFrete.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                  <span className="mx-1">+</span>
                                  <span>ICMS ({quote.icmsAliquota || 0}%): {(quote.icmsValor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                  
                  {/* Two-row CardFooter: upper for main action buttons, lower for secondary icon buttons */}
                  <CardFooter className="flex flex-col gap-2 relative z-10 px-4 py-2 pt-0 pb-3 mt-auto">
                    {user?.role !== 'cliente' && (
                      <div className="flex flex-wrap items-center justify-end gap-1.5 w-full">
                        {quote.status === 'Em Análise' && (isAdmin || user?.role === 'user') && (
                          <div className="flex gap-1.5 w-full justify-end">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 text-xs border-green-200 text-green-700 hover:bg-green-50 premium-card-btn px-2.5 py-0" disabled={isSubmitting}>
                                  <CheckCircle className="mr-1 h-3.5 w-3.5" /> Aprovar
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Aprovar Cotação?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Isso mudará o status da cotação para "Aberta" e ela ficará disponível para os próximos passos.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleApproveQuote(quote)} className="bg-green-600 hover:bg-green-700" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Confirmar Aprovação
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 text-xs border-red-200 text-red-700 hover:bg-red-50 premium-card-btn px-2.5 py-0" disabled={isSubmitting}>
                                  <XCircle className="mr-1 h-3.5 w-3.5" /> Reprovar
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Reprovar Cotação?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Informe o motivo da reprovação. A cotação será movida para "Recusada".
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <div className="py-2">
                                  <Label htmlFor="rejectReason">Motivo (obrigatório)</Label>
                                  <Textarea id="rejectReason" placeholder="Descreva o motivo da recusa..." className="mt-2" />
                                </div>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={(e) => {
                                    const textarea = e.currentTarget.parentElement?.previousElementSibling?.querySelector('textarea');
                                    const reason = textarea?.value || '';
                                    if (!reason.trim()) {
                                      e.preventDefault();
                                      toast({ variant: 'destructive', title: 'Obrigatório', description: 'Por favor, informe o motivo.' });
                                      return;
                                    }
                                    handleRejectQuote(quote, reason);
                                  }} className="bg-red-600 hover:bg-red-700" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Confirmar Reprovação
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                        {quote.status === 'Aberta' && (
                          <div className="flex flex-wrap items-center justify-end gap-1.5 w-full">
                            {(isAdmin || (user?.role === 'user' && user?.subPermissions?.freight?.canRemakeQuote)) && onRedoQuote && (
                              <Button variant="outline" size="sm" className="h-7 text-xs premium-card-btn px-2.5 py-0" onClick={() => onRedoQuote(quote)}>
                                <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refazer
                              </Button>
                            )}
                            {(isAdmin || (user?.role === 'user' && user?.subPermissions?.freight?.canGiveDiscount)) && (
                              <Button variant="outline" size="sm" className="h-7 text-xs premium-card-btn px-2.5 py-0" onClick={() => handleOpenDiscountDialog(quote)} disabled={isSubmitting}>
                                <DollarSign className="mr-1 h-3.5 w-3.5" /> Desconto
                              </Button>
                            )}
                            <Button variant="outline" size="sm" className="h-7 text-xs premium-card-btn px-2.5 py-0" onClick={() => handleOpenCloseDialog(quote)} disabled={isSubmitting}>
                              <CheckCircle className="mr-1 h-3.5 w-3.5" /> Fechar
                            </Button>
                          </div>
                        )}
                        {quote.status === 'Fechada' && isAdmin && (
                          <div className="flex justify-end w-full">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 text-xs premium-card-btn px-2.5 py-0" disabled={isSubmitting}>
                                  <Circle className="mr-1 h-3.5 w-3.5" /> Reabrir
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Reabrir Cotação?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    A cotação voltará ao status "Aberta" e o desconto será removido. Esta ação só pode ser realizada por um administrador.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleReopenQuote(quote)} disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Confirmar Reabertura
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bottom Row: Icon Action Buttons */}
                    <div className="flex flex-wrap items-center justify-end gap-1 w-full border-t border-border/20 pt-2">
                      {(quote.nfeXml || quote.nfeChave) && (
                        <Button variant="ghost" size="icon" onClick={() => handleViewNfe(quote)} title="Ver NF-e / Consultar SEFAZ" className="text-primary premium-card-btn h-8 w-8">
                          <FileText className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleOpenHistoryDialog(quote)} title="Histórico da Cotação" className="premium-card-btn h-8 w-8">
                        <History className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => sendEmail(quote)} title="Enviar via E-mail" className="premium-card-btn h-8 w-8">
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => sendWhatsApp(quote)} title="Enviar via Whatsapp" className="premium-card-btn h-8 w-8">
                        <WhatsAppIcon />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => printQuote(quote)} title="Imprimir" className="premium-card-btn h-8 w-8">
                        <Printer className="h-4 w-4" />
                      </Button>
                      {onCloneQuote && (
                        <Button variant="ghost" size="icon" onClick={() => onCloneQuote(quote)} title="Clonar Cotação" className="text-secondary-foreground premium-card-btn h-8 w-8">
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}

                      {canDeleteQuote(quote) && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" title="Excluir" className="text-destructive hover:text-destructive premium-card-btn h-8 w-8" disabled={isSubmitting}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Essa ação não pode ser desfeita. Isso irá remover permanentemente a cotação.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => removeQuote(quote)} className="bg-destructive hover:bg-destructive/90" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Remover"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
          {hasMore && searchResults === null && (
            <div className="mt-8 text-center">
              <Button onClick={onLoadMore} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Carregar Mais"}
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-16 border-dashed border-2 rounded-lg">
          <p className="text-muted-foreground">Nenhuma cotação encontrada.</p>
        </div>
      )}

      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico da Cotação: {selectedQuote ? getQuoteCode(selectedQuote) : ''}</DialogTitle>
            <DialogDescription>
              Veja todas as ações e mudanças realizadas nesta cotação.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] my-4">
            <div className="pr-6 space-y-6">
              {isLoadingHistory ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : selectedQuote?.history && selectedQuote.history.length > 0 ? (
                selectedQuote.history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((event, index, arr) => (
                  <div key={event.id} className="flex gap-4 relative">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                        <History className="h-4 w-4" />
                      </div>
                      {index < arr.length - 1 && (
                        <div className="w-px h-full bg-border flex-grow"></div>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold">{(event.action || 'SISTEMA').replace(/_/g, ' ')}</p>
                      <p className="text-sm text-muted-foreground">{new Date(event.timestamp).toLocaleString('pt-BR')}</p>
                      <p className="text-sm mt-1">{event.details}</p>
                      <p className="text-xs text-muted-foreground mt-2">Por: {event.username || 'Sistema'}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Nenhum histórico encontrado para esta cotação.</p>
                </div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Fechar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCloseDialogOpen} onOpenChange={setIsCloseDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Fechar Cotação e Gerar Cobrança</DialogTitle>
            <DialogDescription>
              Cotação: {selectedQuote?.quoteCode}. Preencha os dados abaixo para fechar a cotação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="enderecoColeta">Endereço de Coleta Completo</Label>
              <Textarea id="enderecoColeta" value={enderecoColeta} onChange={e => setEnderecoColeta(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="enderecoEntrega">Endereço de Entrega Completo</Label>
              <Textarea id="enderecoEntrega" value={enderecoEntrega} onChange={e => setEnderecoEntrega(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingDueDate">Data de Vencimento da Cobrança</Label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="billingDueDate" type="date" value={billingDueDate} onChange={e => setBillingDueDate(e.target.value)} className="pl-10" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="secondary" disabled={isSubmitting}>Cancelar</Button></DialogClose>
            <Button onClick={handleCloseQuote} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Fechar Cotação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isDiscountDialogOpen} onOpenChange={setIsDiscountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aplicar Desconto</DialogTitle>
            <DialogDescription>Cotação: {selectedQuote?.quoteCode}</DialogDescription>
          </DialogHeader>
          {selectedQuote && (() => {
            const totalOriginal = (selectedQuote.totalFrete || 0);
            const novoValorFinal = totalOriginal - discountValue;
            const novoIcmsValor = novoValorFinal * ((selectedQuote.icmsAliquota || 0) / 100);
            const novoTotalComIcms = novoValorFinal + novoIcmsValor;

            return (
              <>
                <div className="py-4 space-y-4">
                  <div className="text-center">
                    <p className="text-muted-foreground">Valor Total Atual</p>
                    <p className="text-2xl font-bold">{getFinalValue(selectedQuote).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="discount">Valor do Desconto (R$)</Label>
                    <Input id="discount" value={maskedDiscountValue} onChange={(e) => {
                      const rawValue = e.target.value.replace(/\D/g, '');
                      const numericValue = Number(rawValue) / 100;
                      setDiscountValue(numericValue);
                      setMaskedDiscountValue(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numericValue));
                    }} />
                  </div>
                  <div className="text-center font-bold text-lg space-y-2 border-t pt-4">
                    <p className="text-sm text-muted-foreground">Novo Valor Final (sem ICMS): <span className="font-semibold">{novoValorFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></p>
                    <p>Valor Total (com ICMS): <span className="text-primary">{novoTotalComIcms.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></p>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild><Button variant="secondary" disabled={isSubmitting}>Cancelar</Button></DialogClose>
                  <Button onClick={handleApplyDiscount} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Aplicar Desconto
                  </Button>
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Transfer Quote Dialog */}
      <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Transferir Cotação</DialogTitle>
            <DialogDescription>
              Transferir <span className="font-semibold">{quoteToTransfer?.quoteCode}</span> de <span className="font-semibold">{quoteToTransfer?.usuario}</span> para outro usuário.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Selecione o novo responsável</Label>
              {isLoadingUsers ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Carregando usuários...</span>
                </div>
              ) : (
                <Select value={transferTargetUserId} onValueChange={setTransferTargetUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o usuário..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.username} ({u.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isTransferring}>Cancelar</Button>
            </DialogClose>
            <Button onClick={handleTransferQuote} disabled={isTransferring || !transferTargetUserId}>
              {isTransferring && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Transferir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NfeViewerDialog
        isOpen={isNfeViewerOpen}
        onOpenChange={setIsNfeViewerOpen}
        xmlContent={xmlContentToView}
        nfeChave={nfeChaveToView}
        onRemove={selectedQuote ? () => handleRemoveNfe(selectedQuote) : undefined}
      />

      {/* FAB para voltar ao topo */}
      <Button
        className="fixed bottom-8 right-8 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all"
        size="icon"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        title="Voltar ao início para nova cotação"
      >
        <Plus className="h-6 w-6" />
      </Button>

      <style>{`
        .premium-card-btn {
          position: relative !important;
          overflow: visible !important;
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease !important;
        }
        .premium-card-btn:active {
          transform: scale(0.92) !important;
          transition: transform 0.05s linear !important;
        }
        .premium-card-btn::after {
          content: "";
          position: absolute;
          inset: -2px;
          border-radius: inherit;
          pointer-events: none;
          box-shadow: 0 0 0 0 currentColor;
          opacity: 0;
          transition: box-shadow 0.5s cubic-bezier(0.1, 0.8, 0.2, 1), opacity 0.5s ease-out;
        }
        .premium-card-btn:active::after {
          box-shadow: 0 0 0 0 currentColor;
          opacity: 0.6;
          transition: 0s;
        }
        .premium-card-btn:not(:active)::after {
          box-shadow: 0 0 0 12px currentColor;
          opacity: 0;
        }

        /* Search Box Wrapper Glow Pulse */
        @keyframes inputGlowPulse {
          0%, 100% {
            box-shadow: 0 0 0 0px hsl(var(--primary) / 0), inset 0 0 6px rgba(139, 92, 246, 0.05);
            border-color: rgba(139, 92, 246, 0.3);
          }
          50% {
            box-shadow: 0 0 15px hsl(var(--primary) / 0.25), inset 0 0 12px rgba(139, 92, 246, 0.12);
            border-color: hsl(var(--primary));
          }
        }

        .input-glow-pulse-focus:focus-within {
          animation: inputGlowPulse 2.2s infinite ease-in-out !important;
          outline: none !important;
        }

        /* Search box interior shimmer sweep */
        @keyframes inputInteriorShimmer {
          0% { transform: translateX(-150%); }
          50% { transform: translateX(150%); }
          100% { transform: translateX(150%); }
        }

        .input-interior-shimmer {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.01) 15%,
            rgba(255, 255, 255, 0.08) 50%,
            rgba(255, 255, 255, 0.01) 85%,
            transparent
          );
          transform: translateX(-150%);
          animation: inputInteriorShimmer 8s infinite ease-in-out;
          pointer-events: none;
          z-index: 1;
        }

        /* Focus status color change on icon */
        .input-glow-pulse-focus:focus-within .search-icon-animate {
          color: hsl(var(--primary)) !important;
          transform: translateY(-50%) scale(1.15) !important;
          filter: drop-shadow(0 0 8px hsl(var(--primary) / 0.6));
        }

        /* Premium Search Button styling */
        .premium-search-btn {
          position: relative !important;
          overflow: hidden !important;
          background: linear-gradient(135deg, hsl(var(--primary)) 0%, #8b5cf6 50%, #d946ef 100%) !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          color: white !important;
          font-weight: 600 !important;
          letter-spacing: 0.025em !important;
          transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
          box-shadow: 0 4px 15px rgba(139, 92, 246, 0.25), 
                      inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
          border-radius: 12px !important;
        }

        /* Hover shine sweep glare */
        .premium-search-btn::before {
          content: '';
          position: absolute;
          top: 0;
          left: -150%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.25),
            transparent
          );
          transform: skewX(-25deg);
          pointer-events: none;
          z-index: 2;
        }

        .premium-search-btn:hover:not(:disabled)::before {
          left: 150%;
          transition: left 0.85s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .premium-search-btn:hover:not(:disabled) {
          transform: translateY(-2px) scale(1.02) !important;
          box-shadow: 0 8px 25px rgba(139, 92, 246, 0.45), 
                      inset 0 1px 0 rgba(255, 255, 255, 0.35) !important;
        }

        /* Spring active micro-scale click response */
        .premium-search-btn:active:not(:disabled) {
          transform: translateY(0) scale(0.96) !important;
          transition: transform 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
        }

        /* Inner Radial Light Bloom expansion */
        @keyframes innerBloomEffect {
          0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 0.8;
          }
          100% {
            transform: translate(-50%, -50%) scale(2.5);
            opacity: 0;
          }
        }

        .premium-btn-bloom {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 150px;
          height: 150px;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0) 70%);
          border-radius: 50%;
          transform: translate(-50%, -50%) scale(0);
          pointer-events: none;
          z-index: 1;
        }

        .premium-search-btn.blooming .premium-btn-bloom {
          animation: innerBloomEffect 0.65s cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
