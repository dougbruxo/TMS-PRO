
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const id = parts[parts.length - 1];

    const { code, name, type } = await request.json();

    if (!ObjectId.isValid(id) || !code || !name || !type) {
      return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    const existing = await db.collection('earningDeductionTypes').findOne({ code, _id: { $ne: new ObjectId(id) } });
    if(existing) {
        return NextResponse.json({ message: `O código '${code}' já está em uso.` }, { status: 409 });
    }

    const result = await db.collection('earningDeductionTypes').updateOne(
      { _id: new ObjectId(id) },
      { $set: { code, name, type } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "Item não encontrado." }, { status: 404 });
    }

    return NextResponse.json({ message: "Item atualizado com sucesso." });
  } catch (error: any) {
    console.error('API Earning/Deduction PUT Error:', error);
    return NextResponse.json({ message: `Erro ao atualizar item: ${error.message}` }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const id = parts[parts.length - 1];

    if (!ObjectId.isValid(id)) {
      console.error(`[API DELETE /earnings-deductions] ID inválido: ${id}`);
      return NextResponse.json({ message: "ID inválido." }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    const itemToDelete = await db.collection('earningDeductionTypes').findOne({ _id: new ObjectId(id) });
    if (!itemToDelete) {
      console.error(`[API DELETE /earnings-deductions] Item com ID ${id} não encontrado na base de dados.`);
      return NextResponse.json({ message: "Item não encontrado." }, { status: 404 });
    }

    const relatedPayslipsCount = await db.collection('payslips').countDocuments({ "items.id": id });

    if (relatedPayslipsCount > 0) {
      const errorMessage = `Não é possível apagar. Este item está a ser usado por ${relatedPayslipsCount} holerite(s).`;
      return NextResponse.json({ message: errorMessage }, { status: 409 });
    }

    const result = await db.collection('earningDeductionTypes').deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      console.error(`[API DELETE /earnings-deductions] A exclusão falhou. Nenhum documento foi apagado para o ID: ${id}`);
      return NextResponse.json({ message: "Item não encontrado durante a operação de exclusão." }, { status: 404 });
    }

    return NextResponse.json({ message: "Item apagado com sucesso." });
  } catch (error: any) {
    console.error('[API DELETE /earnings-deductions] Erro inesperado:', error);
    return NextResponse.json({ message: `Erro ao apagar item: ${error.message}` }, { status: 500 });
  }
}
