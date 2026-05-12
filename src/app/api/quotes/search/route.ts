import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { getUserFromRequest } from '@/lib/auth-api';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const term = searchParams.get('term');
    const userId = searchParams.get('userId'); // Optional: for user-specific searches
    const userRole = searchParams.get('userRole'); // Optional: for role-based logic

    const authUser = getUserFromRequest(request);
    if (!authUser) return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });

    const { db } = await connectToDatabase();
    
    const query: any = {};
    const regex = { $regex: term, $options: 'i' };

    // Build search conditions
    query.$or = [
      { remetente: regex },
      { empresaDestino: regex },
      { tomador: regex },
      { cidadeOrigem: regex },
      { cidadeDestino: regex },
      { veiculo: regex },
      { quoteCode: regex },
      { nfNumber: regex },
    ];
    
    // Filtro de Segurança por Tenant — só restringe clientes
    if (authUser.role === 'cliente' || authUser.role === 'sub-cliente') {
        const tenantId = authUser.role === 'sub-cliente' ? (authUser.parentId || authUser.userId) : authUser.userId;
        query.userId = tenantId;
    }

    const quotes = await db.collection('quotes')
      .find(query)
      .sort({ data: -1 })
      .limit(100) // Limit results to prevent performance issues on broad searches
      .toArray();

    const quotesWithId = quotes.map(quote => {
      const { _id, ...rest } = quote;
      return { id: _id.toHexString(), ...rest };
    });

    return NextResponse.json(quotesWithId);

  } catch (error: any) {
    console.error('API Quotes Search Error:', error);
    return NextResponse.json({ message: `Erro ao buscar cotações: ${error.message}` }, { status: 500 });
  }
}
