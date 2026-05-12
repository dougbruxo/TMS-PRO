
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';

export async function GET(request: Request) {
  try {
    const { db } = await connectToDatabase();
    const history = await db.collection('loginHistory').find({}).sort({ timestamp: -1 }).toArray();
    
    const historyWithId = history.map(log => {
      const { _id, ...rest } = log;
      return { id: _id.toHexString(), ...rest };
    });

    return NextResponse.json(historyWithId);
  } catch (error: any) {
    console.error('API Login History GET Error:', error);
    return NextResponse.json({ message: `Erro ao buscar histórico de login: ${error.message}` }, { status: 500 });
  }
}
