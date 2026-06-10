import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function formatConversation(doc: any) {
  const { _id, participants, ...rest } = doc;
  return {
    ...rest,
    id: _id?.toHexString?.() ?? String(_id),
    participants: (participants ?? []).map((p: any) =>
      typeof p?.toHexString === 'function' ? p.toHexString() : String(p)
    ),
  };
}

function formatMessage(doc: any) {
  const { _id, chatId, senderId, ...rest } = doc;
  return {
    ...rest,
    id: _id?.toHexString?.() ?? String(_id),
    chatId: typeof chatId?.toHexString === 'function' ? chatId.toHexString() : String(chatId),
    senderId: typeof senderId?.toHexString === 'function' ? senderId.toHexString() : String(senderId),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const chatId = searchParams.get('chatId');
  const lastCheckParam = searchParams.get('lastCheck');
  const token = searchParams.get('token');

  // Verify authentication
  if (!token) {
    return NextResponse.json({ message: 'Token não fornecido.' }, { status: 401 });
  }
  try {
    const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-development';
    jwt.verify(token, JWT_SECRET);
  } catch {
    return NextResponse.json({ message: 'Token inválido ou expirado.' }, { status: 401 });
  }

  if (!userId || !ObjectId.isValid(userId)) {
    return NextResponse.json({ message: 'userId inválido.' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  let closed = false;
  const { signal } = request;
  signal.addEventListener('abort', () => { closed = true; });

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          closed = true;
        }
      };

      // Heartbeat to confirm connection established
      send('connected', { timestamp: new Date().toISOString() });

      const CHECK_INTERVAL_MS = 2000;
      const MAX_HOLD_MS = 25000;
      const startTime = Date.now();
      let currentLastCheck = lastCheckParam || new Date(Date.now() - 10000).toISOString();

      try {
        const { db } = await connectToDatabase();

        while (!closed && !signal.aborted && Date.now() - startTime < MAX_HOLD_MS) {
          await sleep(CHECK_INTERVAL_MS);
          if (closed || signal.aborted) break;

          const now = new Date().toISOString();

          try {
            // Check for updated conversations (new messages or status changes)
            const updatedConvos = await db.collection('conversations').find({
              participants: new ObjectId(userId),
              'lastMessage.timestamp': { $gt: currentLastCheck },
            }).toArray();

            if (updatedConvos.length > 0) {
              send('conversations', updatedConvos.map(formatConversation));
            }

            // Check for new messages in the active chat
            if (chatId && ObjectId.isValid(chatId)) {
              const newMessages = await db.collection('messages').find({
                chatId: new ObjectId(chatId),
                timestamp: { $gt: currentLastCheck },
                isDeleted: { $ne: true },
              }).sort({ timestamp: 1 }).toArray();

              if (newMessages.length > 0) {
                send('messages', newMessages.map(formatMessage));
              }
            }

            currentLastCheck = now;
          } catch (err) {
            // Log but don't crash — will retry on next interval
            console.error('[SSE] DB check error:', err);
          }
        }
      } catch (err) {
        console.error('[SSE] Stream initialization error:', err);
      }

      // Gracefully tell client to reconnect with updated lastCheck
      if (!closed && !signal.aborted) {
        send('reconnect', { lastCheck: currentLastCheck });
      }

      try { controller.close(); } catch { /* already closed */ }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering for SSE
    },
  });
}
