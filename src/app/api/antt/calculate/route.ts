
import { NextResponse } from 'next/server';
import { calculateMinimumFreight } from '@/lib/antt/calculator';
import { connectToDatabase } from '@/lib/database';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const distance = parseFloat(searchParams.get('distance') || '0');
    const vehicleKey = searchParams.get('vehicleKey');
    const cargoType = searchParams.get('cargoType') || 'Geral';
    const isRoundTrip = searchParams.get('isRoundTrip') === 'true';

    if (!distance || !vehicleKey) {
      return NextResponse.json({ error: 'Distância e veículo são obrigatórios' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const vehicle = await db.collection('vehicles').findOne({ key: vehicleKey });

    if (!vehicle) {
      return NextResponse.json({ error: 'Veículo não encontrado' }, { status: 404 });
    }

    // Se for ida e volta, a distância para o cálculo do piso é dobrada
    const calcDistance = isRoundTrip ? distance * 2 : distance;

    const result = await calculateMinimumFreight(calcDistance, vehicle as any, cargoType);

    if (!result) {
      return NextResponse.json({ error: 'Não foi possível calcular o piso mínimo para este veículo/eixos.' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
