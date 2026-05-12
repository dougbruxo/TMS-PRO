
import { NextResponse } from 'next/server';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function POST(request: Request) {
  try {
    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;
    const profileId: string | null = data.get('profileId') as string;

    if (!file) {
      return NextResponse.json({ success: false, message: 'Nenhum ficheiro encontrado.' }, { status: 400 });
    }
    if (!profileId || !ObjectId.isValid(profileId)) {
      return NextResponse.json({ success: false, message: 'ID do perfil inválido ou não fornecido.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const profile = await db.collection('company_profiles').findOne({ _id: new ObjectId(profileId) });

    // Delete old logo if it exists
    if (profile && profile.logoUrl) {
        const oldFileRelativePath = profile.logoUrl.replace('/api/assets', '');
        const oldLogoPath = join(process.cwd(), 'public', oldFileRelativePath);
        if (existsSync(oldLogoPath)) {
            try {
                await unlink(oldLogoPath);
            } catch (unlinkError) {
                console.error(`Falha ao apagar o logótipo antigo: ${oldLogoPath}`, unlinkError);
            }
        }
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = join(process.cwd(), 'public', 'upload', 'logos');
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
    }

    const fileExtension = file.name.split('.').pop() || 'png';
    const newFilename = `logo-${profileId}.${fileExtension}`;
    const path = join(uploadDir, newFilename);

    await writeFile(path, buffer);
    const publicPath = `/api/assets/upload/logos/${newFilename}`;

    await db.collection('company_profiles').updateOne(
        { _id: new ObjectId(profileId) },
        { $set: { logoUrl: publicPath } }
    );
    
    return NextResponse.json({ success: true, path: publicPath });

  } catch (error: any) {
    console.error('Erro no upload do logótipo:', error);
    return NextResponse.json({ success: false, message: `Erro interno do servidor: ${error.message}` }, { status: 500 });
  }
}
