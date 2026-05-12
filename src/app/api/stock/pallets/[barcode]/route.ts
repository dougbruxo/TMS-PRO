import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { getUserFromRequest } from '@/lib/auth-api';
import { ObjectId } from 'mongodb';

export async function GET(request: Request, context: { params: Promise<{ barcode: string }> }) {
    try {
        const user = getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
        }

        const params = await context.params;
        const { barcode } = params;

        // Formato esperado: PAL-{NF_NUMBER}-{PALLET_NUMBER}
        const match = barcode.toUpperCase().match(/^PAL-(.+)-(\d+)$/);
        
        if (!match) {
            return NextResponse.json({ error: 'Formato de etiqueta de palete inválido.' }, { status: 400 });
        }

        const nfNumber = match[1];
        const palletNumber = parseInt(match[2], 10);

        const { db } = await connectToDatabase();

        console.log(`[PalletLookup] Searching for NF: ${nfNumber}, Pallet: ${palletNumber}`);

        // Buscar todos os itens de estoque que correspondem a essa NF e número de palete
        // nfNumber no banco pode ser string ou number devido ao parse de XML
        // Também tentamos buscar pelo batchId se o nfNumber for o ID do lote
        const query: any = {
            palletNumber: palletNumber,
            $or: [
                { nfNumber: nfNumber },
                { nfNumber: parseInt(nfNumber, 10) },
                { receivingBatchId: nfNumber }
            ]
        };

        const { searchParams } = new URL(request.url);
        const expeditionId = searchParams.get('expeditionId');
        console.log(`[PalletLookup] Expedition context: ${expeditionId}`);

        const items = await db.collection('stock_items').find(query).toArray();
        
        let mappedItems = items;
        if (expeditionId && expeditionId !== 'undefined' && ObjectId.isValid(expeditionId)) {
            console.log(`[PalletLookup] Valid expeditionId found: ${expeditionId}`);
            const expedition = await db.collection('expedition_requests').findOne({ _id: new ObjectId(expeditionId) });
            if (expedition) {
                console.log(`[PalletLookup] Expedition found, items: ${expedition.items?.length}`);
                
                // Build a DIRECT map: stockItemId → quantityRequested for that specific stock item
                // Each expedition item has stockItemIds[0] pointing to the exact stock_item
                // and quantityRequested is the quantity reserved from THAT specific stock_item
                const stockIdToQty: Record<string, number> = {};
                const skuSet = new Set<string>();

                expedition.items.forEach((item: any) => {
                    if (item.sku) {
                        skuSet.add(String(item.sku).toLowerCase());
                    }
                    if (item.stockItemIds && item.stockItemIds[0]) {
                        stockIdToQty[String(item.stockItemIds[0])] = item.quantityRequested;
                    }
                });

                console.log(`[PalletLookup] StockId map has ${Object.keys(stockIdToQty).length} entries`);

                mappedItems = items.map(item => {
                    const itemIdStr = item._id.toHexString();
                    const itemSku = String(item.sku || '').toLowerCase();
                    
                    // Direct match: this exact stock_item was reserved in the expedition
                    const directQty = stockIdToQty[itemIdStr];
                    if (directQty !== undefined) {
                        console.log(`[PalletLookup] Item ${itemIdStr} SKU=${item.sku} DIRECT match → qty=${directQty}`);
                        return {
                            ...item,
                            isReservedForThisOrder: true,
                            effectiveQuantity: directQty
                        };
                    }
                    
                    // SKU match fallback: this SKU is in the expedition but this specific item wasn't directly reserved
                    if (skuSet.has(itemSku)) {
                        // Use 1 as minimum picking unit - the pallet has this SKU so it's relevant
                        const fallbackQty = item.quantityNf || item.quantity || 1;
                        console.log(`[PalletLookup] Item ${itemIdStr} SKU=${item.sku} SKU-match fallback → qty=${fallbackQty}`);
                        return {
                            ...item,
                            isReservedForThisOrder: true,
                            effectiveQuantity: fallbackQty
                        };
                    }
                    
                    return item;
                });
            } else {
                console.warn(`[PalletLookup] Expedition ${expeditionId} not found`);
            }
        }

        console.log(`[PalletLookup] Found ${mappedItems.length} items for pallet ${barcode}`);
        
        return NextResponse.json(mappedItems);
    } catch (error: any) {
        console.error('Pallet lookup error:', error);
        return NextResponse.json({ error: error.message || 'Erro ao buscar palete' }, { status: 500 });
    }
}
