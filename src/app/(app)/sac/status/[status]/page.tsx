
"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  Search,
} from 'lucide-react';
import type { Quote, QuoteStatus, Driver, OperationalEvent, User, QuotePriority, Occurrence, OccurrenceType } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/api-client';
import { QuoteCard } from '@/components/QuoteCard';
import { v4 as uuidv4 } from 'uuid';

const statusLabelMap: Record<string, string> = {
    'coleta': 'Coleta',
    'no-galpao': 'No Galpão',
    'em-rota': 'Em Rota',
    'entregue': 'Entregue',
    'finalizado': 'Finalizado'
};

export default function SACStatusDetailPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const { toast } = useToast();
    
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [occurrenceTypes, setOccurrenceTypes] = useState<OccurrenceType[]>([]);
    const [isDataLoading, setIsDataLoading] = useState(true);

    const statusParam = Array.isArray(params.status) ? params.status[0] : params.status;
    const currentStatus = statusLabelMap[statusParam] as QuoteStatus;

    const [filter, setFilter] = useState('');
    const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
    const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
    const [isObsDialogOpen, setIsObsDialogOpen] = useState(false);
    const [isOccurrencesOpen, setIsOccurrencesOpen] = useState(false);
    const [isAddressDialogOpen, setIsAddressDialogOpen] = useState(false);

    const fetchAllData = useCallback(async () => {
        setIsDataLoading(true);
        try {
            const [quotesRes, driversRes, occurrencesRes] = await Promise.all([
                authFetch('/api/quotes?limit=10000'),
                authFetch('/api/drivers?limit=10000'),
                authFetch('/api/occurrences'),
            ]);

            if (!quotesRes.ok || !driversRes.ok || !occurrencesRes.ok) {
                throw new Error("Falha ao carregar dados do SAC.");
            }

            setQuotes(await quotesRes.json());
            setDrivers(await driversRes.json());
            setOccurrenceTypes(await occurrencesRes.json());

        } catch (e: any) {
            toast({ variant: 'destructive', title: "Erro de Carregamento", description: e.message });
        } finally {
            setIsDataLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        if (!authLoading && user?.sacAccess) {
            fetchAllData();
        }
    }, [user, authLoading, fetchAllData]);


    useEffect(() => {
        if (!authLoading && !user?.sacAccess) {
            router.push('/dashboard');
        }
    }, [user, authLoading, router]);

    const filteredQuotes = useMemo(() => {
        if (!quotes) return [];
        let relevantQuotes = quotes.filter(q => {
             if (currentStatus === 'Coleta') {
                return ['Fechada', 'Coleta', 'Aguardando Recebimento'].includes(q.status);
            }
            if (currentStatus === 'No Galpão') {
                return ['No Galpão', 'Aguardando Saída', 'Em Carregamento'].includes(q.status);
            }
            return q.status === currentStatus;
        });

        if (!filter) return relevantQuotes;
        const lowercasedFilter = filter.toLowerCase();

        return relevantQuotes.filter(quote =>
            (quote.remetente?.toLowerCase().includes(lowercasedFilter)) ||
            (quote.cidadeDestino?.toLowerCase().includes(lowercasedFilter)) ||
            (quote.quoteCode && quote.quoteCode.toLowerCase().includes(lowercasedFilter)) ||
            (quote.nfNumber && quote.nfNumber.toLowerCase().includes(lowercasedFilter))
        );
    }, [quotes, currentStatus, filter]);
    
    const handleOpenDialog = (quote: Quote, dialogSetter: React.Dispatch<React.SetStateAction<boolean>>) => {
        setSelectedQuote(quote);
        dialogSetter(true);
    };
    
    const handleCloseDialog = (dialogSetter: React.Dispatch<React.SetStateAction<boolean>>) => {
        dialogSetter(false);
        setTimeout(() => setSelectedQuote(null), 300);
    };
    
    const handleUpdate = async (quote: Quote, updates: Partial<Quote>, action: string, details: string) => {
        setIsSubmitting(true);
        const response = await authFetch(`/api/quotes/${quote.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...updates, history: [...(quote.history || []), { id: uuidv4(), timestamp: new Date().toISOString(), userId: user!.id, username: user!.username, action, details }] }),
        });
        if(response.ok) {
            toast({ title: 'Sucesso!', description: details });
            await fetchAllData();
            setIsObsDialogOpen(false);
            setIsAddressDialogOpen(false);
            setIsOccurrencesOpen(false);
        } else {
             toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível atualizar a cotação.' });
        }
        setIsSubmitting(false);
    };
    
    const handleAddOccurrence = (quote: Quote, occurrenceCode: string, notes: string) => {
        if (!user || !occurrenceCode.trim()) return;

        const occurrenceType = occurrenceTypes.find(ot => ot.code === occurrenceCode);
        if(!occurrenceType) return;
        
        const newOccurrence: Occurrence = {
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            author: user.username,
            code: occurrenceCode,
            description: occurrenceType.description,
            blocksOperation: occurrenceType.blocksOperation,
            notes: notes,
        };
        const newOccurrences = [...(quote.occurrences || []), newOccurrence];
        handleUpdate(quote, { occurrences: newOccurrences }, 'OCORRENCIA_ADICIONADA', `Nova ocorrência: "${occurrenceType.description}"`);
    };

    const handleSetPriority = (quote: Quote, priority: QuotePriority) => {
        handleUpdate(quote, { priority }, 'PRIORIDADE_ALTERADA', `Prioridade alterada para "${priority}"`);
    };

    if (authLoading || isDataLoading || !user) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <main className="container mx-auto p-4 md:p-8">
            <Button variant="outline" onClick={() => router.push('/sac')} className="mb-8">
                &larr; Voltar para o SAC
            </Button>
            <div className="space-y-4 mb-8">
                <h1 className="text-3xl font-bold text-primary">Acompanhamento: {currentStatus}</h1>
                 <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        placeholder="Filtrar por remetente, destino, nº cotação ou nº NF..."
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            {filteredQuotes.length > 0 ? (
                 <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredQuotes.map(quote => 
                        <QuoteCard 
                            key={quote.id}
                            quote={quote}
                            drivers={drivers}
                            currentUser={user}
                            isSac={true}
                            onOpenDetails={(q) => handleOpenDialog(q, setIsDetailsDialogOpen)}
                            onOpenHistory={(q) => handleOpenDialog(q, setIsHistoryDialogOpen)}
                            onOpenObs={(q) => handleOpenDialog(q, setIsObsDialogOpen)}
                            onOpenOccurrences={(q) => handleOpenDialog(q, setIsOccurrencesOpen)}
                            onOpenAddressDialog={(q) => handleOpenDialog(q, setIsAddressDialogOpen)}
                            onSetPriority={(p) => handleSetPriority(quote, p)}
                            isSubmitting={isSubmitting}
                        />
                    )}
                </div>
            ) : (
                <div className="text-center py-16 border-dashed border-2 rounded-lg">
                    <p className="text-muted-foreground">Nenhuma entrega encontrada neste status.</p>
                </div>
            )}
            
            <QuoteCard.DetailsDialog quote={selectedQuote} isOpen={isDetailsDialogOpen} onOpenChange={() => handleCloseDialog(setIsDetailsDialogOpen)} />
            <QuoteCard.HistoryDialog quote={selectedQuote} isOpen={isHistoryDialogOpen} onOpenChange={() => handleCloseDialog(setIsHistoryDialogOpen)} />
            <QuoteCard.ObservationsDialog quote={selectedQuote} isOpen={isObsDialogOpen} onOpenChange={() => handleCloseDialog(setIsObsDialogOpen)} onSubmit={handleUpdate} isSubmitting={isSubmitting} />
            <QuoteCard.OccurrencesDialog quote={selectedQuote} occurrenceTypes={occurrenceTypes} isOpen={isOccurrencesOpen} onOpenChange={() => handleCloseDialog(setIsOccurrencesOpen)} onSubmit={handleAddOccurrence} isSubmitting={isSubmitting} />
            <QuoteCard.AddressDialog quote={selectedQuote} isOpen={isAddressDialogOpen} onOpenChange={() => handleCloseDialog(setIsAddressDialogOpen)} onSubmit={handleUpdate} isSubmitting={isSubmitting} />
        </main>
    );
}
