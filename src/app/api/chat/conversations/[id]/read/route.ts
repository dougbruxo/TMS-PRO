
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const chatId = parts[parts.length - 2]; // Path is /api/chat/conversations/[id]/read

    const { userId } = await request.json();

    if (!chatId || !userId) {
      return NextResponse.json({ message: 'Chat ID e User ID são obrigatórios.' }, { status: 400 });
    }

    if (!ObjectId.isValid(chatId) || !ObjectId.isValid(userId)) {
        return NextResponse.json({ message: 'IDs inválidos.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    await db.collection('conversations').updateOne(
      { _id: new ObjectId(chatId) },
      { $set: { [`readBy.${userId}`]: true } }
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('API Mark as Read Error:', error);
    return NextResponse.json({ message: `Erro ao marcar conversa como lida: ${error.message}` }, { status: 500 });
  }
}
