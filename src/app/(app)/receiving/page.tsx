
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Loader2, Truck, Warehouse, PackageCheck, ArrowRight, Hourglass } from 'lucide-react';
import type { Quote, QuoteStatus } from '@/lib/types';
import { GlobalSearch } from '@/components/GlobalSearch';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/api-client';
import { PremiumNavigationCard } from '@/components/PremiumNavigationCard';


const receivingStatuses: QuoteStatus[] = ['Aguardando Recebimento', 'No Galpão', 'Em Carregamento', 'Em Rota', 'Entregue'];

const statusToSlug = (status: QuoteStatus): string => {
    switch (status) {
        case 'Aguardando Recebimento': return 'awaiting-receipt';
        case 'No Galpão': return 'in-warehouse';
        case 'Aguardando Saída': return 'loading'; // Bipagem de saída é centralizada em /receiving/loading
        case 'Em Rota': return 'dispatched';
        case 'Entregue': return 'dispatched';
        case 'Finalizado': return 'dispatched';
        case 'Em Carregamento': return 'loading';
        default: return status.toLowerCase().replace(/\s+/g, '-');
    }
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
    let slug = statusToSlug(quote.status);
    const quoteCode = quote.quoteCode || '';
    // 'loading' vai para /receiving/loading com o quoteCode para destacar a cotação
    // 'dispatched' vai para /receiving/status/dispatched sem filtro de quoteCode (lista geral)
    const href = slug === 'loading'
        ? `/receiving/loading?quoteCode=${encodeURIComponent(quoteCode)}`
        : slug === 'dispatched'
            ? `/receiving/status/dispatched`
            : `/receiving/status/${slug}?quoteCode=${encodeURIComponent(quoteCode)}`;
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

export default function ReceivingDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [stats, setStats] = useState<Record<string, { quoteCount: number }>>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
        const response = await authFetch('/api/dashboard/stats');
        if (!response.ok) throw new Error("Failed to fetch receiving stats.");
        setStats(await response.json());
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Erro de Carregamento', description: e.message });
    } finally {
        setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!authLoading) {
        fetchStats();
    }
  }, [fetchStats, authLoading]);
  
  const statusDetails = {
    'awaiting-receipt': { 
        icon: <Hourglass className="h-8 w-8 text-primary" />, 
        title: 'Aguardando Recebimento',
        description: "Cargas a caminho do galpão, aguardando confirmação de recebimento.", 
        href: "/receiving/status/awaiting-receipt",
        count: stats['Aguardando Recebimento']?.quoteCount || 0
    },
    'in-warehouse': { 
        icon: <Warehouse className="h-8 w-8 text-primary" />, 
        title: 'No Galpão',
        description: "Cargas no galpão que precisam ser despachadas ou adicionadas a um romaneio.", 
        href: "/receiving/status/in-warehouse",
        count: stats['No Galpão']?.quoteCount || 0
    },
    'loading': { 
        icon: <Truck className="h-8 w-8 text-blue-500 animate-pulse" />, 
        title: 'Gerenciar Carregamento',
        description: "Gerencie romaneios pendentes e confirme o carregamento dos volumes.", 
        href: "/receiving/loading",
        count: 0 // This status is transient and part of "No Galpão"
    },
    'dispatched': { 
        icon: <PackageCheck className="h-8 w-8 text-primary" />, 
        title: 'Saídas Recentes',
        description: "Histórico de cargas que já saíram do galpão.", 
        href: "/receiving/status/dispatched",
        count: (stats['Em Rota']?.quoteCount || 0) + (stats['Entregue']?.quoteCount || 0) + (stats['Finalizado']?.quoteCount || 0)
    },
  };
  
  if (authLoading || !user) {
    return (
        <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

    return (
        <main className="container mx-auto p-4 md:p-8">
            <div className="relative isolate mb-8">
                <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
                    <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-primary to-primary/30 opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
                </div>
                
                <div className="space-y-4">

                    <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl text-foreground">
                        Área de <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/60">Recebimento</span>
                    </h1>
                    <p className="text-xl text-muted-foreground max-w-2xl">
                        Gerencie a entrada de mercadorias no galpão, importe notas fiscais eletrônicas e organize os romaneios de saída com eficiência.
                    </p>
                </div>
                
                <div className="mt-8">
                    <GlobalSearch<Quote>
                        placeholder="Buscar por remetente, destino, nº cotação ou chave da NF-e..."
                        availableStatusFilters={receivingStatuses}
                        basePath="/receiving"
                        apiPath="/api/search"
                        renderResult={renderQuoteResult}
                        onResultClick={handleQuoteResultClick}
                    />
                </div>
            </div>
            
            {isLoading ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {Array.from({ length: 4 }).map((_, index) => <CardSkeleton key={index} />)}
                </div>
            ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {Object.values(statusDetails).map((details) => (
                        <PremiumNavigationCard
                            key={details.title}
                            title={details.title}
                            description={details.description}
                            href={details.href}
                            icon={details.icon}
                            badgeCount={details.title !== 'Gerenciar Carregamento' ? details.count : undefined}
                            badgeText="Cargas"
                        />
                    ))}
                </div>
            )}
        </main>
    );
}
