

"use client";

import React, { useEffect, useState, useMemo, useCallback, ChangeEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, Search, History, Edit, Calendar as CalendarIcon, FileText, ChevronDown, ChevronRight, Layers, MoreVertical, Share2, Mail, DollarSign, Printer, Trash2, Banknote, HandCoins, AlertTriangle, MessageSquare, FilePlus, Save } from 'lucide-react';
import type { Quote, PaymentStatus, QuoteHistoryEvent, BillingHistoryEvent, QuoteStatus, Invoice, SharedItem } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isPast, isSameDay, parse, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { printInvoice, generateWhatsAppLink } from '@/lib/print';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { WhatsAppIcon } from '@/components/WhatsAppIcon';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDialogDesc, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ShareItemDialog } from '@/components/chat/ShareItemDialog';
import { authFetch } from '@/lib/api-client';

const formatCurrency = (value: number) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type DisplayItem = (Quote & { isInvoice?: false }) | (Invoice & { isInvoice: true });

export default function BillingMonthPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();

  const monthKey = Array.isArray(params.month) ? params.month[0] : params.month as string;

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Pendente' | 'Parcial' | 'Pago'>('all');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

  const [managedItem, setManagedItem] = useState<DisplayItem | null>(null);
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isPartialAmountDialogOpen, setIsPartialAmountDialogOpen] = useState(false);
  const [partialAmountAction, setPartialAmountAction] = useState<'print' | 'share' | null>(null);
  const [itemToDelete, setItemToDelete] = useState<DisplayItem | null>(null);

  const [paidAmount, setPaidAmount] = useState(0);
  const [maskedPaidAmount, setMaskedPaidAmount] = useState('R$ 0,00');
  const [paymentDate, setPaymentDate] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailToSend, setEmailToSend] = useState('');

  const [discountValue, setDiscountValue] = useState(0);
  const [finalValue, setFinalValue] = useState(0);
  const [maskedDiscountValue, setMaskedDiscountValue] = useState('R$ 0,00');
  const [maskedFinalValue, setMaskedFinalValue] = useState('R$ 0,00');


  const [itemToShare, setItemToShare] = useState<SharedItem | null>(null);
  const [isChatShareOpen, setIsChatShareOpen] = useState(false);
  
  // State for Grouping Dialog
  const [isGroupingDialogOpen, setIsGroupingDialogOpen] = useState(false);
  const [groupSearchTerm, setGroupSearchTerm] = useState('');
  const [isSearchingGroup, setIsSearchingGroup] = useState(false);
  const [groupSearchResults, setGroupSearchResults] = useState<Quote[]>([]);
  const [selectedGroupQuoteIds, setSelectedGroupQuoteIds] = useState<string[]>([]);

  const fetchAllData = useCallback(async () => {
    setIsDataLoading(true);
    try {
      const [quotesRes, invoicesRes] = await Promise.all([
        authFetch(`/api/quotes?status=billing_all&monthYear=${monthKey}`),
        authFetch(`/api/billing/invoices?monthYear=${monthKey}`)
      ]);

      if (!quotesRes.ok || !invoicesRes.ok) throw new Error("Falha ao carregar dados de cobrança.");
      
      setQuotes(await quotesRes.json());
      setInvoices(await invoicesRes.json());

    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro de Carregamento', description: e.message });
    } finally {
      setIsDataLoading(false);
    }
  }, [toast, monthKey]);
  
    // New functions for grouping
  const handleGroupSearch = async () => {
    if (!groupSearchTerm.trim()) {
      toast({ variant: 'destructive', title: 'Busca Inválida', description: 'Insira um termo para buscar.' });
      return;
    }
    setIsSearchingGroup(true);
    try {
      const res = await authFetch(`/api/billing/search-quotes?term=${encodeURIComponent(groupSearchTerm)}`);
      if (res.ok) {
        setGroupSearchResults(await res.json());
      } else {
        setGroupSearchResults([]);
        throw new Error('Falha ao buscar cotações.');
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro na Busca', description: error.message });
    } finally {
      setIsSearchingGroup(false);
    }
  };
  
  const handleGenerateGroupedInvoice = async () => {
    if (selectedGroupQuoteIds.length === 0 || !user) {
        toast({ variant: 'destructive', title: 'Nenhuma Cotação Selecionada' });
        return;
    }
    setIsSubmitting(true);
    try {
        const allPossibleQuotes = [...quotes, ...groupSearchResults];
        const uniqueQuotesMap = new Map(allPossibleQuotes.map(q => [q.id, q]));
        const quotesToGroup = selectedGroupQuoteIds.map(id => uniqueQuotesMap.get(id)).filter(Boolean) as Quote[];
        
        if (quotesToGroup.length !== selectedGroupQuoteIds.length) {
            throw new Error("Algumas cotações selecionadas não foram encontradas. Tente buscar novamente.");
        }
        
        const totalValue = quotesToGroup.reduce((acc, q) => acc + (q.valorFinal || 0) + (q.icmsValor || 0), 0);
        
        const newestQuote = [...quotesToGroup].sort((a,b) => new Date(b.data).getTime() - new Date(a.data).getTime())[0];
        const earliestDueDate = [...quotesToGroup].sort((a,b) => new Date(a.billingDueDate!).getTime() - new Date(b.billingDueDate!).getTime())[0].billingDueDate!;

        const invoicePayload = {
            quoteIds: quotesToGroup.map(q => q.id),
            user: { id: user.id, username: user.username },
            totalValue,
            tomador: newestQuote.tomador,
            tomadorId: newestQuote.tomadorId,
            billingDueDate: earliestDueDate,
        };
        
        const response = await authFetch('/api/billing/invoices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(invoicePayload),
        });
        
        if (!response.ok) throw new Error('Falha ao criar a fatura agrupada.');
        
        toast({ title: 'Sucesso!', description: 'Fatura agrupada criada.' });
        setIsGroupingDialogOpen(false);
        fetchAllData();
        
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Erro ao Agrupar', description: e.message });
    } finally {
        setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user || !user.expensesAccess) {
      router.push('/dashboard');
    } else {
      fetchAllData();
    }
  }, [user, authLoading, router, fetchAllData]);
  
  const displayItems = useMemo(() => {
    const unbilledQuotes = quotes.filter(q => !q.invoiceId);
    
    const items: DisplayItem[] = [
        ...invoices.map(inv => ({...inv, isInvoice: true as const})),
        ...unbilledQuotes.map(q => ({...q, isInvoice: false as const}))
    ];

    let baseItems = items;
      
    if (statusFilter !== 'all') {
        baseItems = baseItems.filter(item => {
            const currentStatus = item.isInvoice ? item.status : item.paymentStatus;
            return currentStatus === statusFilter;
        });
    }

    if (filter) {
        const lowerFilter = filter.toLowerCase();
        baseItems = baseItems.filter(item => 
            item.tomador.toLowerCase().includes(lowerFilter) ||
            (item.isInvoice ? item.invoiceCode : item.quoteCode)?.toLowerCase().includes(lowerFilter) ||
            (item.isInvoice && "fatura agrupada".includes(lowerFilter))
        );
    }
    
    return baseItems.sort((a, b) => new Date(b.billingDueDate || 0).getTime() - new Date(a.billingDueDate || 0).getTime());
  }, [invoices, quotes, filter, statusFilter]);
  
  const summaryStats = useMemo(() => {
    let totalBilled = 0;
    let totalPaid = 0;
    let overdueCount = 0;

    displayItems.forEach(item => {
      const totalDue = item.isInvoice ? item.totalValue - (item.desconto || 0) : ((item.valorFinal || 0) + (item.icmsValor || 0));
      totalBilled += Math.round(totalDue * 100) / 100;
      totalPaid += Math.round((item.paidAmount || 0) * 100) / 100;

      const dueDate = item.billingDueDate ? parseISO(item.billingDueDate) : new Date();
      const isOverdue = isPast(dueDate) && !isSameDay(dueDate, new Date());
      const paymentStatus = item.isInvoice ? item.status : item.paymentStatus || 'Pendente';
      
      if (isOverdue && paymentStatus !== 'Pago') {
        overdueCount++;
      }
    });

    return {
      totalBilled: Math.round(totalBilled * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      balanceDue: Math.round((totalBilled - totalPaid) * 100) / 100,
      overdueCount,
    };
  }, [displayItems]);

  const handleCurrencyChange = (e: ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    const numericValue = Number(rawValue) / 100;
    setPaidAmount(numericValue);
    setMaskedPaidAmount(formatCurrency(numericValue));
  };
  
    const handleDiscountChangeFromInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        const numericDiscount = Number(rawValue) / 100;
        setDiscountValue(numericDiscount);
        setMaskedDiscountValue(formatCurrency(numericDiscount));

        if (managedItem) {
            const originalTotal = managedItem.isInvoice ? managedItem.totalValue : ((managedItem.valorFinal || 0) + (managedItem.icmsValor || 0) + (managedItem.desconto || 0));
            const newFinal = originalTotal - numericDiscount;
            setFinalValue(newFinal);
            setMaskedFinalValue(formatCurrency(newFinal));
        }
    };

    const handleFinalValueChangeFromInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        const numericFinal = Number(rawValue) / 100;
        setFinalValue(numericFinal);
        setMaskedFinalValue(formatCurrency(numericFinal));

        if (managedItem) {
            const originalTotal = managedItem.isInvoice ? managedItem.totalValue : ((managedItem.valorFinal || 0) + (managedItem.icmsValor || 0) + (managedItem.desconto || 0));
            const newDiscount = originalTotal - numericFinal;
            setDiscountValue(newDiscount);
            setMaskedDiscountValue(formatCurrency(newDiscount));
        }
    };

  const handleOpenPayDialog = (item: DisplayItem) => {
    let totalDue = 0;
    if (item.isInvoice) {
        totalDue = item.totalValue - (item.desconto || 0);
    } else {
        totalDue = ((item.valorFinal || item.totalFrete) + (item.icmsValor || 0));
    }

    const amountAlreadyPaid = item.paidAmount || 0;
    const remainingBalance = totalDue - amountAlreadyPaid;
    
    setManagedItem(item);
    setPaidAmount(remainingBalance);
    setMaskedPaidAmount(formatCurrency(remainingBalance));
    setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
    setIsPayDialogOpen(true);
  };
  
   const handleOpenEditDialog = (item: DisplayItem) => {
        setManagedItem(item);
        setNewDueDate(item.billingDueDate ? format(parseISO(item.billingDueDate), 'yyyy-MM-dd') : '');

        const originalTotal = item.isInvoice ? item.totalValue : ((item.valorFinal || 0) + (item.icmsValor || 0) + (item.desconto || 0)); // Recalcula o valor original se for cotação
        const currentDiscount = item.desconto || 0;
        const currentFinalValue = originalTotal - currentDiscount;

        setDiscountValue(currentDiscount);
        setMaskedDiscountValue(formatCurrency(currentDiscount));
        setFinalValue(currentFinalValue);
        setMaskedFinalValue(formatCurrency(currentFinalValue));
        setIsEditDialogOpen(true);
    };

  const handleOpenHistoryDialog = (item: DisplayItem) => {
    setManagedItem(item);
    setIsHistoryDialogOpen(true);
  }

  const handleOpenShareDialog = (item: DisplayItem) => {
      setManagedItem(item);
      setEmailToSend('');
      const paymentStatus = item.isInvoice ? item.status : item.paymentStatus;
      if (paymentStatus === 'Parcial') {
        setPartialAmountAction('share');
        setIsPartialAmountDialogOpen(true);
      } else {
        setIsShareDialogOpen(true);
      }
  }

  const handleOpenChatShareDialog = () => {
    if (!managedItem) return;
    
    const isInvoice = managedItem.isInvoice;
    const totalDue = isInvoice ? managedItem.totalValue : ((managedItem.valorFinal || 0) + (managedItem.icmsValor || 0));

    const sharedItem: SharedItem = {
        type: 'fatura',
        id: managedItem.id,
        title: `Fatura ${isInvoice ? managedItem.invoiceCode : managedItem.quoteCode}`,
        description: `Tomador: ${managedItem.tomador} | Valor: ${formatCurrency(totalDue)}`,
        link: `/financial/billing/invoice/${managedItem.id}`
    };
    setItemToShare(sharedItem);
    setIsShareDialogOpen(false); // close the email/whatsapp dialog
    setIsChatShareOpen(true);
  };
  
  const handleDelete = async () => {
    if (!itemToDelete) return;

    if (user?.role !== 'admin') {
      toast({ variant: 'destructive', title: 'Ação não permitida' });
      return;
    }

    setIsSubmitting(true);
    try {
      const isInvoice = itemToDelete.isInvoice;
      const endpoint = isInvoice ? `/api/billing/invoices/${itemToDelete.id}` : `/api/quotes/${itemToDelete.id}`;
      
      if (isInvoice) {
        const response = await authFetch(endpoint, { method: 'DELETE' });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Falha ao apagar a fatura.');
        }
        toast({ title: 'Sucesso!', description: 'Fatura e seus vínculos com as cotações foram removidos.' });
      } else {
        const response = await authFetch(endpoint, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            user,
            status: 'Aberta',
            billingDueDate: null,
            billingHistory: [],
            paymentStatus: null,
            paidAmount: 0,
            paymentDate: null,
          }),
        });
         if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Falha ao reverter a cobrança da cotação.');
        }
        toast({ title: 'Sucesso!', description: 'Cobrança revertida. A cotação está "Aberta" novamente.' });
      }

      await fetchAllData();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao Apagar', description: e.message });
    } finally {
      setIsSubmitting(false);
      setItemToDelete(null);
    }
  };


  const handleConfirmPayment = async () => {
    if (!managedItem || !user || paidAmount <= 0 || !paymentDate) {
        toast({ variant: 'destructive', title: 'Dados Inválidos', description: 'Verifique o valor e a data do pagamento.' });
        return;
    }
    setIsSubmitting(true);
    
    const isInvoice = managedItem.isInvoice;
    const endpoint = isInvoice ? `/api/billing/invoices/${managedItem.id}` : `/api/quotes/${managedItem.id}`;
    
    const body = {
        paidAmount: (managedItem.paidAmount || 0) + paidAmount,
        paymentDate: new Date(`${paymentDate}T12:00:00Z`).toISOString(),
        user,
    };

    try {
        const response = await authFetch(endpoint, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Falha ao registrar pagamento.');
        }
        
        toast({ title: 'Sucesso!', description: 'Pagamento registrado.' });
        fetchAllData();
        setIsPayDialogOpen(false);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Erro ao Pagar', description: e.message });
    } finally {
        setIsSubmitting(false);
    }
  };
  
   const handleSaveChanges = async () => {
        if (!managedItem || !user) return;

        const originalDueDate = managedItem.billingDueDate ? format(parseISO(managedItem.billingDueDate), 'yyyy-MM-dd') : '';
        const dueDateChanged = newDueDate !== originalDueDate;
        const discountChanged = discountValue !== (managedItem.desconto || 0);

        if (!dueDateChanged && !discountChanged) {
            toast({ title: 'Nenhuma alteração detectada.' });
            setIsEditDialogOpen(false);
            return;
        }

        setIsSubmitting(true);
        
        const isInvoice = managedItem.isInvoice;
        const endpoint = isInvoice ? `/api/billing/invoices/${managedItem.id}` : `/api/quotes/${managedItem.id}`;
        
        const updates: any = { user };
        if (dueDateChanged) {
            updates.billingDueDate = new Date(`${newDueDate}T12:00:00Z`).toISOString();
        }
        if (discountChanged) {
            updates.desconto = discountValue;
        }

        try {
            const response = await authFetch(endpoint, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Falha ao salvar alterações.');
            }
            toast({ title: 'Sucesso!', description: 'Alterações salvas.' });
            await fetchAllData();
            setIsEditDialogOpen(false);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Erro ao Salvar', description: e.message });
        } finally {
            setIsSubmitting(false);
        }
    };


  const handlePrintAction = (item: DisplayItem) => {
    const paymentStatus = item.isInvoice ? item.status : item.paymentStatus;
    if (paymentStatus === 'Parcial') {
      setManagedItem(item);
      setPartialAmountAction('print');
      setIsPartialAmountDialogOpen(true);
    } else {
      printInvoice(item);
    }
  };

  const handlePartialAmountAction = (amountType: 'total' | 'partial') => {
    if (!managedItem || !partialAmountAction) return;
    
    if (partialAmountAction === 'print') {
      printInvoice(managedItem, amountType);
    } else if (partialAmountAction === 'share') {
      setIsShareDialogOpen(true);
    }
    
    setIsPartialAmountDialogOpen(false);
    setPartialAmountAction(null);
  };
  

  if (authLoading || !user) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  const monthDate = parse(monthKey, 'yyyy-MM', new Date());
  const monthName = isValid(monthDate) ? format(monthDate, "MMMM 'de' yyyy", { locale: ptBR }) : 'Mês Inválido';


  return (
    <main className="container mx-auto p-4 md:p-8">
      <Button variant="outline" onClick={() => router.push('/financial/billing')} className="mb-8">
        &larr; Voltar para o Painel de Cobranças
      </Button>

      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-bold text-primary capitalize">{monthName}</h1>
        <p className="text-muted-foreground">Gerencie o status de pagamento das faturas e cotações.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Faturado</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(summaryStats.totalBilled)}</div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Recebido</CardTitle>
                <HandCoins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(summaryStats.totalPaid)}</div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Saldo Devedor</CardTitle>
                <Banknote className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-orange-500">{formatCurrency(summaryStats.balanceDue)}</div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cobranças Vencidas</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-destructive">{summaryStats.overdueCount}</div>
            </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between gap-4">
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar por tomador ou código..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Button variant={statusFilter === 'all' ? 'default' : 'outline'} onClick={() => setStatusFilter('all')}>Todas</Button>
                <Button variant={statusFilter === 'Pendente' ? 'default' : 'outline'} onClick={() => setStatusFilter('Pendente')}>Pendentes</Button>
                <Button variant={statusFilter === 'Parcial' ? 'default' : 'outline'} onClick={() => setStatusFilter('Parcial')}>Parciais</Button>
                <Button variant={statusFilter === 'Pago' ? 'default' : 'outline'} onClick={() => setStatusFilter('Pago')}>Pagas</Button>
              </div>
          </div>
          <div className="flex justify-end pt-4">
             <Button onClick={() => setIsGroupingDialogOpen(true)}>
                <FilePlus className="mr-2 h-4 w-4"/> Agrupar Cobrança
            </Button>
          </div>
        </CardHeader>
        <CardContent>
        {isDataLoading ? (
            <div className="text-center py-16"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /><p className="mt-4 text-muted-foreground">A carregar cobranças...</p></div>
        ) : (
          <div className="border rounded-md">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Fatura / Cotação</TableHead>
                        <TableHead>Tomador</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Valor Total</TableHead>
                        <TableHead>Saldo Devedor</TableHead>
                        <TableHead>Status Pagamento</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {displayItems.length > 0 ? displayItems.map((item) => {
                        const isInvoice = item.isInvoice;
                        const totalDue = isInvoice ? item.totalValue : ((item.valorFinal || 0) + (item.icmsValor || 0) + (item.desconto || 0));
                        const discount = item.desconto || 0;
                        const amountPaid = item.paidAmount || 0;
                        const finalValue = totalDue - discount;
                        const balanceDue = finalValue - amountPaid;
                        const dueDate = item.billingDueDate ? parseISO(item.billingDueDate) : null;
                        const isOverdue = dueDate && isPast(dueDate) && !isSameDay(dueDate, new Date());
                        const paymentStatus = isInvoice ? item.status : item.paymentStatus || 'Pendente';
                        const code = isInvoice ? item.invoiceCode : item.quoteCode;
                        const isExpanded = isInvoice && expandedInvoiceId === item.id;
      
                        return (
                          <React.Fragment key={item.id}>
                              <TableRow className={cn(isExpanded && "bg-muted hover:bg-muted")}>
                                <TableCell>
                                    {isInvoice ? (
                                      <Button variant="link" className="p-0" onClick={() => setExpandedInvoiceId(isExpanded ? null : item.id)}>
                                          {isExpanded ? <ChevronDown className="h-4 w-4 mr-2"/> : <ChevronRight className="h-4 w-4 mr-2"/>}
                                          <Badge variant="secondary" className="bg-orange-500 text-white">{code}</Badge>
                                      </Button>
                                    ) : (
                                      <Button variant="link" className="p-0" onClick={() => handleOpenHistoryDialog(item)}>
                                          <Badge variant="secondary">{code}</Badge>
                                      </Button>
                                    )}
                                </TableCell>
                                <TableCell>{item.tomador}</TableCell>
                                <TableCell className={cn({'text-destructive font-bold': isOverdue && paymentStatus !== 'Pago'})}>
                                  {dueDate ? format(dueDate, 'dd/MM/yyyy') : 'N/A'}
                                  {isOverdue && paymentStatus !== 'Pago' && <Badge variant="destructive" className="ml-2">Vencido</Badge>}
                                </TableCell>
                                <TableCell className="font-semibold">
                                     {discount > 0 ? (
                                        <div>
                                            <span className="line-through text-muted-foreground text-xs">{formatCurrency(totalDue)}</span>
                                            <p>{formatCurrency(finalValue)}</p>
                                        </div>
                                        ) : (
                                            formatCurrency(totalDue)
                                    )}
                                </TableCell>
                                <TableCell className="font-semibold text-destructive">{formatCurrency(balanceDue)}</TableCell>
                                <TableCell>
                                  <Badge className={cn({
                                      'bg-yellow-500 hover:bg-yellow-600': paymentStatus === 'Pendente',
                                      'bg-orange-500 hover:bg-orange-600': paymentStatus === 'Parcial',
                                      'bg-green-600 hover:bg-green-700': paymentStatus === 'Pago',
                                  })}>
                                    {paymentStatus}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <AlertDialog>
                                      <DropdownMenu modal={false}>
                                          <DropdownMenuTrigger asChild>
                                              <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4"/></Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                              <DropdownMenuLabel>Gerenciar Cobrança</DropdownMenuLabel>
                                              <DropdownMenuSeparator />
                                              {paymentStatus !== 'Pago' && (
                                                <DropdownMenuItem onSelect={() => handleOpenPayDialog(item)}>
                                                    <DollarSign className="mr-2 h-4 w-4" />
                                                    <span>Lançar Pagamento</span>
                                                </DropdownMenuItem>
                                              )}
                                              <DropdownMenuItem onSelect={() => handleOpenEditDialog(item)}>
                                                <Edit className="mr-2 h-4 w-4" />
                                                <span>Editar Fatura</span>
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onSelect={() => handlePrintAction(item)}>
                                                  <Printer className="mr-2 h-4 w-4" />
                                                  <span>Imprimir Fatura</span>
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onSelect={() => handleOpenShareDialog(item)}>
                                                  <Share2 className="mr-2 h-4 w-4" />
                                                  <span>Enviar Fatura</span>
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onSelect={() => handleOpenHistoryDialog(item)}>
                                                  <History className="mr-2 h-4 w-4" />
                                                  <span>Ver Histórico</span>
                                              </DropdownMenuItem>
                                              {user?.role === 'admin' && (
                                                  <>
                                                      <DropdownMenuSeparator />
                                                      <AlertDialogTrigger asChild>
                                                          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={(e) => {e.preventDefault(); setItemToDelete(item);}}>
                                                              <Trash2 className="mr-2 h-4 w-4" />
                                                              <span>Apagar</span>
                                                          </DropdownMenuItem>
                                                      </AlertDialogTrigger>
                                                  </>
                                              )}
                                          </DropdownMenuContent>
                                      </DropdownMenu>
                                      <AlertDialogContent>
                                          <AlertDialogHeader>
                                              <AlertDialogTitle>Tem a certeza?</AlertDialogTitle>
                                              <AlertDialogDesc>
                                                  {itemToDelete?.isInvoice 
                                                      ? `A fatura ${itemToDelete.invoiceCode} será apagada permanentemente.`
                                                      : `A cobrança da cotação ${itemToDelete?.quoteCode} será revertida. A cotação voltará ao status "Aberta".`
                                                  }
                                                  Esta ação não pode ser desfeita.
                                              </AlertDialogDesc>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                              <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
                                              <AlertDialogAction onClick={handleDelete} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
                                                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Confirmar'}
                                              </AlertDialogAction>
                                          </AlertDialogFooter>
                                      </AlertDialogContent>
                                  </AlertDialog>
                                </TableCell>
                              </TableRow>
                              {isExpanded && isInvoice && (
                                  <TableRow className="bg-orange-100 dark:bg-orange-900/20">
                                      <TableCell colSpan={7} className="p-0">
                                          <div className="p-4">
                                              <h4 className="font-bold mb-2">Cotações Agrupadas</h4>
                                              <Table>
                                                  <TableHeader>
                                                      <TableRow>
                                                          <TableHead>Cotação</TableHead>
                                                          <TableHead>Tomador</TableHead>
                                                          <TableHead>Vencimento</TableHead>
                                                          <TableHead className="text-right">Valor</TableHead>
                                                      </TableRow>
                                                  </TableHeader>
                                                  <TableBody>
                                                      {quotes.filter(q => item.quoteIds.includes(q.id)).map(childQuote => (
                                                          <TableRow key={childQuote.id}>
                                                              <TableCell>{childQuote.quoteCode}</TableCell>
                                                              <TableCell>{childQuote.tomador}</TableCell>
                                                              <TableCell>{childQuote.billingDueDate ? format(parseISO(childQuote.billingDueDate), 'dd/MM/yyyy') : 'N/A'}</TableCell>
                                                              <TableCell className="text-right">{formatCurrency((childQuote.valorFinal || 0) + (childQuote.icmsValor || 0))}</TableCell>
                                                          </TableRow>
                                                      ))}
                                                  </TableBody>
                                              </Table>
                                          </div>
                                      </TableCell>
                                  </TableRow>
                              )}
                          </React.Fragment>
                        );
                    }) : (
                        <TableRow><TableCell colSpan={7} className="h-24 text-center">Nenhuma cobrança encontrada para os filtros atuais.</TableCell></TableRow>
                    )}
                </TableBody>
            </Table>
          </div>
        )}
        </CardContent>
      </Card>
      
      {/* DIALOGS */}
      <Dialog open={isPayDialogOpen} onOpenChange={(open) => { setIsPayDialogOpen(open); if(!open) setManagedItem(null); }}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Registrar Pagamento</DialogTitle>
                <DialogDescription>
                    {`Registre um pagamento para ${managedItem?.isInvoice ? 'a fatura' : 'a cotação'} ${managedItem?.isInvoice ? managedItem.invoiceCode : managedItem?.quoteCode}.`}
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="paidAmount">Valor a ser Pago</Label>
                    <Input 
                        id="paidAmount" 
                        value={maskedPaidAmount} 
                        onChange={handleCurrencyChange} 
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="paymentDate">Data do Pagamento</Label>
                    <Input id="paymentDate" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild><Button type="button" variant="secondary" disabled={isSubmitting}>Cancelar</Button></DialogClose>
                <Button onClick={handleConfirmPayment} disabled={isSubmitting || paidAmount <= 0}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4"/>}
                    Registrar Pagamento
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar Cobrança: {managedItem?.isInvoice ? managedItem.invoiceCode : managedItem?.quoteCode}</DialogTitle>
                    <DialogDescription>Altere a data de vencimento, o desconto ou o valor final da fatura.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="billingDueDate" className="font-semibold">Nova Data de Vencimento</Label>
                        <Input id="billingDueDate" type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="discountValue">Valor do Desconto (R$)</Label>
                        <Input id="discountValue" value={maskedDiscountValue} onChange={handleDiscountChangeFromInput} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="finalValue">Valor Líquido da Fatura (R$)</Label>
                        <Input id="finalValue" value={maskedFinalValue} onChange={handleFinalValueChangeFromInput} />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="secondary" disabled={isSubmitting}>Cancelar</Button></DialogClose>
                    <Button onClick={handleSaveChanges} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                        Salvar Alterações
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      
      <Dialog open={isHistoryDialogOpen} onOpenChange={(open) => { setIsHistoryDialogOpen(open); if(!open) setManagedItem(null); }}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Histórico Completo: {managedItem?.isInvoice ? managedItem.invoiceCode : managedItem?.quoteCode}</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto p-1">
                    {!managedItem?.isInvoice && (
                        <div>
                            <h3 className="font-semibold mb-2">Histórico da Cotação</h3>
                            <ScrollArea className="h-96 pr-4">
                                {(managedItem as Quote)?.history?.map(event => (
                                    <div key={event.id} className="mb-4 text-sm">
                                        <p className="font-semibold">{(event.action || 'AÇÃO DESCONHECIDA').replace(/_/g, ' ')}</p>
                                        <p className="text-xs text-muted-foreground">{new Date(event.timestamp).toLocaleString('pt-BR')} por {event.username}</p>
                                        <p className="text-xs mt-1">{event.details}</p>
                                    </div>
                                ))}
                            </ScrollArea>
                        </div>
                    )}
                    <div>
                        <h3 className="font-semibold mb-2">Histórico da Cobrança</h3>
                         <ScrollArea className="h-96 pr-4">
                            {(managedItem?.billingHistory || []).map(event => (
                                <div key={event.id} className="mb-4 text-sm">
                                    <p className="font-semibold">{(event.action || 'AÇÃO DESCONHECIDA').replace(/_/g, ' ')}</p>
                                    <p className="text-xs text-muted-foreground">{new Date(event.timestamp).toLocaleString('pt-BR')} por {event.username}</p>
                                    <p className="text-xs mt-1">{event.details}</p>
                                </div>
                            ))}
                        </ScrollArea>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Fechar</Button></DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        
        <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
          <DialogContent>
            <DialogHeader>
                <DialogTitle>Enviar Fatura</DialogTitle>
                <DialogDescription>
                    Envie a cobrança {managedItem?.isInvoice ? managedItem.invoiceCode : managedItem?.quoteCode} por e-mail ou WhatsApp.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="email">E-mail do Destinatário</Label>
                    <Input id="email" type="email" value={emailToSend} onChange={(e) => setEmailToSend(e.target.value)} placeholder="cliente@email.com" />
                </div>
                 <Button className="w-full" onClick={() => {
                     if(managedItem && emailToSend) {
                        const code = managedItem.isInvoice ? managedItem.invoiceCode : managedItem.quoteCode;
                        const subject = `Fatura Ref. ${code}`;
                        const body = `Olá,\n\nSegue a fatura referente à cobrança ${code}.\n\nPara visualizar, acesse: ${window.location.origin}/financial/billing/invoice/${managedItem.id}`;
                        window.location.href = `mailto:${emailToSend}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                        setIsShareDialogOpen(false);
                     } else {
                         toast({ variant: 'destructive', title: 'Erro', description: 'Por favor, insira um e-mail válido.' });
                     }
                 }}><Mail className="mr-2 h-4 w-4"/>Enviar por E-mail</Button>
                 <Button className="w-full" variant="secondary" onClick={() => {
                     if (managedItem) {
                         window.open(generateWhatsAppLink(managedItem as any), '_blank');
                         setIsShareDialogOpen(false);
                     }
                 }}><WhatsAppIcon />Enviar por WhatsApp</Button>
                 <Button className="w-full" variant="outline" onClick={handleOpenChatShareDialog}>
                    <MessageSquare className="mr-2 h-4 w-4"/>
                    Compartilhar no Chat
                </Button>
            </div>
            <DialogFooter>
                <DialogClose asChild><Button variant="outline">Fechar</Button></DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isPartialAmountDialogOpen} onOpenChange={setIsPartialAmountDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Opções da Fatura Parcial</DialogTitle>
                    <DialogDescription>
                        Esta cobrança foi paga parcialmente. Como deseja gerar o documento?
                    </DialogDescription>
                </DialogHeader>
                <div className="py-6 space-y-4">
                    <Button className="w-full h-16 text-base" onClick={() => handlePartialAmountAction('total')}>
                        Usar Valor Total Original
                    </Button>
                    <Button className="w-full h-16 text-base" variant="secondary" onClick={() => handlePartialAmountAction('partial')}>
                        Usar Apenas Saldo Pendente
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
        <ShareItemDialog item={itemToShare} open={isChatShareOpen} onOpenChange={setIsChatShareOpen} />
        
        <Dialog open={isGroupingDialogOpen} onOpenChange={setIsGroupingDialogOpen}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Agrupar Cobranças em uma Fatura</DialogTitle>
                    <DialogDescription>
                        Pesquise e selecione as cotações com status "Pendente" que deseja agrupar em uma única fatura.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex items-center gap-2 pt-4">
                    <Input 
                        placeholder="Buscar por tomador, CNPJ ou código da cotação..."
                        value={groupSearchTerm}
                        onChange={(e) => setGroupSearchTerm(e.target.value)}
                        disabled={isSearchingGroup}
                    />
                    <Button onClick={handleGroupSearch} disabled={isSearchingGroup}>
                       {isSearchingGroup ? <Loader2 className="h-4 w-4 animate-spin"/> : <Search className="h-4 w-4"/>}
                    </Button>
                </div>
                <ScrollArea className="flex-grow border rounded-md mt-4">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]">
                                    <Checkbox
                                        checked={selectedGroupQuoteIds.length > 0 && selectedGroupQuoteIds.length === groupSearchResults.length}
                                        onCheckedChange={(checked) => {
                                            setSelectedGroupQuoteIds(checked ? groupSearchResults.map(q => q.id) : [])
                                        }}
                                    />
                                </TableHead>
                                <TableHead>Cotação</TableHead>
                                <TableHead>Tomador</TableHead>
                                <TableHead>Vencimento</TableHead>
                                <TableHead className="text-right">Valor</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isSearchingGroup ? (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin"/></TableCell></TableRow>
                            ) : groupSearchResults.length > 0 ? (
                                groupSearchResults.map(quote => (
                                    <TableRow key={quote.id}>
                                        <TableCell><Checkbox 
                                            checked={selectedGroupQuoteIds.includes(quote.id)}
                                            onCheckedChange={(checked) => {
                                                setSelectedGroupQuoteIds(prev => checked ? [...prev, quote.id] : prev.filter(id => id !== quote.id))
                                            }}
                                        /></TableCell>
                                        <TableCell>{quote.quoteCode}</TableCell>
                                        <TableCell>{quote.tomador}</TableCell>
                                        <TableCell>{quote.billingDueDate ? format(parseISO(quote.billingDueDate), 'dd/MM/yyyy') : 'N/A'}</TableCell>
                                        <TableCell className="text-right">{formatCurrency((quote.valorFinal || 0) + (quote.icmsValor || 0))}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Nenhuma cotação pendente encontrada para a busca.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
                <DialogFooter>
                    <DialogClose asChild><Button variant="secondary" disabled={isSubmitting}>Cancelar</Button></DialogClose>
                    <Button onClick={handleGenerateGroupedInvoice} disabled={isSubmitting || selectedGroupQuoteIds.length === 0}>
                       {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileText className="mr-2 h-4 w-4"/>}
                       Gerar Fatura Agrupada ({selectedGroupQuoteIds.length})
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </main>
  );
}

    




