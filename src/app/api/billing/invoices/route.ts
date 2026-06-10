
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import type { Invoice, Quote } from '@/lib/types';

// GET all invoices
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthYear = searchParams.get('monthYear');
    const { db } = await connectToDatabase();
    
    const query: any = {};
    if (monthYear) {
      const [year, month] = monthYear.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 1);
      query.billingDueDate = {
        $gte: startDate.toISOString(),
        $lt: endDate.toISOString(),
      };
    }

    const invoices = await db.collection('invoices')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
    
    const invoicesWithId = invoices.map(invoice => {
      const { _id, ...rest } = invoice;
      return { id: _id.toHexString(), ...rest };
    });

    return NextResponse.json(invoicesWithId);
  } catch (error: any) {
    console.error('API Invoices GET Error:', error);
    return NextResponse.json({ message: `Erro ao buscar faturas: ${error.message}` }, { status: 500 });
  }
}

// POST a new invoice
export async function POST(request: Request) {
  try {
    const { quoteIds, user, totalValue, tomador, tomadorId, billingDueDate, quoteUpdates } = await request.json();
    
    if (!user || !totalValue || !tomador || !billingDueDate) {
        return NextResponse.json({ message: 'Dados insuficientes para criar a fatura.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    const totalInvoices = await db.collection('invoices').countDocuments();
    const invoiceCode = `FAT-${new Date().getFullYear()}${(totalInvoices + 1).toString().padStart(5, '0')}`;

    const newInvoice: Omit<Invoice, 'id'> = {
      invoiceCode,
      tomador,
      tomadorId,
      quoteIds: quoteIds || [],
      totalValue,
      status: 'Pendente',
      billingDueDate,
      createdAt: new Date().toISOString(),
      billingHistory: [{
          id: `hist-${Date.now()}`,
          timestamp: new Date().toISOString(),
          userId: user.id,
          username: user.username,
          action: 'CRIADA',
          details: quoteIds && quoteIds.length > 0 ? `Fatura criada agrupando ${quoteIds.length} cotações.` : `Fatura manual criada.`
      }]
    };
    
    const result = await db.collection('invoices').insertOne(newInvoice as any);
    const createdInvoice = { id: result.insertedId.toHexString(), ...newInvoice };

    // Update the child quotes to link them to this invoice and set their status
    if (quoteIds && quoteIds.length > 0) {
      const childQuoteObjectIds = quoteIds.map((id: string) => new ObjectId(id));
      
      const quoteUpdateSet: any = { 
        invoiceId: createdInvoice.id,
        paymentStatus: 'Pendente', // Sync status
        billingDueDate: billingDueDate, // Propagate billing date to quotes
      };

      if (quoteUpdates) {
          if(quoteUpdates.status) quoteUpdateSet.status = quoteUpdates.status;
          if(quoteUpdates.enderecoColeta) quoteUpdateSet.enderecoColeta = quoteUpdates.enderecoColeta;
          if(quoteUpdates.enderecoEntrega) quoteUpdateSet.enderecoEntrega = quoteUpdates.enderecoEntrega;
          if(quoteUpdates.grossProfit) quoteUpdateSet.grossProfit = quoteUpdates.grossProfit;
      }

      await db.collection('quotes').updateMany(
        { _id: { $in: childQuoteObjectIds } },
        { 
            $set: quoteUpdateSet,
            $push: { 
                history: {
                    $each: [{
                        id: `hist-${Date.now()}-close`,
                        timestamp: new Date().toISOString(),
                        userId: user.id,
                        username: user.username,
                        action: 'COTACAO_FECHADA',
                        details: `Cotação fechada e cobrança ${invoiceCode} gerada.`
                    }],
                    $position: 0
                }
            }
        }
      );
    }

    return NextResponse.json(createdInvoice, { status: 201 });
  } catch (error: any) {
    console.error('API Invoices POST Error:', error);
    return NextResponse.json({ message: `Erro ao criar fatura: ${error.message}` }, { status: 500 });
  }
}
