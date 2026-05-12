"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
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
import { Loader2, Search, Globe, Upload, Building, Clock, Percent, KeyRound, MoreVertical, Pencil, ToggleRight, ToggleLeft, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { User } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { authFetch } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const operatingHourSchema = z.object({
  active: z.boolean(),
  start: z.string().optional().or(z.literal('')),
  end: z.string().optional().or(z.literal(''))
});

const portalSchema = z.object({
  // Dados Mestre (Login)
  email: z.string().email('E-mail Mestre é obrigatório.'),
  password: z.string().min(6, 'Senha (mín. 6 caracteres)').optional().or(z.literal('')),
  confirmPassword: z.string().optional().or(z.literal('')),
  username: z.string().min(3, 'Nome do Responsável Mestre é obrigatório.'),
  contact: z.string().optional(),
  
  // Dados da Empresa (Identidade Visual & Fiscais)
  cnpj: z.string().min(14, 'CNPJ inválido.'),
  razaoSocial: z.string().min(3, 'Razão Social é obrigatória.'),
  nomeFantasia: z.string().optional(),
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  cep: z.string().optional(),
  inscricaoEstadual: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  telefone: z.string().optional(),

  // Permissões
  freightAccess: z.boolean().default(true),
  myFreightsAccess: z.boolean().default(true),
  noticeBoardAccess: z.boolean().default(true),
  myCompanyAccess: z.boolean().default(true),
  clientPartnersAccess: z.boolean().default(true),
  fracionadoEnabled: z.boolean().default(false),
  armazenagemAccess: z.boolean().default(false),
  quoteArmazenagemAccess: z.boolean().default(false),
  supportUserIds: z.array(z.string()).default([]),

  operatingHours: z.object({
    seg: operatingHourSchema,
    ter: operatingHourSchema,
    qua: operatingHourSchema,
    qui: operatingHourSchema,
    sex: operatingHourSchema,
    sab: operatingHourSchema,
    dom: operatingHourSchema,
  }).optional(),
  
  businessRules: z.object({
    discountPercentage: z.coerce.number().min(0).max(100).default(0),
    extraFeePercentage: z.coerce.number().min(0).default(0),
    extraDays: z.coerce.number().min(0).default(0),
    reducedDays: z.coerce.number().min(0).default(0),
  }).optional(),
}).refine(data => !data.password || data.password === data.confirmPassword, {
  message: "As senhas não coincidem.",
  path: ["confirmPassword"]
});

type Portal = {
  id: string;
  username: string;
  email: string;
  disabled: boolean;
  companyId: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  logoUrl: string | null;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  inscricaoEstadual?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  telefone?: string;
  freightAccess: boolean;
  myFreightsAccess: boolean;
  noticeBoardAccess: boolean;
  myCompanyAccess: boolean;
  clientPartnersAccess: boolean;
  fracionadoEnabled?: boolean;
  armazenagemAccess?: boolean;
  quoteArmazenagemAccess?: boolean;
  operatingHours?: any;
  businessRules?: any;
  supportUserIds?: string[];
  supportUserId?: string; // Legacy single value
};

export function ClientPortalManagement() {
  const [portals, setPortals] = useState<Portal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const { fetchAddressByCnpj } = useAuth();
  const [editingPortal, setEditingPortal] = useState<Portal | null>(null);
  const [supportUsers, setSupportUsers] = useState<User[]>([]);

  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);

  const form = useForm<z.infer<typeof portalSchema>>({
    resolver: zodResolver(portalSchema),
    defaultValues: {
      freightAccess: true,
      myFreightsAccess: true,
      noticeBoardAccess: true,
      myCompanyAccess: true,
      clientPartnersAccess: true,
      fracionadoEnabled: false,
      armazenagemAccess: false,
      quoteArmazenagemAccess: false,
      businessRules: {
        discountPercentage: 0,
        extraFeePercentage: 0,
        extraDays: 0,
        reducedDays: 0,
      },
      operatingHours: {
        seg: { active: true, start: '08:00', end: '18:00' },
        ter: { active: true, start: '08:00', end: '18:00' },
        qua: { active: true, start: '08:00', end: '18:00' },
        qui: { active: true, start: '08:00', end: '18:00' },
        sex: { active: true, start: '08:00', end: '18:00' },
        sab: { active: false, start: '08:00', end: '18:00' },
        dom: { active: false, start: '08:00', end: '18:00' },
      }
    }
  });

  const fetchPortalsAndUsers = async () => {
    setIsLoading(true);
    try {
      const [portalsRes, usersRes] = await Promise.all([
        authFetch('/api/client-portals'),
        authFetch('/api/users')
      ]);
      if (portalsRes.ok) {
        setPortals(await portalsRes.json());
      }
      if (usersRes.ok) {
        const allUsers = await usersRes.json();
        // Filtrar apenas usuários da transportadora (admin ou user/colaborador)
        setSupportUsers(allUsers.filter((u: User) => u.role === 'admin' || (u.role === 'user' && !u.isSubClient)));
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro de conexão' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPortalsAndUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const portalsToDisplay = useMemo(() => {
    if (!searchTerm) return portals;
    const term = searchTerm.toLowerCase();
    return portals.filter(p => 
      p.razaoSocial.toLowerCase().includes(term) || 
      p.cnpj.includes(term) || 
      p.email.toLowerCase().includes(term)
    );
  }, [portals, searchTerm]);

  const handleOpenDialog = (portal: Portal | null = null) => {
    setEditingPortal(portal);
    setSelectedLogoFile(null);
    setLogoPreviewUrl(portal?.logoUrl || null);

    if (!portal) {
      form.reset({
        email: '', password: '', confirmPassword: '', username: '', contact: '', cnpj: '', razaoSocial: '', nomeFantasia: '',
        endereco: '', cidade: '', estado: '', cep: '', inscricaoEstadual: '', numero: '', complemento: '', bairro: '', telefone: '',
        freightAccess: true, myFreightsAccess: true, noticeBoardAccess: true, myCompanyAccess: true, clientPartnersAccess: true, fracionadoEnabled: false, armazenagemAccess: false, quoteArmazenagemAccess: false, supportUserIds: [],
        businessRules: { discountPercentage: 0, extraFeePercentage: 0, extraDays: 0, reducedDays: 0 },
        operatingHours: {
          seg: { active: true, start: '08:00', end: '18:00' },
          ter: { active: true, start: '08:00', end: '18:00' },
          qua: { active: true, start: '08:00', end: '18:00' },
          qui: { active: true, start: '08:00', end: '18:00' },
          sex: { active: true, start: '08:00', end: '18:00' },
          sab: { active: false, start: '08:00', end: '18:00' },
          dom: { active: false, start: '08:00', end: '18:00' },
        }
      });
    } else {
      form.reset({
        email: portal.email,
        username: portal.username,
        cnpj: portal.cnpj,
        razaoSocial: portal.razaoSocial,
        nomeFantasia: portal.nomeFantasia || '',
        endereco: portal.endereco || '',
        cidade: portal.cidade || '',
        estado: portal.estado || '',
        cep: portal.cep || '',
        inscricaoEstadual: portal.inscricaoEstadual || '',
        numero: portal.numero || '',
        complemento: portal.complemento || '',
        bairro: portal.bairro || '',
        telefone: portal.telefone || '',
        freightAccess: portal.freightAccess,
        myFreightsAccess: portal.myFreightsAccess,
        noticeBoardAccess: portal.noticeBoardAccess,
        myCompanyAccess: portal.myCompanyAccess,
        clientPartnersAccess: portal.clientPartnersAccess,
        fracionadoEnabled: portal.fracionadoEnabled || false,
        armazenagemAccess: portal.armazenagemAccess || false,
        quoteArmazenagemAccess: portal.quoteArmazenagemAccess || false,
        supportUserIds: portal.supportUserIds || (portal.supportUserId ? [portal.supportUserId] : []),
        businessRules: portal.businessRules || { discountPercentage: 0, extraFeePercentage: 0, extraDays: 0, reducedDays: 0 },
        operatingHours: portal.operatingHours || {
          seg: { active: true, start: '08:00', end: '18:00' },
          ter: { active: true, start: '08:00', end: '18:00' },
          qua: { active: true, start: '08:00', end: '18:00' },
          qui: { active: true, start: '08:00', end: '18:00' },
          sex: { active: true, start: '08:00', end: '18:00' },
          sab: { active: false, start: '08:00', end: '18:00' },
          dom: { active: false, start: '08:00', end: '18:00' },
        }
      });
    }
    setIsDialogOpen(true);
  };

  const handleCnpjLookup = async (cnpjField: string) => {
    const clean = cnpjField.replace(/[^\d]/g, '');
    if (clean.length !== 14) return;
    setIsSubmitting(true);
    const data = await fetchAddressByCnpj(clean);
    if (data) {
        form.setValue('razaoSocial', data.razaoSocial || '');
        form.setValue('nomeFantasia', data.nomeFantasia || data.razaoSocial || '');
        form.setValue('endereco', data.endereco || '');
        form.setValue('numero', data.numero || '');
        form.setValue('complemento', data.complemento || '');
        form.setValue('bairro', data.bairro || '');
        form.setValue('cidade', data.city || '');
        form.setValue('estado', data.state || '');
        form.setValue('cep', data.cep || '');
        form.setValue('telefone', data.telefone || '');
        toast({ title: 'CNPJ Localizado! Auto-preenchimento aplicado.' });
    }
    setIsSubmitting(false);
  };

  const uploadLogoIfSelected = async (companyId: string) => {
    if (!selectedLogoFile) return;
    const formData = new FormData();
    formData.append('file', selectedLogoFile);
    formData.append('companyId', companyId);
    await authFetch('/api/client-companies/upload-logo', { method: 'POST', body: formData });
  };

  const onSubmit = async (values: z.infer<typeof portalSchema>) => {
    setIsSubmitting(true);
    const cleanedValues = {
        ...values,
        inscricaoEstadual: values.inscricaoEstadual ? values.inscricaoEstadual.replace(/[^\d]/g, '') : '',
        supportUserIds: values.supportUserIds || [],
    };
    
    try {
      if (editingPortal) {
        const putBody: any = {
            // Dados da Empresa (client_companies)
            cnpj: cleanedValues.cnpj,
            razaoSocial: cleanedValues.razaoSocial,
            nomeFantasia: cleanedValues.nomeFantasia,
            endereco: cleanedValues.endereco,
            cidade: cleanedValues.cidade,
            estado: cleanedValues.estado,
            cep: cleanedValues.cep,
            inscricaoEstadual: cleanedValues.inscricaoEstadual,
            numero: cleanedValues.numero,
            complemento: cleanedValues.complemento,
            bairro: cleanedValues.bairro,
            telefone: cleanedValues.telefone,
            // Permissões do Usuário
            freightAccess: cleanedValues.freightAccess,
            myFreightsAccess: cleanedValues.myFreightsAccess,
            noticeBoardAccess: cleanedValues.noticeBoardAccess,
            myCompanyAccess: cleanedValues.myCompanyAccess,
            clientPartnersAccess: cleanedValues.clientPartnersAccess,
            fracionadoEnabled: cleanedValues.fracionadoEnabled,
            armazenagemAccess: cleanedValues.armazenagemAccess,
            quoteArmazenagemAccess: cleanedValues.quoteArmazenagemAccess,
            operatingHours: cleanedValues.operatingHours,
            businessRules: cleanedValues.businessRules,
            supportUserIds: cleanedValues.supportUserIds,
            // Dados do Usuário Master
            username: cleanedValues.username,
            contact: cleanedValues.contact,
            email: cleanedValues.email,
        };
        // Incluir senha apenas se preenchida
        if (cleanedValues.password) {
          putBody.password = cleanedValues.password;
        }
        const response = await authFetch(`/api/client-portals/${editingPortal.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(putBody)
        });
        if (response.ok) {
           await uploadLogoIfSelected(editingPortal.companyId);
           toast({ title: 'Sucesso', description: 'Dados e Permissões B2B atualizadas.' });
           setIsDialogOpen(false);
           fetchPortalsAndUsers();
        } else {
           throw new Error('Falha ao atualizar portal.');
        }
      } else {
        // Criar Novo Portal
        if (!cleanedValues.password) throw new Error("Senha é obrigatória para novos portais.");
        const response = await authFetch('/api/client-portals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cleanedValues)
        });
        
        if (response.ok) {
          const resData = await response.json();
          if (resData.companyId) {
             await uploadLogoIfSelected(resData.companyId);
          }
          toast({ title: 'Portal Cliente provisionado com Sucesso!' });
          setIsDialogOpen(false);
          fetchPortalsAndUsers();
        } else {
           const err = await response.json();
           throw new Error(err.message || 'Erro do servidor');
        }
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Ação Falhou', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (portal: Portal) => {
    setIsSubmitting(true);
    try {
      const response = await authFetch(`/api/client-portals/${portal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disabled: !portal.disabled })
      });
      if (response.ok) {
        toast({ title: 'Status Atualizado.' });
        fetchPortalsAndUsers();
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <div className="w-full">
      <Card>
        <CardHeader>
          <div className="flex-row items-center justify-between">
            <div>
              <CardTitle>Gestão de Portais B2B</CardTitle>
              <CardDescription>Crie acessos para empresas clientes utilizarem os recursos de Cotação, Avisos e Rastreamento Externo (White-Label).</CardDescription>
            </div>
            <div className="flex items-center space-x-2 mt-4">
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input placeholder="Buscar por cliente, CNPJ ou E-mail mestre..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
                </div>
                <Button onClick={() => handleOpenDialog(null)}>
                    <Globe className="mr-2 h-4 w-4" /> Provisionar Novo Portal
                </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Identidade da Empresa</TableHead>
                  <TableHead>Gerente Mestre (Acesso)</TableHead>
                  <TableHead>Módulos Lib.</TableHead>
                  <TableHead>Logo</TableHead>
                  <TableHead>Acesso</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center h-24"><Loader2 className="animate-spin mx-auto h-6 w-6" /></TableCell></TableRow>
                ) : portalsToDisplay.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">Nenhum Portal provisionado ainda.</TableCell></TableRow>
                ) : (
                  portalsToDisplay.map((portal) => (
                    <TableRow key={portal.id}>
                      <TableCell>
                        <div className="font-semibold text-primary">{portal.nomeFantasia}</div>
                        <div className="text-xs text-muted-foreground">CNPJ: {portal.cnpj}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{portal.username}</div>
                        <div className="text-xs text-muted-foreground">{portal.email}</div>
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <div className="flex items-center space-x-1">
                             <Tooltip><TooltipTrigger>
                              <Badge variant={portal.freightAccess ? 'default' : 'secondary'} className="h-6 w-6 p-0 flex items-center justify-center">F</Badge>
                             </TooltipTrigger><TooltipContent>Fretes/Cotações</TooltipContent></Tooltip>

                             <Tooltip><TooltipTrigger>
                              <Badge variant={portal.noticeBoardAccess ? 'default' : 'secondary'} className="h-6 w-6 p-0 flex items-center justify-center">A</Badge>
                             </TooltipTrigger><TooltipContent>Avisos</TooltipContent></Tooltip>
                          </div>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                         {portal.logoUrl ? (
                           <div className="w-8 h-8 rounded border bg-white overflow-hidden flex items-center justify-center">
                             <img src={portal.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                           </div>
                         ) : (
                           <Badge variant="outline" className="text-xs">Usa DezLog</Badge>
                         )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={portal.disabled ? 'destructive' : 'default'} className={!portal.disabled ? 'bg-green-600' : ''}>
                          {portal.disabled ? 'Portal Inativo' : 'Ativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                          <DropdownMenu modal={false}>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                  <DropdownMenuItem onSelect={() => handleOpenDialog(portal)}><Pencil className="mr-2 h-4 w-4" /><span>Editar Dados / Permissões</span></DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => handleToggleStatus(portal)}>
                                      {portal.disabled ? <ToggleRight className="mr-2 h-4 w-4" /> : <ToggleLeft className="mr-2 h-4 w-4" />}
                                      <span>{portal.disabled ? 'Religar Acesso' : 'Desligar Todo o Portal'}</span>
                                  </DropdownMenuItem>
                              </DropdownMenuContent>
                          </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Globe className="h-5 w-5 text-primary"/> {editingPortal ? 'Editar Portal Cliente' : 'Provisionamento de Novo Portal Cliente'}</DialogTitle>
            <DialogDescription>{editingPortal ? 'Atualize os módulos de acesso da empresa.' : 'Preencha o CNPJ para criar uma experiência White-Label do seu portal focado neste Cliente Parceiro.'}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  
                  <div className="flex flex-col items-center justify-center space-y-2 mb-6 mt-4">
                      <div className="relative w-24 h-24 rounded-full border-2 border-dashed border-primary/40 hover:border-primary transition-colors flex items-center justify-center overflow-hidden bg-white group cursor-pointer">
                        {logoPreviewUrl ? (
                          <>
                            <img src={logoPreviewUrl} alt="Logo Preview" className="w-full h-full object-contain" />
                            <div className="absolute inset-0 bg-black/40 hidden group-hover:flex flex-col items-center justify-center text-white p-2 text-center text-[10px] font-medium transition-all">
                              <Upload className="h-5 w-5 mb-1" /> Alterar
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-muted-foreground.">
                            <Upload className="w-8 h-8 opacity-50 mb-1" />
                            <span className="text-[10px] uppercase font-bold text-center px-1">Logo Aqui</span>
                          </div>
                        )}
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          onChange={(e) => {
                             const file = e.target.files?.[0];
                             if (file) {
                                setSelectedLogoFile(file);
                                setLogoPreviewUrl(URL.createObjectURL(file));
                             }
                          }}
                        />
                      </div>
                      <div className="text-sm text-muted-foreground text-center">
                         Selecione a Logo da Transportadora<br/><span className="text-[10px]">(Opcional. PNG/JPG máx 2MB)</span>
                      </div>
                  </div>

                  <div className="space-y-4 rounded-md border p-4 bg-muted/20">
                    <h3 className="font-semibold text-lg flex items-center gap-2"><Building className="h-4 w-4"/> Identidade Jurídica (Empresa)</h3>
                    <FormField control={form.control} name="cnpj" render={({ field }) => (
                        <FormItem>
                            <FormLabel>CNPJ</FormLabel>
                            <div className="flex gap-2">
                                <FormControl><Input placeholder="Buscar na Receita..." {...field} disabled={!!editingPortal} /></FormControl>
                                {!editingPortal && <Button type="button" onClick={() => handleCnpjLookup(field.value)}><Search className="h-4 w-4"/></Button>}
                            </div><FormMessage />
                        </FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="razaoSocial" render={({ field }) => ( <FormItem><FormLabel>Razão Social</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="nomeFantasia" render={({ field }) => ( <FormItem><FormLabel>Nome Fantasia</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="inscricaoEstadual" render={({ field }) => ( <FormItem><FormLabel>Inscrição Estadual</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="telefone" render={({ field }) => ( <FormItem><FormLabel>Telefone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                    <div className="grid grid-cols-4 gap-4 mt-2">
                        <FormField control={form.control} name="cep" render={({ field }) => ( <FormItem><FormLabel>CEP</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )} />
                        <FormField control={form.control} name="endereco" render={({ field }) => ( <FormItem className="col-span-3"><FormLabel>Endereço</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )} />
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                        <FormField control={form.control} name="numero" render={({ field }) => ( <FormItem><FormLabel>Número</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )} />
                        <FormField control={form.control} name="complemento" render={({ field }) => ( <FormItem><FormLabel>Complemento</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )} />
                        <FormField control={form.control} name="bairro" render={({ field }) => ( <FormItem className="col-span-2"><FormLabel>Bairro</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="cidade" render={({ field }) => ( <FormItem><FormLabel>Cidade</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )} />
                        <FormField control={form.control} name="estado" render={({ field }) => ( <FormItem><FormLabel>UF</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )} />
                    </div>
                  </div>

                  <div className="space-y-4 rounded-md border p-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2"><Clock className="h-4 w-4"/> Horário de Funcionamento</h3>
                    <div className="flex flex-col gap-2">
                        {[
                          { key: 'seg', label: 'Seg' },
                          { key: 'ter', label: 'Ter' },
                          { key: 'qua', label: 'Qua' },
                          { key: 'qui', label: 'Qui' },
                          { key: 'sex', label: 'Sex' },
                          { key: 'sab', label: 'Sab' },
                          { key: 'dom', label: 'Dom' },
                        ].map(dia => (
                            <div key={dia.key} className="flex items-center gap-4 py-2 border-b last:border-0 border-muted/30">
                                <FormField control={form.control} name={`operatingHours.${dia.key}.active` as any} render={({ field }) => (
                                    <div className="flex items-center gap-2 w-24">
                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                        <Label>{dia.label}</Label>
                                    </div>
                                )} />
                                <FormField control={form.control} name={`operatingHours.${dia.key}.start` as any} render={({ field }) => (
                                    <Input type="time" {...field} className="w-32" disabled={!form.watch(`operatingHours.${dia.key}.active` as any)} />
                                )} />
                                <span className="text-muted-foreground text-sm">até</span>
                                <FormField control={form.control} name={`operatingHours.${dia.key}.end` as any} render={({ field }) => (
                                    <Input type="time" {...field} className="w-32" disabled={!form.watch(`operatingHours.${dia.key}.active` as any)} />
                                )} />
                            </div>
                        ))}
                    </div>
                  </div>

                  <div className="space-y-4 rounded-md border p-4 bg-yellow-50/50 border-yellow-100 dark:bg-yellow-900/10 dark:border-yellow-900/30">
                      <h3 className="font-semibold text-lg flex items-center gap-2 text-yellow-700 dark:text-yellow-600">
                          <Percent className="h-4 w-4"/> Regras de Negócio Ocultas (Admin)
                      </h3>
                      <div className="text-sm text-yellow-600/80 mb-2">Estes parâmetros afetam o preço e prazo neste cliente de forma invisível.</div>
                      <div className="grid grid-cols-2 gap-4">
                          <FormField control={form.control} name="businessRules.discountPercentage" render={({ field }) => ( <FormItem><FormLabel>Desconto Padrão (%)</FormLabel><FormControl><Input type="number" step="0.1" min="0" max="100" {...field} /></FormControl><FormMessage /></FormItem> )} />
                          <FormField control={form.control} name="businessRules.extraFeePercentage" render={({ field }) => ( <FormItem><FormLabel>Taxa Extra Padrão (%)</FormLabel><FormControl><Input type="number" step="0.1" min="0" {...field} /></FormControl><FormMessage /></FormItem> )} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <FormField control={form.control} name="businessRules.extraDays" render={({ field }) => ( <FormItem><FormLabel>Dias a mais (Prazo+)</FormLabel><FormControl><Input type="number" step="1" min="0" {...field} /></FormControl><FormMessage /></FormItem> )} />
                          <FormField control={form.control} name="businessRules.reducedDays" render={({ field }) => ( <FormItem><FormLabel>Dias a menos (Prazo-)</FormLabel><FormControl><Input type="number" step="1" min="0" {...field} /></FormControl><FormMessage /></FormItem> )} />
                      </div>
                  </div>

                  <div className="space-y-4 rounded-md border p-4 shadow-sm border-primary/20 bg-primary/5">
                    <h3 className="font-semibold text-lg flex items-center gap-2 text-primary"><KeyRound className="h-4 w-4"/> {editingPortal ? 'Dados do Gerente Mestre' : 'Chaves de Acesso (Gerente)'}</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="email" render={({ field }) => ( <FormItem className="col-span-2"><FormLabel>E-mail de Acesso (Login)</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="password" render={({ field }) => ( <FormItem><FormLabel>{editingPortal ? 'Nova Senha (opcional)' : 'Senha Padrão'}</FormLabel><FormControl><Input type="password" placeholder={editingPortal ? 'Deixe em branco para manter' : ''} {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="confirmPassword" render={({ field }) => ( <FormItem><FormLabel>Confirme a Senha</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="username" render={({ field }) => ( <FormItem className="col-span-2"><FormLabel>Nome do Gerente/Contato</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                  </div>

                  <div className="space-y-4 rounded-md border p-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2"><Globe className="h-4 w-4"/> Atendimento Dedicado</h3>
                    <FormField control={form.control} name="supportUserIds" render={({ field }) => {
                      const selectedIds: string[] = field.value || [];
                      const toggleUser = (userId: string) => {
                        const newIds = selectedIds.includes(userId)
                          ? selectedIds.filter(id => id !== userId)
                          : [...selectedIds, userId];
                        field.onChange(newIds);
                      };
                      return (
                        <FormItem>
                          <FormLabel>Usuários de Suporte</FormLabel>
                          {selectedIds.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                              {selectedIds.map(id => {
                                const u = supportUsers.find(su => su.id === id);
                                return u ? (
                                  <Badge key={id} variant="secondary" className="flex items-center gap-1 pr-1">
                                    {u.username}
                                    <button type="button" onClick={() => toggleUser(id)} className="ml-1 rounded-full hover:bg-muted p-0.5">
                                      <X className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                ) : null;
                              })}
                            </div>
                          )}
                          <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                            {supportUsers.map(u => (
                              <div key={u.id} className="flex items-center space-x-3 py-1">
                                <Checkbox
                                  id={`support-${u.id}`}
                                  checked={selectedIds.includes(u.id)}
                                  onCheckedChange={() => toggleUser(u.id)}
                                />
                                <Label htmlFor={`support-${u.id}`} className="cursor-pointer text-sm">
                                  {u.username} <span className="text-muted-foreground">({u.role})</span>
                                </Label>
                              </div>
                            ))}
                            {supportUsers.length === 0 && (
                              <p className="text-sm text-muted-foreground text-center py-2">Nenhum usuário disponível.</p>
                            )}
                          </div>
                          <FormDescription>Quando uma cotação deste cliente entrar em análise, estes usuários e os administradores receberão o alerta e poderão aprovar.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      );
                    }} />
                  </div>

              <div className="space-y-4 rounded-md border p-4">
                  <h3 className="font-semibold text-lg">Módulos do Portal Habilitados</h3>
                  <div className="grid md:grid-cols-2 gap-3">
                     <FormField control={form.control} name="freightAccess" render={({ field }) => (<FormItem className="flex items-center justify-between border p-3 rounded"><FormLabel className="font-medium">Cotação de Frete</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                     <FormField control={form.control} name="fracionadoEnabled" render={({ field }) => (<FormItem className="flex items-center justify-between border p-3 rounded"><FormLabel className="font-medium">Cotação Fracionado</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                     <FormField control={form.control} name="myFreightsAccess" render={({ field }) => (<FormItem className="flex items-center justify-between border p-3 rounded"><FormLabel className="font-medium">Histórico de Fretes / Dashboard</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                     <FormField control={form.control} name="clientPartnersAccess" render={({ field }) => (<FormItem className="flex items-center justify-between border p-3 rounded"><FormLabel className="font-medium">Adicionar Próprios Fornecedores</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                     <FormField control={form.control} name="noticeBoardAccess" render={({ field }) => (<FormItem className="flex items-center justify-between border p-3 rounded"><FormLabel className="font-medium">Acesso a Avisos</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                     <FormField control={form.control} name="armazenagemAccess" render={({ field }) => (<FormItem className="flex items-center justify-between border p-3 rounded"><FormLabel className="font-medium text-emerald-600 dark:text-emerald-400">Meu Estoque / Fulfillment</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                     <FormField control={form.control} name="quoteArmazenagemAccess" render={({ field }) => (<FormItem className="flex items-center justify-between border p-3 rounded"><FormLabel className="font-medium text-blue-600 dark:text-blue-400">Cotação de Armazenagem</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                  </div>
              </div>

              <DialogFooter>
                 <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                 <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="animate-spin mr-2 h-4 w-4" />} {editingPortal ? 'Salvar Módulos' : 'Providenciar Acesso'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
