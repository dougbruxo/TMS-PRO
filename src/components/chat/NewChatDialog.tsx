"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '../ui/separator';
import { getInitials } from '@/lib/utils';
import type { User, HubUser } from '@/lib/types';
import { authFetch } from '@/lib/api-client';

interface NewChatDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  users: User[];
  hubs: HubUser[];
  onStartNewChat: (entity: User | HubUser) => Promise<string | null>;
  currentUser: User;
}

export function NewChatDialog({ isOpen, onOpenChange, users, hubs, onStartNewChat, currentUser }: NewChatDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleSearch = useCallback(async (term: string) => {
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const token = localStorage.getItem('sessionToken');
      const response = await authFetch(`/api/users/search?term=${encodeURIComponent(term)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setSearchResults(await response.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setSearchResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    if (searchTerm.length >= 2) {
      debounceTimeout.current = setTimeout(() => handleSearch(searchTerm), 300);
    } else {
      setSearchResults([]);
    }
    return () => { if (debounceTimeout.current) clearTimeout(debounceTimeout.current); };
  }, [searchTerm, handleSearch]);

  const handleSelect = (entity: User | HubUser) => {
    onStartNewChat(entity);
    onOpenChange(false);
  };

  const filteredHubs = hubs.filter(hub => hub.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Iniciar Nova Conversa</DialogTitle>
          <DialogDescription>
            {currentUser.role === 'admin' || currentUser.role === 'user'
              ? "Pesquise por um cliente ou utilizador para iniciar um chat direto."
              : "Selecione um hub de atendimento ou pesquise por um utilizador."}
          </DialogDescription>
        </DialogHeader>
        <div className="relative pt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={currentUser.role === 'admin' || currentUser.role === 'user' ? "Buscar utilizador..." : "Buscar hub ou utilizador..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <ScrollArea className="max-h-80 mt-2">
          <div className="space-y-2 py-4">
            {!(currentUser.role === 'admin' || currentUser.role === 'user') && (searchTerm.length === 0 || filteredHubs.length > 0) && (
              <>
                <h4 className="px-2 text-xs font-semibold text-muted-foreground">HUBS DE ATENDIMENTO</h4>
                {filteredHubs.map(hub => (
                  <div key={hub.id} onClick={() => handleSelect(hub)} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent cursor-pointer">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={hub.avatarUrl} alt={hub.name} />
                      <AvatarFallback>{getInitials(hub.name)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{hub.name}</span>
                  </div>
                ))}
                <Separator className="my-2" />
              </>
            )}
            <h4 className="px-2 text-xs font-semibold text-muted-foreground">UTILIZADORES</h4>
            {isSearching ? (
              <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin"/></div>
            ) : searchTerm.length >= 2 ? (
              searchResults.length > 0 ? searchResults
                .filter(u => u.id !== currentUser.id)
                .map(user => (
                  <div key={user.id} onClick={() => handleSelect(user)} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent cursor-pointer">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatarUrl} alt={user.username} />
                      <AvatarFallback>{getInitials(user.username)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{user.username}</span>
                  </div>
                )) : <p className="text-center text-sm text-muted-foreground py-4">Nenhum utilizador encontrado.</p>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-4">Digite 2 ou mais caracteres para buscar.</p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
