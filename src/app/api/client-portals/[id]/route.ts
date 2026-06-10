import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { getUserFromRequest } from '@/lib/auth-api';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const adminUser = getUserFromRequest(request);
    if (!adminUser || (adminUser.role !== 'admin' && !adminUser.clientPortalsAccess)) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    // Extrair ID da URL (compatível com Next.js 16 onde params é Promise)
    const pathname = new URL(request.url).pathname;
    const urlParts = pathname.split('/');
    const id = urlParts.pop() || '';

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'ID de portal inválido' }, { status: 400 });
    }

    const { disabled, ...otherData } = await request.json();
    const { db } = await connectToDatabase();

    // Toggle Portal Status (Ativar/Desativar Usuário) ou Atualizar switches de permissões
    const updatePayload: any = {};
    if (disabled !== undefined) {
      updatePayload.disabled = disabled;
    }
    
    // Updates adicionais permitidos (Switches B2B)
    const allowedFields = ['freightAccess', 'myFreightsAccess', 'noticeBoardAccess', 'myCompanyAccess', 'clientPartnersAccess', 'fracionadoEnabled', 'armazenagemAccess', 'quoteArmazenagemAccess', 'chatEnabled'];
    for (const field of allowedFields) {
        if (otherData[field] !== undefined) {
            updatePayload[field] = !!otherData[field];
        }
    }

    // Dados do Usuário Master (username, contact, email)
    if (otherData.username !== undefined) {
        updatePayload.username = otherData.username.toUpperCase();
    }
    if (otherData.contact !== undefined) {
        updatePayload.contact = otherData.contact;
    }
    if (otherData.email !== undefined) {
        updatePayload.email = otherData.email;
    }
    // Atualizar senha se fornecida
    if (otherData.password) {
        updatePayload.password = await bcrypt.hash(otherData.password, 10);
    }

    // Suporte Multi-Usuário (array) - com fallback para legacy (string)
    if (otherData.supportUserIds !== undefined) {
        updatePayload.supportUserIds = Array.isArray(otherData.supportUserIds) ? otherData.supportUserIds : [];
        // Manter compatibilidade: primeiro ID como supportUserId legacy
        updatePayload.supportUserId = updatePayload.supportUserIds[0] || null;
    } else if (otherData.supportUserId !== undefined) {
        updatePayload.supportUserId = otherData.supportUserId || null;
    }

    if (Object.keys(updatePayload).length > 0) {
      const userResult = await db.collection('users').updateOne(
        { _id: new ObjectId(id), role: 'cliente' },
        { $set: updatePayload }
      );
      if (userResult.matchedCount === 0) {
        return NextResponse.json({ message: 'Usuário cliente não encontrado.' }, { status: 404 });
      }
    }
    
    // Agora tenta atualizar Dados Cadastrais e Fiscais na client_companies
    const companyFields = ['cnpj', 'razaoSocial', 'nomeFantasia', 'endereco', 'cidade', 'estado', 'cep', 'inscricaoEstadual', 'numero', 'complemento', 'bairro', 'telefone', 'operatingHours', 'businessRules'];
    const companyPayload: any = {};
    for (const field of companyFields) {
        if (otherData[field] !== undefined) {
             if (field === 'cnpj' || field === 'cep' || field === 'inscricaoEstadual') {
                companyPayload[field] = otherData[field] ? otherData[field].replace(/[^\d]/g, '') : '';
             } else {
                companyPayload[field] = otherData[field];
             }
        }
    }
    
    if (Object.keys(companyPayload).length > 0) {
        await db.collection('client_companies').updateOne(
            { userId: id, isDefault: true },
            { $set: companyPayload }
        );
    }
    
    return NextResponse.json({ message: 'Portal Multi-Tenant atualizado com sucesso!' });
  } catch (error: any) {
    console.error('Failed to update client portal:', error);
    return NextResponse.json({ message: 'Erro ao atualizar portal B2B', error: error.message }, { status: 500 });
  }
}

