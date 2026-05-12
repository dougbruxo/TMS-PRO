import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import type { ClientPartner } from '@/lib/types';
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
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    if (user.role !== 'cliente' && user.role !== 'admin' && user.role !== 'sub-cliente') {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'ID de parceiro inválido' }, { status: 400 });
    }

    const data: Partial<ClientPartner> = await request.json();
    const { _id, id: removeId, userId, createdAt, ...updateData } = data as any;
    
    updateData.updatedAt = new Date().toISOString();

    const { db } = await connectToDatabase();
    
    const filter: any = { _id: new ObjectId(id) };
    const effectiveId = user.effectiveUserId || user.userId;
    const finalUserId = user.role === 'admin' ? (updateData.userId || effectiveId) : effectiveId;

    if (user.role === 'cliente' || user.role === 'sub-cliente') {
      filter.userId = finalUserId; // Only allows updating if they own it
    }

    const { matchedCount, modifiedCount } = await db.collection('client_partners').updateOne(
      filter,
      { $set: updateData }
    );

    if (matchedCount === 0) {
      return NextResponse.json({ message: 'Parceiro não encontrado ou você não tem permissão para alterá-lo.' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Parceiro atualizado com sucesso', modifiedCount });
  } catch (error) {
    console.error('Failed to update client partner:', error);
    return NextResponse.json(
      { message: 'Erro ao atualizar parceiro de negócio', error: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    if (user.role !== 'cliente' && user.role !== 'admin' && user.role !== 'sub-cliente') {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'ID de parceiro inválido' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    // Check permission to delete
    const filter: any = { _id: new ObjectId(id) };
    if (user.role === 'cliente' || user.role === 'sub-cliente') {
      filter.userId = user.effectiveUserId || user.userId; // Only allows deleting if they own it
    }

    const { deletedCount } = await db.collection('client_partners').deleteOne(filter);

    if (deletedCount === 0) {
      return NextResponse.json({ message: 'Parceiro não encontrado ou sem permissão.' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Parceiro removido com sucesso' });
  } catch (error) {
    console.error('Failed to delete client partner:', error);
    return NextResponse.json(
      { message: 'Erro ao deletar parceiro de negócio', error: String(error) },
      { status: 500 }
    );
  }
}
