

"use client";

import { useState } from 'react';
import type { User, ChatConversation, HubUser } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageSquarePlus } from 'lucide-react';
import { Button } from '../ui/button';
import { NewChatDialog } from './NewChatDialog';

interface ChatSidebarProps {
  users: User[];
  hubs: HubUser[];
  conversations: ChatConversation[];
  activeChatId: string | null;
  onSelectConversation: (chatId: string) => void;
  onStartNewChat: (entity: User | HubUser) => Promise<string | null>;
  currentUser: User;
}

const getInitials = (name: string = '') => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

export function ChatSidebar({ users, hubs, conversations, activeChatId, onSelectConversation, onStartNewChat, currentUser }: ChatSidebarProps) {
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);

  return (
    <>
      <aside className="w-80 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-xl font-bold">Conversas</h2>
          <Button variant="ghost" size="icon" onClick={() => setIsNewChatOpen(true)}>
            <MessageSquarePlus className="h-5 w-5" />
          </Button>
        </div>
        <ScrollArea className="flex-grow">
          {conversations.map(convo => {
            let name, avatarUrl, initials;
            
            if (convo.isGroup) {
              name = convo.name;
              avatarUrl = convo.avatarUrl;
              initials = getInitials(name);
            } else {
              const otherParticipantId = convo.participants.find(id => String(id) !== currentUser.id);
              const otherUser = otherParticipantId ? users.find(u => u.id === String(otherParticipantId)) : null;
              name = otherUser?.username || 'Utilizador Removido';
              avatarUrl = otherUser?.avatarUrl || '';
              initials = getInitials(name);
            }

            const isUnread = convo.readBy && !convo.readBy[currentUser.id];
            
            return (
              <div
                key={convo.id}
                onClick={() => onSelectConversation(convo.id)}
                className={cn(
                  'flex items-center gap-3 p-4 cursor-pointer hover:bg-accent',
                  activeChatId === convo.id ? 'bg-accent' : 'bg-transparent',
                  isUnread && 'font-bold'
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
                    <h3 className="truncate">{name}</h3>
                    {convo.lastMessage && (
                       <p className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(convo.lastMessage.timestamp), { addSuffix: true, locale: ptBR })}
                       </p>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {convo.lastMessage ? (
                        convo.lastMessage.sharedItem 
                          ? `[${convo.lastMessage.sharedItem.type}] ${convo.lastMessage.sharedItem.title}` 
                          : convo.lastMessage.text
                    ) : 'Nenhuma mensagem ainda'}
                  </p>
                </div>
              </div>
            );
          })}
        </ScrollArea>
      </aside>

      <NewChatDialog 
        isOpen={isNewChatOpen}
        onOpenChange={setIsNewChatOpen}
        users={users}
        hubs={hubs}
        onStartNewChat={onStartNewChat}
        currentUser={currentUser}
      />
    </>
  );
}
