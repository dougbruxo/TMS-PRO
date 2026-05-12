import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import type { ClientCompany } from '@/lib/types';
import { getUserFromRequest } from '@/lib/auth-api';

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
      return NextResponse.json({ message: 'ID de empresa inválido' }, { status: 400 });
    }

    const data: Partial<ClientCompany> = await request.json();
    const { _id, id: removeId, userId, createdAt, ...updateData } = data as any;
    
    updateData.updatedAt = new Date().toISOString();

    const { db } = await connectToDatabase();
    
    const filter: any = { _id: new ObjectId(id) };
    const effectiveId = user.effectiveUserId || user.userId;
    const finalUserId = user.role === 'admin' ? (updateData.userId || effectiveId) : effectiveId;

    if (user.role === 'cliente' || user.role === 'sub-cliente') {
      filter.userId = finalUserId; // Only allows updating if they own it
    }

    if (updateData.isDefault) {
      // Reset others
      await db.collection('client_companies').updateMany(
        { userId: finalUserId, _id: { $ne: new ObjectId(id) } },
        { $set: { isDefault: false } }
      );
    }

    const { matchedCount, modifiedCount } = await db.collection('client_companies').updateOne(
      filter,
      { $set: updateData }
    );

    if (matchedCount === 0) {
      return NextResponse.json({ message: 'Empresa não encontrada ou você não tem permissão para alterá-la.' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Empresa atualizada com sucesso', modifiedCount });
  } catch (error) {
    console.error('Failed to update client company:', error);
    return NextResponse.json(
      { message: 'Erro ao atualizar empresa', error: String(error) },
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
      return NextResponse.json({ message: 'ID de empresa inválido' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    // Check permission to delete
    const filter: any = { _id: new ObjectId(id) };
    if (user.role === 'cliente' || user.role === 'sub-cliente') {
      filter.userId = user.effectiveUserId || user.userId; // Only allows deleting if they own it
    }

    const { deletedCount } = await db.collection('client_companies').deleteOne(filter);

    if (deletedCount === 0) {
      return NextResponse.json({ message: 'Empresa não encontrada ou você não tem permissão para removê-la.' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Empresa removida com sucesso' });
  } catch (error) {
    console.error('Failed to delete client company:', error);
    return NextResponse.json(
      { message: 'Erro ao remover empresa', error: String(error) },
      { status: 500 }
    );
  }
}
