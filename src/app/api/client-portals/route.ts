import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { getUserFromRequest } from '@/lib/auth-api';
import bcrypt from 'bcryptjs';
import { User } from '@/lib/types';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = getUserFromRequest(request);
    // Deve ser admin ou ter acesso ao modulo para gerenciar portais de clientes globais
    if (!user || (user.role !== 'admin' && !user.clientPortalsAccess)) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    const { db } = await connectToDatabase();
    
    // 1. Busca todos os usuários mestres B2B
    const clientUsers = await db.collection('users').find({ role: 'cliente' }).project({ password: 0 }).toArray();
    
    // 2. Extrai os IDs para buscar as empresas principais (default) de cada um
    const userIds = clientUsers.map(u => u._id.toHexString());
    const primaryCompanies = await db.collection('client_companies').find({ 
      userId: { $in: userIds }, 
      isDefault: true 
    }).toArray();

    // 3. Mescla os dados para a tabela do painel
    const portals = clientUsers.map(u => {
      const company = primaryCompanies.find(c => c.userId === u._id.toHexString());
      return {
        id: u._id.toHexString(), // ID do usuário master (o Portal ID é na verdade o User ID)
        username: u.username,
        email: u.email,
        contact: u.contact,
        disabled: u.disabled,
        createdAt: u.createdAt || new Date().toISOString(), // Fallback
        
        freightAccess: u.freightAccess,
        myFreightsAccess: u.myFreightsAccess,
        noticeBoardAccess: u.noticeBoardAccess,
        myCompanyAccess: u.myCompanyAccess,
        clientPartnersAccess: u.clientPartnersAccess,
        fracionadoEnabled: u.fracionadoEnabled,
        armazenagemAccess: u.armazenagemAccess,
        quoteArmazenagemAccess: u.quoteArmazenagemAccess,
        chatEnabled: !!u.chatEnabled,
        supportUserIds: u.supportUserIds || (u.supportUserId ? [u.supportUserId] : []),
        supportUserId: u.supportUserId || null,

        // Dados da Empresa Principal
        companyId: company?._id.toString(),
        razaoSocial: company?.razaoSocial || 'Empresa Padrão (Falta Cadastro)',
        nomeFantasia: company?.nomeFantasia || company?.razaoSocial || '—',
        cnpj: company?.cnpj || '—',
        // Fix legacy urls without /api/assets prefix if they were uploaded dynamically before the patch
        logoUrl: company?.logoUrl ? (company.logoUrl.startsWith('/uploads/') ? `/api/assets${company.logoUrl}` : company.logoUrl) : null,
        
        // Dados Fiscais e de Endereço extras devolvidos para visualização/edição no painel
        endereco: company?.endereco,
        cidade: company?.cidade,
        estado: company?.estado,
        cep: company?.cep,
        inscricaoEstadual: company?.inscricaoEstadual,
        numero: company?.numero,
        complemento: company?.complemento,
        bairro: company?.bairro,
        telefone: company?.telefone,
        operatingHours: company?.operatingHours,
        businessRules: company?.businessRules,
      };
    });

    return NextResponse.json(portals);
  } catch (error: any) {
    console.error('Failed to fetch client portals:', error);
    return NextResponse.json({ message: 'Erro ao buscar portais de clientes', error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const adminUser = getUserFromRequest(request);
    if (!adminUser || (adminUser.role !== 'admin' && !adminUser.clientPortalsAccess)) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    const data = await request.json();
    const { 
      // Dados do Admin (Master Login)
      email, password, username, contact, 
      // Dados da Empresa
      cnpj, razaoSocial, nomeFantasia, endereco, cidade, estado, cep,
      inscricaoEstadual, numero, complemento, bairro, telefone,
      // Permissões B2B
      freightAccess, myFreightsAccess, noticeBoardAccess, myCompanyAccess, clientPartnersAccess, fracionadoEnabled, armazenagemAccess, quoteArmazenagemAccess, chatEnabled,
      operatingHours, businessRules, supportUserIds, supportUserId 
    } = data;

    if (!email || !password || !username || !cnpj || !razaoSocial) {
      return NextResponse.json({ message: "Preencha os dados de login e da empresa para criar o portal." }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    // 1. Verifica se E-mail de usuário mestre já existe
    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) {
      return NextResponse.json({ message: "O e-mail informado para o usuário Master já está em uso." }, { status: 409 });
    }

    // 2. Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 3. Monta o Documento do Novo Usuário (Role: 'cliente')
    const newUser: Partial<User> = {
      email,
      password: hashedPassword,
      username: username.toUpperCase(),
      role: 'cliente',
      contact: contact || '',
      disabled: false,
      chatEnabled: !!chatEnabled,
      
      // Módulos Internos Desativados por Segurança
      operationalAccess: false,
      driverManagementAccess: false,
      settingsAccess: false,
      expensesAccess: false,
      talentsAccess: false,
      receivingAccess: false,
      documentsAccess: false,
      sacAccess: false,
      registrationsAccess: false,
      panoramaAccess: false,
      stockAccess: false,
      financialAccess: false,
      
      // Módulos B2B Externos Configurados pelo Admin
      freightAccess: !!freightAccess,
      myFreightsAccess: !!myFreightsAccess,
      noticeBoardAccess: !!noticeBoardAccess,
      myCompanyAccess: !!myCompanyAccess,
      clientPartnersAccess: !!clientPartnersAccess,
      fracionadoEnabled: !!fracionadoEnabled,
      armazenagemAccess: !!armazenagemAccess,
      quoteArmazenagemAccess: !!quoteArmazenagemAccess,
      supportUserIds: Array.isArray(supportUserIds) ? supportUserIds : (supportUserId ? [supportUserId] : []),
      supportUserId: Array.isArray(supportUserIds) ? (supportUserIds[0] || null) : (supportUserId || null),

      createdAt: new Date().toISOString()
    };

    const userResult = await db.collection('users').insertOne(newUser);
    const newUserId = userResult.insertedId.toHexString();

    // 4. Cria a Empresa Principal para que a Origem funcione automaticamente no App B2B
    const newCompany = {
      userId: newUserId, // O dono da empresa é o recém-criado cliente
      cnpj: cnpj.replace(/[^\d]/g, ''),
      razaoSocial,
      nomeFantasia: nomeFantasia || razaoSocial,
      endereco,
      cidade,
      estado,
      cep: cep ? cep.replace(/[^\d]/g, '') : '',
      inscricaoEstadual,
      numero,
      complemento,
      bairro,
      telefone,
      operatingHours,
      businessRules,
      isDefault: true, // Sempre verdadeiro por ser a primeira e root do Portal
      createdAt: new Date().toISOString(),
    };

    const resultCompany = await db.collection('client_companies').insertOne(newCompany);

    return NextResponse.json(
      { message: 'Portal Multi-Tenant B2B provisionado com sucesso!', userId: newUserId, companyId: resultCompany.insertedId.toHexString() },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Failed to provision client portal:', error);
    return NextResponse.json({ message: 'Erro ao provisionar portal', error: error.message }, { status: 500 });
  }
}
