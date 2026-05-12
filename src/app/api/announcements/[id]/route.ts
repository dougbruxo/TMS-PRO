
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

// PUT to update an announcement
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const id = parts[parts.length - 1];

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'ID de aviso inválido' }, { status: 400 });
    }

    const updates = await request.json();
    delete updates._id;

    const { db } = await connectToDatabase();
    const result = await db.collection('announcements').updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: 'Aviso não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Aviso atualizado com sucesso' });
  } catch (error: any) {
    console.error('API Announcement PUT Error:', error);
    return NextResponse.json({ message: `Erro ao atualizar aviso: ${error.message}` }, { status: 500 });
  }
}

// DELETE an announcement
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const id = parts[parts.length - 1];

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'ID de aviso inválido' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const result = await db.collection('announcements').deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ message: 'Aviso não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Aviso apagado com sucesso' });
  } catch (error: any) {
    console.error('API Announcement DELETE Error:', error);
    return NextResponse.json({ message: `Erro ao apagar aviso: ${error.message}` }, { status: 500 });
  }
}
