import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { getUserFromRequest } from '@/lib/auth-api';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const authUser = getUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const { id: chatId } = await context.params;
    if (!chatId || !ObjectId.isValid(chatId)) {
      return NextResponse.json({ message: 'ID da conversa inválido.' }, { status: 400 });
    }

    const { action, operatorId, targetOperatorId } = await request.json();
    const currentUserId = authUser.userId || authUser.id;

    const { db } = await connectToDatabase();
    const conversation = await db.collection('conversations').findOne({ _id: new ObjectId(chatId) });

    if (!conversation) {
      return NextResponse.json({ message: 'Conversa não encontrada.' }, { status: 404 });
    }

    let status = conversation.status || 'active';
    let activeOperatorIds = conversation.activeOperatorIds || [];
    let systemText = '';

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(currentUserId) });
    const isOperator = userDoc ? (userDoc.role === 'admin' || userDoc.role === 'user') : false;
    const isClient = userDoc ? (userDoc.role === 'cliente' || userDoc.role === 'sub-cliente') : false;

    // Security check for Group Support Hub chats
    if (conversation.isGroup) {
      if (action === 'interact') {
        if (!isOperator) {
          return NextResponse.json({ message: 'Apenas operadores podem interagir com este canal.' }, { status: 403 });
        }
        if (conversation.status === 'active' && conversation.activeOperatorIds?.length > 0) {
          return NextResponse.json({ message: 'Este atendimento já foi assumido por outro operador.' }, { status: 403 });
        }
      } else {
        // Any other action (transfer, add-operator, remove-operator, finalize)
        if (isOperator) {
          // Must be an active operator to perform collaborative management or finalise
          if (!activeOperatorIds.includes(currentUserId)) {
            return NextResponse.json({ message: 'Você não é um atendente ativo nesta conversa.' }, { status: 403 });
          }
        } else if (isClient) {
          // B2B Clients can only finalize
          if (action !== 'finalize') {
            return NextResponse.json({ message: 'Clientes apenas podem finalizar o atendimento.' }, { status: 403 });
          }
        } else {
          return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });
        }
      }
    }

    if (action === 'interact') {
      status = 'active';
      const operatorName = userDoc ? userDoc.username : 'Atendente';
      
      activeOperatorIds = [currentUserId];
      systemText = `Atendimento com ${operatorName}.`;
    } 
    else if (action === 'transfer') {
      if (!targetOperatorId || !ObjectId.isValid(targetOperatorId)) {
        return NextResponse.json({ message: 'ID do atendente de destino inválido.' }, { status: 400 });
      }
      status = 'active';
      const targetUser = await db.collection('users').findOne({ _id: new ObjectId(targetOperatorId) });
      const targetName = targetUser ? targetUser.username : 'Atendente';
      
      activeOperatorIds = [targetOperatorId];
      systemText = `Atendimento com ${targetName}.`;
    } 
    else if (action === 'add-operator') {
      const opId = operatorId || currentUserId;
      if (!opId || !ObjectId.isValid(opId)) {
        return NextResponse.json({ message: 'ID do atendente inválido.' }, { status: 400 });
      }
      const operatorUser = await db.collection('users').findOne({ _id: new ObjectId(opId) });
      const operatorName = operatorUser ? operatorUser.username : 'Atendente';
      
      if (!activeOperatorIds.includes(opId)) {
        activeOperatorIds.push(opId);
      }
      
      const operators = await db.collection('users').find({
        _id: { $in: activeOperatorIds.map((id: string) => new ObjectId(id)) }
      }).toArray();
      const operatorNames = operators.map(o => o.username).join(' e ');
      
      systemText = `${operatorName} entrou na conversa. Atendimento com ${operatorNames}.`;
    } 
    else if (action === 'remove-operator') {
      const opId = operatorId || currentUserId;
      if (!opId || !ObjectId.isValid(opId)) {
        return NextResponse.json({ message: 'ID do atendente inválido.' }, { status: 400 });
      }
      const operatorUser = await db.collection('users').findOne({ _id: new ObjectId(opId) });
      const operatorName = operatorUser ? operatorUser.username : 'Atendente';
      
      activeOperatorIds = activeOperatorIds.filter((id: string) => id !== opId);
      
      if (activeOperatorIds.length > 0) {
        const operators = await db.collection('users').find({
          _id: { $in: activeOperatorIds.map((id: string) => new ObjectId(id)) }
        }).toArray();
        const operatorNames = operators.map(o => o.username).join(' e ');
        
        systemText = `${operatorName} saiu da conversa. Atendimento com ${operatorNames}.`;
      } else {
        status = 'pending';
        systemText = `${operatorName} saiu da conversa. Atendimento sem operadores definidos (Pendente).`;
      }
    } 
    else if (action === 'finalize') {
      status = 'finished';
      activeOperatorIds = [];
      const user = await db.collection('users').findOne({ _id: new ObjectId(currentUserId) });
      const finalizerRole = user ? user.role : 'atendente';
      const finalizerName = (finalizerRole === 'cliente' || finalizerRole === 'sub-cliente') ? 'cliente' : 'atendente';
      
      systemText = `Atendimento finalizado pelo ${finalizerName}.`;
    } 
    else {
      return NextResponse.json({ message: 'Ação inválida.' }, { status: 400 });
    }

    if (systemText) {
      const systemMessage = {
        chatId: new ObjectId(chatId),
        senderId: new ObjectId("000000000000000000000000"), // System sender ID
        senderUsername: 'Sistema',
        senderAvatarUrl: conversation.avatarUrl || undefined,
        text: systemText,
        timestamp: new Date().toISOString(),
        isDeleted: false,
      };
      
      await db.collection('messages').insertOne(systemMessage);
      
      const readByUpdate: Record<string, boolean> = {};
      conversation.participants.forEach((participantId: string | ObjectId) => {
        const participantIdStr = participantId.toString();
        readByUpdate[participantIdStr] = participantIdStr === currentUserId;
      });

      await db.collection('conversations').updateOne(
        { _id: new ObjectId(chatId) },
        { 
          $set: {
            status,
            activeOperatorIds,
            readBy: readByUpdate,
            lastMessage: {
              text: systemText,
              timestamp: systemMessage.timestamp,
              senderId: "000000000000000000000000"
            }
          }
        }
      );
    }

    return NextResponse.json({ success: true, status, activeOperatorIds });

  } catch (error: any) {
    console.error('API Conversation Workflow Error:', error);
    return NextResponse.json({ message: `Erro ao processar workflow: ${error.message}` }, { status: 500 });
  }
}
