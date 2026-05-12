
"use client";

import { useState, useMemo, useCallback, useRef, ChangeEvent, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Edit, Trash2, Search, XCircle, UserPlus, ChevronsUpDown, Box, Eye, Upload, Truck, Link as LinkIcon, X, KeyRound, CheckCircle, Star } from 'lucide-react';
import { StarRating } from './StarRating';
import type { Driver, Vehicle, FleetVehicle, VehicleOption } from '@/lib/types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { getInitials } from '@/lib/utils';
import { Separator } from './ui/separator';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import { ScrollArea } from './ui/scroll-area';
import { CompanyManagement } from './CompanyManagement';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { FleetOptionsManager } from './FleetOptionsManager';
import { FleetManagement } from './FleetManagement';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { authFetch } from '@/lib/api-client';

const driverFormSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres.'),
  cpf: z.string().min(11, 'CPF deve ter pelo menos 11 dígitos.'),
  phone1: z.string().min(10, 'Telefone deve ter pelo menos 10 dígitos.'),
  phone2: z.string().optional(),
  pixKey: z.string().optional(),
  mainVehicleId: z.string().optional(),
  linkedCarretaIds: z.array(z.string()).optional(),
  avatarUrl: z.string().optional(),
  cnhDocumentUrl: z.string().optional(),
  addressProofUrl: z.string().optional(),
  hasPortalAccess: z.boolean().default(false),
});

export function DriverManagement({ quickEditId, onQuickEditComplete, hideList }: { quickEditId?: string, onQuickEditComplete?: () => void, hideList?: boolean }) {
  const { fetchAddressByCnpj } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [fleetVehicles, setFleetVehicles] = useState<FleetVehicle[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const DRIVERS_PER_PAGE = 20;

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [driverToDelete, setDriverToDelete] = useState<Driver | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Driver[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();
  
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [cnhFile, setCnhFile] = useState<File | null>(null);
  const [addressProofFile, setAddressProofFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadingField, setUploadingField] = useState<'avatarUrl' | 'cnhDocumentUrl' | 'addressProofUrl' | null>(null);

  const [isVehicleSearchOpen, setIsVehicleSearchOpen] = useState(false);
  const [isNewVehicleDialogOpen, setIsNewVehicleDialogOpen] = useState(false);
  const [vehicleSearchTerm, setVehicleSearchTerm] = useState('');
  const [vehicleSearchResults, setVehicleSearchResults] = useState<FleetVehicle[]>([]);
  const [isSearchingVehicles, setIsSearchingVehicles] = useState(false);
  const [linkTarget, setLinkTarget] = useState<'main' | 'carreta'>('main');

  const form = useForm<z.infer<typeof driverFormSchema>>({
    resolver: zodResolver(driverFormSchema),
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [driversRes, fleetRes, typesRes] = await Promise.all([
        authFetch(`/api/drivers?page=${page}&limit=${DRIVERS_PER_PAGE}`),
        authFetch('/api/fleet'),
        authFetch('/api/fleet-options/vehicleTypes'),
      ]);
      if (driversRes.ok) {
        const newDrivers = await driversRes.json();
        setDrivers(prev => page === 1 ? newDrivers : [...prev, ...newDrivers]);
        setHasMore(newDrivers.length === DRIVERS_PER_PAGE);

        // Auto-trigger Quick Edit
        if (quickEditId && !editingDriver) {
           const target = newDrivers.find((d: any) => d.id === quickEditId);
           if (target) {
              handleOpenFormDialog(target);
           } else if (page === 1) {
              const resSingle = await authFetch(`/api/drivers/${quickEditId}`);
              if (resSingle.ok) {
                const single = await resSingle.json();
                handleOpenFormDialog(single);
              }
           }
        }
      } else {
        setHasMore(false);
      }
      if (fleetRes.ok) setFleetVehicles(await fleetRes.json());
      if (typesRes.ok) setVehicleTypes(await typesRes.json());
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro de Rede', description: 'Não foi possível carregar os dados.' });
    } finally {
      setIsLoading(false);
    }
  }, [toast, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData, page]);
  
  const onDataMutated = useCallback(async () => {
    setIsLoading(true);
    setIsSearchingVehicles(true);
    try {
      const [driversRes, fleetRes, typesRes] = await Promise.all([
        authFetch(`/api/drivers?page=1&limit=${page * DRIVERS_PER_PAGE}`), // Re-fetch all currently loaded pages
        authFetch('/api/fleet'),
        authFetch('/api/fleet-options/vehicleTypes'),
      ]);
      if (driversRes.ok) setDrivers(await driversRes.json());
      if (fleetRes.ok) setFleetVehicles(await fleetRes.json());
      if (typesRes.ok) setVehicleTypes(await typesRes.json());
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro de Rede', description: 'Não foi possível recarregar os dados.' });
    } finally {
      setIsLoading(false);
      setIsSearchingVehicles(false);
    }
  }, [toast, page]);

  const handleLoadMore = () => {
    setPage(prevPage => prevPage + 1);
  };
  
  const driversToDisplay = useMemo(() => {
    return searchResults !== null ? searchResults : drivers;
  }, [drivers, searchResults]);

  const resetFormState = () => {
    setEditingDriver(null);
    setAvatarFile(null);
    setCnhFile(null);
    setAddressProofFile(null);
    setAvatarPreview(null);
    form.reset({
      name: '', cpf: '', phone1: '', phone2: '', pixKey: '',
      mainVehicleId: '', linkedCarretaIds: [],
      avatarUrl: '', cnhDocumentUrl: '', addressProofUrl: '',
      hasPortalAccess: false,
    });
  };

  const handleOpenFormDialog = (driver: Driver | null) => {
    resetFormState();
    if (driver) {
      setEditingDriver(driver);
      setAvatarPreview(driver.avatarUrl ? `${driver.avatarUrl}` : null);
      form.reset({
          ...driver,
          linkedCarretaIds: driver.linkedCarretaIds || [],
      });
    }
    setIsFormDialogOpen(true);
  };
  
  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && uploadingField) {
        if(uploadingField === 'avatarUrl') {
            setAvatarFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setAvatarPreview(reader.result as string);
            reader.readAsDataURL(file);
        } else if (uploadingField === 'cnhDocumentUrl') {
            setCnhFile(file);
        } else if (uploadingField === 'addressProofUrl') {
            setAddressProofFile(file);
        }
    }
  };

  const triggerUpload = (fieldName: 'avatarUrl' | 'cnhDocumentUrl' | 'addressProofUrl') => {
      setUploadingField(fieldName);
      fileInputRef.current?.click();
  };

 const handleFormSubmit = async (values: z.infer<typeof driverFormSchema>) => {
    setIsSubmitting(true);
    try {
        let profileId = editingDriver?.id;
        
        const { avatarUrl, cnhDocumentUrl, addressProofUrl, ...dataToSave } = values;

        const endpoint = editingDriver ? `/api/drivers/${editingDriver.id}` : '/api/drivers';
        const method = editingDriver ? 'PUT' : 'POST';
        
        const response = await authFetch(endpoint, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataToSave),
        });

        const responseData = await response.json();
        if (!response.ok) throw new Error(responseData.message);

        if (!editingDriver) {
            profileId = responseData.id;
        }

        if (!profileId) {
          throw new Error("Não foi possível obter o ID do motorista para fazer o upload dos ficheiros.");
        }
        
        // UNIFIED UPLOAD LOGIC
        const uploadQueue: { file: File | null; type: 'avatarUrl' | 'cnhDocumentUrl' | 'addressProofUrl' }[] = [
            { file: avatarFile, type: 'avatarUrl' },
            { file: cnhFile, type: 'cnhDocumentUrl' },
            { file: addressProofFile, type: 'addressProofUrl' },
        ];

        for (const { file, type } of uploadQueue) {
            if (file) {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('type', type);
                
                const uploadResponse = await authFetch(`/api/drivers/${profileId}/upload`, {
                    method: 'POST',
                    body: formData,
                });
                if (!uploadResponse.ok) {
                    const uploadError = await uploadResponse.json();
                    // We still show success for the main form, but warn about the upload
                    toast({ variant: 'destructive', title: `Falha no Upload (${type})`, description: uploadError.message });
                }
            }
        }
        
        toast({ title: 'Sucesso!', description: `Motorista ${values.name} ${editingDriver ? 'atualizado' : 'adicionado'}.` });
        setIsFormDialogOpen(false);
        onDataMutated();
        if (onQuickEditComplete) onQuickEditComplete();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
        setIsSubmitting(false);
    }
};

  const handleDeleteDriver = async () => {
    if (!driverToDelete) return;
    setIsSubmitting(true);
    try {
        const response = await authFetch(`/api/drivers/${driverToDelete.id}`, { method: 'DELETE' });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Falha ao remover motorista.');
        }
        toast({ title: 'Sucesso!', description: 'Motorista removido.' });
        onDataMutated();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Erro ao Apagar', description: error.message });
    }
    setDriverToDelete(null);
    setIsSubmitting(false);
  };
  
    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchTerm.trim()) {
            setSearchResults(null);
            return;
        };

        setIsSearching(true);
        try {
            const response = await authFetch(`/api/drivers/search?term=${encodeURIComponent(searchTerm)}`);
            if (response.ok) {
                const results = await response.json();
                setSearchResults(results);
                if (results.length === 0) {
                    toast({ title: 'Nenhum resultado', description: 'Nenhum motorista encontrado.' });
                }
            } else {
                toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao buscar motoristas.' });
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

    const handleSelectVehicle = (vehicle: FleetVehicle) => {
        if (linkTarget === 'main') {
            form.setValue('mainVehicleId', vehicle.id);
        } else {
            const currentCarretas = form.getValues('linkedCarretaIds') || [];
            if (currentCarretas.length < 3) {
                form.setValue('linkedCarretaIds', [...currentCarretas, vehicle.id]);
            }
        }
        setIsVehicleSearchOpen(false);
    };

    const mainVehicle = useMemo(() => fleetVehicles.find(v => v.id === form.watch('mainVehicleId')), [fleetVehicles, form.watch('mainVehicleId')]);
    const linkedCarretas = useMemo(() => (form.watch('linkedCarretaIds') || []).map(id => fleetVehicles.find(v => v.id === id)).filter(Boolean) as FleetVehicle[], [fleetVehicles, form.watch('linkedCarretaIds')]);
    
    const normalize = (str: string) => str?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || '';
    const isCavaloMecanico = mainVehicle && normalize(mainVehicle.vehicleType) === 'cavalo mecanico';
    const showVincularCarreta = isCavaloMecanico && linkedCarretas.length < 3;

    const searchVehicles = useCallback(async (term: string, target: 'main' | 'carreta') => {
        setIsSearchingVehicles(true);
        try {
            // Fetch with limit 50 and search term
            const response = await authFetch(`/api/fleet?term=${encodeURIComponent(term)}&limit=50`);
            if (response.ok) {
                let results: FleetVehicle[] = await response.json();
                
                // Remove restrictive client-side filtering that hides vehicles
                // We trust the user to select the correct vehicle for 'main' vs 'carreta'
                // The backend API handles the robust search query now
                
                // Put the most relevant vehicles at the top (e.g., carretas for carreta target)
                const normalize = (str: string) => str?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || '';
                results = results.sort((a, b) => {
                    const aIsCarreta = normalize(a.vehicleType).includes('carreta') || normalize(a.bodyType).includes('carreta');
                    const bIsCarreta = normalize(b.vehicleType).includes('carreta') || normalize(b.bodyType).includes('carreta');
                    if (target === 'carreta') {
                        if (aIsCarreta && !bIsCarreta) return -1;
                        if (!aIsCarreta && bIsCarreta) return 1;
                    } else {
                        if (!aIsCarreta && bIsCarreta) return -1;
                        if (aIsCarreta && !bIsCarreta) return 1;
                    }
                    return 0;
                });

                setVehicleSearchResults(results);
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao buscar veículos.' });
        } finally {
            setIsSearchingVehicles(false);
        }
    }, [toast]);

    const vehicleSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const handleVehicleSearchChange = (term: string) => {
        setVehicleSearchTerm(term);
        if (vehicleSearchTimeoutRef.current) clearTimeout(vehicleSearchTimeoutRef.current);
        vehicleSearchTimeoutRef.current = setTimeout(() => {
            searchVehicles(term, linkTarget);
        }, 400);
    };

    useEffect(() => {
        if (isVehicleSearchOpen) {
            searchVehicles('', linkTarget);
        }
    }, [isVehicleSearchOpen, linkTarget, searchVehicles]);
  

  return (
    <div className={cn("relative w-full", quickEditId ? "hidden" : "block")}>
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*,.pdf" onChange={(e) => uploadingField && handleFileSelect(e)} />
      {!hideList && (
        <Card>
          <CardHeader>
            <div className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Motoristas Registrados</CardTitle>
                <CardDescription>Visualize, gerencie e pesquise os motoristas aqui.</CardDescription>
              </div>
              <Button onClick={() => handleOpenFormDialog(null)}><PlusCircle className="mr-2 h-4 w-4" /> Novo Motorista</Button>
            </div>
             <form onSubmit={handleSearch} className="flex w-full items-center space-x-2 mt-4">
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input placeholder="Pesquisar por nome, CPF, contato, placa..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" disabled={isSearching}/>
                </div>
                {searchResults !== null && (<Button type="button" variant="ghost" onClick={clearSearch}><XCircle className="mr-2 h-4 w-4"/>Limpar Busca</Button>)}
                <Button type="submit" disabled={isSearching}>{isSearching ? <Loader2 className="h-4 w-4 animate-spin"/> : <Search className="h-4 w-4"/>}</Button>
             </form>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Placa Principal</TableHead>
                    <TableHead>Portal</TableHead>
                    <TableHead>Avaliação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {isLoading && driversToDisplay.length === 0 ? (
                    Array.from({ length: 5 }).map((_, index) => (
                        <TableRow key={`skeleton-${index}`}>
                            <TableCell><div className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-full" /><Skeleton className="h-5 w-24" /></div></TableCell>
                            <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-9 w-24 ml-auto" /></TableCell>
                        </TableRow>
                    ))
                ) : (
                    driversToDisplay.map((driver) => {
                        const driverVehicle = fleetVehicles.find(v => v.id === driver.mainVehicleId);
                        return (
                            <TableRow key={driver.id}>
                                <TableCell className="font-medium flex items-center gap-2">
                                    <Avatar>
                                        <AvatarImage src={driver.avatarUrl ? `${driver.avatarUrl}?t=${new Date().getTime()}` : undefined} alt={driver.name} />
                                        <AvatarFallback>{getInitials(driver.name)}</AvatarFallback>
                                    </Avatar>
                                    {driver.name}
                                </TableCell>
                                <TableCell>{driver.cpf || 'N/A'}</TableCell>
                                <TableCell>{driver.phone1 || 'N/A'}</TableCell>
                                <TableCell>{driverVehicle?.plate || driver.licensePlate || 'N/A'}</TableCell>
                                <TableCell>
                                    <Badge variant={driver.hasPortalAccess ? 'default' : 'secondary'} className={driver.hasPortalAccess ? 'bg-green-600' : ''}>
                                        {driver.hasPortalAccess ? 'Ativo' : 'Inativo'}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {driver.ratingCount && driver.ratingCount > 0 ? (
                                        <div className="flex flex-col gap-0.5">
                                            <StarRating value={driver.rating || 0} readonly size={16} />
                                            <span className="text-[10px] text-muted-foreground">{driver.ratingCount} {driver.ratingCount === 1 ? 'avaliação' : 'avaliações'}</span>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-muted-foreground italic">Sem avaliações</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right space-x-1">
                                    <Button variant="outline" size="sm" onClick={() => handleOpenFormDialog(driver)}>
                                        <Edit className="mr-2 h-4 w-4" /> Editar
                                    </Button>
                                    <AlertDialog onOpenChange={(open) => !open && setDriverToDelete(null)}>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" onClick={() => setDriverToDelete(driver)} className="text-destructive hover:text-destructive">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Apagar Motorista?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Tem a certeza de que quer apagar {driverToDelete?.name}? Esta ação não pode ser desfeita.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction onClick={handleDeleteDriver} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
                                                    Apagar
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </TableCell>
                            </TableRow>
                        );
                    })
                )}
                   {driversToDisplay.length === 0 && !isLoading && !isSearching && (<TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">Nenhum motorista encontrado.</TableCell></TableRow>)}
                </TableBody>
              </Table>
              {hasMore && !isLoading && searchResults === null && (<div className="p-4 text-center"><Button onClick={handleLoadMore} variant="outline">Carregar Mais</Button></div>)}
            </div>
          </CardContent>
        </Card>
      )}
      
      <Dialog open={isFormDialogOpen} onOpenChange={(val) => {
         setIsFormDialogOpen(val);
         if (!val && onQuickEditComplete && quickEditId) onQuickEditComplete();
      }}>
        <DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>{editingDriver ? 'Editar Motorista' : 'Adicionar Novo Motorista'}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6 max-h-[80vh] overflow-y-auto p-1 pr-4">
                <div className="flex flex-col sm:flex-row gap-6 items-start">
                    <div className="flex flex-col items-center gap-2"><Avatar className="h-24 w-24"><AvatarImage src={avatarPreview || undefined} /><AvatarFallback>{getInitials(form.watch('name'))}</AvatarFallback></Avatar><Button type="button" size="sm" variant={avatarFile ? "default" : "outline"} className={cn("w-full", avatarFile && "bg-green-600 hover:bg-green-700")} onClick={() => triggerUpload('avatarUrl')}>
                        {avatarFile ? <CheckCircle className="mr-2 h-4 w-4" /> : <Upload className="mr-2 h-4 w-4" />}
                        {avatarFile ? avatarFile.name.substring(0,10)+'...' : 'Carregar Foto'}
                        </Button></div>
                    <div className="space-y-4 flex-grow">
                        <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Nome</FormLabel><FormControl><Input placeholder="Nome completo" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="cpf" render={({ field }) => ( <FormItem><FormLabel>CPF</FormLabel><FormControl><Input placeholder="Apenas números" {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                </div>
                <Separator />
                <h3 className="text-lg font-medium">Informações de Contato e Veículos</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="phone1" render={({ field }) => ( <FormItem><FormLabel>Telefone 1</FormLabel><FormControl><Input placeholder="(11) 99999-9999" {...field} /></FormControl><FormMessage /></FormItem> )} />
                  <FormField control={form.control} name="phone2" render={({ field }) => ( <FormItem><FormLabel>Telefone 2 (Opcional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                </div>
                <FormField control={form.control} name="pixKey" render={({ field }) => ( <FormItem><FormLabel>Chave PIX</FormLabel><FormControl><Input placeholder="Chave PIX para pagamentos" {...field} /></FormControl><FormMessage /></FormItem> )} />
                
                <div className="space-y-2">
                    <Label>Veículo Principal</Label>
                    <div className="border p-3 rounded-md flex items-center justify-between">
                        {mainVehicle ? (
                            <div className="flex items-center gap-2"><Truck className="h-4 w-4 text-primary"/> <span className="font-semibold">{mainVehicle.plate}</span> - <span>{mainVehicle.brand} {mainVehicle.model}</span></div>
                        ) : <p className="text-sm text-muted-foreground">Nenhum veículo vinculado.</p>}
                        <div className="flex items-center gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => { setLinkTarget('main'); setVehicleSearchTerm(''); setIsVehicleSearchOpen(true); }}>Vincular</Button>
                          <Button type="button" variant="outline" size="sm" disabled={isSubmitting} onClick={async () => {
                              if (!editingDriver) {
                                  // Auto-save driver before opening vehicle dialog to break the circular dependency
                                  const isValid = await form.trigger(['name', 'cpf', 'phone1']);
                                  if (!isValid) {
                                      toast({ variant: 'destructive', title: 'Campos Obrigatórios', description: 'Preencha Nome, CPF e Telefone antes de cadastrar um veículo.' });
                                      return;
                                  }
                                  setIsSubmitting(true);
                                  try {
                                      const values = form.getValues();
                                      const { avatarUrl, cnhDocumentUrl, addressProofUrl, ...dataToSave } = values;
                                      const response = await authFetch('/api/drivers', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify(dataToSave),
                                      });
                                      const responseData = await response.json();
                                      if (!response.ok) throw new Error(responseData.message);
                                      setEditingDriver({ ...dataToSave, id: responseData.id } as Driver);
                                      toast({ title: 'Motorista salvo!', description: `${values.name} foi salvo automaticamente para permitir o cadastro do veículo.` });
                                      onDataMutated();
                                  } catch (e: any) {
                                      toast({ variant: 'destructive', title: 'Erro ao salvar motorista', description: e.message });
                                      setIsSubmitting(false);
                                      return;
                                  } finally {
                                      setIsSubmitting(false);
                                  }
                              }
                              setIsNewVehicleDialogOpen(true);
                          }}>
                              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cadastrar'}
                          </Button>
                        </div>
                    </div>
                </div>
                
                {linkedCarretas.length > 0 && (
                    <div className="space-y-2">
                        <Label>Carretas Vinculadas</Label>
                        <div className="space-y-2">
                            {linkedCarretas.map((carreta, index) => (
                                <div key={carreta.id} className="border p-2 rounded-md flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2"><Truck className="h-4 w-4 text-muted-foreground"/> <span className="font-semibold">{carreta.plate}</span> - <span>{carreta.brand} {carreta.model}</span></div>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => form.setValue('linkedCarretaIds', linkedCarretas.filter(c => c.id !== carreta.id).map(c => c.id))}><X className="h-4 w-4"/></Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {showVincularCarreta && (
                    <Button type="button" variant="secondary" className="w-full" onClick={() => { setLinkTarget('carreta'); setVehicleSearchTerm(''); setIsVehicleSearchOpen(true); }}><LinkIcon className="mr-2 h-4 w-4"/>Vincular Carreta ({linkedCarretas.length}/3)</Button>
                )}
                
                <Separator />
                <h3 className="text-lg font-medium">Documentos</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>CNH do Motorista</Label>
                        <div className="flex items-center gap-2">
                            <Button type="button" variant={cnhFile ? "default" : "outline"} className={cn("w-full justify-start", cnhFile && "bg-green-600 hover:bg-green-700")} onClick={() => triggerUpload('cnhDocumentUrl')}>
                                {cnhFile ? <CheckCircle className="mr-2 h-4 w-4" /> : <Upload className="mr-2 h-4 w-4" />}
                                {cnhFile ? cnhFile.name.substring(0,15)+'...' : 'Carregar CNH'}
                            </Button>
                            {form.watch('cnhDocumentUrl') && !cnhFile && (<a href={`${form.watch('cnhDocumentUrl')}?t=${new Date().getTime()}`} target="_blank" rel="noopener noreferrer"><Button type="button" variant="secondary" size="icon"><Eye className="h-4 w-4" /></Button></a>)}
                        </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Comprovante de Endereço</Label>
                       <div className="flex items-center gap-2">
                          <Button type="button" variant={addressProofFile ? "default" : "outline"} className={cn("w-full justify-start", addressProofFile && "bg-green-600 hover:bg-green-700")} onClick={() => triggerUpload('addressProofUrl')}>
                              {addressProofFile ? <CheckCircle className="mr-2 h-4 w-4" /> : <Upload className="mr-2 h-4 w-4" />}
                              {addressProofFile ? addressProofFile.name.substring(0,10)+'...' : 'Carregar Comprovante'}
                          </Button>
                          {form.watch('addressProofUrl') && !addressProofFile && (<a href={`${form.watch('addressProofUrl')}?t=${new Date().getTime()}`} target="_blank" rel="noopener noreferrer"><Button type="button" variant="secondary" size="icon"><Eye className="h-4 w-4" /></Button></a>)}
                      </div>
                  </div>
                </div>
                <Separator />
                <h3 className="text-lg font-medium">Acesso ao Portal</h3>
                <FormField control={form.control} name="hasPortalAccess" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel className="text-base">Habilitar Acesso ao Portal</FormLabel><FormDescription>Permitir que este motorista faça login no portal com CPF e senha.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange}/></FormControl></FormItem>)}/>
                {form.watch('hasPortalAccess') && !editingDriver?.password && (<div className="p-4 bg-secondary/50 border rounded-md text-sm"><p className="font-semibold flex items-center gap-2"><KeyRound className="h-4 w-4"/> Senha Padrão</p><p className="text-muted-foreground">Ao criar o acesso, a senha inicial será <span className="font-bold text-primary">123456</span>. O motorista poderá alterá-la no primeiro login.</p></div>)}
                <DialogFooter className="pt-4"><DialogClose asChild><Button type="button" variant="secondary" disabled={isSubmitting}>Cancelar</Button></DialogClose><Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingDriver ? 'Salvar Alterações' : 'Adicionar Motorista'}
                </Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isVehicleSearchOpen} onOpenChange={setIsVehicleSearchOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Vincular {linkTarget === 'main' ? 'Veículo Principal' : 'Carreta'}</DialogTitle></DialogHeader>
            <div className="flex gap-2 pt-4">
                <Input placeholder="Buscar por placa, marca ou modelo..." value={vehicleSearchTerm} onChange={(e) => handleVehicleSearchChange(e.target.value)} />
            </div>
            <ScrollArea className="h-72 mt-4">
                {isSearchingVehicles ? (<div className="flex justify-center items-center h-72"><Loader2 className="h-6 w-6 animate-spin"/></div>
                ) : (
                    <div className="space-y-1">
                        {vehicleSearchResults.map(v => (
                            <div key={v.id} onClick={() => handleSelectVehicle(v)} className="p-2 hover:bg-accent rounded-md cursor-pointer flex items-center gap-3">
                                <Truck className="h-6 w-6 text-muted-foreground"/>
                                <div className="flex-grow">
                                    <p className="font-semibold">{v.plate}</p>
                                    <p className="text-xs text-muted-foreground">{v.brand} {v.model}</p>
                                </div>
                                {v.vehicleType && (
                                    <Badge variant="outline" className="text-xs whitespace-nowrap">
                                        {v.vehicleType}
                                    </Badge>
                                )}
                            </div>
                        ))}
                    </div>
                )}
                {!isSearchingVehicles && vehicleSearchResults.length === 0 && (<div className="text-center p-4 text-muted-foreground">Nenhum veículo encontrado.</div>)}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      
        <Dialog open={isNewVehicleDialogOpen} onOpenChange={setIsNewVehicleDialogOpen}>
            <DialogContent className="max-w-7xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Adicionar Novo Veículo</DialogTitle>
                    <DialogDescription>Preencha os dados abaixo para cadastrar um novo veículo. Após o cadastro, você poderá vinculá-lo a este motorista.</DialogDescription>
                </DialogHeader>
                <div className="flex-grow overflow-y-auto">
                    <FleetManagement onDataMutated={onDataMutated} />
                </div>
            </DialogContent>
        </Dialog>
    </div>
  );
}

    