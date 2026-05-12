
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
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, PlusCircle, Edit, Trash2 } from 'lucide-react';
import type { OccurrenceType } from '@/lib/types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription as AlertDialogDesc, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { cn } from '@/lib/utils';
import { authFetch } from '@/lib/api-client';

const formSchema = z.object({
  code: z.string().min(1, 'Código é obrigatório.'),
  description: z.string().min(3, 'Descrição deve ter pelo menos 3 caracteres.'),
  blocksOperation: z.boolean().default(false),
});

interface OccurrenceTypeManagementProps {
    occurrenceTypes: OccurrenceType[];
    onDataMutated: () => void;
}

export function OccurrenceTypeManagement({ occurrenceTypes, onDataMutated }: OccurrenceTypeManagementProps) {
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OccurrenceType | null>(null);
  const [itemToDelete, setItemToDelete] = useState<OccurrenceType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const handleOpenFormDialog = (item: OccurrenceType | null) => {
    setEditingItem(item);
    form.reset(item || { code: '', description: '', blocksOperation: false });
    setIsFormDialogOpen(true);
  };

  const handleFormSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
        const endpoint = editingItem ? `/api/occurrences/${editingItem.id}` : '/api/occurrences';
        const method = editingItem ? 'PUT' : 'POST';
        
        const response = await authFetch(endpoint, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(values),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Falha ao salvar o tipo de ocorrência.');
        }

        toast({ title: 'Sucesso!', description: `Tipo de ocorrência ${values.description} ${editingItem ? 'atualizado' : 'adicionado'}.` });
        setIsFormDialogOpen(false);
        onDataMutated();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    setIsSubmitting(true);
    try {
        const response = await authFetch(`/api/occurrences/${itemToDelete.id}`, { method: 'DELETE' });
        if (!response.ok) {
            throw new Error('Falha ao remover o tipo de ocorrência.');
        }
        toast({ title: 'Sucesso!', description: 'Tipo de ocorrência removido.' });
        onDataMutated();
    } catch (error) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível remover o tipo de ocorrência.' });
    }
    setItemToDelete(null);
    setIsSubmitting(false);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Tipos de Ocorrência Registrados</CardTitle>
            <CardDescription>Gerencie os códigos usados no SAC para registrar ocorrências.</CardDescription>
          </div>
          <Button onClick={() => handleOpenFormDialog(null)}><PlusCircle className="mr-2 h-4 w-4" /> Novo Tipo</Button>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Bloqueia Operação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {occurrenceTypes.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono">{item.code}</TableCell>
                    <TableCell className="font-medium">{item.description}</TableCell>
                     <TableCell>
                        <Badge variant={item.blocksOperation ? 'destructive' : 'secondary'}>
                            {item.blocksOperation ? 'Sim' : 'Não'}
                        </Badge>
                     </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="outline" size="sm" onClick={() => handleOpenFormDialog(item)}>
                        <Edit className="mr-2 h-4 w-4" /> Editar
                      </Button>
                      <AlertDialog onOpenChange={() => setItemToDelete(null)}>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => setItemToDelete(item)} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Apagar Tipo de Ocorrência?</AlertDialogTitle>
                            <AlertDialogDesc>Tem a certeza de que quer apagar "{itemToDelete?.description}"? Esta ação não pode ser desfeita.</AlertDialogDesc>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteItem} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">Apagar</AlertDialogAction>
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
            <DialogTitle>{editingItem ? 'Editar Tipo de Ocorrência' : 'Adicionar Novo Tipo'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
              <FormField control={form.control} name="code" render={({ field }) => ( <FormItem><FormLabel>Código</FormLabel><FormControl><Input placeholder="Ex: 01, 53..." {...field} /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Descrição</FormLabel><FormControl><Input placeholder="Ex: Avaria, Extravio" {...field} /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="blocksOperation" render={({ field }) => ( 
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                        <FormLabel>Bloqueia Operação?</FormLabel>
                        <FormDescription>
                            Se ativo, impede o avanço da cotação no fluxo operacional.
                        </FormDescription>
                    </div>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />
              <DialogFooter className="pt-4">
                <DialogClose asChild><Button type="button" variant="secondary" disabled={isSubmitting}>Cancelar</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingItem ? 'Salvar' : 'Adicionar'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
