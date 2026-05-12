
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const id = parts[parts.length - 1];

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: "ID de talento inválido." }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const talent = await db.collection('talents').findOne({ _id: new ObjectId(id) });
    
    if (!talent) {
      return NextResponse.json({ message: "Talento não encontrado." }, { status: 404 });
    }

    return NextResponse.json({ ...talent, id: talent._id.toHexString() });
  } catch (error: any) {
    console.error('API Talent GET Error:', error);
    return NextResponse.json({ message: `Erro ao buscar talento: ${error.message}` }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const id = parts[parts.length - 1];

    const { accessOption, email, password, role, userId, ...updates } = await request.json();

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: "ID de talento inválido." }, { status: 400 });
    }

    delete updates._id;

    if (accessOption === 'link') {
        updates.userId = userId ? new ObjectId(userId) : undefined;
    } else if (accessOption === 'none') {
        updates.userId = undefined;
    }
     // A criação de um novo usuário durante a edição não é ideal, 
     // pois pode gerar utilizadores duplicados. 
     // A lógica aqui irá principalmente desvincular ou vincular a um existente.


    const { db } = await connectToDatabase();
    const result = await db.collection('talents').updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "Talento não encontrado." }, { status: 404 });
    }

    return NextResponse.json({ message: "Talento atualizado com sucesso." });
  } catch (error: any) {
    console.error('API Talent PUT Error:', error);
    return NextResponse.json({ message: `Erro ao atualizar talento: ${error.message}` }, { status: 500 });
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
      const result = await db.collection('talents').deleteOne({ _id: new ObjectId(id) });
  
      if (result.deletedCount === 0) {
        return NextResponse.json({ message: "Talento não encontrado." }, { status: 404 });
      }
  
      return NextResponse.json({ message: "Talento apagado com sucesso." });
    } catch (error: any) {
      console.error('API Talent DELETE Error:', error);
      return NextResponse.json({ message: `Erro ao apagar talento: ${error.message}` }, { status: 500 });
    }
  }
