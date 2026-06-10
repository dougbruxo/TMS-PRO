
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, PlusCircle, Edit, Trash2 } from 'lucide-react';
import type { Vehicle } from '@/lib/types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from './ui/badge';
import React from 'react';
import { Skeleton } from './ui/skeleton';
import { authFetch } from '@/lib/api-client';
import { initialVehicles } from '@/lib/data';

const vehicleFormSchema = z.object({
  key: z.string().min(3, 'Chave deve ter pelo menos 3 caracteres.').regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use apenas letras minúsculas, números e hífens."),
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres.'),
  displayName: z.string().min(10, 'Nome de exibição deve ter pelo menos 10 caracteres.'),
  cubagem: z.string().min(1, 'Cubagem é obrigatória.'),
  peso: z.string().min(1, 'Peso é obrigatório.'),
  valorBase: z.coerce.number().min(0, 'Valor base deve ser positivo.'),
  kmGratis: z.coerce.number().min(0, 'KM grátis deve ser positivo.'),
  adicionalKm: z.coerce.number().min(0, 'Adicional por KM deve ser positivo.'),
  disabled: z.boolean().default(false),
  axles: z.coerce.number().min(0, 'N° de eixos deve ser pelo menos 0.').optional(),
  comprimento: z.coerce.number().min(0, 'Comprimento deve ser positivo.').optional(),
  largura: z.coerce.number().min(0, 'Largura deve ser positiva.').optional(),
});

interface VehicleManagementProps {
    vehicles: Vehicle[];
    onDataMutated: () => void;
    isLoading: boolean;
}

export function VehicleManagement({ vehicles, onDataMutated, isLoading }: VehicleManagementProps) {
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const sortedVehicles = useMemo(() => {
    const orderMap: Record<string, number> = {
      'fiorino': 1,
      'van': 2,
      'vuc': 3,
      'toco': 4,
      'truck': 5,
      'bi-truck': 6,
      'carreta': 7,
      'carreta-ls': 8,
      'bi-trem': 9,
      'prancha': 10
    };
    return [...vehicles].sort((a, b) => {
      const orderA = orderMap[a.key] || 99;
      const orderB = orderMap[b.key] || 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.valorBase - b.valorBase;
    });
  }, [vehicles]);

  const [maskedValorBase, setMaskedValorBase] = useState('R$ 0,00');
  const [maskedAdicionalKm, setMaskedAdicionalKm] = useState('R$ 0,00');

  const form = useForm<z.infer<typeof vehicleFormSchema>>({
    resolver: zodResolver(vehicleFormSchema),
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: 'valorBase' | 'adicionalKm') => {
    const rawValue = e.target.value.replace(/\D/g, '');
    const numericValue = Number(rawValue) / 100;
    
    if (fieldName === 'valorBase') {
      setMaskedValorBase(formatCurrency(numericValue));
      form.setValue('valorBase', numericValue, { shouldValidate: true });
    } else if (fieldName === 'adicionalKm') {
      setMaskedAdicionalKm(formatCurrency(numericValue));
      form.setValue('adicionalKm', numericValue, { shouldValidate: true });
    }
  };

  const watchedName = form.watch('name');

  useEffect(() => {
    if (!editingVehicle && watchedName && watchedName.length >= 3) {
      const match = initialVehicles.find(v => 
        v.name.toLowerCase() === watchedName.toLowerCase() ||
        v.key.toLowerCase() === watchedName.toLowerCase()
      );
      if (match) {
        const currentValues = form.getValues();
        if (!currentValues.key) form.setValue('key', match.key);
        if (!currentValues.displayName) form.setValue('displayName', match.displayName);
        if (!currentValues.cubagem) form.setValue('cubagem', match.cubagem);
        if (!currentValues.peso) form.setValue('peso', match.peso);
        if (!currentValues.axles) form.setValue('axles', match.axles || 0);
        if (!currentValues.comprimento) form.setValue('comprimento', match.comprimento);
        if (!currentValues.largura) form.setValue('largura', match.largura);
        
        if (!currentValues.valorBase) {
          form.setValue('valorBase', match.valorBase);
          setMaskedValorBase(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(match.valorBase));
        }
        if (!currentValues.adicionalKm) {
          form.setValue('adicionalKm', match.adicionalKm);
          setMaskedAdicionalKm(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(match.adicionalKm));
        }
        if (!currentValues.kmGratis) form.setValue('kmGratis', match.kmGratis);
      }
    }
  }, [watchedName, editingVehicle, form]);

  const handleOpenFormDialog = (vehicle: Vehicle | null) => {
    setEditingVehicle(vehicle);
    if (vehicle) {
      form.reset(vehicle);
      setMaskedValorBase(formatCurrency(vehicle.valorBase));
      setMaskedAdicionalKm(formatCurrency(vehicle.adicionalKm));
    } else {
      form.reset({
        key: '', name: '', displayName: '', cubagem: '', peso: '',
        valorBase: 0, kmGratis: 0, adicionalKm: 0, disabled: false,
        axles: 0, comprimento: 0, largura: 0,
      });
      setMaskedValorBase(formatCurrency(0));
      setMaskedAdicionalKm(formatCurrency(0));
    }
    setIsFormDialogOpen(true);
  };

  const handleFormSubmit = async (values: z.infer<typeof vehicleFormSchema>) => {
    setIsSubmitting(true);
    try {
        let response;
        if (editingVehicle) {
            response = await authFetch(`/api/vehicles/${editingVehicle.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });
        } else {
             response = await authFetch('/api/vehicles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });
        }
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Falha ao salvar o veículo.');
        }

        toast({ title: 'Sucesso!', description: `Veículo ${values.name} ${editingVehicle ? 'atualizado' : 'criado'}.` });
        setIsFormDialogOpen(false);
        onDataMutated();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    const response = await authFetch(`/api/vehicles/${vehicleId}`, { method: 'DELETE' });
     if (response.ok) {
        toast({ title: 'Sucesso!', description: `Veículo excluído.` });
        onDataMutated();
    } else {
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível excluir o veículo.' });
    }
  };
  
  const handleToggleStatus = async (vehicle: Vehicle) => {
    const response = await authFetch(`/api/vehicles/${vehicle.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disabled: !vehicle.disabled }),
    });

     if (response.ok) {
         toast({
          title: 'Sucesso!',
          description: `Veículo ${vehicle.name} foi ${!vehicle.disabled ? 'desabilitado' : 'habilitado'}.`,
        });
        onDataMutated();
     } else {
         toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível alterar o status do veículo.' });
     }
  }

  const handleRestoreDefaults = async () => {
    setIsSubmitting(true);
    try {
        let updatedCount = 0;
        for (const defaultVehicle of initialVehicles) {
            const existing = vehicles.find(v => 
                v.key === defaultVehicle.key || 
                v.name.toLowerCase() === defaultVehicle.name.toLowerCase()
            );
            if (existing) {
                // Atualiza dimensões e valores se estiverem vazios ou se for explicitamente solicitado
                const response = await authFetch(`/api/vehicles/${existing.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...existing,
                        comprimento: existing.comprimento || defaultVehicle.comprimento,
                        largura: existing.largura || defaultVehicle.largura,
                        valorBase: existing.valorBase || defaultVehicle.valorBase,
                        axles: existing.axles || defaultVehicle.axles,
                        displayName: existing.displayName || defaultVehicle.displayName
                    }),
                });
                if (response.ok) updatedCount++;
            } else {
                // Cria se não existir (ex: Toco)
                const response = await authFetch('/api/vehicles', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(defaultVehicle),
                });
                if (response.ok) updatedCount++;
            }
        }
        toast({ title: 'Sucesso!', description: `${updatedCount} veículos sincronizados com os padrões.` });
        onDataMutated();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao restaurar padrões.' });
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Todos os Veículos</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRestoreDefaults} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                Sincronizar Padrões
            </Button>
            <Button onClick={() => handleOpenFormDialog(null)}><PlusCircle className="mr-2 h-4 w-4" /> Novo Veículo</Button>
          </div>
        </CardHeader>
        <CardContent>
            <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Valor Base</TableHead>
                    <TableHead>Custo Km Extra</TableHead>
                    <TableHead>Eixos</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    Array.from({ length: 5 }).map((_, index) => (
                        <TableRow key={index}>
                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-9 w-24 ml-auto" /></TableCell>
                        </TableRow>
                    ))
                ) : sortedVehicles?.map((vehicle) => (
                <TableRow key={vehicle.id}>
                    <TableCell className="font-medium">{vehicle.name}</TableCell>
                    <TableCell>{formatCurrency(vehicle.valorBase)}</TableCell>
                    <TableCell>{formatCurrency(vehicle.adicionalKm)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {vehicle.axles || 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id={`status-${vehicle.id}`}
                          checked={!vehicle.disabled}
                          onCheckedChange={() => handleToggleStatus(vehicle)}
                          aria-label={vehicle.disabled ? 'Desabilitado' : 'Habilitado'}
                        />
                         <Badge variant={vehicle.disabled ? 'destructive' : 'default'} className={vehicle.disabled ? '' : 'bg-green-600'}>
                          {vehicle.disabled ? 'Inativo' : 'Ativo'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="outline" size="sm" onClick={() => handleOpenFormDialog(vehicle)}>
                          <Edit className="mr-2 h-4 w-4" /> Editar
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Essa ação não pode ser desfeita. Isso irá remover permanentemente o veículo {vehicle.name}.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteVehicle(vehicle.id!)} className="bg-destructive hover:bg-destructive/90">Remover</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                </TableRow>
                ))}
                {!isLoading && vehicles.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                            Nenhum veículo cadastrado.
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
            </Table>
        </CardContent>
      </Card>
      
      <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingVehicle ? 'Editar Veículo' : 'Criar Novo Veículo'}</DialogTitle>
             <DialogDescription>
                {editingVehicle ? 'Faça alterações nos detalhes do veículo.' : 'Preencha os detalhes para adicionar um novo veículo.'}
             </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-4">
              <div className="grid md:grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl><Input placeholder="Ex: Fiorino" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="key" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chave (identificador único)</FormLabel>
                    <FormControl><Input placeholder="Ex: fiorino" {...field} disabled={!!editingVehicle} onChange={(e) => field.onChange(e.target.value.toLowerCase())} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="displayName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome de Exibição (na lista)</FormLabel>
                  <FormControl><Input placeholder="Ex: Fiorino - Até 1,8 Mt, até 700 Kg" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
               <div className="grid md:grid-cols-3 gap-4">
                 <FormField control={form.control} name="cubagem" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Cubagem (m³)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Ex: 2.5" 
                            value={field.value} 
                            onChange={(e) => {
                              const cleaned = e.target.value.replace(/[^0-9.,]/g, '');
                              field.onChange(cleaned);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                 )} />
                 <FormField control={form.control} name="peso" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Peso (Kg)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Ex: 600" 
                            value={field.value} 
                            onChange={(e) => {
                              const cleaned = e.target.value.replace(/[^0-9.,]/g, '');
                              field.onChange(cleaned);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                 )} />
                 <FormField control={form.control} name="axles" render={({ field }) => (
                    <FormItem>
                        <FormLabel>N° de Eixos</FormLabel>
                        <FormControl><Input type="number" placeholder="0" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                 )} />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                 <FormField control={form.control} name="comprimento" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Comprimento da Carroceria (m)</FormLabel>
                        <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                 )} />
                 <FormField control={form.control} name="largura" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Largura da Carroceria (m)</FormLabel>
                        <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                 )} />
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <FormField control={form.control} name="valorBase" render={() => (
                  <FormItem>
                    <FormLabel>Valor Base (R$)</FormLabel>
                    <FormControl><Input value={maskedValorBase} onChange={e => handleCurrencyChange(e, 'valorBase')} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="kmGratis" render={({ field }) => (
                    <FormItem>
                        <FormLabel>KM Grátis</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="adicionalKm" render={() => (
                  <FormItem>
                    <FormLabel>Adicional por KM (R$)</FormLabel>
                    <FormControl><Input value={maskedAdicionalKm} onChange={e => handleCurrencyChange(e, 'adicionalKm')} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              
              <DialogFooter className="pt-4">
                  <DialogClose asChild><Button type="button" variant="secondary" disabled={isSubmitting}>Cancelar</Button></DialogClose>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingVehicle ? 'Salvar Alterações' : 'Criar Veículo'}
                  </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
