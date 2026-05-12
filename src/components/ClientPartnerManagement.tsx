"use client";

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Edit, Trash2, Search } from 'lucide-react';
import type { ClientPartner } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { authFetch } from '@/lib/api-client';

const partnerSchema = z.object({
  id: z.string().optional(),
  cnpj: z.string().min(14, 'CNPJ inválido'),
  razaoSocial: z.string().min(3, 'Razão Social é obrigatória'),
  nomeFantasia: z.string().min(1, 'Nome Fantasia é obrigatório'),
  cep: z.string().min(8, 'CEP inválido'),
  endereco: z.string().min(3, 'Endereço é obrigatório'),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().min(2, 'Cidade é obrigatória'),
  estado: z.string().length(2, 'Estado (UF) deve ter 2 letras'),
  telefone: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  inscricaoEstadual: z.string().optional(),
  type: z.enum(['Cliente', 'Fornecedor', 'Ambos']).default('Cliente'),
});

type PartnerFormValues = z.infer<typeof partnerSchema>;

// Formatters
const formatCnpj = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
    .slice(0, 18);
};

const formatCep = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/^(\d{5})(\d)/, '$1-$2')
    .slice(0, 9);
};

export function ClientPartnerManagement() {
  const [partners, setPartners] = useState<ClientPartner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);
  const [isSearchingCep, setIsSearchingCep] = useState(false);
  const { toast } = useToast();

  const form = useForm<PartnerFormValues>({
    resolver: zodResolver(partnerSchema),
    defaultValues: {
      cnpj: '', razaoSocial: '', nomeFantasia: '', cep: '', endereco: '', 
      numero: '', complemento: '', bairro: '', cidade: '', estado: '', 
      telefone: '', email: '', inscricaoEstadual: '', type: 'Cliente'
    }
  });

  const fetchPartners = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('sessionToken');
      const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await authFetch('/api/client-partners', { headers });
      if (res.ok) {
        setPartners(await res.json());
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os parceiros.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  const handleOpenNew = () => {
    form.reset({
      cnpj: '', razaoSocial: '', nomeFantasia: '', cep: '', endereco: '', 
      numero: '', complemento: '', bairro: '', cidade: '', estado: '', 
      telefone: '', email: '', inscricaoEstadual: '', type: 'Cliente'
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (partner: ClientPartner) => {
    form.reset({
      id: partner.id,
      cnpj: partner.cnpj,
      razaoSocial: partner.razaoSocial,
      nomeFantasia: partner.nomeFantasia,
      cep: partner.cep,
      endereco: partner.endereco,
      numero: partner.numero || '',
      complemento: partner.complemento || '',
      bairro: partner.bairro || '',
      cidade: partner.cidade,
      estado: partner.estado,
      telefone: partner.telefone || '',
      email: partner.email || '',
      inscricaoEstadual: partner.inscricaoEstadual || '',
      type: partner.type || 'Cliente',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover este parceiro de negócio?')) return;
    try {
      const token = localStorage.getItem('sessionToken');
      const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await authFetch(`/api/client-partners/${id}`, { method: 'DELETE', headers });
      if (res.ok) {
        toast({ title: 'Sucesso', description: 'Parceiro removido.' });
        fetchPartners();
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao remover.' });
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro na requisição.' });
    }
  };

  const onSubmit = async (values: PartnerFormValues) => {
    setIsSubmitting(true);
    try {
      const isEdit = !!values.id;
      const url = isEdit ? `/api/client-partners/${values.id}` : '/api/client-partners';
      const method = isEdit ? 'PUT' : 'POST';
      const token = localStorage.getItem('sessionToken');
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (res.ok) {
        toast({ title: 'Sucesso', description: `Parceiro ${isEdit ? 'atualizado' : 'cadastrado'} com sucesso.` });
        setIsDialogOpen(false);
        fetchPartners();
      } else {
        const errorData = await res.json();
        toast({ variant: 'destructive', title: 'Erro', description: errorData.message || 'Falha ao salvar parceiro.' });
      }
    } catch (e) {
       toast({ variant: 'destructive', title: 'Erro', description: 'Ocorreu um erro ao salvar o parceiro.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const searchCnpj = async (cnpjString: string) => {
    const rawCnpj = cnpjString.replace(/\D/g, '');
    if (rawCnpj.length !== 14) return;
    
    setIsSearchingCnpj(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${rawCnpj}`);
      if (response.ok) {
        const data = await response.json();
        form.setValue('razaoSocial', data.razao_social);
        form.setValue('nomeFantasia', data.nome_fantasia || data.razao_social);
        form.setValue('cep', formatCep(data.cep || ''));
        form.setValue('endereco', `${data.logradouro}`);
        form.setValue('numero', data.numero || '');
        form.setValue('complemento', data.complemento || '');
        form.setValue('bairro', data.bairro || '');
        form.setValue('cidade', data.municipio || '');
        form.setValue('estado', data.uf || '');
        form.setValue('telefone', data.ddd_telefone_1 || '');
      } else {
        toast({ variant: 'destructive', title: 'CNPJ Não Encontrado', description: 'Verifique se o CNPJ está correto.' });
      }
    } catch (error) {
       toast({ variant: 'destructive', title: 'Erro', description: 'Falha na comunicação com a API de CNPJ.' });
    } finally {
      setIsSearchingCnpj(false);
    }
  };

  const searchCep = async (cepString: string) => {
    const rawCep = cepString.replace(/\D/g, '');
    if (rawCep.length !== 8) return;
    
    setIsSearchingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${rawCep}/json/`);
      if (response.ok) {
        const data = await response.json();
        if (!data.erro) {
            form.setValue('endereco', data.logradouro);
            form.setValue('bairro', data.bairro);
            form.setValue('cidade', data.localidade);
            form.setValue('estado', data.uf);
        } else {
            toast({ variant: 'destructive', title: 'CEP Inválido', description: 'O CEP informado não foi encontrado.' });
        }
      }
    } finally {
      setIsSearchingCep(false);
    }
  };

  const getTypeBadgeColor = (type?: string) => {
      switch(type) {
          case 'Fornecedor': return 'bg-orange-100 text-orange-800 border-orange-200';
          case 'Ambos': return 'bg-purple-100 text-purple-800 border-purple-200';
          case 'Cliente':
          default:
              return 'bg-blue-100 text-blue-800 border-blue-200';
      }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Clientes e Fornecedores</CardTitle>
            <CardDescription>Cadastre seus Principais Parceiros de Negócio.</CardDescription>
          </div>
          <Button onClick={handleOpenNew}>
            <PlusCircle className="mr-2 h-4 w-4" /> Cadastrar Parceiro
          </Button>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Empresa (Razão Social)</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cidade/UF</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                   <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></TableCell></TableRow>
                ) : partners.length > 0 ? (
                  partners.map((partner) => (
                    <TableRow key={partner.id}>
                      <TableCell className="font-medium">{partner.cnpj}</TableCell>
                      <TableCell>
                        <div className="font-medium">{partner.nomeFantasia}</div>
                        <div className="text-xs text-muted-foreground">{partner.razaoSocial}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getTypeBadgeColor(partner.type)}>
                            {partner.type || 'Cliente'}
                        </Badge>
                      </TableCell>
                      <TableCell>{partner.cidade}/{partner.estado}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="outline" size="icon" onClick={() => handleOpenEdit(partner)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="destructive" size="icon" onClick={() => handleDelete(partner.id!)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={5} className="h-24 text-center">Nenhum parceiro cadastrado.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{form.watch('id') ? 'Editar Parceiro' : 'Cadastrar Parceiro'}</DialogTitle>
            <DialogDescription>Preencha os dados do parceiro de negócio. Você pode usar a busca por CNPJ.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form id="partner-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 overflow-y-auto pr-6 flex-grow">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="cnpj" render={({ field }) => (
                  <FormItem>
                    <FormLabel>CNPJ</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                          <Input 
                            placeholder="00.000.000/0000-00" 
                            {...field} 
                            onChange={(e) => field.onChange(formatCnpj(e.target.value))}
                            onBlur={() => searchCnpj(field.value)} 
                          />
                      </FormControl>
                      <Button type="button" variant="outline" size="icon" onClick={() => searchCnpj(field.value)} disabled={isSearchingCnpj}>
                        {isSearchingCnpj ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem>
                      <FormLabel>Tipo de Parceiro</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                          <SelectContent>
                              <SelectItem value="Cliente">Cliente</SelectItem>
                              <SelectItem value="Fornecedor">Fornecedor</SelectItem>
                              <SelectItem value="Ambos">Ambos</SelectItem>
                          </SelectContent>
                      </Select>
                      <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="razaoSocial" render={({ field }) => (
                    <FormItem><FormLabel>Razão Social</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="nomeFantasia" render={({ field }) => (
                    <FormItem><FormLabel>Nome Fantasia</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="cep" render={({ field }) => (
                  <FormItem>
                    <FormLabel>CEP</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                          <Input 
                            placeholder="00000-000" 
                            {...field} 
                            onChange={(e) => field.onChange(formatCep(e.target.value))}
                            onBlur={() => searchCep(field.value)} 
                          />
                      </FormControl>
                      <Button type="button" variant="outline" size="icon" onClick={() => searchCep(field.value)} disabled={isSearchingCep}>
                        {isSearchingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="endereco" render={({ field }) => (
                    <FormItem className="md:col-span-2"><FormLabel>Endereço Logradouro</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField control={form.control} name="numero" render={({ field }) => (
                    <FormItem><FormLabel>Número</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="complemento" render={({ field }) => (
                    <FormItem><FormLabel>Complemento</FormLabel><FormControl><Input placeholder="Opcional" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="bairro" render={({ field }) => (
                    <FormItem><FormLabel>Bairro</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="cidade" render={({ field }) => (
                    <FormItem><FormLabel>Cidade</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="estado" render={({ field }) => (
                    <FormItem><FormLabel>Estado (UF)</FormLabel><FormControl><Input placeholder="SP" maxLength={2} {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField control={form.control} name="telefone" render={({ field }) => (
                    <FormItem><FormLabel>Telefone / Contato</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>E-mail Comercial</FormLabel><FormControl><Input type="email" placeholder="Opcional" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="inscricaoEstadual" render={({ field }) => (
                    <FormItem><FormLabel>Inscrição Estadual</FormLabel><FormControl><Input placeholder="Opcional" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </form>
          </Form>
          <DialogFooter className="pt-4 border-t">
            <DialogClose asChild><Button type="button" variant="ghost">Cancelar</Button></DialogClose>
            <Button type="submit" form="partner-form" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
