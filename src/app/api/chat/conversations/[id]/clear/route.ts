import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    // The path is /api/chat/conversations/[id]/clear, so the ID is the second to last part
    const chatId = parts[parts.length - 2];
    
    if (!chatId || !ObjectId.isValid(chatId)) {
      return NextResponse.json({ message: 'ID do chat inválido.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
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
