
"use client";

import { useState, useMemo, useCallback, useEffect, useRef, ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Edit, Search, PlusCircle, Trash2, Upload, CheckCircle, Eye, MoreVertical } from 'lucide-react';
import type { Owner } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { Textarea } from './ui/textarea';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDialogDesc, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { Separator } from './ui/separator';
import { Label } from './ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from './ui/scroll-area';
import { authFetch } from '@/lib/api-client';

const ownerFormSchema = z.object({
  type: z.enum(['Pessoa Física', 'Pessoa Jurídica']).default('Pessoa Física'),
  name: z.string().min(3, 'Nome ou Razão Social é obrigatório.'),
  document: z.string().refine(value => {
    const cleaned = value.replace(/[^\d]/g, '');
    return cleaned.length === 11 || cleaned.length === 14;
  }, 'Deve ser um CPF (11 dígitos) ou CNPJ (14 dígitos).'),
  zipCode: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('E-mail inválido.').optional().or(z.literal('')),
  cnhRgDocumentUrl: z.string().optional(),
  addressProofUrl: z.string().optional(),
});

type DocumentType = 'cnhRg' | 'addressProof';

interface OwnerManagementProps {
  onDataMutated?: () => void;
}

const ViewDialog = ({ owner, isOpen, onOpenChange }: { owner: Owner | null, isOpen: boolean, onOpenChange: (open: boolean) => void }) => {
    if (!owner) return null;
    
    const docLabel = owner.type === 'Pessoa Física' ? 'CPF' : 'CNPJ';

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Detalhes do Proprietário</DialogTitle>
                    <DialogDescription>{owner.name}</DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[70vh] p-1 pr-4">
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Informações Pessoais</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <div className="py-2 border-b"><p className="font-medium text-muted-foreground">Nome / Razão Social</p><p>{owner.name || 'Não informado'}</p></div>
                                <div className="py-2 border-b"><p className="font-medium text-muted-foreground">Tipo</p><p>{owner.type || 'Não informado'}</p></div>
                                <div className="py-2 border-b"><p className="font-medium text-muted-foreground">{docLabel}</p><p>{owner.document || 'Não informado'}</p></div>
                                <div className="py-2 border-b"><p className="font-medium text-muted-foreground">Telefone</p><p>{owner.phone || 'Não informado'}</p></div>
                                <div className="py-2 border-b"><p className="font-medium text-muted-foreground">Email</p><p>{owner.email || 'Não informado'}</p></div>
                            </CardContent>
                        </Card>
                        
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Endereço</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <div className="py-2 border-b"><p className="font-medium text-muted-foreground">Endereço Completo</p><p>{owner.address || 'Não informado'}</p></div>
                                <div className="py-2 border-b"><p className="font-medium text-muted-foreground">CEP</p><p>{owner.zipCode || 'Não informado'}</p></div>
                            </CardContent>
                        </Card>
                         
                        {owner.type === 'Pessoa Física' && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Documentos</CardTitle>
                                </CardHeader>
                                <CardContent className="flex gap-4">
                                    {owner.cnhRgDocumentUrl ? (
                                        <a href={`${owner.cnhRgDocumentUrl}?t=${new Date().getTime()}`} target="_blank" rel="noopener noreferrer">
                                            <Button variant="outline"><Eye className="mr-2 h-4 w-4"/> Ver CNH/RG</Button>
                                        </a>
                                    ) : <p className="text-sm text-muted-foreground">CNH/RG não enviado.</p>}
                                    {owner.addressProofUrl ? (
                                         <a href={`${owner.addressProofUrl}?t=${new Date().getTime()}`} target="_blank" rel="noopener noreferrer">
                                            <Button variant="outline"><Eye className="mr-2 h-4 w-4"/> Ver Comp. Endereço</Button>
                                        </a>
                                    ) : <p className="text-sm text-muted-foreground">Comp. Endereço não enviado.</p>}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </ScrollArea>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Fechar</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export function OwnerManagement({ onDataMutated }: OwnerManagementProps) {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null);
  const [ownerToDelete, setOwnerToDelete] = useState<Owner | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { fetchAddressByCnpj, fetchAddressByCep } = useAuth();
  
  const [cnhRgFile, setCnhRgFile] = useState<File | null>(null);
  const [addressProofFile, setAddressProofFile] = useState<File | null>(null);
  const [uploadingField, setUploadingField] = useState<DocumentType | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingOwner, setViewingOwner] = useState<Owner | null>(null);
  
  const form = useForm<z.infer<typeof ownerFormSchema>>({
    resolver: zodResolver(ownerFormSchema),
  });

  const watchType = form.watch('type');
  const watchZipCode = form.watch('zipCode');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await authFetch('/api/owners');
      if (response.ok) {
        setOwners(await response.json());
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os proprietários.' });
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro de Rede', description: error.message });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenFormDialog = (owner: Owner | null) => {
    setEditingOwner(owner);
    setCnhRgFile(null);
    setAddressProofFile(null);
    if (owner) {
      form.reset({
        ...owner
      });
    } else {
      form.reset({
        type: 'Pessoa Física',
        name: '', document: '', zipCode: '', logradouro: '', numero: '', complemento: '',
        bairro: '', city: '', state: '', phone: '', email: '',
      });
    }
    setIsFormDialogOpen(true);
  };
  
    const handleCepLookup = useCallback(async (cep: string) => {
        setIsSubmitting(true);
        const data = await fetchAddressByCep(cep);
        if (data) {
            form.setValue('logradouro', data.fullAddress || '');
            form.setValue('bairro', data.neighborhood || '');
            form.setValue('city', data.city || '');
            form.setValue('state', data.state || '');
            toast({ title: 'Endereço Encontrado', description: 'Os campos de endereço foram preenchidos.' });
        }
        setIsSubmitting(false);
    }, [fetchAddressByCep, form, toast]);

  useEffect(() => {
    const cleanCep = (watchZipCode || '').replace(/[^\d]/g, '');
    if (cleanCep.length === 8) {
      handleCepLookup(cleanCep);
    }
  }, [watchZipCode, handleCepLookup]);

  const handleDocumentLookup = async (document: string) => {
    const cleanDoc = document.replace(/[^\d]/g, '');
    if (cleanDoc.length !== 14) return;
    setIsSubmitting(true);
    const data = await fetchAddressByCnpj(cleanDoc);
    if (data) {
        form.setValue('name', data.razaoSocial || '');
        form.setValue('logradouro', data.endereco || '');
        form.setValue('city', data.city || '');
        form.setValue('state', data.state || '');
        form.setValue('zipCode', data.cep || '');
        form.setValue('phone', data.telefone || '');
        form.setValue('email', data.email || '');
        toast({ title: 'Dados Encontrados', description: 'Os dados da empresa foram preenchidos.' });
    }
    setIsSubmitting(false);
  }

  const handleFormSubmit = async (values: z.infer<typeof ownerFormSchema>) => {
    setIsSubmitting(true);
    try {
      let ownerId = editingOwner?.id;
      const { cnhRgDocumentUrl, addressProofUrl, ...dataToSave } = values;

      const endpoint = editingOwner ? `/api/owners/${editingOwner.id}` : '/api/owners';
      const method = editingOwner ? 'PUT' : 'POST';
      
      const response = await authFetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave),
      });

      const responseData = await response.json();
      if (!response.ok) throw new Error(responseData.message || `Falha ao ${editingOwner ? 'atualizar' : 'salvar'} proprietário.`);

      if (!editingOwner) {
        ownerId = responseData.id;
      }
      if (!ownerId) throw new Error("Não foi possível obter o ID do proprietário para o upload.");
      
      const uploadQueue: { file: File | null, type: DocumentType }[] = [
        { file: cnhRgFile, type: 'cnhRg' },
        { file: addressProofFile, type: 'addressProof' }
      ];

      for (const { file, type } of uploadQueue) {
        if (file) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('type', type);
          
          const uploadResponse = await authFetch(`/api/owners/${ownerId}/upload`, {
            method: 'POST',
            body: formData,
          });
          
          if (!uploadResponse.ok) {
            toast({ variant: 'destructive', title: `Falha no Upload (${type})`, description: 'Dados salvos, mas o upload do ficheiro falhou.' });
          }
        }
      }

      toast({ title: 'Sucesso!', description: `Proprietário ${values.name} ${editingOwner ? 'atualizado' : 'salvo'}.` });
      setIsFormDialogOpen(false);
      fetchData();
      if (onDataMutated) onDataMutated();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if(!ownerToDelete) return;
    setIsSubmitting(true);
    try {
        const response = await authFetch(`/api/owners/${ownerToDelete.id}`, { method: 'DELETE' });
        if(!response.ok) throw new Error('Falha ao apagar proprietário.');
        toast({ title: 'Sucesso!', description: 'Proprietário apagado.'});
        fetchData();
        if (onDataMutated) onDataMutated();
    } catch(e:any) {
        toast({variant: 'destructive', title: 'Erro', description: e.message});
    } finally {
        setIsSubmitting(false);
        setOwnerToDelete(null);
    }
  };

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>, fieldName: DocumentType) => {
    const file = event.target.files?.[0];
    if (file) {
      if (fieldName === 'cnhRg') setCnhRgFile(file);
      else if (fieldName === 'addressProof') setAddressProofFile(file);
    }
  };
  
  const triggerUpload = (fieldName: DocumentType) => {
      setUploadingField(fieldName);
      fileInputRef.current?.click();
  };
  
   const handleOpenViewDialog = (owner: Owner) => {
    setViewingOwner(owner);
    setIsViewDialogOpen(true);
  };

  return (
    <>
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*,.pdf" onChange={(e) => uploadingField && handleFileSelect(e, uploadingField)} />
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Proprietários Cadastrados</CardTitle>
          <Button onClick={() => handleOpenFormDialog(null)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Novo Proprietário
          </Button>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                    <TableHead>Nome / Razão Social</TableHead>
                    <TableHead>Documento (CPF/CNPJ)</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center h-24"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                ) : owners.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center h-24 text-muted-foreground">Nenhum proprietário cadastrado.</TableCell></TableRow>
                ) : owners.map((owner) => (
                  <TableRow key={owner.id}>
                    <TableCell className="font-medium">{owner.name}</TableCell>
                    <TableCell>{owner.document}</TableCell>
                    <TableCell>{owner.phone || owner.email || 'N/A'}</TableCell>
                    <TableCell className="text-right">
                       <AlertDialog onOpenChange={(open) => !open && setOwnerToDelete(null)}>
                        <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <MoreVertical className="h-4 w-4" />
                                    <span className="sr-only">Ações</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => handleOpenViewDialog(owner)}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    <span>Ver</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => handleOpenFormDialog(owner)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    <span>Editar</span>
                                </DropdownMenuItem>
                                <AlertDialogTrigger asChild>
                                    <DropdownMenuItem
                                        onSelect={(e) => {
                                            e.preventDefault();
                                            setOwnerToDelete(owner);
                                        }}
                                        className="text-destructive focus:text-destructive"
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        <span>Apagar</span>
                                    </DropdownMenuItem>
                                </AlertDialogTrigger>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Apagar Proprietário?</AlertDialogTitle>
                            <AlertDialogDesc>Tem a certeza que quer apagar {ownerToDelete?.name}? Esta ação não pode ser desfeita.</AlertDialogDesc>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Apagar</AlertDialogAction>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingOwner ? 'Editar Proprietário' : 'Novo Proprietário'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-4">
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem className="space-y-3"><FormLabel>Tipo de Pessoa</FormLabel><FormControl>
                    <RadioGroup onValueChange={field.onChange} value={field.value} className="flex space-x-4">
                      <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="Pessoa Física" /></FormControl><FormLabel className="font-normal">Pessoa Física (CPF)</FormLabel></FormItem>
                      <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="Pessoa Jurídica" /></FormControl><FormLabel className="font-normal">Pessoa Jurídica (CNPJ)</FormLabel></FormItem>
                    </RadioGroup></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="document" render={({ field }) => (
                  <FormItem><FormLabel>{watchType === 'Pessoa Física' ? 'CPF' : 'CNPJ'}</FormLabel><div className="flex gap-2">
                    <FormControl><Input placeholder="Apenas números" {...field} /></FormControl>
                    {watchType === 'Pessoa Jurídica' && (<Button type="button" onClick={() => handleDocumentLookup(field.value)} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Search className="h-4 w-4"/>}</Button>)}
                  </div><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Nome / Razão Social</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Telefone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>E-mail</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem> )} />
              </div>
              <Separator />
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="zipCode" render={({ field }) => ( <FormItem><FormLabel>CEP</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="logradouro" render={({ field }) => ( <FormItem className="md:col-span-2"><FormLabel>Logradouro</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="numero" render={({ field }) => ( <FormItem><FormLabel>Número</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="complemento" render={({ field }) => ( <FormItem className="md:col-span-2"><FormLabel>Complemento</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="bairro" render={({ field }) => ( <FormItem><FormLabel>Bairro</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="city" render={({ field }) => ( <FormItem><FormLabel>Cidade</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="state" render={({ field }) => ( <FormItem><FormLabel>UF</FormLabel><FormControl><Input maxLength={2} {...field} /></FormControl><FormMessage /></FormItem> )} />
              </div>
              {watchType === 'Pessoa Física' && (
                <>
                  <Separator />
                  <h3 className="text-md font-medium">Documentos do Proprietário</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <Label>CNH ou RG</Label>
                          <div className="flex items-center gap-2">
                              <Button type="button" variant={cnhRgFile ? "default" : "outline"} className={cn("w-full justify-start", cnhRgFile && "bg-green-600 hover:bg-green-700")} onClick={() => triggerUpload('cnhRg')}>
                                  {cnhRgFile ? <CheckCircle className="mr-2 h-4 w-4" /> : <Upload className="mr-2 h-4 w-4" />}
                                  {cnhRgFile ? cnhRgFile.name.substring(0,15)+'...' : 'Carregar Documento'}
                              </Button>
                              {form.watch('cnhRgDocumentUrl') && !cnhRgFile && (<a href={`${form.watch('cnhRgDocumentUrl')}?t=${new Date().getTime()}`} target="_blank" rel="noopener noreferrer"><Button type="button" variant="secondary" size="icon"><Eye className="h-4 w-4" /></Button></a>)}
                          </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Comprovante de Endereço</Label>
                        <div className="flex items-center gap-2">
                            <Button type="button" variant={addressProofFile ? "default" : "outline"} className={cn("w-full justify-start", addressProofFile && "bg-green-600 hover:bg-green-700")} onClick={() => triggerUpload('addressProof')}>
                                {addressProofFile ? <CheckCircle className="mr-2 h-4 w-4" /> : <Upload className="mr-2 h-4 w-4" />}
                                {addressProofFile ? addressProofFile.name.substring(0,10)+'...' : 'Carregar Comprovante'}
                            </Button>
                            {form.watch('addressProofUrl') && !addressProofFile && (<a href={`${form.watch('addressProofUrl')}?t=${new Date().getTime()}`} target="_blank" rel="noopener noreferrer"><Button type="button" variant="secondary" size="icon"><Eye className="h-4 w-4" /></Button></a>)}
                        </div>
                    </div>
                  </div>
                </>
              )}
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
      <ViewDialog owner={viewingOwner} isOpen={isViewDialogOpen} onOpenChange={setIsViewDialogOpen} />
    </>
  );
}
