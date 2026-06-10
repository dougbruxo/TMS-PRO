import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { getUserFromRequest } from '@/lib/auth-api';

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const authUser = getUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }
    const currentUserId = authUser.userId || authUser.id;

    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    // The path is /api/chat/conversations/[id]/clear, so the ID is the second to last part
    const chatId = parts[parts.length - 2];
    
    if (!chatId || !ObjectId.isValid(chatId)) {
      return NextResponse.json({ message: 'ID do chat inválido.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    const conversation = await db.collection('conversations').findOne({ _id: new ObjectId(chatId) });
    if (!conversation) {
      return NextResponse.json({ message: 'Conversa não encontrada.' }, { status: 404 });
    }

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(currentUserId) });
    const isOperator = userDoc ? (userDoc.role === 'admin' || userDoc.role === 'user') : false;

    if (conversation.isGroup && isOperator) {
      const activeOperatorIds = conversation.activeOperatorIds || [];
      if (conversation.status === 'active' && !activeOperatorIds.includes(currentUserId)) {
        return NextResponse.json({ message: 'Você não é um atendente ativo nesta conversa.' }, { status: 403 });
      }
    }

    // Apaga todas as mensagens associadas ao chatId
    const deleteResult = await db.collection('messages').deleteMany({
      chatId: new ObjectId(chatId)
    });

    // Opcional: Atualiza a conversa para remover a "última mensagem"
    await db.collection('conversations').updateOne(
        { _id: new ObjectId(chatId) },
        { $set: { lastMessage: null } }
    );
    
    return NextResponse.json({ message: 'Histórico da conversa limpo.', deletedCount: deleteResult.deletedCount }, { status: 200 });

  } catch (error: any) {
    console.error('API Clear Conversation Error:', error);
    return NextResponse.json({ message: `Erro ao limpar a conversa: ${error.message}` }, { status: 500 });
  }
}
