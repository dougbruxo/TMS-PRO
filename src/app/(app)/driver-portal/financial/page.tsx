
"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, ArrowLeft, Clock, CheckCircle, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Expense } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { authFetch } from '@/lib/api-client';

export default function DriverFinancialHubPage() {
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
      setExpenses(data);
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

  const { pendingCount, paidCount } = useMemo(() => {
    return {
        pendingCount: expenses.filter(e => e.status === 'pendente' || e.status === 'parcial').length,
        paidCount: expenses.filter(e => e.status === 'pago').length,
    }
  }, [expenses]);

  const financialCards = [
    { 
        title: 'Pagamentos Pendentes', 
        icon: <Clock className="h-8 w-8 text-primary" />, 
        count: pendingCount, 
        href: '/driver-portal/financial/pending', 
        description: 'Valores a receber que ainda não foram pagos.' 
    },
    { 
        title: 'Pagamentos Realizados', 
        icon: <CheckCircle className="h-8 w-8 text-primary" />, 
        count: paidCount, 
        href: '/driver-portal/financial/paid', 
        description: 'Histórico de todos os pagamentos que você já recebeu.' 
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
       <Button variant="outline" onClick={() => router.push('/driver-portal')} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para o Portal
       </Button>

       <div className="text-left">
            <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
                <Wallet className="h-6 w-6"/>
                Meu Financeiro
            </h1>
            <p className="text-muted-foreground mt-1">
                Acompanhe seus pagamentos a receber e os que já foram realizados.
            </p>
       </div>

        {isLoading ? (
            <div className="flex justify-center items-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        ) : (
            <div className="grid md:grid-cols-2 gap-6">
                {financialCards.map(card => (
                     <Link key={card.title} href={card.href}>
                        <Card className="flex flex-col w-full h-full transition-all duration-300 hover:shadow-glow hover:-translate-y-1 hover:ring-2 hover:ring-primary">
                            <CardHeader className="flex-row items-center gap-4 space-y-0 pb-4">
                                {card.icon}
                                <div>
                                    <CardTitle>{card.title}</CardTitle>
                                    <Badge className="mt-1">{card.count} Lançamentos</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-grow">
                                <CardDescription>{card.description}</CardDescription>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        )}
    </div>
  );
}
