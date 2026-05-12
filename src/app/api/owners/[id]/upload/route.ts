import { NextResponse } from 'next/server';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import type { Owner } from '@/lib/types';

const uploadConfig = {
  cnhRg: { folder: 'cnh-rg', dbField: 'cnhRgDocumentUrl' as const },
  addressProof: { folder: 'endereco', dbField: 'addressProofUrl' as const },
};

type UploadType = keyof typeof uploadConfig;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const ownerId = parts[parts.length - 2];
    
    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;
    const type: UploadType | null = data.get('type') as UploadType;

    if (!file) {
      return NextResponse.json({ message: 'Nenhum ficheiro encontrado.' }, { status: 400 });
    }
    if (!ownerId || !ObjectId.isValid(ownerId)) {
      return NextResponse.json({ message: 'ID do proprietário inválido.' }, { status: 400 });
    }
    
    const config = type ? uploadConfig[type] : null;
    if (!config) {
      return NextResponse.json({ message: `Tipo de ficheiro inválido: ${type}` }, { status: 400 });
    }
    
    const { db } = await connectToDatabase();
    const owner = await db.collection<Owner>('owners').findOne({ _id: new ObjectId(ownerId) });
    if (!owner || !owner.document) {
        return NextResponse.json({ message: 'Proprietário ou documento não encontrado para associar o ficheiro.' }, { status: 404 });
    }

    const { folder, dbField } = config;

    const oldFileUrl = owner[dbField] as string | undefined;
    if (oldFileUrl) {
      const oldFileRelativePath = oldFileUrl.replace('/api/assets/', '');
      const fullOldPath = join(process.cwd(), 'public', oldFileRelativePath);
      if (existsSync(fullOldPath)) {
        try {
          await unlink(fullOldPath);
        } catch (unlinkError) {
          console.error(`Falha ao apagar o documento antigo do proprietário: ${fullOldPath}`, unlinkError);
        }
      }
    }

    const ownerDoc = owner.document.replace(/[^\d]/g, '');

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = join(process.cwd(), 'public', 'upload', 'proprietarios', ownerDoc, folder);
    mkdirSync(uploadDir, { recursive: true });

    const fileExtension = file.name.split('.').pop() || 'pdf';
    const newFilename = `${folder.toUpperCase()}-${ownerDoc}.${fileExtension}`;
    const filePath = join(uploadDir, newFilename);

    await writeFile(filePath, buffer);
    const publicPath = `/api/assets/upload/proprietarios/${ownerDoc}/${folder}/${newFilename}`;

    const result = await db.collection('owners').updateOne(
      { _id: new ObjectId(ownerId) },
      { $set: { [dbField]: publicPath } }
    );
      
    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "Proprietário não encontrado ao atualizar o caminho do documento." }, { status: 404 });
    }

    return NextResponse.json({ success: true, path: publicPath });

  } catch (error: any) {
    console.error(`Erro no upload do ficheiro do proprietário:`, error);
    return NextResponse.json({ success: false, message: `Erro interno do servidor: ${error.message}` }, { status: 500 });
  }
}
