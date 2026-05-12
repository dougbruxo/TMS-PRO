
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingDown, Banknote, Scale, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const PulsingBadge = ({ count }: { count: number }) => {
  if (count === 0) return null;
  return (
    <Badge className="absolute top-3 right-3 animate-pulse bg-red-600 text-white h-6 w-6 justify-center p-0 text-xs">
      {count}
    </Badge>
  );
};


export default function FinancialHubPage() {
  const { user, loading: authLoading, expenseAlertCount, billingAlertCount } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user || !user.expensesAccess) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  if (authLoading || !user || !user.expensesAccess) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const financialCards = [
    {
      title: "Fluxo Geral / Balanço",
      description: "Analise o balanço financeiro e feche o mês fiscal.",
      link: "/financial/summary",
      icon: <Scale className="h-8 w-8 text-primary" />,
      enabled: true,
      alertCount: 0,
    },
    {
      title: "Gestão de Despesas",
      description: "Controle as despesas da empresa, incluindo salários, custos operacionais e mais.",
      link: "/financial/expenses",
      icon: <TrendingDown className="h-8 w-8 text-primary" />,
      enabled: true,
      alertCount: expenseAlertCount,
    },
    {
      title: "Gestão de Cobranças",
      description: "Gerencie pagamentos de clientes, cobranças de armazenagem e faturas avulsas.",
      link: "/financial/billing",
      icon: <Banknote className="h-8 w-8 text-primary" />,
      enabled: true,
      alertCount: billingAlertCount,
    },
  ];

  return (
    <main className="container mx-auto p-4 md:p-8">
      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-bold text-primary">Gestão Financeira</h1>
        <p className="text-muted-foreground">Controle as entradas e saídas financeiras da sua operação.</p>
      </div>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {financialCards.map((card) => (
          <Link key={card.title} href={card.enabled ? card.link : '#'} className="flex">
            <Card className={cn("relative flex flex-col w-full transition-all duration-300", card.enabled && "hover:shadow-glow hover:-translate-y-1 hover:ring-2 hover:ring-primary", !card.enabled && "bg-muted/50 cursor-not-allowed")}>
              <PulsingBadge count={card.alertCount} />
              <CardHeader className="flex-row items-center gap-4 space-y-0 pb-4">
                {card.icon}
                <CardTitle className={cn(!card.enabled && "text-muted-foreground")}>{card.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-grow">
                <CardDescription>{card.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}

    