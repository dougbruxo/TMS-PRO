
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

// Atualizar um veículo
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const id = parts[parts.length - 1];
    
    const updates = await request.json();
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: "ID de veículo inválido" }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    // Assegura que o _id e a key não sejam atualizados
    delete updates._id;
    delete updates.id;
    delete updates.key;

    if (updates.taxaDificuldade !== undefined) {
        updates.taxaDificuldade = parseFloat(updates.taxaDificuldade) || 0;
    }

    if (updates.axles !== undefined) {
        updates.axles = parseInt(updates.axles) || 0;
    }

    const result = await db.collection('vehicles').updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "Veículo não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ message: "Veículo atualizado com sucesso" }, { status: 200 });
  } catch (error: any) {
    console.error('API Vehicle PUT Error:', error);
    return NextResponse.json({ message: `Erro ao atualizar veículo: ${error.message}` }, { status: 500 });
  }
}


// Apagar um veículo
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const id = parts[parts.length - 1];

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: "ID de veículo inválido" }, { status: 400 });
    }
      
    const { db } = await connectToDatabase();

    const result = await db.collection('vehicles').deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ message: "Veículo não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ message: "Veículo apagado com sucesso" }, { status: 200 });
  } catch (error: any) {
    console.error('API Vehicle DELETE Error:', error);
    return NextResponse.json({ message: `Erro ao apagar veículo: ${error.message}` }, { status: 500 });
  }
}
