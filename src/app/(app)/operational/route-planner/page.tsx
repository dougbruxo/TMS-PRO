
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';

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
    <main className="container mx-auto p-4 md:p-8 relative overflow-hidden">
        {/* Efeitos de desfoque e brilho aurora neon atrás dos cards */}
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/15 rounded-full blur-[100px] pointer-events-none -z-10 animate-float-blur-1" />
        <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-purple-500/15 rounded-full blur-[120px] pointer-events-none -z-10 animate-float-blur-2" />

        <PageHeader
            icon={<Route className="h-4 w-4" />}
            badge="Trajetos"
            titlePrefix="Planejador de"
            titleHighlight="Rotas"
            description="Selecione cotações para adicionar ao trajeto ou insira endereços manualmente."
            backHref="/operational"
            backLabel="Voltar para Área Operacional"
        />

        {routeInfo && (
            <Card className="border border-border/40 bg-card/45 backdrop-blur-2xl shadow-xl rounded-2xl relative overflow-hidden p-6 hover:shadow-2xl transition-all duration-300 mb-8 animate-fade-in">
                <CardHeader className="p-0 pb-5">
                    <CardTitle className="text-xl font-bold">Resumo da Rota Calculada</CardTitle>
                    <CardDescription className="text-sm text-muted-foreground">Estatísticas detalhadas do trajeto gerado.</CardDescription>
                </CardHeader>
                <CardContent className="p-0 grid md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-4 p-4 bg-background/35 border border-border/20 backdrop-blur-md rounded-xl">
                        <Route className="h-8 w-8 text-primary" />
                        <div>
                            <p className="text-sm text-muted-foreground">Distância Total</p>
                            <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/80">{(routeInfo.distance / 1000).toFixed(1)} km</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 bg-background/35 border border-border/20 backdrop-blur-md rounded-xl">
                        <Clock className="h-8 w-8 text-primary" />
                        <div>
                            <p className="text-sm text-muted-foreground">Tempo Estimado</p>
                            <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/80">{formatDuration(routeInfo.duration)}</p>
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

        <style>{`
          @keyframes floatBlur1 {
            0%, 100% {
              transform: translate(0, 0) scale(1);
              background-color: hsl(var(--primary) / 0.15);
            }
            25% {
              transform: translate(120px, 60px) scale(1.15);
              background-color: rgba(99, 102, 241, 0.18);
            }
            50% {
              transform: translate(40px, 160px) scale(0.95);
              background-color: rgba(236, 72, 153, 0.14);
            }
            75% {
              transform: translate(-80px, 100px) scale(1.08);
              background-color: rgba(59, 130, 246, 0.18);
            }
          }

          @keyframes floatBlur2 {
            0%, 100% {
              transform: translate(0, 0) scale(1);
              background-color: rgba(168, 85, 247, 0.15);
            }
            33% {
              transform: translate(-100px, -120px) scale(1.1);
              background-color: rgba(59, 130, 246, 0.16);
            }
            66% {
              transform: translate(80px, -60px) scale(0.9);
              background-color: rgba(236, 72, 153, 0.14);
            }
          }

          .animate-float-blur-1 {
            animation: floatBlur1 28s infinite ease-in-out alternate !important;
          }

          .animate-float-blur-2 {
            animation: floatBlur2 38s infinite ease-in-out alternate !important;
          }
        `}</style>
    </main>
  );
}
