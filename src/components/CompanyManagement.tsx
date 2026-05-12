
"use client";

import { useState, useMemo, useCallback, useEffect, useRef, ChangeEvent } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Edit, Search, PlusCircle, XCircle, MoreVertical, ToggleLeft, ToggleRight, Loader } from 'lucide-react';
import type { Company } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { authFetch } from '@/lib/api-client';

const companyFormSchema = z.object({
  razaoSocial: z.string().min(2, 'Razão Social ou Nome é obrigatório.').max(60, 'Razão Social não pode exceder 60 caracteres (SEFAZ).'),
  nomeFantasia: z.string().max(60, 'Nome Fantasia não pode exceder 60 caracteres (SEFAZ).').optional(),
  cnpj: z.string().min(1, 'CNPJ/CPF é obrigatório.').refine(value => {
    const cleaned = value.replace(/[^\d]/g, '');
    return cleaned.length === 11 || cleaned.length === 14;
  }, 'Deve ser um CNPJ (14 dígitos) ou CPF (11 dígitos).'),
  endereco: z.string().min(1, 'Endereço é obrigatório.'),
  cidade: z.string().min(1, 'Cidade é obrigatória.'),
  estado: z.string().length(2, 'UF deve ter 2 caracteres.'),
  cep: z.string().min(8, 'CEP deve ter 8 dígitos.'),
  codigo_ibge: z.string().regex(/^\d{7}$/, 'Código IBGE deve conter exatamente 7 dígitos (SEFAZ)'),
  inscricaoEstadual: z.string().max(14, 'IE muito longa.').optional(),
  telefone: z.string().optional(),
  email: z.string().email('E-mail inválido.').optional().or(z.literal('')),
  openingHours: z.string().optional(),
  discountPercentage: z.coerce.number().optional(),
  surchargePercentage: z.coerce.number().optional(),
  isDefaultTdOrigem: z.boolean().default(false),
  isDefaultTdDestino: z.boolean().default(false),
  additionalDays: z.coerce.number().default(0),
  defaultObservations: z.string().optional(),
  contacts: z.array(z.object({
      name: z.string().min(1, 'Nome do contato é obrigatório'),
      email: z.string().email('E-mail inválido').or(z.literal('')),
      phone: z.string().optional(),
  })).default([]),
});

const daysOfWeek = [
    { day: "Segunda-feira", short: "Seg" },
    { day: "Terça-feira", short: "Ter" },
    { day: "Quarta-feira", short: "Qua" },
    { day: "Quinta-feira", short: "Qui" },
    { day: "Sexta-feira", short: "Sex" },
    { day: "Sábado", short: "Sab" },
    { day: "Domingo", short: "Dom" },
];

type DayHour = { day: string; short: string; active: boolean; open: string; close: string; };

const getDefaultHours = (): DayHour[] => daysOfWeek.map(d => ({
    ...d,
    active: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'].includes(d.short),
    open: '08:00',
    close: '18:00'
}));

const parseOpeningHours = (hoursString?: string): DayHour[] => {
    const defaults = getDefaultHours();
    if (!hoursString) return defaults;

    const parsedMap = new Map<string, { open: string, close: string }>();
    hoursString.split(';').forEach(part => {
        const [dayPart, timePart] = part.split(':');
        if (dayPart && timePart) {
            const [open, close] = timePart.trim().split('-');
            if (open && close) {
                parsedMap.set(dayPart.trim(), { open, close });
            }
        }
    });

    if (parsedMap.size === 0) return defaults;

    return daysOfWeek.map(d => {
        const data = parsedMap.get(d.short);
        return data
            ? { ...d, active: true, open: data.open, close: data.close }
            : { ...d, active: false, open: '08:00', close: '18:00' };
    });
};

const serializeOpeningHours = (hours: DayHour[]): string => {
    return hours
        .filter(h => h.active)
        .map(h => `${h.short}: ${h.open}-${h.close}`)
        .join('; ');
};


const COMPANIES_PER_PAGE = 20;

export function CompanyManagement({ quickEditId, onQuickEditComplete, hideList }: { quickEditId?: string, onQuickEditComplete?: () => void, hideList?: boolean }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { fetchAddressByCnpj } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Company[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [structuredOpeningHours, setStructuredOpeningHours] = useState<DayHour[]>(getDefaultHours());

  const form = useForm<z.infer<typeof companyFormSchema>>({
    resolver: zodResolver(companyFormSchema),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "contacts"
  });

  const fetchCompanies = async (pageNum: number, refresh = false) => {
    setIsLoading(true);
    try {
      const response = await authFetch(`/api/customers?page=${pageNum}&limit=${COMPANIES_PER_PAGE}`);
      if (response.ok) {
        const data = await response.json();
        const customerList = data.customers || data;
        setCompanies(prev => refresh ? customerList : [...prev, ...customerList]);
        setHasMore(customerList.length === COMPANIES_PER_PAGE);

        // Auto-trigger Quick Edit if provided
        if (quickEditId && !editingCompany) {
           const target = customerList.find((c: any) => c.id === quickEditId);
           if (target) {
              handleOpenFormDialog(target);
           } else if (refresh) {
              // Se não achou na primeira página, buscar especificamente se for quickEdit
              const resSingle = await authFetch(`/api/customers/${quickEditId}`);
              if (resSingle.ok) {
                const single = await resSingle.json();
                handleOpenFormDialog(single);
              }
           }
        }
      } else {
        setHasMore(false);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os clientes.' });
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro de Rede', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const onDataMutated = useCallback(() => {
    setPage(1);
    setSearchResults(null);
    setSearchTerm('');
    fetchCompanies(1, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchCompanies(1, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchCompanies(nextPage);
  };
  
  const companiesToDisplay = useMemo(() => {
    return searchResults !== null ? searchResults : companies;
  }, [companies, searchResults]);

  const handleOpenFormDialog = (company: Company | null) => {
    setEditingCompany(company);
    if (company) {
      form.reset({
        ...company,
        razaoSocial: company.razaoSocial || '',
        nomeFantasia: company.nomeFantasia || '',
        cnpj: company.cnpj || '',
        endereco: company.endereco || '',
        cidade: company.cidade || '',
        estado: company.estado || '',
        cep: company.cep || '',
        codigo_ibge: company.codigo_ibge || '',
        inscricaoEstadual: company.inscricaoEstadual || '',
        telefone: company.telefone || '',
        email: company.email || '',
        openingHours: company.openingHours || '',
        discountPercentage: (company.discountPercentage || 0) * 100,
        surchargePercentage: (company.surchargePercentage || 0) * 100,
        isDefaultTdOrigem: company.isDefaultTdOrigem || false,
        isDefaultTdDestino: company.isDefaultTdDestino || false,
        additionalDays: company.additionalDays || 0,
        defaultObservations: company.defaultObservations || '',
        contacts: company.contacts || [],
      });
      setStructuredOpeningHours(parseOpeningHours(company.openingHours));
    } else {
      form.reset({
        razaoSocial: '',
        nomeFantasia: '',
        cnpj: '',
        endereco: '',
        cidade: '',
        estado: '',
        cep: '',
        codigo_ibge: '',
        inscricaoEstadual: '',
        telefone: '',
        email: '',
        openingHours: '',
        discountPercentage: 0,
        surchargePercentage: 0,
        isDefaultTdOrigem: false,
        isDefaultTdDestino: false,
        additionalDays: 0,
        defaultObservations: '',
        contacts: [],
      });
      setStructuredOpeningHours(getDefaultHours());
    }
    setIsFormDialogOpen(true);
  };
  
  const handleCnpjLookup = async (cnpj: string) => {
    const cleanCnpj = cnpj.replace(/[^\d]/g, '');
    if (cleanCnpj.length !== 14) return;
    setIsSubmitting(true);
    const data = await fetchAddressByCnpj(cleanCnpj);
    if (data) {
        form.setValue('razaoSocial', data.razaoSocial || '');
        form.setValue('nomeFantasia', data.nomeFantasia || data.razaoSocial || '');
        form.setValue('endereco', data.endereco || '');
        form.setValue('cidade', data.city || '');
        form.setValue('estado', data.state || '');
        form.setValue('cep', data.cep || '');
        form.setValue('codigo_ibge', String(data.codigo_ibge || ''));
        form.setValue('telefone', data.telefone || '');
        form.setValue('email', data.email || '');
        if (data.openingHours) { 
             setStructuredOpeningHours(parseOpeningHours(data.openingHours));
        }
        toast({ title: 'Dados Encontrados', description: 'Os dados da empresa foram preenchidos.' });
    }
    setIsSubmitting(false);
  }

  const onInvalid = (errors: any) => {
    console.error('Erros de validação do formulário:', errors);
    const errorMessages = Object.values(errors).map((e: any) => `- ${e.message}`).join('\n');
    toast({
        variant: 'destructive',
        title: 'Formulário Inválido',
        description: `Por favor, corrija os erros:\n${errorMessages}`,
        duration: 7000,
    });
  };

  const handleFormSubmit = async (values: z.infer<typeof companyFormSchema>) => {
    setIsSubmitting(true);
    const dataToSave = { 
        ...values, 
        cnpj: values.cnpj.replace(/[^\d]/g, ''),
        inscricaoEstadual: values.inscricaoEstadual?.toUpperCase().trim() === 'ISENTO' ? 'ISENTO' : values.inscricaoEstadual?.replace(/[^\d]/g, ''),
        openingHours: serializeOpeningHours(structuredOpeningHours),
        discountPercentage: (values.discountPercentage || 0) / 100,
        surchargePercentage: (values.surchargePercentage || 0) / 100,
    };

    try {
      const endpoint = editingCompany ? `/api/customers/${editingCompany.id}` : '/api/customers';
      const method = editingCompany ? 'PUT' : 'POST';
      const response = await authFetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave),
      });
      
      if (!response.ok) {
        let errorMessage = `Falha ao ${editingCompany ? 'atualizar' : 'salvar'} cliente.`;
        try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
        } catch (jsonError) {
            errorMessage = `${errorMessage} (Status: ${response.status} ${response.statusText})`;
        }
        throw new Error(errorMessage);
      }

      toast({ title: 'Sucesso!', description: `Cliente ${values.razaoSocial} ${editingCompany ? 'atualizado' : 'salvo'}.` });
      setIsFormDialogOpen(false);
      onDataMutated();
      if (onQuickEditComplete) onQuickEditComplete();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (company: Company) => {
    setIsSubmitting(true);
    try {
      const response = await authFetch(`/api/customers/${company.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disabled: !company.disabled })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha ao atualizar o status do cliente.');
      }
      toast({ title: 'Sucesso!', description: `Status do cliente ${company.razaoSocial} atualizado.` });
      onDataMutated();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) {
        setSearchResults(null);
        return;
    }
    setIsSearching(true);
    try {
        const response = await authFetch(`/api/customers/search?term=${encodeURIComponent(searchTerm)}`);
        if (response.ok) {
            const results = await response.json();
            setSearchResults(results);
            if (results.length === 0) {
                toast({ title: 'Nenhum resultado', description: 'Nenhum cliente encontrado.' });
            }
        } else {
            toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao buscar clientes.' });
        }
    } catch (error) {
        toast({ variant: 'destructive', title: 'Erro de Rede', description: 'Não foi possível conectar ao servidor.' });
    } finally {
        setIsSearching(false);
    }
  };
    
  const clearSearch = () => {
      setSearchTerm('');
      setSearchResults(null);
  };
  
  const handleDayToggle = (index: number, checked: boolean) => {
    const newHours = [...structuredOpeningHours];
    newHours[index].active = checked;
    setStructuredOpeningHours(newHours);
  };

  const handleTimeChange = (index: number, type: 'open' | 'close', value: string) => {
    const newHours = [...structuredOpeningHours];
    newHours[index][type] = value;
    setStructuredOpeningHours(newHours);
  };


  return (
    <div className={cn("relative w-full", quickEditId ? "hidden" : "block")}>
      {!hideList && (
        <Card>
          <CardHeader>
            <div className="flex-row items-center justify-between">
              <div>
                <CardTitle>Clientes Cadastrados</CardTitle>
                <CardDescription>Gerencie seus clientes e parceiros.</CardDescription>
              </div>
               <form onSubmit={handleSearch} className="flex w-full items-center space-x-2 mt-4">
                  <div className="relative flex-grow">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                      placeholder="Pesquisar por código, nome, CNPJ/CPF..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="pl-10"
                      disabled={isSearching}
                      />
                  </div>
                  {searchResults !== null && (
                  <Button type="button" variant="ghost" onClick={clearSearch}>
                      <XCircle className="mr-2 h-4 w-4"/>
                      Limpar Busca
                  </Button>
                  )}
                  <Button type="submit" disabled={isSearching}>
                      {isSearching ? <Loader2 className="h-4 w-4 animate-spin"/> : <Search className="h-4 w-4"/>}
                  </Button>
                   <Button onClick={() => handleOpenFormDialog(null)}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Novo Cliente
                  </Button>
               </form>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Razão Social / Nome</TableHead>
                      <TableHead>CNPJ / CPF</TableHead>
                      <TableHead>Cidade/UF</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companiesToDisplay.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell className="font-mono">{company.code}</TableCell>
                      <TableCell className="font-medium">{company.razaoSocial}</TableCell>
                      <TableCell>{company.cnpj}</TableCell>
                      <TableCell>{company.cidade}/{company.estado}</TableCell>
                      <TableCell>
                        <Badge variant={company.disabled ? 'destructive' : 'default'} className={cn(!company.disabled && 'bg-green-600')}>
                          {company.disabled ? 'Inativo' : 'Ativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                          <DropdownMenu modal={false}>
                              <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                      <MoreVertical className="h-4 w-4" />
                                      <span className="sr-only">Ações</span>
                                  </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                  <DropdownMenuItem onSelect={() => handleOpenFormDialog(company)}>
                                      <Edit className="mr-2 h-4 w-4" />
                                      <span>Editar</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => handleToggleStatus(company)}>
                                      {company.disabled ? (
                                          <ToggleRight className="mr-2 h-4 w-4" />
                                      ) : (
                                          <ToggleLeft className="mr-2 h-4 w-4" />
                                      )}
                                      <span>{company.disabled ? 'Ativar' : 'Desativar'}</span>
                                  </DropdownMenuItem>
                              </DropdownMenuContent>
                          </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                   {(isLoading || isSearching) && (
                      <TableRow>
                          <TableCell colSpan={6} className="text-center">
                              <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                          </TableCell>
                      </TableRow>
                  )}
                   {companiesToDisplay.length === 0 && !isLoading && !isSearching && (
                      <TableRow>
                          <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                              Nenhum cliente cadastrado.
                          </TableCell>
                      </TableRow>
                  )}
                </TableBody>
              </Table>
              {hasMore && !isLoading && searchResults === null && (
                <div className="p-4 text-center">
                    <Button onClick={handleLoadMore} variant="outline">Carregar Mais</Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      <Dialog open={isFormDialogOpen} onOpenChange={(val) => {
         setIsFormDialogOpen(val);
         if (!val && onQuickEditComplete) onQuickEditComplete(); 
      }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingCompany ? 'Editar Dados do Cliente' : 'Adicionar Novo Cliente'}</DialogTitle>
             {editingCompany && <DialogDescription>Código do Cliente: {editingCompany.code}</DialogDescription>}
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit, onInvalid)} className="space-y-6 max-h-[80vh] overflow-y-auto p-4">
              <FormField control={form.control} name="cnpj" render={({ field }) => (
                  <FormItem>
                      <FormLabel>CNPJ / CPF</FormLabel>
                      <div className="flex gap-2">
                        <FormControl><Input placeholder="Digite o CNPJ para buscar dados" {...field} /></FormControl>
                        <Button type="button" onClick={() => handleCnpjLookup(field.value)} disabled={isSubmitting || (form.getValues('cnpj') || '').replace(/[^\d]/g, '').length !== 14}>
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Search className="h-4 w-4"/>}
                        </Button>
                      </div>
                      <FormMessage />
                  </FormItem>
              )} />
              <FormField control={form.control} name="razaoSocial" render={({ field }) => ( <FormItem><FormLabel>Razão Social / Nome</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="nomeFantasia" render={({ field }) => ( <FormItem><FormLabel>Nome Fantasia (Opcional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="inscricaoEstadual" render={({ field }) => ( <FormItem><FormLabel>Inscrição Estadual (Opcional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="endereco" render={({ field }) => ( 
                <FormItem>
                  <FormLabel>Endereço Completo <span className="text-muted-foreground font-normal">(Requisito SEFAZ: Logradouro, Número - Bairro)</span></FormLabel>
                  <FormControl><Textarea placeholder="Ex: Rua das Flores, 123 - Centro" {...field} /></FormControl>
                  <FormMessage />
                </FormItem> 
              )} />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <FormField control={form.control} name="cidade" render={({ field }) => ( <FormItem className="md:col-span-2"><FormLabel>Cidade</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="estado" render={({ field }) => ( <FormItem><FormLabel>UF</FormLabel><FormControl><Input maxLength={2} {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="cep" render={({ field }) => ( <FormItem><FormLabel>CEP</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="codigo_ibge" render={({ field }) => ( <FormItem><FormLabel>Código IBGE (SEFAZ)</FormLabel><FormControl><Input maxLength={7} placeholder="Ex: 3550308" {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="telefone" render={({ field }) => ( <FormItem><FormLabel>Telefone (Opcional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>E-mail (Opcional)</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem> )} />
              </div>

               <div className="space-y-4">
                  <Label>Horário de Funcionamento</Label>
                  <div className="space-y-2 p-3 border rounded-md">
                      {daysOfWeek.map((day, index) => (
                          <div key={day.short} className="flex items-center gap-4 justify-between">
                              <div className="flex items-center gap-2">
                                  <Checkbox
                                      id={`day-${day.short}`}
                                      checked={structuredOpeningHours[index].active}
                                      onCheckedChange={(checked) => handleDayToggle(index, !!checked)}
                                  />
                                  <Label htmlFor={`day-${day.short}`} className="font-semibold w-8">{day.short}</Label>
                              </div>
                              <div className="flex items-center gap-2">
                                  <Input
                                      type="time"
                                      value={structuredOpeningHours[index].open}
                                      disabled={!structuredOpeningHours[index].active}
                                      onChange={(e) => handleTimeChange(index, 'open', e.target.value)}
                                      className="h-8 w-28"
                                  />
                                  <span className={cn('text-muted-foreground', !structuredOpeningHours[index].active && 'opacity-50')}>até</span>
                                  <Input
                                      type="time"
                                      value={structuredOpeningHours[index].close}
                                      disabled={!structuredOpeningHours[index].active}
                                      onChange={(e) => handleTimeChange(index, 'close', e.target.value)}
                                      className="h-8 w-28"
                                  />
                              </div>
                          </div>
                      ))}
                  </div>
              </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="discountPercentage" render={({ field }) => ( <FormItem><FormLabel>Desconto Padrão (%)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="surchargePercentage" render={({ field }) => ( <FormItem><FormLabel>Taxa Extra Padrão (%)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
              </div>

              <div className="space-y-4 border-t pt-6">
                  <div className="flex items-center justify-between">
                      <Label className="text-lg font-bold">Responsáveis Solicitantes</Label>
                      <Button type="button" variant="outline" size="sm" onClick={() => append({ name: '', email: '', phone: '' })}>
                          <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Responsável
                      </Button>
                  </div>
                  <div className="space-y-4">
                      {fields.map((field, index) => (
                          <div key={field.id} className="grid grid-cols-1 md:grid-cols-10 gap-4 p-4 border rounded-md relative items-end">
                              <div className="md:col-span-3">
                                  <FormField control={form.control} name={`contacts.${index}.name`} render={({ field }) => (
                                      <FormItem><FormLabel>Nome</FormLabel><FormControl><Input placeholder="Nome do Responsável" {...field} /></FormControl><FormMessage /></FormItem>
                                  )} />
                              </div>
                              <div className="md:col-span-3">
                                  <FormField control={form.control} name={`contacts.${index}.email`} render={({ field }) => (
                                      <FormItem><FormLabel>E-mail</FormLabel><FormControl><Input type="email" placeholder="email@exemplo.com" {...field} /></FormControl><FormMessage /></FormItem>
                                  )} />
                              </div>
                              <div className="md:col-span-3">
                                  <FormField control={form.control} name={`contacts.${index}.phone`} render={({ field }) => (
                                      <FormItem><FormLabel>Telefone / WhatsApp</FormLabel><FormControl><Input placeholder="(00) 00000-0000" {...field} /></FormControl><FormMessage /></FormItem>
                                  )} />
                              </div>
                              <div className="md:col-span-1 flex justify-center pb-2">
                                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-destructive h-10 w-10">
                                      <XCircle className="h-5 w-5" />
                                  </Button>
                              </div>
                          </div>
                      ))}
                      {fields.length === 0 && (
                          <div className="text-center p-4 border border-dashed rounded-md text-muted-foreground">
                              Nenhum responsável cadastrado.
                          </div>
                      )}
                  </div>
              </div>

              <div className="space-y-4 border-t pt-6">
                  <Label className="text-lg font-bold">Configurações de Cotação</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                          <Label>Automações de TD (Taxa de Dificuldade)</Label>
                          <FormField control={form.control} name="isDefaultTdOrigem" render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                  <div className="space-y-1 leading-none">
                                      <FormLabel>TD Origem Automático</FormLabel>
                                      <p className="text-xs text-muted-foreground">Marcar automaticamente quando este cliente for Remetente.</p>
                                  </div>
                              </FormItem>
                          )} />
                          <FormField control={form.control} name="isDefaultTdDestino" render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                  <div className="space-y-1 leading-none">
                                      <FormLabel>TD Destino Automático</FormLabel>
                                      <p className="text-xs text-muted-foreground">Marcar automaticamente quando este cliente for Destinatário.</p>
                                  </div>
                              </FormItem>
                          )} />
                      </div>
                      <div className="space-y-4">
                          <FormField control={form.control} name="additionalDays" render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Prazo Adicional (Dias)</FormLabel>
                                  <FormControl><Input type="number" placeholder="Ex: 2 ou -1" {...field} /></FormControl>
                                  <p className="text-xs text-muted-foreground">Dias extras (ou a menos) adicionados ao prazo padrão.</p>
                                  <FormMessage />
                              </FormItem>
                          )} />
                      </div>
                  </div>
                  <FormField control={form.control} name="defaultObservations" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Observações Padrão para Cotação</FormLabel>
                          <FormControl><Textarea placeholder="Observações que serão carregadas automaticamente nas cotações deste cliente." {...field} /></FormControl>
                          <FormMessage />
                      </FormItem>
                  )} />
              </div>
              <DialogFooter className="pt-4">
                <DialogClose asChild><Button type="button" variant="secondary" disabled={isSubmitting}>Cancelar</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
