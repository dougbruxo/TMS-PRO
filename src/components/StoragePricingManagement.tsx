"use client";

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, PlusCircle, Trash2, Search, LayoutGrid } from 'lucide-react';
import { StoragePricingSettings, StockPosition } from '@/lib/types';
import { authFetch } from '@/lib/api-client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from './ui/badge';
import { Label } from '@/components/ui/label';

// O schema permite receber números ou strings que serão convertidas internamente, 
// mas o componente UI usará Number.
const pricingSchema = z.object({
  pricePerPosition: z.coerce.number().min(0, "O preço não pode ser negativo"),
  weightPricePerKg: z.coerce.number().min(0, "O preço não pode ser negativo"),
  cbmPrice: z.coerce.number().min(0, "O preço não pode ser negativo"),
  unloadingRate: z.coerce.number().min(0, "A taxa não pode ser negativa"),
  pickingRate: z.coerce.number().min(0, "A taxa não pode ser negativa").optional(),
  packingRate: z.coerce.number().min(0, "A taxa não pode ser negativa").optional(),
});

type PricingFormValues = z.infer<typeof pricingSchema>;

export function StoragePricingManagement() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [positions, setPositions] = useState<StockPosition[]>([]);
  const [isPositionDialogOpen, setIsPositionDialogOpen] = useState(false);
  const [newPositionName, setNewPositionName] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<PricingFormValues>({
    resolver: zodResolver(pricingSchema),
    defaultValues: {
      pricePerPosition: 0,
      weightPricePerKg: 0,
      cbmPrice: 0,
      unloadingRate: 0,
      pickingRate: 0,
      packingRate: 0,
    }
  });

  useEffect(() => {
    fetchSettings();
    fetchPositions();
  }, []);

  const formatCurrencyValue = (value: number | string | undefined) => {
    const numeric = typeof value === 'string' ? (Number(value.replace(/\D/g, '')) / 100) : value;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numeric || 0);
  };

  const parseCurrencyValue = (val: string) => {
    return Number(val.replace(/\D/g, '')) / 100;
  };

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const response = await authFetch('/api/settings/storage-pricing');
      if (response.ok) {
        const data: StoragePricingSettings = await response.json();
        form.reset({
          pricePerPosition: data.pricePerPosition,
          weightPricePerKg: data.weightPricePerKg,
          cbmPrice: data.cbmPrice,
          unloadingRate: data.unloadingRate,
          pickingRate: data.pickingRate || 0,
          packingRate: data.packingRate || 0,
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Falha ao carregar configurações de preço.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPositions = async () => {
    try {
      const response = await authFetch('/api/stock/positions');
      if (response.ok) {
        setPositions(await response.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreatePosition = async () => {
    if (!newPositionName) return;
    setIsSubmitting(true);
    try {
      const response = await authFetch('/api/stock/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPositionName.toUpperCase(), status: 'Vazio' }),
      });

      if (response.ok) {
        toast({ title: 'Sucesso', description: 'Posição criada com sucesso.' });
        setNewPositionName('');
        setIsPositionDialogOpen(false);
        fetchPositions();
      } else {
        const err = await response.json();
        throw new Error(err.message || 'Erro ao criar posição');
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePosition = async (id: string) => {
    setIsDeleting(id);
    try {
      const response = await authFetch(`/api/stock/positions/${id}`, { method: 'DELETE' });
      if (response.ok) {
        toast({ title: 'Sucesso', description: 'Posição removida.' });
        fetchPositions();
      } else {
        const err = await response.json();
        throw new Error(err.message || 'Erro ao remover posição');
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
      setIsDeleting(null);
    }
  };

  const filteredPositions = positions.filter(pos => 
    pos.name.toLowerCase().includes(positionFilter.toLowerCase())
  );

  const statusColors: Record<string, string> = {
    Vazio: 'bg-green-600',
    Ocupado: 'bg-orange-500',
    Manutenção: 'bg-gray-500',
  };

  const onSubmit = async (values: PricingFormValues) => {
    setIsSubmitting(true);
    try {
      const response = await authFetch('/api/settings/storage-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (response.ok) {
        toast({
          title: 'Sucesso',
          description: 'Regras de armazenagem atualizadas.'
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: 'Não foi possível salvar as configurações.'
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Ocorreu um erro na conexão.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="pricing" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto mb-8">
          <TabsTrigger value="pricing" className="gap-2"><Save className="w-4 h-4" /> Regras de Preço</TabsTrigger>
          <TabsTrigger value="positions" className="gap-2"><LayoutGrid className="w-4 h-4" /> Gestão de Posições</TabsTrigger>
        </TabsList>

        <TabsContent value="pricing">
          <Card className="max-w-2xl mx-auto border-primary/10">
            <CardHeader>
              <CardTitle>Regras de Preço de Armazenagem</CardTitle>
              <CardDescription>
                Configure o custo base aplicado nas cotações de armazenamento e portal do cliente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="pricePerPosition"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preço por Posição (Palete)</FormLabel>
                          <FormControl>
                            <Input 
                              type="text" 
                              {...field} 
                              value={formatCurrencyValue(field.value)}
                              onChange={(e) => field.onChange(parseCurrencyValue(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>Valor fixo cobrado por posição ocupada.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="cbmPrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preço por Volume (m³)</FormLabel>
                          <FormControl>
                            <Input 
                              type="text" 
                              {...field} 
                              value={formatCurrencyValue(field.value)}
                              onChange={(e) => field.onChange(parseCurrencyValue(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>Custo base para cálculo por metro cúbico.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="weightPricePerKg"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preço do Peso (Por Kg)</FormLabel>
                          <FormControl>
                            <Input 
                              type="text" 
                              {...field} 
                              value={formatCurrencyValue(field.value)}
                              onChange={(e) => field.onChange(parseCurrencyValue(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>Valor para cálculo de armazenagem por Kg.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="unloadingRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Taxa de Descarga (Fixa)</FormLabel>
                          <FormControl>
                            <Input 
                              type="text" 
                              {...field} 
                              value={formatCurrencyValue(field.value)}
                              onChange={(e) => field.onChange(parseCurrencyValue(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>Taxa incorrida a cada manobra de input/output.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="pickingRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Taxa de Separação (Picking)</FormLabel>
                          <FormControl>
                            <Input 
                              type="text" 
                              {...field} 
                              value={formatCurrencyValue(field.value)}
                              onChange={(e) => field.onChange(parseCurrencyValue(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>Custo por volume/palete na hora de separar.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="packingRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Taxa de Embalagem (Packing)</FormLabel>
                          <FormControl>
                            <Input 
                              type="text" 
                              {...field} 
                              value={formatCurrencyValue(field.value)}
                              onChange={(e) => field.onChange(parseCurrencyValue(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>Custo de material/serviço por volume embalado.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end pt-4 border-t">
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Salvar Regras
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="positions">
          <Card className="max-w-4xl mx-auto border-primary/10">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Infraestrutura de Armazém</CardTitle>
                <CardDescription>Cadastre ou remova localizações físicas de paletes.</CardDescription>
              </div>
              <Button onClick={() => setIsPositionDialogOpen(true)} className="gap-2">
                <PlusCircle className="w-4 h-4" /> Nova Posição
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative max-w-sm mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Filtrar por nome (ex: A1)..." 
                  className="pl-9"
                  value={positionFilter}
                  onChange={(e) => setPositionFilter(e.target.value)}
                />
              </div>

              <div className="border rounded-xl bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Posição</TableHead>
                      <TableHead>Status Atual</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPositions.map((pos) => (
                      <TableRow key={pos.id}>
                        <TableCell className="font-bold">{pos.name}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[pos.status]}>{pos.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10">
                                {isDeleting === pos.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar Exclusão?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Isso removerá permanentemente a localização **{pos.name}** do sistema.
                                  Esta ação falhará se houver itens vinculados.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Voltar</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDeletePosition(pos.id)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Remover permanentemente
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredPositions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                          Nenhuma posição encontrada.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isPositionDialogOpen} onOpenChange={setIsPositionDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Nova Posição de Palete</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Identificador da Posição</Label>
              <Input 
                placeholder="Ex: A1, B12, Z99" 
                value={newPositionName}
                onChange={(e) => setNewPositionName(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleCreatePosition()}
              />
              <p className="text-[11px] text-muted-foreground">
                Dica: Use uma ordem lógica para facilitar a visualização no mapa operacional.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsPositionDialogOpen(false)}>Fechar</Button>
            <Button onClick={handleCreatePosition} disabled={isSubmitting || !newPositionName}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Cadastrar Posição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
