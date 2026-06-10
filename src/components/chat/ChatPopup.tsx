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
import { useChatStream } from '@/hooks/use-chat-stream';
import { authFetch } from '@/lib/api-client';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

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

const ConversationView = ({ conversationId, messages: propMessages, currentUser, onSendMessage, isSending, fetchMessages, users, activeConversation, handleWorkflowAction }: any) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [localMessages, setLocalMessages] = useState<ChatMessage[]>(propMessages || []);

    const isGroup = activeConversation?.isGroup;
    const status = activeConversation?.status || 'active';
    const isPendingHub = isGroup && status === 'pending';
    const isOperatorObj = currentUser?.role === 'admin' || currentUser?.role === 'user';

    // When conversation changes: clear local state and trigger fresh parent fetch
    useEffect(() => {
        setLocalMessages([]);
        fetchMessages(conversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conversationId]);

    // Sync from parent prop whenever it updates (initial load or after send)
    useEffect(() => {
        if (propMessages && propMessages.length > 0) {
            setLocalMessages(propMessages);
        }
    }, [propMessages]);

    // ─── Real-time new messages via SSE (replaces 3 s setInterval) ───
    useChatStream({
        userId: currentUser?.id,
        chatId: conversationId,
        onMessages: (newMsgs: ChatMessage[]) => {
            setLocalMessages(prev => {
                const existingIds = new Set(prev.map(m => m.id));
                const fresh = newMsgs.filter(m => !existingIds.has(m.id));
                return fresh.length > 0 ? [...prev, ...fresh] : prev;
            });
        },
    });

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [localMessages]);

    const handleSendMessage = (message: { text?: string; sharedItem?: SharedItem }) => {
        onSendMessage(conversationId, message);
    };

    const activeOperatorIds = activeConversation?.activeOperatorIds || [];
    const isDisabled = isGroup && isOperatorObj && (
        status === 'pending' || 
        status === 'finished' || 
        (status === 'active' && !activeOperatorIds.includes(currentUser?.id))
    );

    return (
        <>
            <CardContent className="p-0 flex-grow overflow-hidden chat-messages-container">
                <ScrollArea className="h-full">
                    <div className="p-3 space-y-4">
                        {localMessages.map((msg: ChatMessage) => {
                            const isSystem = msg.senderUsername === 'Sistema' || String(msg.senderId) === '000000000000000000000000';
                            if (isSystem) {
                                return (
                                    <div key={msg.id} className="flex justify-center my-3 animate-in fade-in duration-300">
                                        <span className="px-2.5 py-1 rounded-full bg-muted/75 text-muted-foreground text-[10px] font-medium max-w-[90%] text-center border border-border/40 shadow-sm leading-normal">
                                            {msg.text}
                                        </span>
                                    </div>
                                );
                            }

                            const isCurrentUser = msg.senderId === currentUser.id;
                            const isEmojiOnly = !msg.sharedItem && isOnlyEmojis(msg.text);
                            return (
                                <div key={msg.id} className={cn('flex items-end gap-2', isCurrentUser ? 'justify-end' : 'justify-start')}>
                                   {!isCurrentUser && (
                                       <Avatar className="h-6 w-6">
                                           {msg.senderAvatarUrl && <AvatarImage src={msg.senderAvatarUrl} alt={msg.senderUsername} />}
                                           <AvatarFallback className="text-[9px]">{getInitials(msg.senderUsername)}</AvatarFallback>
                                       </Avatar>
                                   )}
                                   <div className="flex flex-col max-w-[80%]">
                                       {!isCurrentUser && (
                                           <span className="text-[9px] text-muted-foreground mb-0.5 ml-1 font-medium block">
                                               {msg.senderUsername}
                                           </span>
                                       )}
                                       <div className={cn(
                                           'rounded-lg', 
                                           isEmojiOnly || msg.sharedItem ? 'bg-transparent' : (isCurrentUser ? 'p-2 bg-primary text-primary-foreground chat-bubble-sender' : 'p-2 bg-muted chat-bubble-receiver')
                                       )}>
                                            {msg.sharedItem ? <SharedItemCard item={msg.sharedItem} /> : <p className={cn('text-sm break-words', isEmojiOnly && 'text-3xl')}>{msg.text}</p>}
                                            <p className={cn('text-xs mt-1', isCurrentUser && !isEmojiOnly ? 'text-primary-foreground/70' : 'text-muted-foreground/80')}>
                                                {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                       </div>
                                   </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>
                </ScrollArea>
                {/* Pending Triage Banner in Popup */}
                {isPendingHub && isOperatorObj && (
                  <div className="p-3 bg-muted/40 border-t flex flex-col items-center justify-center gap-1.5 text-center animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                    <div className="space-y-0.5">
                      <h5 className="font-semibold text-[11px] text-primary leading-tight">Atendimento Pendente</h5>
                      <p className="text-[9px] text-muted-foreground max-w-xs leading-tight">Assuma o atendimento para responder.</p>
                    </div>
                    <Button size="xs" onClick={() => handleWorkflowAction('interact')} className="bg-primary hover:bg-primary/95 text-[10px] h-7 px-4 shadow-sm font-semibold">
                      Interagir (Assumir)
                    </Button>
                  </div>
                )}
                {/* Taken Triage Banner in Popup */}
                {isGroup && isOperatorObj && status === 'active' && !activeOperatorIds.includes(currentUser?.id) && (
                  <div className="p-3 bg-muted/40 border-t flex flex-col items-center justify-center gap-1 text-center animate-in fade-in-0 slide-in-from-bottom-2 duration-300 animate-pulse">
                    <h5 className="font-semibold text-[11px] text-amber-600 leading-tight">Atendimento em Andamento</h5>
                    <p className="text-[9px] text-muted-foreground max-w-xs leading-tight">
                      Este atendimento já foi assumido por outro atendente.
                    </p>
                  </div>
                )}
            </CardContent>
            <CardFooter className="p-0 border-t">
                <ChatInput 
                    onSendMessage={handleSendMessage} 
                    isSending={isSending} 
                    disabled={isDisabled}
                />
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
                    const isOperator = currentUser.role === 'admin' || currentUser.role === 'user';
                    
                    if (convo.isGroup) {
                        const clientParticipant = isOperator 
                            ? convo.participants.map((id: any) => users.find((u: User) => u.id === String(id))).find((u: any) => u && (u.role === 'cliente' || u.role === 'sub-cliente'))
                            : null;
                        
                        if (isOperator && clientParticipant) {
                            name = `${convo.name} - ${clientParticipant.username}`;
                            avatarUrl = clientParticipant.avatarUrl || '';
                            initials = getInitials(clientParticipant.username);
                        } else {
                            name = convo.name; avatarUrl = convo.avatarUrl; initials = getInitials(name);
                        }
                    } else {
                        const otherId = convo.participants.find(id => String(id) !== currentUser.id);
                        const otherUser = otherId ? users.find((u: User) => u.id === String(otherId)) : null;
                        name = otherUser?.username || 'Utilizador Removido'; avatarUrl = otherUser?.avatarUrl || ''; initials = getInitials(name);
                    }
                    const isUnread = convo.readBy && !convo.readBy[currentUser.id];
                    const isPending = isOperator && convo.status === 'pending';
                    
                    return (
                        <div 
                            key={convo.id} 
                            onClick={() => onSelect(convo.id)} 
                            className={cn(
                                'flex items-center gap-3 p-4 cursor-pointer hover:bg-accent border-l-2', 
                                isUnread && 'font-bold',
                                isPending ? 'border-l-amber-500 bg-amber-500/5' : 'border-l-transparent'
                            )}
                        >
                            <div className="relative">
                                <Avatar className="h-12 w-12">
                                    <AvatarImage src={avatarUrl} alt={name} />
                                    <AvatarFallback>{initials}</AvatarFallback>
                                </Avatar>
                                {isUnread && <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-primary ring-2 ring-background" />}
                            </div>
                            <div className="flex-grow overflow-hidden min-w-0">
                                <div className="flex justify-between items-center">
                                    <h3 className="truncate flex items-center gap-2 font-semibold">
                                        <span className="truncate">{name}</span>
                                        {isPending && (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 animate-pulse shrink-0">
                                                Pendente
                                            </span>
                                        )}
                                    </h3>
                                    {convo.lastMessage && (
                                        <p className="text-xs text-muted-foreground whitespace-nowrap">
                                            {formatDistanceToNow(new Date(convo.lastMessage.timestamp), { addSuffix: true, locale: ptBR })}
                                        </p>
                                    )}
                                </div>
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

  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isAddOpOpen, setIsAddOpOpen] = useState(false);

  const handleWorkflowAction = async (action: string, payload: { operatorId?: string; targetOperatorId?: string } = {}) => {
    if (!activeChatId) return;
    
    // Stale state protection: block action locally if operator is not active in an active support hub
    if (activeConversation?.isGroup && activeConversation?.status === 'active' && isOperatorObj) {
      if (!activeConversation.activeOperatorIds?.includes(currentUser.id) && action !== 'interact') {
        fetchMessages(activeChatId);
        return;
      }
    }

    try {
      const response = await authFetch(`/api/chat/conversations/${activeChatId}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload })
      });
      if (response.ok) {
        fetchMessages(activeChatId);
      } else {
        const err = await response.json();
        if (response.status === 403) {
          // Silently trigger sync and do not alert, just refresh the UI!
          fetchMessages(activeChatId);
          return;
        }
        throw new Error(err.message || 'Falha ao processar ação.');
      }
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Erro ao processar ação.');
    }
  };

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

  const handleStartNewChatAndSelect = async (entity: User | HubUser): Promise<string | null> => {
    const newChatId = await onStartNewChat(entity);
    if(newChatId) {
        handleSelectConversation(newChatId);
    }
    return newChatId;
  }

  if (!currentUser) return null;

  const isGroup = activeConversation?.isGroup;
  const status = activeConversation?.status || 'active';
  const isActiveHub = isGroup && status === 'active';
  const isPendingHub = isGroup && status === 'pending';
  const isFinishedHub = isGroup && status === 'finished';
  const isOperatorObj = currentUser.role === 'admin' || currentUser.role === 'user';

  const visibleConversations = allConversations.filter(convo => {
    if (convo.isGroup && isOperatorObj) {
      if (convo.status === 'active' && !convo.activeOperatorIds?.includes(currentUser.id)) {
        return false;
      }
      if (convo.status === 'finished') {
        return false;
      }
    }
    return true;
  });

  const otherOperators = users 
    ? users.filter(u => (u.role === 'admin' || u.role === 'user') && u.id !== currentUser.id) 
    : [];

  const activeOperators = users && activeConversation?.activeOperatorIds
    ? activeConversation.activeOperatorIds.map(id => users.find(u => u.id === String(id))).filter(Boolean) as User[]
    : [];

  const activeOperatorNames = activeOperators.map(o => o.username).join(' e ');

  const addableOperators = otherOperators.filter(op => !activeConversation?.activeOperatorIds?.includes(op.id));
  const transferableOperators = otherOperators;

  let headerProps: { name: string; avatarUrl: string | undefined; initials: string; subtitle?: string } = { name: 'Conversas', avatarUrl: undefined, initials: 'C', subtitle: 'Chat' };
  if (view === 'conversation' && activeConversation) {
      if (activeConversation.isGroup) {
          const clientParticipant = users
              ? activeConversation.participants.map(id => users.find(u => u.id === String(id))).find(u => u && (u.role === 'cliente' || u.role === 'sub-cliente'))
              : null;
          
          if (isOperatorObj) {
              let subtitle = 'Hub de Atendimento';
              if (isPendingHub) {
                  subtitle = 'Aguardando Atendente (Pendente)';
              } else if (isFinishedHub) {
                  subtitle = 'Atendimento Encerrado';
              } else if (activeOperatorNames) {
                  subtitle = `Atendimento com: ${activeOperatorNames}`;
              }
              
              headerProps = { 
                  name: clientParticipant ? `${activeConversation.name} - ${clientParticipant.username}` : (activeConversation.name || 'SAC'), 
                  avatarUrl: clientParticipant?.avatarUrl || activeConversation.avatarUrl, 
                  initials: getInitials(clientParticipant?.username || activeConversation.name),
                  subtitle
              };
          } else {
              let subtitle = 'Hub de Atendimento';
              if (isPendingHub) {
                  subtitle = 'Aguardando atendente... (Fila)';
              } else if (isFinishedHub) {
                  subtitle = 'Atendimento Finalizado';
              } else if (activeOperatorNames) {
                  subtitle = `Falando com: ${activeOperatorNames}`;
              }
              
              headerProps = { 
                  name: activeConversation.name || 'Grupo', 
                  avatarUrl: activeConversation.avatarUrl, 
                  initials: getInitials(activeConversation.name),
                  subtitle
              };
          }
      } else {
          const otherParticipantId = activeConversation.participants.find(id => String(id) !== currentUser.id);
          const otherUser = otherParticipantId ? users.find(u => u.id === String(otherParticipantId)) : null;
          headerProps = { 
              name: otherUser?.username || 'Utilizador Removido', 
              avatarUrl: otherUser?.avatarUrl, 
              initials: getInitials(otherUser?.username),
              subtitle: 'Conversa Direta'
          };
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
                    "w-full h-auto cursor-pointer shadow-2xl animate-in fade-in-0 slide-in-from-bottom-4 duration-300 overflow-hidden chat-popup-inverted border",
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
          "w-full h-full flex flex-col shadow-2xl animate-in fade-in-0 slide-in-from-bottom-4 duration-300 overflow-hidden chat-popup-inverted border",
          isFlashing ? "animate-flash-border" : "border-primary/20"
      )}>
        <CardHeader className="p-3 flex flex-row items-center justify-between border-b bg-muted/50">
          <div className="flex items-center gap-2 flex-grow min-w-0">
            {view === 'conversation' && <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setView('list')}><ArrowLeft className="h-4 w-4" /></Button>}
            <Avatar className="h-8 w-8"><AvatarImage src={headerProps.avatarUrl} alt={headerProps.name} /><AvatarFallback>{headerProps.initials}</AvatarFallback></Avatar>
            <div className="flex flex-col min-w-0 leading-tight">
              <span className="font-semibold text-sm truncate block">{headerProps.name}</span>
              {headerProps.subtitle && <span className="text-[9px] text-muted-foreground truncate block">{headerProps.subtitle}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Workflow Actions - only visible to active operators */}
            {view === 'conversation' && isActiveHub && isOperatorObj && activeConversation?.activeOperatorIds?.includes(currentUser.id) && (
              <>
                <Button variant="outline" className="h-7 px-1.5 text-[9px]" onClick={() => setIsTransferOpen(true)}>
                  Transf
                </Button>
                <Button variant="outline" className="h-7 px-1.5 text-[9px]" onClick={() => setIsAddOpOpen(true)}>
                  Ats ({activeOperators.length})
                </Button>
                <Button 
                  variant="outline" 
                  className="h-7 px-1.5 text-[9px] text-red-500 border-red-200 hover:bg-red-50"
                  onClick={() => handleWorkflowAction('finalize')}
                >
                  Fin
                </Button>
              </>
            )}
            {view === 'conversation' && isActiveHub && !isOperatorObj && (
              <Button 
                variant="outline" 
                className="h-7 px-1.5 text-[9px] text-red-500 border-red-200 hover:bg-red-50"
                onClick={() => handleWorkflowAction('finalize')}
              >
                Finalizar
              </Button>
            )}

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
            users={users}
            activeConversation={activeConversation}
            handleWorkflowAction={handleWorkflowAction}
          />
        ) : (
          <ListView 
            conversations={visibleConversations}
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

      {/* Transfer Dialog */}
      <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transferir Atendimento</DialogTitle>
            <DialogDescription>Selecione um atendente do hub para transferir esta conversa.</DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-60 overflow-y-auto space-y-2">
            {transferableOperators.length > 0 ? (
              transferableOperators.map(op => (
                <div 
                  key={op.id} 
                  onClick={() => {
                    handleWorkflowAction('transfer', { targetOperatorId: op.id });
                    setIsTransferOpen(false);
                  }}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent cursor-pointer border border-transparent hover:border-border transition-all"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={op.avatarUrl} alt={op.username} />
                    <AvatarFallback>{getInitials(op.username)}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">{op.username}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">{op.role}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-xs text-muted-foreground py-4">Nenhum outro atendente disponível.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Operators Dialog */}
      <Dialog open={isAddOpOpen} onOpenChange={setIsAddOpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gerenciar Atendentes</DialogTitle>
            <DialogDescription>Adicione ou remova atendentes desta conversa em tempo real.</DialogDescription>
          </DialogHeader>
          
          {/* Active Operators */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">Ativos na conversa</h4>
            {activeOperators.length > 0 ? (
              activeOperators.map(op => (
                <div key={op.id} className="flex items-center justify-between p-2 rounded-lg bg-accent/40 border border-border/40">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={op.avatarUrl} alt={op.username} />
                      <AvatarFallback>{getInitials(op.username)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-xs">{op.username}</span>
                  </div>
                  <Button 
                    size="xs" 
                    variant="ghost" 
                    onClick={() => handleWorkflowAction('remove-operator', { operatorId: op.id })}
                    className="text-red-500 hover:text-red-600 text-[10px] font-semibold h-7 px-2"
                  >
                    Remover
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-[11px] text-muted-foreground py-1">Nenhum atendente ativo.</p>
            )}
          </div>
          
          <Separator className="my-2" />
          
          {/* Addable Operators */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Disponíveis para adicionar</h4>
            <div className="max-h-40 overflow-y-auto space-y-2">
              {addableOperators.length > 0 ? (
                addableOperators.map(op => (
                  <div 
                    key={op.id} 
                    onClick={() => handleWorkflowAction('add-operator', { operatorId: op.id })}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-accent cursor-pointer transition-all border border-transparent hover:border-border"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={op.avatarUrl} alt={op.username} />
                        <AvatarFallback>{getInitials(op.username)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-xs">{op.username}</span>
                    </div>
                    <span className="text-[9px] text-primary font-semibold uppercase px-2 py-0.5 bg-primary/10 rounded-full">Adicionar</span>
                  </div>
                ))
              ) : (
                <p className="text-[11px] text-muted-foreground py-2 text-center">Todos os atendentes do hub já estão ativos.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});
ChatPopup.displayName = 'ChatPopup';
