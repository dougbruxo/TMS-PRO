
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import type { StockItem } from '@/lib/types';
import { ObjectId } from 'mongodb';
import { getUserFromRequest } from '@/lib/auth-api';

import { logStockMovement } from '@/lib/stock-logs';

export async function GET(request: Request) {
  try {
    const user = getUserFromRequest(request);
    const { searchParams } = new URL(request.url);
    const clientMode = searchParams.get('clientMode');
    const q = searchParams.get('q');

    let filter: any = {};
    if (user?.role === 'cliente' || user?.role === 'sub-cliente' || clientMode === '1') {
         const { db } = await connectToDatabase();
         const effectiveId = user?.effectiveUserId || user?.userId;
         
         if (!effectiveId) {
             return NextResponse.json([]); // No access without a valid ID
         }

         const userCompanys = await db.collection('client_companies').find({ userId: effectiveId }).toArray(); 
         const companyIds = userCompanys.map(c => c._id.toHexString());
         
         // Only show items whose companyId matches one of the user's companies
         // AND that are not pending conference
         filter = { companyId: { $in: companyIds }, status: { $ne: 'Em Conferência' } };
    }
    
    if (q) {
        filter.$or = [
            { sku: { $regex: q, $options: 'i' } },
            { name: { $regex: q, $options: 'i' } },
            { companyName: { $regex: q, $options: 'i' } }
        ];
    }

    const { db } = await connectToDatabase();
    const items = await db.collection('stock_items').find(filter).sort({ lastActivity: -1 }).toArray();
    
    const itemsWithId = items.map(item => {
      const { _id, ...rest } = item;
      return { id: _id.toHexString(), ...rest };
    });

    return NextResponse.json(itemsWithId);
  } catch (error: any) {
    console.error('API Stock Items GET Error:', error);
    return NextResponse.json({ message: `Erro ao buscar itens: ${error.message}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
    try {
        const user = getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
        }

        const { sku, name, description, quantity, positionId, companyId, nfNumber, batch, expirationDate } = await request.json();

        if (!sku || !name || !quantity || !positionId) {
            return NextResponse.json({ message: "Dados obrigatórios em falta." }, { status: 400 });
        }

        const { db } = await connectToDatabase();
        
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

        const newItem: Omit<StockItem, 'id'> = {
            sku,
            name,
            description,
            quantity,
            positionId,
            positionName: position.name,
            companyId,
            companyName,
            nfNumber,
            batch: batch || '',
            expirationDate: expirationDate || '',
            lastActivity: new Date().toISOString(),
            status: 'Disponível',
        };
        
        const result = await db.collection('stock_items').insertOne(newItem as any);
        const createdItem = { id: result.insertedId.toHexString(), ...newItem };

        // Marcar posição como Ocupada
        await db.collection('stock_positions').updateOne(
            { _id: new ObjectId(positionId) },
            { $set: { status: 'Ocupado', updatedAt: new Date().toISOString(), occupiedAt: new Date().toISOString() } }
        );

        // Log the ENTRY movement
        await logStockMovement(db, createdItem, {
            type: 'ENTRY',
            quantity: newItem.quantity,
            toPositionId: positionId,
            toPositionName: position.name,
            reason: 'Entrada manual de estoque',
            user: user
        });

        return NextResponse.json(createdItem, { status: 201 });

    } catch (error: any) {
        console.error('API Stock Items POST Error:', error);
        return NextResponse.json({ message: `Erro ao criar item: ${error.message}` }, { status: 500 });
    }
}
