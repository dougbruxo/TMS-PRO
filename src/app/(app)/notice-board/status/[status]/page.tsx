
"use client";

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Loader2,
  Trash2,
  PlusCircle,
  Edit,
  ClipboardList,
  AlertTriangle,
  Siren,
  Check
} from 'lucide-react';
import type { Notice, NoticeUrgency, NoticeStatus } from '@/lib/types';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { authFetch } from '@/lib/api-client';


const urgencyDetails: Record<NoticeUrgency, { label: string, color: string, icon: React.ReactNode }> = {
    'normal': { label: 'Normal', color: 'bg-blue-500', icon: <ClipboardList className="h-4 w-4 mr-2"/> },
    'atencao': { label: 'Atenção', color: 'bg-yellow-500', icon: <AlertTriangle className="h-4 w-4 mr-2"/> },
    'critico': { label: 'Crítico', color: 'bg-red-500', icon: <Siren className="h-4 w-4 mr-2"/> },
};

const statusLabelMap: Record<string, NoticeUrgency | 'finalizado'> = {
    'normal': 'normal',
    'atencao': 'atencao',
    'critico': 'critico',
    'finalizado': 'finalizado'
};


export default function NoticeStatusPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const statusParam = Array.isArray(params.status) ? params.status[0] : params.status;
  const currentView = statusLabelMap[statusParam];

  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [text, setText] = useState('');
  const [urgency, setUrgency] = useState<NoticeUrgency>('normal');

  const fetchNotices = async () => {
    try {
        const response = await authFetch('/api/notices');
        if (response.ok) {
            setNotices(await response.json());
        }
    } catch (e) {
        toast({variant: 'destructive', title: "Erro", description: "Não foi possível carregar os avisos."});
    } finally {
        setIsLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user || !user.noticeBoardAccess) {
      router.push('/dashboard');
      return;
    }
    fetchNotices();
  }, [user, authLoading, router]);

  const filteredNotices = useMemo(() => {
    if (!notices) return [];
    return notices.filter(notice => {
        if (currentView === 'finalizado') {
            return notice.status === 'finalizado';
        }
        return notice.urgency === currentView && notice.status === 'ativo';
    });
  }, [notices, currentView]);


  const handleOpenForm = (notice: Notice | null) => {
    setSelectedNotice(notice);
    if (notice) {
        setText(notice.text);
        setUrgency(notice.urgency);
    } else {
        setText('');
        setUrgency('normal');
    }
    setIsFormOpen(true);
  };
  
  const handleFormSubmit = async () => {
    if (!text.trim() || !user) {
        toast({ variant: 'destructive', title: 'Erro', description: 'O texto do aviso não pode estar vazio.' });
        return;
    }
    
    setIsSubmitting(true);
    let response;
    const body = { text, urgency, authorId: user.id, authorUsername: user.username };

    if (selectedNotice) {
        response = await authFetch(`/api/notices/${selectedNotice.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } else {
        response = await authFetch('/api/notices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }

    if(response.ok) {
        toast({ title: 'Sucesso!', description: `Aviso ${selectedNotice ? 'atualizado' : 'criado'} com sucesso.` });
        setIsFormOpen(false);
        await fetchNotices();
    } else {
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível salvar o aviso.' });
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (noticeId: string) => {
    setIsSubmitting(true);
    const response = await authFetch(`/api/notices/${noticeId}`, { method: 'DELETE' });
    if(response.ok) {
        toast({ title: 'Sucesso!', description: 'Aviso removido permanentemente.' });
        await fetchNotices();
    }
    setIsSubmitting(false);
  };
  
  const handleToggleStatus = async (notice: Notice) => {
    const newStatus: NoticeStatus = notice.status === 'ativo' ? 'finalizado' : 'ativo';
    const response = await authFetch(`/api/notices/${notice.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) });
    if(response.ok) {
        toast({ title: 'Status Atualizado!', description: `O aviso foi movido para ${newStatus === 'ativo' ? 'Ativos' : 'Finalizados'}.` });
        await fetchNotices();
    }
  };
  
  if (authLoading || !user || isLoading) {
    return (
        <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  const getPageTitle = () => {
    switch(currentView) {
        case 'normal': return 'Avisos Gerais';
        case 'atencao': return 'Avisos de Atenção';
        case 'critico': return 'Avisos Críticos';
        case 'finalizado': return 'Avisos Finalizados';
        default: return 'Quadro de Avisos';
    }
  }
  
  const NoticeCard = ({ notice }: { notice: Notice }) => {
    const detail = urgencyDetails[notice.urgency];
    return (
     <Card key={notice.id} className={`shadow-md bg-card hover:bg-card/90 border-l-4 ${detail.color.replace('bg-', 'border-')}`}>
        <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
                 <Badge className={`${detail.color} text-white hover:${detail.color}`}>
                    {detail.icon}
                    {detail.label}
                 </Badge>
                <span className="text-xs text-muted-foreground">{notice.authorUsername}</span>
            </div>
        </CardHeader>
        <CardContent className="py-2">
            <p className="text-sm">{notice.text}</p>
        </CardContent>
        <CardFooter className="p-4 pt-2 flex justify-between items-center text-xs text-muted-foreground">
           <span>{formatDistanceToNow(new Date(notice.timestamp), { addSuffix: true, locale: ptBR })}</span>
            <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => handleOpenForm(notice)}>
                    <Edit className="h-3 w-3 mr-1"/> Editar
                </Button>
                 <Button size="sm" variant="outline" onClick={() => handleToggleStatus(notice)}>
                    <Check className="h-3 w-3 mr-1"/> {notice.status === 'ativo' ? 'Finalizar' : 'Reativar'}
                </Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive" disabled={isSubmitting}>
                            <Trash2 className="h-3 w-3 mr-1"/> Apagar
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
                        <AlertDialogAction onClick={() => handleDelete(notice.id)} disabled={isSubmitting}>
                          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Confirmar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </CardFooter>
    </Card>
    )
  };

  return (
    <>
      <main className="container mx-auto p-4 md:p-8">
        <Button variant="outline" onClick={() => router.push('/notice-board')} className="mb-8">
          &larr; Voltar para Quadro de Avisos
        </Button>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary mb-2 flex items-center gap-3">
              {getPageTitle()}
            </h1>
            <p className="text-muted-foreground">Crie e gerencie os avisos para a equipe.</p>
          </div>
          <Button onClick={() => handleOpenForm(null)} size="lg">
            <PlusCircle className="h-5 w-5 mr-2"/>
            Criar Novo Aviso
          </Button>
        </div>
        
        {isLoading ? (
            <div className="text-center py-16">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                <p className="mt-4 text-muted-foreground">Carregando avisos...</p>
            </div>
        ) : filteredNotices.length > 0 ? (
            <div className="grid md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredNotices.map(notice => <NoticeCard key={notice.id} notice={notice} />)}
            </div>
        ) : (
             <div className="text-center py-16 border-dashed border-2 rounded-lg">
                <p className="text-muted-foreground">Nenhum aviso encontrado para esta categoria.</p>
            </div>
        )}
      </main>

       <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedNotice ? 'Editar Aviso' : 'Criar Novo Aviso'}</DialogTitle>
            <DialogDescription>
                {selectedNotice ? 'Altere os detalhes do aviso abaixo.' : 'Preencha as informações para criar um novo aviso.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="text">Texto do Aviso</Label>
                <Textarea id="text" value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder="Digite o conteúdo do aviso aqui..."/>
              </div>
              <div className="space-y-2">
                <Label htmlFor="urgency">Nível de Urgência</Label>
                <Select value={urgency} onValueChange={(value) => setUrgency(value as NoticeUrgency)}>
                    <SelectTrigger id="urgency">
                        <SelectValue placeholder="Selecione o nível de urgência" />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.keys(urgencyDetails).map(key => (
                             <SelectItem key={key} value={key}>
                                <span className="flex items-center">
                                    {urgencyDetails[key as NoticeUrgency].icon}
                                    {urgencyDetails[key as NoticeUrgency].label}
                                </span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
              </div>
          </div>
          <DialogFooter>
              <DialogClose asChild>
                  <Button type="button" variant="secondary" disabled={isSubmitting}>Cancelar</Button>
              </DialogClose>
              <Button onClick={handleFormSubmit} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {selectedNotice ? 'Salvar Alterações' : 'Criar Aviso'}
              </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
