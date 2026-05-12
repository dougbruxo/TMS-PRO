import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { User } from '@/lib/types';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { getUserFromRequest } from '@/lib/auth-api';

export async function GET(request: Request) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    if (user.role !== 'cliente' && user.role !== 'admin' && user.role !== 'sub-cliente') {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    const { db } = await connectToDatabase();
    
    const effectiveId = user.effectiveUserId || user.userId;

    const users = await db.collection('users').find({ parentId: effectiveId }).project({ password: 0 }).toArray();
    
    const usersWithId = users.map(u => {
      const { _id, ...rest } = u;
      return { id: _id.toHexString(), ...rest };
    });

    return NextResponse.json(usersWithId);
  } catch (error: any) {
    console.error('API Cliente Users GET Error:', error);
    return NextResponse.json({ message: `Erro ao buscar usuários: ${error.message}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    // Apenas clientes ou ADMINs (admin do sistema ou admin do cliente) podem criar sub-clientes
    if (user.role !== 'cliente' && user.role !== 'admin' && user.subRole !== 'ADM') {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    const { email, password, username, subRole, contact, accessSwitches } = await request.json();
    
    if (!email || !password || !username || !subRole) {
      return NextResponse.json({ message: "Campos obrigatórios em falta." }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) {
      return NextResponse.json({ message: "Este e-mail já está em uso no sistema." }, { status: 409 });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const effectiveId = user.effectiveUserId || user.userId;
    
    const defaultAccess = {
        freightAccess: true,
        myFreightsAccess: true,
        clientPartnersAccess: subRole === 'ADM',
        myCompanyAccess: subRole === 'ADM',
        // O subcliente herda algumas restrições comuns de cliente
        chatEnabled: false,
        operationalAccess: false,
        driverManagementAccess: false,
        settingsAccess: false,
        noticeBoardAccess: false,
        expensesAccess: false,
        talentsAccess: false,
        receivingAccess: false,
        documentsAccess: false,
        fracionadoEnabled: false,
        sacAccess: false,
        registrationsAccess: false,
        panoramaAccess: false,
        stockAccess: false,
    };

    const appliedAccess = accessSwitches ? { ...defaultAccess, ...accessSwitches } : defaultAccess;

    const newUser: Omit<User, 'id' | '_id'> = {
      email: email.toLowerCase(),
      password: hashedPassword,
      username: username.toUpperCase(),
      role: 'sub-cliente', // Role isolada
      isSubClient: true,
      parentId: effectiveId, // Atrelado ao Cliente Original
      subRole: subRole,
      contact: contact || '',
      disabled: false,
      ...appliedAccess
    };

    const result = await db.collection('users').insertOne(newUser as any);
    
    const createdUser = {
      id: result.insertedId.toHexString(),
      ...newUser,
    };
    delete (createdUser as any).password;

    return NextResponse.json(createdUser, { status: 201 });

  } catch (error: any) {
     console.error('API Cliente Users POST Error:', error);
    return NextResponse.json({ message: `Erro ao criar sub-cliente: ${error.message}` }, { status: 500 });
  }
}
