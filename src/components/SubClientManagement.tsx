"use client";

import { useState, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Cog, Loader2, PlusCircle, UserCog, History, Upload, Image as ImageIcon } from 'lucide-react';
import type { User, ActivityRecord } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { Label } from '@/components/ui/label';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Skeleton } from './ui/skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/api-client';

const getInitials = (name: string = '') => {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
};

const activityTypeDetails: Record<ActivityRecord['type'], { label: string, icon: React.ReactNode }> = {
    LOGIN: { label: "Login", icon: <History className="h-4 w-4 text-green-500" /> },
    AVATAR_UPDATE: { label: "Foto de Perfil", icon: <ImageIcon className="h-4 w-4 text-blue-500" /> },
};

const newSubClientSchema = z.object({
  email: z.string().email("E-mail válido é obrigatório."),
  password: z.string().min(6, "A palavra-passe deve ter pelo menos 6 caracteres."),
  confirmPassword: z.string().min(6, "Confirme a palavra-passe."),
  username: z.string().min(3, "O nome deve ter pelo menos 3 caracteres."),
  contact: z.string().min(1, "O contato é obrigatório."),
  subRole: z.enum(['ADM', 'Colaborador']),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As palavras-passe não coincidem.",
  path: ["confirmPassword"],
});

const editSubClientSchema = z.object({
    username: z.string().min(3, "O nome deve ter pelo menos 3 caracteres."),
    contact: z.string().optional(),
    subRole: z.enum(['ADM', 'Colaborador']),
    freightAccess: z.boolean(),
    myFreightsAccess: z.boolean(),
    clientPartnersAccess: z.boolean(),
    myCompanyAccess: z.boolean(),
    noticeBoardAccess: z.boolean(),
    chatEnabled: z.boolean(),
});

export function SubClientManagement() {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  const { uploadProfilePicture } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [historyUser, setHistoryUser] = useState<User | null>(null);
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['sub-clientes'],
    queryFn: async () => {
        const token = localStorage.getItem('sessionToken');
        const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res = await authFetch('/api/cliente-users', { headers });
        if (!res.ok) throw new Error("Erro ao buscar usuários");
        return res.json();
    }
  });

  const { data: userHistory = [] } = useQuery<ActivityRecord[]>({
    queryKey: ['sub-cliente-history', historyUser?.id],
    enabled: !!historyUser,
    queryFn: async () => {
        const token = localStorage.getItem('sessionToken');
        const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res = await authFetch(`/api/cliente-users/${historyUser!.id}/history`, { headers });
        if (!res.ok) return [];
        return res.json();
    }
  });

  const filteredHistory = useMemo(() => {
    return userHistory.filter(log => {
      if (historyStartDate && new Date(log.timestamp) < new Date(historyStartDate)) return false;
      if (historyEndDate) {
        const endDate = new Date(historyEndDate);
        endDate.setHours(23, 59, 59, 999);
        if (new Date(log.timestamp) > endDate) return false;
      }
      return true;
    });
  }, [userHistory, historyStartDate, historyEndDate]);

  const newUserForm = useForm<z.infer<typeof newSubClientSchema>>({
    resolver: zodResolver(newSubClientSchema),
    defaultValues: { email: '', password: '', confirmPassword: '', username: '', contact: '', subRole: 'Colaborador' },
  });

  const editUserForm = useForm<z.infer<typeof editSubClientSchema>>({
    resolver: zodResolver(editSubClientSchema),
  });

  const createMutation = useMutation({
      mutationFn: async (values: z.infer<typeof newSubClientSchema>) => {
          const token = localStorage.getItem('sessionToken');
          const headers: HeadersInit = { 'Content-Type': 'application/json' };
          if (token) headers['Authorization'] = `Bearer ${token}`;
          
          const res = await authFetch('/api/cliente-users', {
              method: 'POST',
              headers,
              body: JSON.stringify(values),
          });
          if (!res.ok) {
              const data = await res.json();
              throw new Error(data.message || 'Erro ao criar usuário');
          }
          return res.json();
      },
      onSuccess: () => {
          toast({ title: 'Sucesso', description: 'Usuário criado com sucesso.' });
          setIsNewDialogOpen(false);
          newUserForm.reset();
          queryClient.invalidateQueries({ queryKey: ['sub-clientes'] });
      },
      onError: (error: any) => {
          toast({ variant: 'destructive', title: 'Erro', description: error.message });
      }
  });

  const updateMutation = useMutation({
      mutationFn: async (data: { id: string, values: any }) => {
          const token = localStorage.getItem('sessionToken');
          const headers: HeadersInit = { 'Content-Type': 'application/json' };
          if (token) headers['Authorization'] = `Bearer ${token}`;

          const res = await authFetch(`/api/cliente-users/${data.id}`, {
              method: 'PUT',
              headers,
              body: JSON.stringify(data.values),
          });
          if (!res.ok) throw new Error("Erro ao atualizar usuário");
      },
      onSuccess: () => {
          toast({ title: 'Sucesso', description: 'Usuário atualizado.' });
          setIsEditDialogOpen(false);
          queryClient.invalidateQueries({ queryKey: ['sub-clientes'] });
      },
      onError: () => toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível atualizar o usuário.' })
  });
  
  const toggleStatusMutation = useMutation({
      mutationFn: async (data: { id: string, disabled: boolean }) => {
          const token = localStorage.getItem('sessionToken');
          const headers: HeadersInit = { 'Content-Type': 'application/json' };
          if (token) headers['Authorization'] = `Bearer ${token}`;

          const res = await authFetch(`/api/cliente-users/${data.id}/toggle-status`, {
              method: 'PUT',
              headers,
              body: JSON.stringify({ status: !data.disabled }), // Envia o NOVO status invertido
          });
          if (!res.ok) throw new Error("Erro ao alterar status");
      },
      onSuccess: () => {
          toast({ title: 'Status Atualizado', description: 'O status do usuário foi modificado.' });
          queryClient.invalidateQueries({ queryKey: ['sub-clientes'] });
      }
  });

  const handleAvatarFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedUser) return;
    
    setIsUploading(true);
    const newAvatarUrl = await uploadProfilePicture(selectedUser.id, file);
    if(newAvatarUrl) {
      setSelectedUser(prev => prev ? { ...prev, avatarUrl: newAvatarUrl } : null);
      toast({ title: 'Sucesso!', description: 'Foto de perfil atualizada.' });
      queryClient.invalidateQueries({ queryKey: ['sub-clientes'] });
    }
    setIsUploading(false);
  };

  const handleOpenEdit = (user: User) => {
      setSelectedUser(user);
      editUserForm.reset({
          username: user.username,
          contact: user.contact || '',
          subRole: user.subRole || 'Colaborador',
          freightAccess: user.freightAccess || false,
          myFreightsAccess: user.myFreightsAccess || false,
          clientPartnersAccess: user.clientPartnersAccess || false,
          myCompanyAccess: user.myCompanyAccess || false,
          noticeBoardAccess: user.noticeBoardAccess || false,
          chatEnabled: user.chatEnabled || false,
      });
      setIsEditDialogOpen(true);
  };

  const handleOpenHistory = (user: User) => {
      setHistoryUser(user);
      setIsHistoryDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>Usuários da Conta</CardTitle>
                <CardDescription>
                    Convide sua equipe para acessar o sistema através da sua conta corporativa.
                </CardDescription>
            </div>
            <Button onClick={() => setIsNewDialogOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" /> Novo Usuário
            </Button>
        </CardHeader>
        <CardContent>
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Nível de Acesso</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                      Array.from({ length: 3 }).map((_, index) => (
                        <TableRow key={index}>
                          <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-48" /></TableCell>
                          <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                          <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                        </TableRow>
                      ))
                    ) : users.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                Você ainda não tem usuários cadastrados na sua conta.
                            </TableCell>
                        </TableRow>
                    ) : users.map((user) => (
                        <TableRow key={user.id}>
                            <TableCell className="font-medium">{user.username}</TableCell>
                            <TableCell className="text-muted-foreground">{user.email}</TableCell>
                            <TableCell>
                                <Badge variant={user.subRole === 'ADM' ? 'default' : 'secondary'}>
                                    {user.subRole || 'Colaborador'}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        checked={!user.disabled}
                                        onCheckedChange={() => toggleStatusMutation.mutate({ id: user.id, disabled: !!user.disabled })}
                                    />
                                    <span className="text-sm font-medium">{user.disabled ? 'Inativo' : 'Ativo'}</span>
                                </div>
                            </TableCell>
                            <TableCell className="text-right space-x-1">
                                <Button variant="outline" size="icon" onClick={() => handleOpenHistory(user)} title="Ver Histórico">
                                    <History className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" size="icon" onClick={() => handleOpenEdit(user)} title="Editar Acessos">
                                    <Cog className="h-4 w-4" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
        </CardContent>
      </Card>
      
      {/* TODO: Dialogs para Novo Usuário e Edição */}
      <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>Criar Usuário Colaborador</DialogTitle>
                <DialogDescription>
                    Este usuário logará com e-mail e senha e terá ações creditadas sob a sua gestão administrativa.
                </DialogDescription>
            </DialogHeader>
            <Form {...newUserForm}>
                <form onSubmit={newUserForm.handleSubmit((values) => createMutation.mutate(values))} className="space-y-4">
                    <FormField control={newUserForm.control} name="email" render={({ field }) => ( 
                        <FormItem> <FormLabel>E-mail de Login</FormLabel> <FormControl><Input placeholder="email@empresa.com.br" {...field} /></FormControl> <FormMessage /> </FormItem> 
                    )} />
                    <FormField control={newUserForm.control} name="password" render={({ field }) => ( 
                        <FormItem> <FormLabel>Senha Inicial</FormLabel> <FormControl><Input type="password" {...field} /></FormControl> <FormMessage /> </FormItem> 
                    )} />
                    <FormField control={newUserForm.control} name="confirmPassword" render={({ field }) => ( 
                        <FormItem> <FormLabel>Confirmar Senha Inicial</FormLabel> <FormControl><Input type="password" {...field} /></FormControl> <FormMessage /> </FormItem> 
                    )} />
                    <FormField control={newUserForm.control} name="username" render={({ field }) => ( 
                        <FormItem> <FormLabel>Nome Completo</FormLabel> <FormControl><Input placeholder="João Silva" {...field} /></FormControl> <FormMessage /> </FormItem> 
                    )} />
                    <FormField control={newUserForm.control} name="contact" render={({ field }) => ( 
                        <FormItem> <FormLabel>Contato (Telefone/WhatsApp)</FormLabel> <FormControl><Input placeholder="(00) 00000-0000" {...field} /></FormControl> <FormMessage /> </FormItem> 
                    )} />
                    <FormField control={newUserForm.control} name="subRole" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Hierarquia Inicial</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                  <SelectItem value="Colaborador">Colaborador (Restrito a Cotações)</SelectItem>
                                  <SelectItem value="ADM">Administrador (Altera Filiais e Parceiros)</SelectItem>
                              </SelectContent>
                          </Select>
                          <FormDescription>
                              Você poderá definir as permissões específicas do usuário na tela de edição, após a criação.
                          </FormDescription>
                          <FormMessage />
                      </FormItem>
                    )} />

                    <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={createMutation.isPending}>
                            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Criar Conta
                        </Button>
                    </div>
                </form>
            </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg">
            <DialogHeader>
                <DialogTitle>Editar Usuário: {selectedUser?.username.toUpperCase()}</DialogTitle>
                <DialogDescription>
                    Faça alterações nos detalhes e permissões do usuário aqui.
                </DialogDescription>
            </DialogHeader>
            <Form {...editUserForm}>
                <form id="edit-subuser-form" onSubmit={editUserForm.handleSubmit((values) => {
                    if (selectedUser) updateMutation.mutate({ id: selectedUser.id, values });
                })} className="space-y-6 pt-2">
                    <div className="flex items-center gap-4">
                        <Avatar className="h-20 w-20">
                            <AvatarImage src={selectedUser?.avatarUrl} alt={selectedUser?.username} />
                            <AvatarFallback>{getInitials(selectedUser?.username || '')}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col gap-2">
                            <Label>Foto de Perfil</Label>
                            <div>
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
                                <Input placeholder="ADMINISTRADOR" {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />

                    <FormField control={editUserForm.control} name="contact" render={({ field }) => (
                        <FormItem className="w-1/2">
                            <FormLabel>Contato</FormLabel>
                            <FormControl>
                                <Input placeholder="Telefone de Contato" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />

                    <FormField control={editUserForm.control} name="subRole" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Hierarquia</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="Colaborador">Colaborador (Restrito a Cotações)</SelectItem>
                                    <SelectItem value="ADM">Administrador (Altera Filiais e Parceiros)</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                    
                    <div className="pt-2">
                        <h3 className="text-lg font-medium">Permissões de Acesso</h3>
                        <p className="text-sm text-muted-foreground mr-6">Controle o acesso do usuário a diferentes áreas do sistema.</p>
                    </div>
                    
                    <div className="space-y-4 rounded-md border p-4">
                        <FormField control={editUserForm.control} name="freightAccess" render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between space-y-0">
                                <FormLabel className="font-normal text-base cursor-pointer">Fazer Novas Cotações</FormLabel>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )} />
                        <FormField control={editUserForm.control} name="myFreightsAccess" render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between space-y-0">
                                <FormLabel className="font-normal text-base cursor-pointer">Acessar Meus Fretes</FormLabel>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )} />
                        <FormField control={editUserForm.control} name="clientPartnersAccess" render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between space-y-0">
                                <FormLabel className="font-normal text-base cursor-pointer">Acessar Clientes e Fornecedores</FormLabel>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )} />
                        <FormField control={editUserForm.control} name="myCompanyAccess" render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between space-y-0">
                                <FormLabel className="font-normal text-base cursor-pointer">Configurações da Empresa</FormLabel>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )} />
                        <FormField control={editUserForm.control} name="noticeBoardAccess" render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between space-y-0">
                                <FormLabel className="font-normal text-base cursor-pointer">Quadro de Avisos Internos</FormLabel>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )} />
                        <FormField control={editUserForm.control} name="chatEnabled" render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between space-y-0">
                                <FormLabel className="font-normal text-base cursor-pointer">Acessar Chat Interno</FormLabel>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )} />
                    </div>

                </form>
            </Form>
            
            <div className="flex items-center justify-between pt-6">
                <Button type="button" variant="destructive" onClick={async () => {
                    if (confirm('A senha será resetada para 123456. Confirmar?')){
                        const token = localStorage.getItem('sessionToken');
                        const headers: HeadersInit = { 'Content-Type': 'application/json' };
                        if (token) headers['Authorization'] = `Bearer ${token}`;

                        await authFetch(`/api/cliente-users/${selectedUser?.id}/reset-password`, {
                            method: 'POST', body: JSON.stringify({newPassword: '123456'}), headers
                        });
                        toast({title: 'Senha redefinida', description: 'Senha atualizada para 123456.'});
                    }
                }}>
                    Resetar Senha 
                </Button>

                <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setIsEditDialogOpen(false)} type="button">Cancelar</Button>
                    <Button type="submit" form="edit-subuser-form" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={updateMutation.isPending}>
                        {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Salvar Alterações
                    </Button>
                </div>
            </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico de Autorizações - {historyUser?.username}</DialogTitle>
            <DialogDescription>
              Visualize os registros de sistema atrelados a este usuário.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="grid w-full items-center gap-1.5">
                  <Label htmlFor="start-date">Data Inicial</Label>
                  <Input type="date" id="start-date" value={historyStartDate} onChange={e => setHistoryStartDate(e.target.value)} />
              </div>
              <div className="grid w-full items-center gap-1.5">
                  <Label htmlFor="end-date">Data Final</Label>
                  <Input type="date" id="end-date" value={historyEndDate} onChange={e => setHistoryEndDate(e.target.value)} />
              </div>
            </div>
            <div className="border rounded-md">
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
                            <TableCell>{format(new Date(log.timestamp), "dd/MM/yyyy HH:mm")}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {activityInfo.icon}
                                {activityInfo.label}
                              </div>
                            </TableCell>
                            <TableCell className="max-w-xs truncate" title={log.details}>
                                {log.details}
                            </TableCell>
                          </TableRow>
                      )
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center">Nenhum registro encontrado no período.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
