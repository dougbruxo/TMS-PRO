import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { db } = await connectToDatabase();
    
    // params is not available in App Router edge runtime directly without awaiting sometimes in later nextjs versions, 
    // but extracting from URL works consistently if params are tricky:
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const id = parts[parts.length - 1];

    if (!ObjectId.isValid(id)) return NextResponse.json({}, { status: 400 });
    const owner = await db.collection('owners').findOne({ _id: new ObjectId(id) });
    if (!owner) return NextResponse.json({ message: "Proprietário não encontrado." }, { status: 404 });
    const { _id, ...rest } = owner;
    return NextResponse.json({ id: _id.toHexString(), ...rest }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: "Erro ao buscar proprietário." }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const id = parts[parts.length - 1];
    
    const { logradouro, numero, complemento, bairro, city, state, zipCode, ...otherUpdates } = await request.json();
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: "ID de proprietário inválido" }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    delete otherUpdates._id;
    
    const fullAddress = [logradouro, numero, complemento, bairro, city, state, zipCode].filter(Boolean).join(', ');

    const updates = {
      ...otherUpdates,
      address: fullAddress,
      logradouro,
      numero,
      complemento,
      bairro,
      city,
      state,
      zipCode,
    };

    if (updates.document) {
        updates.document = updates.document.replace(/[^\d]/g, '');
    }

    const result = await db.collection('owners').updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "Proprietário não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ message: "Proprietário atualizado com sucesso" }, { status: 200 });
  } catch (error: any) {
    console.error('API Owner PUT Error:', error);
    return NextResponse.json({ message: `Erro ao atualizar proprietário: ${error.message}` }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const id = parts[parts.length - 1];

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: "ID de proprietário inválido" }, { status: 400 });
    }
      
    const { db } = await connectToDatabase();
        
    const result = await db.collection('owners').deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ message: "Proprietário não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ message: "Proprietário apagado com sucesso" }, { status: 200 });
  } catch (error: any) {
    console.error('API Owner DELETE Error:', error);
    return NextResponse.json({ message: `Erro ao apagar proprietário: ${error.message}` }, { status: 500 });
  }
}
