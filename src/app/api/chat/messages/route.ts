

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import type { User, ChatMessage, ChatConversation, SharedItem } from '@/lib/types';

// POST a new message
export async function POST(request: Request) {
  try {
    const { chatId, text, senderId, sharedItem }: { chatId: string, text?: string, senderId: string, sharedItem?: SharedItem } = await request.json();

    if (!chatId || (!text && !sharedItem) || !senderId) {
      return NextResponse.json({ message: 'Campos obrigatórios em falta.' }, { status: 400 });
    }
     if (!ObjectId.isValid(chatId) || !ObjectId.isValid(senderId)) {
        return NextResponse.json({ message: 'ID do chat ou remetente inválido.' }, { status: 400 });
    }
    
    const { db } = await connectToDatabase();
    
    const user = await db.collection<Omit<User,'id'>>('users').findOne({ _id: new ObjectId(senderId) });
    if (!user) {
         return NextResponse.json({ message: 'Usuário remetente não encontrado.' }, { status: 404 });
    }

    const newMessage: Omit<ChatMessage, 'id'> = {
      chatId: new ObjectId(chatId),
      senderId: new ObjectId(senderId),
      senderUsername: user.username,
      senderAvatarUrl: user.avatarUrl || undefined,
      text: text ? text.trim() : '',
      sharedItem: sharedItem || undefined,
      timestamp: new Date().toISOString(),
      isDeleted: false,
    };

    const result = await db.collection('messages').insertOne(newMessage as any);
    const createdMessage = { ...newMessage, id: result.insertedId.toHexString() };


    const conversation = await db.collection<any>('conversations').findOne({ _id: new ObjectId(chatId) });

    if(conversation) {
        const readByUpdate: Record<string, boolean> = {};
        conversation.participants.forEach((participantId: string | ObjectId) => {
            const participantIdStr = participantId.toString();
            readByUpdate[participantIdStr] = participantIdStr === senderId;
        });
        
        let status = conversation.status || 'active';
        let activeOperatorIds = conversation.activeOperatorIds || [];
        
        const isHubChat = conversation.isGroup === true;
        const senderUserObj = await db.collection('users').findOne({ _id: new ObjectId(senderId) });
        const isClient = senderUserObj && (senderUserObj.role === 'cliente' || senderUserObj.role === 'sub-cliente');

        if (isHubChat && (status === 'finished' || !conversation.status) && isClient) {
            status = 'pending';
            activeOperatorIds = [];
            
            const welcomeText = `Novo atendimento iniciado no hub ${conversation.name}. Aguardando triagem dos atendentes.`;
            const systemMessage = {
                chatId: new ObjectId(chatId),
                senderId: new ObjectId("000000000000000000000000"), // System sender ID
                senderUsername: 'Sistema',
                senderAvatarUrl: conversation.avatarUrl || undefined,
                text: welcomeText,
                timestamp: new Date().toISOString(),
                isDeleted: false,
            };
            await db.collection('messages').insertOne(systemMessage);
        }

        const lastMessagePayload = {
            text: newMessage.text,
            timestamp: newMessage.timestamp,
            senderId: newMessage.senderId.toHexString(),
            sharedItem: newMessage.sharedItem || undefined,
        };

        await db.collection('conversations').updateOne(
            { _id: new ObjectId(chatId) },
            { 
              $set: {
                lastMessage: lastMessagePayload,
                readBy: readByUpdate,
                status,
                activeOperatorIds,
              }
            }
        );
    }
    

    return NextResponse.json(createdMessage, { status: 201 });

  } catch (error: any) {
    console.error('API Messages POST Error:', error);
    return NextResponse.json({ message: `Erro ao enviar mensagem: ${error.message}` }, { status: 500 });
  }
}

// GET messages for a specific chat
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const chatId = searchParams.get('chatId');

        if (!chatId) {
            return NextResponse.json({ message: 'ID do chat não fornecido.' }, { status: 400 });
        }

        const { db } = await connectToDatabase();
        const messages = await db.collection('messages').find({
            chatId: new ObjectId(chatId)
        }).sort({ timestamp: 1 }).toArray();

        // Dynamically fetch and merge latest avatars and usernames
        const senderIds = [...new Set(messages.map(msg => msg.senderId))];
        const users = await db.collection('users').find({
            _id: { $in: senderIds }
        }).toArray();
        const userMap = new Map(users.map(u => [u._id.toString(), u]));

        const messagesWithId = messages.map(msg => {
            const senderIdStr = msg.senderId.toString();
            const senderUser = userMap.get(senderIdStr);
            return {
                ...msg,
                id: msg._id.toHexString(),
                chatId: msg.chatId.toHexString(),
                senderId: senderIdStr,
                senderUsername: senderUser ? senderUser.username : msg.senderUsername,
                senderAvatarUrl: senderUser ? senderUser.avatarUrl : msg.senderAvatarUrl,
            };
        });
        
        return NextResponse.json(messagesWithId);
    } catch (error: any) {
        console.error('API Messages GET Error:', error);
        return NextResponse.json({ message: `Erro ao buscar mensagens: ${error.message}` }, { status: 500 });
    }
}
