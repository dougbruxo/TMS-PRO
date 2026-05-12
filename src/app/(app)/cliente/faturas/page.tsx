"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Receipt, ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/api-client';
import { format, parseISO, isPast, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Quote, PaymentStatus } from '@/lib/types';

export default function ClienteFaturasPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBillingQuotes = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await authFetch('/api/quotes?status=billing_all');
      if (!response.ok) throw new Error('Falha ao carregar faturas.');
      const data = await response.json();
      // Filter only quotes that have a billingDueDate
      setQuotes(data.filter((q: Quote) => q.billingDueDate));
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || (user.role !== 'cliente' && user.role !== 'sub-cliente')) {
      router.push('/dashboard');
      return;
    }
    fetchBillingQuotes();
  }, [user, authLoading, router, fetchBillingQuotes]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const getStatusBadge = (status: PaymentStatus | undefined, dueDate: string | null | undefined) => {
    if (status === 'Pago') return <Badge className="bg-green-600">Pago</Badge>;
    if (status === 'Parcial') return <Badge className="bg-orange-500">Parcial</Badge>;
    if (dueDate && isPast(parseISO(dueDate)) && !isSameDay(parseISO(dueDate), new Date())) {
      return <Badge className="bg-red-500 animate-pulse">Atrasado</Badge>;
    }
    return <Badge variant="secondary">Pendente</Badge>;
  };

  const { totalValue, totalPaid, totalPending } = useMemo(() => {
    let total = 0, paid = 0;
    quotes.forEach(q => {
      const val = (q.valorFinal || 0) + (q.icmsValor || 0);
      total += val;
      if (q.paymentStatus === 'Pago') paid += val;
      else if (q.paymentStatus === 'Parcial') paid += (q.paidAmount || 0);
    });
    return { totalValue: total, totalPaid: paid, totalPending: total - paid };
  }, [quotes]);

  if (authLoading || !user) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <main className="container mx-auto p-4 md:p-8">
      <Button variant="outline" onClick={() => router.push('/cliente/dashboard')} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Painel
      </Button>

      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
          <Receipt className="h-8 w-8" /> Minhas Faturas
        </h1>
        <p className="text-muted-foreground">Acompanhe o status de pagamento das suas cotações.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Faturado</CardTitle></CardHeader>
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Faturas</CardTitle>
          <CardDescription>Todas as cobranças referentes às suas cotações de frete.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cotação</TableHead>
                  <TableHead>Remetente</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center h-24"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                ) : quotes.length > 0 ? (
                  quotes.map(q => (
                    <TableRow key={q.id}>
                      <TableCell className="font-semibold">{q.quoteCode}</TableCell>
                      <TableCell>{q.remetente}</TableCell>
                      <TableCell>{q.cidadeDestino}</TableCell>
                      <TableCell className="font-mono">{formatCurrency((q.valorFinal || 0) + (q.icmsValor || 0))}</TableCell>
                      <TableCell>{q.billingDueDate ? format(parseISO(q.billingDueDate), 'dd/MM/yyyy') : '-'}</TableCell>
                      <TableCell>{getStatusBadge(q.paymentStatus, q.billingDueDate)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => window.open(`/financial/billing/invoice/${q._id || q.id}`, '_blank')} title="Ver Fatura / Imprimir">
                            <Printer className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={7} className="text-center h-24 text-muted-foreground">Nenhuma fatura encontrada.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
