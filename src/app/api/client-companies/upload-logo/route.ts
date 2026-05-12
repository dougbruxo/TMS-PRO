import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { getUserFromRequest } from '@/lib/auth-api';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const user = getUserFromRequest(request);
    // Autoriza Clientes e Usuários da Emrpesa com permissão B2B
    if (!user || (!['cliente'].includes(user.role) && user.role !== 'admin' && !(user as any).clientPortalsAccess)) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    const { db } = await connectToDatabase();
    
    const formData = await request.formData();
    const companyId = formData.get('companyId') as string;
    const file = formData.get('file') as File;
    
    if (!file || !companyId) {
      return NextResponse.json({ message: "Dados incompletos (ficheiro ou id da empresa ausente)." }, { status: 400 });
    }

    let query: any = { _id: new ObjectId(companyId) };
    // Cliente só pode editar a própria empresa
    if (user.role === 'cliente') {
        query.userId = user.userId;
    }

    const clientCompany = await db.collection('client_companies').findOne(query);

    if (!clientCompany) {
        return NextResponse.json({ message: 'Empresa do cliente não encontrada ou acesso negado.' }, { status: 404 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save in public/uploads/logos
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'logos');
    
    try {
        await mkdir(uploadDir, { recursive: true });
    } catch (e) {
        // Diretorio já existe
    }
    
    const extension = file.name.split('.').pop() || 'png';
    const filename = `b2b-logo-${clientCompany._id.toHexString()}-${Date.now()}.${extension}`;
    const filepath = join(uploadDir, filename);

    await writeFile(filepath, buffer);
    const logoUrl = `/api/assets/uploads/logos/${filename}`;
    
    // Atualiza o logo no documento da Client Company
    await db.collection('client_companies').updateOne(
        { _id: clientCompany._id },
        { $set: { logoUrl } }
    );

    return NextResponse.json({ success: true, path: logoUrl });

  } catch (error: any) {
    console.error('API Upload Logo Error:', error);
    return NextResponse.json({ message: `Erro ao fazer upload do logótipo: ${error.message}` }, { status: 500 });
  }
}
