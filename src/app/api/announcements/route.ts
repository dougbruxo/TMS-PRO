
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import type { ChatAnnouncement } from '@/lib/types';
import { getUserFromRequest } from '@/lib/auth-api';

// GET all announcements
export async function GET(request: Request) {
  try {
    const authUser = getUserFromRequest(request);
    if (!authUser) return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });

    const { db } = await connectToDatabase();
    let query: any = {};
    
    if (authUser.role === 'admin' || authUser.role === 'user') {
        // Transportadora vê os avisos globais/internos dela
        query.parentId = { $exists: false };
    } else {
        // Cliente vê os avisos da sua própria Matriz
        const tenantId = authUser.role === 'sub-cliente' ? authUser.parentId : authUser.userId;
        query.parentId = tenantId;
    }

    const announcements = await db.collection('announcements').find(query).sort({ pinned: -1, timestamp: -1 }).toArray();
    
    const announcementsWithId = announcements.map(announcement => {
      const { _id, ...rest } = announcement;
      return { id: _id.toHexString(), ...rest };
    });

    return NextResponse.json(announcementsWithId);
  } catch (error: any) {
    console.error('API Announcements GET Error:', error);
    return NextResponse.json({ message: `Erro ao buscar avisos: ${error.message}` }, { status: 500 });
  }
}

// POST a new announcement
export async function POST(request: Request) {
  try {
    const authUser = getUserFromRequest(request);
    if (!authUser) return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });

    const { text, pinned, duration, authorId, authorUsername } = await request.json();

    if (!text || !authorId || !authorUsername) {
      return NextResponse.json({ message: 'Campos obrigatórios em falta.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    // Define o parentId com base no tenant do autor
    let parentId: string | null = null;
    if (authUser.role === 'cliente' || authUser.role === 'sub-cliente') {
        parentId = authUser.role === 'sub-cliente' ? (authUser.parentId || null) : authUser.userId;
    }
    
    const newAnnouncement: Omit<ChatAnnouncement, 'id'> = {
      text,
      pinned: pinned || false,
      duration: duration || 7,
      timestamp: new Date().toISOString(),
      authorId: authorId,
      authorUsername: authorUsername,
      visibleTo: [], 
      parentId: parentId as any,
    };

    const result = await db.collection('announcements').insertOne(newAnnouncement);
    const createdAnnouncement = { id: result.insertedId.toHexString(), ...newAnnouncement };

    return NextResponse.json(createdAnnouncement, { status: 201 });
  } catch (error: any) {
    console.error('API Announcements POST Error:', error);
    return NextResponse.json({ message: `Erro ao criar aviso: ${error.message}` }, { status: 500 });
  }
}
