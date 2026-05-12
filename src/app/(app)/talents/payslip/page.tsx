
"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, ReceiptText, Printer, Trash2, PlusCircle, X, ChevronsUpDown, Wallet, RefreshCw, Calculator, Calendar as CalendarIcon, Info, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format, subMonths, parse, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Payslip } from '@/components/Payslip';
import { printPayslip } from '@/lib/print';
import type { Payslip as PayslipType, PayslipItem, Talent, EarningDeductionType, Expense, PricingSettings, Quote } from '@/lib/types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDialogDesc, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { v4 as uuidv4 } from 'uuid';
import { authFetch } from '@/lib/api-client';

const formatCurrency = (value: number) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface BonusDialogData {
    totalBonus: number;
    eligibleQuotes: Quote[];
    paidQuotes: Quote[];
}

export default function PayslipPage() {
  const { user, loading: authLoading, companyProfile, pricingSettings } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [talents, setTalents] = useState<Talent[]>([]);
  const [payslips, setPayslips] = useState<PayslipType[]>([]);
  const [earningDeductionTypes, setEarningDeductionTypes] = useState<EarningDeductionType[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedTalentId, setSelectedTalentId] = useState<string>('');
  const [payslipType, setPayslipType] = useState<'Pagamento Final' | 'Adiantamento'>('Pagamento Final');
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  
  const [items, setItems] = useState<PayslipItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const [isPostSaveExpenseDialogOpen, setIsPostSaveExpenseDialogOpen] = useState(false);
  const [newlyCreatedPayslip, setNewlyCreatedPayslip] = useState<PayslipType | null>(null);
  const [isRecurringExpense, setIsRecurringExpense] = useState(false);
  
  const [isCalculatingBonus, setIsCalculatingBonus] = useState(false);
  
  const [bonusStartDate, setBonusStartDate] = useState('');
  const [bonusEndDate, setBonusEndDate] = useState('');

  const [isBonusDialogOpen, setIsBonusDialogOpen] = useState(false);
  const [bonusDialogData, setBonusDialogData] = useState<BonusDialogData | null>(null);

  const [payslipSearchTerm, setPayslipSearchTerm] = useState('');
  
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [talentsRes, payslipsRes, earningsRes, expensesRes] = await Promise.all([
        authFetch('/api/talents'),
        authFetch('/api/payslips'),
        authFetch('/api/earnings-deductions'),
        authFetch('/api/expenses'),
      ]);
      if (!talentsRes.ok || !payslipsRes.ok || !earningsRes.ok || !expensesRes.ok) {
        throw new Error("Falha ao carregar dados para a folha de pagamento.");
      }
      setTalents(await talentsRes.json());
      setPayslips(await payslipsRes.json());
      setEarningDeductionTypes(await earningsRes.json());
      setExpenses(await expensesRes.json());
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro de Carregamento', description: error.message });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !user.talentsAccess) {
      router.push('/dashboard');
    } else {
        fetchData();
    }
  }, [user, authLoading, router, fetchData]);
  
    const addExpense = async (data: Partial<Expense>): Promise<boolean> => {
        try {
            const response = await authFetch('/api/expenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...data, userId: user!.id, user: { username: user!.username } }),
            });
            if (!response.ok) throw new Error(await response.text());
            return true;
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Erro na Operação", description: e.message });
            return false;
        }
    }


  const selectedTalent = useMemo(() => talents.find(t => t.id === selectedTalentId), [talents, selectedTalentId]);

  const allItemTypes = useMemo(() => {
    const otherItems = earningDeductionTypes.filter(t => !['01', '02', '03'].includes(t.code));
    return [
        { id: 'system-base-salary', code: '01', name: 'Salário Base', type: 'Provento' },
        { id: 'system-bonus', code: '02', name: 'Bônus', type: 'Provento' },
        { id: 'system-advance', code: '03', name: 'Adiantamento', type: 'Provento' },
        ...otherItems,
    ] as EarningDeductionType[];
  }, [earningDeductionTypes]);

  const resetGenerator = useCallback(() => {
    if (!selectedTalent) {
        setItems([]);
        return;
    }

    if (payslipType === 'Pagamento Final') {
        setItems([{
            id: 'system-base-salary', // Consistent ID for base salary
            code: '01',
            description: 'Salário Base',
            reference: 30,
            factor: 'Dias',
            earnings: selectedTalent.baseSalary,
            deductions: 0
        }]);
    } else if (payslipType === 'Adiantamento') {
        const advancePercentage = 40;
        const advanceValue = (selectedTalent.baseSalary * advancePercentage) / 100;
        setItems([{
            id: uuidv4(), // Removable ID
            code: '03',
            description: 'Adiantamento',
            reference: advancePercentage,
            factor: '%',
            earnings: advanceValue,
            deductions: 0
        }]);
    } else {
        setItems([]);
    }
  }, [selectedTalent, payslipType]);

  useEffect(() => {
    if (selectedTalentId) {
        resetGenerator();
    }
  }, [selectedTalentId, payslipType, resetGenerator]);


  const handleAddItem = (itemType: EarningDeductionType) => {
    const newItem: PayslipItem = {
        id: uuidv4(),
        code: itemType.code,
        description: itemType.name,
        reference: 0,
        factor: '%',
        earnings: itemType.type === 'Provento' ? 0 : 0,
        deductions: itemType.type === 'Desconto' ? 0 : 0,
    };
    setItems(prev => [...prev, newItem]);
  };
  
  const handleItemChange = (itemId: string, field: 'reference' | 'factor', value: string | number) => {
    setItems(prevItems => prevItems.map(item => {
        if (item.id === itemId) {
            const updatedItem = { ...item, [field]: value };
            
            if (field === 'reference' || field === 'factor') {
                const baseValue = selectedTalent?.baseSalary || 0;
                let calculatedValue = 0;
                const ref = typeof value === 'string' && field === 'reference' ? parseFloat(value) : (field === 'reference' ? value as number : updatedItem.reference);

                switch (updatedItem.factor) {
                    case '%': calculatedValue = (baseValue * ref) / 100; break;
                    case 'Dias': calculatedValue = (baseValue / 30) * ref; break;
                    case 'Horas': calculatedValue = (baseValue / 220) * ref; break;
                    case 'Valor Fixo': calculatedValue = ref; break;
                }
                
                const itemTypeInfo = allItemTypes.find(t => t.code === item.code);
                if (itemTypeInfo?.type === 'Provento') {
                    updatedItem.earnings = calculatedValue;
                    updatedItem.deductions = 0;
                } else if (itemTypeInfo?.type === 'Desconto') {
                    updatedItem.deductions = calculatedValue;
                    updatedItem.earnings = 0;
                }
            }
            return updatedItem;
        }
        return item;
    }));
  };

  const handleRemoveItem = (itemId: string) => {
    if (itemId === 'system-base-salary') return;
    setItems(prev => prev.filter(item => item.id !== itemId));
  };
  
  const handleCalculateBonus = async () => {
    if (!selectedTalent) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Nenhum talento selecionado.' });
        return;
    }
    if (!bonusStartDate || !bonusEndDate) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Por favor, defina o período de início e fim para a apuração.' });
        return;
    }
    
    setIsCalculatingBonus(true);
    setBonusDialogData(null); // Limpa dados anteriores

    try {
        const response = await authFetch('/api/talents/bonus', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ talentId: selectedTalent.id, startDateStr: bonusStartDate, endDateStr: bonusEndDate }),
        });
        const data = await response.json();
        if(response.ok) {
            setBonusDialogData({
                totalBonus: data.totalBonus || 0,
                eligibleQuotes: data.eligibleQuotes || [],
                paidQuotes: data.paidQuotes || []
            });
            if (!data.totalBonus && data.message) {
                 toast({ title: 'Aviso', description: data.message });
            }
        } else {
            throw new Error(data.message || 'Falha ao calcular bônus.');
        }
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Erro no Cálculo', description: e.message });
    } finally {
        setIsCalculatingBonus(false);
    }
  };


  const handleApplyBonus = (bonusAmount: number) => {
    setItems(prev => prev.map(item => item.code === '02' ? { ...item, earnings: bonusAmount } : item));
    setIsBonusDialogOpen(false);
    toast({ title: 'Bônus Aplicado!', description: `Total de ${formatCurrency(bonusAmount)} adicionado aos proventos.` });
  };
  
  const handleRevertBonusPayment = async (quoteId: string) => {
    if (!user || user.role !== 'admin') {
        toast({ variant: 'destructive', title: 'Não Autorizado', description: 'Apenas administradores podem reverter pagamentos de bônus.' });
        return;
    }

    try {
        const response = await authFetch(`/api/payslips/revert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quoteId, userId: user.id }),
        });
        const data = await response.json();
        if (response.ok) {
            toast({ title: 'Sucesso!', description: data.message });
            await fetchData();
            if (bonusDialogData) {
                const revertedQuote = bonusDialogData.paidQuotes.find(q => q.id === quoteId);
                if (revertedQuote) {
                    setBonusDialogData({
                        ...bonusDialogData,
                        paidQuotes: bonusDialogData.paidQuotes.filter(q => q.id !== quoteId),
                        eligibleQuotes: [...bonusDialogData.eligibleQuotes, revertedQuote],
                        totalBonus: bonusDialogData.totalBonus + (((revertedQuote.grossProfit || 0) - (revertedQuote.totalExpense || 0)) * (selectedTalent?.salesBonusPercentage || 0))
                    });
                }
            }
        } else {
            throw new Error(data.message || 'Falha ao reverter bônus.');
        }
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Erro na Reversão', description: e.message });
    }
};

 const handleRemoveQuoteFromBonus = (quoteId: string) => {
    if (!bonusDialogData || !selectedTalent) return;

    const quoteToRemove = bonusDialogData.eligibleQuotes.find(q => q.id === quoteId);
    if (!quoteToRemove) return;

    const bonusPercentage = (selectedTalent.salesBonusPercentage || 0) / 100;
    const netProfit = (quoteToRemove.grossProfit || 0) - (quoteToRemove.totalExpense || 0);
    const quoteBonus = netProfit > 0 ? netProfit * bonusPercentage : 0;

    const newEligibleQuotes = bonusDialogData.eligibleQuotes.filter(q => q.id !== quoteId);
    const newTotalBonus = bonusDialogData.totalBonus - quoteBonus;

    setBonusDialogData({
        ...bonusDialogData,
        eligibleQuotes: newEligibleQuotes,
        totalBonus: newTotalBonus,
    });
};


  const { totalEarnings, totalDeductions, netSalary } = useMemo(() => {
    const totals = items.reduce((acc, item) => {
      acc.earnings += item.earnings || 0;
      acc.deductions += item.deductions || 0;
      return acc;
    }, { earnings: 0, deductions: 0 });
    return {
      totalEarnings: totals.earnings,
      totalDeductions: totals.deductions,
      netSalary: totals.earnings - totals.deductions,
    };
  }, [items]);

  const handleGenerateAndSave = async () => {
    if (!selectedTalent || !user) return;
    setIsGenerating(true);
    try {
        const body: Omit<Payslip, 'id' | 'createdAt' | 'createdBy'> & { userId: string } = {
            userId: user.id,
            talentId: selectedTalent.id,
            talentName: selectedTalent.fullName,
            referenceMonth: month,
            type: payslipType,
            talentData: {
                fullName: selectedTalent.fullName,
                cpf: selectedTalent.cpf,
                jobTitle: selectedTalent.jobTitle,
                hireDate: selectedTalent.hireDate,
            },
            items,
            totalEarnings,
            totalDeductions,
            netSalary,
        };
        
        // Adiciona as cotações do bônus se houver
        if (bonusDialogData && bonusDialogData.totalBonus > 0 && items.find(i => i.code === '02' && i.earnings > 0)) {
             body.bonus = { 
                eligibleQuoteIds: bonusDialogData.eligibleQuotes.map(q => q.id), 
                eligibleQuotes: bonusDialogData.eligibleQuotes.map(q => {
                    const grossProfit = q.grossProfit || 0;
                    const totalExpense = q.totalExpense || 0;
                    const netProfit = grossProfit - totalExpense;
                    const bonusPercentage = user.salesBonusPercentage || 0;
                    const bonusValue = netProfit > 0 ? (netProfit * (bonusPercentage / 100)) : 0;

                    return {
                        id: q.id,
                        code: q.quoteCode,
                        date: q.closedAt || q.data,
                        clientName: q.clientName,
                        billingValue: q.valorFinal + (q.icmsValor || 0),
                        bonusValue: bonusValue
                    };
                }).filter(q => q.bonusValue > 0)
            };
        }

        const response = await authFetch('/api/payslips', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if(response.ok) {
            const newPayslip = await response.json();
            await fetchData();
            toast({ title: 'Sucesso!', description: 'Holerite gerado e salvo.' });
            setNewlyCreatedPayslip(newPayslip);
            setIsPostSaveExpenseDialogOpen(true);
        } else {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Falha ao salvar holerite.');
        }
    } catch(e: any) {
        toast({ variant: 'destructive', title: 'Erro', description: `Não foi possível salvar o holerite: ${e.message}` });
    } finally {
        setIsGenerating(false);
    }
  };
  
  const handleLaunchExpense = async () => {
    if (!newlyCreatedPayslip || !user) return;

    const referenceDate = parse(newlyCreatedPayslip.referenceMonth, 'yyyy-MM', new Date());
    const payrollSettings = pricingSettings?.payroll || { advancePaymentDay: 20, finalPaymentDay: 5 };
    const isAdvance = newlyCreatedPayslip.type === 'Adiantamento';
    const dueDate = new Date(
        referenceDate.getFullYear(),
        isAdvance ? referenceDate.getMonth() : referenceDate.getMonth() + 1,
        isAdvance ? payrollSettings.advancePaymentDay : payrollSettings.finalPaymentDay
    );

    const expenseData: Partial<Expense> = {
        monthYear: format(dueDate, 'yyyy-MM'),
        description: `${isAdvance ? 'ADIANTAMENTO' : 'PAGAMENTO'} - ${newlyCreatedPayslip.talentName}`,
        categoryId: isAdvance ? 'ADVANCE' : 'SALARY',
        categoryName: 'Adiantamento',
        value: newlyCreatedPayslip.netSalary,
        dueDate: dueDate.toISOString(),
        isRecurring: isRecurringExpense,
        recurringId: isRecurringExpense ? newlyCreatedPayslip.talentId : undefined,
        payslipId: newlyCreatedPayslip.id, // Adiciona o ID do holerite
    };
    
    const success = await addExpense(expenseData);
    if(success) {
        toast({ title: 'Despesa Lançada!', description: 'A despesa do holerite foi adicionada à Gestão de Despesas.' });
        await fetchData(); // Re-fetch all data to update the UI state
    }
    setIsPostSaveExpenseDialogOpen(false);
    setNewlyCreatedPayslip(null);
    setIsRecurringExpense(false);
  }

  const handleDelete = async (payslipId: string) => { 
      const response = await authFetch(`/api/payslips/${payslipId}`, { method: 'DELETE' });
      if(response.ok) {
        toast({ title: 'Sucesso!', description: 'Holerite removido.' });
        await fetchData();
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível remover o holerite.' });
      }
  };
  const handlePrint = (payslip: PayslipType) => { 
      if (companyProfile) {
        printPayslip(payslip, companyProfile); 
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: 'Perfil da empresa não carregado.'})
      }
  };
  
  const activeTalents = talents.filter(t => t.status === 'Ativo');
  const monthOptions = Array.from({ length: 12 }, (_, i) => { const d = subMonths(new Date(), i); return { value: format(d, 'yyyy-MM'), label: format(d, "MMMM 'de' yyyy", { locale: ptBR }) }; });
  
  const filteredPayslips = useMemo(() => {
    if (!payslips) return [];
    
    let items = payslips.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (payslipSearchTerm.trim() !== '') {
        const lowercasedFilter = payslipSearchTerm.toLowerCase();
        items = items.filter(ps => 
            ps.talentName.toLowerCase().includes(lowercasedFilter) ||
            ps.referenceMonth.toLowerCase().includes(lowercasedFilter) ||
            ps.type.toLowerCase().includes(lowercasedFilter)
        );
    }
    
    return items;
  }, [payslips, payslipSearchTerm]);

  if (authLoading || isLoading || !user || !user.talentsAccess || !pricingSettings) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <>
      <main className="container mx-auto p-4 md:p-8">
        <Button variant="outline" onClick={() => router.push('/hr')} className="mb-8"> &larr; Voltar para Recursos Humanos </Button>
        <h1 className="text-3xl font-bold text-primary mb-2">Gerar Holerite</h1>
        <p className="text-muted-foreground mb-8">Componha, calcule e salve os recibos de pagamento.</p>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Composição do Holerite</CardTitle>
                <CardDescription>Selecione um talento para começar e adicione os itens de pagamento.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="space-y-2 sm:col-span-1">
                    <Label>Talento</Label>
                    <Select onValueChange={setSelectedTalentId} value={selectedTalentId}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>{activeTalents.map(t => <SelectItem key={t.id} value={t.id}>{t.fullName}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Tipo</Label><Select onValueChange={(v) => setPayslipType(v as any)} value={payslipType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Pagamento Final">Pagamento Final</SelectItem><SelectItem value="Adiantamento">Adiantamento</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><Label>Mês de Referência</Label><Select onValueChange={setMonth} value={month}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{monthOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent></Select></div>
                </div>

                {selectedTalent && (
                  <div className="space-y-4 pt-4 border-t">
                     <div className="flex justify-between items-center">
                        <Label>Itens do Holerite</Label>
                        <div className="flex gap-2 items-center">
                            <Button size="sm" variant="outline" onClick={resetGenerator}><RefreshCw className="mr-2 h-4 w-4"/>Reiniciar</Button>
                            <ItemSelector items={allItemTypes} onSelect={handleAddItem} />
                        </div>
                     </div>
                     <div className="border rounded-md max-h-96 overflow-y-auto">
                        <Table>
                            <TableHeader><TableRow><TableHead>Cód.</TableHead><TableHead>Descrição</TableHead><TableHead>Referência</TableHead><TableHead>Proventos</TableHead><TableHead>Descontos</TableHead><TableHead></TableHead></TableRow></TableHeader>
                            <TableBody>
                                {items.map(item => <ItemRow key={item.id} item={item} onRemove={handleRemoveItem} onChange={handleItemChange} onCalculateBonus={() => setIsBonusDialogOpen(true)} isCalculatingBonus={isCalculatingBonus} />)}
                            </TableBody>
                        </Table>
                     </div>
                      <div className="grid sm:grid-cols-3 gap-4 pt-4">
                        <Card><CardHeader className="p-2 pb-0"><CardTitle className="text-sm font-normal text-muted-foreground">Total Proventos</CardTitle></CardHeader><CardContent className="p-2"><p className="text-lg font-bold text-green-600">{formatCurrency(totalEarnings)}</p></CardContent></Card>
                        <Card><CardHeader className="p-2 pb-0"><CardTitle className="text-sm font-normal text-muted-foreground">Total Descontos</CardTitle></CardHeader><CardContent className="p-2"><p className="text-lg font-bold text-red-600">{formatCurrency(totalDeductions)}</p></CardContent></Card>
                        <Card className="bg-primary/10 border-primary"><CardHeader className="p-2 pb-0"><CardTitle className="text-sm font-normal text-primary">Líquido a Receber</CardTitle></CardHeader><CardContent className="p-2"><p className="text-xl font-bold text-primary">{formatCurrency(netSalary)}</p></CardContent></Card>
                      </div>
                  </div>
                )}
              </CardContent>
              <CardFooter>
                 <Button onClick={handleGenerateAndSave} disabled={!selectedTalentId || items.length === 0 || isGenerating}>
                   {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ReceiptText className="mr-2 h-4 w-4" />}
                   {isGenerating ? 'Gerando...' : 'Gerar e Salvar Holerite'}
                </Button>
              </CardFooter>
            </Card>
          </div>
          <div className="xl:col-span-1">
             <Card>
                <CardHeader>
                    <CardTitle>Holerites Gerados</CardTitle>
                    <CardDescription>Consulte, reimprima ou apague os holerites salvos.</CardDescription>
                    <div className="relative pt-2">
                         <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar holerite..."
                            value={payslipSearchTerm}
                            onChange={(e) => setPayslipSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </CardHeader>
                <CardContent className="max-h-[60vh] overflow-y-auto">
                    <div className="space-y-3">
                        {filteredPayslips.length > 0 ? filteredPayslips.map(ps => {
                            const isLaunched = expenses.some(exp => exp.payslipId === ps.id);
                            return (
                                <div key={ps.id} className="flex justify-between items-center p-3 border rounded-lg">
                                    <div>
                                        <p className="font-semibold">{ps.talentName}</p>
                                        <p className="text-sm text-muted-foreground">{ps.type} - {format(parse(ps.referenceMonth, 'yyyy-MM', new Date()), "MMMM/yyyy", { locale: ptBR })}</p>
                                        <p className="text-xs text-muted-foreground">Gerado em {format(new Date(ps.createdAt), "dd/MM/yy HH:mm")}</p>
                                    </div>
                                    <div className="flex flex-col gap-2 items-end">
                                        <div className="flex gap-2">
                                        <Button size="sm" variant="outline" onClick={() => handlePrint(ps)}><Printer className="mr-2 h-4 w-4"/>Imprimir</Button>
                                        {user?.role === 'admin' && (
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild><Button size="sm" variant="destructive"><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader><AlertDialogTitle>Apagar Holerite?</AlertDialogTitle><AlertDialogDesc>Tem certeza que deseja apagar este holerite? Esta ação não pode ser desfeita.</AlertDialogDesc></AlertDialogHeader>
                                                    <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(ps.id)} className="bg-destructive hover:bg-destructive/90">Apagar</AlertDialogAction></AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        )}
                                        </div>
                                        <Button 
                                            size="sm" 
                                            variant={isLaunched ? "default" : "secondary"}
                                            onClick={() => { setNewlyCreatedPayslip(ps); setIsPostSaveExpenseDialogOpen(true); }}
                                            disabled={isLaunched}
                                            className={isLaunched ? 'bg-green-600 hover:bg-green-700' : ''}
                                        >
                                            <Wallet className="mr-2 h-4 w-4"/> {isLaunched ? 'Lançado' : 'Lançar Despesa'}
                                        </Button>
                                    </div>
                                </div>
                            );
                        }) : <p className="text-center text-muted-foreground py-8">Nenhum holerite encontrado.</p>}
                    </div>
                </CardContent>
             </Card>
          </div>
        </div>
      </main>

       <Dialog open={isPostSaveExpenseDialogOpen} onOpenChange={setIsPostSaveExpenseDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Lançar na Gestão de Despesas</DialogTitle>
                    <DialogDescription>
                        Deseja criar uma despesa com o valor líquido de {formatCurrency(newlyCreatedPayslip?.netSalary || 0)}?
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <p><strong>Talento:</strong> {newlyCreatedPayslip?.talentName}</p>
                    <p><strong>Valor:</strong> {formatCurrency(newlyCreatedPayslip?.netSalary || 0)}</p>
                    <div className="flex items-center space-x-2">
                        <Switch id="recurring-switch" checked={isRecurringExpense} onCheckedChange={setIsRecurringExpense} />
                        <Label htmlFor="recurring-switch">Marcar como despesa recorrente mensal</Label>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="secondary">Não, obrigado</Button></DialogClose>
                    <Button onClick={handleLaunchExpense}>Sim, Lançar Despesa</Button>
                </DialogFooter>
            </DialogContent>
       </Dialog>

        <Dialog open={isBonusDialogOpen} onOpenChange={setIsBonusDialogOpen}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Apuração de Bônus de Venda</DialogTitle>
                    <DialogDescription>
                        Defina o período para apurar o bônus de venda para <span className="font-bold">{selectedTalent?.fullName}</span>.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="bonus-start-date">Data de Início</Label>
                        <Input id="bonus-start-date" type="date" value={bonusStartDate} onChange={(e) => setBonusStartDate(e.target.value)} />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="bonus-end-date">Data de Fim</Label>
                        <Input id="bonus-end-date" type="date" value={bonusEndDate} onChange={(e) => setBonusEndDate(e.target.value)} />
                    </div>
                </div>
                <Button onClick={handleCalculateBonus} disabled={isCalculatingBonus} className="w-full mb-4">
                    {isCalculatingBonus ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Calculator className="mr-2 h-4 w-4" />}
                    Apurar Bônus
                </Button>

                {bonusDialogData && (
                    <>
                        <div className="text-center p-4 bg-muted rounded-lg">
                            <p>Total do Bônus Apurado para o período:</p>
                             <p className="font-bold text-primary text-2xl">{formatCurrency(bonusDialogData?.totalBonus || 0)}</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[40vh] overflow-y-auto p-1 mt-4">
                            <div>
                                <h3 className="font-semibold mb-2">Cotações Incluídas no Bônus ({bonusDialogData?.eligibleQuotes?.length || 0})</h3>
                                <ScrollArea className="h-48 border rounded-md p-2">
                                    {bonusDialogData?.eligibleQuotes && bonusDialogData.eligibleQuotes.length > 0 ? (
                                        bonusDialogData.eligibleQuotes.map(q => (
                                            <div key={q.id} className="text-sm p-2 border-b flex justify-between items-center">
                                                <div>
                                                  <p><strong>Cotação:</strong> {q.quoteCode} | <strong>Lucro Líquido:</strong> {formatCurrency((q.grossProfit || 0) - (q.totalExpense || 0))}</p>
                                                </div>
                                                 <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemoveQuoteFromBonus(q.id)}>
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))
                                    ) : <p className="text-sm text-muted-foreground p-4 text-center">Nenhuma nova cotação para bônus.</p>}
                                </ScrollArea>
                            </div>
                            <div>
                                <h3 className="font-semibold mb-2">Cotações Já Pagas ({bonusDialogData?.paidQuotes?.length || 0})</h3>
                                <ScrollArea className="h-48 border rounded-md p-2">
                                    {bonusDialogData?.paidQuotes && bonusDialogData.paidQuotes.length > 0 ? (
                                        bonusDialogData.paidQuotes.map(q => (
                                            <div key={q.id} className="text-sm p-2 border-b flex justify-between items-center">
                                                <div>
                                                    <p><strong>Cotação:</strong> {q.quoteCode}</p>
                                                    <p className="text-xs text-muted-foreground">Incluída no holerite ID: {q.paidPayslipId}</p>
                                                </div>
                                                {user?.role === 'admin' && (
                                                    <Button size="sm" variant="destructive" onClick={() => handleRevertBonusPayment(q.id)}>
                                                        Reverter
                                                    </Button>
                                                )}
                                            </div>
                                        ))
                                    ) : <p className="text-sm text-muted-foreground p-4 text-center">Nenhuma cotação paga anteriormente.</p>}
                                </ScrollArea>
                            </div>
                        </div>
                    </>
                )}
                <DialogFooter>
                    <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
                    <Button onClick={() => handleApplyBonus(bonusDialogData?.totalBonus || 0)} disabled={!bonusDialogData || (bonusDialogData?.totalBonus || 0) <= 0}>
                        Aplicar Bônus de {formatCurrency(bonusDialogData?.totalBonus || 0)}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

    </>
  );
}


function ItemRow({ item, onRemove, onChange, onCalculateBonus, isCalculatingBonus }: { item: PayslipItem, onRemove: (id: string) => void, onChange: (id: string, field: 'reference' | 'factor', value: string | number) => void, onCalculateBonus: () => void, isCalculatingBonus: boolean }) {
    const isBaseSalary = item.id === 'system-base-salary';
    const isBonus = item.code === '02';

    if (isBonus) {
        return (
            <>
                <TableRow>
                    <TableCell className="font-mono p-1">{item.code}</TableCell>
                    <TableCell className="p-1">{item.description}</TableCell>
                    <TableCell className="p-1"></TableCell>
                    <TableCell className="text-right p-1 text-green-600">{item.earnings > 0 ? formatCurrency(item.earnings) : '-'}</TableCell>
                    <TableCell className="text-right p-1"></TableCell>
                    <TableCell className="p-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onRemove(item.id)}><X className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                </TableRow>
                <TableRow>
                    <TableCell colSpan={6} className="p-2 bg-muted/50">
                        <div className="flex items-end gap-2">
                             <div className="flex-grow space-y-1">
                                <Label className="text-xs">Apuração de Bônus de Venda</Label>
                                <p className="text-xs text-muted-foreground">Calcule o bônus com base nas cotações finalizadas do período.</p>
                             </div>
                             <Button size="sm" onClick={onCalculateBonus} disabled={isCalculatingBonus} className="h-8">
                                {isCalculatingBonus ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Calculator className="mr-2 h-4 w-4"/>}
                                Calcular
                             </Button>
                        </div>
                    </TableCell>
                </TableRow>
            </>
        )
    }

    return (
        <TableRow>
            <TableCell className="font-mono p-1">{item.code}</TableCell>
            <TableCell className="p-1">{item.description}</TableCell>
            <TableCell className="p-1">
                <div className="flex gap-1">
                    <Input type="number" value={item.reference} onChange={e => onChange(item.id, 'reference', e.target.value)} className="w-20 h-8" disabled={isBaseSalary} />
                    <Select value={item.factor} onValueChange={v => onChange(item.id, 'factor', v)} disabled={isBaseSalary}>
                        <SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="%">% do Salário</SelectItem>
                            <SelectItem value="Dias">Dias</SelectItem>
                            <SelectItem value="Horas">Horas</SelectItem>
                            <SelectItem value="Valor Fixo">Valor Fixo</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </TableCell>
            <TableCell className="text-right p-1 text-green-600">{item.earnings > 0 ? formatCurrency(item.earnings) : '-'}</TableCell>
            <TableCell className="text-right p-1 text-red-600">{item.deductions > 0 ? formatCurrency(item.deductions) : '-'}</TableCell>
            <TableCell className="p-1">
                {!isBaseSalary && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onRemove(item.id)}><X className="h-4 w-4 text-destructive" /></Button>}
            </TableCell>
        </TableRow>
    )
}

function ItemSelector({ items, onSelect }: { items: EarningDeductionType[], onSelect: (item: EarningDeductionType) => void }) {
    const [open, setOpen] = useState(false);
    
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-[200px] justify-between">
            Adicionar Item
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0">
          <Command>
            <CommandInput placeholder="Buscar por código ou nome..." />
            <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
            <CommandList>
              <CommandGroup>
                {items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${item.code} - ${item.name}`}
                    onSelect={() => {
                      onSelect(item);
                      setOpen(false);
                    }}
                    disabled={item.code === '01'}
                  >
                    <Check className={cn("mr-2 h-4 w-4", "opacity-0")} />
                    <span className="font-mono w-12">{item.code}</span>
                    <span className="flex-grow">{item.name}</span>
                    <Badge variant={item.type === 'Provento' ? 'default' : 'destructive'} className={cn(item.type === 'Provento' && 'bg-green-600')}>{item.type}</Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
}

    

    