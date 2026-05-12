
"use client";

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, PlusCircle, Search, Edit, Trash2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { authFetch } from '@/lib/api-client';

interface FleetOption {
  id: string;
  code: string;
  name: string;
}

interface FleetOptionsManagerProps {
  optionType: string;
  optionName: string;
  onSelect?: (item: FleetOption) => void;
}

const newItemSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório.'),
});

export function FleetOptionsManager({ optionType, optionName, onSelect }: FleetOptionsManagerProps) {
  const [items, setItems] = useState<FleetOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNewOptionDialogOpen, setIsNewOptionDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<FleetOption | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const newItemForm = useForm<z.infer<typeof newItemSchema>>({
    resolver: zodResolver(newItemSchema),
    defaultValues: { name: '' },
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await authFetch(`/api/fleet-options/${optionType}`);
      if (!res.ok) throw new Error(`Falha ao buscar ${optionName}.`);
      setItems(await res.json());
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setIsLoading(false);
    }
  }, [optionType, optionName, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const lowercasedFilter = searchTerm.toLowerCase();
    return items.filter(item => 
      item.name.toLowerCase().includes(lowercasedFilter) ||
      item.code.toLowerCase().includes(lowercasedFilter)
    );
  }, [items, searchTerm]);

  const handleNewOptionSubmit = async (values: z.infer<typeof newItemSchema>) => {
    setIsSubmitting(true);
    try {
      const res = await authFetch(`/api/fleet-options/${optionType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Falha ao criar item.');
      }
      const newItem = await res.json();
      if(onSelect) {
        onSelect(newItem);
      }
      setIsNewOptionDialogOpen(false);
      toast({ title: 'Sucesso!', description: 'Novo item criado e selecionado.' });
      await fetchData(); // Refresh data in the main component
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    setIsSubmitting(true);
    try {
        const res = await authFetch(`/api/fleet-options/${optionType}/${itemToDelete.id}`, {
            method: 'DELETE'
        });
        if (!res.ok) {
             const errorData = await res.json();
             throw new Error(errorData.message || 'Falha ao apagar o item.');
        }
        toast({ title: 'Sucesso!', description: 'Item apagado.' });
        await fetchData();
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
        setIsSubmitting(false);
        setItemToDelete(null);
    }
  };

  const isSystemItem = (item: FleetOption) => {
    return optionType === 'vehicleTypes' && ['01', '02', '03', '04'].includes(item.code);
  };

  if (onSelect) {
      return (
        <>
            <div className="flex w-full items-center space-x-2 pb-4">
                <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Buscar por código ou nome..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                />
                </div>
                <Button type="button" variant="outline" onClick={() => setIsNewOptionDialogOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Novo
                </Button>
            </div>
            <ScrollArea className="h-72">
                 {isLoading ? (
                    <div className="flex justify-center items-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin"/>
                    </div>
                 ) : filteredItems.map(item => (
                     <div key={item.id} onClick={() => onSelect(item)} className="p-2 hover:bg-accent rounded-md cursor-pointer flex justify-between items-center">
                         <span>{item.code} - {item.name}</span>
                     </div>
                 ))}
                 {!isLoading && filteredItems.length === 0 && (
                     <div className="text-center p-8 text-sm text-muted-foreground">Nenhum item encontrado.</div>
                 )}
            </ScrollArea>

             {/* Nested Dialog for new item */}
            <Dialog open={isNewOptionDialogOpen} onOpenChange={(open) => { if (!open) newItemForm.reset(); setIsNewOptionDialogOpen(open); }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Adicionar Novo Item: {optionName}</DialogTitle>
                    </DialogHeader>
                    <Form {...newItemForm}>
                    <form onSubmit={newItemForm.handleSubmit(handleNewOptionSubmit)} className="space-y-4">
                        <FormField control={newItemForm.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Nome</FormLabel><FormControl><Input placeholder={`Nome do(a) novo(a) ${optionName.slice(0,-1).toLowerCase()}`} {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <DialogFooter className="pt-4">
                        <Button type="button" variant="secondary" onClick={() => setIsNewOptionDialogOpen(false)} disabled={isSubmitting}>Cancelar</Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                            Adicionar Item
                        </Button>
                        </DialogFooter>
                    </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </>
      )
  }

  return (
    <>
      <Card>
        <CardHeader>
           <div className="sm:flex sm:items-center sm:justify-between">
            <div>
              <CardTitle>Gerenciar {optionName}</CardTitle>
              <CardDescription>
                Adicione, edite ou remova itens.
              </CardDescription>
            </div>
             <div className="flex w-full sm:w-auto items-center space-x-2 mt-4 sm:mt-0">
                <div className="relative flex-grow">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button type="button" variant="outline" onClick={() => setIsNewOptionDialogOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Novo
                </Button>
             </div>
           </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-72 border rounded-md">
            {isLoading ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="h-6 w-6 animate-spin"/>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length > 0 ? (
                    filteredItems.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono">{item.code}</TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-right">
                           <Button variant="ghost" size="icon" disabled>
                             <Edit className="h-4 w-4"/>
                           </Button>
                           <AlertDialog>
                             <AlertDialogTrigger asChild>
                               <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" disabled={isSystemItem(item)} onClick={(e) => { e.stopPropagation(); setItemToDelete(item); }}>
                                 <Trash2 className="h-4 w-4"/>
                               </Button>
                             </AlertDialogTrigger>
                             <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Apagar item?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Tem a certeza de que quer apagar o item "{itemToDelete?.name}"?
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={(e) => { e.stopPropagation(); handleDeleteItem(); }} className="bg-destructive hover:bg-destructive/90">Apagar</AlertDialogAction>
                                </AlertDialogFooter>
                             </AlertDialogContent>
                           </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                        Nenhum item encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
      
      {/* Reusing the same dialog for the management page */}
      <Dialog open={isNewOptionDialogOpen} onOpenChange={(open) => { if (!open) newItemForm.reset(); setIsNewOptionDialogOpen(open); }}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Adicionar Novo Item: {optionName}</DialogTitle>
            </DialogHeader>
            <Form {...newItemForm}>
              <form onSubmit={newItemForm.handleSubmit(handleNewOptionSubmit)} className="space-y-4">
                <FormField control={newItemForm.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Nome</FormLabel><FormControl><Input placeholder={`Nome do(a) novo(a) ${optionName.slice(0,-1).toLowerCase()}`} {...field} /></FormControl><FormMessage /></FormItem> )} />
                <DialogFooter className="pt-4">
                  <Button type="button" variant="secondary" onClick={() => setIsNewOptionDialogOpen(false)} disabled={isSubmitting}>Cancelar</Button>
                  <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                      Adicionar Item
                  </Button>
                </DialogFooter>
              </form>
            </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
