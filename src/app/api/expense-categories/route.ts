
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function GET() {
  try {
    const { db } = await connectToDatabase();
    const categories = await db.collection('expense_categories').find().sort({ name: 1 }).toArray();
    const response = categories.map(cat => ({
        ...cat,
        id: typeof cat._id === 'string' ? cat._id : cat._id.toHexString()
    }));
    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json({ message: `Erro ao buscar categorias: ${error.message}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, createdBy, _id } = await request.json();
     if (!name || !createdBy) {
        return NextResponse.json({ message: 'Nome da categoria e criador são obrigatórios' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    // Check if a category with this custom or generated ID already exists.
    if (_id) {
        const existing = await db.collection('expense_categories').findOne({ _id });
        if(existing) {
             return NextResponse.json({ message: `Categoria com ID '${_id}' já existe.` }, { status: 409 });
        }
    }


    const newCategory = {
        name,
        createdBy,
        createdAt: new Date().toISOString(),
        ...(_id && { _id }), // Conditionally add _id if it exists
    };

    const result = await db.collection('expense_categories').insertOne(newCategory);
    
    const insertedId = _id || result.insertedId.toHexString();

    return NextResponse.json({ id: insertedId, ...newCategory }, { status: 201 });

  } catch (error: any) {
    // Handle duplicate key error for _id if upsert race condition occurs
    if ((error as any).code === 11000) {
        return NextResponse.json({ message: `Categoria com ID '${_id}' já existe.` }, { status: 409 });
    }
    return NextResponse.json({ message: `Erro ao criar categoria: ${error.message}` }, { status: 500 });
  }
}
