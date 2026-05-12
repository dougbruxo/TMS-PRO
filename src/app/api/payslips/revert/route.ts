
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import type { Quote } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const { quoteId, userId } = await request.json();

    if (!quoteId || !userId || !ObjectId.isValid(quoteId) || !ObjectId.isValid(userId)) {
      return NextResponse.json({ message: 'IDs de cotação ou utilizador inválidos.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // Find user to check if it is an admin
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ message: 'Ação não permitida. Apenas administradores podem reverter bônus.' }, { status: 403 });
    }

    const quote = await db.collection<Quote>('quotes').findOne({ _id: new ObjectId(quoteId) });
    if (!quote) {
      return NextResponse.json({ message: 'Cotação não encontrada.' }, { status: 404 });
    }

    const payslipId = quote.paidPayslipId;

    // Remove the paidPayslipId from the quote
    const updateResult = await db.collection('quotes').updateOne(
      { _id: new ObjectId(quoteId) },
      { $unset: { paidPayslipId: "" } }
    );

    if (updateResult.modifiedCount === 0) {
        return NextResponse.json({ message: 'Cotação não precisou ser atualizada (já estava sem bônus pago).' }, { status: 200 });
    }

    // If a payslip was associated, delete it
    if (payslipId && ObjectId.isValid(payslipId)) {
        await db.collection('payslips').deleteOne({ _id: new ObjectId(payslipId) });
    }

    return NextResponse.json({ message: 'Bônus revertido com sucesso. O holerite associado foi removido.' }, { status: 200 });
  } catch (error: any) {
    console.error('API Revert Bonus Error:', error);
    return NextResponse.json({ message: `Erro ao reverter bônus: ${error.message}` }, { status: 500 });
  }
}
