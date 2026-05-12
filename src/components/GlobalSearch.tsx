
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { QuoteStatus } from '@/lib/types';
import { authFetch } from '@/lib/api-client';

interface GlobalSearchProps<T> {
    placeholder: string;
    availableStatusFilters: string[];
    basePath: string;
    apiPath: string;
    renderResult: (item: T) => React.ReactNode;
    onResultClick: (item: T, router: any) => void;
}

export function GlobalSearch<T extends { id: string }>({ 
    placeholder, 
    availableStatusFilters, 
    apiPath,
    renderResult,
    onResultClick
}: GlobalSearchProps<T>) {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('todos');
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<T[]>([]);
    const [isResultsOpen, setIsResultsOpen] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchTerm.trim()) {
            toast({ variant: 'destructive', title: 'Busca Inválida', description: 'Por favor, insira um termo para pesquisar.' });
            return;
        }

        setIsLoading(true);
        setResults([]);
        try {
            const params = new URLSearchParams({
                term: searchTerm.trim(),
                status: statusFilter,
            });
            const response = await authFetch(`${apiPath}?${params.toString()}`);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Erro ao realizar a busca.');
            }

            const data: T[] = await response.json();
            setResults(data);
            setIsResultsOpen(true);

            if (data.length === 0) {
                 toast({ title: 'Nenhum Resultado', description: 'Nenhuma despesa encontrada com os critérios informados.' });
            }

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro na Busca', description: error.message });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleResultClick = (item: T) => {
        onResultClick(item, router);
        setIsResultsOpen(false);
    }

    return (
        <div className="mt-6 p-4 border rounded-lg bg-card shadow-sm">
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative flex-grow w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder={placeholder}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-11"
                        disabled={isLoading}
                    />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter} disabled={isLoading}>
                    <SelectTrigger className="w-full sm:w-[180px] h-11">
                        <SelectValue placeholder="Filtrar por status..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todos">Todos Status</SelectItem>
                        {availableStatusFilters.map(status => (
                            <SelectItem key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button type="submit" className="w-full sm:w-auto h-11" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Search className="mr-2 h-5 w-5" />}
                    {isLoading ? 'Buscando...' : 'Buscar'}
                </Button>
            </form>

            <Dialog open={isResultsOpen} onOpenChange={setIsResultsOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Resultados da Busca</DialogTitle>
                        <DialogDescription>
                            Encontrados {results.length} resultados. Clique em um item para ser direcionado à página correspondente.
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh] mt-4">
                        <div className="space-y-4 pr-6">
                            {results.map(item => (
                                <div key={item.id} onClick={() => handleResultClick(item)} className="border rounded-lg p-4 cursor-pointer hover:bg-accent transition-colors">
                                    {renderResult(item)}
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </div>
    );
}
