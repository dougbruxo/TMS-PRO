import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';

/**
 * Normaliza strings para comparação e indexação
 */
function normalizeString(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch com hard timeout via AbortController.
 * Se a requisição não completar em `timeoutMs`, é cancelada imediatamente.
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 3000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}



// ─── Nominatim Throttle ──────────────────────────────────────────────────────
let lastNominatimCall = 0;

async function getCoords(city: string) {
  if (!city) return null;
  const normalizedCity = normalizeString(city);
  
  const { db } = await connectToDatabase();
  const geoCache = db.collection('geo_cache');
  
  // 1. Cache hit = instantâneo
  const cached = await geoCache.findOne({ city: normalizedCity });
  if (cached) return cached.coords;
  
  // 2. Throttle: Nominatim exige max 1 req/sec
  const now = Date.now();
  const timeSinceLastCall = now - lastNominatimCall;
  if (timeSinceLastCall < 1100) {
    await sleep(1100 - timeSinceLastCall);
  }
  lastNominatimCall = Date.now();

  try {
    // Force check in Brazil to avoid finding cities with same name in other countries (e.g., Serra, Spain)
    const searchQuery = city.toLowerCase().includes('brasil') ? city : `${city}, Brasil`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1&countrycodes=br`;
    const response = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'DezLog-App-Phoenix/1.0 (contato@dezlog.com)'
      }
    }, 5000); // 5s timeout para geocoding

    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.length > 0) {
      const coords = `${data[0].lon},${data[0].lat}`;
      await geoCache.updateOne(
        { city: normalizedCity },
        { $set: { coords, updatedAt: new Date().toISOString() } },
        { upsert: true }
      );
      return coords;
    }
    return null;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn(`[Location API] Timeout de 5s ao buscar coordenadas para: ${city}`);
    } else {
      console.error(`[Location API] Erro ao buscar coordenadas para ${city}:`, error.message);
    }
    return null;
  }
}

/**
 * Calcula a distância em linha reta (Haversine) e estima a distância rodoviária.
 */
function calculateHaversineFallback(originCoords: string, destCoords: string): number {
  const [lon1, lat1] = originCoords.split(',').map(Number);
  const [lon2, lat2] = destCoords.split(',').map(Number);
  
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const straightLine = R * c;
  
  // Fator de tortuosidade: 1.35x para rodovias brasileiras
  return straightLine * 1.35;
}

export async function POST(request: Request) {
  const startTime = Date.now();
  
  try {
    const { origin, destination } = await request.json();
    
    if (!origin || !destination) {
      return NextResponse.json({ message: 'Origem e destino são obrigatórios.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const routeCache = db.collection('route_cache');
    
    const normalizedOrigin = normalizeString(origin);
    const normalizedDest = normalizeString(destination);
    const routeId = `${normalizedOrigin}_${normalizedDest}`;

    // ═══ ETAPA 1: Cache (< 10ms) ═══
    const cachedRoute = await routeCache.findOne({ routeId });
    if (cachedRoute) {
      console.log(`[Location API] Cache HIT para ${routeId} (${Date.now() - startTime}ms)`);
      return NextResponse.json(cachedRoute.data);
    }

    // ═══ ETAPA 2: Geocoding (buscar coordenadas) ═══
    const originCoords = await getCoords(origin);
    const destCoords = await getCoords(destination);

    if (!originCoords || !destCoords) {
      return NextResponse.json({ 
        message: 'Não foi possível encontrar as coordenadas. Verifique os nomes das cidades.' 
      }, { status: 404 });
    }

    console.log(`[Location API] Coordenadas obtidas em ${Date.now() - startTime}ms`);

    // ═══ ETAPA 3: Roteamento (OpenRouteService + Fallback Haversine) ═══
    let result: { distance: number; includesFerry: boolean; isFallback?: boolean };
    const apiKey = process.env.ORS_API_KEY;

    if (!apiKey) {
      console.warn(`[Location API] Chave ORS_API_KEY ausente. Usando estimativa geográfica (Haversine).`);
      result = {
        distance: calculateHaversineFallback(originCoords, destCoords),
        includesFerry: false,
        isFallback: true
      };
    } else {
      try {
        const orsUrl = 'https://api.openrouteservice.org/v2/directions/driving-hgv';
        const [originLon, originLat] = originCoords.split(',').map(Number);
        const [destLon, destLat] = destCoords.split(',').map(Number);
        
        const body = {
            coordinates: [
                [originLon, originLat],
                [destLon, destLat]
            ]
        };

        const config = {
            method: 'POST',
            headers: {
                'Authorization': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        };

        const response = await fetchWithTimeout(orsUrl, config, 6000);
        
        if (!response.ok) {
            const errData = await response.text();
            throw new Error(`ORS status: ${response.status} - ${errData}`);
        }
        
        const data = await response.json();
        if (!data.routes || data.routes.length === 0) throw new Error('Sem rotas terrestres viáveis encontradas pela ORS');
        
        const route = data.routes[0];
        
        // Em ORS v2 parameters, para checar balsa seria via extras (tollways/ferries) - abstraindo para simplificar.
        result = {
          distance: route.summary.distance / 1000,
          includesFerry: false, // Pode ser inferido das steps se necessário no futuro
        };
        
        console.log(`[Location API] Rota ORS OK: ${result.distance.toFixed(1)}km (${Date.now() - startTime}ms total)`);
        
      } catch (error: any) {
        console.warn(`[Location API] ORS falhou detalhe (${error.message}). Ativando fallback geográfico (Haversine).`);
        
        result = {
          distance: calculateHaversineFallback(originCoords, destCoords),
          includesFerry: false,
          isFallback: true
        };
      }
    }

    // Salvar no cache (independente da fonte)
    await routeCache.updateOne(
      { routeId },
      { $set: { data: result, updatedAt: new Date().toISOString() } },
      { upsert: true }
    );

    console.log(`[Location API] Resposta final: ${result.distance.toFixed(1)}km ${result.isFallback ? '(estimado)' : '(exato)'} em ${Date.now() - startTime}ms`);
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('[Location API] Erro fatal:', error);
    return NextResponse.json({ message: `Erro interno: ${error.message}` }, { status: 500 });
  }
}
