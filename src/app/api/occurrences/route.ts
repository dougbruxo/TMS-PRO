import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';

export async function GET() {
  try {
    const { db } = await connectToDatabase();
    const items = await db.collection('occurrenceTypes').find({}).sort({ code: 1 }).toArray();
    const response = items.map(item => ({ ...item, id: item._id.toHexString() }));
    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json({ message: `Erro ao buscar tipos de ocorrência: ${error.message}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { code, description, blocksOperation } = await request.json();
    if (!code || !description || typeof blocksOperation !== 'boolean') {
      return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    const existing = await db.collection('occurrenceTypes').findOne({ code });
    if(existing) {
        return NextResponse.json({ message: `O código '${code}' já está em uso.` }, { status: 409 });
    }

    const newItem = { code, description, blocksOperation };
    const result = await db.collection('occurrenceTypes').insertOne(newItem);
    
    return NextResponse.json({ id: result.insertedId.toHexString(), ...newItem }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: `Erro ao criar tipo de ocorrência: ${error.message}` }, { status: 500 });
  }
}
