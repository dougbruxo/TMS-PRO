
"use client";

import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, BookOpen, Wallet, Truck, Package } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import type { Manifest, Quote } from '@/lib/types';
import { authFetch } from '@/lib/api-client';


const PulsingBadge = ({ count }: { count: number }) => {
  if (count === 0) return null;
  return (
    <Badge className="absolute top-3 right-3 animate-pulse-badge bg-red-600 text-white h-6 w-6 justify-center p-0 text-xs">
        {count}
    </Badge>
  );
};


export default function DriverPortalDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [counts, setCounts] = useState({
    collections: 0,
    deliveries: 0,
    pendingPayments: 0,
    loadingManifests: 0,
  });
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);

  const fetchCounts = useCallback(async () => {
    if (!user) return;
    setIsLoadingCounts(true);
    try {
      const response = await authFetch(`/api/driver-portal/data?driverId=${user.id}`);
      if (!response.ok) throw new Error('Falha ao carregar dados do portal.');
      const data = await response.json();
      
      const undeliveredInManifests = (data.manifests || [])
        .filter((m: Manifest) => m.status === 'Em Rota')
        .reduce((acc: number, m: Manifest) => {
          const undeliveredQuotes = m.quotes.filter(q => q.status !== 'Entregue' && !q.proofOfDeliveryUrl);
          return acc + undeliveredQuotes.length;
        }, 0);

      setCounts({
        collections: (data.collections || []).length,
        deliveries: (data.individualDeliveries || []).length + undeliveredInManifests,
        pendingPayments: data.pendingExpensesCount || 0,
        loadingManifests: (data.manifests || []).filter((m: Manifest) => m.status === 'Pendente').length,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingCounts(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
        fetchCounts();
    }
  }, [fetchCounts, user]);

  if (authLoading || isLoadingCounts || !user) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const dashboardCards = [
    {
        title: "Minhas Coletas",
        description: "Acompanhe e confirme as coletas de mercadorias para o galpão.",
        link: "/driver-portal/collections",
        icon: <Package className="h-8 w-8 text-primary" />,
        count: counts.collections,
    },
    {
        title: "Minhas Entregas",
        description: "Acompanhe e dê baixa em todas as suas entregas, avulsas ou de romaneios.",
        link: "/driver-portal/deliveries",
        icon: <Truck className="h-8 w-8 text-primary" />,
        count: counts.deliveries,
    },
    {
        title: "Financeiro",
        description: "Consulte seus pagamentos pendentes e já realizados.",
        link: "/driver-portal/financial",
        icon: <Wallet className="h-8 w-8 text-primary" />,
        count: counts.pendingPayments,
    },
     {
        title: "Histórico de Romaneios",
        description: "Consulte romaneios em carregamento ou já finalizados.",
        link: "/driver-portal/manifests",
        icon: <BookOpen className="h-8 w-8 text-primary" />,
        count: counts.loadingManifests,
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-primary">Portal do Motorista</h1>
        <p className="text-muted-foreground">Bem-vindo(a) de volta, {user.username}!</p>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        {dashboardCards.map(card => (
             <Link key={card.title} href={card.link} className="flex">
                <Card className="relative flex flex-col w-full transition-all duration-300 hover:shadow-glow hover:-translate-y-1 hover:ring-2 hover:ring-primary">
                    <PulsingBadge count={card.count} />
                    <CardHeader className="flex-row items-center gap-4 space-y-0 pb-4">
                      {card.icon}
                      <CardTitle>{card.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-grow">
                      <CardDescription>{card.description}</CardDescription>
                    </CardContent>
                </Card>
            </Link>
        ))}
      </div>
      
    </div>
  );
}
