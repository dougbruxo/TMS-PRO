import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { getUserFromRequest } from '@/lib/auth-api';
import { ObjectId } from 'mongodb';

export async function PUT(request: Request, context: any) {
    try {
        const user = getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        // Fix for Next.js 16 dynamic params
        const params = await context.params;
        const id = params?.id;

        if (!id || !ObjectId.isValid(id)) {
            return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
        }

        const data = await request.json();
        const { name, items, status } = data;

        const { db } = await connectToDatabase();

        // Ensure the user owns this request if they are a client
        let filter: any = { _id: new ObjectId(id) };
        if (user.role === 'cliente' || user.role === 'sub-cliente') {
            filter.clientId = user.id || user._id?.toString();
        }

        const existing = await db.collection('expedition_requests').findOne(filter);
        if (!existing) {
            return NextResponse.json({ error: 'Pedido não encontrado ou sem permissão' }, { status: 404 });
        }

        if (existing.status !== 'Rascunho' && existing.status !== 'Cancelado') {
             // Operadores podem mudar status pendente, mas clientes só editam rascunho
             if (user.role === 'cliente' || user.role === 'sub-cliente') {
                 return NextResponse.json({ error: 'Apenas rascunhos podem ser editados' }, { status: 403 });
             }
        }

        const updateData: any = {
            updatedAt: new Date().toISOString()
        };

        if (name !== undefined) updateData.name = name;
        if (status !== undefined) updateData.status = status;
        
        if (items && Array.isArray(items)) {
             updateData.items = items.map((i: any) => ({
                sku: i.sku,
                description: i.description,
                quantityRequested: Number(i.quantityRequested) || 1,
                resolvedQuantity: i.resolvedQuantity || 0,
                stockItemIds: i.stockItemIds || [],
                outboundNfNumber: i.outboundNfNumber || undefined
            }));
        }

        await db.collection('expedition_requests').updateOne(filter, {
            $set: updateData
        });

        // Reserve stock if submitting draft
        if (existing.status === 'Rascunho' && status === 'Pendente') {
            const itemsToCheck = updateData.items || existing.items || [];
            const decrementedIds: {id: string, qty: number}[] = [];
            for (const item of itemsToCheck) {
                const stockId = item.stockItemIds && item.stockItemIds[0];
                const qty = item.quantityRequested;
                
                if (!stockId || qty <= 0) continue;

                const result = await db.collection('stock_items').updateOne(
                    { _id: new ObjectId(stockId), quantity: { $gte: qty } },
                    { $inc: { quantity: -qty } }
                );

                if (result.modifiedCount === 0) {
                    // Rollback
                    for (const dec of decrementedIds) {
                        await db.collection('stock_items').updateOne(
                            { _id: new ObjectId(dec.id) },
                            { $inc: { quantity: dec.qty } }
                        );
                    }
                    // Abort the update we just did, revert it to Rascunho
                    await db.collection('expedition_requests').updateOne(filter, {
                        $set: { status: 'Rascunho' }
                    });
                    return NextResponse.json({ error: `Estoque insuficiente para o item SKU: ${item.sku}. A quantidade solicitada não está disponível no estoque.` }, { status: 400 });
                }
                decrementedIds.push({ id: stockId, qty });
            }
        } else if (existing.status === 'Pendente' && status === 'Cancelado') {
             // Refund stock
             const itemsToRefund = existing.items || [];
             for (const item of itemsToRefund) {
                const stockId = item.stockItemIds && item.stockItemIds[0];
                const qty = item.quantityRequested;
                if (!stockId || qty <= 0) continue;

                await db.collection('stock_items').updateOne(
                    { _id: new ObjectId(stockId) },
                    { $inc: { quantity: qty } }
                );
             }
        }

        return NextResponse.json({ message: 'Pedido atualizado com sucesso' }, { status: 200 });

    } catch (error: any) {
        console.error('API /api/expeditions/[id] PUT Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request, context: any) {
    try {
        const user = getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        // Fix for Next.js 16 dynamic params
        const params = await context.params;
        const id = params?.id;

        if (!id || !ObjectId.isValid(id)) {
            return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
        }

        const { db } = await connectToDatabase();

        let filter: any = { _id: new ObjectId(id) };
        if (user.role === 'cliente' || user.role === 'sub-cliente') {
            filter.clientId = user.id || user._id?.toString();
        }

        const existing = await db.collection('expedition_requests').findOne(filter);
        if (!existing) {
            return NextResponse.json({ error: 'Pedido não encontrado ou sem permissão' }, { status: 404 });
        }

        if (existing.status !== 'Rascunho' && existing.status !== 'Pendente') {
             if (user.role === 'cliente' || user.role === 'sub-cliente') {
                 return NextResponse.json({ error: 'Apenas rascunhos ou pedidos pendentes podem ser excluídos pelo cliente. Contate o suporte se o pedido já estiver em processamento.' }, { status: 403 });
             }
        }

        await db.collection('expedition_requests').deleteOne(filter);

        if (existing.status === 'Pendente') {
            const itemsToRefund = existing.items || [];
            for (const item of itemsToRefund) {
                const stockId = item.stockItemIds && item.stockItemIds[0];
                const qty = item.quantityRequested;
                if (!stockId || qty <= 0) continue;

                await db.collection('stock_items').updateOne(
                    { _id: new ObjectId(stockId) },
                    { $inc: { quantity: qty } }
                );
            }
        }

        return NextResponse.json({ message: 'Pedido removido com sucesso' }, { status: 200 });

    } catch (error: any) {
        console.error('API /api/expeditions/[id] DELETE Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
