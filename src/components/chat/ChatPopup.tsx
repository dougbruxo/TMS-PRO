'use client';

import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, ExternalLink, ArrowLeft, MessageSquarePlus, Minus, ChevronsUp } from 'lucide-react';
import { getInitials, cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import type { ChatConversation, ChatMessage, User, HubUser, SharedItem } from '@/lib/types';
import { SharedItemCard } from './SharedItemCard';
import { NewChatDialog } from './NewChatDialog';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChatInput } from './ChatInput';

interface ChatPopupProps {
  conversation: ChatConversation & { isLauncher?: boolean };
  isLauncher?: boolean;
  allConversations: ChatConversation[];
  users: User[];
  hubs: HubUser[];
  onClose: (chatId: string) => void;
  onSendMessage: (chatId: string, message: { text?: string; sharedItem?: SharedItem }) => Promise<void>;
  onStartNewChat: (entity: User | HubUser) => Promise<string | null>;
  messagesByChat: Record<string, ChatMessage[]>;
  fetchMessages: (chatId: string) => void;
  isSendingMessage: boolean;
  isFlashing?: boolean;
  isMinimized: boolean;
  onMinimize: (chatId: string) => void;
}

const isOnlyEmojis = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return false;
    const emojiRegex = /^(?:\p{Emoji}(?:\p{Emoji_Modifier}|\uFE0F\u20E3?|[\uE0020-\uE007F]|\u200d\p{Emoji})*)+$/u;
    return emojiRegex.test(trimmed);
};

const ConversationView = ({ conversationId, messages, currentUser, onSendMessage, isSending, fetchMessages }: any) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const interval = setInterval(() => fetchMessages(conversationId), 3000);
        return () => clearInterval(interval);
    }, [conversationId, fetchMessages]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = (message: { text?: string; sharedItem?: SharedItem }) => {
        onSendMessage(conversationId, message);
    };

    return (
        <>
            <CardContent className="p-0 flex-grow overflow-hidden">
                <ScrollArea className="h-full">
                    <div className="p-3 space-y-4">
                        {messages.map((msg: ChatMessage) => {
                            const isCurrentUser = msg.senderId === currentUser.id;
                            const isEmojiOnly = !msg.sharedItem && isOnlyEmojis(msg.text);
                            return (
                                <div key={msg.id} className={cn('flex items-end gap-2', isCurrentUser ? 'justify-end' : 'justify-start')}>
                                   <div className={cn(
                                       'max-w-[80%] rounded-lg', 
                                       isEmojiOnly || msg.sharedItem ? 'bg-transparent' : (isCurrentUser ? 'p-2 bg-primary text-primary-foreground' : 'p-2 bg-muted')
                                   )}>
                                        {msg.sharedItem ? <SharedItemCard item={msg.sharedItem} /> : <p className={cn('text-sm break-all', isEmojiOnly && 'text-3xl')}>{msg.text}</p>}
                                        <p className={cn('text-xs mt-1', isCurrentUser && !isEmojiOnly ? 'text-primary-foreground/70' : 'text-muted-foreground/80')}>
                                            {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                   </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>
                </ScrollArea>
            </CardContent>
            <CardFooter className="p-0 border-t">
                <ChatInput onSendMessage={handleSendMessage} isSending={isSending} />
            </CardFooter>
        </>
    );
};

const ListView = ({ conversations, users, hubs, currentUser, onSelect }: any) => {
    return (
        <CardContent className="p-0 flex-grow overflow-hidden">
            <ScrollArea className="h-full">
                {conversations.map((convo: ChatConversation) => {
                    let name, avatarUrl, initials;
                    if (convo.isGroup) {
                        name = convo.name; avatarUrl = convo.avatarUrl; initials = getInitials(name);
                    } else {
                        const otherId = convo.participants.find(id => String(id) !== currentUser.id);
                        const otherUser = otherId ? users.find((u: User) => u.id === String(otherId)) : null;
                        name = otherUser?.username || 'Utilizador Removido'; avatarUrl = otherUser?.avatarUrl || ''; initials = getInitials(name);
                    }
                    const isUnread = convo.readBy && !convo.readBy[currentUser.id];
                    return (
                        <div key={convo.id} onClick={() => onSelect(convo.id)} className={cn('flex items-center gap-3 p-4 cursor-pointer hover:bg-accent', isUnread && 'font-bold')}>
                            <div className="relative"><Avatar className="h-12 w-12"><AvatarImage src={avatarUrl} alt={name} /><AvatarFallback>{initials}</AvatarFallback></Avatar>{isUnread && <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-primary ring-2 ring-background" />}</div>
                            <div className="flex-grow overflow-hidden min-w-0">
                                <div className="flex justify-between items-center"><h3 className="truncate">{name}</h3>{convo.lastMessage && (<p className="text-xs text-muted-foreground whitespace-nowrap">{formatDistanceToNow(new Date(convo.lastMessage.timestamp), { addSuffix: true, locale: ptBR })}</p>)}</div>
                                <p className="text-sm text-muted-foreground truncate">{convo.lastMessage ? (convo.lastMessage.sharedItem ? `[${convo.lastMessage.sharedItem.type}] ${convo.lastMessage.sharedItem.title}` : convo.lastMessage.text) : 'Nenhuma mensagem'}</p>
                            </div>
                        </div>
                    );
                })}
            </ScrollArea>
        </CardContent>
    );
};

export const ChatPopup = memo(({
  conversation,
  isLauncher = false,
  allConversations,
  users,
  hubs,
  onClose,
  onSendMessage,
  onStartNewChat,
  messagesByChat,
  fetchMessages,
  isSendingMessage,
  isFlashing,
  isMinimized,
  onMinimize,
}: ChatPopupProps) => {
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const [view, setView] = useState<'conversation' | 'list'>(isLauncher ? 'list' : 'conversation');
  const [activeChatId, setActiveChatId] = useState<string | null>(isLauncher ? null : conversation.id);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);

  useEffect(() => {
    if (!isLauncher) {
      setView('conversation');
      setActiveChatId(conversation.id);
    }
  }, [conversation.id, isLauncher]);

  const activeConversation = allConversations.find(c => c.id === activeChatId);
  const messages = messagesByChat[activeChatId || ''] || [];
  
  const handleSelectConversation = (chatId: string) => {
    setActiveChatId(chatId);
    setView('conversation');
  }

  const handleStartNewChatAndSelect = async (entity: User | HubUser) => {
    const newChatId = await onStartNewChat(entity);
    if(newChatId) {
        handleSelectConversation(newChatId);
    }
  }

  if (!currentUser) return null;

  let headerProps = { name: 'Conversas', avatarUrl: undefined, initials: 'C' };
  if (view === 'conversation' && activeConversation) {
      if (activeConversation.isGroup) {
          headerProps = { name: activeConversation.name || 'Grupo', avatarUrl: activeConversation.avatarUrl, initials: getInitials(activeConversation.name) };
      } else {
          const otherParticipantId = activeConversation.participants.find(id => String(id) !== currentUser.id);
          const otherUser = otherParticipantId ? users.find(u => u.id === String(otherParticipantId)) : null;
          headerProps = { name: otherUser?.username || 'Utilizador Removido', avatarUrl: otherUser?.avatarUrl, initials: getInitials(otherUser?.username) };
      }
  }
  
    if (isMinimized && !isLauncher) {
        let minimizedHeaderProps;
        if (conversation.isGroup) {
            minimizedHeaderProps = { name: conversation.name, avatarUrl: conversation.avatarUrl, initials: getInitials(conversation.name) };
        } else {
            const otherParticipantId = conversation.participants.find(id => String(id) !== currentUser.id);
            const otherUser = otherParticipantId ? users.find(u => u.id === String(otherParticipantId)) : null;
            minimizedHeaderProps = { name: otherUser?.username || 'Utilizador Removido', avatarUrl: otherUser?.avatarUrl, initials: getInitials(otherUser?.username) };
        }
        const isUnread = !conversation.isLauncher && conversation.readBy && !conversation.readBy[currentUser.id];
        
        return (
             <Card
                onClick={() => onMinimize(conversation.id)}
                className={cn(
                    "w-full h-auto cursor-pointer shadow-2xl animate-in fade-in-0 slide-in-from-bottom-4 duration-300 border-2 chat-popup-inverted",
                    isFlashing ? "animate-flash-border" : "border-primary/20"
                )}
            >
                <CardHeader className="p-2 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2 flex-grow min-w-0 relative">
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={minimizedHeaderProps.avatarUrl} alt={minimizedHeaderProps.name} />
                            <AvatarFallback>{minimizedHeaderProps.initials}</AvatarFallback>
                        </Avatar>
                        {isUnread && (
                            <span className="absolute top-0 left-6 block h-3 w-3 rounded-full bg-primary ring-2 ring-background" />
                        )}
                        <span className="font-semibold text-sm truncate">{minimizedHeaderProps.name}</span>
                    </div>
                    <div className="flex items-center">
                        <Button variant="ghost" size="icon" className="h-7 w-7"><ChevronsUp className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onClose(conversation.id); }}><X className="h-4 w-4" /></Button>
                    </div>
                </CardHeader>
            </Card>
        );
    }

  return (
    <>
      <Card className={cn(
          "w-full h-full flex flex-col shadow-2xl animate-in fade-in-0 slide-in-from-bottom-4 duration-300 border-2 chat-popup-inverted",
          isFlashing ? "animate-flash-border" : "border-primary/20"
      )}>
        <CardHeader className="p-3 flex flex-row items-center justify-between border-b bg-muted/50">
          <div className="flex items-center gap-2 flex-grow min-w-0">
            {view === 'conversation' && <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setView('list')}><ArrowLeft className="h-4 w-4" /></Button>}
            <Avatar className="h-8 w-8"><AvatarImage src={headerProps.avatarUrl} alt={headerProps.name} /><AvatarFallback>{headerProps.initials}</AvatarFallback></Avatar>
            <span className="font-semibold text-sm truncate">{headerProps.name}</span>
          </div>
          <div className="flex items-center">
            {view === 'list' && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsNewChatOpen(true)}><MessageSquarePlus className="h-4 w-4"/></Button>}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onMinimize(conversation.id)}><Minus className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => router.push(`/chat?id=${activeChatId}`)} disabled={!activeChatId}><ExternalLink className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onClose(conversation.id)}><X className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        
        {view === 'conversation' && activeChatId ? (
          <ConversationView 
            conversationId={activeChatId}
            messages={messages}
            currentUser={currentUser}
            onSendMessage={onSendMessage}
            isSending={isSendingMessage}
            fetchMessages={fetchMessages}
          />
        ) : (
          <ListView 
            conversations={allConversations}
            users={users}
            hubs={hubs}
            currentUser={currentUser}
            onSelect={handleSelectConversation}
          />
        )}
      </Card>
      <NewChatDialog 
        isOpen={isNewChatOpen}
        onOpenChange={setIsNewChatOpen}
        users={users}
        hubs={hubs}
        onStartNewChat={handleStartNewChatAndSelect}
        currentUser={currentUser}
      />
    </>
  );
});
ChatPopup.displayName = 'ChatPopup';
