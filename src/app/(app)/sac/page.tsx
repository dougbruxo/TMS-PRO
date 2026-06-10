
"use client";

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Truck,
  Warehouse,
  Move,
  PackageCheck,
  CheckCircle,
  ArrowRight,
  Headset,
  Hourglass,
  AlertOctagon,
} from 'lucide-react';
import type { Quote, QuoteStatus } from '@/lib/types';
import { GlobalSearch } from '@/components/GlobalSearch';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/PageHeader';
import { PremiumNavigationCard } from '@/components/PremiumNavigationCard';


const sacStatuses: QuoteStatus[] = ['Coleta', 'No Galpão', 'Em Rota', 'Entregue', 'Finalizado'];

const statusDetails: Record<QuoteStatus, { icon: React.ReactElement, description: string, href: string }> = {
    'Aberta': { icon: <CheckCircle className="h-8 w-8 text-primary" />, description: "Cotações aprovadas e prontas para iniciar.", href: "/sac/status/aberta" },
    'Fechada': { icon: <CheckCircle className="h-8 w-8 text-primary" />, description: "Cotações fechadas, aguardando início da operação.", href: "/sac/status/fechada" },
    'Em Análise': { icon: <CheckCircle className="h-8 w-8 text-primary" />, description: "Cotações aguardando aprovação.", href: "/sac/status/em-analise" },
    'Coleta': { icon: <Truck className="h-8 w-8 text-primary" />, description: "Cargas aguardando ou em processo de coleta.", href: "/sac/status/coleta" },
    'No Galpão': { icon: <Warehouse className="h-8 w-8 text-primary" />, description: "Cargas no galpão, aguardando saída para entrega.", href: "/sac/status/no-galpao" },
    'Em Rota': { icon: <Move className="h-8 w-8 text-primary" />, description: "Cargas em trânsito para o destino final.", href: "/sac/status/em-rota" },
    'Entregue': { icon: <PackageCheck className="h-8 w-8 text-primary" />, description: "Cargas entregues, pendentes de finalização.", href: "/sac/status/entregue" },
    'Finalizado': { icon: <CheckCircle className="h-8 w-8 text-primary" />, description: "Operações concluídas e arquivadas.", href: "/sac/status/finalizado" },
    'Aguardando Recebimento': { icon: <Hourglass className="h-8 w-8 text-primary" />, description: "Aguardando confirmação de recebimento no galpão.", href: "/sac/status/coleta" },
    'Aguardando Saída': { icon: <Hourglass className="h-8 w-8 text-primary" />, description: "Aguardando confirmação de saída do galpão.", href: "/sac/status/no-galpao" },
    'Em Carregamento': { icon: <Truck className="h-8 w-8 text-primary" />, description: "Cargas sendo carregadas para rota.", href: "/receiving/loading" },
};

const statusToSlug = (status: QuoteStatus): string => {
    const mapping: Record<QuoteStatus, string> = {
        'Aberta': 'aberta',
        'Em Análise': 'em-analise',
        'Fechada': 'coleta',
        'Coleta': 'coleta',
        'Aguardando Recebimento': 'coleta',
        'No Galpão': 'no-galpao',
        'Aguardando Saída': 'no-galpao',
        'Em Rota': 'em-rota',
        'Entregue': 'entregue',
        'Finalizado': 'finalizado',
        'Em Carregamento': 'loading', // Special case handled in click handler
    };
    return mapping[status] || status.toLowerCase().replace(/\s+/g, '-');
};

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
    const href = slug === 'loading'
        ? `/receiving/loading` // Special redirection for this status
        : `/sac/status/${slug}`;
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

export default function SACPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Record<string, { quoteCount: number; withOccurrences: number }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
        const res = await authFetch('/api/dashboard/stats');
        if (!res.ok) throw new Error("Failed to fetch SAC stats");
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
    <main className="container mx-auto p-4 md:p-8">
        <PageHeader
            icon={<Headset className="h-4 w-4" />}
            badge="Atendimento ao Consumidor"
            titlePrefix="SAC -"
            titleHighlight="Atendimento"
            description="Acompanhe as entregas, gerencie ocorrências e prioridades."
        >
            <GlobalSearch<Quote>
                placeholder="Buscar por remetente, destino, nº cotação ou NF..."
                availableStatusFilters={sacStatuses}
                basePath="/sac"
                apiPath="/api/search"
                renderResult={renderQuoteResult}
                onResultClick={handleQuoteResultClick}
            />
        </PageHeader>
        
        {isLoading ? (
             <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 5 }).map((_, index) => <CardSkeleton key={index} />)}
            </div>
        ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sacStatuses.map(status => {
                    const data = stats[status] || { quoteCount: 0, withOccurrences: 0 };
                    const details = statusDetails[status];
                    return (
                        <PremiumNavigationCard
                            key={status}
                            title={status}
                            description={details.description}
                            href={details.href}
                            icon={details.icon}
                            badgeCount={data.quoteCount}
                            badgeText="Entregas"
                            pulsingBadgeCount={data.withOccurrences}
                        />
                    )
                })}
            </div>
        )}
    </main>
  );
}
