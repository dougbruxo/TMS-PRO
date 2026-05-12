import { NextResponse } from 'next/server';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const hubId = parts[parts.length - 2]; // Path is /api/chat/hubs/[id]/upload-avatar
    
    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;

    if (!file) {
      return NextResponse.json({ success: false, message: 'Nenhum ficheiro encontrado.' }, { status: 400 });
    }
    if (!hubId || !ObjectId.isValid(hubId)) {
      return NextResponse.json({ success: false, message: 'ID do hub inválido.' }, { status: 400 });
    }
    
    const { db } = await connectToDatabase();
    const hub = await db.collection('chat_hubs').findOne({ _id: new ObjectId(hubId) });
    
    if (hub && hub.avatarUrl) {
      const oldAvatarPath = join(process.cwd(), 'public', hub.avatarUrl);
      if (existsSync(oldAvatarPath)) {
        try {
          await unlink(oldAvatarPath);
        } catch (unlinkError) {
          console.error(`Falha ao apagar o avatar antigo: ${oldAvatarPath}`, unlinkError);
        }
      }
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = join(process.cwd(), 'public', 'upload', 'hubs');
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
    }

    const fileExtension = file.name.split('.').pop() || 'png';
    const newFilename = `hub-avatar-${hubId}.${fileExtension}`;
    const path = join(uploadDir, newFilename);

    await writeFile(path, buffer);
    const publicPath = `/upload/hubs/${newFilename}`;

    await db.collection('chat_hubs').updateOne(
        { _id: new ObjectId(hubId) },
        { $set: { avatarUrl: publicPath } }
    );
    
    return NextResponse.json({ success: true, path: publicPath });

  } catch (error: any) {
    console.error('Erro no upload do avatar do hub:', error);
    return NextResponse.json({ success: false, message: `Erro interno do servidor: ${error.message}` }, { status: 500 });
  }
}
