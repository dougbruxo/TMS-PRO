
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

// GET all conversations for the logged-in user
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId || !ObjectId.isValid(userId)) {
      return NextResponse.json({ message: "ID do usuário inválido ou não fornecido." }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    const conversations = await db.collection('conversations').find({
      participants: new ObjectId(userId)
    }).sort({ "lastMessage.timestamp": -1 }).toArray();
    
    const conversationsWithId = conversations.map(convo => ({
      ...convo,
      id: convo._id.toHexString(),
    }));

    return NextResponse.json(conversationsWithId);
  } catch (error: any) {
    console.error('API Conversations GET Error:', error);
    return NextResponse.json({ message: `Erro ao buscar conversas: ${error.message}` }, { status: 500 });
  }
}

// POST to create a new conversation or get an existing one
export async function POST(request: Request) {
  try {
    let { participantIds, name, avatarUrl, isGroup } = await request.json();
    
    if (!participantIds || !Array.isArray(participantIds) || participantIds.length < 2) {
      return NextResponse.json({ message: "São necessários pelo menos dois participantes." }, { status: 400 });
    }
    
    const { db } = await connectToDatabase();
    
    // Remove duplicates
    participantIds = [...new Set(participantIds)];
    
    const participantObjectIds = participantIds.map((id: string) => new ObjectId(id));

    // Find existing conversation with the exact same participants
    const existingConversation = await db.collection('conversations').findOne({
      participants: { $all: participantObjectIds, $size: participantIds.length }
    });

    if (existingConversation) {
      return NextResponse.json({ conversationId: existingConversation._id.toHexString() }, { status: 200 });
    }

    // Create a new conversation if none exists
    const newConversation = {
      participants: participantObjectIds,
      createdAt: new Date().toISOString(),
      lastMessage: null,
      readBy: participantIds.reduce((acc: any, id: string) => {
        acc[id] = false;
        return acc;
      }, {}),
      name: name || undefined,
      avatarUrl: avatarUrl || undefined,
      isGroup: isGroup || false,
    };

    const result = await db.collection('conversations').insertOne(newConversation);

    return NextResponse.json({ conversationId: result.insertedId.toHexString() }, { status: 201 });

  } catch (error: any) {
    console.error('API Conversations POST Error:', error);
    return NextResponse.json({ message: `Erro ao criar conversa: ${error.message}` }, { status: 500 });
  }
}


    