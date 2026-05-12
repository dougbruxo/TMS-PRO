import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const term = searchParams.get('term');

    if (!term || term.length < 2) {
      return NextResponse.json([]); // Return empty array if term is too short
    }

    const { db } = await connectToDatabase();
    
    const regex = { $regex: term, $options: 'i' };

    const query = {
      $or: [
        { name: regex },
        { cpf: regex },
        { licensePlate: regex },
        { licensePlate2: regex },
        { phone1: regex },
      ]
    };

    const drivers = await db.collection('drivers')
      .find(query)
      .limit(50) // Limit results for performance
      .sort({ name: 1 })
      .toArray();

    const driversWithId = drivers.map(driver => {
      const { _id, ...rest } = driver;
      return { id: _id.toHexString(), ...rest };
    });

    return NextResponse.json(driversWithId);

  } catch (error: any) {
    console.error('API Drivers Search Error:', error);
    return NextResponse.json({ message: `Erro ao buscar motoristas: ${error.message}` }, { status: 500 });
  }
}
