
"use client";

import { useState, useCallback, ChangeEvent, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, PlusCircle, Trash2, Map, AlertTriangle, Route, Warehouse, X, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/use-auth';
import type { Quote, Company, RouteInfo } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Checkbox } from './ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from './ui/tooltip';
import { cn } from '@/lib/utils';
import { optimizeStops, type Stop } from "@/lib/vrp/optimizeStops";
import { Switch } from './ui/switch';
import { ShoppingBasket, Building2, CalendarIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Waypoint {
  id: number;
  address: string;
  quote?: Quote;
  customer?: Company;
  isClosed?: boolean;
}

interface RoutePlannerProps {
  allQuotes: Quote[];
  allCustomers: Company[];
  onRouteCalculated: (routeInfo: RouteInfo | null) => void;
}

const sanitizeAddress = (address: string): string => {
    if (!address) return '';
    let sanitized = address
        .replace(/CIDADE INDUSTRIAL SATELITE DE SAO PAULO/gi, '')
        .replace(/FUNDOSFUNDOS/gi, '')
        .replace(/, andar \d+/i, '')
        .replace(/, sala \d+/i, '')
        .replace(/, bl \w+/i, '')
        .replace(/RUA, /gi, 'RUA ');

    sanitized = sanitized.replace(/,+/g, ',').replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ').trim();
    sanitized = sanitized.replace(/,$/, '').replace(/^,/, '').trim();
    return sanitized;
};

export function RoutePlanner({ allQuotes, allCustomers, onRouteCalculated }: RoutePlannerProps) {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { companyProfile } = useAuth();
  
  const [showOrigin, setShowOrigin] = useState(true);
  const [showDestination, setShowDestination] = useState(true);

  const [plannedDate, setPlannedDate] = useState<Date | undefined>(new Date());
  const [optimizeRoute, setOptimizeRoute] = useState(true);

  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
  const [selectedDeliveryIds, setSelectedDeliveryIds] = useState<string[]>([]);
  
  const [addressErrors, setAddressErrors] = useState<{ origin?: boolean; destination?: boolean; waypoints?: number[] }>({});


  useEffect(() => {
    if (companyProfile) {
      const fullAddress = `${companyProfile.endereco}, ${companyProfile.cidade}, ${companyProfile.estado}`;
      if (showOrigin && !origin) setOrigin(fullAddress);
      if (showDestination && !destination) setDestination(fullAddress);
    }
  }, [companyProfile, origin, destination, showOrigin, showDestination]);

  const collectionQuotes = useMemo(() => allQuotes.filter(q => ['Fechada', 'Coleta', 'Aguardando Recebimento'].includes(q.status)), [allQuotes]);
  const deliveryQuotes = useMemo(() => allQuotes.filter(q => ['No Galpão', 'Aguardando Saída', 'Em Carregamento'].includes(q.status)), [allQuotes]);

  const handleAddWaypoint = () => {
    setWaypoints([...waypoints, { id: Date.now(), address: '', quote: undefined, customer: undefined }]);
  };

  const handleRemoveWaypoint = (id: number) => {
    setWaypoints(waypoints.filter(wp => wp.id !== id));
  };

  const handleWaypointChange = (id: number, value: string) => {
    setWaypoints(waypoints.map(wp => (wp.id === id ? { ...wp, address: value } : wp)));
  };
  
  const getCoords = async (address: string): Promise<{ lat: number, lng: number } | null> => {
    const cleanedAddress = sanitizeAddress(address);
    if (!cleanedAddress) return null;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanedAddress)}&format=json&limit=1&countrycodes=br`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.length > 0 ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : null;
    } catch (error) {
      return null;
    }
  };

  const handleCalculateRoute = async () => {
    setIsLoading(true);
    onRouteCalculated(null);
    setAddressErrors({});

    try {
        const stopsToProcess: { type: 'origin' | 'destination' | 'waypoint', address: string, id: number, name: string }[] = [];

        if (origin && origin.trim() !== '') {
            stopsToProcess.push({ type: 'origin', address: origin, id: -1, name: "Ponto de Partida" });
        }

        waypoints.forEach((wp, i) => {
            stopsToProcess.push({ type: 'waypoint', address: wp.address, id: wp.id, name: wp.quote?.quoteCode || wp.customer?.razaoSocial || `Parada ${i + 1}` });
        });

        if (destination && destination.trim() !== '') {
            stopsToProcess.push({ type: 'destination', address: destination, id: -2, name: "Destino Final" });
        }

        if (stopsToProcess.length < 2) {
            throw new Error("São necessários pelo menos dois pontos (origem, destino ou paradas) para calcular uma rota.");
        }

        const coordResults: ({ lat: number; lng: number } | null)[] = [];
        for (const info of stopsToProcess) {
          // A small delay to avoid hitting API rate limits
          await new Promise(resolve => setTimeout(resolve, 250));
          const coords = await getCoords(info.address);
          coordResults.push(coords);
        }

        const errors: { origin?: boolean; destination?: boolean; waypoints?: number[] } = {};
        let stopsWithCoords: Stop[] = [];
        const errorMessages: string[] = [];

        coordResults.forEach((coords, index) => {
            const stopInfo = stopsToProcess[index];
            if (coords) {
                stopsWithCoords.push({ id: String(stopInfo.id), name: stopInfo.name, ...coords });
            } else {
                if (stopInfo.type === 'origin') {
                    errors.origin = true;
                } else if (stopInfo.type === 'destination') {
                    errors.destination = true;
                } else if (stopInfo.type === 'waypoint') {
                    if (!errors.waypoints) errors.waypoints = [];
                    errors.waypoints.push(stopInfo.id);
                }
                errorMessages.push(`"${stopInfo.name}"`);
            }
        });

        if (errorMessages.length > 0) {
            setAddressErrors(errors);
            throw new Error(`Não foi possível encontrar coordenadas para: ${errorMessages.join(', ')}. Verifique os endereços.`);
        }
        
        let finalSequence = stopsWithCoords;
        if (optimizeRoute && stopsWithCoords.length > 2) {
            const startNode = stopsWithCoords[0];
            const endNode = stopsWithCoords[stopsWithCoords.length - 1];
            const intermediateStops = stopsWithCoords.slice(1, -1);
            
            if (intermediateStops.length > 0) {
              const optimizedIntermediate = optimizeStops(intermediateStops, startNode);
              finalSequence = [startNode, ...optimizedIntermediate, endNode];
              toast({ title: 'Rota Otimizada!', description: 'A sequência de paradas foi ajustada para a menor distância.' });
            }
        }

        const osrmCoords = finalSequence.map(s => `${s.lng},${s.lat}`).join(';');
        const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${osrmCoords}?overview=full&geometries=geojson`);
        
        if (!response.ok) throw new Error('Serviço de roteamento indisponível.');
        
        const data = await response.json();
        
        if (data.routes && data.routes.length > 0) {
            const { distance, duration, geometry } = data.routes[0];
            const routeWaypoints = finalSequence.map(stop => ({
                name: stop.name,
                location: [stop.lng, stop.lat] as [number, number]
            }));
            onRouteCalculated({ distance, duration, geometry, waypoints: routeWaypoints });
        } else {
            throw new Error('Não foi possível encontrar uma rota entre os pontos fornecidos.');
        }

    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro ao Calcular Rota', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };


  const checkIsClosed = (openingHours: string | undefined, date: Date): boolean => {
    if (!openingHours) return false; // Assume open if no data
    const dayOfWeekMap = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
    const dayShort = dayOfWeekMap[date.getDay()];
    return !openingHours.includes(dayShort + ':');
  };
  
  const handleAddSelectedToRoute = () => {
    if (!plannedDate) {
      toast({ variant: 'destructive', title: 'Data não selecionada', description: 'Por favor, selecione um dia para a rota.' });
      return;
    }
    const quotesToAdd = allQuotes.filter(q => 
        selectedCollectionIds.includes(q.id) || selectedDeliveryIds.includes(q.id)
    );

    const newWaypoints: Waypoint[] = quotesToAdd.map(q => {
        const isCollection = ['Fechada', 'Coleta', 'Aguardando Recebimento'].includes(q.status);
        const address = isCollection ? (q.enderecoColeta || q.cidadeOrigem) : (q.enderecoEntrega || q.cidadeDestino);
        
        const entityNameToMatch = (isCollection ? q.remetente : (q.destinatario || q.empresaDestino))?.toLowerCase().trim();
        
        const customer = allCustomers.find(c => {
            if (!c.razaoSocial || !entityNameToMatch) return false;
            const razaoSocial = c.razaoSocial.toLowerCase().trim();
            const nomeFantasia = c.nomeFantasia?.toLowerCase().trim();
            return (razaoSocial === entityNameToMatch || (nomeFantasia && nomeFantasia === entityNameToMatch));
        });

        const isClosedOnPlannedDate = checkIsClosed(customer?.openingHours, plannedDate);
        
        return {
            id: Date.now() + Math.random(),
            address,
            quote: q,
            customer: customer,
            isClosed: isClosedOnPlannedDate,
        };
    });

    setWaypoints(prev => [...prev, ...newWaypoints]);
    setSelectedCollectionIds([]);
    setSelectedDeliveryIds([]);
    toast({ title: 'Sucesso!', description: `${quotesToAdd.length} paradas adicionadas à rota.`})
  };

  const QuoteList = ({ quotes, selectedIds, onSelectionChange }: { quotes: Quote[], selectedIds: string[], onSelectionChange: (ids: string[]) => void }) => (
    <ScrollArea className="h-64 border rounded-md p-2">
      {quotes.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground p-4">Nenhuma cotação nesta etapa.</p>
      ) : (
        <div className="space-y-2">
          {quotes.map(q => (
            <div key={q.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted">
              <Checkbox 
                id={q.id}
                checked={selectedIds.includes(q.id)}
                onCheckedChange={(checked) => {
                  onSelectionChange(checked ? [...selectedIds, q.id] : selectedIds.filter(id => id !== q.id));
                }}
              />
              <label htmlFor={q.id} className="text-sm font-medium leading-none cursor-pointer flex-grow">
                {q.quoteCode} - {['No Galpão', 'Aguardando Saída', 'Em Carregamento'].includes(q.status) ? q.destinatario : q.remetente} ({['No Galpão', 'Aguardando Saída', 'Em Carregamento'].includes(q.status) ? q.cidadeDestino : q.cidadeOrigem})
              </label>
            </div>
          ))}
        </div>
      )}
    </ScrollArea>
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>1. Definir Trajeto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="date">Data da Rota</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={"outline"} className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {plannedDate ? format(plannedDate, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={plannedDate} onSelect={setPlannedDate} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
          
          {showOrigin ? (
            <div className="space-y-2">
              <Label htmlFor="origin">Origem</Label>
              <div className="relative">
                  <Warehouse className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                      id="origin"
                      placeholder="Endereço de partida"
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value)}
                      className={cn("pl-10", addressErrors.origin && "border-destructive focus-visible:ring-destructive")}
                  />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2" onClick={() => { setOrigin(''); setShowOrigin(false); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
              </div>
            </div>
          ) : (
             <Button variant="outline" className="w-full" onClick={() => setShowOrigin(true)}>
                <Plus className="mr-2 h-4 w-4" /> Adicionar Ponto de Partida
             </Button>
          )}

          {waypoints.map((waypoint, index) => (
            <div key={waypoint.id} className="flex items-end gap-2">
              <div className="flex-grow space-y-2">
                 <Label htmlFor={`waypoint-${index}`}>Parada ${index + 1} {waypoint.quote?.quoteCode && <Badge variant="secondary">{waypoint.quote.quoteCode}</Badge>}</Label>
                 <div className="flex items-center gap-2">
                  <Input id={`waypoint-${index}`} placeholder="Endereço da parada" value={waypoint.address} onChange={(e) => handleWaypointChange(waypoint.id, e.target.value)} className={cn(addressErrors.waypoints?.includes(waypoint.id) && "border-destructive focus-visible:ring-destructive")} />
                  {waypoint.isClosed && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Atenção: A empresa pode estar fechada no dia selecionado.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                 {waypoint.customer?.openingHours && <p className="text-xs text-muted-foreground">Horário: {waypoint.customer.openingHours}</p>}
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleRemoveWaypoint(waypoint.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button variant="outline" className="w-full" onClick={handleAddWaypoint}>
            <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Parada Manual
          </Button>
          
           {showDestination ? (
            <div className="space-y-2">
              <Label htmlFor="destination">Destino</Label>
              <div className="relative">
                  <Warehouse className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                      id="destination"
                      placeholder="Endereço final"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      className={cn("pl-10", addressErrors.destination && "border-destructive focus-visible:ring-destructive")}
                  />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2" onClick={() => { setDestination(''); setShowDestination(false); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
              </div>
            </div>
           ) : (
            <Button variant="outline" className="w-full" onClick={() => setShowDestination(true)}>
                <Plus className="mr-2 h-4 w-4" /> Adicionar Destino Final
            </Button>
          )}

          <Separator />
           <div className="flex items-center space-x-2 pt-2">
            <Switch id="optimize-route" checked={optimizeRoute} onCheckedChange={setOptimizeRoute} />
            <Label htmlFor="optimize-route">Otimizar sequência de paradas</Label>
          </div>
          <Button className="w-full" onClick={handleCalculateRoute} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Route className="mr-2 h-4 w-4" />}
            Calcular Rota
          </Button>
        </CardContent>
      </Card>
      
      <Card className="mt-8">
          <CardHeader>
              <CardTitle>2. Adicionar Paradas (Opcional)</CardTitle>
              <CardDescription>Selecione coletas ou entregas pendentes para adicionar ao seu trajeto.</CardDescription>
          </CardHeader>
          <CardContent>
               <Tabs defaultValue="collections">
                  <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="collections"><ShoppingBasket className="mr-2 h-4 w-4"/>Coletas ({collectionQuotes.length})</TabsTrigger>
                      <TabsTrigger value="deliveries"><Building2 className="mr-2 h-4 w-4"/>Entregas ({deliveryQuotes.length})</TabsTrigger>
                  </TabsList>
                  <TabsContent value="collections" className="mt-4">
                      <QuoteList quotes={collectionQuotes} selectedIds={selectedCollectionIds} onSelectionChange={setSelectedCollectionIds} />
                  </TabsContent>
                  <TabsContent value="deliveries" className="mt-4">
                      <QuoteList quotes={deliveryQuotes} selectedIds={selectedDeliveryIds} onSelectionChange={setSelectedDeliveryIds} />
                  </TabsContent>
              </Tabs>
              <Button className="w-full mt-4" onClick={handleAddSelectedToRoute} disabled={selectedCollectionIds.length === 0 && selectedDeliveryIds.length === 0}>
                  Adicionar Selecionados à Rota
              </Button>
          </CardContent>
      </Card>
    </>
  );
}
