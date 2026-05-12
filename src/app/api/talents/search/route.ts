
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
        { fullName: regex },
        { cpf: regex },
        { jobTitle: regex },
      ]
    };

    const talents = await db.collection('talents')
      .find(query)
      .limit(50)
      .sort({ fullName: 1 })
      .toArray();

    const talentsWithId = talents.map(talent => {
      const { _id, ...rest } = talent;
      return { id: _id.toHexString(), ...rest };
    });

    return NextResponse.json(talentsWithId);

  } catch (error: any) {
    console.error('API Talents Search Error:', error);
    return NextResponse.json({ message: `Erro ao buscar talentos: ${error.message}` }, { status: 500 });
  }
}
