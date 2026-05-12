import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { HubUser } from '@/lib/types';

export async function GET() {
  try {
    const { db } = await connectToDatabase();
    const hubs = await db.collection('chat_hubs').find({}).sort({ name: 1 }).toArray();
    const response = hubs.map(hub => ({ ...hub, id: hub._id.toHexString() }));
    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json({ message: `Erro ao buscar hubs: ${error.message}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, linkedUserIds } = await request.json();
    if (!name || !linkedUserIds || linkedUserIds.length === 0) {
      return NextResponse.json({ message: 'Nome e usuários responsáveis são obrigatórios.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    const existing = await db.collection('chat_hubs').findOne({ name });
    if(existing) {
        return NextResponse.json({ message: 'Já existe um hub com este nome.' }, { status: 409 });
    }
    
    const newHub: Omit<HubUser, 'id'> = {
      name,
      linkedUserIds,
    };
    
    const result = await db.collection('chat_hubs').insertOne(newHub as any);
    return NextResponse.json({ id: result.insertedId.toHexString() }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: `Erro ao criar hub: ${error.message}` }, { status: 500 });
  }
}
