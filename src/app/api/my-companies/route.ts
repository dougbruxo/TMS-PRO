import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import type { ClientCompany } from '@/lib/types';
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
    
    // Admins can see all, clients and sub-clients can only see theirs (based on effectiveUserId)
    const effectiveId = user.effectiveUserId || user.userId;
    const query = user.role === 'admin' ? {} : { userId: effectiveId };
    
    const companies = await db.collection('client_companies').find(query).sort({ createdAt: -1 }).toArray();
    
    // Fix legacy logoUrls
    const fixedCompanies = companies.map(c => ({
      ...c,
      id: c._id.toString(),
      _id: undefined,
      logoUrl: c.logoUrl ? (c.logoUrl.startsWith('/uploads/') ? `/api/assets${c.logoUrl}` : c.logoUrl) : null
    }));

    return NextResponse.json(fixedCompanies);
  } catch (error) {
    console.error('Failed to fetch client companies:', error);
    return NextResponse.json(
      { message: 'Erro ao buscar empresas', error: String(error) },
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

    const data: Partial<ClientCompany> = await request.json();

    if (!data.cnpj || !data.razaoSocial || !data.cep || !data.cidade || !data.estado || !data.endereco) {
        return NextResponse.json({ message: 'Dados obrigatórios faltando para o cadastro da empresa.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const effectiveId = user.effectiveUserId || user.userId;
    const finalUserId = user.role === 'admin' ? (data.userId || effectiveId) : effectiveId;

    // Se estiver setando como Default, retire o Default das outras
    if (data.isDefault) {
      await db.collection('client_companies').updateMany(
        { userId: finalUserId },
        { $set: { isDefault: false } }
      );
    }

    const newCompany = {
      ...data,
      isDefault: !!data.isDefault,
      userId: finalUserId,
      createdAt: new Date().toISOString(),
    };

    // Check if CNPJ already exists for THIS user
    const existing = await db.collection('client_companies').findOne({ 
        cnpj: data.cnpj,
        userId: newCompany.userId 
    });

    if (existing) {
        return NextResponse.json({ message: 'Este CNPJ já está cadastrado para este usuário.' }, { status: 400 });
    }

    const result = await db.collection('client_companies').insertOne(newCompany);

    return NextResponse.json(
      { message: 'Empresa adicionada com sucesso', id: result.insertedId.toString() },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to create client company:', error);
    return NextResponse.json(
      { message: 'Erro ao salvar empresa', error: String(error) },
      { status: 500 }
    );
  }
}
