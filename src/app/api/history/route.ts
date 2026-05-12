
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';

export async function GET(request: Request) {
  try {
    const { db } = await connectToDatabase();
    const history = await db.collection('activityHistory').find({}).sort({ timestamp: -1 }).toArray();
    
    const historyWithId = history.map(log => {
      const { _id, ...rest } = log;
      return { id: _id.toHexString(), ...rest };
    });

    return NextResponse.json(historyWithId);
  } catch (error: any) {
    console.error('API Activity History GET Error:', error);
    return NextResponse.json({ message: `Erro ao buscar histórico de atividades: ${error.message}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
    try {
        const activityData = await request.json();
        const { db } = await connectToDatabase();
        
        await db.collection('activityHistory').insertOne(activityData);

        return NextResponse.json({ success: true }, { status: 201 });
    } catch (error: any) {
        console.error('API Activity History POST Error:', error);
        return NextResponse.json({ message: `Erro ao registar atividade: ${error.message}` }, { status: 500 });
    }
}
