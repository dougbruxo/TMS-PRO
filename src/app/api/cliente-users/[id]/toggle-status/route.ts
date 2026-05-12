import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import jwt from 'jsonwebtoken';

function getUserFromRequest(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.split(' ')[1];
  const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-development';
  try {
    return jwt.verify(token, JWT_SECRET) as any;
  } catch (err) {
    return null;
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userContext = getUserFromRequest(request);
    if (!userContext) return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });

    if (userContext.role !== 'cliente' && userContext.role !== 'admin' && userContext.subRole !== 'ADM') {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    const { id } = await context.params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ message: "ID inválido" }, { status: 400 });

    const { status } = await request.json();
    if (typeof status !== 'boolean') {
        return NextResponse.json({ message: "Status inválido" }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const effectiveId = userContext.effectiveUserId || userContext.userId;

    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(id), parentId: effectiveId },
      { $set: { disabled: !status } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "Usuário não encontrado ou sem permissão" }, { status: 404 });
    }

    return NextResponse.json({ message: "Status atualizado" });
  } catch (error: any) {
    return NextResponse.json({ message: `Erro 500: ${error.message}` }, { status: 500 });
  }
}
