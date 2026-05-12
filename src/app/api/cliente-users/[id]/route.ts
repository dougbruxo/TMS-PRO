import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { getUserFromRequest } from '@/lib/auth-api';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userContext = getUserFromRequest(request);
    if (!userContext) return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });

    if (userContext.role !== 'cliente' && userContext.role !== 'admin' && userContext.subRole !== 'ADM') {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    const { id } = await context.params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ message: "ID inválido" }, { status: 400 });

    const updates = await request.json();
    delete updates._id;
    delete updates.id;
    delete updates.email;
    delete updates.password;

    const { db } = await connectToDatabase();
    const effectiveId = userContext.effectiveUserId || userContext.userId;

    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(id), parentId: effectiveId },
      { $set: updates }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "Usuário não encontrado ou você não tem permissão" }, { status: 404 });
    }

    const updatedUser = await db.collection('users').findOne(
        { _id: new ObjectId(id) },
        { projection: { password: 0 } }
    );

    return NextResponse.json({ message: "Atualizado", user: updatedUser });
  } catch (error: any) {
    return NextResponse.json({ message: `Erro 500: ${error.message}` }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userContext = getUserFromRequest(request);
    if (!userContext) return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });

    if (userContext.role !== 'cliente' && userContext.role !== 'admin' && userContext.subRole !== 'ADM') {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    const { id } = await context.params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ message: "ID inválido" }, { status: 400 });

    const { db } = await connectToDatabase();
    const effectiveId = userContext.effectiveUserId || userContext.userId;

    const result = await db.collection('users').deleteOne(
      { _id: new ObjectId(id), parentId: effectiveId }
    );

    if (result.deletedCount === 0) {
      return NextResponse.json({ message: "Usuário não encontrado ou você não tem permissão" }, { status: 404 });
    }

    return NextResponse.json({ message: "Removido com sucesso" });
  } catch (error: any) {
    return NextResponse.json({ message: `Erro 500: ${error.message}` }, { status: 500 });
  }
}
