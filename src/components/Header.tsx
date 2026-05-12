

"use client";

import Link from 'next/link';
import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import Logo from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { LogOut, Globe, Route, Settings, MessageSquare, Home, Building, FileText, Bug, KeyRound, Upload, Image as ImageIcon, AppWindow, LayoutDashboard, ClipboardCheck, Bell, Check } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup } from '@/components/ui/dropdown-menu';
import { Dialog, DialogTrigger, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';
import { dashboardCardsConfig } from '@/lib/dashboard-cards';
import type { User, ClientCompany } from '@/lib/types';
import useLocalStorage from '@/hooks/use-local-storage';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { TasksDialog } from './TasksDialog';
import { Badge } from './ui/badge';
import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/api-client';

export type ExternalShortcut = {
  id: string;
  name: string;
  url: string;
};

export const DEFAULT_SHORTCUTS: ExternalShortcut[] = [
  { id: 'google-maps', name: 'Google Maps', url: 'https://www.google.com/maps' },
  { id: 'rotas-brasil', name: 'Rotas Brasil', url: 'https://rotasbrasil.com.br/' },
];

const SHORTCUTS_STORAGE_KEY = 'user-external-shortcuts';
const MAX_SHORTCUTS = 4;

export function getExternalShortcuts(): ExternalShortcut[] {
  if (typeof window === 'undefined') return DEFAULT_SHORTCUTS;
  try {
    const stored = localStorage.getItem(SHORTCUTS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : DEFAULT_SHORTCUTS;
    }
  } catch {}
  return DEFAULT_SHORTCUTS;
}

export function saveExternalShortcuts(shortcuts: ExternalShortcut[]) {
  try {
    localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(shortcuts));
  } catch {}
}

const ExternalShortcutsGrid = () => {
  const shortcuts = getExternalShortcuts();
  const emptySlots = Math.max(0, MAX_SHORTCUTS - shortcuts.length);
  const router = useRouter();
  return (
    <div className="grid grid-cols-2 gap-4 py-4">
      {shortcuts.slice(0, MAX_SHORTCUTS).map((shortcut) => (
        <a key={shortcut.id} href={shortcut.url} target="_blank" rel="noopener noreferrer" className="w-full">
          <Button variant="outline" className="w-full h-24 flex flex-col gap-2">
            <Globe className="h-8 w-8 text-primary" />
            <span className="text-sm">{shortcut.name}</span>
          </Button>
        </a>
      ))}
      {Array.from({ length: emptySlots }).map((_, i) => (
        <Button
          key={`empty-${i}`}
          variant="outline"
          className="w-full h-24 flex flex-col gap-2 border-dashed text-muted-foreground hover:text-primary hover:border-primary transition-colors"
          onClick={() => router.push('/settings/dashboard')}
        >
          <span className="text-3xl font-light">+</span>
          <span className="text-xs">Adicionar atalho</span>
        </Button>
      ))}
    </div>
  );
};

const getInitials = (name: string = '') => {
  if (!name) return '';
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
};

const HeaderLogo = ({ userRole, customLogoUrl }: { userRole?: User['role'], customLogoUrl?: string }) => {
    const isClient = userRole === 'cliente' || userRole === 'sub-cliente';
    const href = userRole === 'driver' ? '/driver-portal' : isClient ? '/cliente/dashboard' : '/dashboard';
    return (
        <Link href={href} className="h-[32px] flex items-center">
            {customLogoUrl ? <img src={customLogoUrl} alt="Logo" style={{ maxHeight: '32px', width: 'auto', height: 'auto' }} /> : <Logo />}
        </Link>
    );
};


const passwordFormSchema = z.object({
  currentPassword: z.string().min(6, 'A palavra-passe atual deve ter pelo menos 6 caracteres.'),
  newPassword: z.string().min(6, 'A nova palavra-passe deve ter pelo menos 6 caracteres.'),
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "As novas palavras-passe não coincidem.",
  path: ["confirmPassword"],
});

type Task = {
  id: string;
  text: string;
  completed: boolean;
  type: 'task' | 'reminder';
  priority: 'none' | 'low' | 'medium' | 'high';
  dueDate?: string;
};


const ChangePasswordDialog = ({ isOpen, onOpenChange }: { isOpen: boolean, onOpenChange: (open: boolean) => void }) => {
    const { changeUserPassword } = useAuth();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<z.infer<typeof passwordFormSchema>>({
        resolver: zodResolver(passwordFormSchema),
        defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    });

    const onSubmit = async (values: z.infer<typeof passwordFormSchema>) => {
        setIsSubmitting(true);
        const success = await changeUserPassword(values.currentPassword, values.newPassword);
        if (success) {
            toast({ title: 'Sucesso!', description: 'A sua palavra-passe foi alterada.' });
            onOpenChange(false);
            form.reset();
        } else {
             toast({
                variant: 'destructive',
                title: 'Erro ao Alterar',
                description: 'A sua palavra-passe atual está incorreta. Tente novamente.',
            });
        }
        setIsSubmitting(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { onOpenChange(open); if (!open) form.reset(); }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Alterar Palavra-passe</DialogTitle>
                    <DialogDescription>
                        Para a sua segurança, por favor, insira a sua palavra-passe atual antes de definir uma nova.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                        <FormField control={form.control} name="currentPassword" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Palavra-passe Atual</FormLabel>
                                <FormControl><Input type="password" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="newPassword" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Nova Palavra-passe</FormLabel>
                                <FormControl><Input type="password" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Confirmar Nova Palavra-passe</FormLabel>
                                <FormControl><Input type="password" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                         <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="secondary" disabled={isSubmitting}>Cancelar</Button></DialogClose>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Alterar Palavra-passe
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};

const ChangeAvatarDialog = ({ isOpen, onOpenChange }: { isOpen: boolean, onOpenChange: (open: boolean) => void }) => {
    const { user, uploadProfilePicture } = useAuth();
    const { toast } = useToast();
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast({ variant: 'destructive', title: 'Ficheiro Inválido', description: 'Por favor, selecione um ficheiro de imagem.' });
            return;
        }

        setSelectedFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleConfirmUpload = async () => {
        if (!selectedFile || !user) return;

        setIsUploading(true);
        const success = await uploadProfilePicture(user.id, selectedFile);
        if (success) {
            toast({ title: 'Sucesso!', description: 'A sua foto de perfil foi atualizada.' });
            resetStateAndClose();
        }
        setIsUploading(false);
    };

    const resetStateAndClose = () => {
        setPreviewUrl(null);
        setSelectedFile(null);
        onOpenChange(false);
    };

    const handleCancel = () => {
        setPreviewUrl(null);
        setSelectedFile(null);
    };

    return (
        <Dialog open={isOpen} onOpenChange={resetStateAndClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Mudar Foto de Perfil</DialogTitle>
                    <DialogDescription>
                        Carregue e pré-visualize a sua nova imagem de perfil.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col items-center gap-6 py-6">
                    <Avatar className="h-32 w-32">
                        <AvatarImage src={previewUrl || user?.avatarUrl} alt={user?.username} />
                        <AvatarFallback>{getInitials(user?.username)}</AvatarFallback>
                    </Avatar>
                    <Input 
                        type="file" 
                        accept="image/*" 
                        ref={fileInputRef} 
                        onChange={handleFileSelect}
                        className="hidden" 
                    />
                    
                    {previewUrl ? (
                        <div className="flex gap-4">
                            <Button variant="outline" onClick={handleCancel} disabled={isUploading}>
                                Cancelar
                            </Button>
                            <Button onClick={handleConfirmUpload} disabled={isUploading}>
                                {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Confirmar e Salvar
                            </Button>
                        </div>
                    ) : (
                        <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                           <Upload className="mr-2 h-4 w-4" />
                           Carregar Nova Imagem
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};


export default function Header() {
  const { user, companyProfile, logout, unreadChatCount, operationalAlertCount, receivingAlertCount, expenseAlertCount, billingAlertCount, requestNotificationPermission, notificationPermission, setOpenPopupIds } = useAuth();
  const router = useRouter();
  const [cardOrder] = useLocalStorage<string[]>('dashboardCardOrder', []);
  
  const [isCompanyDialogOpen, setIsCompanyDialogOpen] = useState(false);
  const [isDebugUserOpen, setIsDebugUserOpen] = useState(false);
  const [isPasswordChangeOpen, setIsPasswordChangeOpen] = useState(false);
  const [isAvatarChangeOpen, setIsAvatarChangeOpen] = useState(false);
  const [isTasksOpen, setIsTasksOpen] = useState(false);
  const [hasOverdueTasks, setHasOverdueTasks] = useState(false);

  const { data: clientCompanies } = useQuery<ClientCompany[]>({
    queryKey: ['my-companies-list-dialog'],
    queryFn: async () => {
        const token = localStorage.getItem('sessionToken');
        const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res = await authFetch('/api/my-companies', { headers });
        return res.json();
    },
    enabled: isCompanyDialogOpen && !!user && (user.role === 'cliente' || user.role === 'sub-cliente'),
  });

  const displayedCompany = React.useMemo(() => {
     if (user && (user.role === 'cliente' || user.role === 'sub-cliente')) {
          if (clientCompanies && clientCompanies.length > 0) {
               return clientCompanies.find(c => c.isDefault) || clientCompanies[0];
          }
          return null;
     }
     return companyProfile;
  }, [user, clientCompanies, companyProfile]);

  const financialAlertCount = (expenseAlertCount ?? 0) + (billingAlertCount ?? 0);

  useEffect(() => {
    const checkTasks = () => {
      try {
        const tasksJSON = localStorage.getItem('user-tasks-and-reminders');
        const currentTasks: Task[] = tasksJSON ? JSON.parse(tasksJSON) : [];
        
        const now = new Date();
        const isOverdue = currentTasks.some(
          task => !task.completed && task.dueDate && new Date(task.dueDate) < now
        );

        setHasOverdueTasks(isOverdue);

        if (isOverdue && !isTasksOpen) {
            setIsTasksOpen(true);
        }
      } catch (e) {
        console.error("Failed to check tasks", e);
        setHasOverdueTasks(false);
      }
    };

    const intervalId = setInterval(checkTasks, 60000); // Check every minute
    checkTasks(); // Initial check

    return () => clearInterval(intervalId);
  }, [isTasksOpen]);

  
  const handleLogout = () => {
    logout();
  };

  if (!user) {
    return (
        <header className="bg-card shadow-md p-1">
            <div className="container mx-auto flex items-center justify-between">
                <HeaderLogo />
                 <Loader2 className="h-5 w-5 animate-spin" />
            </div>
        </header>
    );
  }
  
  const accessibleCards = React.useMemo(() => {
    if (!user) return [];
    const baseCards = dashboardCardsConfig.filter(card => {
      if (card.isClientOnly && (user.role === 'admin' || user.role === 'user')) return false;
      if (user.role === 'admin') return true;
      if (user.role === 'driver') return false; // Drivers don't see main dashboard cards in header
      return !!user[card.permissionKey as keyof User];
    });

    if (cardOrder.length === 0) return baseCards;
    
    const cardMap = new Map(baseCards.map(card => [card.title, card]));
    const orderedCards = cardOrder.flatMap(title => {
        const card = cardMap.get(title);
        if (card) {
            cardMap.delete(title);
            return [card];
        }
        return [];
    });
    
    return [...orderedCards, ...Array.from(cardMap.values())];
  }, [user, cardOrder]);


  const isClient = user?.role === 'cliente' || user?.role === 'sub-cliente';
  const clientLogoUrl = isClient ? displayedCompany?.logoUrl : undefined;

  return (
    <TooltipProvider>
      <header className="sticky top-0 z-50 bg-card shadow-md p-1">
        <div className="container mx-auto flex items-center justify-between">
          <HeaderLogo userRole={user.role} customLogoUrl={clientLogoUrl} />
          <div className="flex items-center gap-1">
            
            {user.role !== 'driver' && (
              <>
                <div className="hidden md:flex items-center gap-1">
                    {accessibleCards.map((card) => {
                       const isOperational = card.link === '/operational';
                       const isFinancial = card.link === '/financial';
                       const isReceiving = card.link === '/receiving';
                       const isChat = card.link === '/chat';

                       let alertCount = 0;
                       if (isOperational) alertCount = operationalAlertCount;
                       else if (isFinancial) alertCount = financialAlertCount;
                       else if (isReceiving) alertCount = receivingAlertCount;
                       else if (isChat) alertCount = unreadChatCount;

                        return (
                            <Tooltip key={card.title}>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" onClick={() => router.push(card.link)} className="relative">
                                        {React.cloneElement(card.icon, { className: 'h-5 w-5' })}
                                        {alertCount > 0 && (
                                            <span className="absolute top-1 right-1 flex h-4 w-4">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600 text-white text-xs items-center justify-center">{alertCount}</span>
                                            </span>
                                        )}
                                        <span className="sr-only">{card.title}</span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{card.title}</p></TooltipContent>
                            </Tooltip>
                        )
                    })}
                </div>

                <Dialog>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Globe className="h-5 w-5" />
                          <span className="sr-only">Atalhos Externos</span>
                        </Button>
                      </DialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent><p>Atalhos Externos</p></TooltipContent>
                  </Tooltip>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Atalhos Rápidos</DialogTitle>
                      <DialogDescription>Acesse ferramentas externas úteis com um clique. Personalize em Configurar Dashboard.</DialogDescription>
                    </DialogHeader>
                    <ExternalShortcutsGrid />
                  </DialogContent>
                </Dialog>
              </>
            )}

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-9 w-9 border">
                    <AvatarImage src={user?.avatarUrl || clientLogoUrl} alt={user?.username} />
                    <AvatarFallback>{getInitials(user?.username)}</AvatarFallback>
                  </Avatar>
                  {hasOverdueTasks && <span className="absolute top-0 right-0 block h-3 w-3 rounded-full bg-red-500 ring-2 ring-background animate-pulse" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.username}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user?.email || user.role}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user.role !== 'driver' ? (
                  <>
                     <DropdownMenuGroup className="md:hidden">
                       {accessibleCards.map((card) => {
                          const isOperational = card.link === '/operational';
                          const isFinancial = card.link === '/financial';
                          const isReceiving = card.link === '/receiving';
                          const isChat = card.link === '/chat';

                          let alertCount = 0;
                          if (isOperational) alertCount = operationalAlertCount;
                          else if (isFinancial) alertCount = financialAlertCount;
                          else if (isReceiving) alertCount = receivingAlertCount;
                          else if (isChat) alertCount = unreadChatCount;

                          return (
                            <DropdownMenuItem key={card.title} onSelect={() => router.push(card.link)}>
                                 {React.cloneElement(card.icon, { className: 'mr-2 h-4 w-4' })}
                                <div className="flex items-center justify-between w-full">
                                    <span>{card.title}</span>
                                    {alertCount > 0 && (
                                      <Badge className="ml-auto bg-red-600 animate-pulse">{alertCount}</Badge>
                                    )}
                                </div>
                            </DropdownMenuItem>
                          )
                        })}
                        <DropdownMenuSeparator />
                    </DropdownMenuGroup>
                    <DropdownMenuItem onSelect={() => router.push(userRole === 'cliente' || userRole === 'sub-cliente' ? '/cliente/dashboard' : '/dashboard')}><Home className="mr-2 h-4 w-4" /><span>Página Inicial</span></DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setIsCompanyDialogOpen(true)}><Building className="mr-2 h-4 w-4" /><span>Empresa</span></DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => router.push('/settings/dashboard')}><LayoutDashboard className="mr-2 h-4 w-4" /><span>Configurar Dashboard</span></DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setIsAvatarChangeOpen(true)}><ImageIcon className="mr-2 h-4 w-4" /><span>Mudar Foto de Perfil</span></DropdownMenuItem>
                  </>
                ) : (
                     <DropdownMenuItem onSelect={() => router.push('/driver-portal')}><Home className="mr-2 h-4 w-4" /><span>Meu Portal</span></DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => setIsPasswordChangeOpen(true)}><KeyRound className="mr-2 h-4 w-4" /><span>Mudar Palavra-passe</span></DropdownMenuItem>
                <DropdownMenuItem onSelect={requestNotificationPermission} disabled={notificationPermission === 'granted'}>
                  <Bell className="mr-2 h-4 w-4" />
                  <span>{notificationPermission === 'granted' ? 'Notificações Ativas' : 'Ativar Notificações'}</span>
                  {notificationPermission === 'granted' && <Check className="ml-auto h-4 w-4" />}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setIsTasksOpen(true)}>
                    <ClipboardCheck className="mr-2 h-4 w-4" />
                    <div className="flex items-center justify-between w-full">
                        <span>Tarefas</span>
                        {hasOverdueTasks && <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
                    </div>
                </DropdownMenuItem>
                {user?.role === 'admin' && (<DropdownMenuItem onSelect={() => setIsDebugUserOpen(true)}><Bug className="mr-2 h-4 w-4" /><span>Dados do Utilizador (Debug)</span></DropdownMenuItem>)}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleLogout} className="text-destructive focus:text-destructive"><LogOut className="mr-2 h-4 w-4" /><span>Sair</span></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <Dialog open={isCompanyDialogOpen} onOpenChange={setIsCompanyDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Informações da Empresa</DialogTitle><DialogDescription>Dados cadastrais da sua empresa.</DialogDescription></DialogHeader>
            {displayedCompany ? (
              <div className="space-y-4 py-4 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Razão Social:</span><span className="font-semibold text-right max-w-[250px]">{displayedCompany.razaoSocial}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">CNPJ:</span><span className="font-semibold">{displayedCompany.cnpj}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Endereço:</span><span className="font-semibold text-right max-w-[250px]">{displayedCompany.endereco} {('numero' in displayedCompany && displayedCompany.numero) ? `, ${displayedCompany.numero}` : ''}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Contato:</span><span className="font-semibold">{displayedCompany.telefone || 'Não informado'}</span></div>
              </div>
            ) : (
                <div className="text-center py-8 text-muted-foreground">
                    <p>Nenhuma informação da empresa encontrada.</p>
                    {user.role === 'admin' && (
                        <Button variant="link" onClick={() => { setIsCompanyDialogOpen(false); router.push('/settings/companies'); }}>
                            Configurar agora
                        </Button>
                    )}
                </div>
            )}
          </DialogContent>
        </Dialog>
        <Dialog open={isDebugUserOpen} onOpenChange={setIsDebugUserOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Dados do Utilizador para Depuração</DialogTitle><DialogDescription>Estes são os dados brutos do utilizador autenticado, carregados a partir do banco de dados.</DialogDescription></DialogHeader>
            <div className="mt-4 rounded-lg bg-muted p-4 max-h-[60vh] overflow-y-auto"><pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(user, null, 2)}</pre></div>
          </DialogContent>
        </Dialog>
        <ChangePasswordDialog isOpen={isPasswordChangeOpen} onOpenChange={setIsPasswordChangeOpen} />
        <ChangeAvatarDialog isOpen={isAvatarChangeOpen} onOpenChange={setIsAvatarChangeOpen} />
        <TasksDialog isOpen={isTasksOpen} onOpenChange={setIsTasksOpen} />
      </header>
    </TooltipProvider>
  );
}
