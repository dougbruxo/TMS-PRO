'use client';

import { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { usePathname, useRouter } from 'next/navigation';

// Helper to play a short synthetic futuristic double-tone notification sound via Web Audio API
const playNotificationSound = () => {
    if (typeof window === 'undefined') return;
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        
        // Neon-styled high quality dynamic synthesizer chime
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        gain1.gain.setValueAtTime(0.12, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        
        osc1.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.15);
        
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880.00, ctx.currentTime + 0.08); // A5
        gain2.gain.setValueAtTime(0, ctx.currentTime);
        gain2.gain.setValueAtTime(0.12, ctx.currentTime + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        
        osc2.start(ctx.currentTime + 0.08);
        osc2.stop(ctx.currentTime + 0.35);
    } catch (error) {
        console.error("Error playing notification sound:", error);
    }
};
import { ChatPopup } from './ChatPopup';
import type { ChatConversation, ChatMessage, User, HubUser, SharedItem } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/api-client';
import { useChatStream } from '@/hooks/use-chat-stream';
import { usePopupCountSync } from '@/components/PagePerformanceTracker';

export function ChatPopupManager() {
    const { user, openPopupIds, setOpenPopupIds, refreshNotificationCounts } = useAuth();
    const pathname = usePathname();
    const router = useRouter();
    const { toast } = useToast();

    // Request Chrome notification permissions elegantly upon load
    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission === 'default') {
                Notification.requestPermission();
            }
        }
    }, []);

    // Chrome browser notification trigger
    const triggerChromeNotification = useCallback((title: string, body: string, conversationId: string) => {
        if (typeof window === 'undefined' || !('Notification' in window)) return;
        if (Notification.permission === 'granted') {
            try {
                const notification = new Notification(title, {
                    body: body,
                    icon: '/icon-192.png',
                    tag: conversationId,
                    renotify: true
                } as any);
                notification.onclick = () => {
                    window.focus();
                    if (pathname.startsWith('/chat')) {
                        router.push(`/chat?id=${conversationId}`);
                    } else {
                        setOpenPopupIds(prev => [...new Set([...prev, conversationId])].slice(-4));
                    }
                };
            } catch (error) {
                console.error("Failed to show browser notification:", error);
            }
        }
    }, [pathname, router, setOpenPopupIds]);

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
                authFetch('/api/users?includeClients=true'),
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
                        
                        // Play the notification sound
                        playNotificationSound();
                        
                        // Build Chrome Notification details
                        let senderName = 'Nova Mensagem';
                        if (!newConvo.isGroup) {
                            const otherParticipantId = newConvo.participants.find(id => String(id) !== user.id);
                            const otherUser = otherParticipantId ? allUsers.find(u => u.id === String(otherParticipantId)) : null;
                            if (otherUser) {
                                senderName = otherUser.username;
                            }
                        } else {
                            senderName = newConvo.name || 'Grupo';
                        }
                        
                        const textContent = newConvo.lastMessage?.sharedItem
                            ? `Partilhou um ${newConvo.lastMessage.sharedItem.type}: ${newConvo.lastMessage.sharedItem.title}`
                            : (newConvo.lastMessage?.text || 'Nova mensagem recebida');
                            
                        // Show native Chrome notification if browser is in background or we are not currently focused on the chat page
                        if (document.visibilityState !== 'visible' || !isOnChatPage) {
                            triggerChromeNotification(senderName, textContent, newConvo.id);
                        }

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
    }, [user, pathname, setOpenPopupIds, sessionClosedIds, allUsers, triggerChromeNotification]);

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

    // Track popup count for CSS blur reduction (data-popup-count on <html>)
    const chatPopupCount = useMemo(() => openPopupIds.filter(id => id !== 'launcher').length, [openPopupIds]);
    usePopupCountSync(chatPopupCount);

    // ─── Real-time via SSE (replaces setInterval polling) ───────────────────────
    // We use refs to avoid stale closures in the SSE callback
    const sessionClosedIdsRef = useRef(sessionClosedIds);
    sessionClosedIdsRef.current = sessionClosedIds;
    const allUsersRef = useRef(allUsers);
    allUsersRef.current = allUsers;
    const pathnameRef = useRef(pathname);
    pathnameRef.current = pathname;

    const handleSseConversations = useCallback((updatedConvos: ChatConversation[]) => {
        if (!user) return;
        const prevConvos = prevConversationsRef.current;

        // Read closed timestamps from localStorage
        const closedMap: Record<string, string> = {};
        try {
            const stored = JSON.parse(localStorage.getItem('chatClosedTimestamps') || '{}');
            Object.assign(closedMap, stored);
        } catch {}

        updatedConvos.forEach(newConvo => {
            const oldConvo = prevConvos.find(c => c.id === newConvo.id);
            const isNewMessage = !oldConvo || (newConvo.lastMessage && newConvo.lastMessage?.timestamp !== oldConvo.lastMessage?.timestamp);
            const isUnread = newConvo.readBy && !newConvo.readBy[user.id];

            // If chat was closed but a new message arrived, re-open
            if (sessionClosedIdsRef.current.includes(newConvo.id) && newConvo.lastMessage) {
                const closedAt = closedMap[newConvo.id];
                if (closedAt && newConvo.lastMessage.timestamp !== closedAt) {
                    setSessionClosedIds(prev => {
                        const updated = prev.filter(id => id !== newConvo.id);
                        try { localStorage.setItem('chatClosedIds', JSON.stringify(updated)); } catch {}
                        return updated;
                    });
                    delete closedMap[newConvo.id];
                    try { localStorage.setItem('chatClosedTimestamps', JSON.stringify(closedMap)); } catch {}
                }
            }

            if (isNewMessage && isUnread && newConvo.lastMessage?.senderId !== user.id && !sessionClosedIdsRef.current.includes(newConvo.id)) {
                const isOnChatPage = pathnameRef.current.startsWith('/chat');

                playNotificationSound();

                // Build Chrome Notification details
                let senderName = 'Nova Mensagem';
                if (!newConvo.isGroup) {
                    const otherParticipantId = newConvo.participants.find(id => String(id) !== user.id);
                    const otherUser = otherParticipantId ? allUsersRef.current.find(u => u.id === String(otherParticipantId)) : null;
                    if (otherUser) senderName = otherUser.username;
                } else {
                    senderName = newConvo.name || 'Grupo';
                }

                const textContent = newConvo.lastMessage?.sharedItem
                    ? `Partilhou um ${newConvo.lastMessage.sharedItem.type}: ${newConvo.lastMessage.sharedItem.title}`
                    : (newConvo.lastMessage?.text || 'Nova mensagem recebida');

                if (document.visibilityState !== 'visible' || !isOnChatPage) {
                    triggerChromeNotification(senderName, textContent, newConvo.id);
                }

                if (!isOnChatPage) {
                    setOpenPopupIds(prev => [...new Set([...prev, newConvo.id])].slice(-4));
                    setFlashingPopups(prev => [...new Set([...prev, newConvo.id])]);
                    setTimeout(() => {
                        setFlashingPopups(prev => prev.filter(id => id !== newConvo.id));
                    }, 4100);
                }
            }
        });

        // Merge updated conversations into state
        setConversations(prev => {
            const idMap = new Map(updatedConvos.map(c => [c.id, c]));
            const merged = prev.map(c => idMap.has(c.id) ? { ...c, ...idMap.get(c.id) } : c);
            updatedConvos.forEach(c => {
                if (!merged.some(m => m.id === c.id)) merged.unshift(c);
            });
            return merged;
        });

        refreshNotificationCounts();
    }, [user, setOpenPopupIds, refreshNotificationCounts, triggerChromeNotification]);

    useChatStream({
        userId: user?.id,
        enabled: !!user,
        onConversations: handleSseConversations,
    });

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
