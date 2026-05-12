
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const term = searchParams.get('term');
    const statusFilter = searchParams.get('status');

    if (!term) {
      return NextResponse.json({ message: 'O termo de busca é obrigatório.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    // Build the query
    const query: any = {};
    const regex = { $regex: term, $options: 'i' };

    // Basic search on quote fields
    const quoteSearchConditions = [
        { remetente: regex },
        { cidadeDestino: regex },
        { quoteCode: regex },
        { nfNumber: regex },
    ];
    
    // More complex search for driver and plate
    const driverSearchConditions = [
        { name: regex },
        { licensePlate: regex },
    ];
    
    const matchingDrivers = await db.collection('drivers').find({ $or: driverSearchConditions }).project({ _id: 1 }).toArray();
    const matchingDriverIds = matchingDrivers.map(d => d._id.toHexString());

    if (matchingDriverIds.length > 0) {
        quoteSearchConditions.push({ 'operationalHistory.driverId': { $in: matchingDriverIds } } as any);
    }
    
    query.$or = quoteSearchConditions;

    if (statusFilter && statusFilter !== 'todos') {
        const statuses: string[] = [];
        if (statusFilter === 'Coleta') {
            statuses.push('Fechada', 'Coleta', 'Aguardando Recebimento');
        } else if (statusFilter === 'No Galpão') {
            statuses.push('No Galpão', 'Aguardando Saída', 'Em Carregamento');
        } else {
            statuses.push(statusFilter);
        }
        query.status = { $in: statuses };
    } else {
        // Exclude quotes that are not in the main operational flow for a general search
        query.status = { $nin: ['Aberta', 'Em Análise'] };
    }

    const quotes = await db.collection('quotes')
        .find(query)
        .sort({ data: -1 })
        .limit(50) // Limit results to avoid performance issues
        .toArray();

    const quotesWithId = quotes.map(quote => {
      const { _id, ...rest } = quote;
      return { id: _id.toHexString(), ...rest };
    });

    return NextResponse.json(quotesWithId);

  } catch (error: any) {
    console.error('API SAC Search Error:', error);
    return NextResponse.json({ message: `Erro ao buscar cotações: ${error.message}` }, { status: 500 });
  }
}
