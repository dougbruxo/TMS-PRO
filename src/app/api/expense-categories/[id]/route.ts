
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
      return NextResponse.json({ message: 'Dados inválidos.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    const result = await db.collection('expense_categories').updateOne(
      { _id: new ObjectId(id) },
      { $set: { name } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "Categoria não encontrada" }, { status: 404 });
    }

    // Update the categoryName in all expenses that use this category
    await db.collection('expenses').updateMany(
      { categoryId: id },
      { $set: { categoryName: name } }
    );

    return NextResponse.json({ message: "Categoria atualizada com sucesso" });
  } catch (error: any) {
    return NextResponse.json({ message: `Erro ao atualizar categoria: ${error.message}` }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const id = parts[parts.length - 1];

    if (!ObjectId.isValid(id)) {
        return NextResponse.json({ message: 'ID inválido.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    const relatedExpensesCount = await db.collection('expenses').countDocuments({ categoryId: id });
    if (relatedExpensesCount > 0) {
        return NextResponse.json({ message: `Não é possível apagar. Esta categoria está a ser usada por ${relatedExpensesCount} despesa(s).` }, { status: 409 });
    }

    const result = await db.collection('expense_categories').deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ message: "Categoria não encontrada" }, { status: 404 });
    }

    return NextResponse.json({ message: "Categoria removida com sucesso" });
  } catch (error: any) {
    return NextResponse.json({ message: `Erro ao remover categoria: ${error.message}` }, { status: 500 });
  }
}
