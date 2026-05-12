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

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    if (user.role !== 'cliente' && user.role !== 'admin' && user.subRole !== 'ADM') {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    const { id } = await context.params;
    if (!id || !ObjectId.isValid(id)) {
        return NextResponse.json({ message: 'ID de usuário inválido' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    // Verifica se o subcliente pertence realmente ao cliente (para evitar ver o histórico de outros)
    const effectiveId = user.effectiveUserId || user.userId;
    const subClient = await db.collection('users').findOne({
        _id: new ObjectId(id),
        parentId: effectiveId
    });

    if (!subClient && user.role !== 'admin') {
         return NextResponse.json({ message: 'Usuário não encontrado ou não pertence a esta conta.' }, { status: 404 });
    }

    const history = await db.collection('activityHistory')
        .find({ userId: id }) // A Tabela de histórico salva userId como string.
        .sort({ timestamp: -1 })
        .toArray();
    
    const historyWithId = history.map(log => {
      const { _id, ...rest } = log;
      return { id: _id.toHexString(), ...rest };
    });

    return NextResponse.json(historyWithId);
  } catch (error: any) {
    console.error('API Cliente Users History GET Error:', error);
    return NextResponse.json({ message: `Erro ao buscar histórico: ${error.message}` }, { status: 500 });
  }
}
