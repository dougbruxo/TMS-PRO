
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const id = parts[parts.length - 1];

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: "ID inválido." }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const result = await db.collection('payslips').deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ message: "Holerite não encontrado." }, { status: 404 });
    }

    return NextResponse.json({ message: "Holerite apagado com sucesso." });
  } catch (error: any) {
    return NextResponse.json({ message: `Erro ao apagar holerite: ${error.message}` }, { status: 500 });
  }
}
