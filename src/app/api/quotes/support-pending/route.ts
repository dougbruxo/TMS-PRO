import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { getUserFromRequest } from '@/lib/auth-api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authUser = getUserFromRequest(request);
    if (!authUser || (authUser.role !== 'user' && authUser.role !== 'admin')) {
      return NextResponse.json({ hasPending: false, isLocked: false, pendingCount: 0 });
    }

    const { db } = await connectToDatabase();
    
    // Buscar clientes onde este usuário é um dos suportes designados (novo array ou legacy string)
    const myClients = await db.collection('users').find({
      role: 'cliente',
      $or: [
        { supportUserIds: authUser.userId },
        { supportUserId: authUser.userId }
      ]
    }).toArray();
    const myClientIds = myClients.map(c => c._id.toHexString());

    let hasPending = false;
    let isLocked = false;
    let pendingCount = 0;

    if (myClientIds.length > 0) {
        const pendingQuotesCount = await db.collection('quotes').countDocuments({
            userId: { $in: myClientIds },
            status: 'Em Análise'
        });

        if (pendingQuotesCount > 0) {
            hasPending = true;
            pendingCount = pendingQuotesCount;
            // Apenas o 'user' (colaborador) fica travado/tem banner ultra insistente alertando o bloqueio moral
            if (authUser.role === 'user') {
                isLocked = true;
            }
        }
    }

    // Admins também são notificados se QUALQUER cliente tiver cotação em análise (se quiserem ver, mas não travam)
    if (authUser.role === 'admin' && !hasPending) {
        const allPendingCount = await db.collection('quotes').countDocuments({
             status: 'Em Análise'
        });
        if (allPendingCount > 0) {
            hasPending = true;
            pendingCount = allPendingCount;
            isLocked = false;
        }
    }

    return NextResponse.json({ hasPending, isLocked, pendingCount });
  } catch (error) {
    console.error('Support Pending API Error:', error);
    return NextResponse.json({ hasPending: false, isLocked: false, pendingCount: 0 });
  }
}
