
"use client";

import { useState, useMemo, useCallback, useRef, ChangeEvent, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, PlusCircle, Edit, Trash2, Search, XCircle, UserPlus, ChevronsUpDown, Box, Eye, Upload, Truck, Link as LinkIcon, X, KeyRound, CheckCircle } from 'lucide-react';
import type { FleetVehicle, Company, Driver, VehicleOption, Owner } from '@/lib/types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { getInitials } from '@/lib/utils';
import { Separator } from './ui/separator';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Skeleton } from './ui/skeleton';
import { ScrollArea } from './ui/scroll-area';
import { DriverManagement } from './DriverManagement';
import { CompanyManagement } from './CompanyManagement';
import { OwnerManagement } from './OwnerManagement';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { FleetOptionsManager } from './FleetOptionsManager';
import { cn } from '@/lib/utils';
import { authFetch } from '@/lib/api-client';

const vehicleFormSchema = z.object({
  plate: z.string().min(8, 'Placa deve ter 8 caracteres (Ex: AAA-1234).').max(8, 'Placa deve ter 8 caracteres (Ex: AAA-1234).'),
  brand: z.string().optional().or(z.literal('')),
  model: z.string().optional().or(z.literal('')),
  year: z.preprocess((val) => val === '' || val === undefined || val === null ? undefined : Number(val), z.number().min(1900, 'Ano inválido.').max(new Date().getFullYear() + 2, 'Ano inválido.').optional()),
  city: z.string().optional().or(z.literal('')),
  state: z.string().length(2, 'UF deve ter 2 caracteres.'),
  renavam: z.string().optional().or(z.literal('')),
  chassis: z.string().optional().or(z.literal('')),
  antt: z.string().min(1, 'Nº ANTT é obrigatório.'),
  category: z.string().min(1, 'Categoria ANTT é obrigatória.'),
  color: z.string().optional().or(z.literal('')),
  axles: z.coerce.number().min(2, 'Deve ter no mínimo 2 eixos.'),
  capacity: z.string().optional().or(z.literal('')),
  cubage: z.string().optional().or(z.literal('')),
  tara: z.string().min(1, 'Tara (kg) é obrigatória.'),
  type: z.enum(['Próprio', 'Terceiro']),
  bodyType: z.string().min(1, 'Tipo de Carroceria é obrigatória.'),
  vehicleType: z.string().min(1, 'Tipo de Rodado é obrigatório.'),
  tpRod: z.string().optional(),
  tpCar: z.string().optional(),
  ownerId: z.string().optional(),
  ownerType: z.enum(['driver', 'customer', 'owner']).optional(),
  ownerName: z.string().optional(),
  crlvDocumentUrl: z.string().optional(),
  anttDocumentUrl: z.string().optional(),
  ownerAddressProofUrl: z.string().optional(),
}).refine(data => data.type === 'Próprio' || (data.type === 'Terceiro' && data.ownerName && data.ownerName.length > 0), {
    message: "O proprietário é obrigatório para veículos de terceiros.",
    path: ["ownerName"],
});

const optionTypesMap: Record<string, string> = {
  brands: 'Marcas',
  models: 'Modelos',
  colors: 'Cores',
  bodyTypes: 'Tipo de Carroceria',
  anttCategories: 'Categorias ANTT',
  vehicleTypes: 'Tipo de Rodado',
};

type DocumentType = 'crlv' | 'antt' | 'ownerAddressProof';

interface FleetManagementProps {
  onDataMutated?: () => void;
  quickEditId?: string;
  onQuickEditComplete?: () => void;
  hideList?: boolean;
}

export function FleetManagement({ onDataMutated: parentOnDataMutated, quickEditId, onQuickEditComplete, hideList }: FleetManagementProps) {
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<FleetVehicle | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  
  const [ownerSelectionType, setOwnerSelectionType] = useState<'driver' | 'customer' | 'owner'>('driver');
  const [isDriverSearchOpen, setIsDriverSearchOpen] = useState(false);
  const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);
  const [isOwnerSearchOpen, setIsOwnerSearchOpen] = useState(false);
  const [isNewDriverDialogOpen, setIsNewDriverDialogOpen] = useState(false);
  const [isNewCustomerDialogOpen, setIsNewCustomerDialogOpen] = useState(false);
  const [isNewOwnerDialogOpen, setIsNewOwnerDialogOpen] = useState(false);

  const [driverSearchTerm, setDriverSearchTerm] = useState('');
  const [driverSearchResults, setDriverSearchResults] = useState<Driver[]>([]);
  const [isSearchingDrivers, setIsSearchingDrivers] = useState(false);
  const driverSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState<Company[]>([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  
  const [ownerSearchTerm, setOwnerSearchTerm] = useState('');
  const [ownerSearchResults, setOwnerSearchResults] = useState<Owner[]>([]);
  const [isSearchingOwners, setIsSearchingOwners] = useState(false);
  const [ownerSearchTimeoutRef] = useState<{ current: NodeJS.Timeout | null }>({ current: null });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<FleetVehicle[] | null>(null);
  
  const [selectionDialog, setSelectionDialog] = useState<{ open: boolean; type: string; name: string, onSelect: (value: VehicleOption) => void; } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [crlvFile, setCrlvFile] = useState<File | null>(null);
  const [anttFile, setAnttFile] = useState<File | null>(null);
  const [ownerAddressProofFile, setOwnerAddressProofFile] = useState<File | null>(null);
  const [uploadingField, setUploadingField] = useState<DocumentType | null>(null);


  const form = useForm<z.infer<typeof vehicleFormSchema>>({
    resolver: zodResolver(vehicleFormSchema),
  });

  const watchType = form.watch('type');

  const onDataMutated = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await authFetch('/api/fleet');
      if (!res.ok) throw new Error(`Falha ao buscar veículos.`);
      const vehicleList = await res.json();
      setVehicles(vehicleList);

      // Auto-trigger Quick Edit
      if (quickEditId && !editingVehicle) {
         const target = vehicleList.find((v: any) => v.id === quickEditId);
         if (target) {
            handleOpenFormDialog(target);
         } else {
             const resSingle = await authFetch(`/api/fleet/${quickEditId}`);
             if (resSingle.ok) {
               const single = await resSingle.json();
               handleOpenFormDialog(single);
             }
         }
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    onDataMutated();
  }, [onDataMutated]);

  const handleOpenFormDialog = (vehicle: FleetVehicle | null) => {
    setEditingVehicle(vehicle);
    setCrlvFile(null);
    setAnttFile(null);
    setOwnerAddressProofFile(null);
    if (vehicle) {
      form.reset({
        ...vehicle,
        ownerId: String(vehicle.ownerId || ''),
      });
      setOwnerSelectionType(vehicle.ownerType || 'driver');
    } else {
      form.reset({
        plate: '', brand: '', model: '', year: new Date().getFullYear(), city: '', state: '',
        renavam: '', chassis: '', antt: '', category: '', color: '', bodyType: '',
        axles: 2, capacity: '', cubage: '', tara: '', type: 'Terceiro', ownerName: '', vehicleType: '',
      });
      setOwnerSelectionType('driver');
    }
    setIsFormDialogOpen(true);
  };

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>, fieldName: DocumentType) => {
    const file = event.target.files?.[0];
    if (file) {
      const fieldMap = {
        crlv: setCrlvFile,
        antt: setAnttFile,
        ownerAddressProof: setOwnerAddressProofFile,
      };
      fieldMap[fieldName](file);
    }
  };

  const triggerUpload = (fieldName: DocumentType) => {
      setUploadingField(fieldName);
      fileInputRef.current?.click();
  };

  const handleFormSubmit = async (values: z.infer<typeof vehicleFormSchema>) => {
    setIsSubmitting(true);
    try {
        let vehicleId = editingVehicle?.id;
        
        const endpoint = editingVehicle ? `/api/fleet/${editingVehicle.id}` : '/api/fleet';
        const method = editingVehicle ? 'PUT' : 'POST';
        
        const response = await authFetch(endpoint, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(values),
        });
        const responseData = await response.json();
        if (!response.ok) throw new Error(responseData.message);

        if (!editingVehicle) {
            vehicleId = responseData.id;
        }

        if (!vehicleId) {
          throw new Error("Não foi possível obter o ID do veículo para fazer o upload dos ficheiros.");
        }
        
        const uploadQueue = [
          { file: crlvFile, type: 'crlv' as const },
          { file: anttFile, type: 'antt' as const },
          { file: ownerAddressProofFile, type: 'ownerAddressProof' as const },
        ];

        for (const { file, type } of uploadQueue) {
          if (file) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', type);
            const uploadResponse = await authFetch(`/api/fleet/${vehicleId}/upload`, {
              method: 'POST',
              body: formData,
            });
             if (!uploadResponse.ok) {
                const uploadError = await uploadResponse.json();
                throw new Error(`Veículo salvo, mas o upload do ficheiro falhou: ${uploadError.message}`);
            }
          }
        }
        
        toast({ title: 'Sucesso!', description: `Veículo ${values.plate} ${editingVehicle ? 'atualizado' : 'cadastrado'}.` });
        setIsFormDialogOpen(false);
        onDataMutated();
        if (parentOnDataMutated) parentOnDataMutated();
        if (onQuickEditComplete) onQuickEditComplete();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    setIsSubmitting(true);
    const response = await authFetch(`/api/fleet/${vehicleId}`, { method: 'DELETE' });
     if (response.ok) {
        toast({ title: 'Sucesso!', description: `Veículo excluído.` });
        onDataMutated();
    } else {
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível excluir o veículo.' });
    }
    setIsSubmitting(false);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) {
      setSearchResults(null);
      return;
    }
    setIsSearching(true);
    try {
      const res = await authFetch(`/api/fleet/search?term=${encodeURIComponent(searchTerm)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      } else {
         toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao buscar veículos.' });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro de rede ao buscar.' });
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSearchResults(null);
  };
  
  const handleSelectOwner = (owner: Driver | Company | Owner, type: 'driver' | 'customer' | 'owner') => {
    form.setValue('ownerId', owner.id);
    form.setValue('ownerName', 'razaoSocial' in owner ? owner.razaoSocial : owner.name);
    form.setValue('ownerType', type);
    setIsDriverSearchOpen(false);
    setIsCustomerSearchOpen(false);
    setIsOwnerSearchOpen(false);
  }

  const handlePlateInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    let rawValue = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    let finalValue = '';

    if (rawValue.length > 3) {
        finalValue = `${rawValue.slice(0, 3)}-${rawValue.slice(3, 7)}`;
    } else {
        finalValue = rawValue;
    }

    form.setValue('plate', finalValue, { shouldValidate: true });
  };
  
  const searchDrivers = useCallback(async (term: string) => {
    if (term.length < 2) {
      setDriverSearchResults([]);
      return;
    }
    setIsSearchingDrivers(true);
    try {
        const response = await authFetch(`/api/drivers/search?term=${encodeURIComponent(term)}`);
        if (response.ok) {
            setDriverSearchResults(await response.json());
        } else {
            setDriverSearchResults([]);
        }
    } catch (error) {
      setDriverSearchResults([]);
      toast({ variant: 'destructive', title: 'Erro de Rede', description: 'Não foi possível buscar motoristas.' });
    } finally {
      setIsSearchingDrivers(false);
    }
  }, [toast]);

  const handleDriverSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const term = event.target.value;
    setDriverSearchTerm(term);
    if (driverSearchTimeoutRef.current) {
      clearTimeout(driverSearchTimeoutRef.current);
    }
    driverSearchTimeoutRef.current = setTimeout(() => {
      searchDrivers(term);
    }, 500);
  };

  const handleCustomerSearch = async () => {
    if (customerSearchTerm.length < 2) {
      toast({ variant: 'destructive', title: 'Busca inválida', description: 'Digite ao menos 2 caracteres para buscar.' });
      setCustomerSearchResults([]);
      return;
    }
    setIsSearchingCustomers(true);
    try {
      const response = await authFetch(`/api/customers/search?term=${encodeURIComponent(customerSearchTerm)}`);
      if (response.ok) {
        const results = await response.json();
        setCustomerSearchResults(results);
        if (results.length === 0) {
          toast({ title: 'Nenhum cliente encontrado.' });
        }
      } else {
        setCustomerSearchResults([]);
        toast({ variant: 'destructive', title: 'Erro na busca', description: 'Não foi possível buscar clientes.' });
      }
    } catch (e) {
      setCustomerSearchResults([]);
      toast({variant: 'destructive', title: 'Erro de Rede', description: 'Falha ao conectar com o servidor.'});
    } finally {
      setIsSearchingCustomers(false);
    }
  };
  
  const searchOwners = useCallback(async (term: string) => {
    if (term.length < 2) {
      setOwnerSearchResults([]);
      return;
    }
    setIsSearchingOwners(true);
    try {
        const response = await authFetch(`/api/owners/search?term=${encodeURIComponent(term)}`);
        if (response.ok) {
            setOwnerSearchResults(await response.json());
        } else {
            setOwnerSearchResults([]);
        }
    } catch (error) {
      setOwnerSearchResults([]);
      toast({ variant: 'destructive', title: 'Erro de Rede', description: 'Não foi possível buscar proprietários.' });
    } finally {
      setIsSearchingOwners(false);
    }
  }, [toast]);
  
  const handleOwnerSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const term = event.target.value;
    setOwnerSearchTerm(term);
    if (ownerSearchTimeoutRef.current) {
      clearTimeout(ownerSearchTimeoutRef.current);
    }
    ownerSearchTimeoutRef.current = setTimeout(() => {
      searchOwners(term);
    }, 500);
  };

  const handleOpenSelectionDialog = (type: string, name: string, onSelect: (value: VehicleOption) => void) => {
    setSelectionDialog({ open: true, type: type, name: name, onSelect: onSelect });
  };
  
  const handleOpenSearchDialog = () => {
    if (ownerSelectionType === 'driver') setIsDriverSearchOpen(true);
    else if (ownerSelectionType === 'customer') setIsCustomerSearchOpen(true);
    else if (ownerSelectionType === 'owner') setIsOwnerSearchOpen(true);
  };
  
  const handleOpenNewOwnerDialog = () => {
    if (ownerSelectionType === 'driver') setIsNewDriverDialogOpen(true);
    else if (ownerSelectionType === 'customer') setIsNewCustomerDialogOpen(true);
    else if (ownerSelectionType === 'owner') setIsNewOwnerDialogOpen(true);
  }

  const OptionSelector = ({ name, label }: { name: keyof z.infer<typeof vehicleFormSchema>, label: string }) => {
    const typeKey = Object.keys(optionTypesMap).find(key => optionTypesMap[key] === label) || '';
    return (
        <FormField control={form.control} name={name} render={({ field }) => ( 
            <FormItem>
                <FormLabel>{label}</FormLabel>
                <div className="flex gap-2">
                    <FormControl>
                        <Input {...field} readOnly tabIndex={-1} placeholder={`Selecione um(a) ${label.toLowerCase()}...`} className="bg-muted/50 cursor-not-allowed select-none" />
                    </FormControl>
                    <Button type="button" variant="outline" onClick={() => handleOpenSelectionDialog(typeKey, label, (item) => {
                        form.setValue(name, item.name);
                        if (name === 'vehicleType') form.setValue('tpRod', item.code);
                        if (name === 'bodyType') form.setValue('tpCar', item.code);
                    })}>
                        Buscar
                    </Button>
                </div>
                <FormMessage />
            </FormItem> 
        )} />
    );
  };
  
  return (
    <div className={cn("relative w-full", quickEditId ? "hidden" : "block")}>
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*,.pdf" onChange={(e) => uploadingField && handleFileSelect(e, uploadingField)} />
      {!hideList && (
        <Card>
          <CardHeader>
            <div className="flex-row items-center justify-between">
              <div>
                <CardTitle>Todos os Veículos da Frota</CardTitle>
                <CardDescription>Gerencie seus caminhões, carretas e outros veículos.</CardDescription>
              </div>
               <form onSubmit={handleSearch} className="flex w-full items-center space-x-2 mt-4">
                  <div className="relative flex-grow">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                      placeholder="Pesquisar por placa, proprietário, modelo..."
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
                      <PlusCircle className="mr-2 h-4 w-4" /> Novo Veículo
                  </Button>
               </form>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md">
            <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Placa</TableHead>
                    <TableHead>Marca/Modelo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>ANTT</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    Array.from({ length: 5 }).map((_, index) => (
                        <TableRow key={`skeleton-${index}`}>
                            <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-9 w-24 ml-auto" /></TableCell>
                        </TableRow>
                    ))
                ) : (
                    (searchResults || vehicles)?.map((vehicle) => (
                        <TableRow key={vehicle.id}>
                            <TableCell className="font-medium">{vehicle.plate}</TableCell>
                            <TableCell>{(vehicle.brand && vehicle.model) ? `${vehicle.brand} / ${vehicle.model}` : (vehicle.brand || vehicle.model || '—')}</TableCell>
                            <TableCell>{vehicle.type}</TableCell>
                            <TableCell>{vehicle.antt}</TableCell>
                            <TableCell className="text-right space-x-1">
                                <Button variant="outline" size="sm" onClick={() => handleOpenFormDialog(vehicle)}>
                                    <Edit className="mr-2 h-4 w-4" /> Editar
                                </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Essa ação não pode ser desfeita. Isso irá remover permanentemente o veículo de placa {vehicle.plate}.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteVehicle(vehicle.id!)} className="bg-destructive hover:bg-destructive/90">
                                                Remover
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </TableCell>
                        </TableRow>
                    ))
                )}
                {!isLoading && (searchResults || vehicles).length === 0 && (
                    <TableRow>
                        <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                            Nenhum veículo cadastrado.
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
            </Table>
            </div>
        </CardContent>
      </Card>
      )}
      
      <Dialog open={isFormDialogOpen} onOpenChange={(val) => {
         setIsFormDialogOpen(val);
         if (!val && onQuickEditComplete) onQuickEditComplete();
      }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingVehicle ? 'Editar Veículo' : 'Cadastrar Novo Veículo'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6 max-h-[70vh] overflow-y-auto p-4">
              
              {/* Seção 1: Dados Fiscais Obrigatórios (Top) */}
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-primary flex items-center gap-2">
                  <Truck className="h-4 w-4" /> Dados Fiscais Obrigatórios (SEFAZ / ANTT)
                </h3>
                
                <div className="grid md:grid-cols-4 gap-4">
                  <FormField control={form.control} name="plate" render={({ field }) => ( 
                      <FormItem>
                          <FormLabel>Placa *</FormLabel>
                          <FormControl>
                              <Input placeholder="AAA-1A23" {...field} onChange={handlePlateInputChange} maxLength={8} className="font-mono uppercase"/>
                          </FormControl>
                          <FormMessage />
                      </FormItem> 
                  )} />
                  <FormField control={form.control} name="state" render={({ field }) => ( 
                      <FormItem>
                          <FormLabel>UF *</FormLabel>
                          <FormControl>
                              <Input placeholder="Ex: SP" maxLength={2} {...field} className="uppercase" />
                          </FormControl>
                          <FormMessage />
                      </FormItem> 
                  )} />
                  <FormField control={form.control} name="axles" render={({ field }) => ( 
                      <FormItem>
                          <FormLabel>Nº de Eixos *</FormLabel>
                          <FormControl>
                              <Input type="number" placeholder="Ex: 3" {...field} />
                          </FormControl>
                          <FormMessage />
                      </FormItem> 
                  )} />
                  <FormField control={form.control} name="antt" render={({ field }) => ( 
                      <FormItem>
                          <FormLabel>Nº ANTT (Veículo) *</FormLabel>
                          <FormControl>
                              <Input placeholder="Registro ANTT" {...field} />
                          </FormControl>
                          <FormMessage />
                      </FormItem> 
                  )} />
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <OptionSelector name="vehicleType" label="Tipo de Rodado" />
                  <OptionSelector name="bodyType" label="Tipo de Carroceria" />
                  <FormField control={form.control} name="tara" render={({ field }) => ( 
                      <FormItem>
                          <FormLabel>Tara (kg) *</FormLabel>
                          <FormControl>
                              <Input placeholder="Ex: 15000" {...field} />
                          </FormControl>
                          <FormMessage />
                      </FormItem> 
                  )} />
                </div>
              </div>

              <Separator />

              {/* Seção 2: Tipo de Vínculo e Proprietário */}
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-primary flex items-center gap-2">
                  <LinkIcon className="h-4 w-4" /> Vínculo e Proprietário
                </h3>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="type" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Tipo de Vínculo *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                              <SelectContent>
                                  <SelectItem value="Próprio">Próprio</SelectItem>
                                  <SelectItem value="Terceiro">Terceiro (Agregado/TAC)</SelectItem>
                              </SelectContent>
                          </Select>
                          <FormMessage/>
                      </FormItem>
                  )} />
                  <OptionSelector name="category" label="Categorias ANTT" />
                </div>

                {watchType === 'Terceiro' && (
                  <div className="border rounded-2xl p-4 bg-muted/10 space-y-4 border-amber-500/20">
                      <FormItem>
                          <FormLabel className="text-amber-600">Proprietário do Veículo *</FormLabel>
                          <div className="flex items-center space-x-4 mb-2">
                            <RadioGroup value={ownerSelectionType} onValueChange={(v) => setOwnerSelectionType(v as any)} className="flex gap-4">
                                <div className="flex items-center space-x-2"><RadioGroupItem value="driver" id="owner-driver"/><Label htmlFor="owner-driver" className="cursor-pointer">Motorista</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="customer" id="owner-customer"/><Label htmlFor="owner-customer" className="cursor-pointer">Cliente</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="owner" id="owner-other"/><Label htmlFor="owner-other" className="cursor-pointer">Outros</Label></div>
                            </RadioGroup>
                          </div>
                          <div className="flex gap-2">
                            <Input readOnly tabIndex={-1} value={form.watch('ownerName') || ''} placeholder="Selecione o proprietário cadastrado..." className="bg-muted/50 cursor-not-allowed select-none"/>
                            <Button type="button" variant="outline" onClick={handleOpenSearchDialog}>Buscar</Button>
                            <Button type="button" variant="outline" onClick={handleOpenNewOwnerDialog}>Novo</Button>
                          </div>
                      </FormItem>
                  </div>
                )}
              </div>

              <Separator />

              {/* Seção 3: Seção Complementar Opcional (Colapsável) */}
              <details className="group border border-border rounded-2xl p-4 bg-muted/20">
                <summary className="cursor-pointer font-semibold text-sm text-muted-foreground hover:text-primary select-none flex items-center justify-between">
                  <span>⚙️ Informações Complementares (Opcionais)</span>
                  <span className="transition group-open:rotate-180">
                    <ChevronsUpDown className="h-4 w-4" />
                  </span>
                </summary>
                
                <div className="space-y-4 pt-4">
                  <div className="grid md:grid-cols-3 gap-4">
                    <OptionSelector name="brand" label="Marcas" />
                    <OptionSelector name="model" label="Modelos" />
                    <FormField control={form.control} name="year" render={({ field }) => ( 
                        <FormItem>
                          <FormLabel>Ano Fab.</FormLabel>
                          <FormControl><Input type="number" placeholder="Ex: 2023" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem> 
                    )} />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <OptionSelector name="color" label="Cores" />
                    <FormField control={form.control} name="city" render={({ field }) => ( 
                        <FormItem>
                          <FormLabel>Cidade</FormLabel>
                          <FormControl><Input placeholder="Ex: Guarulhos" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem> 
                    )} />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="renavam" render={({ field }) => ( 
                        <FormItem>
                          <FormLabel>Renavam</FormLabel>
                          <FormControl><Input placeholder="Código Renavam" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem> 
                    )} />
                    <FormField control={form.control} name="chassis" render={({ field }) => ( 
                        <FormItem>
                          <FormLabel>Chassi</FormLabel>
                          <FormControl><Input placeholder="Chassi do veículo" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem> 
                    )} />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="capacity" render={({ field }) => ( 
                        <FormItem>
                          <FormLabel>Capacidade (kg)</FormLabel>
                          <FormControl>
                              <Input placeholder="Ex: 25000" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem> 
                    )} />
                    <FormField control={form.control} name="cubage" render={({ field }) => ( 
                        <FormItem>
                          <FormLabel>Cubagem (m³)</FormLabel>
                          <FormControl>
                              <Input placeholder="Ex: 90" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem> 
                    )} />
                  </div>
                </div>
              </details>

              <Separator />

              {/* Seção 4: Documentos de Auditoria (Uploads) */}
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-primary flex items-center gap-2">
                  <Upload className="h-4 w-4" /> Documentação de Auditoria (Opcional)
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>CRLV do Veículo</Label>
                        <div className="flex items-center gap-2">
                            <Button type="button" variant="outline" className="w-full justify-start bg-background" onClick={() => triggerUpload('crlv')}>
                              <Upload className="mr-2 h-4 w-4" /> {crlvFile ? crlvFile.name : 'Carregar CRLV'}
                            </Button>
                            {form.watch('crlvDocumentUrl') && !crlvFile && (
                              <a href={form.watch('crlvDocumentUrl')} target="_blank" rel="noopener noreferrer">
                                <Button type="button" variant="secondary" size="icon"><Eye className="h-4 w-4" /></Button>
                              </a>
                            )}
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label>Comprovativo ANTT</Label>
                         <div className="flex items-center gap-2">
                            <Button type="button" variant="outline" className="w-full justify-start bg-background" onClick={() => triggerUpload('antt')}>
                              <Upload className="mr-2 h-4 w-4" /> {anttFile ? anttFile.name : 'Carregar ANTT'}
                            </Button>
                            {form.watch('anttDocumentUrl') && !anttFile && (
                              <a href={form.watch('anttDocumentUrl')} target="_blank" rel="noopener noreferrer">
                                <Button type="button" variant="secondary" size="icon"><Eye className="h-4 w-4" /></Button>
                              </a>
                            )}
                        </div>
                    </div>
                </div>
              </div>

              <DialogFooter className="pt-4">
                  <DialogClose asChild><Button type="button" variant="secondary" disabled={isSubmitting}>Cancelar</Button></DialogClose>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingVehicle ? 'Salvar Alterações' : 'Cadastrar Veículo'}
                  </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
        <Dialog open={isDriverSearchOpen} onOpenChange={setIsDriverSearchOpen}>
          <DialogContent>
            <DialogHeader>
                <DialogTitle>Selecionar Motorista Proprietário</DialogTitle>
                <div className="flex gap-2 pt-4">
                    <Input placeholder="Buscar por nome, CPF, placa..." value={driverSearchTerm} onChange={handleDriverSearchChange} />
                </div>
            </DialogHeader>
            <ScrollArea className="h-72 mt-4">
                {isSearchingDrivers ? (<div className="flex justify-center items-center h-full"><Loader2 className="h-6 w-6 animate-spin"/></div>
                ) : driverSearchResults.map(d => (
                    <div key={d.id} onClick={() => handleSelectOwner(d, 'driver')} className="p-2 hover:bg-accent rounded-md cursor-pointer flex items-center gap-3">
                        <Avatar><AvatarImage src={d.avatarUrl} /><AvatarFallback>{getInitials(d.name)}</AvatarFallback></Avatar>
                        <div><p>{d.name}</p><p className="text-xs text-muted-foreground">{d.cpf}</p></div>
                    </div>
                ))}
            </ScrollArea>
          </DialogContent>
        </Dialog>
        <Dialog open={isCustomerSearchOpen} onOpenChange={setIsCustomerSearchOpen}>
          <DialogContent>
            <DialogHeader>
                <DialogTitle>Selecionar Cliente Proprietário</DialogTitle>
                <div className="flex gap-2 pt-4">
                    <Input placeholder="Buscar por nome, código ou CNPJ..." value={customerSearchTerm} onChange={(e) => setCustomerSearchTerm(e.target.value)} />
                    <Button variant="outline" size="icon" onClick={handleCustomerSearch} disabled={isSearchingCustomers}>
                        {isSearchingCustomers ? <Loader2 className="h-4 w-4 animate-spin"/> : <Search className="h-4 w-4"/>}
                    </Button>
                </div>
            </DialogHeader>
             <ScrollArea className="max-h-72 mt-4">
                {isSearchingCustomers ? (
                    <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin"/></div>
                ) : customerSearchResults.length > 0 ? (
                    customerSearchResults.map(c => (
                        <div key={c.id} onClick={() => handleSelectOwner(c, 'customer')} className="p-2 hover:bg-accent rounded-md cursor-pointer">
                            <p>{c.razaoSocial}</p>
                            <p className="text-xs text-muted-foreground">{c.cnpj}</p>
                        </div>
                    ))
                ) : (<div className="text-center p-8 text-sm text-muted-foreground">A lista está vazia.</div>)}
            </ScrollArea>
          </DialogContent>
        </Dialog>
        <Dialog open={isOwnerSearchOpen} onOpenChange={setIsOwnerSearchOpen}>
          <DialogContent>
            <DialogHeader>
                <DialogTitle>Selecionar Proprietário</DialogTitle>
                <div className="flex gap-2 pt-4">
                    <Input placeholder="Buscar por nome ou documento..." value={ownerSearchTerm} onChange={handleOwnerSearchChange} />
                </div>
            </DialogHeader>
            <ScrollArea className="h-72 mt-4">
                {isSearchingOwners ? (<div className="flex justify-center items-center h-full"><Loader2 className="h-6 w-6 animate-spin"/></div>
                ) : ownerSearchResults.map(o => (
                    <div key={o.id} onClick={() => handleSelectOwner(o, 'owner')} className="p-2 hover:bg-accent rounded-md cursor-pointer">
                        <p>{o.name}</p>
                        <p className="text-xs text-muted-foreground">{o.document}</p>
                    </div>
                ))}
                {!isSearchingOwners && ownerSearchResults.length === 0 && (<div className="text-center p-4 text-muted-foreground">Nenhum proprietário encontrado.</div>)}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      
        <Dialog open={!!selectionDialog?.open} onOpenChange={(open) => !open && setSelectionDialog(null)}>
            <DialogContent className="max-w-xl">
                {selectionDialog && (<>
                        <DialogHeader>
                          <DialogTitle>Selecionar {selectionDialog.name}</DialogTitle>
                        </DialogHeader>
                        <FleetOptionsManager 
                            optionType={selectionDialog.type} 
                            optionName={selectionDialog.name}
                            onSelect={(item) => {
                                selectionDialog.onSelect(item);
                                setSelectionDialog(null);
                            }}
                        />
                    </>)}
            </DialogContent>
        </Dialog>

        {/* Nested Dialogs for creation */}
        <Dialog open={isNewDriverDialogOpen} onOpenChange={setIsNewDriverDialogOpen}>
            <DialogContent className="max-w-7xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Adicionar Novo Motorista</DialogTitle>
                    <DialogDescription>Preencha os dados abaixo para cadastrar um novo motorista.</DialogDescription>
                </DialogHeader>
                <div className="flex-grow overflow-y-auto"><DriverManagement /></div>
            </DialogContent>
        </Dialog>
        <Dialog open={isNewCustomerDialogOpen} onOpenChange={setIsNewCustomerDialogOpen}>
            <DialogContent className="max-w-7xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Adicionar Novo Cliente</DialogTitle>
                    <DialogDescription>Preencha os dados abaixo para cadastrar um novo cliente.</DialogDescription>
                </DialogHeader>
                 <div className="flex-grow overflow-y-auto"><CompanyManagement /></div>
            </DialogContent>
        </Dialog>
        <Dialog open={isNewOwnerDialogOpen} onOpenChange={setIsNewOwnerDialogOpen}>
            <DialogContent className="max-w-7xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Adicionar Novo Proprietário</DialogTitle>
                    <DialogDescription>Preencha os dados abaixo para cadastrar um novo proprietário.</DialogDescription>
                </DialogHeader>
                 <div className="flex-grow overflow-y-auto"><OwnerManagement /></div>
            </DialogContent>
        </Dialog>
    </div>
  );
}

    