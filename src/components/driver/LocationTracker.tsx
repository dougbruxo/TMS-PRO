"use client";

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { authFetch } from '@/lib/api-client';

const UPDATE_INTERVAL = 60000; // 60 segundos

export function LocationTracker() {
  const { user } = useAuth();
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastUpdateTime = useRef<number>(0);
  const watchId = useRef<number | null>(null);

  useEffect(() => {
    if (!user || user.role !== 'driver') return;
    if (!navigator.geolocation) {
      setError('Geolocalização não é suportada neste navegador.');
      return;
    }

    const handleSuccess = (position: GeolocationPosition) => {
      setIsTracking(true);
      setError(null);

      const now = Date.now();
      if (now - lastUpdateTime.current < UPDATE_INTERVAL) {
        return; // Acelera as atualizações
      }
      lastUpdateTime.current = now;

      const { latitude, longitude } = position.coords;
      
      authFetch('/api/driver-portal/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: user.id, latitude, longitude }),
      }).catch(err => {
        console.error("Falha ao enviar atualização de localização:", err);
      });
    };

    const handleError = (error: GeolocationPositionError) => {
      setIsTracking(false);
      switch (error.code) {
        case error.PERMISSION_DENIED:
          setError("Permissão de localização negada.");
          break;
        case error.POSITION_UNAVAILABLE:
          setError("Localização indisponível.");
          break;
        case error.TIMEOUT:
          setError("Tempo esgotado para obter localização.");
          break;
        default:
          setError("Erro desconhecido de localização.");
          break;
      }
    };

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    };

    watchId.current = navigator.geolocation.watchPosition(handleSuccess, handleError, options);

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, [user]);

  if (!user || user.role !== 'driver') {
    return null;
  }
  
  return (
    <div className="fixed bottom-4 right-4 z-50">
      {error ? (
         <Badge variant="destructive" className="p-2">
           <WifiOff className="mr-2 h-4 w-4" />
           {error}
         </Badge>
      ) : isTracking ? (
        <Badge variant="secondary" className="p-2 bg-green-100 dark:bg-green-900 border-green-500/50 text-green-700 dark:text-green-300">
           <Wifi className="mr-2 h-4 w-4 animate-pulse" />
           Rastreamento ativo
         </Badge>
      ) : (
         <Badge variant="secondary" className="p-2">
           <Loader2 className="mr-2 h-4 w-4 animate-spin" />
           A iniciar rastreamento...
         </Badge>
      )}
    </div>
  );
}
