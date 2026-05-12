import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { getUserFromRequest } from '@/lib/auth-api';
import type { ExpeditionRequest } from '@/lib/types';
import { ObjectId } from 'mongodb';

export async function POST(request: Request) {
    try {
        const user = getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const data = await request.json();
        const { fractionalNfNumber, fractionalNfeXml, items, name, status } = data;

        if (!items || !items.length) {
            return NextResponse.json({ error: 'Nenhum item informado para a expedição.' }, { status: 400 });
        }

        const { db } = await connectToDatabase();

        const newRequest: Omit<ExpeditionRequest, 'id'> = {
            clientId: user.id || user._id?.toString(),
            clientName: user.username,
            name: name || `Expedição ${new Date().toLocaleDateString('pt-BR')}`,
            status: status === 'Rascunho' ? 'Rascunho' : 'Pendente',
            fractionalNfNumber,
            fractionalNfeXml,
            requestedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            items: items.map((i: any) => ({
                sku: i.sku,
                description: i.description,
                quantityRequested: Number(i.quantityRequested) || 1,
                resolvedQuantity: 0,
                stockItemIds: i.stockItemIds || [],
                outboundNfNumber: i.outboundNfNumber || undefined
            }))
        };

        if (newRequest.status === 'Pendente') {
            const decrementedIds: {id: string, qty: number}[] = [];
            for (const item of newRequest.items) {
                const stockId = item.stockItemIds && item.stockItemIds[0];
                const qty = item.quantityRequested;
                
                if (!stockId || qty <= 0) continue;

                // Attempt to decrement stock if sufficient quantity exists
                const result = await db.collection('stock_items').updateOne(
                    { _id: new ObjectId(stockId), quantity: { $gte: qty } },
                    { 
                        $inc: { quantity: -qty },
                        $set: { reserved: true, updatedAt: new Date().toISOString() }
                    }
                );

                if (result.modifiedCount === 0) {
                    // Insufficient stock or item not found. Rollback previous decrements.
                    for (const dec of decrementedIds) {
                        await db.collection('stock_items').updateOne(
                            { _id: new ObjectId(dec.id) },
                            { 
                                $inc: { quantity: dec.qty },
                                $unset: { reserved: "" }
                            }
                        );
                    }
                    return NextResponse.json({ error: `Estoque insuficiente para o item SKU: ${item.sku}. A quantidade solicitada não está disponível no estoque.` }, { status: 400 });
                }
                decrementedIds.push({ id: stockId, qty });
            }
        }

        const result = await db.collection('expedition_requests').insertOne(newRequest as any);

        return NextResponse.json({ 
            message: 'Pedido de expedição criado com sucesso', 
            id: result.insertedId.toHexString() 
        }, { status: 201 });

    } catch (error: any) {
        console.error('API /api/expeditions POST Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        const user = getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const { db } = await connectToDatabase();
        
        let filter: any = {};
        if (user.role === 'cliente' || user.role === 'sub-cliente') {
            filter = { clientId: user.id || user._id?.toString() };
        } else if (user.role !== 'admin' && !user.stockAccess) {
             return NextResponse.json({ error: 'Sem permissão de acesso ao picking.' }, { status: 403 });
        }

        const requests = await db.collection('expedition_requests').find(filter).sort({ requestedAt: -1 }).toArray();
        const mapped = requests.map(r => {
             const { _id, ...rest } = r;
             return { id: _id.toHexString(), ...rest };
        });

        return NextResponse.json(mapped, { status: 200 });
    } catch (error: any) {
        console.error('API /api/expeditions GET Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
