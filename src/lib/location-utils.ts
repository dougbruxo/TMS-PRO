import { Db } from 'mongodb';

/**
 * Mapeamento de Capitais por UF (Brasil)
 */
export const CAPITALS: Record<string, string> = {
  'AC': 'Rio Branco',
  'AL': 'Maceió',
  'AP': 'Macapá',
  'AM': 'Manaus',
  'BA': 'Salvador',
  'CE': 'Fortaleza',
  'DF': 'Brasília',
  'ES': 'Vitória',
  'GO': 'Goiânia',
  'MA': 'São Luís',
  'MT': 'Cuiabá',
  'MS': 'Campo Grande',
  'MG': 'Belo Horizonte',
  'PA': 'Belém',
  'PB': 'João Pessoa',
  'PR': 'Curitiba',
  'PE': 'Recife',
  'PI': 'Teresina',
  'RJ': 'Rio de Janeiro',
  'RN': 'Natal',
  'RS': 'Porto Alegre',
  'RO': 'Porto Velho',
  'RR': 'Boa Vista',
  'SC': 'Florianópolis',
  'SP': 'São Paulo',
  'SE': 'Aracaju',
  'TO': 'Palmas'
};

/**
 * Mapeamento de Regiões Metropolitanas por UF (Exemplos principais)
 */
export const METROPOLITAN_REGIONS: Record<string, string[]> = {
  'SP': [
    'Guarulhos', 'Osasco', 'São Bernardo do Campo', 'Santo André', 'São Caetano do Sul', 
    'Diadema', 'Mogi das Cruzes', 'Barueri', 'Carapicuíba', 'Itapevi', 'Cotia', 'Taboão da Serra',
    'Embu das Artes', 'Itapecerica da Serra', 'Ferraz de Vasconcelos', 'Itaquaquecetuba', 
    'Suzano', 'Poá', 'Arujá', 'Santana de Parnaíba', 'Jandira', 'Caieiras', 'Cajamar', 'Franco da Rocha', 'Francisco Morato'
  ],
  'PR': [
    'São José dos Pinhais', 'Colombo', 'Araucária', 'Pinhais', 'Fazenda Rio Grande', 
    'Campo Largo', 'Almirante Tamandaré', 'Piraquara', 'Campina Grande do Sul', 'Quatro Barras'
  ],
  'RJ': [
    'Niterói', 'Duque de Caxias', 'São Gonçalo', 'Nova Iguaçu', 'Belford Roxo', 
    'Nilópolis', 'Mesquita', 'Queimados', 'Japeri', 'Seropédica', 'Itaguaí', 'Magé', 'Guapirimim'
  ],
  'MG': [
    'Contagem', 'Betim', 'Ribeirão das Neves', 'Santa Luzia', 'Ibirité', 'Sabará', 
    'Vespasiano', 'Nova Lima', 'Caeté', 'Pedro Leopoldo', 'Lagoa Santa'
  ],
  'RS': [
    'Canoas', 'Gravataí', 'Viamão', 'Novo Hamburgo', 'São Leopoldo', 'Alvorada', 
    'Sapucaia do Sul', 'Cachoeirinha', 'Esteio', 'Guaíba'
  ],
  'PE': [
    'Jaboatão dos Guararapes', 'Olinda', 'Paulista', 'Cabo de Santo Agostinho', 
    'Camaragibe', 'Igarassu', 'São Lourenço da Mata', 'Abreu e Lima'
  ],
  'BA': [
    'Lauro de Freitas', 'Camaçari', 'Simões Filho', 'Candeias', 'Dias d\'Ávila', 'Mata de São João'
  ],
  'CE': [
    'Caucaia', 'Maracanaú', 'Eusébio', 'Aquiraz', 'Maranguape', 'Pacatuba', 'Itaitinga'
  ],
  'GO': [
    'Aparecida de Goiânia', 'Trindade', 'Senador Canedo', 'Goianira'
  ],
  'SC': [
    'São José', 'Palhoça', 'Biguaçu', 'Santo Amaro da Imperatriz'
  ],
  'ES': [
    'Vila Velha', 'Serra', 'Cariacica', 'Viana'
  ]
};

/**
 * Normaliza strings para comparação (remove acentos, espaços extras e converte para minúsculas)
 */
export function normalizeString(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Identifica o tipo de localidade com base na cidade e UF
 */
export function identifyLocationType(cityWithUf: string): {
  type: 'capital' | 'metropolitana' | 'interior';
  city: string;
  uf: string | null;
} {
  // Extrai Cidade e UF do formato "Cidade, UF"
  const match = cityWithUf.match(/^([^,]+)(?:,\s*([A-Z]{2}))?$/i);
  if (!match) return { type: 'interior', city: cityWithUf, uf: null };

  const city = match[1].trim();
  const uf = match[2]?.toUpperCase() || null;

  if (!uf) return { type: 'interior', city, uf };

  const normalizedCity = normalizeString(city);

  // Verifica se é Capital
  const capital = CAPITALS[uf];
  if (capital && normalizeString(capital) === normalizedCity) {
    return { type: 'capital', city, uf };
  }

  // Verifica se é Metropolitana
  const metroCities = METROPOLITAN_REGIONS[uf] || [];
  if (metroCities.some(metroCity => normalizeString(metroCity) === normalizedCity)) {
    return { type: 'metropolitana', city, uf };
  }

  return { type: 'interior', city, uf };
}

async function geocodeCity(db: Db, cityString: string): Promise<{ lat: number; lon: number } | null> {
  const coll = db.collection('city_coordinates');
  const cached = await coll.findOne({ city: cityString });
  if (cached && cached.lat !== null && cached.lon !== null) {
    return { lat: cached.lat, lon: cached.lon };
  }

  try {
    const fetchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityString)}&limit=1`;
    const res = await fetch(fetchUrl, {
      headers: {
        'User-Agent': 'DezLogApp/1.0 (dezlog@dezlog.com)'
      }
    });

    if (!res.ok) {
      console.error(`Nominatim error for ${cityString}: ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      await coll.updateOne(
        { city: cityString },
        { $set: { lat, lon, updated_at: new Date() } },
        { upsert: true }
      );
      return { lat, lon };
    } else {
      console.warn(`City not found by Nominatim: ${cityString}`);
      return null;
    }
  } catch (err) {
    console.error(`Geocoding error for ${cityString}:`, err);
    return null;
  }
}

export interface RouteResult {
  distanceKm: number;
  durationHours: number;
}

export async function calculateRouteDistance(db: Db, origin: string, dest: string): Promise<RouteResult | null> {
  try {
    const apiKey = process.env.ORS_API_KEY;
    if (!apiKey) {
      console.error('OpenRouteService API Key is not configured (ORS_API_KEY)');
      return null;
    }

    const originCoords = await geocodeCity(db, origin);
    const destCoords = await geocodeCity(db, dest);

    if (!originCoords || !destCoords) {
      return null;
    }

    const orsUrl = 'https://api.openrouteservice.org/v2/directions/driving-hgv';
    const body = {
      coordinates: [
        [originCoords.lon, originCoords.lat],
        [destCoords.lon, destCoords.lat]
      ]
    };

    const res = await fetch(orsUrl, {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errData = await res.text();
      console.error("OpenRouteService errored in utils:", errData);
      return null;
    }

    const routeData = await res.json();
    if (!routeData.routes || routeData.routes.length === 0) {
      return null;
    }

    const summary = routeData.routes[0].summary;
    const distanceMeters = summary.distance;
    const durationSeconds = summary.duration;

    return {
      distanceKm: parseFloat((distanceMeters / 1000).toFixed(2)),
      durationHours: parseFloat((durationSeconds / 3600).toFixed(2))
    };
  } catch (err) {
    console.error('Error calculating route distance in utils:', err);
    return null;
  }
}
