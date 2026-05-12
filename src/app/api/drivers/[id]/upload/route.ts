
import { NextResponse } from 'next/server';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import type { Driver } from '@/lib/types';

const sanitizeFilename = (name: string) => name.replace(/[^a-z0-9-]/gi, '_').toLowerCase();

// Centralized configuration for all driver uploads
const uploadConfig = {
  avatarUrl: { folder: 'perfil', dbField: 'avatarUrl' as const },
  cnhDocumentUrl: { folder: 'cnh', dbField: 'cnhDocumentUrl' as const },
  addressProofUrl: { folder: 'endereco', dbField: 'addressProofUrl' as const },
};

type UploadType = keyof typeof uploadConfig;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const driverId = parts[parts.length - 2]; // Path is /api/drivers/[id]/upload

    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;
    const type: UploadType | null = data.get('type') as UploadType;

    // --- Critical Validation ---
    if (!file) {
      return NextResponse.json({ message: 'Nenhum ficheiro encontrado.' }, { status: 400 });
    }
    if (!driverId || !ObjectId.isValid(driverId)) {
      return NextResponse.json({ message: 'ID do motorista inválido.' }, { status: 400 });
    }
    
    const config = type ? uploadConfig[type] : null;
    if (!config) {
      return NextResponse.json({ message: `Tipo de ficheiro inválido. Recebido: '${type}'. Tipos válidos: ${Object.keys(uploadConfig).join(', ')}` }, { status: 400 });
    }
    
    // --- Business Logic ---
    const { db } = await connectToDatabase();
    const driver = await db.collection<Driver>('drivers').findOne({ _id: new ObjectId(driverId) });
    if (!driver || !driver.cpf) {
        return NextResponse.json({ message: 'Motorista ou CPF não encontrado para associar o ficheiro.' }, { status: 404 });
    }

    const { folder, dbField } = config;

    // Delete old file if it exists
    const oldFileUrl = driver[dbField as keyof Driver] as string | undefined;
    if (oldFileUrl) {
        const oldFileRelativePath = oldFileUrl.replace('/api/assets', '');
        const fullOldPath = join(process.cwd(), 'public', oldFileRelativePath);
        if (existsSync(fullOldPath)) {
            try {
                await unlink(fullOldPath);
            } catch (unlinkError) {
                console.error(`Falha ao apagar o documento antigo do motorista: ${fullOldPath}`, unlinkError);
            }
        }
    }

    const driverCpf = driver.cpf.replace(/[^\d]/g, '');

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = join(process.cwd(), 'public', 'upload', 'drivers', driverCpf, folder);
    mkdirSync(uploadDir, { recursive: true });

    const fileExtension = file.name.split('.').pop() || 'pdf';
    // Standardized filename
    const newFilename = `${folder.toUpperCase()}-${driverCpf}.${fileExtension}`;
    const filePath = join(uploadDir, newFilename);

    await writeFile(filePath, buffer);
    const publicPath = `/api/assets/upload/drivers/${driverCpf}/${folder}/${newFilename}`;

    const result = await db.collection('drivers').updateOne(
      { _id: new ObjectId(driverId) },
      { $set: { [dbField]: publicPath } }
    );
      
    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "Motorista não encontrado ao atualizar o caminho do documento." }, { status: 404 });
    }

    return NextResponse.json({ success: true, path: publicPath });

  } catch (error: any) {
    console.error(`Erro no upload do ficheiro do motorista:`, error);
    return NextResponse.json({ success: false, message: `Erro interno do servidor: ${error.message}` }, { status: 500 });
  }
}
