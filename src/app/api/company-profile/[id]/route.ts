import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const id = parts[parts.length - 1];
    
    const updates = await request.json();
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: "ID de perfil inválido" }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    if (updates.isDefault) {
      await db.collection('company_profiles').updateMany({ _id: { $ne: new ObjectId(id) } }, { $set: { isDefault: false } });
    }

    delete updates._id;

    const result = await db.collection('company_profiles').updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "Perfil não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ message: "Perfil atualizado com sucesso" }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: `Erro ao atualizar perfil: ${error.message}` }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const id = parts[parts.length - 1];

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: "ID de perfil inválido" }, { status: 400 });
    }
      
    const { db } = await connectToDatabase();
    
    const profileToDelete = await db.collection('company_profiles').findOne({ _id: new ObjectId(id) });
    if (!profileToDelete) {
        return NextResponse.json({ message: "Perfil não encontrado." }, { status: 404 });
    }
    if(profileToDelete.isDefault) {
        return NextResponse.json({ message: "Não é possível apagar o perfil padrão." }, { status: 409 });
    }
    
    const result = await db.collection('company_profiles').deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ message: "Perfil não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ message: "Perfil apagado com sucesso" }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: `Erro ao apagar perfil: ${error.message}` }, { status: 500 });
  }
}
