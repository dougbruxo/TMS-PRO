
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import type { Notice } from '@/lib/types';

// GET all notices
export async function GET(request: Request) {
  try {
    const { db } = await connectToDatabase();
    const notices = await db.collection('notices').find({}).sort({ timestamp: -1 }).toArray();
    
    const noticesWithId = notices.map(notice => {
      const { _id, ...rest } = notice;
      return { id: _id.toHexString(), ...rest };
    });

    return NextResponse.json(noticesWithId);
  } catch (error: any) {
    console.error('API Notices GET Error:', error);
    return NextResponse.json({ message: `Erro ao buscar avisos: ${error.message}` }, { status: 500 });
  }
}

// POST a new notice
export async function POST(request: Request) {
  try {
    const { text, urgency, authorId, authorUsername } = await request.json();

    if (!text || !urgency || !authorId || !authorUsername) {
      return NextResponse.json({ message: 'Campos obrigatórios em falta.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    const newNotice: Omit<Notice, 'id'> = {
      text,
      urgency,
      status: 'ativo',
      timestamp: new Date().toISOString(),
      authorId: authorId,
      authorUsername: authorUsername,
    };

    const result = await db.collection('notices').insertOne(newNotice);
    const createdNotice = { id: result.insertedId.toHexString(), ...newNotice };

    return NextResponse.json(createdNotice, { status: 201 });
  } catch (error: any) {
    console.error('API Notices POST Error:', error);
    return NextResponse.json({ message: `Erro ao criar aviso: ${error.message}` }, { status: 500 });
  }
}
