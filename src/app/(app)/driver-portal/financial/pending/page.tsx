
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
import { cn } from '@/lib/utils';
import { authFetch } from '@/lib/api-client';

const formatCurrency = (value: number) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function formatDriverExpenseDescription(desc: string): string {
  if (!desc) return '—';
  
  // 1. Extract the quote code (e.g. 37K)
  let quoteCode = '';
  if (desc.includes('| Cotação')) {
    const parts = desc.split('| Cotação');
    quoteCode = parts[parts.length - 1]?.trim() || '';
  } else if (desc.includes(' - ')) {
    const parts = desc.split(' - ');
    quoteCode = parts[parts.length - 1]?.trim() || '';
  } else {
    quoteCode = desc.trim();
  }
  
  // Clean up any remaining characters or prefixes from quoteCode if needed
  quoteCode = quoteCode.replace(/^cotação\s+/i, '').trim();
  
  // 2. Identify if it is a collection (origem x galpão) or delivery (origem x destino or galpão x destino)
  const descUpper = desc.toUpperCase();
  
  // A collection specifically involves ATRIBUICAO_COLETA_GALPAO or COLETA
  const isColeta = descUpper.includes('ATRIBUICAO_COLETA_GALPAO') || 
                   (descUpper.includes('COLETA') && !descUpper.includes('ENTREGA'));
                   
  // A delivery involves manifests, outputs, or explicitly "entrega" or "saida" or "pagamento motorista"
  const isEntrega = descUpper.includes('ENTREGA') || 
                    descUpper.includes('SAIDA') || 
                    descUpper.includes('ENTREGUE') ||
                    descUpper.includes('ROMANEIO') ||
                    descUpper.includes('PAGAMENTO MOTORISTA') ||
                    descUpper.includes('PAGAMENTO_MOTORISTA');
  
  if (isColeta) {
    return `COLETA - ${quoteCode}`;
  }
  
  if (isEntrega) {
    return `ENTREGA - ${quoteCode}`;
  }
  
  // Fallbacks based on partial matches
  if (descUpper.includes('COLETA')) {
    return `COLETA - ${quoteCode}`;
  }
  
  // Default fallback for driver actions/manifests (since they are typically collections or deliveries)
  return `ENTREGA - ${quoteCode}`;
}

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
      setExpenses(data.filter((e: Expense) => e.status === 'pendente' || e.status === 'parcial' || e.status === 'atrasado'));
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
                            <TableHead className="px-2">Descrição</TableHead>
                            <TableHead className="w-[100px] px-2 text-center">Status</TableHead>
                            <TableHead className="w-[120px] px-2 text-right">Valor</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center">
                                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                                </TableCell>
                            </TableRow>
                        ) : expenses.length > 0 ? expenses.map(e => (
                            <TableRow key={e.id}>
                                <TableCell className="px-2 font-medium">{formatDriverExpenseDescription(e.description)}</TableCell>
                                <TableCell className="px-2 text-center">
                                    <Badge className={cn(
                                        e.status === 'parcial' ? 'bg-orange-500' : 'bg-yellow-500',
                                        "capitalize"
                                    )}>
                                        {e.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="px-2 text-right font-semibold">{formatCurrency(e.value)}</TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">Nenhum pagamento pendente.</TableCell>
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
