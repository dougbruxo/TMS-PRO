
"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Edit, Trash2, PlusCircle, Upload, Image as ImageIcon, Search } from 'lucide-react';
import type { CompanyProfile } from '@/lib/types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription as AlertDialogDesc, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { authFetch } from '@/lib/api-client';


const companyProfileSchema = z.object({
  logoUrl: z.string().optional(),
  // Fiscal
  cnpj: z.string().min(14, 'CNPJ deve ter 14 dígitos.'),
  inscricaoEstadual: z.string().min(2, 'Obrigatório (Ou ISENTO)'),
  inscricaoMunicipal: z.string().optional(),
  razaoSocial: z.string().min(3, 'Razão Social é obrigatória.'),
  rntrc: z.string().optional(),
  rntrcType: z.enum(['ETC', 'TAC', 'CTC']).optional(),
  endereco: z.string().min(1, 'Endereço é obrigatório.'),
  cidade: z.string().min(1, 'Cidade é obrigatória.'),
  estado: z.string().length(2, 'UF deve ter 2 caracteres.'),
  cep: z.string().min(8, 'CEP deve ter 8 dígitos.'),
  codigo_ibge: z.string().length(7, 'O código IBGE deve ter 7 dígitos.').optional().or(z.literal('')),
  telefone: z.string().optional(),
  email: z.string().email('E-mail inválido.').optional().or(z.literal('')),
  website: z.string().min(1, 'O site é obrigatório.').url('URL do site inválida.'),
  // Financeiro
  banco: z.string().optional(),
  tipoConta: z.enum(['Corrente', 'Poupança']).optional(),
  agencia: z.string().optional(),
  conta: z.string().optional(),
  pixKeyType: z.enum(['Celular', 'E-mail', 'CNPJ', 'Aleatória']).optional(),
  pixKey: z.string().optional(),
  // Seguro de Carga
  insuranceCompany: z.string().optional(),
  insuranceCnpj: z.string().optional(),
  insurancePolicy: z.string().optional(),
  insuranceExpirationRctrc: z.string().optional(),
  insuranceCoverageRctrc: z.coerce.number().optional(),
  // Seguro RC-DC
  insuranceCompanyRcdc: z.string().optional(),
  insuranceCnpjRcdc: z.string().optional(),
  insurancePolicyRcdc: z.string().optional(),
  insuranceExpirationRcdc: z.string().optional(),
  insuranceCoverageRcdc: z.coerce.number().optional(),
  // Seguro RC-V
  insuranceCompanyRcv: z.string().optional(),
  insuranceCnpjRcv: z.string().optional(),
  insurancePolicyRcv: z.string().optional(),
  insuranceExpirationRcv: z.string().optional(),
  isDefault: z.boolean().default(false),
});

const defaultFormValues: z.infer<typeof companyProfileSchema> = {
  logoUrl: '',
  cnpj: '',
  inscricaoEstadual: '',
  inscricaoMunicipal: '',
  razaoSocial: '',
  rntrc: '',
  rntrcType: undefined,
  endereco: '',
  cidade: '',
  estado: '',
  cep: '',
  codigo_ibge: '',
  telefone: '',
  email: '',
  website: 'https://',
  banco: '',
  tipoConta: undefined,
  agencia: '',
  conta: '',
  pixKeyType: undefined,
  pixKey: '',
  insuranceCompany: '',
  insuranceCnpj: '',
  insurancePolicy: '',
  insuranceExpirationRctrc: '',
  insuranceCoverageRctrc: 0,
  insuranceCompanyRcdc: '',
  insuranceCnpjRcdc: '',
  insurancePolicyRcdc: '',
  insuranceExpirationRcdc: '',
  insuranceCoverageRcdc: 0,
  insuranceCompanyRcv: '',
  insuranceCnpjRcv: '',
  insurancePolicyRcv: '',
  insuranceExpirationRcv: '',
  isDefault: false,
};


interface CompanyProfileManagementProps {
    profiles: CompanyProfile[];
    onDataMutated: () => void;
    isFirstLogin: boolean;
}

export function CompanyProfileManagement({ profiles, onDataMutated, isFirstLogin }: CompanyProfileManagementProps) {
  const { fetchAddressByCnpj, refreshCompanyProfile } = useAuth();
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(isFirstLogin && profiles.length === 0);
  const [editingProfile, setEditingProfile] = useState<CompanyProfile | null>(null);
  const [profileToDelete, setProfileToDelete] = useState<CompanyProfile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const form = useForm<z.infer<typeof companyProfileSchema>>({
    resolver: zodResolver(companyProfileSchema),
    defaultValues: defaultFormValues,
  });

  useEffect(() => {
    if (isFirstLogin && profiles.length === 0) {
      handleOpenFormDialog(null);
    }
  }, [isFirstLogin, profiles]);

  const handleOpenFormDialog = (profile: CompanyProfile | null) => {
    setEditingProfile(profile);
    setLogoFile(null);
    setLogoPreview(null);
    if (profile) {
        form.reset({
            ...defaultFormValues,
            ...profile,
        });
        setLogoPreview(profile.logoUrl || null);
    } else {
        form.reset({
            ...defaultFormValues,
            isDefault: isFirstLogin || profiles.length === 0,
        });
    }
    setIsFormDialogOpen(true);
  };
  
  const handleLogoFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCnpjLookup = async () => {
    const cnpj = form.getValues('cnpj')?.replace(/[^\d]/g, '');
    if (!cnpj || cnpj.length !== 14) {
      toast({ variant: 'destructive', title: 'CNPJ Inválido', description: 'Por favor, insira um CNPJ com 14 dígitos.' });
      return;
    }
    setIsSubmitting(true);
    const data = await fetchAddressByCnpj(cnpj);
    if (data) {
      form.setValue('razaoSocial', data.razaoSocial || '');
      form.setValue('endereco', data.endereco || '');
      form.setValue('cidade', data.city || '');
      form.setValue('estado', data.state || '');
      form.setValue('cep', data.cep || '');
      if (data.codigo_ibge) {
          form.setValue('codigo_ibge', data.codigo_ibge);
      }
      form.setValue('telefone', data.telefone || '');
      form.setValue('email', data.email || '');
      toast({ title: 'Dados Encontrados', description: 'Os dados da empresa foram preenchidos.' });
    }
    setIsSubmitting(false);
  };

  const handleInsuranceCnpjLookup = async (type: 'rctrc' | 'rcdc' | 'rcv') => {
    const fieldCnpj = type === 'rctrc' ? 'insuranceCnpj' : (type === 'rcdc' ? 'insuranceCnpjRcdc' : 'insuranceCnpjRcv');
    const fieldName = type === 'rctrc' ? 'insuranceCompany' : (type === 'rcdc' ? 'insuranceCompanyRcdc' : 'insuranceCompanyRcv');
    
    const cnpj = form.getValues(fieldCnpj as any)?.replace(/[^\d]/g, '');
    if (!cnpj || cnpj.length !== 14) {
      toast({ variant: 'destructive', title: 'CNPJ Inválido', description: 'Por favor, insira um CNPJ com 14 dígitos.' });
      return;
    }

    setIsSubmitting(true);
    try {
        const response = await authFetch(`/api/cnpj/${cnpj}`);
        const data = await response.json();
        
        if (response.ok) {
            form.setValue(fieldName as any, data.razaoSocial || '');
            
            // Se veio da API externa (não local), cadastrar em /customers
            if (data.source !== 'local') {
                await authFetch('/api/customers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        razaoSocial: data.razaoSocial,
                        nomeFantasia: data.nomeFantasia || data.razaoSocial,
                        cnpj: data.cnpj,
                        endereco: data.endereco,
                        cidade: data.city,
                        estado: data.state,
                        cep: data.cep,
                        telefone: data.telefone,
                        email: data.email,
                        codigo_ibge: data.codigo_ibge,
                        type: 'partner'
                    }),
                });
                toast({ title: 'Seguradora Cadastrada', description: `${data.razaoSocial} foi adicionada aos parceiros.` });
            } else {
                toast({ title: 'Seguradora Encontrada', description: `Dados recuperados da base local.` });
            }
        } else {
            toast({ variant: 'destructive', title: 'Erro', description: data.message || 'Erro ao consultar CNPJ.' });
        }
    } catch (error) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Falha na comunicação com o servidor.' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleFormSubmit = async (values: z.infer<typeof companyProfileSchema>) => {
    setIsSubmitting(true);
    const dataToSave = { ...values, cnpj: values.cnpj.replace(/[^\d]/g, '') };

    try {
      // 1. Save text data first
      const endpoint = editingProfile ? `/api/company-profile/${editingProfile.id}` : '/api/company-profile';
      const method = editingProfile ? 'PUT' : 'POST';
      const response = await authFetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave),
      });
      const responseData = await response.json();
      if (!response.ok) throw new Error(responseData.message || `Falha ao ${editingProfile ? 'atualizar' : 'salvar'} perfil.`);

      const profileId = editingProfile?.id || responseData.id;

      // 2. If a new logo was selected, upload it now
      if (logoFile && profileId) {
        const formData = new FormData();
        formData.append('file', logoFile);
        formData.append('profileId', profileId);

        const uploadResponse = await authFetch('/api/company-profile/upload-logo', {
            method: 'POST',
            body: formData,
        });

        if (!uploadResponse.ok) {
            const uploadError = await uploadResponse.json();
            throw new Error(uploadError.message || 'Dados salvos, mas falha ao carregar o logótipo.');
        }
      }

      toast({ title: 'Sucesso!', description: `Perfil de empresa ${values.razaoSocial} ${editingProfile ? 'atualizado' : 'salvo'}.` });
      
      onDataMutated();
      await refreshCompanyProfile();

      if (isFirstLogin) {
          router.push('/dashboard');
      } else {
          setIsFormDialogOpen(false);
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProfile = async () => {
    if (!profileToDelete) return;
    setIsSubmitting(true);
    try {
        const response = await authFetch(`/api/company-profile/${profileToDelete.id}`, { method: 'DELETE' });
        const responseData = await response.json();
        if (!response.ok) throw new Error(responseData.message || 'Falha ao remover perfil.');
        toast({ title: 'Sucesso!', description: 'Perfil de empresa removido.' });
        onDataMutated();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Erro ao Apagar', description: error.message });
    } finally {
        setProfileToDelete(null);
        setIsSubmitting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Perfis da Empresa</CardTitle>
            <CardDescription>Gerencie os perfis da sua empresa para emissão de documentos.</CardDescription>
          </div>
          <Button onClick={() => handleOpenFormDialog(null)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Novo Perfil
          </Button>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                    <TableHead>Logótipo</TableHead>
                    <TableHead>Razão Social</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Padrão</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((profile) => (
                  <TableRow key={profile.id}>
                     <TableCell>
                        <Avatar>
                            <AvatarImage src={profile.logoUrl ? `${profile.logoUrl}?t=${new Date().getTime()}` : undefined} />
                            <AvatarFallback><ImageIcon /></AvatarFallback>
                        </Avatar>
                     </TableCell>
                    <TableCell className="font-medium">{profile.razaoSocial}</TableCell>
                    <TableCell>{profile.cnpj}</TableCell>
                    <TableCell>{profile.isDefault ? 'Sim' : 'Não'}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="outline" size="sm" onClick={() => handleOpenFormDialog(profile)}><Edit className="mr-2 h-4 w-4" /> Editar</Button>
                      <AlertDialog onOpenChange={(open) => !open && setProfileToDelete(null)}>
                         <AlertDialogTrigger asChild>
                           <Button variant="ghost" size="icon" onClick={() => setProfileToDelete(profile)} className="text-destructive hover:text-destructive" disabled={profile.isDefault}>
                             <Trash2 className="h-4 w-4" />
                           </Button>
                         </AlertDialogTrigger>
                         <AlertDialogContent>
                           <AlertDialogHeader>
                             <AlertDialogTitle>Apagar Perfil de Empresa?</AlertDialogTitle>
                             <AlertDialogDesc>Tem a certeza de que quer apagar {profileToDelete?.razaoSocial}? Esta ação não pode ser desfeita.</AlertDialogDesc>
                           </AlertDialogHeader>
                           <AlertDialogFooter>
                             <AlertDialogCancel>Cancelar</AlertDialogCancel>
                             <AlertDialogAction onClick={handleDeleteProfile} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">Apagar</AlertDialogAction>
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
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>{editingProfile ? 'Editar Perfil da Empresa' : 'Adicionar Novo Perfil de Empresa'}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6 max-h-[80vh] overflow-y-auto p-4">
              <Card>
                <CardHeader><CardTitle>Dados Fiscais e de Identificação</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <FormItem>
                    <FormLabel>Logótipo da Empresa</FormLabel>
                      <div className="flex items-center gap-4">
                          <Avatar className="h-20 w-20">
                              <AvatarImage src={logoPreview || undefined} />
                              <AvatarFallback><ImageIcon className="h-8 w-8 text-muted-foreground"/></AvatarFallback>
                          </Avatar>
                          <Input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleLogoFileSelect} />
                          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isSubmitting}>
                              <Upload className="h-4 w-4 mr-2"/>
                              {logoPreview ? 'Trocar Logótipo' : 'Carregar Logótipo'}
                          </Button>
                      </div>
                    <FormMessage />
                  </FormItem>
                  <FormField control={form.control} name="cnpj" render={({ field }) => (
                      <FormItem>
                          <FormLabel>CNPJ</FormLabel>
                          <div className="flex items-center gap-2">
                            <FormControl>
                                <Input placeholder="Apenas números" {...field} />
                            </FormControl>
                            <Button type="button" onClick={handleCnpjLookup} disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            </Button>
                          </div>
                          <FormMessage />
                      </FormItem>
                  )} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="razaoSocial" render={({ field }) => ( <FormItem><FormLabel>Razão Social</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="inscricaoEstadual" render={({ field }) => ( <FormItem><FormLabel>Inscrição Estadual (Obrigatório)</FormLabel><FormControl><Input placeholder="Número ou ISENTO" {...field} /></FormControl><FormMessage /></FormItem> )} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={form.control} name="inscricaoMunicipal" render={({ field }) => ( <FormItem><FormLabel>Inscrição Municipal</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="rntrcType" render={({ field }) => ( 
                       <FormItem>
                         <FormLabel>Tipo de RNTRC</FormLabel>
                         <Select onValueChange={field.onChange} value={field.value}>
                           <FormControl><SelectTrigger><SelectValue placeholder="Selecione..."/></SelectTrigger></FormControl>
                           <SelectContent>
                             <SelectItem value="ETC">ETC (Empresa)</SelectItem>
                             <SelectItem value="TAC">TAC (Autônomo)</SelectItem>
                             <SelectItem value="CTC">CTC (Cooperativa)</SelectItem>
                           </SelectContent>
                         </Select>
                         <FormMessage />
                       </FormItem> 
                    )} />
                    <FormField control={form.control} name="rntrc" render={({ field }) => ( 
                      <FormItem>
                        <FormLabel>Número ANTT (RNTRC)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="00000000" 
                            {...field} 
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              field.onChange(val.length > 8 ? val.slice(-8) : val);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem> 
                    )} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                    <FormField control={form.control} name="endereco" render={({ field }) => ( <FormItem><FormLabel>Endereço Completo</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="cidade" render={({ field }) => ( <FormItem><FormLabel>Cidade</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="estado" render={({ field }) => ( <FormItem><FormLabel>UF</FormLabel><FormControl><Input maxLength={2} {...field} /></FormControl><FormMessage /></FormItem> )} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="cep" render={({ field }) => ( <FormItem><FormLabel>CEP</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="codigo_ibge" render={({ field }) => ( <FormItem><FormLabel>Código IBGE (7 dígitos)</FormLabel><FormControl><Input maxLength={7} placeholder="Ex: 3550308" {...field} /></FormControl><FormMessage /></FormItem> )} />
                  </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="telefone" render={({ field }) => ( <FormItem><FormLabel>Telefone (Opcional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>E-mail (Opcional)</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem> )} />
                  </div>
                   <FormField control={form.control} name="website" render={({ field }) => ( <FormItem><FormLabel>Site</FormLabel><FormControl><Input type="url" placeholder="https://..." {...field} /></FormControl><FormMessage /></FormItem> )} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Dados Financeiros</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="banco" render={({ field }) => ( <FormItem><FormLabel>Banco</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="tipoConta" render={({ field }) => ( 
                            <FormItem>
                                <FormLabel>Tipo de Conta</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione..."/></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="Corrente">Corrente</SelectItem>
                                        <SelectItem value="Poupança">Poupança</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem> 
                        )} />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="agencia" render={({ field }) => ( <FormItem><FormLabel>Agência</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="conta" render={({ field }) => ( <FormItem><FormLabel>Conta</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <FormField control={form.control} name="pixKeyType" render={({ field }) => ( 
                          <FormItem>
                              <FormLabel>Tipo de Chave PIX</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl><SelectTrigger><SelectValue placeholder="Selecione..."/></SelectTrigger></FormControl>
                                  <SelectContent>
                                      <SelectItem value="CNPJ">CNPJ</SelectItem>
                                      <SelectItem value="E-mail">E-mail</SelectItem>
                                      <SelectItem value="Celular">Celular</SelectItem>
                                      <SelectItem value="Aleatória">Aleatória</SelectItem>
                                  </SelectContent>
                              </Select>
                              <FormMessage />
                          </FormItem> 
                       )} />
                        <FormField control={form.control} name="pixKey" render={({ field }) => ( <FormItem><FormLabel>Chave PIX</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Seguro de Carga (RCTR-C)</CardTitle>
                  <CardDescription>Seguro obrigatório de responsabilidade civil do transportador.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="insuranceCnpj" render={({ field }) => ( 
                          <FormItem>
                            <FormLabel>CNPJ da Seguradora</FormLabel>
                            <div className="flex items-center gap-2">
                              <FormControl><Input placeholder="Apenas números" {...field} /></FormControl>
                              <Button type="button" size="icon" variant="outline" onClick={() => handleInsuranceCnpjLookup('rctrc')} disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                              </Button>
                            </div>
                            <FormMessage />
                          </FormItem> 
                        )} />
                        <FormField control={form.control} name="insuranceCompany" render={({ field }) => ( <FormItem><FormLabel>Nome da Seguradora</FormLabel><FormControl><Input placeholder="Ex: Porto Seguro" {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="insurancePolicy" render={({ field }) => ( <FormItem><FormLabel>Número da Apólice</FormLabel><FormControl><Input placeholder="Ex: 123456789" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="insuranceExpirationRctrc" render={({ field }) => ( <FormItem><FormLabel>Data de Vencimento</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                    <FormField control={form.control} name="insuranceCoverageRctrc" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor de Cobertura (Limite R$)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="R$ 0,00" 
                            value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(field.value || 0)}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '');
                              field.onChange(Number(value) / 100);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Seguro de Carga (RC-DC)</CardTitle>
                  <CardDescription>Seguro obrigatório contra roubo e desaparecimento (Lei 14.599/2023).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="insuranceCnpjRcdc" render={({ field }) => ( 
                          <FormItem>
                            <FormLabel>CNPJ da Seguradora</FormLabel>
                            <div className="flex items-center gap-2">
                              <FormControl><Input placeholder="Apenas números" {...field} /></FormControl>
                              <Button type="button" size="icon" variant="outline" onClick={() => handleInsuranceCnpjLookup('rcdc')} disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                              </Button>
                            </div>
                            <FormMessage />
                          </FormItem> 
                        )} />
                        <FormField control={form.control} name="insuranceCompanyRcdc" render={({ field }) => ( <FormItem><FormLabel>Nome da Seguradora</FormLabel><FormControl><Input placeholder="Ex: Allianz" {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="insurancePolicyRcdc" render={({ field }) => ( <FormItem><FormLabel>Número da Apólice</FormLabel><FormControl><Input placeholder="Ex: 987654321" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="insuranceExpirationRcdc" render={({ field }) => ( <FormItem><FormLabel>Data de Vencimento</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                    <FormField control={form.control} name="insuranceCoverageRcdc" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor de Cobertura (Limite R$)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="R$ 0,00" 
                            value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(field.value || 0)}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '');
                              field.onChange(Number(value) / 100);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Seguro de Veículo (RC-V)</CardTitle>
                  <CardDescription>Seguro obrigatório de responsabilidade civil contra danos a terceiros.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="insuranceCnpjRcv" render={({ field }) => ( 
                          <FormItem>
                            <FormLabel>CNPJ da Seguradora</FormLabel>
                            <div className="flex items-center gap-2">
                              <FormControl><Input placeholder="Apenas números" {...field} /></FormControl>
                              <Button type="button" size="icon" variant="outline" onClick={() => handleInsuranceCnpjLookup('rcv')} disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                              </Button>
                            </div>
                            <FormMessage />
                          </FormItem> 
                        )} />
                        <FormField control={form.control} name="insuranceCompanyRcv" render={({ field }) => ( <FormItem><FormLabel>Nome da Seguradora</FormLabel><FormControl><Input placeholder="Ex: Bradesco Seguros" {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="insurancePolicyRcv" render={({ field }) => ( <FormItem><FormLabel>Número da Apólice</FormLabel><FormControl><Input placeholder="Ex: 554433221" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="insuranceExpirationRcv" render={({ field }) => ( <FormItem><FormLabel>Data de Vencimento</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                </CardContent>
              </Card>

              <FormField control={form.control} name="isDefault" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Perfil Padrão</FormLabel><FormDescription>Marque para usar os dados deste perfil nos documentos emitidos.</FormDescription></div><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={profiles.length === 0 && !editingProfile} /></FormControl></FormItem>)} />
              
              <DialogFooter className="pt-4">
                <Button type="button" variant="secondary" onClick={() => setIsFormDialogOpen(false)} disabled={isSubmitting}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
