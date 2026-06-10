

"use client";

import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import Logo from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { LogOut, Home, Building, LayoutDashboard, KeyRound, Upload, Image as ImageIcon, Bug, ClipboardCheck, MessageSquare, AlertTriangle, Bell, Check } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarTrigger,
  SidebarMenuBadge,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { dashboardCardsConfig } from '@/lib/dashboard-cards';
import { getInitials } from '@/lib/utils';
import type { User, ClientCompany } from '@/lib/types';
import useLocalStorage from '@/hooks/use-local-storage';
import { Dialog, DialogTrigger, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import { TasksDialog } from './TasksDialog';
import { Badge } from './ui/badge';
import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/api-client';


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
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                        <FormField control={form.control} name="currentPassword" render={({ field }) => ( <FormItem><FormLabel>Palavra-passe Atual</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="newPassword" render={({ field }) => ( <FormItem><FormLabel>Nova Palavra-passe</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="confirmPassword" render={({ field }) => ( <FormItem><FormLabel>Confirmar Nova Palavra-passe</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem> )} />
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
    const fileInputRef = React.useRef<HTMLInputElement>(null);
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
        reader.onloadend = () => { setPreviewUrl(reader.result as string); };
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

    return (
        <Dialog open={isOpen} onOpenChange={resetStateAndClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Mudar Foto de Perfil</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col items-center gap-6 py-6">
                    <Avatar className="h-32 w-32">
                        <AvatarImage src={previewUrl || user?.avatarUrl} alt={user?.username} />
                        <AvatarFallback>{getInitials(user?.username)}</AvatarFallback>
                    </Avatar>
                    <Input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                    {previewUrl ? (
                        <div className="flex gap-4">
                            <Button variant="outline" onClick={() => { setPreviewUrl(null); setSelectedFile(null); }} disabled={isUploading}>Cancelar</Button>
                            <Button onClick={handleConfirmUpload} disabled={isUploading}>
                                {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Confirmar e Salvar
                            </Button>
                        </div>
                    ) : ( <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading}><Upload className="mr-2 h-4 w-4" />Carregar Nova Imagem</Button> )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export function AppSidebar() {
  const { user, logout, companyProfile, unreadChatCount, operationalAlertCount, receivingAlertCount, expenseAlertCount, billingAlertCount, requestNotificationPermission, notificationPermission, setOpenPopupIds } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
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
    enabled: !!user && (user.role === 'cliente' || user.role === 'sub-cliente'),
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


  if (!user) return null;

  const accessibleCards = React.useMemo(() => {
    if (!user) return [];
    const baseCards = dashboardCardsConfig.filter(card => {
      if (card.isClientOnly && (user.role === 'admin' || user.role === 'user')) return false;
      if (user.role === 'admin') return true;
      if (user.role === 'driver') return false;
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
    <>
      <Sidebar collapsible="icon">
          <SidebarTrigger className="absolute top-1/2 -translate-y-1/2" />
          <SidebarHeader>
              <div className="flex h-14 items-center group-data-[state=expanded]:p-2 group-data-[state=expanded]:justify-start group-data-[state=collapsed]:p-0 group-data-[state=collapsed]:justify-center">
                  <Link href={isClient ? "/cliente/dashboard" : "/dashboard"} className="flex h-full w-full items-center justify-center">
                      {/* Logo for EXPANDED state */}
                      <div className="group-data-[state=collapsed]:hidden">
                          {clientLogoUrl ? <img src={clientLogoUrl} alt="Logo" style={{ maxHeight: '32px', width: 'auto', height: 'auto' }} /> : <Logo />}
                      </div>
                      {/* Icon for COLLAPSED state */}
                      <div className="group-data-[state=expanded]:hidden h-full w-full flex items-center justify-center p-0">
                          <Image 
                            src={clientLogoUrl || companyProfile?.logoUrl || "/icon.svg"} 
                            alt="Logótipo"
                            width={48}
                            height={48}
                            className="object-contain h-10 w-10"
                          />
                      </div>
                  </Link>
              </div>
          </SidebarHeader>
          <SidebarContent>
              <SidebarMenu>
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
                      <SidebarMenuItem key={card.title}>
                          <SidebarMenuButton 
                              onClick={() => {
                                let targetLink = card.link;
                                if (isClient && card.link === '/my-freights') {
                                    targetLink = '/cliente/meus-fretes';
                                }
                                router.push(targetLink);
                              }}
                              isActive={pathname.startsWith(card.link) || (isClient && card.link === '/my-freights' && pathname.startsWith('/cliente/meus-fretes'))}
                              tooltip={card.title}
                          >
                              {React.cloneElement(card.icon, { className: ''})}
                              <span>{card.title}</span>
                              {alertCount > 0 && (
                                <SidebarMenuBadge className="bg-red-600 text-white animate-pulse">{alertCount}</SidebarMenuBadge>
                               )}
                          </SidebarMenuButton>
                      </SidebarMenuItem>
                  )})}
              </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="gap-2">
              <SidebarSeparator />
              <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="relative flex h-auto w-full items-center justify-start group-data-[state=collapsed]:justify-center gap-2 p-2">
                          <Avatar className="h-9 w-9 border">
                              <AvatarImage src={user.avatarUrl || clientLogoUrl} alt={user.username} />
                              <AvatarFallback>{getInitials(user.username)}</AvatarFallback>
                          </Avatar>
                           {hasOverdueTasks && <span className="absolute top-1 left-8 block h-3 w-3 rounded-full bg-red-500 ring-2 ring-background animate-pulse group-data-[state=collapsed]:left-auto group-data-[state=collapsed]:top-0" />}
                          <div className="flex-grow overflow-hidden text-left group-data-[state=collapsed]:hidden">
                              <p className="text-sm font-medium truncate">{user.username}</p>
                              <p className="text-xs text-muted-foreground truncate">{user.email || user.role}</p>
                          </div>
                      </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 mb-2" side="top" align="start">
                      <DropdownMenuLabel className="font-normal">
                          <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium leading-none">{user?.username}</p>
                          <p className="text-xs leading-none text-muted-foreground">{user?.email || user.role}</p>
                          </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => setIsCompanyDialogOpen(true)}><Building className="mr-2 h-4 w-4" /><span>Empresa</span></DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => router.push('/settings/dashboard')}><LayoutDashboard className="mr-2 h-4 w-4" /><span>Configurar Dashboard</span></DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setIsAvatarChangeOpen(true)}><ImageIcon className="mr-2 h-4 w-4" /><span>Mudar Foto</span></DropdownMenuItem>
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
                      {user.role === 'admin' && (
                      <DropdownMenuItem onSelect={() => setIsDebugUserOpen(true)}><Bug className="mr-2 h-4 w-4" /><span>Depuração</span></DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={logout} className="text-destructive focus:text-destructive"><LogOut className="mr-2 h-4 w-4" /><span>Sair</span></DropdownMenuItem>
                  </DropdownMenuContent>
              </DropdownMenu>
          </SidebarFooter>
      </Sidebar>
      
      {/* DIALOGS */}
      <ChangePasswordDialog isOpen={isPasswordChangeOpen} onOpenChange={setIsPasswordChangeOpen} />
      <ChangeAvatarDialog isOpen={isAvatarChangeOpen} onOpenChange={setIsAvatarChangeOpen} />
      <TasksDialog isOpen={isTasksOpen} onOpenChange={setIsTasksOpen} />

      <Dialog open={isCompanyDialogOpen} onOpenChange={setIsCompanyDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Informações da Empresa</DialogTitle></DialogHeader>
            {displayedCompany ? (
              <div className="space-y-4 py-4 text-sm">
                {displayedCompany.logoUrl && (
                  <div className="flex justify-center mb-4">
                    <div className="relative h-20 w-40 border rounded bg-white p-2 flex items-center justify-center">
                      <img src={displayedCompany.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                    </div>
                  </div>
                )}
                <div className="flex justify-between border-b pb-2"><span className="text-muted-foreground">Razão Social:</span><span className="font-semibold text-right max-w-[250px]">{displayedCompany.razaoSocial}</span></div>
                <div className="flex justify-between border-b pb-2 pt-2"><span className="text-muted-foreground">CNPJ:</span><span className="font-semibold">{displayedCompany.cnpj}</span></div>
                <div className="flex justify-between border-b pb-2 pt-2"><span className="text-muted-foreground">Endereço:</span><span className="font-semibold text-right max-w-[200px]">{displayedCompany.endereco} {('numero' in displayedCompany && displayedCompany.numero) ? `, ${displayedCompany.numero}` : ''}</span></div>
                <div className="flex justify-between pt-2"><span className="text-muted-foreground">Contato:</span><span className="font-semibold">{displayedCompany.telefone || 'Não informado'}</span></div>
              </div>
            ) : <p className="py-4 text-muted-foreground">Nenhuma informação da empresa encontrada.</p>}
          </DialogContent>
        </Dialog>
        <Dialog open={isDebugUserOpen} onOpenChange={setIsDebugUserOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Dados do Utilizador para Depuração</DialogTitle></DialogHeader>
            <div className="mt-4 rounded-lg bg-muted p-4 max-h-[60vh] overflow-y-auto"><pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(user, null, 2)}</pre></div>
          </DialogContent>
        </Dialog>
    </>
  );
}
