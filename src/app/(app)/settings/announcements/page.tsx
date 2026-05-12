
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Loader2, Megaphone, Trash2, Pin, PinOff, PlusCircle, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
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
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ChatAnnouncement } from '@/lib/types';
import { authFetch } from '@/lib/api-client';

export default function ManageAnnouncementsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [announcements, setAnnouncements] = useState<ChatAnnouncement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newAnnouncementText, setNewAnnouncementText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [editingDurationId, setEditingDurationId] = useState<string | null>(null);

  const fetchAnnouncements = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await authFetch('/api/announcements');
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data);
        const initialDurations: Record<string, number> = {};
        data.forEach((ann: ChatAnnouncement) => {
          initialDurations[ann.id] = ann.duration || 7;
        });
        setDurations(initialDurations);
      } else {
        throw new Error('Falha ao buscar avisos.');
      }
    } catch(e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
    if (authLoading) return;
    if (!user || !user.settingsAccess) {
      router.push('/dashboard');
    } else {
      fetchAnnouncements();
    }
  }, [user, authLoading, router, fetchAnnouncements]);

  const apiAction = async (endpoint: string, method: 'POST' | 'PUT' | 'DELETE', body?: any) => {
    setIsSubmitting(true);
    try {
      const response = await authFetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(await response.text());
      await fetchAnnouncements();
      return true;
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro na Operação', description: e.message });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddAnnouncement = async () => {
    if (newAnnouncementText.trim() === '') {
      toast({ variant: 'destructive', title: 'Erro', description: 'O texto do aviso não pode estar vazio.' });
      return;
    }
    const success = await apiAction('/api/announcements', 'POST', {
      text: newAnnouncementText,
      pinned: false,
      duration: 7,
      authorId: user!.id,
      authorUsername: user!.username,
    });
    if (success) {
      toast({ title: 'Sucesso!', description: 'Novo aviso criado.' });
      setNewAnnouncementText('');
    }
  };
  
  const handleDeleteAnnouncement = async (id: string) => {
    const success = await apiAction(`/api/announcements/${id}`, 'DELETE');
    if (success) toast({ title: 'Sucesso!', description: 'Aviso removido.' });
  };
  
  const handlePinAnnouncement = async (announcement: any) => {
    const success = await apiAction(`/api/announcements/${announcement.id}`, 'PUT', { pinned: !announcement.pinned });
    if(success) toast({ title: 'Sucesso!', description: 'Status de fixação do aviso atualizado.' });
  };

  const handleUpdateDuration = async (id: string) => {
    setEditingDurationId(id);
    const durationValue = durations[id];
    if (typeof durationValue !== 'number' || durationValue <= 0) {
      toast({ variant: 'destructive', title: 'Erro', description: 'A duração deve ser um número positivo.'});
      setIsSubmitting(false);
      setEditingDurationId(null);
      return;
    }

    const success = await apiAction(`/api/announcements/${id}`, 'PUT', { duration: durationValue });
    if(success) toast({ title: 'Sucesso!', description: 'Duração do aviso atualizada.' });
    setEditingDurationId(null);
  };

  if (authLoading || isLoading || !user) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  const isSaveDisabled = (announcementId: string) => {
      const currentAnnouncement = announcements.find(a => a.id === announcementId);
      const currentDuration = currentAnnouncement?.duration || 7;
      const newDuration = durations[announcementId];
      return isSubmitting || currentDuration === newDuration;
  }

  return (
      <main className="container mx-auto p-4 md:p-8">
        <Button variant="outline" onClick={() => router.push('/settings')} className="mb-8">
          &larr; Voltar para Configurações
        </Button>
        <h1 className="text-3xl font-bold text-primary mb-2">Gerenciar Avisos do Chat</h1>
        <p className="text-muted-foreground mb-8">Crie, fixe e remova avisos para todos os usuários.</p>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
             <Card>
                <CardHeader>
                    <CardTitle>Criar Novo Aviso</CardTitle>
                </CardHeader>
                <CardContent>
                     <Textarea
                        placeholder="Digite seu aviso aqui..."
                        value={newAnnouncementText}
                        onChange={(e) => setNewAnnouncementText(e.target.value)}
                        rows={5}
                        disabled={isSubmitting}
                    />
                </CardContent>
                <CardFooter>
                    <Button onClick={handleAddAnnouncement} disabled={isSubmitting || !newAnnouncementText.trim()} className="w-full">
                        {isSubmitting && !editingDurationId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                        Adicionar Aviso
                    </Button>
                </CardFooter>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Avisos Atuais</CardTitle>
                <CardDescription>
                  O aviso fixado aparecerá em destaque. Ajuste a duração dos avisos não fixados.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {announcements.length > 0 ? (
                    announcements.map((ann) => (
                      <div key={ann.id} className="border p-4 rounded-lg flex justify-between items-start gap-4">
                        <div className="flex-grow space-y-2">
                          <p className="text-sm">{ann.text}</p>
                           {!ann.pinned && (
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  className="w-24 h-8"
                                  value={durations[ann.id] || ''}
                                  onChange={(e) => setDurations(prev => ({...prev, [ann.id]: parseInt(e.target.value, 10) || 0}))}
                                  disabled={isSubmitting}
                                  min="1"
                                />
                                <span className="text-xs text-muted-foreground">segundos</span>
                                <Button size="sm" variant="outline" className="h-8" onClick={() => handleUpdateDuration(ann.id)} disabled={isSaveDisabled(ann.id)}>
                                  {isSubmitting && editingDurationId === ann.id ? <Loader2 className="h-3 w-3 animate-spin" /> :<Save className="h-3 w-3" />}
                                </Button>
                              </div>
                            )}
                          <p className="text-xs text-muted-foreground mt-2">
                            Criado por {ann.authorUsername} {formatDistanceToNow(new Date(ann.timestamp), { addSuffix: true, locale: ptBR })}
                          </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                          <Button 
                            variant={ann.pinned ? 'default' : 'outline'} 
                            size="sm"
                            onClick={() => handlePinAnnouncement(ann)}
                            disabled={isSubmitting}
                           >
                            {ann.pinned ? <PinOff className="mr-2 h-4 w-4" /> : <Pin className="mr-2 h-4 w-4" />}
                            {ann.pinned ? 'Desafixar' : 'Fixar'}
                          </Button>
                           <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm" disabled={isSubmitting}>
                                <Trash2 className="mr-2 h-4 w-4" /> Apagar
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita e removerá o aviso permanentemente.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteAnnouncement(ann.id)} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
                                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                  Confirmar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-16 border-dashed border-2 rounded-lg">
                      <Megaphone className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">Nenhum aviso encontrado.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
  );
}
