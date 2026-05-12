
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import type { QuoteHistoryEvent, User } from '@/lib/types';
import { getUserFromRequest } from '@/lib/auth-api';

export async function POST(request: Request) {
  try {
    const authUser = getUserFromRequest(request);
    if (!authUser) return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });

    const { quoteIds, newUserId } = await request.json();

    if (!Array.isArray(quoteIds) || quoteIds.length === 0 || !newUserId || !ObjectId.isValid(newUserId)) {
      return NextResponse.json({ message: 'IDs de cotação ou novo utilizador inválidos.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    const newUser = await db.collection('users').findOne({ _id: new ObjectId(newUserId) });
    if (!newUser) {
      return NextResponse.json({ message: 'Utilizador de destino não encontrado.' }, { status: 404 });
    }

    const tenantId = authUser.role === 'sub-cliente' ? authUser.parentId : authUser.userId;

    // Verificar se o usuário de destino pertence ao mesmo Tenant (só restringe clientes)
    if (authUser.role === 'cliente' || authUser.role === 'sub-cliente') {
        const destTenantId = newUser.isSubClient ? newUser.parentId : newUser._id.toHexString();
        if (destTenantId !== tenantId) {
            return NextResponse.json({ message: 'Acesso negado: O utilizador de destino não pertence à sua conta.' }, { status: 403 });
        }
    }

    const objectQuoteIds = quoteIds.map(id => new ObjectId(id));
    
    // Filtro de segurança: As cotações devem pertencer ao Tenant ou o usuário ser admin
    const query: any = { _id: { $in: objectQuoteIds } };
    if (authUser.role === 'cliente' || authUser.role === 'sub-cliente') {
        query.userId = tenantId;
    }

    const quotesToTransfer = await db.collection('quotes').find(query).toArray();

    if (quotesToTransfer.length === 0) {
        return NextResponse.json({ message: 'Nenhuma cotação encontrada ou sem permissão para transferir.' }, { status: 404 });
    }


    for (const quote of quotesToTransfer) {
      const oldUser = await db.collection('users').findOne({ _id: new ObjectId(quote.userId) });

      const historyEvent: QuoteHistoryEvent = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        userId: newUserId, // Could be an admin ID if we track that
        username: 'SISTEMA',
        action: 'TRANSFERENCIA',
        details: `Cotação transferida de ${oldUser?.username || 'desconhecido'} para ${newUser.username}.`,
      };

      await db.collection('quotes').updateOne(
        { _id: quote._id },
        {
          $set: {
            userId: newUser._id.toHexString(),
            creatorId: newUser._id.toHexString(),
            usuario: newUser.username,
          },
          $push: { history: historyEvent } as any,
        }
      );
    }
    
    return NextResponse.json({ message: `${quotesToTransfer.length} cotação(ões) transferida(s) com sucesso.` }, { status: 200 });

  } catch (error: any) {
    console.error('API Transfer Quotes Error:', error);
    return NextResponse.json({ message: `Erro ao transferir cotações: ${error.message}` }, { status: 500 });
  }
}
