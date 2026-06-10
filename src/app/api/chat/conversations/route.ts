
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

    // Fetch all hubs to dynamically update name and avatarUrl for groups
    const hubs = await db.collection('chat_hubs').find({}).toArray();
    
    const conversationsWithId = conversations.map(convo => {
      let updatedConvo = {
        ...convo,
        id: convo._id.toHexString(),
        participants: convo.participants.map((p: any) => p.toHexString()),
      };
      if (convo.isGroup && convo.name) {
        const matchingHub = hubs.find(h => h.name === convo.name);
        if (matchingHub) {
          updatedConvo.avatarUrl = matchingHub.avatarUrl || convo.avatarUrl;
          updatedConvo.name = matchingHub.name || convo.name;
        }
      }
      return updatedConvo;
    });

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
      // Sync name and avatarUrl with the hub if it's a group
      if (existingConversation.isGroup && existingConversation.name) {
        const hub = await db.collection('chat_hubs').findOne({ name: existingConversation.name });
        if (hub && (existingConversation.avatarUrl !== hub.avatarUrl || existingConversation.name !== hub.name)) {
          await db.collection('conversations').updateOne(
            { _id: existingConversation._id },
            { $set: { avatarUrl: hub.avatarUrl, name: hub.name } }
          );
        }
      }
      return NextResponse.json({ conversationId: existingConversation._id.toHexString() }, { status: 200 });
    }

    // Create a new conversation if none exists
    const newConversation: any = {
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

    // If it's a hub, fetch its latest name and avatarUrl from chat_hubs to be 100% accurate
    if (isGroup && name) {
      const hub = await db.collection('chat_hubs').findOne({ name });
      if (hub) {
        newConversation.avatarUrl = hub.avatarUrl || newConversation.avatarUrl;
        newConversation.name = hub.name || newConversation.name;
      }
    }

    const result = await db.collection('conversations').insertOne(newConversation);
    const conversationId = result.insertedId.toHexString();

    // Welcome System Message for B2B Clients starting a hub chat
    if (isGroup && name) {
      const operators = await db.collection('users').find({
        _id: { $in: participantObjectIds },
        role: { $in: ['admin', 'user'] }
      }).toArray();
      const operatorNames = operators.map(o => o.username).join(', ');
      
      if (operatorNames) {
        const welcomeText = `Olá! Você iniciou um atendimento no hub ${name || newConversation.name}. Você está falando com: ${operatorNames}.`;
        const systemMessage = {
          chatId: result.insertedId,
          senderId: new ObjectId("000000000000000000000000"), // System sender ID
          senderUsername: 'Sistema',
          senderAvatarUrl: newConversation.avatarUrl || undefined,
          text: welcomeText,
          timestamp: new Date().toISOString(),
          isDeleted: false,
        };
        await db.collection('messages').insertOne(systemMessage);
        
        // Also set lastMessage in newConversation
        await db.collection('conversations').updateOne(
          { _id: result.insertedId },
          { 
            $set: {
              lastMessage: {
                text: welcomeText,
                timestamp: systemMessage.timestamp,
                senderId: "000000000000000000000000"
              }
            }
          }
        );
      }
    }

    return NextResponse.json({ conversationId }, { status: 201 });
  } catch (error: any) {
    console.error('API Conversations POST Error:', error);
    return NextResponse.json({ message: `Erro ao criar conversa: ${error.message}` }, { status: 500 });
  }
}



    