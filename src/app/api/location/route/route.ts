import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { calculateRouteDistance } from '@/lib/location-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const origin = searchParams.get('origin');
    const dest = searchParams.get('dest');

    if (!origin || !dest) {
      return NextResponse.json({ error: 'Origin and dest are required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    const result = await calculateRouteDistance(db, origin, dest);

    if (!result) {
      return NextResponse.json({ 
        error: 'Não foi possível geolocalizar ou traçar rota para as cidades fornecidas. Tente usar formato Cidade, UF.' 
      }, { status: 404 });
    }

    return NextResponse.json(result, { status: 200 });

  } catch (error: any) {
    console.error('Route API error:', error);
    return NextResponse.json({ error: 'Internal server error calculating route.' }, { status: 500 });
  }
}
