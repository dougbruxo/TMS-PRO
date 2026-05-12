

"use client";

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Truck,
  Warehouse,
  PackageCheck,
  ArrowRight,
  Hourglass
} from 'lucide-react';
import type { Quote, QuoteStatus } from '@/lib/types';
import { GlobalSearch } from '@/components/GlobalSearch';
import { useToast } from '@/hooks/use-toast';


const receivingStatuses: QuoteStatus[] = ['Aguardando Recebimento', 'No Galpão', 'Em Carregamento', 'Em Rota', 'Entregue'];

const statusDetails: Record<string, { icon: React.ReactElement, title: string, description: string, href: string, count: (quotes: Quote[]) => number }> = {
    'awaiting-receipt': { 
        icon: <Hourglass className="h-8 w-8 text-primary" />, 
        title: 'Aguardando Recebimento',
        description: "Cargas a caminho do galpão, aguardando confirmação de recebimento.", 
        href: "/receiving/status/awaiting-receipt",
        count: (quotes) => quotes.filter(q => q.status === 'Aguardando Recebimento').length
    },
    'in-warehouse': { 
        icon: <Warehouse className="h-8 w-8 text-primary" />, 
        title: 'No Galpão',
        description: "Cargas no galpão que precisam ser despachadas ou adicionadas a um romaneio.", 
        href: "/receiving/status/in-warehouse",
        count: (quotes) => quotes.filter(q => q.status === 'No Galpão' || q.status === 'Aguardando Saída').length
    },
    'loading': { 
        icon: <Truck className="h-8 w-8 text-blue-500 animate-pulse" />, 
        title: 'Gerenciar Carregamento',
        description: "Gerencie romaneios pendentes e confirme o carregamento dos volumes.", 
        href: "/receiving/loading",
        count: (quotes) => quotes.filter(q => q.status === 'Em Carregamento').length
    },
    'dispatched': { 
        icon: <PackageCheck className="h-8 w-8 text-primary" />, 
        title: 'Saídas Recentes',
        description: "Histórico de cargas que já saíram do galpão.", 
        href: "/receiving/status/dispatched",
        count: (quotes) => quotes.filter(q => ['Em Rota', 'Entregue', 'Finalizado'].includes(q.status)).length
    },
};

const statusToSlug = (status: QuoteStatus): string => {
    switch (status) {
        case 'Aguardando Recebimento': return 'awaiting-receipt';
        case 'No Galpão': return 'in-warehouse';
        case 'Aguardando Saída': return 'in-warehouse';
        case 'Em Rota': return 'em-rota';
        case 'Entregue': return 'entregue';
        case 'Finalizado': return 'finalizado';
        case 'Coleta':
        case 'Fechada':
             return 'coleta';
        case 'Em Carregamento': return 'loading';
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
    let slug = statusToSlug(quote.status);
    if(slug === 'coleta') slug = 'awaiting-receipt'; // Redirect to a valid receiving page
    const href = slug === 'loading'
        ? `/receiving/loading`
        : `/receiving/status/${slug}`;
    router.push(href);
};


export default function ReceivingDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);

  const fetchQuotes = useCallback(async () => {
    setIsDataLoading(true);
    try {
        const response = await fetch('/api/quotes'); // Fetch all for stats
        if (!response.ok) throw new Error("Failed to fetch quotes.");
        setQuotes(await response.json());
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Erro de Carregamento', description: e.message });
    } finally {
        setIsDataLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);
  
  if (authLoading || !user || isDataLoading) {
    return (
        <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <main className="container mx-auto p-4 md:p-8">
        <div className="space-y-2 mb-8">
            <h1 className="text-3xl font-bold text-primary">Área de Recebimento</h1>
            <p className="text-muted-foreground">Gerencie o recebimento e a saída de cargas do galpão.</p>
            <GlobalSearch<Quote>
                placeholder="Buscar por remetente, destino, nº cotação ou NF..."
                availableStatusFilters={receivingStatuses}
                basePath="/receiving"
                apiPath="/api/search"
                renderResult={renderQuoteResult}
                onResultClick={handleQuoteResultClick}
            />
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Object.entries(statusDetails).map(([key, details]) => {
                const count = details.count(quotes);
                return (
                    <Link key={key} href={details.href} className="flex">
                        <Card className="flex flex-col w-full transition-all duration-300 hover:shadow-glow hover:-translate-y-1 hover:ring-2 hover:ring-primary">
                            <CardHeader className="flex-row items-center gap-4 space-y-0 pb-4">
                                {details.icon}
                                <div className="flex-grow">
                                    <CardTitle>{details.title}</CardTitle>
                                    <Badge variant="secondary" className="mt-1">
                                        {count} Cargas
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-grow">
                                <CardDescription>{details.description}</CardDescription>
                            </CardContent>
                        </Card>
                    </Link>
                )
            })}
        </div>
    </main>
  );
}
