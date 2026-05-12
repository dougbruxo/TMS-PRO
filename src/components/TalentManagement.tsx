
"use client";

import { useState, useEffect } from 'react';
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
import { Loader2, PlusCircle, Edit, Trash2, Percent } from 'lucide-react';
import type { Talent, HiringType, User, UserRole } from '@/lib/types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription as AlertDialogDesc, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ScrollArea } from './ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { format, parseISO } from 'date-fns';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Separator } from './ui/separator';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { useAuth } from '@/hooks/use-auth';

const talentFormSchema = z.object({
  status: z.enum(['Ativo', 'Inativo']).default('Ativo'),
  fullName: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres.'),
  rg: z.string().min(5, 'RG inválido.'),
  cpf: z.string().min(11, 'CPF deve ter pelo menos 11 dígitos.'),
  phone1: z.string().min(10, 'Telefone deve ter pelo menos 10 dígitos.'),
  phone2: z.string().optional(),
  address: z.string().min(10, 'Endereço deve ter pelo menos 10 caracteres.'),
  hireDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Data de contratação inválida." }),
  terminationDate: z.string().optional(),
  pixKey: z.string().min(1, 'Chave PIX é obrigatória.'),
  pixKeyType: z.enum(['CPF/CNPJ', 'Celular', 'E-mail']),
  hiringTypeId: z.string().min(1, 'Tipo de contratação é obrigatório.'),
  jobTitle: z.string().min(3, 'Cargo é obrigatório.'),
  baseSalary: z.coerce.number().min(0, 'Salário base deve ser positivo.'),
  salesBonusPercentage: z.coerce.number().min(0, 'Bônus deve ser positivo.').optional(),
  observations: z.string().optional(),
  // System Access
  accessOption: z.enum(['none', 'create', 'link']).default('none'),
  userId: z.string().optional(),
  email: z.string().optional(),
  password: z.string().optional(),
  role: z.enum(['admin', 'user', 'cliente']).optional(),
}).refine(data => {
    if (data.accessOption === 'create') {
        return !!data.email && !!data.password && !!data.role;
    }
    return true;
}, { message: "E-mail, Palavra-passe e Nível de Acesso são obrigatórios para criar um novo utilizador.", path: ["email"] })
.refine(data => {
    if (data.accessOption === 'link') {
        return !!data.userId;
    }
    return true;
}, { message: "Selecione um utilizador existente para vincular.", path: ["userId"] });

interface TalentManagementProps {
    talents: Talent[];
    hiringTypes: HiringType[];
    users: User[];
    onAdd: (data: any) => Promise<boolean>;
    onUpdate: (id: string, data: Partial<Talent>) => Promise<boolean>;
    onDelete: (id: string) => Promise<boolean>;
    quickEditId?: string;
    onQuickEditComplete?: () => void;
}

export function TalentManagement({ talents, hiringTypes, users, onAdd, onUpdate, onDelete, quickEditId, onQuickEditComplete }: TalentManagementProps) {
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingTalent, setEditingTalent] = useState<Talent | null>(null);
  const [talentToDelete, setTalentToDelete] = useState<Talent | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Handle quickEditId on mount or when talents load
  useEffect(() => {
    if (quickEditId && talents.length > 0 && !editingTalent) {
        const targetTalent = talents.find(t => t.id === quickEditId);
        if (targetTalent) {
            handleOpenFormDialog(targetTalent);
        }
    }
  }, [quickEditId, talents, editingTalent]);

  const isAdmin = user?.role === 'admin';
  const subPerms = user?.subPermissions?.hr || {};
  const canEditTalents = isAdmin || !!subPerms.canEditTalents;
  const canDeleteTalents = isAdmin || !!subPerms.canDeleteTalents;

  const form = useForm<z.infer<typeof talentFormSchema>>({
    resolver: zodResolver(talentFormSchema),
  });

  const watchAccessOption = form.watch('accessOption');

  const handleOpenFormDialog = (talent: Talent | null) => {
    setEditingTalent(talent);
    if (talent) {
        form.reset({
            ...talent,
            salesBonusPercentage: talent.salesBonusPercentage,
            hireDate: format(parseISO(talent.hireDate), 'yyyy-MM-dd'),
            terminationDate: talent.terminationDate ? format(parseISO(talent.terminationDate), 'yyyy-MM-dd') : '',
            accessOption: talent.userId ? 'link' : 'none',
            userId: String(talent.userId || '')
        });
    } else {
        form.reset({
            status: 'Ativo', fullName: '', rg: '', cpf: '', phone1: '', phone2: '',
            address: '', hireDate: format(new Date(), 'yyyy-MM-dd'), terminationDate: '',
            pixKey: '', pixKeyType: 'CPF/CNPJ', hiringTypeId: '', jobTitle: '',
            baseSalary: 0, observations: '', accessOption: 'none',
        });
    }
    setIsFormDialogOpen(true);
  };

  const handleFormSubmit = async (values: z.infer<typeof talentFormSchema>) => {
    setIsSubmitting(true);
    let success = false;
      
    const dataToSave = {
      ...values,
      hireDate: new Date(`${values.hireDate}T12:00:00Z`).toISOString(),
      terminationDate: values.terminationDate 
        ? new Date(`${values.terminationDate}T12:00:00Z`).toISOString() 
        : undefined,
    };

    if (editingTalent) {
      success = await onUpdate(editingTalent.id, dataToSave);
    } else {
      success = await onAdd(dataToSave);
    }

    if (success) {
      setIsFormDialogOpen(false);
    }
    setIsSubmitting(false);
  };

  const handleDeleteTalent = async () => {
    if (!talentToDelete) return;
    setIsSubmitting(true);
    await onDelete(talentToDelete.id);
    setTalentToDelete(null);
    setIsSubmitting(false);
  };
  
  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Talentos Registrados</CardTitle>
            <CardDescription>Visualize e gerencie os funcionários da empresa.</CardDescription>
          </div>
          {canEditTalents && <Button onClick={() => handleOpenFormDialog(null)}><PlusCircle className="mr-2 h-4 w-4" /> Novo Talento</Button>}
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[60vh] border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {talents.map((talent) => (
                  <TableRow key={talent.id}>
                    <TableCell className="font-medium">{talent.fullName}</TableCell>
                    <TableCell>{talent.jobTitle}</TableCell>
                    <TableCell>{talent.phone1}</TableCell>
                    <TableCell>
                      <Badge variant={talent.status === 'Ativo' ? 'default' : 'secondary'} className={talent.status === 'Ativo' ? 'bg-green-600' : ''}>
                        {talent.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {canEditTalents && (
                          <Button variant="outline" size="sm" onClick={() => handleOpenFormDialog(talent)}>
                            <Edit className="mr-2 h-4 w-4" /> Editar
                          </Button>
                      )}
                      {canDeleteTalents && (
                          <AlertDialog onOpenChange={(open) => !open && setTalentToDelete(null)}>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => setTalentToDelete(talent)} className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Apagar Talento?</AlertDialogTitle>
                                <AlertDialogDesc>Tem a certeza de que quer apagar {talentToDelete?.fullName}? Esta ação não pode ser desfeita.</AlertDialogDesc>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteTalent} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">Apagar</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
      
      <Dialog open={isFormDialogOpen} onOpenChange={(val) => {
         setIsFormDialogOpen(val);
         if (!val && onQuickEditComplete) onQuickEditComplete();
      }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingTalent ? 'Editar Talento' : 'Adicionar Novo Talento'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6 max-h-[80vh] overflow-y-auto p-4">
              <Card>
                <CardHeader><CardTitle>Informações Pessoais</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={form.control} name="fullName" render={({ field }) => ( <FormItem><FormLabel>Nome Completo</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                  <div className="grid grid-cols-2 gap-4">
                     <FormField control={form.control} name="rg" render={({ field }) => ( <FormItem><FormLabel>RG</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                     <FormField control={form.control} name="cpf" render={({ field }) => ( <FormItem><FormLabel>CPF</FormLabel><FormControl><Input placeholder="Apenas números" {...field} /></FormControl><FormMessage /></FormItem> )} />
                  </div>
                   <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="phone1" render={({ field }) => ( <FormItem><FormLabel>Telefone 1</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="phone2" render={({ field }) => ( <FormItem><FormLabel>Telefone 2 (Opcional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                  </div>
                  <FormField control={form.control} name="address" render={({ field }) => ( <FormItem><FormLabel>Endereço</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Informações Contratuais e de Pagamento</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={form.control} name="hiringTypeId" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Tipo de Contratação</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {hiringTypes.map(type => <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                     <FormField control={form.control} name="hireDate" render={({ field }) => ( <FormItem><FormLabel>Data de Contratação</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem> )} />
                     <FormField control={form.control} name="terminationDate" render={({ field }) => ( <FormItem><FormLabel>Data de Desligamento (Opc.)</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem> )} />
                  </div>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <FormField control={form.control} name="pixKeyType" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Tipo de Chave PIX</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="CPF/CNPJ">CPF/CNPJ</SelectItem>
                                    <SelectItem value="Celular">Celular</SelectItem>
                                    <SelectItem value="E-mail">E-mail</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                     <FormField control={form.control} name="pixKey" render={({ field }) => ( <FormItem className="md:col-span-2"><FormLabel>Chave PIX</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <FormField control={form.control} name="baseSalary" render={({ field }) => ( <FormItem><FormLabel>Salário Base (R$)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem> )} />
                     <FormField control={form.control} name="jobTitle" render={({ field }) => ( <FormItem><FormLabel>Cargo</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                   </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader><CardTitle>Acesso ao Sistema e Bônus</CardTitle></CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="accessOption"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-col space-y-1"
                          >
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl><RadioGroupItem value="none" /></FormControl>
                              <FormLabel className="font-normal">Não criar acesso de utilizador</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl><RadioGroupItem value="create" /></FormControl>
                              <FormLabel className="font-normal">Criar novo utilizador para este talento</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl><RadioGroupItem value="link" /></FormControl>
                              <FormLabel className="font-normal">Vincular a um utilizador existente</FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {watchAccessOption === 'create' && (
                    <div className="space-y-4 mt-4 p-4 border rounded-md">
                      <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>E-mail</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem> )} />
                      <FormField control={form.control} name="password" render={({ field }) => ( <FormItem><FormLabel>Palavra-passe</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem> )} />
                      <FormField control={form.control} name="role" render={({ field }) => (
                          <FormItem>
                              <FormLabel>Nível de Acesso</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                                  <SelectContent>
                                      <SelectItem value="user">Utilizador</SelectItem>
                                      <SelectItem value="admin">Admin</SelectItem>
                                  </SelectContent>
                              </Select>
                              <FormMessage />
                          </FormItem>
                      )} />
                    </div>
                  )}
                  {watchAccessOption === 'link' && (
                    <div className="space-y-4 mt-4 p-4 border rounded-md">
                      <FormField control={form.control} name="userId" render={({ field }) => (
                          <FormItem>
                              <FormLabel>Utilizador Existente</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl><SelectTrigger><SelectValue placeholder="Selecione um utilizador..." /></SelectTrigger></FormControl>
                                  <SelectContent>
                                      {users.filter(u => u.role !== 'cliente').map(user => <SelectItem key={user.id} value={user.id}>{user.username} ({user.email})</SelectItem>)}
                                  </SelectContent>
                              </Select>
                              <FormMessage />
                          </FormItem>
                      )} />
                    </div>
                  )}

                   {watchAccessOption !== 'none' && (
                       <div className="space-y-4 mt-4 p-4 border rounded-md">
                           <FormField control={form.control} name="salesBonusPercentage" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Bônus de Venda (%)</FormLabel>
                                    <div className="relative">
                                        <FormControl>
                                            <Input type="number" placeholder="Ex: 5" {...field} />
                                        </FormControl>
                                        <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )} />
                       </div>
                   )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Outras Configurações</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <FormField control={form.control} name="status" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                  <SelectItem value="Ativo">Ativo</SelectItem>
                                  <SelectItem value="Inativo">Inativo</SelectItem>
                              </SelectContent>
                          </Select>
                          <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="observations" render={({ field }) => ( <FormItem><FormLabel>Observações</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem> )} />
                </CardContent>
              </Card>

              <DialogFooter className="pt-4">
                <DialogClose asChild><Button type="button" variant="secondary" disabled={isSubmitting}>Cancelar</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingTalent ? 'Salvar Alterações' : 'Adicionar Talento'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
