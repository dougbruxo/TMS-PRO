
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const term = searchParams.get('term');

    if (!term || term.length < 1) {
      return NextResponse.json([]);
    }

    const { db } = await connectToDatabase();
    
    const regex = { $regex: term, $options: 'i' };

    const query = {
      $or: [
        { name: regex },
        { quoteCode: regex },
      ]
    };

    const positions = await db.collection('stock_positions')
      .find(query)
      .limit(50)
      .sort({ name: 1 })
      .toArray();

    const resultsWithId = positions.map(item => {
      const { _id, ...rest } = item;
      return { id: _id.toHexString(), ...rest };
    });

    return NextResponse.json(resultsWithId);

  } catch (error: any) {
    console.error('API Stock Positions Search Error:', error);
    return NextResponse.json({ message: `Erro ao buscar posições: ${error.message}` }, { status: 500 });
  }
}
