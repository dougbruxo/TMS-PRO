import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const id = parts[parts.length - 1];

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: "ID de usuário inválido" }, { status: 400 });
    }

    const updates = await request.json();
    
    // Remover campos que não devem ser atualizados diretamente
    delete updates._id;
    delete updates.id;
    delete updates.email; // O e-mail não deve ser alterado
    delete updates.password; // A senha tem um endpoint próprio para ser alterada

    const { db } = await connectToDatabase();
    
    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "Usuário não encontrado" }, { status: 404 });
    }

    const updatedUser = await db.collection('users').findOne(
        { _id: new ObjectId(id) },
        { projection: { password: 0 } }
    );

    return NextResponse.json({ message: "Usuário atualizado com sucesso", user: updatedUser });
    
  } catch (error: any) {
    console.error('API User PUT Error:', error);
    return NextResponse.json({ message: `Erro ao atualizar usuário: ${error.message}` }, { status: 500 });
  }
}
