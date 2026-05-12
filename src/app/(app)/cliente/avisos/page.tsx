"use client";

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Megaphone, Plus, Trash2, Pin, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { authFetch } from '@/lib/api-client';

interface Announcement {
    id: string;
    text: string;
    pinned: boolean;
    timestamp: string;
    authorUsername: string;
    parentId?: string;
}

export default function ClienteAvisosPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newText, setNewText] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
        const token = localStorage.getItem('sessionToken');
        const res = await authFetch('/api/announcements', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            setAnnouncements(await res.json());
        }
    } catch (e) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os avisos.' });
    } finally {
        setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (!authLoading && user) {
        fetchAnnouncements();
    }
  }, [authLoading, user, fetchAnnouncements]);

  const handleCreate = async () => {
    if (!newText.trim()) return;
    setIsSubmitting(true);
    try {
        const token = localStorage.getItem('sessionToken');
        const res = await authFetch('/api/announcements', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                text: newText,
                pinned: isPinned,
                authorId: user?.id,
                authorUsername: user?.username
            })
        });

        if (res.ok) {
            toast({ title: 'Sucesso', description: 'Aviso publicado com sucesso.' });
            setNewText('');
            setIsPinned(false);
            setIsCreateOpen(false);
            fetchAnnouncements();
        } else {
            throw new Error('Falha ao criar aviso');
        }
    } catch (e) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao publicar aviso.' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
      if (!confirm('Tem certeza que deseja excluir este aviso?')) return;
      try {
          const token = localStorage.getItem('sessionToken');
          const res = await authFetch(`/api/announcements/${id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
              setAnnouncements(prev => prev.filter(a => a.id !== id));
              toast({ title: 'Removido', description: 'Aviso excluído com sucesso.' });
          }
      } catch (e) {
          toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao excluir aviso.' });
      }
  };

  const canManage = user?.role === 'cliente' || (user?.role === 'sub-cliente' && user?.subRole === 'ADM');

  if (authLoading || !user) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
        <div className="flex justify-between items-start mb-8 flex-wrap gap-4">
            <div>
                <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
                    <Megaphone className="h-8 w-8" />
                    Quadro de Avisos Internos
                </h1>
                <p className="text-muted-foreground mt-2">
                    Comunique-se com seus colaboradores de forma rápida e direta.
                </p>
            </div>
            {canManage && (
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-blue-600 hover:bg-blue-700">
                            <Plus className="mr-2 h-4 w-4" /> Novo Comunicado
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Criar Novo Aviso</DialogTitle>
                            <DialogDescription>Este aviso será visível para todos os colaboradores da sua conta.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Mensagem</Label>
                                <Textarea 
                                    placeholder="Digite o comunicado aqui..." 
                                    rows={5} 
                                    value={newText}
                                    onChange={e => setNewText(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="checkbox" 
                                    id="pin" 
                                    checked={isPinned} 
                                    onChange={e => setIsPinned(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300"
                                />
                                <Label htmlFor="pin" className="cursor-pointer">Fixar no topo (Destaque)</Label>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                            <Button onClick={handleCreate} disabled={isSubmitting || !newText.trim()}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Publicar Agora
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>

        {isLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-muted" /></div>
        ) : announcements.length === 0 ? (
            <Card className="border-dashed border-2 bg-muted/20">
                <CardContent className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <Megaphone className="h-12 w-12 mb-4 opacity-20" />
                    <p>Nenhum aviso publicado no momento.</p>
                </CardContent>
            </Card>
        ) : (
            <div className="grid gap-6">
                {announcements.map((announcement) => (
                    <Card key={announcement.id} className={cn(
                        "transition-all duration-300", 
                        announcement.pinned && "border-blue-500 bg-blue-50/30 dark:bg-blue-900/10 shadow-md ring-1 ring-blue-500/20"
                    )}>
                        <CardHeader className="flex flex-row items-start justify-between pb-2">
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "p-2 rounded-full",
                                    announcement.pinned ? "bg-blue-100 text-blue-600 dark:bg-blue-800/30" : "bg-muted text-muted-foreground"
                                )}>
                                    <Pin className={cn("h-4 w-4", !announcement.pinned && "rotate-45")} />
                                </div>
                                <div>
                                    <CardTitle className="text-sm font-medium">Publicado por {announcement.authorUsername}</CardTitle>
                                    <CardDescription className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {format(parseISO(announcement.timestamp), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                                    </CardDescription>
                                </div>
                            </div>
                            {canManage && (
                                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-500" onClick={() => handleDelete(announcement.id)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent>
                            <p className="text-lg leading-relaxed whitespace-pre-wrap">{announcement.text}</p>
                            {announcement.pinned && (
                                <Badge variant="secondary" className="mt-4 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                    Destaque Importante
                                </Badge>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>
        )}
    </div>
  );
}
