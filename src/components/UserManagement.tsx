
"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Cog, Loader2, Percent, Upload, PlusCircle, History, Image as ImageIcon, Settings2, ChevronDown } from 'lucide-react';
import type { User, UserRole, ActivityRecord } from '@/lib/types';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Switch } from './ui/switch';
import { Separator } from './ui/separator';
import { format } from 'date-fns';
import { Label } from './ui/label';
import { Skeleton } from './ui/skeleton';
import { authFetch } from '@/lib/api-client';

const newUserFormSchema = z.object({
  email: z.string().email({ message: "Por favor, insira um e-mail válido." }),
  password: z.string().min(6, "A palavra-passe deve ter pelo menos 6 caracteres."),
  confirmPassword: z.string().min(6, "Confirme a palavra-passe."),
  username: z.string().min(3, "O nome de utilizador deve ter pelo menos 3 caracteres."),
  contact: z.string().min(1, "O contato é obrigatório."),
  role: z.enum(['admin', 'user', 'parceiro']),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As palavras-passe não coincidem.",
  path: ["confirmPassword"],
});

const editUserFormSchema = z.object({
  username: z.string().min(3, 'Usuário deve ter pelo menos 3 caracteres.'),
  contact: z.string().min(1, 'Contato é obrigatório.'),
  avatarUrl: z.string().optional().or(z.literal('')),
  salesBonusPercentage: z.coerce.number().min(0, 'Bônus deve ser positivo.').max(100, 'Bônus não pode exceder 100%.'),
  // Permissions
  freightAccess: z.boolean().default(false),
  myFreightsAccess: z.boolean().default(false),
  chatEnabled: z.boolean().default(false),
  operationalAccess: z.boolean().default(false),
  driverManagementAccess: z.boolean().default(false),
  settingsAccess: z.boolean().default(false),
  noticeBoardAccess: z.boolean().default(false),
  expensesAccess: z.boolean().default(false),
  talentsAccess: z.boolean().default(false),
  receivingAccess: z.boolean().default(false),
  documentsAccess: z.boolean().default(false),
  fracionadoEnabled: z.boolean().default(false),
  sacAccess: z.boolean().default(false),
  registrationsAccess: z.boolean().default(false),
  panoramaAccess: z.boolean().default(false),
  stockAccess: z.boolean().default(false),
  financialAccess: z.boolean().default(false),
  myCompanyAccess: z.boolean().default(false),
  clientPartnersAccess: z.boolean().default(false),
  clientPortalsAccess: z.boolean().default(false),
  analyzeQuotesAccess: z.boolean().default(false),
  requiresQuoteApproval: z.boolean().default(false),
  subPermissions: z.object({
    freight: z.object({
      canQuoteFracionado: z.boolean().default(false).optional(),
      canQuoteDedicado: z.boolean().default(false).optional(),
      canGiveDiscount: z.boolean().default(false).optional(),
      canDeleteQuote: z.boolean().default(false).optional(),
      canViewOthersQuotes: z.boolean().default(false).optional(),
      canRemakeQuote: z.boolean().default(false).optional(),
      canViewMyQuotes: z.boolean().default(false).optional(),
      canViewBasePrice: z.boolean().default(false).optional(),
      canViewDeliveryTime: z.boolean().default(false).optional(),
      canDefineFreightValue: z.boolean().default(false).optional(),
      canDefineManualCubage: z.boolean().default(false).optional(),
      canDefineVolumes: z.boolean().default(false).optional(),
    }).optional(),
    operational: z.object({
      canCreateJourney: z.boolean().default(false).optional(),
      canEditJourney: z.boolean().default(false).optional(),
      canAssignDriver: z.boolean().default(false).optional(),
      canDeleteJourney: z.boolean().default(false).optional(),
    }).optional(),
    financial: z.object({
      canLogExpense: z.boolean().default(false).optional(),
      canApproveExpense: z.boolean().default(false).optional(),
      canDeleteExpense: z.boolean().default(false).optional(),
    }).optional(),
    registrations: z.object({
      canManageClients: z.boolean().default(false).optional(),
      canManageVehicles: z.boolean().default(false).optional(),
    }).optional(),
    drivers: z.object({
      canApproveDriver: z.boolean().default(false).optional(),
      canBlockDriver: z.boolean().default(false).optional(),
    }).optional(),
    hr: z.object({
      canViewTalents: z.boolean().default(false).optional(),
      canEditTalents: z.boolean().default(false).optional(),
      canManagePayroll: z.boolean().default(false).optional(),
      canDeleteTalents: z.boolean().default(false).optional(),
    }).optional(),
    receiving: z.object({
      canUseScannerAllFunction: z.boolean().default(false).optional(),
    }).optional(),
  }).optional(),
});

const getInitials = (name: string = '') => {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
};

interface UserManagementProps {
    users: User[];
    loginHistory: ActivityRecord[];
    onDataMutated: () => void;
    isLoading?: boolean;
}

const roleDisplayNames: Record<UserRole, string> = {
  admin: 'Admin',
  user: 'Usuário',
  cliente: 'Cliente',
  driver: 'Motorista',
  parceiro: 'Parceiro',
  'sub-cliente': 'Sub-Cliente',
};

const activityTypeDetails: Record<ActivityRecord['type'], { label: string, icon: React.ReactNode }> = {
    LOGIN: { label: "Login", icon: <History className="h-4 w-4 text-green-500" /> },
    AVATAR_UPDATE: { label: "Foto de Perfil", icon: <ImageIcon className="h-4 w-4 text-blue-500" /> },
};


export function UserManagement({ users, loginHistory, onDataMutated, isLoading }: UserManagementProps) {
  const { user: currentUser, updateUser, uploadProfilePicture } = useAuth();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isNewUserDialogOpen, setIsNewUserDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [historyUser, setHistoryUser] = useState<User | null>(null);
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [openSubPermissions, setOpenSubPermissions] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleSubPermissions = (key: string) => {
    setOpenSubPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };
  
  const newUserForm = useForm<z.infer<typeof newUserFormSchema>>({
    resolver: zodResolver(newUserFormSchema),
    defaultValues: { email: '', password: '', confirmPassword: '', username: '', contact: '', role: 'user' },
  });

  const editUserForm = useForm<z.infer<typeof editUserFormSchema>>({
    resolver: zodResolver(editUserFormSchema),
  });

  useEffect(() => {
    if (selectedUser) {
      editUserForm.reset({
        username: selectedUser.username,
        contact: selectedUser.contact,
        avatarUrl: selectedUser.avatarUrl || '',
        salesBonusPercentage: selectedUser.salesBonusPercentage !== undefined ? selectedUser.salesBonusPercentage : 5,
        freightAccess: selectedUser.freightAccess || false,
        myFreightsAccess: selectedUser.myFreightsAccess || false,
        chatEnabled: selectedUser.chatEnabled || false,
        operationalAccess: selectedUser.operationalAccess || false,
        driverManagementAccess: selectedUser.driverManagementAccess || false,
        settingsAccess: selectedUser.settingsAccess || false,
        noticeBoardAccess: selectedUser.noticeBoardAccess || false,
        expensesAccess: selectedUser.expensesAccess || false,
        talentsAccess: selectedUser.talentsAccess || false,
        receivingAccess: selectedUser.receivingAccess || false,
        documentsAccess: selectedUser.documentsAccess || false,
        fracionadoEnabled: selectedUser.fracionadoEnabled || false,
        sacAccess: selectedUser.sacAccess || false,
        registrationsAccess: selectedUser.registrationsAccess || false,
        panoramaAccess: selectedUser.panoramaAccess || false,
        stockAccess: selectedUser.stockAccess || false,
        financialAccess: selectedUser.financialAccess || false,
        myCompanyAccess: selectedUser.myCompanyAccess || false,
        clientPartnersAccess: selectedUser.clientPartnersAccess || false,
        clientPortalsAccess: selectedUser.clientPortalsAccess || false,
        analyzeQuotesAccess: selectedUser.analyzeQuotesAccess || false,
        requiresQuoteApproval: selectedUser.requiresQuoteApproval || false,
        subPermissions: selectedUser.subPermissions || {},
      });
    }
  }, [selectedUser, editUserForm]);


  const handleOpenEditDialog = (user: User) => {
    setSelectedUser(user);
    setIsEditDialogOpen(true);
  };
  
  const handleOpenHistoryDialog = (user: User) => {
    setHistoryUser(user);
    setIsHistoryDialogOpen(true);
  };
  
  const handleCreateUser = async (values: z.infer<typeof newUserFormSchema>) => {
    setIsSubmitting(true);
    const response = await authFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
    });

    if (response.ok) {
      toast({ title: 'Sucesso!', description: 'Novo usuário criado.' });
      setIsNewUserDialogOpen(false);
      newUserForm.reset();
      onDataMutated();
    } else {
        const errorData = await response.json();
        toast({ variant: 'destructive', title: 'Erro', description: errorData.message || 'Não foi possível criar o usuário.' });
    }
    setIsSubmitting(false);
  };

  const handleEditUser = async (values: z.infer<typeof editUserFormSchema>) => {
    if (!selectedUser?.id) return;
    
    setIsSubmitting(true);
    try {
      const updatedUserData: Partial<User> = {
        username: values.username.toUpperCase(),
        contact: values.contact,
        avatarUrl: values.avatarUrl,
        salesBonusPercentage: values.salesBonusPercentage,
        freightAccess: values.freightAccess,
        myFreightsAccess: values.myFreightsAccess,
        chatEnabled: values.chatEnabled,
        operationalAccess: values.operationalAccess,
        driverManagementAccess: values.driverManagementAccess,
        settingsAccess: values.settingsAccess,
        noticeBoardAccess: values.noticeBoardAccess,
        expensesAccess: values.expensesAccess,
        talentsAccess: values.talentsAccess,
        receivingAccess: values.receivingAccess,
        documentsAccess: values.documentsAccess,
        fracionadoEnabled: values.fracionadoEnabled,
        sacAccess: values.sacAccess,
        registrationsAccess: values.registrationsAccess,
        panoramaAccess: values.panoramaAccess,
        stockAccess: values.stockAccess,
        financialAccess: values.financialAccess,
        myCompanyAccess: values.myCompanyAccess,
        clientPartnersAccess: values.clientPartnersAccess,
        clientPortalsAccess: values.clientPortalsAccess,
        analyzeQuotesAccess: values.analyzeQuotesAccess,
        requiresQuoteApproval: values.requiresQuoteApproval,
        subPermissions: values.subPermissions,
      };

      const success = await updateUser(selectedUser.id, updatedUserData);
       if (success) {
         toast({ title: 'Sucesso!', description: `Usuário ${values.username} atualizado.` });
         setIsEditDialogOpen(false);
         onDataMutated();
       }
    } catch (error) {
       console.error("Update user error:", error);
       toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível atualizar o usuário.' });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleAvatarFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedUser) return;
    
    setIsUploading(true);
    const newAvatarUrl = await uploadProfilePicture(selectedUser.id, file);
    if(newAvatarUrl) {
      setSelectedUser(prev => prev ? { ...prev, avatarUrl: newAvatarUrl } : null);
      editUserForm.setValue('avatarUrl', newAvatarUrl);
      toast({ title: 'Sucesso!', description: 'Avatar atualizado.' });
      onDataMutated();
    }
    setIsUploading(false);
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (userId === currentUser?.id) {
        toast({variant: 'destructive', title: 'Ação não permitida', description: 'Você não pode alterar seu próprio nível de acesso.'});
        return;
    }
    const success = await updateUser(userId, { role: newRole });
     if(success) {
        toast({
            title: 'Sucesso!',
            description: `O nível de acesso foi atualizado.`,
        });
        onDataMutated();
     }
  }

  const handleToggleStatus = async (user: User) => {
    if (user.id === currentUser?.id) {
        toast({variant: 'destructive', title: 'Ação não permitida', description: 'Você não pode desativar sua própria conta.'});
        return;
    }
    const newStatus = !user.disabled;
    const success = await updateUser(user.id, { disabled: newStatus });
    if(success){
         toast({
          title: 'Sucesso!',
          description: `Usuário ${user.username} foi ${newStatus ? 'desabilitado' : 'habilitado'}.`,
        });
        onDataMutated();
    }
  }
  
  const filteredHistory = useMemo(() => {
    if (!historyUser) return [];
    let history = loginHistory.filter(log => log.userId === historyUser.id);
    
    if (historyStartDate) {
        history = history.filter(log => new Date(log.timestamp) >= new Date(historyStartDate));
    }
    if (historyEndDate) {
        const endOfDay = new Date(historyEndDate);
        endOfDay.setHours(23, 59, 59, 999);
        history = history.filter(log => new Date(log.timestamp) <= endOfDay);
    }
    return history;
  }, [loginHistory, historyUser, historyStartDate, historyEndDate]);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>Todos os Usuários</CardTitle>
                <CardDescription>
                    Gerencie os usuários e suas permissões de acesso.
                </CardDescription>
            </div>
            <Button onClick={() => setIsNewUserDialogOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" /> Novo Usuário
            </Button>
        </CardHeader>
        <CardContent>
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Nível</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Skeleton className="h-10 w-10 rounded-full" />
                              <Skeleton className="h-5 w-24" />
                            </div>
                          </TableCell>
                          <TableCell><Skeleton className="h-8 w-28" /></TableCell>
                          <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                          <TableCell className="text-right space-x-1">
                            <Skeleton className="h-8 w-8 inline-block" />
                            <Skeleton className="h-8 w-8 inline-block" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : users.map((user) => (
                    <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={user.avatarUrl} alt={user.username} />
                              <AvatarFallback>{getInitials(user.username)}</AvatarFallback>
                            </Avatar>
                            <span>{user.username}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select 
                              value={user.role} 
                              onValueChange={(value) => handleRoleChange(user.id!, value as UserRole)}
                              disabled={user.id === currentUser?.id}
                          >
                              <SelectTrigger className="w-[120px]">
                                  <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="user">{roleDisplayNames.user}</SelectItem>
                                  <SelectItem value="parceiro">{roleDisplayNames.parceiro}</SelectItem>
                                  <SelectItem value="admin">{roleDisplayNames.admin}</SelectItem>
                              </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Switch
                              id={`status-${user.id}`}
                              checked={!user.disabled}
                              onCheckedChange={() => handleToggleStatus(user)}
                              disabled={user.id === currentUser?.id}
                              aria-label={user.disabled ? 'Desabilitado, clique para ativar' : 'Habilitado, clique para desativar'}
                            />
                             <Badge variant={user.disabled ? 'destructive' : 'default'} className={user.disabled ? '' : 'bg-green-600'}>
                              {user.disabled ? 'Inativo' : 'Ativo'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="outline" size="icon" onClick={() => handleOpenHistoryDialog(user)}>
                              <History className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="icon" onClick={() => handleOpenEditDialog(user)}>
                              <Cog className="h-4 w-4" />
                          </Button>
                        </TableCell>
                    </TableRow>
                    ))}
                    {!isLoading && users.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center">Nenhum usuário cadastrado.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
              </Table>
            </div>
        </CardContent>
      </Card>
      
      {/* New User Dialog */}
      <Dialog open={isNewUserDialogOpen} onOpenChange={setIsNewUserDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>Criar Novo Usuário</DialogTitle>
                <DialogDescription>
                    Preencha os dados abaixo para criar um novo acesso ao sistema.
                </DialogDescription>
            </DialogHeader>
            <Form {...newUserForm}>
                <form onSubmit={newUserForm.handleSubmit(handleCreateUser)} className="space-y-4">
                    <FormField control={newUserForm.control} name="email" render={({ field }) => ( <FormItem> <FormLabel>E-mail</FormLabel> <FormControl><Input type="email" placeholder="email@dezlog.com.br" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                    <FormField control={newUserForm.control} name="password" render={({ field }) => ( <FormItem> <FormLabel>Palavra-passe</FormLabel> <FormControl><Input type="password" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                    <FormField control={newUserForm.control} name="confirmPassword" render={({ field }) => ( <FormItem> <FormLabel>Confirmar Palavra-passe</FormLabel> <FormControl><Input type="password" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                    <FormField control={newUserForm.control} name="username" render={({ field }) => ( <FormItem> <FormLabel>Nome de Usuário</FormLabel> <FormControl><Input placeholder="Nome para exibição" {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} /></FormControl> <FormMessage /> </FormItem> )} />
                    <FormField control={newUserForm.control} name="contact" render={({ field }) => ( <FormItem> <FormLabel>Contato (Telefone)</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                    <FormField control={newUserForm.control} name="role" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Nível de Acesso</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                  <SelectItem value="user">{roleDisplayNames.user}</SelectItem>
                                  <SelectItem value="parceiro">{roleDisplayNames.parceiro}</SelectItem>
                                  <SelectItem value="admin">{roleDisplayNames.admin}</SelectItem>
                              </SelectContent>
                          </Select>
                          <FormMessage />
                      </FormItem>
                    )} />
                    <DialogFooter className="pt-4">
                        <DialogClose asChild><Button type="button" variant="secondary" disabled={isSubmitting}>Cancelar</Button></DialogClose>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Criar Usuário
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl flex h-[90vh] flex-col">
          <DialogHeader>
            <DialogTitle>Editar Usuário: {selectedUser?.username}</DialogTitle>
            <DialogDescription>
                Faça alterações nos detalhes e permissões do usuário aqui.
            </DialogDescription>
          </DialogHeader>
          <Form {...editUserForm}>
            <form id="edit-user-form" onSubmit={editUserForm.handleSubmit(handleEditUser)} className="flex-grow overflow-y-auto pr-6">
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={editUserForm.watch('avatarUrl')} alt={selectedUser?.username} />
                    <AvatarFallback>{getInitials(selectedUser?.username || '')}</AvatarFallback>
                  </Avatar>
                  <div className="w-full space-y-2">
                    <Label>Foto de Perfil</Label>
                    <div className="flex gap-2">
                        <Input 
                            type="file" 
                            accept="image/*" 
                            ref={fileInputRef} 
                            onChange={handleAvatarFileSelect}
                            className="hidden" 
                        />
                        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                           {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                           Carregar Imagem
                        </Button>
                     </div>
                  </div>
                </div>

                <FormField control={editUserForm.control} name="username" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome de Usuário</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do usuário" {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                )} />

                <div className="grid grid-cols-2 gap-4">
                    <FormField control={editUserForm.control} name="contact" render={({ field }) => (
                        <FormItem>
                        <FormLabel>Contato</FormLabel>
                        <FormControl>
                            <Input placeholder="Telefone de Contato" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={editUserForm.control} name="salesBonusPercentage" render={({ field }) => (
                        <FormItem>
                        <FormLabel>Bônus de Venda</FormLabel>
                        <div className="relative">
                            <FormControl>
                                <Input type="number" placeholder="5" {...field} className="pr-8" />
                            </FormControl>
                            <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        </div>
                        <FormMessage />
                        </FormItem>
                    )} />
                </div>
                
                <Separator />

                <div>
                    <h3 className="text-lg font-medium">Permissões de Acesso</h3>
                    <p className="text-sm text-muted-foreground">Controle o acesso do usuário a diferentes áreas do sistema.</p>
                </div>
                
                <div className="space-y-4 rounded-md border p-4">
                    <div className="flex flex-col gap-2">
                        <FormField control={editUserForm.control} name="freightAccess" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between"><FormLabel className="cursor-pointer font-medium">Acesso a Cotação de Frete</FormLabel><div className="flex items-center gap-2">{field.value && <Button type="button" variant="ghost" size="sm" onClick={() => toggleSubPermissions('freight')}><Settings2 className="h-4 w-4 mr-1"/> Limitar</Button>}<FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></div></FormItem>)} />
                        {openSubPermissions['freight'] && editUserForm.watch('freightAccess') && (
                            <div className="ml-4 pl-4 border-l-2 space-y-2 border-primary/20 bg-muted/30 p-3 rounded-r-md">
                                <FormField control={editUserForm.control} name="subPermissions.freight.canQuoteFracionado" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between text-sm"><FormLabel className="cursor-pointer font-normal">Cotação Fracionada</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                <FormField control={editUserForm.control} name="subPermissions.freight.canQuoteDedicado" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between text-sm"><FormLabel className="cursor-pointer font-normal">Cotação Dedicada</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                <FormField control={editUserForm.control} name="subPermissions.freight.canGiveDiscount" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between text-sm"><FormLabel className="cursor-pointer font-normal">Dar Desconto</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                <FormField control={editUserForm.control} name="subPermissions.freight.canDeleteQuote" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between text-sm"><FormLabel className="cursor-pointer font-normal text-destructive">Excluir Cotação</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                <FormField control={editUserForm.control} name="subPermissions.freight.canViewOthersQuotes" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between text-sm"><FormLabel className="cursor-pointer font-normal">Ver Cotações de Todos</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                <FormField control={editUserForm.control} name="subPermissions.freight.canRemakeQuote" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between text-sm"><FormLabel className="cursor-pointer font-normal">Refazer Cotação</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                <FormField control={editUserForm.control} name="subPermissions.freight.canViewMyQuotes" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between text-sm"><FormLabel className="cursor-pointer font-normal">Mostrar minhas cotações</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                <FormField control={editUserForm.control} name="subPermissions.freight.canViewBasePrice" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between text-sm"><FormLabel className="cursor-pointer font-normal">Valor Base do Frete (R$)</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                <FormField control={editUserForm.control} name="subPermissions.freight.canViewDeliveryTime" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between text-sm"><FormLabel className="cursor-pointer font-normal">Prazo de Entrega (dias)</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                <FormField control={editUserForm.control} name="subPermissions.freight.canDefineFreightValue" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between text-sm"><FormLabel className="cursor-pointer font-normal">Definir Valor do Frete</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                <FormField control={editUserForm.control} name="subPermissions.freight.canDefineManualCubage" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between text-sm"><FormLabel className="cursor-pointer font-normal">Cubagem Manual</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                <FormField control={editUserForm.control} name="subPermissions.freight.canDefineVolumes" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between text-sm"><FormLabel className="cursor-pointer font-normal">Definir Volumes</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                            </div>
                        )}
                    </div>
                    <Separator className="my-2"/>
                    
                    <FormField control={editUserForm.control} name="myFreightsAccess" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between"><FormLabel className="cursor-pointer">Acesso a Meus Fretes</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                    <FormField control={editUserForm.control} name="panoramaAccess" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between"><FormLabel className="cursor-pointer">Acesso ao Panorama</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                    <div className="flex flex-col gap-2">
                        <FormField control={editUserForm.control} name="registrationsAccess" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between"><FormLabel className="cursor-pointer font-medium">Acesso a Cadastros</FormLabel><div className="flex items-center gap-2">{field.value && <Button type="button" variant="ghost" size="sm" onClick={() => toggleSubPermissions('registrations')}><Settings2 className="h-4 w-4 mr-1"/> Limitar</Button>}<FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></div></FormItem>)} />
                        {openSubPermissions['registrations'] && editUserForm.watch('registrationsAccess') && (
                            <div className="ml-4 pl-4 border-l-2 space-y-2 border-primary/20 bg-muted/30 p-3 rounded-r-md">
                                <FormField control={editUserForm.control} name="subPermissions.registrations.canManageClients" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between text-sm"><FormLabel className="cursor-pointer font-normal">Gerenciar Clientes / Fornecedores</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                <FormField control={editUserForm.control} name="subPermissions.registrations.canManageVehicles" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between text-sm"><FormLabel className="cursor-pointer font-normal">Gerenciar Frota (Veículos)</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                            </div>
                        )}
                    </div>
                    <Separator className="my-2"/>
                    
                    <FormField control={editUserForm.control} name="chatEnabled" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between"><FormLabel className="cursor-pointer">Acesso ao Chat</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                    <FormField control={editUserForm.control} name="fracionadoEnabled" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between"><FormLabel className="cursor-pointer">Acesso à Cotação Fracionado</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                    <FormField control={editUserForm.control} name="sacAccess" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between"><FormLabel className="cursor-pointer">Acesso ao SAC</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                    <FormField control={editUserForm.control} name="documentsAccess" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between"><FormLabel className="cursor-pointer">Acesso a Documentos</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                    <FormField control={editUserForm.control} name="stockAccess" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between"><FormLabel className="cursor-pointer">Acesso ao Estoque</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                    <div className="flex flex-col gap-2">
                        <FormField control={editUserForm.control} name="talentsAccess" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between"><FormLabel className="cursor-pointer font-medium">Acesso a Recursos Humanos (RH)</FormLabel><div className="flex items-center gap-2">{field.value && <Button type="button" variant="ghost" size="sm" onClick={() => toggleSubPermissions('hr')}><Settings2 className="h-4 w-4 mr-1"/> Limitar</Button>}<FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></div></FormItem>)} />
                        {openSubPermissions['hr'] && editUserForm.watch('talentsAccess') && (
                            <div className="ml-4 pl-4 border-l-2 space-y-2 border-primary/20 bg-muted/30 p-3 rounded-r-md">
                                <FormField control={editUserForm.control} name="subPermissions.hr.canViewTalents" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between text-sm"><FormLabel className="cursor-pointer font-normal">Ver Quadro de Talentos</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                <FormField control={editUserForm.control} name="subPermissions.hr.canEditTalents" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between text-sm"><FormLabel className="cursor-pointer font-normal">Criar / Editar / Demitir Talentos</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                <FormField control={editUserForm.control} name="subPermissions.hr.canManagePayroll" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between text-sm"><FormLabel className="cursor-pointer font-normal">Ajustar Holerite / Descontos / Padrões</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                <FormField control={editUserForm.control} name="subPermissions.hr.canDeleteTalents" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between text-sm"><FormLabel className="cursor-pointer font-normal text-destructive">Excluir Talentos</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                            </div>
                        )}
                    </div>
                    <Separator className="my-2"/>
                    <div className="flex flex-col gap-2">
                        <FormField control={editUserForm.control} name="expensesAccess" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between"><FormLabel className="cursor-pointer font-medium">Acesso à Gestão Financeira</FormLabel><div className="flex items-center gap-2">{field.value && <Button type="button" variant="ghost" size="sm" onClick={() => toggleSubPermissions('financial')}><Settings2 className="h-4 w-4 mr-1"/> Limitar</Button>}<FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></div></FormItem>)} />
                        {openSubPermissions['financial'] && editUserForm.watch('expensesAccess') && (
                            <div className="ml-4 pl-4 border-l-2 space-y-2 border-primary/20 bg-muted/30 p-3 rounded-r-md">
                                <FormField control={editUserForm.control} name="subPermissions.financial.canLogExpense" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between text-sm"><FormLabel className="cursor-pointer font-normal">Lançar Despesa / Abastecimento</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                <FormField control={editUserForm.control} name="subPermissions.financial.canApproveExpense" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between text-sm"><FormLabel className="cursor-pointer font-normal">Aprovar Pagamento de Despesas</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                <FormField control={editUserForm.control} name="subPermissions.financial.canDeleteExpense" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between text-sm"><FormLabel className="cursor-pointer font-normal text-destructive">Excluir Registro Financeiro</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                            </div>
                        )}
                    </div>
                    <Separator className="my-2"/>
                    <div className="flex flex-col gap-2">
                        <FormField control={editUserForm.control} name="operationalAccess" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between"><FormLabel className="cursor-pointer font-medium">Acesso à Área Operacional</FormLabel><div className="flex items-center gap-2">{field.value && <Button type="button" variant="ghost" size="sm" onClick={() => toggleSubPermissions('operational')}><Settings2 className="h-4 w-4 mr-1"/> Limitar</Button>}<FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></div></FormItem>)} />
                        {openSubPermissions['operational'] && editUserForm.watch('operationalAccess') && (
                            <div className="ml-4 pl-4 border-l-2 space-y-2 border-primary/20 bg-muted/30 p-3 rounded-r-md">
                                <FormField control={editUserForm.control} name="subPermissions.operational.canCreateJourney" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between text-sm"><FormLabel className="cursor-pointer font-normal">Criar Viagens</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                <FormField control={editUserForm.control} name="subPermissions.operational.canEditJourney" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between text-sm"><FormLabel className="cursor-pointer font-normal">Editar Viagem / Avançar Status</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                <FormField control={editUserForm.control} name="subPermissions.operational.canAssignDriver" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between text-sm"><FormLabel className="cursor-pointer font-normal">Atribuir / Trocar Motorista</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                <FormField control={editUserForm.control} name="subPermissions.operational.canDeleteJourney" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between text-sm"><FormLabel className="cursor-pointer font-normal text-destructive">Excluir Viagem</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                            </div>
                        )}
                    </div>
                    <Separator className="my-2"/>
                    <div className="flex flex-col gap-2">
                        <FormField control={editUserForm.control} name="receivingAccess" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between"><FormLabel className="cursor-pointer font-medium">Acesso à Área de Recebimento</FormLabel><div className="flex items-center gap-2">{field.value && <Button type="button" variant="ghost" size="sm" onClick={() => toggleSubPermissions('receiving')}><Settings2 className="h-4 w-4 mr-1"/> Limitar</Button>}<FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></div></FormItem>)} />
                        {openSubPermissions['receiving'] && editUserForm.watch('receivingAccess') && (
                            <div className="ml-4 pl-4 border-l-2 space-y-2 border-primary/20 bg-muted/30 p-3 rounded-r-md">
                                <FormField control={editUserForm.control} name="subPermissions.receiving.canUseScannerAllFunction" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between text-sm"><FormLabel className="cursor-pointer font-normal">Permitir uso do Bip ALL (Saída do Galpão)</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col gap-2">
                        <FormField control={editUserForm.control} name="driverManagementAccess" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between"><FormLabel className="cursor-pointer font-medium">Acesso à Gestão de Motoristas</FormLabel><div className="flex items-center gap-2">{field.value && <Button type="button" variant="ghost" size="sm" onClick={() => toggleSubPermissions('drivers')}><Settings2 className="h-4 w-4 mr-1"/> Limitar</Button>}<FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></div></FormItem>)} />
                        {openSubPermissions['drivers'] && editUserForm.watch('driverManagementAccess') && (
                            <div className="ml-4 pl-4 border-l-2 space-y-2 border-primary/20 bg-muted/30 p-3 rounded-r-md">
                                <FormField control={editUserForm.control} name="subPermissions.drivers.canApproveDriver" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between text-sm"><FormLabel className="cursor-pointer font-normal">Aprovar / Aceitar Motoristas</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                <FormField control={editUserForm.control} name="subPermissions.drivers.canBlockDriver" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between text-sm"><FormLabel className="cursor-pointer font-normal text-destructive">Banir / Suspender Motorista</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                            </div>
                        )}
                    </div>
                    <Separator className="my-2"/>
                    <FormField control={editUserForm.control} name="noticeBoardAccess" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between"><FormLabel className="cursor-pointer">Acesso ao Quadro de Avisos</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                    <FormField control={editUserForm.control} name="clientPortalsAccess" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between"><FormLabel className="cursor-pointer">Gestão de Portais de Clientes (B2B)</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                    <FormField control={editUserForm.control} name="analyzeQuotesAccess" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between"><FormLabel className="cursor-pointer">Análise de Cotações B2B</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                    {selectedUser?.role === 'parceiro' && (
                        <FormField control={editUserForm.control} name="requiresQuoteApproval" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between border border-amber-200 bg-amber-50/50 dark:bg-amber-950/10 dark:border-amber-900/30 p-3 rounded-md"><div><FormLabel className="cursor-pointer font-medium text-amber-800 dark:text-amber-300">Cotações requerem Aprovação</FormLabel><p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">As cotações deste parceiro irão para análise antes de serem processadas.</p></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                    )}
                    <FormField control={editUserForm.control} name="settingsAccess" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between"><FormLabel className="cursor-pointer">Acesso às Configurações Globais (Admin)</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                    {selectedUser?.role === 'cliente' && (
                        <>
                            <FormField control={editUserForm.control} name="myCompanyAccess" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between"><FormLabel className="cursor-pointer">Acesso a Minha Empresa (Área do Cliente)</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                            <FormField control={editUserForm.control} name="clientPartnersAccess" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between"><FormLabel className="cursor-pointer">Acesso a Clientes e Fornecedores (Área do Cliente)</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                        </>
                    )}
                </div>
              </div>
            </form>
          </Form>
          <DialogFooter className="pt-4">
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isSubmitting}>Cancelar</Button>
            </DialogClose>
            <Button type="submit" form="edit-user-form" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Login History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de Atividade de {historyUser?.username}</DialogTitle>
            <DialogDescription>
              Visualize os registros de atividade para este usuário.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="grid w-full items-center gap-1.5">
                  <Label htmlFor="start-date">Data de Início</Label>
                  <Input type="date" id="start-date" value={historyStartDate} onChange={e => setHistoryStartDate(e.target.value)} />
              </div>
              <div className="grid w-full items-center gap-1.5">
                  <Label htmlFor="end-date">Data de Fim</Label>
                  <Input type="date" id="end-date" value={historyEndDate} onChange={e => setHistoryEndDate(e.target.value)} />
              </div>
            </div>
            <div className="border rounded-md max-h-[50vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data e Hora</TableHead>
                    <TableHead>Atividade</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.length > 0 ? (
                    filteredHistory.map((log) => {
                      const activityInfo = activityTypeDetails[log.type] || { label: log.type, icon: <History className="h-4 w-4" /> };
                      return (
                          <TableRow key={log.id}>
                            <TableCell>{format(new Date(log.timestamp), "dd/MM/yyyy HH:mm:ss")}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {activityInfo.icon}
                                <span>{activityInfo.label}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{log.details}</TableCell>
                          </TableRow>
                      )
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">
                        Nenhum registro de atividade encontrado para este período.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Fechar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
