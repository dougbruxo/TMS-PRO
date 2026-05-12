
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import type { StockPosition } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const { db } = await connectToDatabase();
    const positions = await db.collection('stock_positions').find({}).sort({ name: 1 }).toArray();
    
    const positionsWithId = positions.map(pos => {
      const { _id, ...rest } = pos;
      return { id: _id.toHexString(), ...rest };
    });

    return NextResponse.json(positionsWithId);
  } catch (error: any) {
    console.error('API Stock Positions GET Error:', error);
    return NextResponse.json({ message: `Erro ao buscar posições: ${error.message}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, status, quoteId } = await request.json();
    
    if (!name || !status) {
      return NextResponse.json({ message: "Nome e status são obrigatórios." }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    const existingPosition = await db.collection('stock_positions').findOne({ name });
    if (existingPosition) {
      return NextResponse.json({ message: `A posição ${name} já existe.` }, { status: 409 });
    }

    const newPosition: Omit<StockPosition, 'id'> = {
      name,
      status,
      updatedAt: new Date().toISOString(),
    };

    if (status === 'Ocupado' && quoteId) {
      const quote = await db.collection('quotes').findOne({ _id: new ObjectId(quoteId) });
      if(quote) {
        newPosition.quoteId = quoteId;
        newPosition.quoteCode = quote.quoteCode;
      }
    }
    
    const result = await db.collection('stock_positions').insertOne(newPosition as any);
    
    const createdPosition = { id: result.insertedId.toHexString(), ...newPosition };

    return NextResponse.json(createdPosition, { status: 201 });

  } catch (error: any) {
     console.error('API Stock Positions POST Error:', error);
    return NextResponse.json({ message: `Erro ao criar posição: ${error.message}` }, { status: 500 });
  }
}
