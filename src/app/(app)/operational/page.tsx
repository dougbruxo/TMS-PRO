

"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { PremiumNavigationCard } from '@/components/PremiumNavigationCard';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

import {
  Loader2,
  Truck,
  Warehouse,
  Move,
  PackageCheck,
  CheckCircle,
  ArrowRight,
  CircleDollarSign,
  Hourglass,
  BookOpen,
} from 'lucide-react';
import type { Quote, QuoteStatus } from '@/lib/types';
import { GlobalSearch } from '@/components/GlobalSearch';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/PageHeader';

const operationalStatuses: QuoteStatus[] = ['Coleta', 'No Galpão', 'Em Rota', 'Entregue', 'Finalizado'];

const statusDetails: Record<QuoteStatus, { icon: React.ReactElement, description: string, href: string }> = {
    'Aberta': { icon: <CheckCircle className="h-8 w-8 text-primary" />, description: "Cotações aprovadas e prontas para iniciar.", href: "/operational/status/aberta" },
    'Fechada': { icon: <CheckCircle className="h-8 w-8 text-primary" />, description: "Cotações fechadas, aguardando início da operação.", href: "/operational/status/fechada" },
    'Em Análise': { icon: <CheckCircle className="h-8 w-8 text-primary" />, description: "Cotações aguardando aprovação.", href: "/operational/status/em-analise" },
    'Coleta': { icon: <Truck className="h-8 w-8 text-primary" />, description: "Organize e acompanhe as coletas pendentes.", href: "/operational/status/coleta" },
    'No Galpão': { icon: <Warehouse className="h-8 w-8 text-primary" />, description: "Cargas recebidas no galpão, prontas para a próxima etapa.", href: "/operational/status/no-galpao" },
    'Em Rota': { icon: <Move className="h-8 w-8 text-primary" />, description: "Cargas em trânsito para o destino final.", href: "/operational/status/em-rota" },
    'Entregue': { icon: <PackageCheck className="h-8 w-8 text-primary" />, description: "Cargas entregues, pendentes de finalização.", href: "/operational/status/entregue" },
    'Finalizado': { icon: <CheckCircle className="h-8 w-8 text-primary" />, description: "Operações concluídas e arquivadas.", href: "/operational/status/finalizado" },
    'Aguardando Recebimento': { icon: <Hourglass className="h-8 w-8 text-primary" />, description: "Aguardando confirmação de recebimento no galpão.", href: "/operational/status/coleta" },
    'Aguardando Saída': { icon: <Hourglass className="h-8 w-8 text-primary" />, description: "Aguardando confirmação de saída do galpão.", href: "/operational/status/no-galpao" },
    'Em Carregamento': { icon: <Truck className="h-8 w-8 text-primary" />, description: "Cargas sendo carregadas para rota.", href: "/receiving/loading" },
};

const statusToSlug = (status: QuoteStatus): string => {
    switch (status) {
        case 'No Galpão': return 'no-galpao';
        case 'Em Rota': return 'em-rota';
        case 'Entregue': return 'entregue';
        case 'Finalizado': return 'finalizado';
        case 'Coleta':
        case 'Fechada':
        case 'Aguardando Recebimento':
             return 'coleta';
        case 'Em Carregamento': 
        case 'Aguardando Saída':
            return 'no-galpao';
        default: return status.toLowerCase().replace(' ', '-');
    }
}

const renderQuoteResult = (quote: any) => (
    <div>
        <div className="flex justify-between items-start">
            <div>
                <p className="font-semibold">{quote.remetente}</p>
                <p className="text-sm text-muted-foreground">{quote.cidadeOrigem} <ArrowRight className="inline h-3 w-3" /> {quote.cidadeDestino}</p>
            </div>
            <div className="text-right">
                <Badge variant="secondary">{quote.quoteCode}</Badge>
                <p className="text-xs text-muted-foreground mt-1">Status: {quote.status}</p>
            </div>
        </div>
    </div>
);

const handleQuoteResultClick = (quote: any, router: any) => {
    const slug = statusToSlug(quote.status);
    const quoteCode = quote.quoteCode || '';
    const href = slug === 'loading'
        ? `/receiving/loading`
        : `/operational/status/${slug}?quoteCode=${encodeURIComponent(quoteCode)}`;
    router.push(href);
};

const CardSkeleton = () => (
    <Card>
        <CardHeader className="flex-row items-center gap-4 space-y-0 pb-4">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="flex-grow space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
            </div>
        </CardHeader>
        <CardContent>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5 mt-2" />
        </CardContent>
    </Card>
);

export default function OperationalPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Record<string, { quoteCount: number; pendingPayments: number }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
        const res = await authFetch('/api/dashboard/stats');
        if (!res.ok) throw new Error("Failed to fetch operational stats");
        setStats(await res.json());
    } catch(e: any) {
        toast({ variant: "destructive", title: "Erro de Carregamento", description: e.message });
    } finally {
        setIsLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
    if (!authLoading) {
      fetchStats();
    }
  }, [fetchStats, authLoading]);

  if (authLoading || !user) {
    return (
        <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <main className="container mx-auto p-4 md:p-8 relative overflow-hidden">
      {/* Efeitos de desfoque e brilho aurora neon atrás dos cards */}
      <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/15 rounded-full blur-[100px] pointer-events-none -z-10" />
      <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-purple-500/15 rounded-full blur-[120px] pointer-events-none -z-10" />

      <PageHeader
            icon={<Truck className="h-4 w-4" />}
            badge="Centro Operacional"
            titlePrefix="Área"
            titleHighlight="Operacional"
            description="Selecione uma etapa para visualizar e gerenciar as cotações correspondentes."
        >
            <GlobalSearch<Quote>
                placeholder="Buscar por remetente, destino, nº cotação ou NF..."
                availableStatusFilters={operationalStatuses}
                basePath="/operational"
                apiPath="/api/search"
                renderResult={renderQuoteResult}
                onResultClick={handleQuoteResultClick}
            />
        </PageHeader>
        
        {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <CardSkeleton />
                {operationalStatuses.map(status => <CardSkeleton key={status} />)}
            </div>
        ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <PremiumNavigationCard
                    title="Gerenciar Romaneios"
                    description="Crie novos romaneios e visualize os que já foram gerados."
                    href="/operational/manifests"
                    icon={<BookOpen className="h-8 w-8" />}
                />
                {operationalStatuses.map(status => {
                    const data = stats[status] || { quoteCount: 0, pendingPayments: 0 };
                    const details = statusDetails[status];
                    const shouldBlink = data.pendingPayments > 0;
                    return (
                        <PremiumNavigationCard
                            key={status}
                            title={status}
                            description={details.description}
                            href={details.href}
                            icon={details.icon}
                            badgeCount={data.quoteCount}
                            badgeText="Cotações"
                            extraBadges={
                                data.pendingPayments > 0 ? (
                                    <Badge variant="destructive" className={shouldBlink ? 'animate-pulse font-medium shadow-md shadow-destructive/10' : ''}>
                                        <CircleDollarSign className="mr-1 h-3.5 w-3.5" />
                                        {data.pendingPayments} Pendente(s)
                                    </Badge>
                                ) : undefined
                            }
                        />
                    )
                })}
            </div>
        )}
    </main>
  );
}
