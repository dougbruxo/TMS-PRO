'use client';

import { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { usePathname } from 'next/navigation';
import { ChatPopup } from './ChatPopup';
import type { ChatConversation, ChatMessage, User, HubUser, SharedItem } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/api-client';

export function ChatPopupManager() {
    const { user, openPopupIds, setOpenPopupIds, refreshNotificationCounts } = useAuth();
    const pathname = usePathname();
    const { toast } = useToast();

    const [conversations, setConversations] = useState<ChatConversation[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [allHubs, setAllHubs] = useState<HubUser[]>([]);
    const [messagesByChat, setMessagesByChat] = useState<Record<string, ChatMessage[]>>({});
    const [isSending, setIsSending] = useState<string | null>(null); // chatId of sending message
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [flashingPopups, setFlashingPopups] = useState<string[]>([]);
    const [minimizedPopupIds, setMinimizedPopupIds] = useState<string[]>([]);
    const [sessionClosedIds, setSessionClosedIds] = useState<string[]>(() => {
        if (typeof window === 'undefined') return [];
        try { return JSON.parse(localStorage.getItem('chatClosedIds') || '[]'); } catch { return []; }
    });

    const prevConversationsRef = useRef<ChatConversation[]>([]);

    useEffect(() => {
        prevConversationsRef.current = conversations;
    }, [conversations]);

    const fetchInitialData = useCallback(async () => {
        if (!user) return;
        setIsLoadingData(true);
        try {
            const [usersRes, hubsRes, convosRes] = await Promise.all([
                authFetch('/api/users'),
                authFetch('/api/chat/hubs'),
                authFetch(`/api/chat/conversations?userId=${user.id}`),
            ]);
            if (usersRes.ok) setAllUsers(await usersRes.json());
            if (hubsRes.ok) setAllHubs(await hubsRes.json());
            if (convosRes.ok) setConversations(await convosRes.json());
        } catch (e) {
            console.error("Failed to fetch initial data for popup manager", e);
        } finally {
            setIsLoadingData(false);
        }
    }, [user]);

    useEffect(() => {
        if (user && openPopupIds.length > 0) {
            fetchInitialData();
        }
    }, [user, openPopupIds.length, fetchInitialData]);

    const fetchConversationsAndCheckForNew = useCallback(async () => {
        if (!user) return;
        try {
            const res = await authFetch(`/api/chat/conversations?userId=${user.id}`);
            if (res.ok) {
                const newConversations: ChatConversation[] = await res.json();
                
                const prevConvos = prevConversationsRef.current;

                // Limpar IDs fechados se a mensagem mudou (nova mensagem real chegou)
                const closedMap: Record<string, string> = {};
                try {
                    const stored = JSON.parse(localStorage.getItem('chatClosedTimestamps') || '{}');
                    Object.assign(closedMap, stored);
                } catch {}

                newConversations.forEach(newConvo => {
                    const oldConvo = prevConvos.find(c => c.id === newConvo.id);
                    const isNewMessage = !oldConvo || (newConvo.lastMessage && newConvo.lastMessage?.timestamp !== oldConvo.lastMessage?.timestamp);
                    const isUnread = newConvo.readBy && !newConvo.readBy[user.id];

                    // Se o chat foi fechado, mas chegou uma mensagem NOVA (timestamp diferente do fechamento), reabrir
                    if (sessionClosedIds.includes(newConvo.id) && newConvo.lastMessage) {
                        const closedAt = closedMap[newConvo.id];
                        if (closedAt && newConvo.lastMessage.timestamp !== closedAt) {
                            // Nova mensagem desde que fechou — remover da lista de fechados
                            setSessionClosedIds(prev => {
                                const updated = prev.filter(id => id !== newConvo.id);
                                try { localStorage.setItem('chatClosedIds', JSON.stringify(updated)); } catch {}
                                return updated;
                            });
                            delete closedMap[newConvo.id];
                            try { localStorage.setItem('chatClosedTimestamps', JSON.stringify(closedMap)); } catch {}
                        }
                    }

                    if (isNewMessage && isUnread && newConvo.lastMessage?.senderId !== user.id && !sessionClosedIds.includes(newConvo.id)) {
                        const isOnChatPage = pathname.startsWith('/chat');
                        if (!isOnChatPage) {
                           setOpenPopupIds(prev => [...new Set([...prev, newConvo.id])].slice(-4));
                           setFlashingPopups(prev => [...new Set([...prev, newConvo.id])]);
                           setTimeout(() => {
                               setFlashingPopups(prev => prev.filter(id => id !== newConvo.id));
                           }, 4100);
                        }
                    }
                });
                
                setConversations(newConversations);
            }
        } catch (e) {
            console.error("Failed to fetch conversations for popup", e);
        }
    }, [user, pathname, setOpenPopupIds, sessionClosedIds]);

    const fetchMessages = useCallback(async (chatId: string) => {
        if (!user) return;
        try {
            const response = await authFetch(`/api/chat/messages?chatId=${chatId}`);
            if(response.ok) {
                const newMessages: ChatMessage[] = await response.json();
                setMessagesByChat(prev => ({...prev, [chatId]: newMessages}));
            }
        } catch (error) {
            console.error("Failed to fetch messages for popup:", error);
        }
      }, [user]);

    useEffect(() => {
        if (user) {
            const interval = setInterval(fetchConversationsAndCheckForNew, 5000); 
            return () => clearInterval(interval);
        }
    }, [user, fetchConversationsAndCheckForNew]);

    const handleClosePopup = (chatId: string) => {
        setOpenPopupIds(prev => prev.filter(id => id !== chatId));
        setMinimizedPopupIds(prev => prev.filter(id => id !== chatId));
        if (chatId !== 'launcher') {
            setSessionClosedIds(prev => {
                const updated = [...new Set([...prev, chatId])];
                try { localStorage.setItem('chatClosedIds', JSON.stringify(updated)); } catch {}
                return updated;
            });
            // Salvar o timestamp da última mensagem ao fechar, para comparar na próxima abertura
            const convo = conversations.find(c => c.id === chatId);
            if (convo?.lastMessage?.timestamp) {
                try {
                    const stored = JSON.parse(localStorage.getItem('chatClosedTimestamps') || '{}');
                    stored[chatId] = convo.lastMessage.timestamp;
                    localStorage.setItem('chatClosedTimestamps', JSON.stringify(stored));
                } catch {}
            }
        }
    };

    const markConversationAsRead = useCallback((chatId: string) => {
        if (!user) return;
        const convo = conversations.find(c => c.id === chatId);
        if (convo && convo.readBy && !convo.readBy[user.id]) {
            // Optimistic update
            setConversations(prev => prev.map(c => 
                c.id === chatId ? { ...c, readBy: { ...c.readBy, [user.id]: true } } : c
            ));
            // API call
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

    const handleMinimizeToggle = useCallback((chatId: string) => {
        const isCurrentlyMinimized = minimizedPopupIds.includes(chatId);
        if (isCurrentlyMinimized) {
            markConversationAsRead(chatId);
        }
        setMinimizedPopupIds(prev => {
            if (isCurrentlyMinimized) {
                return prev.filter(id => id !== chatId);
            } else {
                return [...prev, chatId];
            }
        });
    }, [minimizedPopupIds, markConversationAsRead]);

    const handleSendMessage = async (chatId: string, message: { text?: string; sharedItem?: SharedItem }) => {
        if ((!message.text || !message.text.trim()) && !message.sharedItem) return;
        if (!user) return;

        setIsSending(chatId);
         try {
            const response = await authFetch('/api/chat/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId: chatId, ...message, senderId: user.id }),
            });
            if (!response.ok) throw new Error("Falha ao enviar a mensagem.");
            await fetchMessages(chatId); 
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro', description: error.message });
        } finally {
            setIsSending(null);
        }
      };
    
    const startOrGetConversation = useCallback(async (entity: User | HubUser): Promise<string | null> => {
        if (!user) return null;
        try {
            let payload: any;
            if ('linkedUserIds' in entity) {
                payload = { participantIds: [...new Set([user.id, ...entity.linkedUserIds])], name: entity.name, avatarUrl: entity.avatarUrl, isGroup: true };
            } else {
                payload = { participantIds: [user.id, entity.id] };
            }

            const response = await authFetch('/api/chat/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const { conversationId } = await response.json();
            
            await fetchInitialData();
            
            return conversationId;
        } catch (error) {
            console.error("Error starting conversation:", error);
            return null;
        }
    }, [user, fetchInitialData]);

    const popupsToRender = useMemo(() => {
        return openPopupIds.map(id => {
            if (id === 'launcher') return { id: 'launcher', isLauncher: true };
            return conversations.find(c => c.id === id);
        }).filter(Boolean) as (ChatConversation & { isLauncher?: boolean })[];
    }, [openPopupIds, conversations]);

    if (!user || popupsToRender.length === 0) return null;

    return (
        <div className="fixed bottom-0 right-0 z-[1000] p-4 flex gap-4 items-end">
            {popupsToRender.map((convoOrLauncher) => {
                const isMinimized = minimizedPopupIds.includes(convoOrLauncher.id);
                return (
                    <div key={convoOrLauncher.id} className={isMinimized ? "w-64" : "w-80 h-[28rem]"}>
                        <ChatPopup
                            conversation={convoOrLauncher}
                            isLauncher={convoOrLauncher.isLauncher}
                            allConversations={conversations}
                            users={allUsers}
                            hubs={allHubs}
                            onClose={handleClosePopup}
                            onSendMessage={handleSendMessage}
                            onStartNewChat={startOrGetConversation}
                            messagesByChat={messagesByChat}
                            fetchMessages={fetchMessages}
                            isSendingMessage={isSending === convoOrLauncher.id}
                            isFlashing={flashingPopups.includes(convoOrLauncher.id)}
                            isMinimized={isMinimized}
                            onMinimize={handleMinimizeToggle}
                        />
                    </div>
                );
            })}
        </div>
    );
}
