
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function GET() {
  try {
    const { db } = await connectToDatabase();
    const coefficients = await db.collection('antt_coefficients').find({}).sort({ axles: 1 }).toArray();
    
    const formatted = coefficients.map(c => ({
      ...c,
      id: c._id.toHexString()
    }));

    return NextResponse.json(formatted);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { db } = await connectToDatabase();
    
    const newCoefficient = {
      ...data,
      updatedAt: new Date().toISOString()
    };

    const result = await db.collection('antt_coefficients').insertOne(newCoefficient);
    return NextResponse.json({ ...newCoefficient, id: result.insertedId.toHexString() }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { id, _id, ...data } = await request.json();
    const { db } = await connectToDatabase();
    
    await db.collection('antt_coefficients').updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...data, updatedAt: new Date().toISOString() } }
    );

    return NextResponse.json({ message: 'Coeficiente atualizado com sucesso' });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ message: 'ID é obrigatório' }, { status: 400 });

    const { db } = await connectToDatabase();
    await db.collection('antt_coefficients').deleteOne({ _id: new ObjectId(id) });

    return NextResponse.json({ message: 'Coeficiente excluído com sucesso' });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
