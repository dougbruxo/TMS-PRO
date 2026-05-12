import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';

export const dynamic = 'force-dynamic';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { cities } = body;

        if (!Array.isArray(cities) || cities.length === 0) {
            return NextResponse.json({ error: 'Lista de cidades inválida ou vazia.' }, { status: 400 });
        }

        const { db } = await connectToDatabase();
        const coordsCollection = db.collection('city_coordinates');

        // Normalize city names to avoid duplicate searches
        const uniqueCities = Array.from(new Set(cities.map(c => c.trim().toLowerCase()))).filter(c => c.length > 2);
        
        // 1. Check Cache
        const cachedDocs = await coordsCollection.find({ cityId: { $in: uniqueCities } }).toArray();
        const results: Record<string, { lat: number; lng: number } | null> = {};
        
        const foundCities = new Set<string>();
        cachedDocs.forEach(doc => {
            const cityId = doc.cityId as string;
            if (doc.lat && doc.lng) {
                foundCities.add(cityId);
                results[cityId] = { lat: doc.lat, lng: doc.lng };
            }
            // Se o doc existir mas for null (cache antigo falho do erro 403), ignoramos para forçar um refetch.
        });

        // 2. Determine missing cities
        const missingCities = uniqueCities.filter(c => !foundCities.has(c));
        
        // 3. Fetch missing cities from Nominatim sequentially
        for (const city of missingCities) {
            // nominatim limits to 1 request per second
            await sleep(1100); 
            
            const sanitized = sanitizeAddress(city);
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(sanitized)}&format=json&limit=1&countrycodes=br`, {
                    headers: {
                        'User-Agent': 'Dezlog Transportes App v1.0 (douglas@dezlog.com.br)'
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.length > 0) {
                        const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
                        results[city] = coords;
                        
                        // Save to cache
                        await coordsCollection.updateOne(
                            { cityId: city },
                            { $set: { cityId: city, originalQuery: city, lat: coords.lat, lng: coords.lng, updatedAt: new Date().toISOString() } },
                            { upsert: true }
                        );
                    } else {
                        // Mark as failed in cache so we don't query it again and again
                        results[city] = null;
                        await coordsCollection.updateOne(
                            { cityId: city },
                            { $set: { cityId: city, originalQuery: city, lat: null, lng: null, updatedAt: new Date().toISOString() } },
                            { upsert: true }
                        );
                    }
                } else {
                    console.error("Nominatim API error", response.status);
                    // Do NOT save to cache so it attempts again in the future!
                    results[city] = null;
                }
            } catch (err) {
                console.error(`Error geocoding city ${city}:`, err);
            }
        }

        // 4. Return mapping: input city (lowercase) -> {lat, lng} or null
        // Map back to original case
        const responseMapping: Record<string, { lat: number; lng: number } | null> = {};
        cities.forEach(c => {
            responseMapping[c] = results[c.trim().toLowerCase()] || null;
        });

        return NextResponse.json(responseMapping);

    } catch (error: any) {
        console.error("Bulk geocode endpoint error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
