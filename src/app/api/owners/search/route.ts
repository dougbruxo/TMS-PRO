
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
        { name: regex },
        { document: regex },
      ]
    };

    const owners = await db.collection('owners')
      .find(query)
      .limit(50)
      .sort({ name: 1 })
      .toArray();

    const ownersWithId = owners.map(owner => {
      const { _id, ...rest } = owner;
      return { id: _id.toHexString(), ...rest };
    });

    return NextResponse.json(ownersWithId);

  } catch (error: any) {
    console.error('API Owners Search Error:', error);
    return NextResponse.json({ message: `Erro ao buscar proprietários: ${error.message}` }, { status: 500 });
  }
}
