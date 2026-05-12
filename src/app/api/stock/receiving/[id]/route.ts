import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { getUserFromRequest } from '@/lib/auth-api';
import { ObjectId } from 'mongodb';
import { logStockMovement } from '@/lib/stock-logs';

// GET: Get a single receiving batch with its items
export async function GET(request: Request, context: any) {
    try {
        const user = getUserFromRequest(request);
        if (!user || (user.role !== 'admin' && user.role !== 'user')) {
            return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
        }

        const params = await context.params;
        const id = params?.id;

        if (!id || !ObjectId.isValid(id)) {
            return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
        }

        const { db } = await connectToDatabase();
        const batch = await db.collection('receiving_batches').findOne({ _id: new ObjectId(id) });
        if (!batch) {
            return NextResponse.json({ error: 'Lote de recebimento não encontrado' }, { status: 404 });
        }

        // Fetch items belonging to this batch
        const itemIds = (batch.items || []).map((itemId: string) => {
            try { return new ObjectId(itemId); } catch { return null; }
        }).filter(Boolean);

        const items = await db.collection('stock_items')
            .find({ _id: { $in: itemIds } })
            .toArray();

        const mappedItems = items.map(item => {
            const { _id, ...rest } = item;
            return { id: _id.toHexString(), ...rest };
        });

        // Fetch available pallets of same client for consolidation suggestion
        let availablePallets: any[] = [];
        if (batch.companyId && batch.unitType === 'PALETES') {
            const existingItems = await db.collection('stock_items')
                .find({
                    companyId: batch.companyId,
                    status: 'Disponível',
                    unitType: 'PALETES',
                    positionName: { $ne: 'RECEBIMENTO' }
                })
                .toArray();

            // Group by position to show which pallets have space
            const positionMap = new Map<string, { positionId: string; positionName: string; itemCount: number; items: string[] }>();
            for (const item of existingItems) {
                const key = item.positionId;
                if (!positionMap.has(key)) {
                    positionMap.set(key, {
                        positionId: item.positionId,
                        positionName: item.positionName,
                        itemCount: 0,
                        items: []
                    });
                }
                const entry = positionMap.get(key)!;
                entry.itemCount++;
                entry.items.push(item.name);
            }
            availablePallets = Array.from(positionMap.values());
        }

        const { _id: batchOid, ...batchRest } = batch;

        return NextResponse.json({
            batch: { id: batchOid.toHexString(), ...batchRest },
            items: mappedItems,
            availablePallets
        }, { status: 200 });

    } catch (error: any) {
        console.error('API /api/stock/receiving/[id] GET Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT: Confirm conference — update items, set positions, handle divergences
export async function PUT(request: Request, context: any) {
    try {
        const user = getUserFromRequest(request);
        if (!user || (user.role !== 'admin' && user.role !== 'user')) {
            return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
        }

        const params = await context.params;
        const id = params?.id;

        if (!id || !ObjectId.isValid(id)) {
            return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
        }

        const body = await request.json();
        console.log(`[ReceivingAPI] PUT Action: ${body.action}, Body:`, JSON.stringify(body, null, 2));
        const { items, palletConfig, addedItems, action } = body;
        // action: 'conferir', 'montar' ou 'posicionar'

        const { db } = await connectToDatabase();
        const batch = await db.collection('receiving_batches').findOne({ _id: new ObjectId(id) });
        if (!batch) {
            return NextResponse.json({ error: 'Lote não encontrado' }, { status: 404 });
        }

        if (batch.status === 'Finalizado') {
            return NextResponse.json({ error: 'Este lote já foi conferido' }, { status: 400 });
        }

        // ---------- AÇÃO: POSICIONAR (Terceira etapa para Paletes) ----------
        if (action === 'posicionar') {
            const { palletAllocations } = body;
            // palletAllocations: [{ palletNumber: 1, positionId: '...' }, ...]

            const positions = await db.collection('stock_positions').find({}).toArray();
            const positionMap = new Map(positions.map(p => [p._id.toString(), p]));

            for (const alloc of (palletAllocations || [])) {
                if (!alloc.positionId) continue;
                const position = positionMap.get(alloc.positionId);
                const posName = position ? position.name : 'RECEBIMENTO';

                // Move all items of this pallet
                await db.collection('stock_items').updateMany(
                    { receivingBatchId: id, palletNumber: alloc.palletNumber },
                    { $set: { positionId: alloc.positionId, positionName: posName, status: 'Disponível' } }
                );

                if (position) {
                    await db.collection('stock_positions').updateOne(
                        { _id: position._id },
                        { $set: { status: 'Ocupado', updatedAt: new Date().toISOString(), occupiedAt: new Date().toISOString() } }
                    );
                }

                // Log movement for all items in this pallet
                const palletItems = await db.collection('stock_items').find({ receivingBatchId: id, palletNumber: alloc.palletNumber }).toArray();
                for (const item of palletItems) {
                    await logStockMovement(db, {
                        id: item._id.toString(), sku: item.sku, name: item.name,
                        companyId: item.companyId, companyName: item.companyName
                    }, {
                        type: 'TRANSFER',
                        quantity: item.quantity,
                        fromPositionId: item.positionId, // 'RECEBIMENTO'
                        fromPositionName: 'RECEBIMENTO',
                        toPositionId: alloc.positionId,
                        toPositionName: posName,
                        reason: `Alocação de Palete ${alloc.palletNumber} - Posição ${posName}`,
                        user: user as any
                    });
                }
            }

            await db.collection('receiving_batches').updateOne(
                { _id: new ObjectId(id) },
                { $set: { status: 'Finalizado', conferredAt: new Date().toISOString(), conferredBy: user.username } }
            );

            // Liberar RECEBIMENTO
            const receivingPos = await db.collection('stock_positions').findOne({ name: 'RECEBIMENTO' });
            if (receivingPos) {
                const remaining = await db.collection('stock_items').countDocuments({ positionId: receivingPos._id.toString() });
                if (remaining === 0) {
                    await db.collection('stock_positions').updateOne(
                        { _id: receivingPos._id },
                        { $set: { status: 'Vazio', updatedAt: new Date().toISOString() } }
                    );
                }
            }

            const labelsData = (palletAllocations || []).map((alloc: any) => {
                const pos = positionMap.get(alloc.positionId);
                return {
                    id: `PAL-${batch.nfNumber}-${alloc.palletNumber}`,
                    title: `NF: ${batch.nfNumber} | Palete: ${alloc.palletNumber}`,
                    subtitle: `Posição: ${pos ? pos.name : 'N/A'}`,
                    footer: `Data: ${new Date().toLocaleDateString('pt-BR')} | ${batch.companyName.substring(0, 20)}`,
                    barcodeValue: `PAL-${batch.nfNumber}-${alloc.palletNumber}`
                }
            });

            return NextResponse.json({ message: 'Paletes posicionados com sucesso.', status: 'Finalizado', labels: labelsData }, { status: 200 });
        }

        // ---------- AÇÃO: MONTAR (Segunda etapa - montar paletes manualmente) ----------
        if (action === 'montar') {
            const { palletAssignments } = body;
            // palletAssignments: [{ itemId: '...', palletNumber: 1, quantity: 20 }, ...]

            if (!palletAssignments || !Array.isArray(palletAssignments)) {
                return NextResponse.json({ error: 'Nenhuma atribuição de palete recebida.' }, { status: 400 });
            }

            console.log(`[Receiving] Batch ${id}: processing ${palletAssignments.length} pallet assignments`);

            // Group assignments by itemId to handle splitting
            const assignmentsByItem = palletAssignments.reduce((acc: any, curr: any) => {
                if (!acc[curr.itemId]) acc[curr.itemId] = [];
                acc[curr.itemId].push(curr);
                return acc;
            }, {});

            const newItemsIds: string[] = [];

            for (const [itemId, assignments] of Object.entries(assignmentsByItem) as [string, any[]][]) {
                if (!ObjectId.isValid(itemId)) continue;

                const originalItem = await db.collection('stock_items').findOne({ _id: new ObjectId(itemId) });
                if (!originalItem) {
                    console.warn(`[Receiving] Item ${itemId} not found during assembly - skipping`);
                    continue;
                }

                // SECURITY FALLBACK: Se o total atribuído for 0, mas temos quantidade na NF, distribuímos equitativamente
                const totalAssigned = assignments.reduce((sum: number, a: any) => sum + (Number(a.quantity) || 0), 0);
                let finalAssignments = assignments;

                if (totalAssigned === 0 && originalItem.quantityNf > 0) {
                    const qtyPerPallet = Math.floor(originalItem.quantityNf / assignments.length);
                    const remainder = originalItem.quantityNf % assignments.length;
                    
                    finalAssignments = assignments.map((a: any, idx: number) => ({
                        ...a,
                        quantity: idx === 0 ? qtyPerPallet + remainder : qtyPerPallet
                    }));
                    console.log(`[ReceivingAssembly] SKU ${originalItem.sku}: Quantidade 0 detectada no frontend. Redistribuindo ${originalItem.quantityNf} entre ${assignments.length} paletes.`);
                }

                // First assignment updates the original item
                const firstAssignment = finalAssignments[0];
                const assemblyQty = Number(firstAssignment.quantity);

                await db.collection('stock_items').updateOne(
                    { _id: new ObjectId(itemId) },
                    {
                        $set: {
                            palletNumber: firstAssignment.palletNumber,
                            quantity: assemblyQty,
                            lastActivity: new Date().toISOString()
                        }
                    }
                );

                // Subsequent assignments create new cloned items for the splits
                for (let i = 1; i < finalAssignments.length; i++) {
                    const assignment = finalAssignments[i];
                    const { _id, ...itemData } = originalItem;
                    
                    const splitQty = Number(assignment.quantity);
                    
                    const newItem = {
                        ...itemData,
                        quantity: splitQty,
                        palletNumber: assignment.palletNumber,
                        lastActivity: new Date().toISOString(),
                        createdAt: new Date().toISOString(),
                        _id: new ObjectId() // Novo ID para o item fracionado
                    };

                    const result = await db.collection('stock_items').insertOne(newItem);
                    newItemsIds.push(result.insertedId.toString());
                    console.log(`[Receiving] Item ${itemId} split: created new item ${result.insertedId} for pallet ${assignment.palletNumber} with qty ${splitQty}`);
                }
            }

            // Update the batch items list to include any new items created from splits
            if (newItemsIds.length > 0) {
                const currentBatchItems = batch.items || [];
                const updatedBatchItems = [...new Set([...currentBatchItems, ...newItemsIds])];
                await db.collection('receiving_batches').updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { items: updatedBatchItems, mountedAt: new Date().toISOString(), mountedBy: user.username } }
                );
            } else {
                await db.collection('receiving_batches').updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { mountedAt: new Date().toISOString(), mountedBy: user.username } }
                );
            }

            await db.collection('receiving_batches').updateOne(
                { _id: new ObjectId(id) },
                { $set: { status: 'Posicionar', updatedAt: new Date().toISOString() } }
            );

            return NextResponse.json({ 
                message: 'Paletização concluída. Prossiga para o posicionamento.', 
                status: 'Posicionar',
                newItemsCount: newItemsIds.length
            }, { status: 200 });
        }

        // ---------- AÇÃO: REVERTER PARA PENDENTE ----------
        if (action === 'revert_to_pendente') {
            await db.collection('receiving_batches').updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        status: 'Pendente',
                        lastActivity: new Date().toISOString()
                    }
                }
            );

            // Se os itens já foram divididos, o ideal seria re-consolidar, 
            // mas como "Montar" é a etapa atual e a pessoa quer retroceder, 
            // isso significa que os itens ainda estão no estado original de conferência,
            // ou talvez já tenham sido salvos? Na verdade, se estava em "Montar",
            // os dados foram salvos no banco como `conferidos` e divididos apenas se passou para Posicionar.
            // Se está em Montar, a conferência foi concluída e os itens estão na posição RECEBIMENTO, unificados.
            // Apenas mudamos o status do batch.
            return NextResponse.json({ message: 'Status revertido para Pendente.', status: 'Pendente' }, { status: 200 });
        }

        // ---------- AÇÃO: CONFERIR (Primeira etapa) ----------
        let hasDivergence = false;
        const positions = await db.collection('stock_positions').find({}).toArray();
        const positionMap = new Map(positions.map(p => [p._id.toString(), p]));

        // Process existing items (update quantity, position, mark removed)
        for (const itemUpdate of (items || [])) {
            if (!ObjectId.isValid(itemUpdate.id)) continue;

            const existingItem = await db.collection('stock_items').findOne({ _id: new ObjectId(itemUpdate.id) });
            if (!existingItem) continue;

            if (itemUpdate.removed) {
                // Item was on NF but not physically received — remover do banco
                hasDivergence = true;
                await db.collection('stock_items').deleteOne({ _id: new ObjectId(itemUpdate.id) });
                // Log the removal
                await logStockMovement(db, {
                    id: itemUpdate.id, sku: existingItem.sku, name: existingItem.name,
                    companyId: existingItem.companyId, companyName: existingItem.companyName
                }, {
                    type: 'EXIT',
                    quantity: existingItem.quantity,
                    fromPositionId: existingItem.positionId,
                    fromPositionName: existingItem.positionName,
                    reason: `Conferência: Item ausente na carga física (NF ${batch.nfNumber})`,
                    user: user as any
                });
                continue;
            }

            let newQty = itemUpdate.quantity;
            if (newQty === undefined || newQty === null) {
                newQty = existingItem.quantity;
            }
            
            // Se a quantidade enviada for 0 mas a original era > 0, e o item não foi marcado como removido,
            // pode ser um erro de preenchimento. Vamos manter a quantidade original se for o caso.
            if (newQty === 0 && !itemUpdate.removed && existingItem.quantityNf > 0) {
                newQty = existingItem.quantityNf;
            }

            let newPositionId = itemUpdate.positionId || existingItem.positionId;
            const position = positionMap.get(newPositionId);
            let newPositionName = position ? position.name : existingItem.positionName;

            if (newQty !== existingItem.quantityNf) {
                hasDivergence = true;
            }

            // Se for PALETES (original ou definido na conferência), ainda não posiciona, só ajusta a quantidade
            if (palletConfig?.isPalletized || batch.unitType === 'PALETES') {
                newPositionId = existingItem.positionId; // keeps in RECEBIMENTO
                newPositionName = existingItem.positionName;
            }

            console.log(`[ReceivingConference] Updating ItemID: ${itemUpdate.id}, Final Qty: ${newQty}, Status: ${(palletConfig?.isPalletized || batch.unitType === 'PALETES') ? 'Em Conferência' : 'Disponível'}`);

            const updateFields: any = {
                status: (palletConfig?.isPalletized || batch.unitType === 'PALETES') ? 'Em Conferência' : 'Disponível',
                quantity: Number(newQty),
                positionId: newPositionId,
                positionName: newPositionName,
                conferenceNotes: itemUpdate.conferenceNotes || '',
                lastActivity: new Date().toISOString()
            };

            await db.collection('stock_items').updateOne(
                { _id: new ObjectId(itemUpdate.id) },
                { $set: updateFields }
            );

            // Update position status if it moved (only for NON-PALETES)
            if (!(palletConfig?.isPalletized || batch.unitType === 'PALETES') && position) {
                await db.collection('stock_positions').updateOne(
                    { _id: position._id },
                    { $set: { status: 'Ocupado', updatedAt: new Date().toISOString(), occupiedAt: new Date().toISOString() } }
                );
            }

            // Log transfer if position changed
            if (newPositionId !== existingItem.positionId) {
                await logStockMovement(db, {
                    id: itemUpdate.id, sku: existingItem.sku, name: existingItem.name,
                    companyId: existingItem.companyId, companyName: existingItem.companyName
                }, {
                    type: 'TRANSFER',
                    quantity: newQty,
                    fromPositionId: existingItem.positionId,
                    fromPositionName: existingItem.positionName,
                    toPositionId: newPositionId,
                    toPositionName: newPositionName,
                    reason: `Conferência: Alocação para posição ${newPositionName}`,
                    user: user as any
                });
            }

            // Log adjustment if quantity changed
            if (newQty !== existingItem.quantity) {
                await logStockMovement(db, {
                    id: itemUpdate.id, sku: existingItem.sku, name: existingItem.name,
                    companyId: existingItem.companyId, companyName: existingItem.companyName
                }, {
                    type: 'ADJUSTMENT',
                    quantity: newQty - existingItem.quantity,
                    toPositionId: newPositionId,
                    toPositionName: newPositionName,
                    reason: `Conferência: Ajuste de quantidade (NF: ${existingItem.quantityNf} → Real: ${newQty})`,
                    user: user as any
                });
            }
        }

        // Process manually added items (not in the NF)
        const newItemIds: string[] = [];
        for (const added of (addedItems || [])) {
            hasDivergence = true;
            const posId = added.positionId;
            const position = positionMap.get(posId);

            const newItem = {
                sku: added.sku || 'MANUAL',
                name: added.name,
                quantity: added.quantity || 1,
                positionId: posId || batch.items?.[0]?.positionId || '',
                positionName: position ? position.name : 'RECEBIMENTO',
                companyId: batch.companyId,
                companyName: batch.companyName,
                nfNumber: batch.nfNumber,
                batch: added.batch || '',
                expirationDate: added.expirationDate || '',
                status: (palletConfig?.isPalletized || batch.unitType === 'PALETES') ? 'Em Conferência' : 'Disponível',
                unitType: palletConfig?.isPalletized ? 'PALETES' : batch.unitType,
                receivingBatchId: id,
                conferenceNotes: 'Item adicionado manualmente na conferência',
                createdAt: new Date().toISOString(),
                lastActivity: new Date().toISOString(),
                importSource: 'conference_manual',
            };

            const result = await db.collection('stock_items').insertOne(newItem);
            const newItemId = result.insertedId.toString();
            newItemIds.push(newItemId);

            await logStockMovement(db, {
                id: newItemId, sku: newItem.sku, name: newItem.name,
                companyId: newItem.companyId, companyName: newItem.companyName
            }, {
                type: 'ENTRY',
                quantity: newItem.quantity,
                toPositionId: newItem.positionId,
                toPositionName: newItem.positionName,
                reason: `Conferência: Item extra não constante na NF ${batch.nfNumber}`,
                user: user as any
            });
        }

        // Calcular IDs finais e status
        const allItemsIds = [...(batch.items || []), ...newItemIds];

        let finalStatus = hasDivergence ? 'Com Divergência' : 'Finalizado';
        let nfQVolToSave = batch.nfQVol;

        if (palletConfig?.isPalletized || batch.unitType === 'PALETES') {
            // Para PALETES: ir para 'Montar' (etapa de montagem manual dos paletes)
            finalStatus = 'Montar';
            const numPallets = palletConfig?.palletCount || 1;
            nfQVolToSave = numPallets; // salvar qtd de paletes definida pelo usuário

            // Pré-distribuir itens via Round Robin como sugestão inicial
            const currentItems = await db.collection('stock_items').find({ _id: { $in: allItemsIds.map((id: string) => new ObjectId(id)) } }).toArray();
            const activeItems = currentItems.filter(i => i.status !== 'Vazio');
            for (let i = 0; i < activeItems.length; i++) {
                const palletNum = (i % numPallets) + 1;
                await db.collection('stock_items').updateOne(
                    { _id: activeItems[i]._id },
                    { $set: { palletNumber: palletNum, receivingBatchId: id, palletCount: numPallets } }
                );
            }
        }

        // Update batch status
        await db.collection('receiving_batches').updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    status: finalStatus,
                    conferredAt: (finalStatus !== 'Posicionar' && finalStatus !== 'Montar') ? new Date().toISOString() : undefined,
                    conferredBy: (finalStatus !== 'Posicionar' && finalStatus !== 'Montar') ? user.username : undefined,
                    totalItemsReal: (items || []).filter((i: any) => !i.removed).length + (addedItems || []).length,
                    nfQVol: nfQVolToSave,
                    items: allItemsIds,
                    // Persist palletized flag even for batches that didn't start as PALETES
                    ...(palletConfig?.isPalletized ? { unitType: 'PALETES' } : {})
                }
            }
        );

        // Liberar posição RECEBIMENTO se não há mais itens nela (só se já finalizou)
        if (finalStatus !== 'Posicionar' && finalStatus !== 'Montar') {
            const receivingPos = await db.collection('stock_positions').findOne({ name: 'RECEBIMENTO' });
            if (receivingPos) {
                const remainingInReceiving = await db.collection('stock_items').countDocuments({
                    positionId: receivingPos._id.toString()
                });
                if (remainingInReceiving === 0) {
                    await db.collection('stock_positions').updateOne(
                        { _id: receivingPos._id },
                        { $set: { status: 'Vazio', updatedAt: new Date().toISOString() } }
                    );
                }
            }
        }

        return NextResponse.json({
            message: `Conferência concluída${hasDivergence ? ' com divergências registradas' : ''}.`,
            status: finalStatus,
            hasDivergence
        }, { status: 200 });

    } catch (error: any) {
        console.error('API /api/stock/receiving/[id] PUT Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE: Excluir lote de recebimento e itens pendentes associados
export async function DELETE(request: Request, context: any) {
    try {
        const user = getUserFromRequest(request);
        if (!user || (user.role !== 'admin' && user.role !== 'user')) {
            return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
        }

        const params = await context.params;
        const id = params?.id;

        if (!id || !ObjectId.isValid(id)) {
            return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
        }

        const { db } = await connectToDatabase();

        // Find the batch first
        const batch = await db.collection('receiving_batches').findOne({ _id: new ObjectId(id) });
        if (!batch) {
            return NextResponse.json({ error: 'Lote não encontrado' }, { status: 404 });
        }

        // Se quiser impedir exclusão de lotes já conferidos, descomente:
        // if (batch.status !== 'Pendente') {
        //     return NextResponse.json({ error: 'Apenas lotes pendentes podem ser excluídos' }, { status: 400 });
        // }

        // Find associated items that are "Em Conferência"
        const itemIds = (batch.items || []).map((itemId: string) => {
            try { return new ObjectId(itemId); } catch { return null; }
        }).filter(Boolean);

        if (itemIds.length > 0) {
            // Remove all stock items associated with this batch
            await db.collection('stock_items').deleteMany({
                _id: { $in: itemIds }
            });
        }

        // Delete the batch
        await db.collection('receiving_batches').deleteOne({ _id: new ObjectId(id) });

        return NextResponse.json({ message: 'Lote de recebimento excluído com sucesso.' }, { status: 200 });

    } catch (error: any) {
        console.error('API /api/stock/receiving/[id] DELETE Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
