
"use client";

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Route, Clock } from 'lucide-react';
import { useEffect, useState, useCallback, useMemo } from 'react';
import type { Quote, Company, RouteInfo } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/api-client';
import { RoutePlanner } from '@/components/RoutePlanner';
import dynamic from 'next/dynamic';
import type { LatLngExpression } from 'leaflet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const MapDisplay = dynamic(() => import('@/components/MapDisplayLeaflet'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-muted rounded-lg flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
});

const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes}min`;
    }
    return `${minutes} min`;
};

export default function RoutePlannerPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<Company[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const mapCenter: LatLngExpression = useMemo(() => [-14.235, -51.9253], []);

  const polylinePositions = useMemo(() => {
    return routeInfo?.geometry?.coordinates?.map(coord => [coord[1], coord[0]]) as LatLngExpression[] || [];
  }, [routeInfo]);

  const markerPositions = useMemo(() => {
    if (!routeInfo || !routeInfo.waypoints) return [];
    return routeInfo.waypoints.map(wp => ({
      position: [wp.location[1], wp.location[0]] as LatLngExpression,
      name: wp.name,
    }));
  }, [routeInfo]);

  const fetchData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const [quotesRes, customersRes] = await Promise.all([
        authFetch('/api/quotes?status=all_operational'),
        authFetch('/api/customers'),
      ]);
      
      if (!quotesRes.ok || !customersRes.ok) {
        throw new Error('Falha ao carregar dados para o planejador de rotas.');
      }
      
      setQuotes(await quotesRes.json());
      setCustomers(await customersRes.json());
      
    } catch(e: any) {
      toast({ variant: 'destructive', title: 'Erro de Carregamento', description: e.message });
    } finally {
      setIsLoadingData(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!authLoading && user?.operationalAccess) {
      fetchData();
    }
  }, [user, authLoading, fetchData]);

  useEffect(() => {
    if (!authLoading && !user?.operationalAccess) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);
  
  if (authLoading || isLoadingData || !user) {
    return (
      <main className="container mx-auto p-4 md:p-8">
        <div className="flex h-[80vh] items-center justify-center">
          <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
        </div>
      </main>
    );
  }
  
  return (
    <main className="container mx-auto p-4 md:p-8">
        <Button variant="outline" onClick={() => router.push('/dashboard')} className="mb-8">
          &larr; Voltar para a Página Inicial
        </Button>
        <div className="space-y-2 mb-8">
          <h1 className="text-3xl font-bold text-primary">Planejador de Rotas</h1>
          <p className="text-muted-foreground">
            Selecione cotações para adicionar ao trajeto ou insira endereços manualmente.
          </p>
        </div>

        {routeInfo && (
            <Card className="mb-8 animate-fade-in">
                <CardHeader>
                    <CardTitle>Resumo da Rota Calculada</CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                        <Route className="h-8 w-8 text-primary" />
                        <div>
                            <p className="text-sm text-muted-foreground">Distância Total</p>
                            <p className="text-2xl font-bold">{(routeInfo.distance / 1000).toFixed(1)} km</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                        <Clock className="h-8 w-8 text-primary" />
                        <div>
                            <p className="text-sm text-muted-foreground">Tempo Estimado</p>
                            <p className="text-2xl font-bold">{formatDuration(routeInfo.duration)}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="lg:col-span-1 space-y-8">
            <RoutePlanner 
              allQuotes={quotes} 
              allCustomers={customers} 
              onRouteCalculated={setRouteInfo}
            />
          </div>
          <div className="lg:col-span-1 h-full min-h-[600px]">
            {isClient && (
              <MapDisplay
                center={mapCenter}
                zoom={4}
                routeGeometry={polylinePositions}
                markers={markerPositions}
              />
            )}
          </div>
        </div>
    </main>
  );
}
