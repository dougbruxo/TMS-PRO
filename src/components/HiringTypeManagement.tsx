"use client";

import { useState } from 'react';
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
import { Loader2, PlusCircle, Edit, Trash2 } from 'lucide-react';
import type { HiringType } from '@/lib/types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription as AlertDialogDesc, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { authFetch } from '@/lib/api-client';

const hiringTypeFormSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres.'),
});

interface HiringTypeManagementProps {
    hiringTypes: HiringType[];
    onDataMutated: () => void;
}

export function HiringTypeManagement({ hiringTypes, onDataMutated }: HiringTypeManagementProps) {
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<HiringType | null>(null);
  const [typeToDelete, setTypeToDelete] = useState<HiringType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof hiringTypeFormSchema>>({
    resolver: zodResolver(hiringTypeFormSchema),
  });

  const handleOpenFormDialog = (type: HiringType | null) => {
    setEditingType(type);
    form.reset({ name: type ? type.name : '' });
    setIsFormDialogOpen(true);
  };

  const handleFormSubmit = async (values: z.infer<typeof hiringTypeFormSchema>) => {
    setIsSubmitting(true);
    try {
        const endpoint = editingType ? `/api/hiring-types/${editingType.id}` : '/api/hiring-types';
        const method = editingType ? 'PUT' : 'POST';
        
        const response = await authFetch(endpoint, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(values),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Falha ao salvar o tipo de contratação.');
        }

        toast({ title: 'Sucesso!', description: `Tipo de contratação ${values.name} ${editingType ? 'atualizado' : 'adicionado'}.` });
        setIsFormDialogOpen(false);
        onDataMutated();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDeleteType = async () => {
    if (!typeToDelete) return;
    setIsSubmitting(true);
    try {
        const response = await authFetch(`/api/hiring-types/${typeToDelete.id}`, { method: 'DELETE' });
        if (!response.ok) {
            throw new Error('Falha ao remover o tipo de contratação.');
        }
        toast({ title: 'Sucesso!', description: 'Tipo de contratação removido.' });
        onDataMutated();
    } catch (error) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível remover o tipo de contratação.' });
    }
    setTypeToDelete(null);
    setIsSubmitting(false);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Tipos de Contratação</CardTitle>
            <CardDescription>Gerencie os tipos de contrato para os talentos (ex: CLT, PJ).</CardDescription>
          </div>
          <Button onClick={() => handleOpenFormDialog(null)}><PlusCircle className="mr-2 h-4 w-4" /> Novo Tipo</Button>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hiringTypes.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell className="font-medium">{type.name}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="outline" size="sm" onClick={() => handleOpenFormDialog(type)}><Edit className="mr-2 h-4 w-4" /> Editar</Button>
                      <AlertDialog onOpenChange={() => setTypeToDelete(null)}>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => setTypeToDelete(type)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Apagar Tipo de Contratação?</AlertDialogTitle>
                            <AlertDialogDesc>Tem a certeza de que quer apagar "{typeToDelete?.name}"? Esta ação não pode ser desfeita.</AlertDialogDesc>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteType} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">Apagar</AlertDialogAction>
                          </AlertDialogFooter>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingType ? 'Editar Tipo de Contratação' : 'Adicionar Novo Tipo'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl><Input placeholder="Ex: CLT, PJ, Estágio" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter className="pt-4">
                <DialogClose asChild><Button type="button" variant="secondary" disabled={isSubmitting}>Cancelar</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingType ? 'Salvar' : 'Adicionar'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}