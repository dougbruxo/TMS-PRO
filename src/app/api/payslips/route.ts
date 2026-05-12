
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import type { Payslip, Quote } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const { db } = await connectToDatabase();
    const payslips = await db.collection('payslips').find({}).sort({ createdAt: -1 }).toArray();
    const response = payslips.map(p => ({ ...p, id: p._id.toHexString() }));
    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json({ message: `Erro ao buscar holerites: ${error.message}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId, ...payslipData }: Omit<Payslip, 'id' | 'createdAt'> & { userId: string } = await request.json();

    if (!payslipData.talentId || !userId) {
      return NextResponse.json({ message: 'Dados insuficientes.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const dataToInsert: Omit<Payslip, 'id'> = {
        ...payslipData,
        createdBy: userId,
        createdAt: new Date().toISOString()
    };

    const result = await db.collection('payslips').insertOne(dataToInsert as any);
    const newPayslip = { ...dataToInsert, id: result.insertedId.toHexString() };
    
    // If the payslip includes a sales bonus, mark the related quotes as paid
    if (payslipData.bonus && payslipData.bonus.eligibleQuoteIds && payslipData.bonus.eligibleQuoteIds.length > 0) {
        const quoteObjectIds = payslipData.bonus.eligibleQuoteIds.map(id => new ObjectId(id));
        await db.collection('quotes').updateMany(
            { _id: { $in: quoteObjectIds } },
            { $set: { paidPayslipId: newPayslip.id } }
        );
    }
    
    // Return the created payslip, now including the full quote objects if they exist
    return NextResponse.json(newPayslip, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: `Erro ao criar holerite: ${error.message}` }, { status: 500 });
  }
}
