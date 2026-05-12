
"use client";

import { useState, useMemo } from 'react';
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
import type { EarningDeductionType } from '@/lib/types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription as AlertDialogDesc, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { authFetch } from '@/lib/api-client';

const formSchema = z.object({
  code: z.string().min(1, 'Código é obrigatório.'),
  name: z.string().min(3, 'Descrição deve ter pelo menos 3 caracteres.'),
  type: z.enum(['Provento', 'Desconto']),
});

interface EarningDeductionManagementProps {
    earningDeductionTypes: EarningDeductionType[];
    onDataMutated: () => void;
}

const baseSalaryItem: EarningDeductionType = {
    id: 'system-base-salary',
    code: '01',
    name: 'Salário Base',
    type: 'Provento',
};

const bonusItem: EarningDeductionType = {
    id: 'system-bonus',
    code: '02',
    name: 'Bônus',
    type: 'Provento',
};

const advanceItem: EarningDeductionType = {
    id: 'system-advance',
    code: '03',
    name: 'Adiantamento',
    type: 'Provento',
};


export function EarningDeductionManagement({ earningDeductionTypes, onDataMutated }: EarningDeductionManagementProps) {
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EarningDeductionType | null>(null);
  const [itemToDelete, setItemToDelete] = useState<EarningDeductionType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const displayItems = useMemo(() => {
    const otherItems = earningDeductionTypes.filter(item => !['01', '02', '03'].includes(item.code));
    return [baseSalaryItem, bonusItem, advanceItem, ...otherItems];
  }, [earningDeductionTypes]);


  const handleOpenFormDialog = (item: EarningDeductionType | null) => {
    setEditingItem(item);
    if (item) {
      form.reset(item);
    } else {
      form.reset({ code: '', name: '', type: 'Provento' });
    }
    setIsFormDialogOpen(true);
  };

  const handleFormSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
        const endpoint = editingItem ? `/api/earnings-deductions/${editingItem.id}` : '/api/earnings-deductions';
        const method = editingItem ? 'PUT' : 'POST';
        
        const response = await authFetch(endpoint, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(values),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Falha ao salvar o item.');
        }

        toast({ title: 'Sucesso!', description: `Item ${values.name} ${editingItem ? 'atualizado' : 'adicionado'}.` });
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
        const response = await authFetch(`/api/earnings-deductions/${itemToDelete.id}`, { method: 'DELETE' });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Falha ao remover o item.');
        }
        toast({ title: 'Sucesso!', description: 'Item removido.' });
        onDataMutated();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Erro ao Apagar', description: error.message });
    }
    setItemToDelete(null);
    setIsSubmitting(false);
  };

  const isSystemItem = (item: EarningDeductionType) => item.id.startsWith('system-');

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Itens de Provento e Desconto</CardTitle>
            <CardDescription>Gerencie os códigos usados na folha de pagamento.</CardDescription>
          </div>
          <Button onClick={() => handleOpenFormDialog(null)}><PlusCircle className="mr-2 h-4 w-4" /> Novo Item</Button>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono">{item.code}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                     <TableCell>
                        <Badge variant={item.type === 'Provento' ? 'default' : 'destructive'} className={cn(item.type === 'Provento' && 'bg-green-600')}>{item.type}</Badge>
                     </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="outline" size="sm" onClick={() => handleOpenFormDialog(item)} disabled={isSystemItem(item)}>
                        <Edit className="mr-2 h-4 w-4" /> Editar
                      </Button>
                      <AlertDialog onOpenChange={(open) => !open && setItemToDelete(null)}>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => setItemToDelete(item)} className="text-destructive hover:text-destructive" disabled={isSystemItem(item)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Apagar Item?</AlertDialogTitle>
                            <AlertDialogDesc>Tem a certeza de que quer apagar "{itemToDelete?.name}"? Esta ação não pode ser desfeita.</AlertDialogDesc>
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
            <DialogTitle>{editingItem ? 'Editar Item' : 'Adicionar Novo Item'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
              <FormField control={form.control} name="code" render={({ field }) => ( <FormItem><FormLabel>Código</FormLabel><FormControl><Input type="number" placeholder="Ex: 02, 53..." {...field} /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Descrição</FormLabel><FormControl><Input placeholder="Ex: Horas Extras, INSS" {...field} /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                            <SelectItem value="Provento">Provento</SelectItem>
                            <SelectItem value="Desconto">Desconto</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
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
