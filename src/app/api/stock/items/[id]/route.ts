
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import type { StockItem, StockPosition } from '@/lib/types';

import { getUserFromRequest } from '@/lib/auth-api';
import { logStockMovement } from '@/lib/stock-logs';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
    }

    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const id = parts[parts.length - 1];

    const { sku, name, description, quantity, positionId, isMoveOperation, companyId, nfNumber, batch, expirationDate, reason } = await request.json();
    
    if (!ObjectId.isValid(id) || (!isMoveOperation && (!sku || !name || !quantity || !positionId))) {
      return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    const originalItem = await db.collection<StockItem>('stock_items').findOne({ _id: new ObjectId(id) });
    if (!originalItem) {
        return NextResponse.json({ message: "Item original não encontrado." }, { status: 404 });
    }

    let updates: Partial<Omit<StockItem, 'id'>>;
    let movementType: any = null;

    // Handle a move operation
    if (isMoveOperation && positionId) {
        if (!ObjectId.isValid(positionId)) {
            return NextResponse.json({ message: "ID da nova posição é inválido." }, { status: 400 });
        }
        
        const newPosition = await db.collection<StockPosition>('stock_positions').findOne({ _id: new ObjectId(positionId) });
        if (!newPosition || (newPosition.status !== 'Vazio' && newPosition.name !== 'RECEBIMENTO')) {
            return NextResponse.json({ message: "Nova posição não está disponível ou não foi encontrada." }, { status: 404 });
        }

        // Get the origin position details (for quoteId/quoteCode) BEFORE any changes
        const originalPosition = await db.collection<StockPosition>('stock_positions').findOne({ _id: new ObjectId(originalItem.positionId) });

        // Check if there are OTHER items still in the old position
        const otherItemsInOldPosition = await db.collection('stock_items').countDocuments({
            positionId: originalItem.positionId,
            _id: { $ne: new ObjectId(id) }
        });

        // Only free up the old position if no other items remain AND it's not RECEBIMENTO
        if (otherItemsInOldPosition === 0 && originalPosition?.name !== 'RECEBIMENTO') {
            await db.collection('stock_positions').updateOne(
                { _id: new ObjectId(originalItem.positionId) },
                { $set: { status: 'Vazio', quoteId: undefined, quoteCode: undefined, occupiedAt: null, updatedAt: new Date().toISOString() } }
            );
        }

        // Occupy the new position
        const positionUpdate: Partial<StockPosition> = {
            status: 'Ocupado',
            updatedAt: new Date().toISOString(),
            occupiedAt: new Date().toISOString()
        };

        // Carry over quoteId/quoteCode from origin if it had one
        if (originalPosition?.quoteId) {
            positionUpdate.quoteId = originalPosition.quoteId;
            positionUpdate.quoteCode = originalPosition.quoteCode;
        }

        await db.collection('stock_positions').updateOne(
            { _id: new ObjectId(positionId) },
            { $set: positionUpdate }
        );

        updates = { 
            positionId,
            positionName: newPosition.name,
            lastActivity: new Date().toISOString(),
        };
        movementType = 'TRANSFER';

    // Handle a regular update
    } else {
        const position = await db.collection('stock_positions').findOne({ _id: new ObjectId(positionId) });
        if (!position) {
            return NextResponse.json({ message: "Posição de estoque não encontrada." }, { status: 404 });
        }

        let companyName = undefined;
        if (companyId) {
            try {
                const comp = await db.collection('client_companies').findOne({ _id: new ObjectId(companyId) });
                if(comp) companyName = comp.nomeFantasia || comp.razaoSocial;
            } catch (e) {}
        }

        updates = {
          sku,
          name,
          description,
          quantity,
          positionId,
          positionName: position.name,
          companyId,
          companyName,
          nfNumber,
          batch: batch || originalItem.batch || '',
          expirationDate: expirationDate || originalItem.expirationDate || '',
          lastActivity: new Date().toISOString(),
        };
        
        if (quantity !== originalItem.quantity) {
            movementType = 'ADJUSTMENT';
        }
    }

    const result = await db.collection('stock_items').updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "Item não encontrado" }, { status: 404 });
    }

    if (movementType) {
        await logStockMovement(db, { id, sku: updates.sku || originalItem.sku, name: updates.name || originalItem.name, companyId: updates.companyId || originalItem.companyId, companyName: updates.companyName || originalItem.companyName }, {
            type: movementType,
            quantity: updates.quantity || originalItem.quantity,
            fromPositionId: originalItem.positionId,
            fromPositionName: originalItem.positionName,
            toPositionId: updates.positionId || originalItem.positionId,
            toPositionName: updates.positionName || originalItem.positionName,
            reason: reason || (movementType === 'TRANSFER' ? 'Transferência de posição' : 'Ajuste de inventário'),
            user: user
        });

        if (movementType === 'TRANSFER') {
            // Mark target position as Occupied
            if (updates.positionId) {
                await db.collection('stock_positions').updateOne(
                    { _id: new ObjectId(updates.positionId) },
                    { $set: { status: 'Ocupado', updatedAt: new Date().toISOString() } }
                );
            }
            
            // Check origin position and mark as Empty if it has no items left
            if (originalItem.positionId) {
                const itemsInOrigin = await db.collection('stock_items').countDocuments({
                    positionId: originalItem.positionId,
                    quantity: { $gt: 0 } // Only count items that actually have quantity
                });
                
                if (itemsInOrigin === 0) {
                    await db.collection('stock_positions').updateOne(
                        { _id: new ObjectId(originalItem.positionId) },
                        { $set: { status: 'Vazio', updatedAt: new Date().toISOString() } }
                    );
                }
            }
        }
    }
    
    return NextResponse.json({ message: "Item atualizado com sucesso" }, { status: 200 });

  } catch (error: any) {
    console.error('API Stock Item PUT Error:', error);
    return NextResponse.json({ message: `Erro ao atualizar item: ${error.message}` }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const user = getUserFromRequest(request);
        if (!user) {
          return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
        }

        const pathname = new URL(request.url).pathname;
        const parts = pathname.split('/');
        const id = parts[parts.length - 1];

        if (!ObjectId.isValid(id)) {
            return NextResponse.json({ message: "ID de item inválido" }, { status: 400 });
        }

        const { db } = await connectToDatabase();
        
        const item = await db.collection<StockItem>('stock_items').findOne({ _id: new ObjectId(id) });
        if (!item) {
            return NextResponse.json({ message: "Item não encontrado" }, { status: 404 });
        }

        const result = await db.collection('stock_items').deleteOne({ _id: new ObjectId(id) });
        
        if (result.deletedCount === 0) {
            return NextResponse.json({ message: "Item não encontrado" }, { status: 404 });
        }

        // Log the EXIT movement
        await logStockMovement(db, { id, sku: item.sku, name: item.name, companyId: item.companyId, companyName: item.companyName }, {
            type: 'EXIT',
            quantity: item.quantity,
            fromPositionId: item.positionId,
            fromPositionName: item.positionName,
            reason: 'Remoção de estoque (Baixa)',
            user: user
        });

        // Liberar posição se era o último item nela
        const remainingItems = await db.collection('stock_items').countDocuments({ positionId: item.positionId });
        if (remainingItems === 0 && item.positionName !== 'RECEBIMENTO') {
            await db.collection('stock_positions').updateOne(
                { _id: new ObjectId(item.positionId) },
                { $set: { status: 'Vazio', quoteId: undefined, quoteCode: undefined, occupiedAt: null, updatedAt: new Date().toISOString() } }
            );
        }

        return NextResponse.json({ message: "Item apagado com sucesso" }, { status: 200 });
    } catch (error: any) {
        console.error('API Stock Item DELETE Error:', error);
        return NextResponse.json({ message: `Erro ao apagar item: ${error.message}` }, { status: 500 });
    }
}
