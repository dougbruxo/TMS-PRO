
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';

export async function GET() {
  try {
    const { db } = await connectToDatabase();
    const discountTypes = await db.collection('discountTypes').find({}).sort({ name: 1 }).toArray();
    const response = discountTypes.map(type => ({ ...type, id: type._id.toHexString() }));
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('API Discount Types GET Error:', error);
    return NextResponse.json({ message: `Erro ao buscar tipos de desconto: ${error.message}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, isPercentage } = await request.json();
    if (!name || typeof isPercentage !== 'boolean') {
      return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const result = await db.collection('discountTypes').insertOne({ name, isPercentage });
    const newType = { id: result.insertedId.toHexString(), name, isPercentage };
    
    return NextResponse.json(newType, { status: 201 });
  } catch (error: any) {
    console.error('API Discount Types POST Error:', error);
    return NextResponse.json({ message: `Erro ao criar tipo de desconto: ${error.message}` }, { status: 500 });
  }
}
