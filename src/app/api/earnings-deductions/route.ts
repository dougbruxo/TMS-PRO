
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function GET() {
  try {
    const { db } = await connectToDatabase();
    const items = await db.collection('earningDeductionTypes').find({}).collation({ locale: 'en_US', numericOrdering: true }).sort({ code: 1 }).toArray();
    const response = items.map(item => ({ ...item, id: item._id.toHexString() }));
    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json({ message: `Erro ao buscar itens: ${error.message}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { code, name, type } = await request.json();
    if (!code || !name || !type) {
      return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    const existing = await db.collection('earningDeductionTypes').findOne({ code });
    if(existing) {
        return NextResponse.json({ message: `O código '${code}' já está em uso.` }, { status: 409 });
    }

    const newItem = { code, name, type };
    const result = await db.collection('earningDeductionTypes').insertOne(newItem);
    
    const createdItem = { id: result.insertedId.toHexString(), ...newItem };

    return NextResponse.json(createdItem, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: `Erro ao criar tipo de ocorrência: ${error.message}` }, { status: 500 });
  }
}
