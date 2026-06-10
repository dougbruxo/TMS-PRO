
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import type { Manifest, ActivityRecord, Quote, Expense } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const driverId = searchParams.get('driverId');

    if (!driverId || !ObjectId.isValid(driverId)) {
      return NextResponse.json({ message: 'ID de motorista inválido ou não fornecido.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    const manifests = await db.collection<Omit<Manifest, 'id'>>('manifests')
      .find({ driverId: driverId })
      .sort({ createdAt: -1 })
      .toArray();
      
    const manifestQuoteObjectIds = new Set<string>();
    manifests.forEach(m => m.quotes.forEach(q => manifestQuoteObjectIds.add(q.quoteId)));

    // Enrich manifests with full quote data
    const enrichedManifests = await Promise.all(manifests.map(async (manifest) => {
        const quoteIds = manifest.quotes.map(q => new ObjectId(q.quoteId));
        const quotesData = await db.collection<Quote>('quotes').find({ _id: { $in: quoteIds } }).toArray();
        const quotesMap = new Map(quotesData.map(q => [q._id.toHexString(), q]));

        const enrichedQuotes = manifest.quotes.map(q => {
            const fullQuote = quotesMap.get(q.quoteId);
            return {
                ...q,
                status: fullQuote?.status,
                proofOfDeliveryUrl: fullQuote?.proofOfDeliveryUrl,
                enderecoEntrega: fullQuote?.enderecoEntrega,
            };
        });
        
        return {
            ...manifest,
            id: manifest._id.toHexString(),
            quotes: enrichedQuotes,
        };
    }));
    
    // Find individual quotes assigned to this driver that are not in a manifest
    const individualDeliveriesData = await db.collection<Quote>('quotes').find({
      'operationalHistory.driverId': driverId,
      status: { $in: ['Em Rota', 'Aguardando Recebimento'] },
      _id: { $nin: Array.from(manifestQuoteObjectIds).map(id => new ObjectId(id)) }
    }).toArray();


    const individualDeliveries = individualDeliveriesData.map(q => ({
        ...q,
        id: q._id.toHexString(),
    }));
    
    const collectionsData = await db.collection<Quote>('quotes').find({
      status: 'Coleta',
      'operationalHistory.driverId': driverId
    }).sort({ 'data': -1 }).toArray();

    const collections = collectionsData.map(q => {
        const lastDriverEvent = [...(q.operationalHistory || [])].filter(e => e.driverId === driverId).pop();
        return {
            ...q,
            id: q._id.toHexString(),
            lastAction: lastDriverEvent?.action,
        }
    });


    const activityHistory = await db.collection<Omit<ActivityRecord, 'id'>>('activityHistory')
      .find({ userId: driverId })
      .sort({ timestamp: -1 })
      .limit(20)
      .toArray();
      
    // Fetch pending expenses logic
    const quotesWithDriverEvents = await db.collection<Quote>('quotes').find(
        { "operationalHistory.driverId": driverId },
        { projection: { operationalHistory: 1 } }
    ).toArray();

    const eventIdsForDriver = quotesWithDriverEvents.flatMap(quote => 
        (quote.operationalHistory || [])
            .filter(event => event.driverId === driverId && event.id)
            .map(event => event.id)
    );

    const expenseConditions: any[] = [
        { driverId: driverId },
        { driverId: new ObjectId(driverId) }
    ];

    if (eventIdsForDriver.length > 0) {
        expenseConditions.push({ operationalEventId: { $in: eventIdsForDriver } });
    }

    const pendingExpensesCount = await db.collection('expenses').countDocuments({
        $or: expenseConditions,
        status: { $in: ['pendente', 'parcial', 'atrasado'] }
    });

    const data = {
        manifests: enrichedManifests,
        individualDeliveries: individualDeliveries,
        collections: collections,
        activityHistory: activityHistory.map(a => ({...a, id: a._id.toHexString()})),
        pendingExpensesCount,
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('API Driver Portal Data Error:', error);
    return NextResponse.json({ message: `Erro ao buscar dados do portal do motorista: ${error.message}` }, { status: 500 });
  }
}
    
