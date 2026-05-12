
"use client";

import { useState, useMemo, useRef, ChangeEvent, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, PlusCircle, Edit, Trash2, Users, Upload, CheckCircle, X, ChevronsUpDown } from 'lucide-react';
import type { HubUser, User } from '@/lib/types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription as AlertDialogDesc, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { getInitials } from '@/lib/utils';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '../ui/badge';
import React from 'react';
import { Checkbox } from '../ui/checkbox';
import { authFetch } from '@/lib/api-client';

const hubFormSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres.'),
  linkedUserIds: z.array(z.string()).min(1, 'Selecione ao menos um usuário responsável.'),
});

interface HubUserManagementProps {
    hubs: HubUser[];
    allUsers: User[];
    onDataMutated: () => void;
}

const MultiSelectUsers = ({ users, selected, onChange }: { users: User[], selected: string[], onChange: (selected: string[]) => void }) => {
    const [open, setOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

    const selectedUsersDetails = useMemo(() => {
        return selected.map(id => users.find(u => u.id === id)).filter(Boolean) as User[];
    }, [selected, users]);

    const handleSearch = useCallback(async (term: string) => {
        if (term.length < 2) {
            setSearchResults([]);
            return;
        }
        setIsSearching(true);
        try {
            const token = localStorage.getItem('sessionToken');
            const res = await authFetch(`/api/users/search?term=${encodeURIComponent(term)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setSearchResults(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSearching(false);
        }
    }, []);

    useEffect(() => {
        if (debounceTimeout.current) {
            clearTimeout(debounceTimeout.current);
        }
        if (searchTerm.length >= 2) {
            debounceTimeout.current = setTimeout(() => {
                handleSearch(searchTerm);
            }, 300); // 300ms debounce
        } else {
            setSearchResults([]);
        }

        return () => {
            if (debounceTimeout.current) {
                clearTimeout(debounceTimeout.current);
            }
        };
    }, [searchTerm, handleSearch]);

    const handleSelect = (userToToggle: User) => {
        const newSelection = selected.includes(userToToggle.id)
            ? selected.filter(id => id !== userToToggle.id)
            : [...selected, userToToggle.id];
        onChange(newSelection);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start h-auto min-h-10">
                    <div className="flex flex-wrap items-center gap-2">
                        <Users className="mr-2 h-4 w-4" />
                        {selected.length > 0 ? (
                            selectedUsersDetails.map(user => (
                                <Badge key={user.id} variant="secondary">
                                    {user.username}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleSelect(user);
                                        }}
                                        className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                    >
                                        <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                    </button>
                                </Badge>
                            ))
                        ) : "Selecione os usuários..."}
                    </div>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                    <CommandInput
                        placeholder="Buscar usuário por nome..."
                        value={searchTerm}
                        onValueChange={setSearchTerm}
                    />
                    <CommandList>
                        {isSearching && <CommandEmpty>Buscando...</CommandEmpty>}
                        {!isSearching && searchResults.length === 0 && searchTerm.length >= 2 && <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>}
                        {!isSearching && searchTerm.length < 2 && <CommandEmpty>Digite 2 ou mais caracteres para buscar.</CommandEmpty>}
                        <CommandGroup>
                            {searchResults.map(user => (
                                <CommandItem
                                    key={user.id}
                                    value={user.username}
                                    onSelect={() => handleSelect(user)}
                                    onMouseDown={(e) => e.preventDefault()}
                                    className="cursor-pointer"
                                >
                                    <Checkbox checked={selected.includes(user.id)} className="mr-2" />
                                    <span>{user.username}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

export function HubUserManagement({ hubs, allUsers, onDataMutated }: HubUserManagementProps) {
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingHub, setEditingHub] = useState<HubUser | null>(null);
  const [hubToDelete, setHubToDelete] = useState<HubUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof hubFormSchema>>({
    resolver: zodResolver(hubFormSchema),
    defaultValues: { name: '', linkedUserIds: [] },
  });

  const handleOpenFormDialog = (hub: HubUser | null) => {
    setEditingHub(hub);
    setAvatarFile(null);
    if (hub) {
      form.reset({ name: hub.name, linkedUserIds: hub.linkedUserIds });
      setAvatarPreview(hub.avatarUrl || null);
    } else {
      form.reset({ name: '', linkedUserIds: [] });
      setAvatarPreview(null);
    }
    setIsFormDialogOpen(true);
  };

  const handleAvatarFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleFormSubmit = async (values: z.infer<typeof hubFormSchema>) => {
    setIsSubmitting(true);
    try {
      let hubId = editingHub?.id;

      const endpoint = editingHub ? `/api/chat/hubs/${editingHub.id}` : '/api/chat/hubs';
      const method = editingHub ? 'PUT' : 'POST';

      const response = await authFetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const responseData = await response.json();
      if (!response.ok) throw new Error(responseData.message);

      if (!editingHub) {
        hubId = responseData.id;
      }
      
      if (avatarFile && hubId) {
        const formData = new FormData();
        formData.append('file', avatarFile);
        const uploadResponse = await authFetch(`/api/chat/hubs/${hubId}/upload-avatar`, {
          method: 'POST',
          body: formData,
        });
        if (!uploadResponse.ok) {
          const uploadError = await uploadResponse.json();
          throw new Error(`Hub salvo, mas o upload do avatar falhou: ${uploadError.message}`);
        }
      }

      toast({ title: 'Sucesso!', description: `Hub ${values.name} ${editingHub ? 'atualizado' : 'criado'}.` });
      setIsFormDialogOpen(false);
      onDataMutated();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteHub = async () => {
    if (!hubToDelete) return;
    setIsSubmitting(true);
    try {
      const response = await authFetch(`/api/chat/hubs/${hubToDelete.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha ao remover o hub.');
      }
      toast({ title: 'Sucesso!', description: 'Hub removido.' });
      onDataMutated();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro ao Apagar', description: error.message });
    }
    setHubToDelete(null);
    setIsSubmitting(false);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Hubs de Comunicação</CardTitle>
          <Button onClick={() => handleOpenFormDialog(null)}><PlusCircle className="mr-2 h-4 w-4" /> Novo Hub</Button>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome do Hub</TableHead>
                  <TableHead>Usuários Responsáveis</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hubs.map((hub) => (
                  <TableRow key={hub.id}>
                    <TableCell className="font-medium flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={hub.avatarUrl ? `${hub.avatarUrl}?t=${new Date().getTime()}` : undefined} />
                        <AvatarFallback>{getInitials(hub.name)}</AvatarFallback>
                      </Avatar>
                      {hub.name}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {hub.linkedUserIds.map(userId => {
                          const user = allUsers.find(u => u.id === userId);
                          return user ? <Badge key={userId} variant="secondary">{user.username}</Badge> : null;
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => handleOpenFormDialog(hub)}><Edit className="mr-2 h-4 w-4" /> Editar</Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => setHubToDelete(hub)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Apagar Hub?</AlertDialogTitle><AlertDialogDesc>Tem a certeza que quer apagar o hub "{hubToDelete?.name}"? Esta ação não pode ser desfeita.</AlertDialogDesc></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDeleteHub} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">Apagar</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>{editingHub ? 'Editar Hub' : 'Adicionar Novo Hub'}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Nome do Hub</FormLabel><FormControl><Input placeholder="Ex: Financeiro, SAC" {...field} /></FormControl><FormMessage /></FormItem> )} />
              <FormItem>
                  <FormLabel>Avatar do Hub</FormLabel>
                  <div className="flex items-center gap-4">
                      <Avatar className="h-20 w-20">
                          <AvatarImage src={avatarPreview || undefined} />
                          <AvatarFallback>{getInitials(form.watch('name'))}</AvatarFallback>
                      </Avatar>
                      <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleAvatarFileSelect} />
                      <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isSubmitting}>
                          {avatarFile ? <CheckCircle className="mr-2 h-4 w-4 text-green-500" /> : <Upload className="mr-2 h-4 w-4" />}
                          {avatarFile ? 'Imagem Selecionada' : 'Carregar Imagem'}
                      </Button>
                  </div>
              </FormItem>
              <FormField control={form.control} name="linkedUserIds" render={({ field }) => (
                <FormItem>
                    <FormLabel>Usuários Responsáveis</FormLabel>
                    <MultiSelectUsers users={allUsers} selected={field.value} onChange={field.onChange} />
                    <FormMessage />
                </FormItem>
              )} />
              <DialogFooter className="pt-4">
                <DialogClose asChild><Button type="button" variant="secondary" disabled={isSubmitting}>Cancelar</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingHub ? 'Salvar' : 'Adicionar'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

