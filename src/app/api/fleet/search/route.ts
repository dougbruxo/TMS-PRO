
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const term = searchParams.get('term');

    if (!term || term.length < 2) {
      return NextResponse.json([]);
    }

    const { db } = await connectToDatabase();
    
    const regex = { $regex: term, $options: 'i' };

    const query = {
      $or: [
        { plate: regex },
        { brand: regex },
        { model: regex },
        { ownerName: regex },
      ]
    };

    const vehicles = await db.collection('fleet')
      .find(query)
      .limit(50)
      .sort({ brand: 1, model: 1 })
      .toArray();

    const vehiclesWithId = vehicles.map(vehicle => {
      const { _id, ...rest } = vehicle;
      return { id: _id.toHexString(), ...rest };
    });

    return NextResponse.json(vehiclesWithId);

  } catch (error: any) {
    console.error('API Fleet Search Error:', error);
    return NextResponse.json({ message: `Erro ao buscar veículos: ${error.message}` }, { status: 500 });
  }
}
