
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { User } from '@/lib/types';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeClients = searchParams.get('includeClients') === 'true' || searchParams.get('chat') === 'true';

    const { db } = await connectToDatabase();

    const query = includeClients 
      ? {} 
      : { role: { $nin: ['sub-cliente', 'cliente'] } };

    // Apenas listamos usuários internos por padrão. Clientes e sub-clientes são incluídos se includeClients for true.
    const users = await db.collection('users').find(query).project({ password: 0 }).toArray();

    
    // Mapeia o _id para id
    const usersWithId = users.map(user => {
      const { _id, ...rest } = user;
      return { id: _id.toHexString(), ...rest };
    });

    return NextResponse.json(usersWithId);
  } catch (error: any) {
    console.error('API Users GET Error:', error);
    return NextResponse.json({ message: `Erro ao buscar usuários: ${error.message}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { email, password, username, contact, role, salesBonusPercentage } = await request.json();
    
    if (!email || !password || !username || !role) {
      return NextResponse.json({ message: "Campos obrigatórios em falta." }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    // Verifica se o usuário já existe
    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) {
      return NextResponse.json({ message: "Este e-mail já está em uso." }, { status: 409 });
    }
    
    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser: Omit<User, 'id' | '_id'> = {
      email,
      password: hashedPassword,
      username: username.toUpperCase(),
      role,
      contact: contact || '',
      disabled: false,
      chatEnabled: role !== 'parceiro',
      operationalAccess: role !== 'cliente' && role !== 'parceiro',
      driverManagementAccess: role !== 'cliente' && role !== 'parceiro',
      settingsAccess: role === 'admin',
      noticeBoardAccess: true,
      expensesAccess: role !== 'cliente' && role !== 'parceiro',
      talentsAccess: role === 'admin',
      receivingAccess: role !== 'cliente' && role !== 'parceiro',
      documentsAccess: role !== 'parceiro',
      fracionadoEnabled: role !== 'cliente' && role !== 'parceiro',
      sacAccess: role !== 'cliente' && role !== 'parceiro',
      registrationsAccess: role !== 'cliente' && role !== 'parceiro',
      panoramaAccess: role !== 'cliente' && role !== 'parceiro',
      stockAccess: role !== 'cliente' && role !== 'parceiro',
      freightAccess: true,
      myFreightsAccess: true,
      salesBonusPercentage: salesBonusPercentage || 0,
      requiresQuoteApproval: role === 'parceiro', // Padrão: parceiros requerem aprovação
    };

    const result = await db.collection('users').insertOne(newUser as any);
    
    const createdUser = {
      id: result.insertedId.toHexString(),
      ...newUser,
    };
    delete (createdUser as any).password;

    return NextResponse.json(createdUser, { status: 201 });

  } catch (error: any) {
     console.error('API Users POST Error:', error);
    return NextResponse.json({ message: `Erro ao criar usuário: ${error.message}` }, { status: 500 });
  }
}
