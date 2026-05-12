
"use client";

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Search, Loader2 } from 'lucide-react';
import { printQuote } from '@/lib/print';
import type { Quote } from '@/lib/types';


interface QuoteLookupFormProps {
    onLookup: (code: string) => Promise<Quote | null>;
}

export function QuoteLookupForm({ onLookup }: QuoteLookupFormProps) {
    const [quoteNumber, setQuoteNumber] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleLookup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!quoteNumber) {
            toast({ variant: 'destructive', title: 'Código Inválido', description: 'Por favor, insira um número de cotação válido.' });
            return;
        }

        setIsLoading(true);
        
        const foundQuote = await onLookup(quoteNumber);
        
        if (foundQuote) {
            await printQuote(foundQuote);
        } else {
            toast({ variant: 'destructive', title: 'Não Encontrada', description: 'Nenhuma cotação encontrada com este código.' });
        }

        setIsLoading(false);
    };

    return (
        <form onSubmit={handleLookup} className="flex w-full items-center space-x-2">
            <div className="relative flex-grow">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    type="text"
                    placeholder="Número da cotação"
                    value={quoteNumber}
                    onChange={(e) => setQuoteNumber(e.target.value.toUpperCase().replace(/\s/g, ''))}
                    className="pl-10"
                    disabled={isLoading}
                />
            </div>
            <Button type="submit" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isLoading ? 'Buscando...' : 'Consultar'}
            </Button>
        </form>
    );
}
