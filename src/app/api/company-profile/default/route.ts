
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { getUserFromRequest } from '@/lib/auth-api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { db } = await connectToDatabase();
    const user = getUserFromRequest(request);
    
    // Tenta encontrar o perfil master (transportadora)
    let profile = await db.collection('company_profiles').findOne({ isDefault: true });

    if (!profile) {
      profile = await db.collection('company_profiles').findOne({});
    }

    if (!profile) {
      return NextResponse.json({ message: "Nenhum perfil de empresa encontrado." }, { status: 404 });
    }
    
    const { _id, ...profileData } = profile;
    let finalProfile: any = { id: _id.toHexString(), ...profileData };

    // Se o usuário logado for um Cliente/Sub-cliente, injeta o logo e os dados dele por cima (White-label)
    if (user && (user.role === 'cliente' || user.role === 'sub-cliente')) {
        const ownerId = user.role === 'cliente' ? user.userId : user.parentId;
        if (ownerId) {
            const clientCompany = await db.collection('client_companies').findOne({ userId: ownerId, isDefault: true });
            if (clientCompany) {
                // Aqui substituímos visualmente os dados da transportadora pelos do cliente no AppSidebar/Header
                finalProfile.razaoSocial = clientCompany.nomeFantasia || clientCompany.razaoSocial;
                finalProfile.cnpj = clientCompany.cnpj;
                if (clientCompany.logoUrl) {
                    finalProfile.logoUrl = clientCompany.logoUrl;
                }
                // Opcional: Se quiser que o email do contato seja o do cliente e não da transportadora na barra lateral
            }
        }
    }

    return NextResponse.json(finalProfile);

  } catch (error: any) {
    return NextResponse.json({ message: `Erro ao buscar perfil padrão: ${error.message}` }, { status: 500 });
  }
}
