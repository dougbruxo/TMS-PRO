
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import type { Invoice, Quote } from '@/lib/types';

type BillableItem = (Quote & { isInvoice: false }) | (Invoice & { isInvoice: true });

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const term = searchParams.get('term');

    if (!term || term.length < 2) {
      return NextResponse.json([]);
    }

    const { db } = await connectToDatabase();
    
    const regex = { $regex: term, $options: 'i' };

    const quoteQuery = {
      $or: [{ quoteCode: regex }, { tomador: regex }],
      status: { $in: ['Fechada', 'Finalizado'] },
      invoiceId: { $exists: false }
    };
    
    const invoiceQuery = {
      $or: [{ invoiceCode: regex }, { tomador: regex }],
    };

    const [quotes, invoices] = await Promise.all([
      db.collection('quotes').find(quoteQuery).limit(25).toArray(),
      db.collection('invoices').find(invoiceQuery).limit(25).toArray()
    ]);
    
    const combinedResults: BillableItem[] = [
        ...invoices.map(inv => ({ ...(inv as any), isInvoice: true, id: inv._id.toHexString() })),
        ...quotes.map(q => ({ ...(q as any), isInvoice: false, id: q._id.toHexString() })),
    ];
    
    const sortedResults = combinedResults.sort((a, b) => new Date(b.createdAt || b.data).getTime() - new Date(a.createdAt || a.data).getTime());

    return NextResponse.json(sortedResults.slice(0, 50));

  } catch (error: any) {
    console.error('API Billing Search Error:', error);
    return NextResponse.json({ message: `Erro ao buscar cobranças: ${error.message}` }, { status: 500 });
  }
}
