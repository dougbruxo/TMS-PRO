import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import type { StockLabel } from '@/lib/types';

// GET labels by quoteId
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const quoteId = searchParams.get('quoteId');

    if (!quoteId || !ObjectId.isValid(quoteId)) {
      return NextResponse.json({ message: 'ID da cotação inválido ou não fornecido.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const labelData = await db.collection('stock_labels').findOne({ quoteId });

    if (!labelData) {
      return NextResponse.json({ message: 'Dados de etiqueta não encontrados para esta cotação.' }, { status: 404 });
    }

    const { _id, ...rest } = labelData;
    return NextResponse.json({ id: _id.toHexString(), ...rest });

  } catch (error: any) {
    console.error('API Stock Labels GET Error:', error);
    return NextResponse.json({ message: `Erro ao buscar dados da etiqueta: ${error.message}` }, { status: 500 });
  }
}

// POST new label data
export async function POST(request: Request) {
  try {
    const { quoteId, ...labelData }: Omit<StockLabel, 'id' | 'createdAt'> = await request.json();

    if (!quoteId || !labelData.nf || !labelData.quoteCode) {
      return NextResponse.json({ message: 'Dados insuficientes para salvar a etiqueta.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // Upsert to prevent duplicates if the action is repeated
    const result = await db.collection('stock_labels').updateOne(
      { quoteId },
      {
        $set: {
          ...labelData,
          createdAt: new Date().toISOString(),
        },
        $setOnInsert: { quoteId }
      },
      { upsert: true }
    );
    
    const createdOrUpdatedId = result.upsertedId ? result.upsertedId.toHexString() : (await db.collection('stock_labels').findOne({ quoteId }))?._id.toHexString();

    return NextResponse.json({ id: createdOrUpdatedId, quoteId, ...labelData }, { status: 201 });
  } catch (error: any) {
    console.error('API Stock Labels POST Error:', error);
    return NextResponse.json({ message: `Erro ao salvar etiqueta: ${error.message}` }, { status: 500 });
  }
}
