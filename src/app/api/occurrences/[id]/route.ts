import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { code, description, blocksOperation } = await request.json();

    if (!ObjectId.isValid(id) || !code || !description || typeof blocksOperation !== 'boolean') {
      return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const result = await db.collection('occurrenceTypes').updateOne(
      { _id: new ObjectId(id) },
      { $set: { code, description, blocksOperation } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "Tipo de ocorrência não encontrado." }, { status: 404 });
    }

    return NextResponse.json({ message: "Tipo de ocorrência atualizado com sucesso." });
  } catch (error: any) {
    return NextResponse.json({ message: `Erro ao atualizar tipo de ocorrência: ${error.message}` }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: "ID inválido." }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    // Em um cenário real, você verificaria se o tipo de ocorrência está em uso antes de apagar.
    const result = await db.collection('occurrenceTypes').deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ message: "Tipo de ocorrência não encontrado." }, { status: 404 });
    }

    return NextResponse.json({ message: "Tipo de ocorrência apagado com sucesso." });
  } catch (error: any) {
    return NextResponse.json({ message: `Erro ao apagar tipo de ocorrência: ${error.message}` }, { status: 500 });
  }
}
