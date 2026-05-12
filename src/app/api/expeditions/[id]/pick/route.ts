import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { getUserFromRequest } from '@/lib/auth-api';
import { ObjectId } from 'mongodb';
import { logStockMovement } from '@/lib/stock-logs';
import { AuthenticatedUser } from '@/lib/auth-api';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const user = getUserFromRequest(request);
        if (!user || (!user.stockAccess && user.role !== 'admin')) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const { id } = await context.params;
        const { db } = await connectToDatabase();

        const expedition = await db.collection('expedition_requests').findOne({ _id: new ObjectId(id) });
        if (!expedition) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
        if (expedition.status === 'Expedido') return NextResponse.json({ error: 'Já foi expedido' }, { status: 400 });
        if (expedition.status !== 'Pendente') return NextResponse.json({ error: 'Apenas pedidos pendentes podem ser processados para picking.' }, { status: 400 });

        // A reserva de estoque já foi feita na submissão (POST /api/expeditions ou PUT status=Pendente).
        // Aqui, apenas registramos o log de movimentação EXPEDITION e liberamos posições zeradas.

        const distinctNfs = Array.from(new Set(expedition.items.map((i: any) => i.outboundNfNumber).filter(Boolean))).join(', ');

        for (const item of expedition.items) {
            const stockItemIds = item.stockItemIds || [];

            for (const stockId of stockItemIds) {
                if (!ObjectId.isValid(stockId)) continue;

                const stockItem = await db.collection('stock_items').findOne({ _id: new ObjectId(stockId) });
                if (!stockItem) continue;

                // Registrar log de movimentação EXPEDITION (a quantidade já foi debitada na reserva)
                await logStockMovement(db,
                  {
                    id: stockItem._id.toHexString(),
                    sku: stockItem.sku,
                    name: stockItem.name,
                    companyId: stockItem.companyId,
                    companyName: stockItem.companyName
                  },
                  {
                    type: 'EXPEDITION',
                    quantity: item.quantityRequested,
                    fromPositionId: stockItem.positionId,
                    fromPositionName: stockItem.positionName,
                    reason: `Expedição ${expedition.name || ''} - NF ${distinctNfs || expedition.fractionalNfNumber || 'S/N'}`,
                    user: user as AuthenticatedUser
                  }
                );

                // Se o item ficou com quantidade 0 ou menor, liberar a posição se for o último item nela
                if (stockItem.quantity <= 0) {
                    const othersInPosition = await db.collection('stock_items').countDocuments({
                        positionId: stockItem.positionId,
                        _id: { $ne: stockItem._id },
                        quantity: { $gt: 0 }
                    });

                    if (othersInPosition === 0 && stockItem.positionName !== 'RECEBIMENTO') {
                        await db.collection('stock_positions').updateOne(
                            { _id: new ObjectId(stockItem.positionId) },
                            { $set: { status: 'Vazio', quoteId: undefined, quoteCode: undefined, occupiedAt: null, updatedAt: new Date().toISOString() } }
                        );
                    }
                }
            }

            // Marcar quantidade resolvida
            item.resolvedQuantity = item.quantityRequested;
        }

        // 2. Criar a Cotação (Last-mile Fulfillment)
        const totalVolumes = expedition.items.reduce((acc: number, item: any) => acc + (item.resolvedQuantity || item.quantityRequested), 0);

        const counterResult = await db.collection<any>('counters').findOneAndUpdate(
            { _id: 'quoteSequence' },
            { $inc: { seq: 1 } },
            { upsert: true, returnDocument: 'after' }
        );
        let sequentialNumber = counterResult?.value?.seq || counterResult?.seq;
        
        if (sequentialNumber === 1) {
            const totalQuotes = await db.collection('quotes').countDocuments();
            if (totalQuotes > 0) {
                sequentialNumber = totalQuotes + 1;
                await db.collection<any>('counters').updateOne({ _id: 'quoteSequence' }, { $set: { seq: sequentialNumber } });
            }
        }
        
        const randomLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
        const quoteCode = `${sequentialNumber}${randomLetter}`;

        const newQuote = {
            quoteCode,
            usuario: user.username,
            userId: expedition.clientId,
            remetente: "DezLog Secure Freight (Armazém)",
            empresaDestino: expedition.clientName,
            tomador: expedition.clientName,
            cidadeOrigem: "Armazém",
            cidadeDestino: "A Definir",
            veiculo: "Fracionado",
            kmIda: 0,
            kmTotal: 0,
            kmExcedente: 0,
            valorProduto: 0,
            adicional: 0,
            adicionalProduto: 0,
            totalFrete: 0,
            acrescimoRegional: 0,
            regiao: null,
            icmsAliquota: 0,
            desconto: 0,
            valorFinal: 0,
            prazoEntrega: 0,
            data: new Date().toISOString(),
            volumes: totalVolumes,
            status: 'No Galpão',
            description: `Fulfillment Fracionado - Carga Dedicada do Cliente ${expedition.clientName}`,
            createdAt: new Date().toISOString(),
            freightMode: "fracionado",
            nfNumber: distinctNfs || expedition.fractionalNfNumber,
            nfeXml: expedition.fractionalNfeXml,
            hasXml: !!expedition.fractionalNfeXml,
            history: [{
                id: new ObjectId().toHexString(),
                timestamp: new Date().toISOString(),
                userId: user.userId,
                username: user.username,
                action: 'CRIADA',
                details: `Cotação de Fulfillment criada a partir de expedição.`
            }]
        };

        const resultQuote = await db.collection('quotes').insertOne(newQuote as any);

        // 3. Atualizar Status do Expedition
        await db.collection('expedition_requests').updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    status: 'Expedido',
                    processedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    items: expedition.items,
                    fulfilledQuoteId: resultQuote.insertedId.toHexString()
                }
            }
        );

        return NextResponse.json({ message: 'Picking concluído e cotação gerada com sucesso!' });

    } catch (error: any) {
        console.error('API Pickup Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
