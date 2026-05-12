
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
        { talentName: regex },
        { referenceMonth: regex },
      ]
    };

    const payslips = await db.collection('payslips')
      .find(query)
      .limit(50)
      .sort({ createdAt: -1 })
      .toArray();

    const resultsWithId = payslips.map(item => {
      const { _id, ...rest } = item;
      return { id: _id.toHexString(), ...rest };
    });

    return NextResponse.json(resultsWithId);

  } catch (error: any) {
    console.error('API Payslips Search Error:', error);
    return NextResponse.json({ message: `Erro ao buscar holerites: ${error.message}` }, { status: 500 });
  }
}
