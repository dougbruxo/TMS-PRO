
import { NextResponse } from 'next/server';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { existsSync, mkdirSync } from 'fs';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import type { ActivityRecord } from '@/lib/types';


export async function POST(request: Request) {
  try {
    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;
    const userId: string | null = data.get('userId') as string;

    if (!file) {
      return NextResponse.json({ success: false, message: 'Nenhum ficheiro encontrado.' }, { status: 400 });
    }
     if (!userId || !ObjectId.isValid(userId)) {
      return NextResponse.json({ success: false, message: 'ID do utilizador inválido ou não fornecido.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

    // Delete old avatar if it exists
    if (user && user.avatarUrl) {
        const oldFileRelativePath = user.avatarUrl.replace('/api/assets', '');
        const oldAvatarPath = join(process.cwd(), 'public', oldFileRelativePath);
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

    // Garante que o diretório de avatars existe
    const avatarsDir = join(process.cwd(), 'public', 'upload', 'perfil');
    if (!existsSync(avatarsDir)) {
        mkdirSync(avatarsDir, { recursive: true });
    }

    const fileExtension = file.name.split('.').pop();
    const newFilename = `${userId}-${uuidv4()}.${fileExtension}`;
    const path = join(avatarsDir, newFilename);

    await writeFile(path, buffer);

    const publicPath = `/api/assets/upload/perfil/${newFilename}`;
    
    // Log activity
    if (user) {
        const activityRecord: Omit<ActivityRecord, 'id'| '_id'> = {
            userId: userId,
            username: user.username,
            timestamp: new Date().toISOString(),
            type: 'AVATAR_UPDATE',
            details: `Foto de perfil atualizada.`
        };
        await db.collection('activityHistory').insertOne(activityRecord as any);

        // Update user avatarUrl
        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: { avatarUrl: publicPath } }
        );
    }


    return NextResponse.json({ success: true, path: publicPath });

  } catch (error: any) {
    console.error('Erro no upload do avatar:', error);
    return NextResponse.json({ success: false, message: `Erro interno do servidor: ${error.message}` }, { status: 500 });
  }
}
