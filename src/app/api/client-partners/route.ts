import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import type { ClientPartner } from '@/lib/types';
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
    const query = user.role === 'admin' ? {} : { userId: effectiveId };
    
    const partners = await db.collection('client_partners').find(query).sort({ createdAt: -1 }).toArray();

    return NextResponse.json(partners);
  } catch (error) {
    console.error('Failed to fetch client partners:', error);
    return NextResponse.json(
      { message: 'Erro ao buscar parceiros de negócios', error: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    if (user.role !== 'cliente' && user.role !== 'admin' && user.role !== 'sub-cliente') {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    const data: Partial<ClientPartner> = await request.json();

    if (!data.cnpj || !data.razaoSocial || !data.cep || !data.cidade || !data.estado || !data.endereco) {
        return NextResponse.json({ message: 'Dados obrigatórios faltando para o cadastro do parceiro.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const effectiveId = user.effectiveUserId || user.userId;
    const finalUserId = user.role === 'admin' ? (data.userId || effectiveId) : effectiveId;

    const newPartner = {
      ...data,
      userId: finalUserId,
      createdAt: new Date().toISOString(),
    };

    // Check if CNPJ already exists for THIS user
    const existing = await db.collection('client_partners').findOne({ 
        cnpj: data.cnpj,
        userId: finalUserId 
    });
    
    if (existing) {
        return NextResponse.json({ message: 'Este CNPJ já está cadastrado na sua base.' }, { status: 409 });
    }

    const result = await db.collection('client_partners').insertOne(newPartner);
    
    return NextResponse.json(
      { message: 'Parceiro cadastrado com sucesso', id: result.insertedId },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to create client partner:', error);
    return NextResponse.json(
      { message: 'Erro ao cadastrar parceiro de negócio', error: String(error) },
      { status: 500 }
    );
  }
}
