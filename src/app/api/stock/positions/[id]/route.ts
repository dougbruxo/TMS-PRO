
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import type { StockPosition } from '@/lib/types';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
    const params = await context.params;
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const id = parts[parts.length - 1];

    const { name, status, quoteCode } = await request.json();
    
    if (!ObjectId.isValid(id) || !name || !status) {
        return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const originalPosition = await db.collection<StockPosition>('stock_positions').findOne({ _id: new ObjectId(id) });
    
    const updates: Partial<Omit<StockPosition, 'id'>> = {
      name,
      status,
      updatedAt: new Date().toISOString(),
    };

    if (status === 'Ocupado' && quoteCode && quoteCode !== 'nenhuma') {
      const quote = await db.collection('quotes').findOne({ quoteCode: { $regex: `^${quoteCode}$`, $options: 'i' } });
      if (!quote) {
        return NextResponse.json({ message: `Cotação com o código '${quoteCode}' não encontrada.` }, { status: 404 });
      }
      updates.quoteId = quote._id.toHexString();
      updates.quoteCode = quote.quoteCode;
      // Only set occupiedAt if the status is changing to Ocupado
      if (originalPosition?.status !== 'Ocupado') {
        updates.occupiedAt = new Date().toISOString();
      }
    } else {
        updates.quoteId = undefined;
        updates.quoteCode = undefined;
        updates.occupiedAt = null;
    }

    const result = await db.collection('stock_positions').updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "Posição não encontrada" }, { status: 404 });
    }
    
    return NextResponse.json({ message: "Posição atualizada com sucesso" }, { status: 200 });

  } catch (error: any) {
    console.error('API Stock Position PUT Error:', error);
    return NextResponse.json({ message: `Erro ao atualizar posição: ${error.message}` }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
    const params = await context.params;
    try {
        const pathname = new URL(request.url).pathname;
        const parts = pathname.split('/');
        const id = parts[parts.length - 1];
        
        if (!ObjectId.isValid(id)) {
            return NextResponse.json({ message: "ID de posição inválido" }, { status: 400 });
        }

        const { db } = await connectToDatabase();

        // Check if there are items in this position
        const itemsInPosition = await db.collection('stock_items').countDocuments({ positionId: id });
        if (itemsInPosition > 0) {
            return NextResponse.json({ message: `Não é possível apagar a posição pois existem ${itemsInPosition} item(ns) nela.`}, { status: 409 });
        }

        const result = await db.collection('stock_positions').deleteOne({ _id: new ObjectId(id) });
        
        if (result.deletedCount === 0) {
            return NextResponse.json({ message: "Posição não encontrada" }, { status: 404 });
        }

        return NextResponse.json({ message: "Posição apagada com sucesso" }, { status: 200 });
    } catch (error: any) {
        console.error('API Stock Position DELETE Error:', error);
        return NextResponse.json({ message: `Erro ao apagar posição: ${error.message}` }, { status: 500 });
    }
}
