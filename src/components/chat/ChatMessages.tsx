
"use client";

import { useEffect, useRef } from 'react';
import type { ChatMessage } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
}

const getInitials = (name: string = '') => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

const isOnlyEmojis = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return false;
    // Regex to check if the string consists only of one or more emojis
    // This handles single emojis, emojis with modifiers, and sequences of emojis.
    const emojiRegex = /^(?:\p{Emoji}(?:\p{Emoji_Modifier}|\uFE0F\u20E3?|[\uE0020-\uE007F]|\u200d\p{Emoji})*)+$/u;
    return emojiRegex.test(trimmed);
};


export function ChatMessages({ messages, currentUserId, onClearConversation, isClearing, activeChatId }: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { setOpenPopupIds } = useAuth();
  const router = useRouter();

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

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-shrink-0 flex items-center justify-between p-2 border-b border-border">
          <h3 className="font-semibold text-lg">Mensagens</h3>
          <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleOpenInPopup}>
                <PictureInPicture2 className="mr-2 h-4 w-4"/>
                Abrir no Pop-up
              </Button>
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
          </div>
      </div>
      <ScrollArea className="flex-grow">
        <div className="p-4">
          <div className="space-y-6">
            {messages.map((msg) => {
              const isCurrentUser = msg.senderId === currentUserId;
              const isEmojiOnly = !msg.sharedItem && isOnlyEmojis(msg.text);

              return (
                <div
                  key={msg.id}
                  className={cn('flex items-end gap-3', isCurrentUser ? 'justify-end' : 'justify-start')}
                >
                  {!isCurrentUser && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{getInitials(msg.senderUsername)}</AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={cn(
                      'max-w-md rounded-lg',
                       isEmojiOnly || msg.sharedItem ? 'bg-transparent' : (
                           isCurrentUser ? 'p-3 bg-primary text-primary-foreground' : 'p-3 bg-muted'
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
              );
            })}
             <div ref={messagesEndRef} />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
