
"use client";

import { useState, useMemo, useRef, ChangeEvent, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuPortal, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Edit, Trash2, DollarSign, Upload, CheckCircle, RotateCcw, FileArchive, History, File as FileIcon, MoreVertical, Search, Share2, Truck, User2, FileText, Move, Building2, Briefcase } from 'lucide-react';
import type { Expense, ExpenseCategory, User, ExpenseHistoryEvent, SharedItem, Driver, Talent, Quote, Company, Owner } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { getInitials, getQuoteCode, cn } from '@/lib/utils';
import { Separator } from './ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription as AlertDialogDesc, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from './ui/badge';
import { format, parseISO, isPast, isSameDay } from 'date-fns';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import Image from 'next/image';
import { ScrollArea } from './ui/scroll-area';
import { ShareItemDialog } from './chat/ShareItemDialog';
import { authFetch } from '@/lib/api-client';

const expenseFormSchema = z.object({
  description: z.string().min(3, 'Descrição é obrigatória.'),
  categoryId: z.string().min(1, 'Categoria é obrigatória.'),
  value: z.coerce.number().min(0.01, 'Valor deve ser positivo.'),
  dueDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Data de vencimento inválida." }),
  notes: z.string().optional(),
  isRecurring: z.boolean().default(false),
  isInstallment: z.boolean().default(false),
  installmentCount: z.coerce.number().optional(),
});

interface ExpenseManagementProps {
    monthKey: string;
    expenses: Expense[];
    expenseCategories: ExpenseCategory[];
    onDataMutated: () => void;
    addExpense: (data: Partial<Expense>) => Promise<boolean>;
}

export function ExpenseManagement({ monthKey, expenses, expenseCategories, onDataMutated, addExpense }: ExpenseManagementProps) {
  const { user } = useAuth();
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isProofsOpen, setIsProofsOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const isAdmin = user?.role === 'admin';
  const canAddExpense = isAdmin || !!user?.subPermissions?.financial?.canLogExpense;
  const canDeleteExpense = isAdmin || !!user?.subPermissions?.financial?.canDeleteExpense;
  const canApprovePayment = isAdmin || !!user?.subPermissions?.financial?.canApproveExpense;

  const [paidValue, setPaidValue] = useState(0);
  const [maskedPaidValue, setMaskedPaidValue] = useState('R$ 0,00');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const proofInputRef = useRef<HTMLInputElement>(null);
  
  const [maskedValue, setMaskedValue] = useState('R$ 0,00');
  const [searchTerm, setSearchTerm] = useState('');
  const [groupBy, setGroupBy] = useState<'none' | 'category'>('none');

  const [itemToShare, setItemToShare] = useState<SharedItem | null>(null);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);

  // View entity detail dialogs
  const [viewingDriver, setViewingDriver] = useState<Driver | null>(null);
  const [isDriverViewOpen, setIsDriverViewOpen] = useState(false);
  const [viewingTalent, setViewingTalent] = useState<Talent | null>(null);
  const [isTalentViewOpen, setIsTalentViewOpen] = useState(false);
  const [viewingQuote, setViewingQuote] = useState<Quote | null>(null);
  const [isQuoteViewOpen, setIsQuoteViewOpen] = useState(false);
  const [viewingCustomer, setViewingCustomer] = useState<Company | null>(null);
  const [isCustomerViewOpen, setIsCustomerViewOpen] = useState(false);
  const [viewingOwner, setViewingOwner] = useState<Owner | null>(null);
  const [isOwnerViewOpen, setIsOwnerViewOpen] = useState(false);
  const [isLoadingEntity, setIsLoadingEntity] = useState(false);

  const form = useForm<z.infer<typeof expenseFormSchema>>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      isRecurring: false,
      isInstallment: false,
      installmentCount: 2,
    }
  });
  
  const isEditing = !!editingExpense;
  
  const watchedValue = form.watch('value');
  const watchedInstallmentCount = form.watch('installmentCount');
  
  const filteredExpenses = useMemo(() => {
    if (!searchTerm.trim()) {
      return expenses;
    }
    const lowercasedFilter = searchTerm.toLowerCase();
    return expenses.filter(exp => 
      exp.description.toLowerCase().includes(lowercasedFilter) ||
      exp.categoryName.toLowerCase().includes(lowercasedFilter) ||
      (exp.notes && exp.notes.toLowerCase().includes(lowercasedFilter)) ||
      exp.value.toString().includes(lowercasedFilter)
    );
  }, [expenses, searchTerm]);

  const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  const handleCurrencyChange = (e: ChangeEvent<HTMLInputElement>, fieldName: 'value' | 'paidValue') => {
    const rawValue = e.target.value.replace(/\D/g, '');
    if (!rawValue) {
        if (fieldName === 'value') {
            setMaskedValue(formatCurrency(0));
            form.setValue('value', 0);
        } else {
            setPaidValue(0);
            setMaskedPaidValue(formatCurrency(0));
        }
        return;
    }
    const numericValue = Number(rawValue) / 100;
    
    if(fieldName === 'value') {
      setMaskedValue(formatCurrency(numericValue));
      form.setValue('value', numericValue, { shouldValidate: true });
    } else {
        setPaidValue(numericValue);
        setMaskedPaidValue(formatCurrency(numericValue));
    }
  };

  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [expenseToLink, setExpenseToLink] = useState<Expense | null>(null);
  const [linkType, setLinkType] = useState<"driver" | "quote" | "talent" | "customer" | "owner" | null>(null);
  const [linkItems, setLinkItems] = useState<any[]>([]);
  const [isLoadingLinkItems, setIsLoadingLinkItems] = useState(false);
  const [selectedLinkId, setSelectedLinkId] = useState<string>('');
  const [isLinking, setIsLinking] = useState(false);
  const [linkSearchTerm, setLinkSearchTerm] = useState('');

  const handleOpenLinkDialog = (expense: Expense, type: 'driver' | 'quote' | 'talent' | 'customer' | 'owner') => {
       setExpenseToLink(expense);
       setLinkType(type);
       setIsLinkDialogOpen(true);
       setLinkSearchTerm('');
       setLinkItems([]);
       setSelectedLinkId('');
       setIsLoadingLinkItems(false);
  };

  const handleSearchLinkItems = async () => {
       if (!linkSearchTerm.trim() || !linkType) return;
       setIsLoadingLinkItems(true);
       setSelectedLinkId('');
       try {
           let res;
           if (linkType === 'driver') res = await authFetch(`/api/drivers?limit=20&term=${encodeURIComponent(linkSearchTerm)}`);
           else if (linkType === 'quote') res = await authFetch(`/api/quotes?limit=20&term=${encodeURIComponent(linkSearchTerm)}&excludeStatus=Aberta`);
           else if (linkType === 'talent') res = await authFetch(`/api/talents?limit=20&term=${encodeURIComponent(linkSearchTerm)}`);
           else if (linkType === 'customer') res = await authFetch(`/api/customers?limit=20&term=${encodeURIComponent(linkSearchTerm)}`);
           else if (linkType === 'owner') res = await authFetch(`/api/owners`); // API owner not paginated yet
           
           if (res && res.ok) {
                const data = await res.json();
                if (linkType === 'quote' && data.quotes) {
                    setLinkItems(data.quotes);
                } else if (linkType === 'driver' && data.drivers) {
                    setLinkItems(data.drivers);
                } else if (linkType === 'owner') {
                    // client side filtering
                    const searchLower = linkSearchTerm.toLowerCase();
                    setLinkItems(data.filter((o: any) => o.name?.toLowerCase().includes(searchLower) || o.document?.includes(linkSearchTerm)));
                } else {
                    setLinkItems(data);
                }
           }
       } catch(e) {
           toast({ variant: 'destructive', title: 'Erro', description: 'Failed to search options' });
       } finally {
           setIsLoadingLinkItems(false);
       }
  };

  const handleUnlink = async (expense: Expense, type: string) => {
    setIsLinking(true);
    let updates: any = {};
    if (type === 'driver') {
        updates = { driverId: null, driverName: null };
    } else if (type === 'quote') {
        updates = { quoteId: null };
    } else if (type === 'talent') {
        updates = { talentId: null, talentName: null };
    } else if (type === 'customer') {
        updates = { customerId: null, customerName: null };
    } else if (type === 'owner') {
        updates = { ownerId: null, ownerName: null };
    }
    
    try {
        const res = await authFetch(`/api/expenses/${expense.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...updates, user: { username: user!.username } })
        });
        
        if (!res.ok) {
             const errorData = await res.json();
             throw new Error(errorData.message || 'Falha ao desvincular.');
        }
        toast({ title: 'Sucesso', description: 'Vínculo removido com sucesso.' });
        onDataMutated();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
        setIsLinking(false);
    }
  };

  const handleConfirmLink = async () => {
    if (!expenseToLink || !selectedLinkId || !linkType) return;
    setIsLinking(true);
    
    let updates: any = {};
    const item = linkItems.find(i => i.id === selectedLinkId);
    
    if (linkType === 'driver') {
        updates = { driverId: selectedLinkId, driverName: item?.name };
    } else if (linkType === 'quote') {
        updates = { quoteId: selectedLinkId };
    } else if (linkType === 'talent') {
        updates = { talentId: selectedLinkId, talentName: item?.fullName };
    } else if (linkType === 'customer') {
        updates = { customerId: selectedLinkId, customerName: item?.razaoSocial || item?.nome };
    } else if (linkType === 'owner') {
        updates = { ownerId: selectedLinkId, ownerName: item?.name };
    }
    
    try {
        const res = await authFetch(`/api/expenses/${expenseToLink.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...updates, user: { username: user!.username } })
        });
        
        if (!res.ok) {
             const errorData = await res.json();
             throw new Error(errorData.message || 'Falha ao vincular.');
        }
        toast({ title: 'Sucesso', description: 'Vinculado com sucesso.' });
        onDataMutated();
        setIsLinkDialogOpen(false);
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
        setIsLinking(false);
    }
  };


  const installmentPreview = useMemo(() => {
    if (!form.watch('isInstallment') || !watchedValue || !watchedInstallmentCount || watchedInstallmentCount < 2) {
      return '';
    }

    const totalValue = watchedValue;
    const count = watchedInstallmentCount;
    
    const baseInstallmentValue = Math.floor((totalValue / count) * 100) / 100;
    const remainder = totalValue - (baseInstallmentValue * count);
    const lastInstallmentValue = baseInstallmentValue + remainder;

    if (Math.abs(baseInstallmentValue - lastInstallmentValue) < 0.01) {
        return `${count}x de ${baseInstallmentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
    } else {
        return `${count - 1}x de ${baseInstallmentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} + 1x de ${lastInstallmentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
    }
  }, [watchedValue, watchedInstallmentCount, form.watch('isInstallment')]);


  const handleOpenFormDialog = (expense: Expense | null) => {
    setEditingExpense(expense);
    if (expense) {
      form.reset({
        ...expense,
        dueDate: format(parseISO(expense.dueDate), 'yyyy-MM-dd'),
      });
      setMaskedValue(formatCurrency(expense.value));
    } else {
      form.reset({
        description: '', categoryId: '', value: 0, 
        dueDate: format(new Date(), 'yyyy-MM-dd'),
        notes: '', isRecurring: false, isInstallment: false, installmentCount: 2
      });
      setMaskedValue(formatCurrency(0));
    }
    setIsFormDialogOpen(true);
  };
  
    const handleOpenPayDialog = (expense: Expense) => {
        const remainingValue = expense.value - (expense.paidValue || 0);
        setEditingExpense(expense);
        setPaidValue(remainingValue > 0 ? remainingValue : 0);
        setMaskedPaidValue(formatCurrency(remainingValue > 0 ? remainingValue : 0));
        setProofFile(null);
        setProofPreview(null);
        setIsPayDialogOpen(true);
    };

    const handleOpenHistoryDialog = (expense: Expense) => {
        setEditingExpense(expense);
        setIsHistoryOpen(true);
    }
    
    const handleOpenProofsDialog = (expense: Expense) => {
        setEditingExpense(expense);
        setIsProofsOpen(true);
    };

  const handleFormSubmit = async (values: z.infer<typeof expenseFormSchema>) => {
    setIsSubmitting(true);
    try {
        const endpoint = editingExpense ? `/api/expenses/${editingExpense.id}` : 
                         values.isInstallment ? '/api/expenses/installments' : 
                         values.isRecurring ? '/api/expenses/recurring' : '/api/expenses';
        const method = editingExpense ? 'PUT' : 'POST';

        const body = {
            ...values,
            userId: user!.id,
            user: { username: user!.username },
            monthYear: format(parseISO(values.dueDate), 'yyyy-MM'),
            ...(editingExpense && { updateFuture: values.isRecurring }),
        };

        const response = await authFetch(endpoint, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Falha ao salvar despesa.');
        }

        toast({ title: 'Sucesso!', description: `Despesa ${editingExpense ? 'atualizada' : 'adicionada'}.` });
        setIsFormDialogOpen(false);
        onDataMutated();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string, deleteAllFuture: boolean) => {
    if (!expenseId) return;
    setIsSubmitting(true);
    try {
      const response = await authFetch(`/api/expenses/${expenseId}?deleteAllFuture=${deleteAllFuture}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha ao remover despesa.');
      }
      toast({ title: 'Sucesso!', description: 'Despesa removida.' });
      onDataMutated();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    }
    setExpenseToDelete(null);
    setIsSubmitting(false);
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        setProofFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setProofPreview(reader.result as string);
        }
        reader.readAsDataURL(file);
    }
  };

  const handleConfirmPayment = async () => {
    if (!editingExpense || !proofFile || !user) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Selecione um ficheiro de comprovativo e verifique se está autenticado.' });
        return;
    }
    setIsSubmitting(true);
    
    const formData = new FormData();
    formData.append('file', proofFile);
    formData.append('user', JSON.stringify(user));
    formData.append('paidValue', String(paidValue));

    try {
        const uploadResponse = await authFetch(`/api/expenses/${editingExpense.id}/upload-proof`, {
            method: 'POST',
            body: formData,
        });

        if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            throw new Error(errorData.message || 'Falha no upload do comprovativo e na confirmação do pagamento.');
        }
        
        toast({ title: 'Sucesso!', description: 'Pagamento registado e comprovativo anexado.' });
        onDataMutated();
        setIsPayDialogOpen(false);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
        setIsSubmitting(false);
    }
};
  
    const handleRevertPayment = async (expense: Expense) => {
        if (!user) return;
        setIsSubmitting(true);
        try {
            const response = await authFetch(`/api/expenses/${expense.id}/upload-proof?user=${encodeURIComponent(JSON.stringify(user))}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Falha ao reverter pagamento.');

            toast({ title: 'Sucesso!', description: 'Pagamento revertido para pendente e comprovativo removido.' });
            onDataMutated();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Erro', description: e.message });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleOpenShareDialog = (expense: Expense) => {
        const sharedItem: SharedItem = {
            type: 'despesa',
            id: expense.id,
            title: expense.description,
            description: `Valor: ${formatCurrency(expense.value)} | Vencimento: ${format(parseISO(expense.dueDate), 'dd/MM/yyyy')}`,
            link: `/financial/expenses/${expense.monthYear}`
        };
        setItemToShare(sharedItem);
        setIsShareDialogOpen(true);
    };

    const handleViewDriver = useCallback(async (driverId: string) => {
        setIsLoadingEntity(true);
        try {
            const res = await authFetch(`/api/drivers/${driverId}`);
            if (!res.ok) throw new Error('Falha ao carregar motorista.');
            const driver = await res.json();
            setViewingDriver(driver);
            setIsDriverViewOpen(true);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Erro', description: e.message });
        } finally {
            setIsLoadingEntity(false);
        }
    }, [toast]);

    const handleViewTalent = useCallback(async (talentId: string) => {
        setIsLoadingEntity(true);
        try {
            const res = await authFetch(`/api/talents/${talentId}`);
            if (!res.ok) throw new Error('Falha ao carregar talento.');
            const talent = await res.json();
            setViewingTalent(talent);
            setIsTalentViewOpen(true);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Erro', description: e.message });
        } finally {
            setIsLoadingEntity(false);
        }
    }, [toast]);

    const handleViewQuote = useCallback(async (quoteId: string) => {
        setIsLoadingEntity(true);
        try {
            const res = await authFetch(`/api/quotes/${quoteId}`);
            if (!res.ok) throw new Error('Falha ao carregar cotação.');
            const quote = await res.json();
            setViewingQuote(quote);
            setIsQuoteViewOpen(true);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Erro', description: e.message });
        } finally {
            setIsLoadingEntity(false);
        }
    }, [toast]);

    const handleViewCustomer = useCallback(async (customerId: string) => {
        setIsLoadingEntity(true);
        try {
            const res = await authFetch(`/api/customers/${customerId}`);
            if (!res.ok) throw new Error('Falha ao carregar cliente/fornecedor.');
            const customer = await res.json();
            setViewingCustomer(customer);
            setIsCustomerViewOpen(true);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Erro', description: e.message });
        } finally {
            setIsLoadingEntity(false);
        }
    }, [toast]);

    const handleViewOwner = useCallback(async (ownerId: string) => {
        setIsLoadingEntity(true);
        try {
            const res = await authFetch(`/api/owners/${ownerId}`);
            if (!res.ok) throw new Error('Falha ao carregar proprietário.');
            const owner = await res.json();
            setViewingOwner(owner);
            setIsOwnerViewOpen(true);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Erro', description: e.message });
        } finally {
            setIsLoadingEntity(false);
        }
    }, [toast]);

    const { totalValue, totalPaid, totalPending, totalOverdue } = useMemo(() => {
        let totalVal = 0;
        let paidVal = 0;
        let overdueVal = 0;

        expenses.forEach(exp => {
            totalVal += exp.value;
            paidVal += exp.paidValue || 0;
            if(exp.status === 'pendente' && isPast(parseISO(exp.dueDate)) && !isSameDay(parseISO(exp.dueDate), new Date())) {
                overdueVal += exp.value - (exp.paidValue || 0);
            }
        });

        return {
            totalValue: totalVal,
            totalPaid: paidVal,
            totalPending: totalVal - paidVal,
            totalOverdue: overdueVal
        };

    }, [expenses]);


  return (
    <>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Valor Total</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{formatCurrency(totalValue)}</p></CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Pago</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p></CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Pendente</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-yellow-600">{formatCurrency(totalPending)}</p></CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Atrasado</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-red-600">{formatCurrency(totalOverdue)}</p></CardContent>
            </Card>
        </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className='flex-grow'>
            <CardTitle>Despesas do Mês</CardTitle>
            <CardDescription>Gerencie as despesas para o período selecionado.</CardDescription>
          </div>
          <div className="flex gap-2 items-center w-full sm:w-auto">
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar despesa..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-full"
                />
            </div>
            <Select value={groupBy} onValueChange={(val: any) => setGroupBy(val)}>
              <SelectTrigger className="w-[180px] flex-shrink-0">
                <SelectValue placeholder="Agrupar por..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem Agrupamento</SelectItem>
                <SelectItem value="category">Por Categoria</SelectItem>
              </SelectContent>
            </Select>
            {canAddExpense && <Button onClick={() => handleOpenFormDialog(null)} className="flex-shrink-0"><PlusCircle className="mr-2 h-4 w-4" /> Nova Despesa</Button>}
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Relacionado</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Pendente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const renderRow = (expense: Expense) => {
                      const pendingValue = expense.value - (expense.paidValue || 0);
                      return (
                        <TableRow key={expense.id}>
                          <TableCell className="font-medium">
                            {expense.description}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {expense.driverId && (
                                <button
                                  onClick={() => handleViewDriver(expense.driverId!)}
                                  disabled={isLoadingEntity}
                                  className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60 transition-colors cursor-pointer"
                                  title={`Motorista: ${expense.driverName || 'N/A'}`}
                                >
                                  <Truck className="h-4 w-4" />
                                </button>
                              )}
                              {expense.quoteId && (() => {
                                const parts = expense.description.split(' - ');
                                const quoteCode = parts.length > 1 ? parts[parts.length - 1].trim() : 'Cotação';
                                return (
                                <button
                                  onClick={() => handleViewQuote(expense.quoteId!)}
                                  disabled={isLoadingEntity}
                                  className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/60 transition-colors cursor-pointer"
                                  title={`Cotação: ${quoteCode}`}
                                >
                                  <FileText className="h-4 w-4" />
                                </button>
                                );
                              })()}
                              {expense.talentId && (
                                <button
                                  onClick={() => handleViewTalent(expense.talentId!)}
                                  disabled={isLoadingEntity}
                                  className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:hover:bg-purple-900/60 transition-colors cursor-pointer"
                                  title={`Talento: ${expense.talentName || 'N/A'}`}
                                >
                                  <User2 className="h-4 w-4" />
                                </button>
                              )}
                              {expense.customerId && (
                                <button
                                  onClick={() => handleViewCustomer(expense.customerId!)}
                                  disabled={isLoadingEntity}
                                  className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-900/60 transition-colors cursor-pointer"
                                  title={`Cliente/Fornecedor: ${expense.customerName || 'N/A'}`}
                                >
                                  <Building2 className="h-4 w-4" />
                                </button>
                              )}
                              {expense.ownerId && (
                                <button
                                  onClick={() => handleViewOwner(expense.ownerId!)}
                                  disabled={isLoadingEntity}
                                  className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer"
                                  title={`Proprietário: ${expense.ownerName || 'N/A'}`}
                                >
                                  <Briefcase className="h-4 w-4" />
                                </button>
                              )}
                              {!expense.driverId && !expense.quoteId && !expense.talentId && !expense.customerId && !expense.ownerId && (
                                <span className="text-xs text-muted-foreground pt-1">—</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{expense.categoryName}</TableCell>
                          <TableCell>{format(parseISO(expense.dueDate), 'dd/MM/yyyy')}</TableCell>
                          <TableCell>{formatCurrency(expense.value)}</TableCell>
                          <TableCell className={cn(pendingValue > 0 ? 'text-red-500' : 'text-green-600')}>{formatCurrency(pendingValue)}</TableCell>
                          <TableCell>
                            <Badge variant={expense.status === 'pago' ? 'default' : expense.status === 'atraso' ? 'destructive' : expense.status === 'parcial' ? 'secondary' : 'secondary'}
                                  className={cn(
                                      expense.status === 'pago' && 'bg-green-600',
                                      expense.status === 'parcial' && 'bg-orange-500',
                                      expense.status === 'pendente' && isPast(parseISO(expense.dueDate)) && !isSameDay(parseISO(expense.dueDate), new Date()) && 'bg-red-500 animate-pulse'
                                  )}>
                              {expense.status === 'pendente' && isPast(parseISO(expense.dueDate)) && !isSameDay(parseISO(expense.dueDate), new Date()) ? 'atrasado' : expense.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right space-x-1">
                              <AlertDialog>
                                  <DropdownMenu modal={false}>
                                      <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                          <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                          {expense.status !== 'pago' && canApprovePayment && <DropdownMenuItem onSelect={() => handleOpenPayDialog(expense)}><DollarSign className="mr-2 h-4 w-4"/>Pagar/Comprovativo</DropdownMenuItem>}
                                          {(expense.status === 'pago' || expense.status === 'parcial') && (
                                              <>
                                                  {expense.proofs && expense.proofs.length > 0 && <DropdownMenuItem onSelect={() => handleOpenProofsDialog(expense)}><FileArchive className="mr-2 h-4 w-4"/>Ver Comprovativos</DropdownMenuItem>}
                                                  {canApprovePayment && <DropdownMenuItem onSelect={() => handleRevertPayment(expense)}><RotateCcw className="mr-2 h-4 w-4"/>Reverter Pagamento</DropdownMenuItem>}
                                              </>
                                          )}
                                          <DropdownMenuItem onSelect={() => handleOpenShareDialog(expense)}><Share2 className="mr-2 h-4 w-4" />Compartilhar no Chat</DropdownMenuItem>
                                          
                                          <DropdownMenuSub>
                                            <DropdownMenuSubTrigger><Move className="mr-2 h-4 w-4" /> Relacionar a</DropdownMenuSubTrigger>
                                            <DropdownMenuPortal>
                                              <DropdownMenuSubContent>
                                                {!expense.driverId ? (
                                                    <DropdownMenuItem onSelect={() => handleOpenLinkDialog(expense, 'driver')}><Truck className="mr-2 h-4 w-4" /> Motorista</DropdownMenuItem>
                                                ) : (
                                                    <DropdownMenuItem onSelect={() => handleUnlink(expense, 'driver')}><Truck className="mr-2 h-4 w-4 text-destructive" /> Desvincular Motorista</DropdownMenuItem>
                                                )}
                                                
                                                {!expense.quoteId ? (
                                                    <DropdownMenuItem onSelect={() => handleOpenLinkDialog(expense, 'quote')}><FileText className="mr-2 h-4 w-4" /> Cotação</DropdownMenuItem>
                                                ) : (
                                                    <DropdownMenuItem onSelect={() => handleUnlink(expense, 'quote')}><FileText className="mr-2 h-4 w-4 text-destructive" /> Desvincular Cotação</DropdownMenuItem>
                                                )}
                                                
                                                {!expense.talentId ? (
                                                    <DropdownMenuItem onSelect={() => handleOpenLinkDialog(expense, 'talent')}><User2 className="mr-2 h-4 w-4" /> Talento</DropdownMenuItem>
                                                ) : (
                                                    <DropdownMenuItem onSelect={() => handleUnlink(expense, 'talent')}><User2 className="mr-2 h-4 w-4 text-destructive" /> Desvincular Talento</DropdownMenuItem>
                                                )}

                                                {!expense.customerId ? (
                                                    <DropdownMenuItem onSelect={() => handleOpenLinkDialog(expense, 'customer')}><Building2 className="mr-2 h-4 w-4" /> Cliente/Forn.</DropdownMenuItem>
                                                ) : (
                                                    <DropdownMenuItem onSelect={() => handleUnlink(expense, 'customer')}><Building2 className="mr-2 h-4 w-4 text-destructive" /> Desvincular Cliente/Forn.</DropdownMenuItem>
                                                )}

                                                {!expense.ownerId ? (
                                                    <DropdownMenuItem onSelect={() => handleOpenLinkDialog(expense, 'owner')}><Briefcase className="mr-2 h-4 w-4" /> Proprietário</DropdownMenuItem>
                                                ) : (
                                                    <DropdownMenuItem onSelect={() => handleUnlink(expense, 'owner')}><Briefcase className="mr-2 h-4 w-4 text-destructive" /> Desvincular Proprietário</DropdownMenuItem>
                                                )}
                                              </DropdownMenuSubContent>
                                            </DropdownMenuPortal>
                                          </DropdownMenuSub>

                                          {canAddExpense && <DropdownMenuItem onSelect={() => handleOpenFormDialog(expense)} disabled={expense.status === 'pago'}><Edit className="mr-2 h-4 w-4"/>Editar</DropdownMenuItem>}
                                          <DropdownMenuItem onSelect={() => handleOpenHistoryDialog(expense)}><History className="mr-2 h-4 w-4"/>Ver Histórico</DropdownMenuItem>
                                          {canDeleteExpense && (
                                              <>
                                                  <DropdownMenuSeparator />
                                                  <AlertDialogTrigger asChild>
                                                      <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={(e) => { e.preventDefault(); setExpenseToDelete(expense); }}>
                                                          <Trash2 className="mr-2 h-4 w-4"/>Apagar
                                                      </DropdownMenuItem>
                                                  </AlertDialogTrigger>
                                              </>
                                          )}
                                      </DropdownMenuContent>
                                  </DropdownMenu>
                                  <AlertDialogContent>
                                      <AlertDialogHeader>
                                          <AlertDialogTitle>Apagar Despesa?</AlertDialogTitle>
                                          <AlertDialogDesc>Tem a certeza de que quer apagar "{expense.description}"?</AlertDialogDesc>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                          {(expense.isRecurring || expense.isInstallment) ? (
                                              <>
                                                  <AlertDialogAction onClick={() => handleDeleteExpense(expense!.id, true)} className="bg-destructive hover:bg-destructive/90" disabled={isSubmitting}>Apagar Esta e Futuras</AlertDialogAction>
                                                  <AlertDialogAction onClick={() => handleDeleteExpense(expense!.id, false)} disabled={isSubmitting}>Apagar Somente Esta</AlertDialogAction>
                                              </>
                                          ) : (
                                              <AlertDialogAction onClick={() => handleDeleteExpense(expense!.id, false)} className="bg-destructive hover:bg-destructive/90" disabled={isSubmitting}>Apagar</AlertDialogAction>
                                          )}
                                      </AlertDialogFooter>
                                  </AlertDialogContent>
                              </AlertDialog>
                          </TableCell>
                        </TableRow>
                      );
                  };

                  if (filteredExpenses.length === 0) {
                      return (
                          <TableRow>
                              <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">Nenhuma despesa encontrada.</TableCell>
                          </TableRow>
                      );
                  }

                  if (groupBy === 'none') {
                      return filteredExpenses.map(renderRow);
                  }

                  if (groupBy === 'category') {
                      const grouped: Record<string, Expense[]> = {};
                      filteredExpenses.forEach(exp => {
                          const cat = exp.categoryName || 'Sem Categoria';
                          if (!grouped[cat]) grouped[cat] = [];
                          grouped[cat].push(exp);
                      });

                      return Object.entries(grouped).map(([category, exps]) => (
                          <React.Fragment key={category}>
                              <TableRow className="bg-muted/50 hover:bg-muted/50">
                                  <TableCell colSpan={8} className="font-semibold text-primary py-2 uppercase text-xs tracking-wider">
                                      {category} <span className="text-muted-foreground ml-2">({exps.length} {exps.length === 1 ? 'item' : 'itens'})</span>
                                  </TableCell>
                              </TableRow>
                              {exps.map(renderRow)}
                          </React.Fragment>
                      ));
                  }
                })()}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingExpense ? 'Editar Despesa' : 'Adicionar Nova Despesa'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-1 pr-4">
              <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Descrição</FormLabel><FormControl><Input placeholder="Ex: Conta de Luz" {...field} /></FormControl><FormMessage /></FormItem> )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="value" render={() => ( 
                    <FormItem>
                        <FormLabel>Valor (R$)</FormLabel>
                        <FormControl>
                            <Input 
                                placeholder="R$ 0,00"
                                value={maskedValue}
                                onChange={(e) => handleCurrencyChange(e, 'value')}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem> 
                )} />
                <FormField control={form.control} name="dueDate" render={({ field }) => ( <FormItem><FormLabel>Data de Vencimento</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem> )} />
              </div>
              <FormField control={form.control} name="categoryId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione uma categoria..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      {expenseCategories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="notes" render={({ field }) => ( <FormItem><FormLabel>Notas (Opcional)</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem> )} />
              
              {!isEditing && (
                <div className="space-y-4 pt-4 border-t">
                    <FormField control={form.control} name="isRecurring" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><Label className="font-normal cursor-pointer">Lançar esta despesa para os próximos 12 meses</Label></FormItem>)} />
                    <FormField control={form.control} name="isInstallment" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><Label className="font-normal cursor-pointer">É uma despesa parcelada?</Label></FormItem>)} />
                    {form.watch('isInstallment') && (
                        <FormField control={form.control} name="installmentCount" render={({ field }) => ( 
                          <FormItem>
                            <FormLabel>Número de Parcelas</FormLabel>
                            <FormControl><Input type="number" min="2" {...field} /></FormControl>
                            {installmentPreview && (
                              <FormDescription>
                                Pré-visualização: {installmentPreview}
                              </FormDescription>
                            )}
                            <FormMessage />
                          </FormItem> 
                        )} />
                    )}
                </div>
              )}
               {isEditing && editingExpense?.isRecurring && (
                  <FormField control={form.control} name="isRecurring" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><Label className="font-normal cursor-pointer">Aplicar alterações às futuras despesas recorrentes?</Label></FormItem>)} />
               )}


              <DialogFooter className="pt-4"><DialogClose asChild><Button type="button" variant="secondary" disabled={isSubmitting}>Cancelar</Button></DialogClose><Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingExpense ? 'Salvar' : 'Adicionar'}
              </Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Confirmar Pagamento de Despesa</DialogTitle>
                    <DialogDescription>{editingExpense?.description}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="paidValue">Valor Pago (R$)</Label>
                        <Input 
                            id="paidValue" 
                            value={maskedPaidValue}
                            onChange={(e) => handleCurrencyChange(e, 'paidValue')}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="proof">Comprovativo de Pagamento</Label>
                        <Input id="proof" type="file" ref={proofInputRef} onChange={handleFileChange} accept="image/*,.pdf" />
                    </div>
                    {proofPreview && (
                        <div className="space-y-2">
                          <Label>Pré-visualização</Label>
                           <ScrollArea className="h-72 w-full rounded-md border">
                            <div className="p-4">
                              {proofFile?.type.startsWith('image/') ? (
                                  <Image src={proofPreview} alt="Pré-visualização do comprovativo" width={400} height={800} className="w-full h-auto object-contain rounded-md" />
                              ) : (
                                  <div className="flex items-center gap-2 text-muted-foreground"><FileIcon className="h-5 w-5"/><span>{proofFile?.name}</span></div>
                              )}
                            </div>
                           </ScrollArea>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="secondary" disabled={isSubmitting}>Cancelar</Button></DialogClose>
                    <Button onClick={handleConfirmPayment} disabled={isSubmitting || !proofFile}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4" />}
                        Confirmar Pagamento
                    </Button>
                </DialogFooter>
            </DialogContent>
      </Dialog>
      
      <Dialog open={isProofsOpen} onOpenChange={setIsProofsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Comprovativos de Pagamento</DialogTitle>
              <DialogDescription>
                Todos os comprovativos para a despesa "{editingExpense?.description}".
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-80 my-4">
              <div className="space-y-3 pr-4">
                {editingExpense?.proofs && editingExpense.proofs.length > 0 ? (
                  editingExpense.proofs.map((proof, index) => (
                    <a key={index} href={`${proof.url}?t=${new Date().getTime()}`} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" className="w-full justify-start">
                        <FileIcon className="mr-2 h-4 w-4"/>
                        Comprovativo #{index + 1} - {format(new Date(proof.timestamp), 'dd/MM/yy HH:mm')}
                      </Button>
                    </a>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-4">Nenhum comprovativo encontrado.</p>
                )}
              </div>
            </ScrollArea>
             <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Fechar</Button></DialogClose>
              </DialogFooter>
          </DialogContent>
      </Dialog>


      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
          <DialogContent className="max-w-xl">
              <DialogHeader>
                  <DialogTitle>Histórico da Despesa</DialogTitle>
                  <DialogDescription>{editingExpense?.description}</DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh] my-4">
                  <div className="pr-6 space-y-6">
                      {editingExpense?.history && editingExpense.history.length > 0 ? (
                           [...editingExpense.history].map((event: ExpenseHistoryEvent, index, arr) => (
                              <div key={index} className="flex gap-4 relative">
                                  <div className="flex flex-col items-center">
                                      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-primary-foreground", event.action === 'Criação' ? 'bg-blue-500' : 'bg-gray-500')}>
                                          {event.action === 'Criação' ? <PlusCircle className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                                      </div>
                                      {index < arr.length - 1 && (
                                        <div className="w-px h-full bg-border flex-grow" />
                                      )}
                                  </div>
                                  <div className="flex-grow pb-4">
                                      <p className="font-semibold">{event.action}</p>
                                      <p className="text-sm text-muted-foreground">{new Date(event.timestamp).toLocaleString('pt-BR')}</p>
                                      <p className="text-sm mt-1">{event.details}</p>
                                      <p className="text-xs text-muted-foreground mt-2">Por: {event.user}</p>
                                  </div>
                              </div>
                           ))
                      ) : (
                          <p className="text-center text-muted-foreground py-8">Nenhum histórico para esta despesa.</p>
                      )}
                  </div>
              </ScrollArea>
              <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Fechar</Button></DialogClose>
              </DialogFooter>
          </DialogContent>
      </Dialog>
      <ShareItemDialog item={itemToShare} open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen} />

      {/* Read-Only Driver View Dialog */}
      <Dialog open={isDriverViewOpen} onOpenChange={setIsDriverViewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Motorista</DialogTitle>
            <DialogDescription>Visualização dos dados do motorista vinculado à despesa.</DialogDescription>
          </DialogHeader>
          {viewingDriver && (
            <ScrollArea className="max-h-[70vh] p-1">
              <div className="space-y-6 pr-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={viewingDriver.avatarUrl ? `${viewingDriver.avatarUrl}?t=${Date.now()}` : undefined} />
                    <AvatarFallback>{getInitials(viewingDriver.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-semibold">{viewingDriver.name}</h3>
                    <p className="text-sm text-muted-foreground">CPF: {viewingDriver.cpf}</p>
                  </div>
                </div>
                <Separator />
                <h4 className="text-sm font-semibold text-muted-foreground">Informações de Contato</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium text-muted-foreground">Telefone 1</p>
                    <p className="p-2 bg-secondary/50 rounded-md">{viewingDriver.phone1}</p>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">Telefone 2</p>
                    <p className="p-2 bg-secondary/50 rounded-md">{viewingDriver.phone2 || '—'}</p>
                  </div>
                </div>
                <div className="text-sm">
                  <p className="font-medium text-muted-foreground">Chave PIX</p>
                  <p className="p-2 bg-secondary/50 rounded-md">{viewingDriver.pixKey || '—'}</p>
                </div>
                {viewingDriver.mainVehicleId && (
                  <>
                    <Separator />
                    <h4 className="text-sm font-semibold text-muted-foreground">Veículo Principal</h4>
                    <p className="text-sm p-2 bg-secondary/50 rounded-md flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /> {viewingDriver.licensePlate || 'Vinculado'}</p>
                  </>
                )}
                {(viewingDriver.cnhDocumentUrl || viewingDriver.addressProofUrl) && (
                  <>
                    <Separator />
                    <h4 className="text-sm font-semibold text-muted-foreground">Documentos</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {viewingDriver.cnhDocumentUrl && (
                        <a href={`${viewingDriver.cnhDocumentUrl}?t=${Date.now()}`} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" className="w-full justify-start" type="button">
                            <FileIcon className="mr-2 h-4 w-4" /> Ver CNH
                          </Button>
                        </a>
                      )}
                      {viewingDriver.addressProofUrl && (
                        <a href={`${viewingDriver.addressProofUrl}?t=${Date.now()}`} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" className="w-full justify-start" type="button">
                            <FileIcon className="mr-2 h-4 w-4" /> Ver Comprovante
                          </Button>
                        </a>
                      )}
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Fechar</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Read-Only Quote Details Dialog */}
      <Dialog open={isQuoteViewOpen} onOpenChange={setIsQuoteViewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Cotação: {viewingQuote ? getQuoteCode(viewingQuote) : ''}</DialogTitle>
            <DialogDescription>Visualização completa dos dados da cotação.</DialogDescription>
          </DialogHeader>
          {viewingQuote && (
            <ScrollArea className="max-h-[70vh] p-1">
              <div className="space-y-4 pr-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><p className="font-semibold text-muted-foreground">Remetente</p><p>{viewingQuote.remetente}</p></div>
                  <div><p className="font-semibold text-muted-foreground">Solicitante</p><p>{viewingQuote.responsavelSolicitante}</p></div>
                  <div><p className="font-semibold text-muted-foreground">Contato</p><p>{viewingQuote.contato}</p></div>
                  <div><p className="font-semibold text-muted-foreground">Email</p><p>{viewingQuote.email}</p></div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div><p className="font-semibold text-muted-foreground">Origem</p><p>{viewingQuote.cidadeOrigem}</p></div>
                  <div><p className="font-semibold text-muted-foreground">Destino</p><p>{viewingQuote.cidadeDestino}</p></div>
                  <div><p className="font-semibold text-muted-foreground">Distância</p><p>{viewingQuote.kmIda > 0 ? `${viewingQuote.kmIda.toFixed(2)} km` : 'N/A'}</p></div>
                  <div><p className="font-semibold text-muted-foreground">Veículo</p><p>{viewingQuote.veiculo}</p></div>
                  <div><p className="font-semibold text-muted-foreground">Prazo</p><p>{viewingQuote.prazoEntrega} dias</p></div>
                  <div><p className="font-semibold text-muted-foreground">Nº da NF</p><p>{viewingQuote.nfNumber || 'N/A'}</p></div>
                  <div><p className="font-semibold text-muted-foreground">Volumes</p><p>{viewingQuote.quantidade || 'N/A'}</p></div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm"><Move className="h-4 w-4 text-muted-foreground" /> <span className="font-semibold">Endereço de Coleta:</span> <p>{viewingQuote.enderecoColeta || 'Não informado'}</p></div>
                  <div className="flex items-center gap-2 text-sm"><Move className="h-4 w-4 text-muted-foreground" /> <span className="font-semibold">Endereço de Entrega:</span> <p>{viewingQuote.enderecoEntrega || 'Não informado'}</p></div>
                </div>
                <Separator />
                <div className="text-center">
                  <p className="text-muted-foreground">Total Final (Frete + Taxas + ICMS)</p>
                  <p className="text-4xl font-bold text-primary">
                    {((viewingQuote.valorFinal || viewingQuote.totalFrete) + (viewingQuote.icmsValor || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                  <div className="text-xs text-muted-foreground mt-2">
                    <span>Frete Bruto: {viewingQuote.totalFrete.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    <span className="mx-2">|</span>
                    <span>ICMS ({viewingQuote.icmsAliquota || 0}%): {(viewingQuote.icmsValor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    {(viewingQuote.desconto || 0) > 0 && (
                      <>
                        <span className="mx-2">|</span>
                        <span className="text-red-500">Desconto: -{(viewingQuote.desconto || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                      </>
                    )}
                  </div>
                </div>
                <Separator />
                <div className="space-y-2 text-sm">
                  <h4 className="font-semibold">Observações</h4>
                  <p className="text-muted-foreground p-2 border rounded-md bg-secondary/50">{viewingQuote.obs || 'Nenhuma observação.'}</p>
                </div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Fechar</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Read-Only Talent View Dialog */}
      <Dialog open={isTalentViewOpen} onOpenChange={setIsTalentViewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Talento</DialogTitle>
            <DialogDescription>Visualização dos dados do talento vinculado à despesa.</DialogDescription>
          </DialogHeader>
          {viewingTalent && (
            <ScrollArea className="max-h-[70vh] p-1">
              <div className="space-y-6 pr-4">
                <Card>
                  <CardHeader><CardTitle>Informações Pessoais</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <p className="font-medium text-muted-foreground">Nome Completo</p>
                      <p className="p-2 bg-secondary/50 rounded-md">{viewingTalent.fullName}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="font-medium text-muted-foreground">RG</p>
                        <p className="p-2 bg-secondary/50 rounded-md">{viewingTalent.rg}</p>
                      </div>
                      <div>
                        <p className="font-medium text-muted-foreground">CPF</p>
                        <p className="p-2 bg-secondary/50 rounded-md">{viewingTalent.cpf}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="font-medium text-muted-foreground">Telefone 1</p>
                        <p className="p-2 bg-secondary/50 rounded-md">{viewingTalent.phone1}</p>
                      </div>
                      <div>
                        <p className="font-medium text-muted-foreground">Telefone 2</p>
                        <p className="p-2 bg-secondary/50 rounded-md">{viewingTalent.phone2 || '—'}</p>
                      </div>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">Endereço</p>
                      <p className="p-2 bg-secondary/50 rounded-md">{viewingTalent.address}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Informações Contratuais e de Pagamento</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="font-medium text-muted-foreground">Tipo de Contratação</p>
                        <p className="p-2 bg-secondary/50 rounded-md">{viewingTalent.hiringTypeId}</p>
                      </div>
                      <div>
                        <p className="font-medium text-muted-foreground">Data de Contratação</p>
                        <p className="p-2 bg-secondary/50 rounded-md">{format(parseISO(viewingTalent.hireDate), 'dd/MM/yyyy')}</p>
                      </div>
                      <div>
                        <p className="font-medium text-muted-foreground">Data de Desligamento</p>
                        <p className="p-2 bg-secondary/50 rounded-md">{viewingTalent.terminationDate ? format(parseISO(viewingTalent.terminationDate), 'dd/MM/yyyy') : '—'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="font-medium text-muted-foreground">Tipo de Chave PIX</p>
                        <p className="p-2 bg-secondary/50 rounded-md">{viewingTalent.pixKeyType}</p>
                      </div>
                      <div>
                        <p className="font-medium text-muted-foreground">Chave PIX</p>
                        <p className="p-2 bg-secondary/50 rounded-md">{viewingTalent.pixKey}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="font-medium text-muted-foreground">Salário Base (R$)</p>
                        <p className="p-2 bg-secondary/50 rounded-md">{viewingTalent.baseSalary.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                      </div>
                      <div>
                        <p className="font-medium text-muted-foreground">Cargo</p>
                        <p className="p-2 bg-secondary/50 rounded-md">{viewingTalent.jobTitle}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Status e Observações</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <p className="font-medium text-muted-foreground">Status</p>
                      <div className="mt-1">
                        <Badge variant={viewingTalent.status === 'Ativo' ? 'default' : 'secondary'} className={viewingTalent.status === 'Ativo' ? 'bg-green-600' : ''}>
                          {viewingTalent.status}
                        </Badge>
                      </div>
                    </div>
                    {viewingTalent.observations && (
                      <div>
                        <p className="font-medium text-muted-foreground">Observações</p>
                        <p className="p-2 bg-secondary/50 rounded-md">{viewingTalent.observations}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Fechar</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Relacionar {
                linkType === 'driver' ? 'Motorista' : 
                linkType === 'quote' ? 'Cotação' : 
                linkType === 'talent' ? 'Talento' : 
                linkType === 'customer' ? 'Cliente/Forn.' : 
                linkType === 'owner' ? 'Proprietário' : ''
              }
            </DialogTitle>
            <DialogDescription>
              Busque e selecione o {
                linkType === 'driver' ? 'motorista' : 
                linkType === 'quote' ? 'cotação' : 
                linkType === 'talent' ? 'talento' : 
                linkType === 'customer' ? 'cliente/fornecedor' : 
                linkType === 'owner' ? 'proprietário' : ''
              } para vincular a esta despesa.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex gap-2">
                <Input 
                    placeholder="Digite para buscar..." 
                    value={linkSearchTerm} 
                    onChange={(e) => setLinkSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSearchLinkItems();
                    }}
                />
                <Button onClick={handleSearchLinkItems} disabled={isLoadingLinkItems} variant="secondary">
                   <Search className="h-4 w-4" />
                </Button>
            </div>

            {isLoadingLinkItems ? (
              <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : linkItems.length > 0 ? (
               <Select value={selectedLinkId} onValueChange={setSelectedLinkId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um resultado..." />
                </SelectTrigger>
                <SelectContent>
                  {linkItems.map((item) => (
                    <SelectItem key={item.id || item._id} value={item.id || item._id}>
                      {
                        linkType === 'driver' ? item.name : 
                        linkType === 'quote' ? getQuoteCode(item) : 
                        linkType === 'talent' ? item.fullName :
                        linkType === 'customer' ? (item.razaoSocial || item.nome) :
                        linkType === 'owner' ? item.name : ''
                      }
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : linkSearchTerm ? (
                <div className="text-center text-sm text-muted-foreground py-4">Nenhum resultado encontrado.</div>
            ) : null}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={isLinking}>Cancelar</Button></DialogClose>
            <Button onClick={handleConfirmLink} disabled={isLinking || !selectedLinkId || isLoadingLinkItems}>
              {isLinking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Customer/Supplier Details Dialog */}
      <Dialog open={isCustomerViewOpen} onOpenChange={setIsCustomerViewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes do Cliente/Fornecedor</DialogTitle>
          </DialogHeader>
          {viewingCustomer && (
            <ScrollArea className="max-h-[70vh] p-4 text-sm">
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold">{viewingCustomer.razaoSocial || viewingCustomer.nome || 'Empresa'}</h3>
                  <p className="text-sm text-muted-foreground">CNPJ: {viewingCustomer.cnpj || '—'}</p>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="font-medium text-muted-foreground">Nome Fantasia</p>
                    <p className="p-2 bg-secondary/50 rounded-md">{viewingCustomer.nomeFantasia || '—'}</p>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">Telefone</p>
                    <p className="p-2 bg-secondary/50 rounded-md">{viewingCustomer.telefone || '—'}</p>
                  </div>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">E-mail</p>
                  <p className="p-2 bg-secondary/50 rounded-md">{viewingCustomer.email || '—'}</p>
                </div>
                <Separator />
                <div>
                  <p className="font-medium text-muted-foreground">Endereço</p>
                  <p className="p-2 bg-secondary/50 rounded-md">{viewingCustomer.endereco || '—'}</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    <div>
                        <p className="font-medium text-muted-foreground">Cidade</p>
                        <p className="p-2 bg-secondary/50 rounded-md max-w-[120px] truncate">{viewingCustomer.cidade || '—'}</p>
                    </div>
                    <div>
                        <p className="font-medium text-muted-foreground">UF</p>
                        <p className="p-2 bg-secondary/50 rounded-md">{viewingCustomer.estado || '—'}</p>
                    </div>
                     <div>
                        <p className="font-medium text-muted-foreground">CEP</p>
                        <p className="p-2 bg-secondary/50 rounded-md truncate">{viewingCustomer.cep || '—'}</p>
                    </div>
                </div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Fechar</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Owner Details Dialog */}
      <Dialog open={isOwnerViewOpen} onOpenChange={setIsOwnerViewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes do Proprietário</DialogTitle>
          </DialogHeader>
          {viewingOwner && (
            <ScrollArea className="max-h-[70vh] p-4 text-sm">
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold">{viewingOwner.name}</h3>
                  <p className="text-sm text-muted-foreground">Documento: {viewingOwner.document}</p>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="font-medium text-muted-foreground">Telefone</p>
                    <p className="p-2 bg-secondary/50 rounded-md">{viewingOwner.phone || '—'}</p>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">E-mail</p>
                    <p className="p-2 bg-secondary/50 rounded-md">{viewingOwner.email || '—'}</p>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="font-medium text-muted-foreground">Endereço</p>
                  <p className="p-2 bg-secondary/50 rounded-md">{viewingOwner.address || '—'}</p>
                </div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Fechar</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}
