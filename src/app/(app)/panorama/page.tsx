"use client";

import { useMemo, useEffect, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { BackButton } from '@/components/BackButton';
import { useRouter } from 'next/navigation';
import type { Quote } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/api-client';
import dynamic from 'next/dynamic';
import { CityMarkerData } from '@/components/PanoramaMapLeaflet';

const PanoramaMapLeaflet = dynamic(() => import('@/components/PanoramaMapLeaflet'), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center bg-muted/50 rounded-lg"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
});

const sanitizeCity = (city: string): string => {
    if (!city) return '';
    return city.split('-')[0].trim(); // Extract just the city name roughly for display purposes if needed
}

export default function PanoramaPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [isDataLoading, setIsDataLoading] = useState(true);
    const [isMapLoading, setIsMapLoading] = useState(true);
    const [mapMarkers, setMapMarkers] = useState<CityMarkerData[]>([]);
    const [isDark, setIsDark] = useState(false);

    const fetchQuotes = useCallback(async () => {
        setIsDataLoading(true);
        try {
            const response = await authFetch('/api/quotes?limit=1000'); // Fetch all for stats
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

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsDark(document.documentElement.classList.contains('dark'));
            
            const observer = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    if (mutation.attributeName === 'class') {
                         setIsDark(document.documentElement.classList.contains('dark'));
                    }
                });
            });
            observer.observe(document.documentElement, { attributes: true });
            return () => observer.disconnect();
        }
    }, []);

    const processMapData = useCallback(async () => {
        if (quotes.length === 0) {
            setMapMarkers([]);
            setIsMapLoading(false);
            return;
        }

        setIsMapLoading(true);

        const cityData: Record<string, { coletas: number; entregas: number }> = {};

        quotes.forEach((quote) => {
            if (['Fechada', 'Coleta', 'Aguardando Recebimento'].includes(quote.status)) {
                const cidade = quote.cidadeOrigem?.trim();
                if (cidade) {
                    if (!cityData[cidade]) cityData[cidade] = { coletas: 0, entregas: 0 };
                    cityData[cidade].coletas++;
                }
            } else if (['No Galpão', 'Aguardando Saída', 'Em Carregamento'].includes(quote.status)) {
                 const cidade = quote.cidadeDestino?.trim();
                 if (cidade) {
                    if (!cityData[cidade]) cityData[cidade] = { coletas: 0, entregas: 0 };
                    cityData[cidade].entregas++;
                 }
            }
        });

        const uniqueCities = Object.keys(cityData);
        if (uniqueCities.length === 0) {
             setMapMarkers([]);
             setIsMapLoading(false);
             return;
        }

        try {
            // Ask our backend to geocode all cities (uses cache + nominatim fallback)
            const response = await authFetch('/api/location/bulk-geocode', {
                method: 'POST',
                body: JSON.stringify({ cities: uniqueCities })
            });

            if (!response.ok) throw new Error("Falha ao buscar coordenadas.");
            
            const coordsMap: Record<string, { lat: number; lng: number } | null> = await response.json();
            
            const newMarkers: CityMarkerData[] = [];
            uniqueCities.forEach(city => {
                const coords = coordsMap[city];
                if (coords && coords.lat && coords.lng) {
                    newMarkers.push({
                        city: sanitizeCity(city), // Simplify for display
                        position: [coords.lat, coords.lng],
                        coletas: cityData[city].coletas,
                        entregas: cityData[city].entregas
                    });
                }
            });

            setMapMarkers(newMarkers);
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Erro de Mapa', description: 'Não foi possível carregar as coordenadas para todas as cidades.' });
        } finally {
            setIsMapLoading(false);
        }

    }, [quotes, toast]);


    useEffect(() => {
        if (!isDataLoading) {
            processMapData();
        }
    }, [isDataLoading, processMapData]);

    const totals = useMemo(() => {
        let coletasCount = 0;
        let entregasCount = 0;
        quotes.forEach((quote) => {
            if (['Fechada', 'Coleta', 'Aguardando Recebimento'].includes(quote.status)) {
                coletasCount++;
            } else if (['No Galpão', 'Aguardando Saída', 'Em Carregamento'].includes(quote.status)) {
                entregasCount++;
            }
        });
        return { coletas: coletasCount, entregas: entregasCount };
    }, [quotes]);

    const handleMarkerClick = (city: string, action: 'coleta' | 'entrega') => {
        // Redireciona para as tabelas operacionais e idealmente poderia passar um filtro (query param) 
        // mas aqui vamos usar as rotas padrão pedidas.
        const path = action === 'coleta' ? '/operational/status/coleta' : '/operational/status/no-galpao';
        router.push(path);
    };

    if (isDataLoading) {
        return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }
    
    return (
        <div className="w-full flex flex-col h-[calc(100vh-4rem)] bg-background overflow-hidden text-sm">
            <div className="flex-none p-4 px-6 border-b bg-card">
                <div className="flex justify-between items-center flex-wrap gap-4">
                    <div className="flex items-center gap-6 flex-wrap">
                        <div>
                            <h1 className="text-xl font-bold text-primary whitespace-nowrap">Panorama Geográfico</h1>
                        </div>
                        <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                {totals.coletas} Coletas Disponíveis
                            </span>
                        </div>
                        <div className="flex items-center gap-2 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                            <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                                {totals.entregas} Entregas Disponíveis
                            </span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <BackButton href="/dashboard" label="Voltar para Dashboard" className="mb-0" />
                    </div>
                </div>
            </div>

            <div className="flex-grow w-full relative">
                 {isMapLoading && (
                    <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-background/50 rounded-lg backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-2">
                           <Loader2 className="h-8 w-8 animate-spin text-primary" />
                           <span className="text-sm font-medium">Buscando coordenadas geo-espaciais...</span>
                        </div>
                    </div>
                )}
                <PanoramaMapLeaflet 
                    markers={mapMarkers} 
                    onMarkerClick={handleMarkerClick}
                    isDark={isDark}
                />
            </div>
        </div>
    );
}
