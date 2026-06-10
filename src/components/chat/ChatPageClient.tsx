
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, MessageSquare } from 'lucide-react';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ChatMessages } from '@/components/chat/ChatMessages';
import { ChatInput } from '@/components/chat/ChatInput';
import { ChatAnnouncements } from '@/components/chat/ChatAnnouncements';
import type { ChatMessage, User, ChatConversation, ChatAnnouncement, HubUser, SharedItem } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/api-client';
import { useChatStream } from '@/hooks/use-chat-stream';

export function ChatPageClient() {
  const { user, loading: authLoading, refreshNotificationCounts } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [announcements, setAnnouncements] = useState<ChatAnnouncement[]>([]);
  const [hubs, setHubs] = useState<HubUser[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  const initialChatId = searchParams.get('id');
  const [activeChatId, setActiveChatId] = useState<string | null>(initialChatId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const fetchPageData = useCallback(async () => {
    if (!user) return;
    setIsLoadingData(true);
    try {
        const [usersRes, announcementsRes, convosRes, hubsRes] = await Promise.all([
            authFetch('/api/users?includeClients=true'),
            authFetch('/api/announcements'),
            authFetch(`/api/chat/conversations?userId=${user.id}`),
            authFetch('/api/chat/hubs'),
        ]);

        if (!usersRes.ok || !announcementsRes.ok || !convosRes.ok || !hubsRes.ok) {
            throw new Error("Falha ao carregar dados do chat.");
        }
        
        setUsers(await usersRes.json());
        setAnnouncements(await announcementsRes.json());
        setConversations(await convosRes.json());
        setHubs(await hubsRes.json());

    } catch (e: any) {
        toast({ variant: 'destructive', title: "Erro de Carregamento", description: e.message });
    } finally {
        setIsLoadingData(false);
    }
  }, [toast, user]);

  const fetchMessages = useCallback(async (chatId: string) => {
    if (!user) return;
    try {
        const response = await authFetch(`/api/chat/messages?chatId=${chatId}`);
        if(response.ok) {
            const newMessages: ChatMessage[] = await response.json();
            
            setMessages(prevMessages => {
                if (JSON.stringify(newMessages) !== JSON.stringify(prevMessages)) {
                    return newMessages;
                }
                return prevMessages;
            });

        } else {
            setMessages([]);
        }
    } catch (error) {
        console.error("Failed to fetch messages:", error);
        setMessages([]);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && (!user || !user.chatEnabled)) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  const handleSelectConversation = (chatId: string) => {
    router.push(`/chat?id=${chatId}`);
  };

  const markConversationAsRead = useCallback((chatId: string) => {
    if (!user) return;
    const convo = conversations.find(c => c.id === chatId);
    if (convo && convo.readBy && !convo.readBy[user.id]) {
      setConversations(prev => prev.map(c => 
          c.id === chatId ? { ...c, readBy: { ...c.readBy, [user.id]: true } } : c
      ));
      authFetch(`/api/chat/conversations/${chatId}/read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
      }).then(res => {
          if (res.ok) {
              refreshNotificationCounts();
          }
      }).catch(error => {
          console.error("Error marking as read:", error);
      });
    }
  }, [user, conversations, refreshNotificationCounts]);

  useEffect(() => {
    const newChatId = searchParams.get('id');
    setActiveChatId(newChatId);

    if (newChatId) {
      fetchMessages(newChatId);
      markConversationAsRead(newChatId);
    } else {
      setMessages([]);
    }
  }, [searchParams, fetchMessages, markConversationAsRead]);

  useEffect(() => {
    if (user) {
      fetchPageData();
    }
  }, [user, fetchPageData]);

  // ─── Real-time via SSE (replaces setInterval polling) ──────────────────────
  useChatStream({
    userId: user?.id,
    chatId: activeChatId,
    enabled: !!user,
    onConversations: (updatedConvos) => {
      // Merge updated conversations into state by ID
      setConversations(prev => {
        const idMap = new Map(updatedConvos.map((c: ChatConversation) => [c.id, c]));
        const merged = prev.map(c => idMap.has(c.id) ? { ...c, ...idMap.get(c.id) } : c);
        // Add any truly new conversations not yet in state
        updatedConvos.forEach((c: ChatConversation) => {
          if (!merged.some(m => m.id === c.id)) merged.unshift(c);
        });
        return merged;
      });
    },
    onMessages: (newMsgs) => {
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const fresh = newMsgs.filter((m: ChatMessage) => !existingIds.has(m.id));
        return fresh.length > 0 ? [...prev, ...fresh] : prev;
      });
    },
  });


  const startOrGetConversation = useCallback(async (entity: User | HubUser): Promise<string | null> => {
    if (!user) return null;
    try {
        let payload: any;
        if ('linkedUserIds' in entity) { // It's a HubUser
            payload = {
                participantIds: [...new Set([user.id, ...entity.linkedUserIds])], // Ensure current user is in and no duplicates
                name: entity.name,
                avatarUrl: entity.avatarUrl,
                isGroup: true,
            };
        } else { // It's a regular User
            payload = {
                participantIds: [user.id, entity.id],
            };
        }

        const response = await authFetch('/api/chat/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const { conversationId } = await response.json();
        
        // Use a function to correctly update state after async operation
        setConversations(prev => {
            // Check if convo already exists to avoid duplicates
            if (prev.some(c => c.id === conversationId)) {
                return prev;
            }
            // If not, fetch updated list
            authFetch(`/api/chat/conversations?userId=${user.id}`)
                .then(res => res.ok ? res.json() : Promise.reject())
                .then(setConversations);
            return prev; // return previous state until fetch completes
        });
            
        return conversationId;
    } catch (error) {
        console.error("Error starting conversation:", error);
        return null;
    }
  }, [user]);
  
  const handleSendMessage = async (message: { text?: string; sharedItem?: SharedItem }) => {
    if ((!message.text || !message.text.trim()) && !message.sharedItem) return;
    if (!user || !activeChatId) return;

    setIsSending(true);
     try {
        const response = await authFetch('/api/chat/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId: activeChatId, ...message, senderId: user.id }),
        });
        if (!response.ok) {
            throw new Error("Falha ao enviar a mensagem.");
        }
        
        await fetchMessages(activeChatId);
        
        setConversations(prevConvos => {
            const convoIndex = prevConvos.findIndex(c => c.id === activeChatId);
            if (convoIndex === -1) return prevConvos;

            const updatedConvo = {
                ...prevConvos[convoIndex],
                lastMessage: {
                    text: message.text || `[${message.sharedItem?.type}]`,
                    timestamp: new Date().toISOString(),
                    senderId: user.id,
                }
            };
            
            const otherConvos = prevConvos.filter(c => c.id !== activeChatId);
            return [updatedConvo, ...otherConvos];
        });

    } catch (error) {
        console.error("Error sending message:", error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível enviar a mensagem.' });
    }
    setIsSending(false);
  };
  
   const handleClearConversation = async () => {
    if (!activeChatId) return;
    setIsClearing(true);
    try {
      const response = await authFetch(`/api/chat/conversations/${activeChatId}/clear`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setMessages([]);
        if (user) await fetchPageData();
        toast({ title: 'Conversa Limpa', description: 'O histórico de mensagens foi apagado.' });
      } else {
        throw new Error('Falha ao limpar a conversa.');
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
      setIsClearing(false);
    }
  };

  if (authLoading || isLoadingData || !user) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isOperator = user?.role === 'admin' || user?.role === 'user';
  const visibleConversations = conversations.filter(convo => {
    if (convo.isGroup && isOperator) {
      // Hide active chats that the current operator is not part of
      if (convo.status === 'active' && !convo.activeOperatorIds?.includes(user.id)) {
        return false;
      }
      // Hide finished chats for a clean, action-focused inbox
      if (convo.status === 'finished') {
        return false;
      }
    }
    return true;
  });

  return (
      <div className="flex h-full border rounded-lg bg-card shadow-sm overflow-hidden chat-main-page-container">
        <ChatSidebar
            users={users}
            hubs={hubs}
            conversations={visibleConversations}
            activeChatId={activeChatId}
            onSelectConversation={handleSelectConversation}
            onStartNewChat={startOrGetConversation}
            currentUser={user}
        />
        <main className="flex flex-1 flex-col">
            {activeChatId ? (
                <>
                    <ChatAnnouncements announcements={announcements} />
                    <ChatMessages
                        messages={messages}
                        currentUserId={user.id}
                        onClearConversation={handleClearConversation}
                        isClearing={isClearing}
                        activeChatId={activeChatId}
                        activeConversation={conversations.find(c => c.id === activeChatId)}
                        users={users}
                        onMutateConversations={fetchPageData}
                        fetchMessages={fetchMessages}
                    />
                    <ChatInput 
                        onSendMessage={handleSendMessage} 
                        isSending={isSending} 
                        disabled={(() => {
                            const convo = conversations.find(c => c.id === activeChatId);
                            if (!convo || !convo.isGroup || !isOperator) return false;
                            return convo.status === 'pending' || 
                                   convo.status === 'finished' || 
                                   (convo.status === 'active' && !convo.activeOperatorIds?.includes(user.id));
                        })()}
                    />
                </>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <MessageSquare size={64} className="mb-4" />
                    <h2 className="text-2xl font-semibold">Selecione uma conversa</h2>
                    <p>Escolha um utilizador na barra lateral para começar a conversar.</p>
                </div>
            )}
        </main>
      </div>
  );
}
