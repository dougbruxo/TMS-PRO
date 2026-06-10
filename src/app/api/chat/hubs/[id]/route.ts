import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { name, linkedUserIds } = await request.json();

    if (!ObjectId.isValid(id) || !name || !linkedUserIds) {
      return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const oldHub = await db.collection('chat_hubs').findOne({ _id: new ObjectId(id) });
    const oldName = oldHub?.name;

    const result = await db.collection('chat_hubs').updateOne(
      { _id: new ObjectId(id) },
      { $set: { name, linkedUserIds } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "Hub não encontrado." }, { status: 404 });
    }

    if (oldName && oldName !== name) {
      await db.collection('conversations').updateMany(
        { isGroup: true, name: oldName },
        { $set: { name } }
      );
    }

    return NextResponse.json({ message: "Hub atualizado com sucesso." });
  } catch (error: any) {
    return NextResponse.json({ message: `Erro ao atualizar hub: ${error.message}` }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        if (!ObjectId.isValid(id)) {
            return NextResponse.json({ message: "ID inválido." }, { status: 400 });
        }
        
        const { db } = await connectToDatabase();
        const result = await db.collection('chat_hubs').deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
            return NextResponse.json({ message: "Hub não encontrado." }, { status: 404 });
        }
        
        return NextResponse.json({ message: "Hub apagado com sucesso." });
    } catch (error: any) {
        return NextResponse.json({ message: `Erro ao apagar hub: ${error.message}` }, { status: 500 });
    }
}
