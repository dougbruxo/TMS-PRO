import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { getUserFromRequest } from '@/lib/auth-api';

export async function GET(request: Request) {
  try {
    const authUser = getUserFromRequest(request);
    if (!authUser) return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });

    const { searchParams } = new URL(request.url);

    const term = searchParams.get('term');

    if (!term) {
      return NextResponse.json([]);
    }

    const { db } = await connectToDatabase();
    
    const regex = { $regex: term, $options: 'i' };

    let query: any = {
      $or: [
        { username: regex },
        { email: regex },
      ],
      chatEnabled: true,
      disabled: { $ne: true }
    };

    // Lógica de Visibilidade Chat Multi-Tenant
    if (authUser.role === 'cliente' || authUser.role === 'sub-cliente') {
        const tenantId = authUser.role === 'sub-cliente' ? authUser.parentId : authUser.userId;
        
        query.$and = [
            {
                $or: [
                    // Pode ver a transportadora
                    { role: { $in: ['admin', 'user'] } },
                    // Pode ver os colegas da mesma empresa (mesmo tenantId)
                    { parentId: tenantId },
                    { _id: new (require('mongodb').ObjectId)(tenantId) }
                ]
            }
        ];
    } else {
        // Transportadora pode ver todos (menos ela mesma talvez, mas o front filtra isso)
        // No entanto, por segurança, transportadora geralmente não inicia chat com Outros Clientes via busca global
        // Mas a regra diz que eles podem conversar.
    }


    const users = await db.collection('users')
      .find(query)
      .limit(20)
      .toArray();

    const usersWithId = users.map(user => {
      const { _id, password, ...rest } = user;
      return { id: _id.toHexString(), ...rest };
    });

    return NextResponse.json(usersWithId);

  } catch (error: any) {
    console.error('API Users Search Error:', error);
    return NextResponse.json({ message: `Erro ao buscar usuários: ${error.message}` }, { status: 500 });
  }
}

    