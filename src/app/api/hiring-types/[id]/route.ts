import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const id = parts[parts.length - 1];

    const { name } = await request.json();

    if (!ObjectId.isValid(id) || !name) {
      return NextResponse.json({ message: "ID ou nome inválido." }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const result = await db.collection('hiringTypes').updateOne(
      { _id: new ObjectId(id) },
      { $set: { name } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "Tipo de contratação não encontrado." }, { status: 404 });
    }

    return NextResponse.json({ message: "Tipo de contratação atualizado com sucesso." });
  } catch (error: any) {
    console.error('API Hiring Type PUT Error:', error);
    return NextResponse.json({ message: `Erro ao atualizar tipo de contratação: ${error.message}` }, { status: 500 });
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
    
    const relatedTalent = await db.collection('talents').findOne({ hiringTypeId: id });
    if (relatedTalent) {
        return NextResponse.json({ message: `Não é possível apagar. Este tipo está a ser usado pelo talento ${relatedTalent.fullName}.` }, { status: 409 });
    }

    const result = await db.collection('hiringTypes').deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ message: "Tipo de contratação não encontrado." }, { status: 404 });
    }

    return NextResponse.json({ message: "Tipo de contratação apagado com sucesso." });
  } catch (error: any) {
    console.error('API Hiring Type DELETE Error:', error);
    return NextResponse.json({ message: `Erro ao apagar tipo de contratação: ${error.message}` }, { status: 500 });
  }
}
