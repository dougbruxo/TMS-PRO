
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, TrendingDown, Banknote, Scale, AlertTriangle, DollarSign } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { cn } from '@/lib/utils';
import { PremiumNavigationCard } from '@/components/PremiumNavigationCard';





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
      <PageHeader
        icon={<DollarSign className="h-4 w-4" />}
        badge="Centro Financeiro"
        titlePrefix="Gestão"
        titleHighlight="Financeira"
        description="Controle as entradas e saídas financeiras da sua operação."
      />
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {financialCards.map((card) => (
          <PremiumNavigationCard
            key={card.title}
            title={card.title}
            description={card.description}
            href={card.enabled ? card.link : '#'}
            icon={card.icon}
            disabled={!card.enabled}
            pulsingBadgeCount={card.alertCount}
          />
        ))}
      </div>
    </main>
  );
}

    