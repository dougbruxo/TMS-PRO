import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';

export async function GET() {
  try {
    const { db } = await connectToDatabase();
    const hiringTypes = await db.collection('hiringTypes').find({}).sort({ name: 1 }).toArray();
    const response = hiringTypes.map(type => ({ ...type, id: type._id.toHexString() }));
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('API Hiring Types GET Error:', error);
    return NextResponse.json({ message: `Erro ao buscar tipos de contratação: ${error.message}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name } = await request.json();
    if (!name) {
      return NextResponse.json({ message: "O nome é obrigatório." }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const result = await db.collection('hiringTypes').insertOne({ name });
    const newType = { id: result.insertedId.toHexString(), name };
    
    return NextResponse.json(newType, { status: 201 });
  } catch (error: any) {
    console.error('API Hiring Types POST Error:', error);
    return NextResponse.json({ message: `Erro ao criar tipo de contratação: ${error.message}` }, { status: 500 });
  }
}
