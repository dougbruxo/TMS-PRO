
"use client";

import { useEffect, useRef, useState } from 'react';
import type { ChatMessage, User, ChatConversation } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '../ui/button';
import { Trash2, Loader2, PictureInPicture2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { authFetch } from '@/lib/api-client';
import { ScrollArea } from '../ui/scroll-area';
import { SharedItemCard } from './SharedItemCard';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';

interface ChatMessagesProps {
  messages: ChatMessage[];
  currentUserId: string;
  onClearConversation: () => void;
  isClearing: boolean;
  activeChatId: string;
  activeConversation?: ChatConversation;
  users?: User[];
  onMutateConversations?: () => void;
  fetchMessages?: (chatId: string) => void;
}

const getInitials = (name: string = '') => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

const isOnlyEmojis = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return false;
    const emojiRegex = /^(?:\p{Emoji}(?:\p{Emoji_Modifier}|\uFE0F\u20E3?|[\uE0020-\uE007F]|\u200d\p{Emoji})*)+$/u;
    return emojiRegex.test(trimmed);
};


export function ChatMessages({ 
  messages, 
  currentUserId, 
  onClearConversation, 
  isClearing, 
  activeChatId, 
  activeConversation, 
  users,
  onMutateConversations,
  fetchMessages
}: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { setOpenPopupIds, user: currentUser } = useAuth();
  const router = useRouter();

  // Workflow Dialog States
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isAddOpOpen, setIsAddOpOpen] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const handleOpenInPopup = () => {
    setOpenPopupIds(prev => [...new Set([...prev, activeChatId])].slice(-4));
    router.push('/dashboard');
  };

  const handleWorkflowAction = async (action: string, payload: { operatorId?: string; targetOperatorId?: string } = {}) => {
    // Stale state protection: block action locally if operator is not active in an active support hub
    if (activeConversation?.isGroup && activeConversation?.status === 'active' && isOperatorObj) {
      if (!activeConversation.activeOperatorIds?.includes(currentUserId) && action !== 'interact') {
        if (onMutateConversations) onMutateConversations();
        if (fetchMessages) fetchMessages(activeChatId);
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
        if (onMutateConversations) onMutateConversations();
        if (fetchMessages) fetchMessages(activeChatId);
      } else {
        const err = await response.json();
        if (response.status === 403) {
          // Silently trigger sync and do not alert, just refresh the UI!
          if (onMutateConversations) onMutateConversations();
          if (fetchMessages) fetchMessages(activeChatId);
          return;
        }
        throw new Error(err.message || 'Falha ao processar ação.');
      }
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Erro ao processar ação.');
    }
  };

  const isGroup = activeConversation?.isGroup;
  const status = activeConversation?.status || 'active';
  const isActiveHub = isGroup && status === 'active';
  const isPendingHub = isGroup && status === 'pending';
  const isFinishedHub = isGroup && status === 'finished';
  const isOperatorObj = currentUser?.role === 'admin' || currentUser?.role === 'user';

  const otherOperators = users 
    ? users.filter(u => (u.role === 'admin' || u.role === 'user') && u.id !== currentUserId) 
    : [];
  
  const activeOperators = users && activeConversation?.activeOperatorIds
    ? activeConversation.activeOperatorIds.map(id => users.find(u => u.id === String(id))).filter(Boolean) as User[]
    : [];
  
  const activeOperatorNames = activeOperators.map(o => o.username).join(' e ');

  const addableOperators = otherOperators.filter(op => !activeConversation?.activeOperatorIds?.includes(op.id));
  const transferableOperators = otherOperators;

  let chatHeaderProps = { name: 'Mensagens', avatarUrl: undefined, initials: 'M', subtitle: 'Chat' };
  if (activeConversation) {
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
              
              chatHeaderProps = { 
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
              
              chatHeaderProps = { 
                  name: activeConversation.name || 'Grupo', 
                  avatarUrl: activeConversation.avatarUrl, 
                  initials: getInitials(activeConversation.name),
                  subtitle
              };
          }
      } else {
          const otherParticipantId = activeConversation.participants.find(id => String(id) !== currentUserId);
          const otherUser = otherParticipantId && users ? users.find(u => u.id === String(otherParticipantId)) : null;
          chatHeaderProps = { 
              name: otherUser?.username || 'Utilizador Removido', 
              avatarUrl: otherUser?.avatarUrl, 
              initials: getInitials(otherUser?.username),
              subtitle: 'Conversa Direta'
          };
      }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 chat-messages-page-container">
      <div className="flex-shrink-0 flex items-center justify-between p-2 border-b border-border chat-messages-header">
          <div className="flex items-center gap-3">
              {activeConversation && (
                  <>
                      <Avatar className="h-9 w-9">
                          <AvatarImage src={chatHeaderProps.avatarUrl} alt={chatHeaderProps.name} />
                          <AvatarFallback>{chatHeaderProps.initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col leading-tight">
                          <h3 className="font-bold text-sm text-foreground">{chatHeaderProps.name}</h3>
                          <span className="text-[10px] text-muted-foreground">{chatHeaderProps.subtitle}</span>
                      </div>
                  </>
              )}
              {!activeConversation && <h3 className="font-semibold text-lg">Mensagens</h3>}
          </div>
          <div className="flex items-center gap-2">
              {/* Workflow Actions - only visible to active operators */}
              {isActiveHub && isOperatorObj && activeConversation?.activeOperatorIds?.includes(currentUserId) && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setIsTransferOpen(true)} className="h-8 text-xs">
                    Transferir
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setIsAddOpOpen(true)} className="h-8 text-xs">
                    Atendentes ({activeOperators.length})
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleWorkflowAction('finalize')} 
                    className="h-8 text-xs text-red-500 hover:bg-red-50 hover:text-red-600 border-red-200"
                  >
                    Finalizar
                  </Button>
                </>
              )}
              {isActiveHub && !isOperatorObj && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleWorkflowAction('finalize')} 
                  className="h-8 text-xs text-red-500 hover:bg-red-50 hover:text-red-600 border-red-200"
                >
                  Finalizar Atendimento
                </Button>
              )}

              <Button variant="ghost" size="sm" onClick={handleOpenInPopup}>
                <PictureInPicture2 className="mr-2 h-4 w-4"/>
                Abrir no Pop-up
              </Button>
              
              {/* Only render Clear Conversation option if it is not an active support hub, or if the operator is active */}
              {(!isActiveHub || activeConversation?.activeOperatorIds?.includes(currentUserId)) && (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" disabled={isClearing || messages.length === 0}>
                            {isClearing ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                            ) : (
                                <Trash2 className="mr-2 h-4 w-4"/>
                            )}
                            Limpar Conversa
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Limpar Histórico?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta ação irá apagar permanentemente todas as mensagens desta conversa para todos os participantes. Não pode ser desfeita.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={onClearConversation} className="bg-destructive hover:bg-destructive/90">
                                Apagar
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
              )}
          </div>
      </div>
      <ScrollArea className="flex-grow chat-messages-body">
        <div className="p-4">
          <div className="space-y-6">
            {messages.map((msg) => {
              const isSystem = msg.senderUsername === 'Sistema' || String(msg.senderId) === '000000000000000000000000';
              if (isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center my-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <span className="px-3 py-1.5 rounded-full bg-muted/65 text-muted-foreground text-[11px] font-medium max-w-sm text-center border border-border/40 shadow-sm leading-normal">
                      {msg.text}
                    </span>
                  </div>
                );
              }

              const isCurrentUser = String(msg.senderId) === currentUserId;
              const isEmojiOnly = !msg.sharedItem && isOnlyEmojis(msg.text);

              return (
                <div
                  key={msg.id}
                  className={cn('flex items-end gap-3', isCurrentUser ? 'justify-end' : 'justify-start')}
                >
                  {!isCurrentUser && (
                    <Avatar className="h-8 w-8">
                      {msg.senderAvatarUrl && <AvatarImage src={msg.senderAvatarUrl} alt={msg.senderUsername} />}
                      <AvatarFallback>{getInitials(msg.senderUsername)}</AvatarFallback>
                    </Avatar>
                  )}
                  <div className="flex flex-col max-w-md">
                    {!isCurrentUser && (
                      <span className="text-[10px] text-muted-foreground mb-0.5 ml-1 font-medium block">
                        {msg.senderUsername}
                      </span>
                    )}
                    <div
                      className={cn(
                        'rounded-lg',
                         isEmojiOnly || msg.sharedItem ? 'bg-transparent' : (
                             isCurrentUser ? 'p-3 bg-primary text-primary-foreground chat-bubble-sender' : 'p-3 bg-muted chat-bubble-receiver'
                         )
                      )}
                    >
                      {msg.sharedItem ? (
                        <SharedItemCard item={msg.sharedItem} />
                      ) : (
                        <p className={cn('text-sm break-words', isEmojiOnly && 'text-5xl')}>
                            {msg.text}
                        </p>
                      )}
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
        </div>
      </ScrollArea>

      {/* Pending Triage Banner */}
      {isPendingHub && isOperatorObj && (
        <div className="p-4 border-t bg-muted/40 flex flex-col items-center justify-center gap-2 text-center animate-in fade-in-0 slide-in-from-bottom-4 duration-300 chat-triage-banner">
          <div className="space-y-1">
            <h4 className="font-semibold text-sm text-primary">Atendimento Pendente</h4>
            <p className="text-xs text-muted-foreground max-w-sm">Este cliente está aguardando na fila. Assuma o atendimento para responder e interagir.</p>
          </div>
          <Button size="sm" onClick={() => handleWorkflowAction('interact')} className="bg-primary hover:bg-primary/95 text-xs px-6 py-2 shadow-sm font-semibold">
            Interagir (Assumir Atendimento)
          </Button>
        </div>
      )}

      {/* Taken Triage Banner */}
      {isActiveHub && isOperatorObj && !activeConversation?.activeOperatorIds?.includes(currentUserId) && (
        <div className="p-4 border-t bg-muted/40 flex flex-col items-center justify-center gap-2 text-center animate-in fade-in-0 slide-in-from-bottom-4 duration-300 chat-triage-banner">
          <div className="space-y-1">
            <h4 className="font-semibold text-sm text-amber-600">Atendimento em Andamento</h4>
            <p className="text-xs text-muted-foreground max-w-sm font-medium">
              Este atendimento já foi assumido por {activeOperatorNames || 'outro atendente'}. 
              Você não pode responder ou interagir a menos que seja incluído como atendente ativo.
            </p>
          </div>
        </div>
      )}

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
    </div>
  );
}
