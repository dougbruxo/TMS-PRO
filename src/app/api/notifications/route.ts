import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { getUserFromRequest } from '@/lib/auth-api';

export async function GET(request: Request) {
  try {
    const authUser = getUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    
    // Filtro para buscar notificações:
    // 1. Vinculadas especificamente ao usuário logado.
    // 2. Se o usuário for admin, também busca as notificações destinadas a 'admin'.
    const query: any = {
      read: false
    };

    if (authUser.role === 'admin') {
      query.$or = [
        { userId: authUser.userId },
        { userId: 'admin' }
      ];
    } else {
      query.userId = authUser.userId;
    }

    const notifications = await db.collection('notifications')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    // Mapear ObjectId para string hexadecimal
    const formattedNotifications = notifications.map(notif => ({
      id: notif._id.toHexString(),
      userId: notif.userId,
      title: notif.title,
      message: notif.message,
      type: notif.type,
      quoteId: notif.quoteId,
      quoteCode: notif.quoteCode,
      read: notif.read,
      createdAt: notif.createdAt
    }));

    return NextResponse.json(formattedNotifications, { status: 200 });
  } catch (error: any) {
    console.error('API Notifications GET Error:', error);
    return NextResponse.json({ message: `Erro ao buscar notificações: ${error.message}` }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const authUser = getUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { ids } = body;

    const { db } = await connectToDatabase();

    const query: any = {};
    
    if (ids && Array.isArray(ids) && ids.length > 0) {
      // Filtrar pelos IDs específicos enviados
      const objectIds = ids
        .filter(id => ObjectId.isValid(id))
        .map(id => new ObjectId(id));
      
      query._id = { $in: objectIds };
    } else {
      // Se nenhum ID for especificado, marca todas as do usuário como lidas
      if (authUser.role === 'admin') {
        query.$or = [
          { userId: authUser.userId },
          { userId: 'admin' }
        ];
      } else {
        query.userId = authUser.userId;
      }
      query.read = false;
    }

    await db.collection('notifications').updateMany(
      query,
      { $set: { read: true } }
    );

    return NextResponse.json({ message: 'Notificações marcadas como lidas' }, { status: 200 });
  } catch (error: any) {
    console.error('API Notifications PUT Error:', error);
    return NextResponse.json({ message: `Erro ao atualizar notificações: ${error.message}` }, { status: 500 });
  }
}
