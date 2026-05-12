
"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, ArrowLeft, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Expense } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { authFetch } from '@/lib/api-client';

const formatCurrency = (value: number) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function DriverPendingFinancialPage() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();

  const fetchData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const response = await authFetch(`/api/expenses?driverId=${user.id}`);
      if (!response.ok) throw new Error('Falha ao carregar os dados financeiros.');
      const data = await response.json();
      setExpenses(data.filter((e: Expense) => e.status === 'pendente' || e.status === 'parcial'));
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [fetchData, user]);

  const totalPending = useMemo(() => expenses.reduce((sum, e) => sum + (e.value - (e.paidValue || 0)), 0), [expenses]);

  return (
    <div className="p-4 md:p-6 space-y-6">
       <Button variant="outline" onClick={() => router.push('/driver-portal/financial')} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Financeiro
      </Button>
      
       <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Clock className="h-6 w-6 text-yellow-500"/>
                Pagamentos Pendentes <Badge variant="secondary">{expenses.length}</Badge>
            </CardTitle>
             <CardDescription>
                Saldo Pendente a Receber: <span className="font-bold text-orange-500">{formatCurrency(totalPending)}</span>
            </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Vencimento</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                                </TableCell>
                            </TableRow>
                        ) : expenses.length > 0 ? expenses.map(e => (
                            <TableRow key={e.id}>
                                <TableCell>{e.description}</TableCell>
                                <TableCell>{format(parseISO(e.dueDate), 'dd/MM/yyyy')}</TableCell>
                                <TableCell>
                                    <Badge className={cn(
                                        e.status === 'parcial' ? 'bg-orange-500' : 'bg-yellow-500'
                                    )}>
                                        {e.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right font-semibold">{formatCurrency(e.value)}</TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Nenhum pagamento pendente.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
    </Card>
    </div>
  );
}
