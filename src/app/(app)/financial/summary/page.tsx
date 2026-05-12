
"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, DollarSign, TrendingDown, Scale, TrendingUp, AlertTriangle, Printer, FileCheck } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, parse } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/api-client';
import type { Quote, Expense, Invoice } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const formatCurrency = (value: number) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function FinancialSummaryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isFinalizing, setIsFinalizing] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  const fetchAllData = useCallback(async () => {
    setIsDataLoading(true);
    try {
        const [quotesRes, expensesRes, invoicesRes] = await Promise.all([
             authFetch('/api/quotes?status=billing_all'),
             authFetch('/api/expenses'),
             authFetch('/api/billing/invoices'),
        ]);
        if (!quotesRes.ok || !expensesRes.ok || !invoicesRes.ok) throw new Error("Falha ao carregar dados financeiros.");
        setQuotes(await quotesRes.json());
        setExpenses(await expensesRes.json());
        setInvoices(await invoicesRes.json());
    } catch(e: any) {
        toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
        setIsDataLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
    if(!authLoading) {
      if(!user || !user.expensesAccess) {
        router.push('/dashboard');
        return;
      }
      fetchAllData();
    }
  }, [user, authLoading, router, fetchAllData]);

  const summaryData = useMemo(() => {
    if (!selectedMonth) return { totalReceived: 0, totalExpensesPaid: 0, balance: 0, revenueItems: [], expenseItems: [] };

    const monthDate = parse(selectedMonth, 'yyyy-MM', new Date());
    const start = startOfMonth(monthDate);
    const end = endOfMonth(monthDate);

    const allRevenueItems = [...quotes, ...invoices];

    const paidExpenseItems = expenses.filter(exp => {
        const paymentDate = exp.paidAt ? parseISO(exp.paidAt) : null;
        return paymentDate && isWithinInterval(paymentDate, { start, end });
    });
    
    const paidRevenueItems = allRevenueItems.filter(item => {
        const paymentDate = item.paymentDate ? parseISO(item.paymentDate) : null;
        const paymentStatus = 'invoiceCode' in item ? item.status : item.paymentStatus;
        return paymentDate && isWithinInterval(paymentDate, { start, end }) && (paymentStatus === 'Pago' || paymentStatus === 'Parcial');
    });

    const totalReceived = paidRevenueItems.reduce((acc, item) => acc + (item.paidAmount || 0), 0);
    const totalExpensesPaid = paidExpenseItems.reduce((acc, exp) => acc + (exp.paidValue || 0), 0);
    
    // Tax Report (ICMS from Closed quotes)
    const icmsQuotes = quotes.filter(q => {
        // Assume 'Fechada' as business term for any operational quote (already filtered by API but let's be safe)
        if (q.status === 'Aberta' || q.status === 'Em Análise') return false;
        if (!q.icmsValor || q.icmsValor <= 0) return false;
        
        // ICMS is usually accounted for in the month the quote was generated/closed
        const quoteDate = q.data ? parseISO(q.data) : null;
        return quoteDate && isWithinInterval(quoteDate, { start, end });
    });
    const totalIcms = icmsQuotes.reduce((acc, q) => acc + (q.icmsValor || 0), 0);

    return {
        totalReceived,
        totalExpensesPaid,
        balance: totalReceived - totalExpensesPaid,
        revenueItems: paidRevenueItems,
        expenseItems: paidExpenseItems,
        icmsQuotes,
        totalIcms,
    };
  }, [quotes, invoices, expenses, selectedMonth]);
  
    const handleFinalizeMonth = async () => {
    if (!user || !selectedMonth) return;

    setIsFinalizing(true);
    try {
        const monthDate = parse(selectedMonth, 'yyyy-MM', new Date());
        const start = startOfMonth(monthDate);
        const end = endOfMonth(monthDate);

        // 1. Check for pending revenue
        const allRevenueItems = [...quotes, ...invoices];
        const pendingRevenue = allRevenueItems.filter(item => {
            if (!item.billingDueDate) return false;
            const dueDate = parseISO(item.billingDueDate);
            const status = 'invoiceCode' in item ? item.status : item.paymentStatus;
            return isWithinInterval(dueDate, { start, end }) && status !== 'Pago';
        });

        if (pendingRevenue.length > 0) {
            throw new Error(`Não é possível fechar o mês. Existem ${pendingRevenue.length} cobrança(s) com vencimento neste mês que ainda não foram pagas.`);
        }

        // 2. Finalize expenses
        const expensesToFinalize = expenses.filter(exp => exp.monthYear === selectedMonth && exp.status !== 'finalizado');
        if (expensesToFinalize.length === 0) {
            toast({ title: 'Nenhuma Ação Necessária', description: 'Todas as despesas para este mês já foram finalizadas.' });
            setIsFinalizing(false);
            return;
        }

        for (const exp of expensesToFinalize) {
            const res = await authFetch(`/api/expenses/${exp.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'finalizado', user }),
            });
            if (!res.ok) throw new Error(`Falha ao finalizar a despesa: ${exp.description}`);
        }

        toast({ title: 'Sucesso!', description: `Todas as ${expensesToFinalize.length} despesa(s) de ${selectedMonth} foram finalizadas e arquivadas.` });
        await fetchAllData();
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Erro ao Fechar Mês', description: e.message });
    } finally {
        setIsFinalizing(false);
    }
  };


  if (authLoading || isDataLoading || !user) {
    return (
        <main className="container mx-auto p-4 md:p-8">
            <div className="flex h-full items-center justify-center">
              <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
            </div>
        </main>
    );
  }

  return (
    <main className="container mx-auto p-4 md:p-8 print:p-0 print:m-0 printable-document">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8 print:mb-4">
        <div className="space-y-2">
            <h1 className="text-3xl font-bold text-primary flex items-center gap-2"><Scale/>Fluxo de Caixa / Balanço Financeiro</h1>
            <p className="text-muted-foreground print:hidden">Uma visão detalhada das suas receitas e despesas por período.</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
            <Button variant="outline" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" /> Imprimir Relatório
            </Button>
            <Button variant="outline" onClick={() => router.push('/financial')}>
                &larr; Voltar
            </Button>
        </div>
      </div>

      <Card className="mb-8 print:shadow-none print:border-none print:mb-4">
        <CardHeader className="print:p-0">
            <CardTitle className="print:text-lg">Mês de Referência</CardTitle>
            <div className="flex flex-col md:flex-row gap-4 pt-4 print:pt-1">
                <Input 
                  type="month" 
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="w-full md:w-auto print:font-bold print:border-none print:bg-transparent print:p-0"
                />
              </div>
        </CardHeader>
      </Card>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 print:gap-2">
        <Card className="print:shadow-none print:bg-transparent"><CardHeader className="pb-2 print:p-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><TrendingUp className="text-green-600"/>Total Recebido</CardTitle></CardHeader><CardContent className="print:p-2"><p className="text-2xl font-bold text-green-600">{formatCurrency(summaryData.totalReceived)}</p></CardContent></Card>
        <Card className="print:shadow-none print:bg-transparent"><CardHeader className="pb-2 print:p-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><TrendingDown className="text-red-600"/>Total de Despesas Pagas</CardTitle></CardHeader><CardContent className="print:p-2"><p className="text-2xl font-bold text-red-600">{formatCurrency(summaryData.totalExpensesPaid)}</p></CardContent></Card>
        <Card className="print:shadow-none print:bg-transparent"><CardHeader className="pb-2 print:p-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><FileCheck className="text-orange-500"/>ICMS Gerado (Cotações Fechadas)</CardTitle></CardHeader><CardContent className="print:p-2"><p className="text-2xl font-bold text-orange-500">{formatCurrency(summaryData.totalIcms)}</p></CardContent></Card>
        <Card className="print:shadow-none print:bg-transparent"><CardHeader className="pb-2 print:p-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><DollarSign className="text-blue-600"/>Saldo do Período</CardTitle></CardHeader><CardContent className="print:p-2"><p className={cn("text-2xl font-bold", summaryData.balance >= 0 ? "text-blue-600" : "text-destructive")}>{formatCurrency(summaryData.balance)}</p></CardContent></Card>
      </div>
      
      <div className="grid lg:grid-cols-2 gap-8 mb-8">
        <Card className="print:shadow-none">
            <CardHeader className="print:p-2"><CardTitle>Entradas (Receitas)</CardTitle></CardHeader>
            <CardContent className="print:p-2">
                <ScrollArea className="h-96 print:h-auto"><Table>
                    <TableHeader><TableRow><TableHead>Tomador</TableHead><TableHead>Data Pgto.</TableHead><TableHead className="text-right">Valor Pago</TableHead></TableRow></TableHeader>
                    <TableBody>{summaryData.revenueItems.map(item => <TableRow key={item.id}><TableCell>{'tomador' in item ? item.tomador : 'N/A'}</TableCell><TableCell>{item.paymentDate ? format(parseISO(item.paymentDate), 'dd/MM/yy') : ''}</TableCell><TableCell className="text-right font-medium text-green-600">{formatCurrency(item.paidAmount || 0)}</TableCell></TableRow>)}</TableBody>
                </Table></ScrollArea>
           </CardContent>
        </Card>
        <Card className="print:shadow-none">
            <CardHeader className="print:p-2"><CardTitle>Saídas (Despesas)</CardTitle></CardHeader>
            <CardContent className="print:p-2">
                <ScrollArea className="h-96 print:h-auto"><Table>
                    <TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Data Pgto.</TableHead><TableHead className="text-right">Valor Pago</TableHead></TableRow></TableHeader>
                    <TableBody>{summaryData.expenseItems.map(e => <TableRow key={e.id}><TableCell>{e.description}</TableCell><TableCell>{e.paidAt ? format(parseISO(e.paidAt), 'dd/MM/yy') : ''}</TableCell><TableCell className="text-right font-medium text-red-600">{formatCurrency(e.paidValue || 0)}</TableCell></TableRow>)}</TableBody>
                </Table></ScrollArea>
            </CardContent>
        </Card>
      </div>

       <Card className="mb-8 print:shadow-none print:break-before-page">
            <CardHeader className="print:p-2">
                <CardTitle className="flex items-center gap-2"><FileCheck className="h-5 w-5 text-orange-500" /> Relatório Detalhado de Impostos (ICMS)</CardTitle>
                <CardDescription>Detalhamento do ICMS gerado a partir de cotações válidas no mês corrente.</CardDescription>
            </CardHeader>
            <CardContent className="print:p-2">
                <ScrollArea className="h-96 print:h-auto"><Table>
                    <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Cliente / Tomador</TableHead>
                          <TableHead>Data Emissão</TableHead>
                          <TableHead className="text-right">Valor Cotação</TableHead>
                          <TableHead className="text-right">Valor ICMS</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {summaryData.icmsQuotes.map(q => (
                            <TableRow key={q.id}>
                                <TableCell className="font-medium">{q.quoteCode || q.id.slice(-6).toUpperCase()}</TableCell>
                                <TableCell>{q.tomador || q.cliente}</TableCell>
                                <TableCell>{q.data ? format(parseISO(q.data), 'dd/MM/yy') : ''}</TableCell>
                                <TableCell className="text-right">{formatCurrency(q.totalFrete || q.valorFinal)}</TableCell>
                                <TableCell className="text-right font-medium text-orange-500">{formatCurrency(q.icmsValor || 0)}</TableCell>
                            </TableRow>
                        ))}
                        {summaryData.icmsQuotes.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum ICMS registrado em cotações fechadas neste mês.</TableCell>
                            </TableRow>
                        )}
                        {summaryData.icmsQuotes.length > 0 && (
                            <TableRow className="bg-muted/50 font-bold">
                                <TableCell colSpan={4} className="text-right">Total Gerado (Mês):</TableCell>
                                <TableCell className="text-right text-orange-600">{formatCurrency(summaryData.totalIcms)}</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table></ScrollArea>
            </CardContent>
        </Card>

       <Card className="mt-8 bg-muted/30 print:hidden">
        <CardHeader>
            <CardTitle>Fechamento do Mês</CardTitle>
            <CardDescription>Esta ação verifica se todas as cobranças do mês foram pagas e, em seguida, finaliza e arquiva todas as despesas do período. Esta ação não pode ser desfeita.</CardDescription>
        </CardHeader>
        <CardFooter>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={isFinalizing}>
                    {isFinalizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <AlertTriangle className="mr-2 h-4 w-4" />}
                    Fechar Mês Fiscal
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Tem certeza que deseja fechar o mês?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta ação irá tentar finalizar todas as despesas para o mês de <span className="font-bold">{selectedMonth}</span>. 
                        Ela só será bem-sucedida se todas as cobranças com vencimento neste mês já estiverem pagas.
                        A ação não pode ser desfeita.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isFinalizing}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleFinalizeMonth} disabled={isFinalizing} className="bg-destructive hover:bg-destructive/90">
                        {isFinalizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Confirmar Fechamento'}
                    </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </CardFooter>
      </Card>
    </main>
  );
}
