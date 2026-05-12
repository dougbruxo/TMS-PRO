import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import type { Quote } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const term = searchParams.get('term');

    if (!term || term.length < 1) {
      return NextResponse.json({ message: 'Termo de busca deve ter pelo menos 1 caracter.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    const regex = { $regex: term, $options: 'i' };

    const query: any = {
      $or: [
        { tomador: regex },
        { quoteCode: regex },
      ],
      // Apenas cotações que podem ser cobradas
      status: { $in: ['Fechada', 'Finalizado'] }, 
      paymentStatus: 'Pendente',
      invoiceId: { $exists: false } // Exclui cotações que já estão em uma fatura
    };
    
    // Se o termo parece um CNPJ, busca na coleção de clientes
    const cleanedCnpj = term.replace(/[^\d]/g, '');
    if (cleanedCnpj.length === 14) {
        const customer = await db.collection('customers').findOne({ cnpj: cleanedCnpj });
        if(customer) {
            // Adiciona a busca pelo nome do cliente encontrado, além da busca original
            query.$or.push({ tomador: customer.razaoSocial });
        }
    }

    const quotes = await db.collection('quotes')
      .find(query)
      .sort({ data: -1 })
      .limit(100)
      .toArray();

    const quotesWithId = quotes.map(quote => {
      const { _id, ...rest } = quote;
      return { id: _id.toHexString(), ...rest };
    });

    return NextResponse.json(quotesWithId);

  } catch (error: any) {
    console.error('API Billing Search Quotes Error:', error);
    return NextResponse.json({ message: `Erro ao buscar cotações para cobrança: ${error.message}` }, { status: 500 });
  }
}
