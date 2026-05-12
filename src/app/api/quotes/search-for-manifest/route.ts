import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const term = searchParams.get('term');

    // Return empty if no term is provided to avoid loading all quotes
    if (!term || term.length < 2) {
      return NextResponse.json([]);
    }

    const { db } = await connectToDatabase();
    
    const regex = { $regex: term, $options: 'i' };

    const query = {
      status: 'No Galpão',
      $or: [
        { quoteCode: regex },
        { cidadeDestino: regex },
        { nfNumber: regex },
        { destinatario: regex },
        { empresaDestino: regex },
      ],
    };

    const quotes = await db.collection('quotes')
      .find(query)
      .sort({ data: -1 })
      .limit(100)
      .toArray();

    const quotesWithId = quotes.map(quote => {
      const { _id, ...rest } = quote;
      return { id: _id.toHexString(), ...rest };
    });

    return NextResponse.json(quotesWithId);

  } catch (error: any) {
    console.error('API Search for Manifest Error:', error);
    return NextResponse.json({ message: `Erro ao buscar cotações para romaneio: ${error.message}` }, { status: 500 });
  }
}
