
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, Send } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import type { ChatConversation, SharedItem, User, HubUser } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { getInitials } from '@/lib/utils';
import { Separator } from '../ui/separator';
import { authFetch } from '@/lib/api-client';

interface ShareItemDialogProps {
  item: SharedItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareItemDialog({ item, open, onOpenChange }: ShareItemDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [hubs, setHubs] = useState<HubUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState<string | null>(null); // chatId of sending message
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
        const [convosRes, usersRes, hubsRes] = await Promise.all([
            authFetch(`/api/chat/conversations?userId=${user.id}`),
            authFetch('/api/users'),
            authFetch('/api/chat/hubs'),
        ]);

        if (convosRes.ok) setConversations(await convosRes.json());
        if (usersRes.ok) setUsers(await usersRes.json());
        if (hubsRes.ok) setHubs(await hubsRes.json());

    } catch (e) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar as conversas.' });
    } finally {
        setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, fetchData]);

  const handleSend = async (chatId: string) => {
    if (!item || !user) return;
    setIsSending(chatId);
    try {
        const response = await authFetch('/api/chat/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId, senderId: user.id, sharedItem: item }),
        });
        if (!response.ok) throw new Error('Falha ao partilhar o item.');
        toast({ title: 'Sucesso!', description: 'Item partilhado na conversa.' });
        onOpenChange(false);
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
        setIsSending(null);
    }
  };

  const filteredConversations = conversations.filter(convo => {
    let name;
    if (convo.isGroup) {
      name = convo.name;
    } else {
      const otherParticipantId = convo.participants.find(id => String(id) !== user?.id);
      const otherUser = otherParticipantId ? users.find(u => u.id === String(otherParticipantId)) : null;
      name = otherUser?.username;
    }
    return name?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Partilhar no Chat</DialogTitle>
          <DialogDescription>Selecione uma conversa para partilhar "{item?.title}".</DialogDescription>
        </DialogHeader>
        <div className="relative pt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar conversa..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <ScrollArea className="h-72 mt-2">
            {isLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin"/></div>
            ) : filteredConversations.length > 0 ? (
                <div className="space-y-1 p-1">
                {filteredConversations.map(convo => {
                    let name, avatarUrl, initials;
                    if (convo.isGroup) {
                        const hub = hubs.find(h => h.name === convo.name);
                        name = convo.name;
                        avatarUrl = hub?.avatarUrl;
                        initials = getInitials(name);
                    } else {
                        const otherParticipantId = convo.participants.find(id => String(id) !== user?.id);
                        const otherUser = otherParticipantId ? users.find(u => u.id === String(otherParticipantId)) : null;
                        name = otherUser?.username || 'Utilizador Removido';
                        avatarUrl = otherUser?.avatarUrl;
                        initials = getInitials(name);
                    }
                    return (
                        <div key={convo.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={avatarUrl} alt={name} />
                                    <AvatarFallback>{initials}</AvatarFallback>
                                </Avatar>
                                <span className="font-medium text-sm">{name}</span>
                            </div>
                            <Button size="sm" onClick={() => handleSend(convo.id)} disabled={isSending === convo.id}>
                                {isSending === convo.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>}
                            </Button>
                        </div>
                    );
                })}
                </div>
            ) : (
                <p className="text-center text-sm text-muted-foreground py-8">Nenhuma conversa encontrada.</p>
            )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
