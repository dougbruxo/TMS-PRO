"use client";

import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Edit, Trash2, Search, Star, Upload } from 'lucide-react';
import type { ClientCompany } from '@/lib/types';
import InputMask from 'react-input-mask';
import { authFetch } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';

const companySchema = z.object({
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
  inscricaoEstadual: z.string().optional()
});

type CompanyFormValues = z.infer<typeof companySchema>;

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

export function ClientCompanyManagement() {
  const [companies, setCompanies] = useState<ClientCompany[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);
  const [isSearchingCep, setIsSearchingCep] = useState(false);
  const { toast } = useToast();
  const { refreshCompanyProfile } = useAuth();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingCompanyId, setUploadingCompanyId] = useState<string | null>(null);

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      cnpj: '', razaoSocial: '', nomeFantasia: '', cep: '', endereco: '', 
      numero: '', complemento: '', bairro: '', cidade: '', estado: '', 
      telefone: '', email: '', inscricaoEstadual: ''
    }
  });

  const fetchCompanies = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('sessionToken');
      const res = await authFetch('/api/my-companies', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        setCompanies(await res.json());
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar as empresas.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const handleOpenNew = () => {
    form.reset({
      cnpj: '', razaoSocial: '', nomeFantasia: '', cep: '', endereco: '', 
      numero: '', complemento: '', bairro: '', cidade: '', estado: '', 
      telefone: '', email: '', inscricaoEstadual: ''
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (company: ClientCompany) => {
    form.reset({
      id: company.id,
      cnpj: company.cnpj,
      razaoSocial: company.razaoSocial,
      nomeFantasia: company.nomeFantasia,
      cep: company.cep,
      endereco: company.endereco,
      numero: company.numero || '',
      complemento: company.complemento || '',
      bairro: company.bairro || '',
      cidade: company.cidade,
      estado: company.estado,
      telefone: company.telefone || '',
      email: company.email || '',
      inscricaoEstadual: company.inscricaoEstadual || ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover esta empresa?')) return;
    try {
      const token = localStorage.getItem('sessionToken');
      const res = await authFetch(`/api/my-companies/${id}`, { 
          method: 'DELETE',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {} 
      });
      if (res.ok) {
        toast({ title: 'Sucesso', description: 'Empresa removida.' });
        fetchCompanies();
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao remover.' });
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro na requisição.' });
    }
  };

  const onSubmit = async (values: CompanyFormValues) => {
    setIsSubmitting(true);
    try {
      const isEdit = !!values.id;
      const url = isEdit ? `/api/my-companies/${values.id}` : '/api/my-companies';
      const token = localStorage.getItem('sessionToken');
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await authFetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (res.ok) {
        toast({ title: 'Sucesso', description: `Empresa ${isEdit ? 'atualizada' : 'cadastrada'} com sucesso.` });
        setIsDialogOpen(false);
        fetchCompanies();
      } else {
        const errorData = await res.json();
        toast({ variant: 'destructive', title: 'Erro', description: errorData.message || 'Falha ao salvar empresa.' });
      }
    } catch (e) {
       toast({ variant: 'destructive', title: 'Erro', description: 'Ocorreu um erro ao salvar a empresa.' });
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

  const handleSetDefault = async (company: ClientCompany) => {
    try {
      const token = localStorage.getItem('sessionToken');
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await authFetch(`/api/my-companies/${company.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ isDefault: true }),
      });
      if (res.ok) {
        toast({ title: 'Sucesso', description: 'Empresa definida como padrão para cotações.' });
        fetchCompanies();
        refreshCompanyProfile();
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao definir como padrão.' });
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro na requisição.' });
    }
  };

  const handleUploadClick = (companyId: string) => {
    setUploadingCompanyId(companyId);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingCompanyId) return;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyId', uploadingCompanyId);

      const token = localStorage.getItem('sessionToken');
      const headers: any = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // Usa o endpoint default de client-companies para upload
      const res = await authFetch('/api/client-companies/upload-logo', {
        method: 'POST',
        headers,
        body: formData,
      });

      if (res.ok) {
        toast({ title: 'Sucesso', description: 'Logotipo atualizado com sucesso.' });
        fetchCompanies();
        refreshCompanyProfile(); // Atualiza a barra lateral caso seja a default
      } else {
        const err = await res.json();
        toast({ variant: 'destructive', title: 'Erro', description: err.message || 'Falha ao enviar logotipo.' });
      }
    } catch (error) {
       toast({ variant: 'destructive', title: 'Erro', description: 'Erro de comunicação.' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setUploadingCompanyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <input 
        type="file" 
        accept="image/*" 
        ref={fileInputRef} 
        onChange={handleFileChange}
        className="hidden" 
      />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Minhas Empresas</CardTitle>
            <CardDescription>Gerencie suas filiais e a unidade padrão.</CardDescription>
          </div>
          <Button onClick={handleOpenNew}>
            <PlusCircle className="mr-2 h-4 w-4" /> Cadastrar Empresa
          </Button>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Empresa (Razão Social)</TableHead>
                  <TableHead>Logo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                   <TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></TableCell></TableRow>
                ) : companies.length > 0 ? (
                  companies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell className="font-medium">
                        {company.cnpj}
                        {company.isDefault && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-semibold text-yellow-800 border border-yellow-200">
                            Padrão
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{company.nomeFantasia}</div>
                        <div className="text-xs text-muted-foreground">{company.razaoSocial}</div>
                      </TableCell>
                      <TableCell>{company.cidade}/{company.estado}</TableCell>
                      <TableCell>
                        {company.logoUrl ? (
                          <div className="h-8 w-16 border rounded bg-white flex items-center justify-center p-1">
                            <img src={company.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Sem Logo</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {!company.isDefault && (
                          <Button variant="outline" size="icon" title="Tornar Padrão" onClick={() => handleSetDefault(company)}>
                            <Star className="h-4 w-4 text-muted-foreground hover:text-yellow-500" />
                          </Button>
                        )}
                        <Button variant="outline" size="icon" title="Logo da Marca" onClick={() => handleUploadClick(company.id!)}>
                          <Upload className="h-4 w-4 text-blue-500 hover:text-blue-600" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => handleOpenEdit(company)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="destructive" size="icon" onClick={() => handleDelete(company.id!)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={4} className="h-24 text-center">Nenhuma empresa cadastrada.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{form.watch('id') ? 'Editar Empresa' : 'Cadastrar Empresa'}</DialogTitle>
            <DialogDescription>Preencha os dados da sua empresa. Você pode usar a busca por CNPJ.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form id="company-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 overflow-y-auto pr-6 flex-grow">
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
                <FormField control={form.control} name="inscricaoEstadual" render={({ field }) => (
                    <FormItem><FormLabel>Inscrição Estadual</FormLabel><FormControl><Input placeholder="Opcional" {...field} /></FormControl><FormMessage /></FormItem>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="telefone" render={({ field }) => (
                    <FormItem><FormLabel>Telefone / Contato</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>E-mail Comercial</FormLabel><FormControl><Input type="email" placeholder="Opcional" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </form>
          </Form>
          <DialogFooter className="pt-4 border-t">
            <DialogClose asChild><Button type="button" variant="ghost">Cancelar</Button></DialogClose>
            <Button type="submit" form="company-form" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
