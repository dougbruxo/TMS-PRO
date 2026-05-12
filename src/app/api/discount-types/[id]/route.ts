
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const id = parts[parts.length - 1];

    const { name, isPercentage } = await request.json();

    if (!ObjectId.isValid(id) || !name || typeof isPercentage !== 'boolean') {
      return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const result = await db.collection('discountTypes').updateOne(
      { _id: new ObjectId(id) },
      { $set: { name, isPercentage } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "Tipo de desconto não encontrado." }, { status: 404 });
    }

    return NextResponse.json({ message: "Tipo de desconto atualizado com sucesso." });
  } catch (error: any) {
    console.error('API Discount Type PUT Error:', error);
    return NextResponse.json({ message: `Erro ao atualizar tipo de desconto: ${error.message}` }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const id = parts[parts.length - 1];

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: "ID inválido." }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    // TODO: Add a check here to see if any talent is using this discount type.
    const result = await db.collection('discountTypes').deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ message: "Tipo de desconto não encontrado." }, { status: 404 });
    }

    return NextResponse.json({ message: "Tipo de desconto apagado com sucesso." });
  } catch (error: any) {
    console.error('API Discount Type DELETE Error:', error);
    return NextResponse.json({ message: `Erro ao apagar tipo de desconto: ${error.message}` }, { status: 500 });
  }
}
