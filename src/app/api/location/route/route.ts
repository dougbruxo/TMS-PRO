import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';

export const dynamic = 'force-dynamic';

async function geocodeCity(db: any, cityString: string) {
    // Check DB first
    const coll = db.collection('city_coordinates');
    const cached = await coll.findOne({ city: cityString });
    if (cached && cached.lat !== null && cached.lon !== null) {
        return { lat: cached.lat, lon: cached.lon };
    }

    // Call Nominatim
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

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const origin = searchParams.get('origin');
        const dest = searchParams.get('dest');

        if (!origin || !dest) {
            return NextResponse.json({ error: 'Origin and dest are required' }, { status: 400 });
        }

        const apiKey = process.env.ORS_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'OpenRouteService API Key is not configured' }, { status: 500 });
        }

        const { db } = await connectToDatabase();

        const originCoords = await geocodeCity(db, origin);
        const destCoords = await geocodeCity(db, dest);

        if (!originCoords || !destCoords) {
            return NextResponse.json({ 
                error: 'Não foi possível geolocalizar as cidades fornecidas. Tente usar formato Cidade, UF.' 
            }, { status: 404 });
        }

        // Prepare request to OpenRouteService driving-hgv
        const orsUrl = 'https://api.openrouteservice.org/v2/directions/driving-hgv';
        const body = {
            coordinates: [
                [originCoords.lon, originCoords.lat],
                [destCoords.lon, destCoords.lat]
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

        const routeRes = await fetch(orsUrl, config);
        
        if (!routeRes.ok) {
            const errData = await routeRes.text();
            console.error("OpenRouteService errored:", errData);
            return NextResponse.json({ error: 'Failed to calculate route with ORS.' }, { status: routeRes.status });
        }

        const routeData = await routeRes.json();
        
        if (!routeData.routes || routeData.routes.length === 0) {
            return NextResponse.json({ error: 'Nenhuma rota encontrada entre os pontos.' }, { status: 404 });
        }

        const summary = routeData.routes[0].summary;
        const distanceMeters = summary.distance;
        const durationSeconds = summary.duration;

        return NextResponse.json({
            distanceKm: parseFloat((distanceMeters / 1000).toFixed(2)),
            durationHours: parseFloat((durationSeconds / 3600).toFixed(2))
        }, { status: 200 });

    } catch (error: any) {
        console.error('Route API error:', error);
        return NextResponse.json({ error: 'Internal server error calculating route.' }, { status: 500 });
    }
}
