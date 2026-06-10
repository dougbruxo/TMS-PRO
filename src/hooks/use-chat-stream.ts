'use client';

import { useEffect, useRef } from 'react';

interface UseChatStreamOptions {
  /** The authenticated user ID. Pass null/undefined to disable the stream. */
  userId: string | null | undefined;
  /** Optional: subscribe to message updates for a specific chat. */
  chatId?: string | null;
  /** Called whenever updated conversations arrive from the server. */
  onConversations?: (conversations: any[]) => void;
  /** Called whenever new messages arrive for the active chatId. */
  onMessages?: (messages: any[]) => void;
  /** Set false to temporarily disable the stream (e.g. user is logged out). Default: true. */
  enabled?: boolean;
}

/**
 * useChatStream — replaces setInterval polling with Server-Sent Events.
 *
 * Features:
 * - Automatically pauses the SSE connection when the browser tab is hidden
 *   (Page Visibility API) and resumes when the user returns.
 * - Reconnects immediately after the server sends a graceful "reconnect" event
 *   (server rotates connection every ~25 s to stay within serverless timeouts).
 * - Retries with a 5-second back-off on network errors.
 * - Uses stable refs for callbacks to avoid stale-closure issues.
 */
export function useChatStream({
  userId,
  chatId,
  onConversations,
  onMessages,
  enabled = true,
}: UseChatStreamOptions) {
  // Stable refs for callbacks — prevent EventSource from re-creating when
  // parent re-renders with new inline arrow functions.
  const onConversationsRef = useRef(onConversations);
  const onMessagesRef = useRef(onMessages);
  onConversationsRef.current = onConversations;
  onMessagesRef.current = onMessages;

  // These refs let the stable connect() closure read current values.
  const userIdRef = useRef(userId);
  const chatIdRef = useRef(chatId);
  const enabledRef = useRef(enabled);
  userIdRef.current = userId;
  chatIdRef.current = chatId;
  enabledRef.current = enabled;

  const esRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCheckRef = useRef<string>(new Date(Date.now() - 10000).toISOString());
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    // ---- helpers ----
    const clearReconnect = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const disconnect = () => {
      clearReconnect();
      esRef.current?.close();
      esRef.current = null;
    };

    const connect = () => {
      const uid = userIdRef.current;
      if (!uid || !mountedRef.current || !enabledRef.current) return;
      if (typeof document !== 'undefined' && document.hidden) return;

      disconnect();

      // EventSource doesn't support custom headers, so we pass the JWT as a
      // query param. This is acceptable for internal LAN/intranet systems.
      const token =
        typeof window !== 'undefined' ? localStorage.getItem('sessionToken') : null;
      if (!token) return;

      const params = new URLSearchParams({
        userId: uid,
        lastCheck: lastCheckRef.current,
        token,
      });
      const cid = chatIdRef.current;
      if (cid) params.set('chatId', cid);

      const es = new EventSource(`/api/chat/stream?${params}`);
      esRef.current = es;

      es.addEventListener('conversations', (e: MessageEvent) => {
        if (!mountedRef.current) return;
        try {
          onConversationsRef.current?.(JSON.parse(e.data));
        } catch { /* malformed JSON — ignore */ }
      });

      es.addEventListener('messages', (e: MessageEvent) => {
        if (!mountedRef.current) return;
        try {
          onMessagesRef.current?.(JSON.parse(e.data));
        } catch { /* malformed JSON — ignore */ }
      });

      // Server sends this event after ~25 s to rotate the connection gracefully.
      es.addEventListener('reconnect', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data.lastCheck) lastCheckRef.current = data.lastCheck;
        } catch {}
        es.close();
        esRef.current = null;
        if (mountedRef.current && enabledRef.current) {
          reconnectTimerRef.current = setTimeout(connect, 200);
        }
      });

      es.onerror = () => {
        es.close();
        esRef.current = null;
        if (mountedRef.current && enabledRef.current) {
          // Back-off 5 s before retrying on network error
          reconnectTimerRef.current = setTimeout(connect, 5000);
        }
      };
    };

    // ---- Page Visibility: pause/resume ----
    const handleVisibilityChange = () => {
      if (document.hidden) {
        disconnect();
      } else {
        connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    connect();

    return () => {
      mountedRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      disconnect();
    };
  // Re-connect when userId, chatId, or enabled changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, chatId, enabled]);
}
