
import { NextResponse } from 'next/server';
import { calculateMinimumFreight } from '@/lib/antt/calculator';
import { connectToDatabase } from '@/lib/database';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const distance = parseFloat(searchParams.get('distance') || '0');
    const vehicleKey = searchParams.get('vehicleKey');
    const axlesParam = searchParams.get('axles');
    const axles = axlesParam ? parseInt(axlesParam, 10) : 0;
    const cargoType = searchParams.get('cargoType') || 'Geral';
    const isRoundTrip = searchParams.get('isRoundTrip') === 'true';

    if (!distance) {
      return NextResponse.json({ error: 'Distância é obrigatória' }, { status: 400 });
    }

    let vehicleAxles = axles;

    if (!vehicleAxles && vehicleKey) {
      const { db } = await connectToDatabase();
      const vehicle = await db.collection('vehicles').findOne({ key: vehicleKey });
      if (vehicle) {
        vehicleAxles = vehicle.axles || 0;
      }
    }

    if (!vehicleAxles || vehicleAxles < 2) {
      return NextResponse.json({ error: 'Número de eixos (mínimo 2) é obrigatório para o cálculo.' }, { status: 400 });
    }

    // Se for ida e volta, a distância para o cálculo do piso é dobrada
    const calcDistance = isRoundTrip ? distance * 2 : distance;

    const result = await calculateMinimumFreight(calcDistance, { axles: vehicleAxles } as any, cargoType);

    if (!result) {
      return NextResponse.json({ error: 'Não foi possível calcular o piso mínimo para este veículo/eixos.' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
