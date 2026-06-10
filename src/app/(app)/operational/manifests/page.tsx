
"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, PlusCircle, Trash2, BookOpen, Edit, MoreVertical, Printer, ChevronRight, UserSearch, Search } from 'lucide-react';
import type { Manifest, Driver, Quote } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/api-client';
import { format } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/PageHeader';
import { printLoadingManifest } from '@/lib/print';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { QuoteCard } from '@/components/QuoteCard';

export default function ManifestsPage() {
    const { user, loading: authLoading, companyProfile } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [manifests, setManifests] = useState<Manifest[]>([]);
    const [isDataLoading, setIsDataLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [isManifestDialogOpen, setIsManifestDialogOpen] = useState(false);
    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

    const [manifestToEdit, setManifestToEdit] = useState<Manifest | null>(null);
    const [manifestDriverId, setManifestDriverId] = useState('');
    const [selectedQuoteIdsForManifest, setSelectedQuoteIdsForManifest] = useState<string[]>([]);
    const [stagedQuotesForManifest, setStagedQuotesForManifest] = useState<Quote[]>([]);
    const [manifestConsultationNumber, setManifestConsultationNumber] = useState('');
    const [driverPayments, setDriverPayments] = useState<Record<string, number>>({});
    
    // States for searching quotes within the dialog
    const [quoteSearchTerm, setQuoteSearchTerm] = useState('');
    const [searchedQuotes, setSearchedQuotes] = useState<Quote[]>([]);
    const [isSearchingQuotes, setIsSearchingQuotes] = useState(false);
    const searchQuotesTimeoutRef = useRef<NodeJS.Timeout | null>(null);


    const [isDriverSearchOpen, setIsDriverSearchOpen] = useState(false);
    const [driverSearchTerm, setDriverSearchTerm] = useState('');
    const [searchedDrivers, setSearchedDrivers] = useState<Driver[]>([]);
    const [isSearchingDrivers, setIsSearchingDrivers] = useState(false);
    const searchDriverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);

    const fetchManifests = useCallback(async () => {
        setIsDataLoading(true);
        try {
            const manifestsRes = await authFetch('/api/manifests');
            if (!manifestsRes.ok) {
                throw new Error('Falha ao carregar dados dos romaneios.');
            }
            setManifests(await manifestsRes.json());
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Erro de Carregamento", description: e.message });
        } finally {
            setIsDataLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        if (!authLoading && user?.operationalAccess) {
            fetchManifests();
        }
    }, [user, authLoading, fetchManifests]);
    
    // Debounced search for quotes in the dialog
    const searchQuotesForManifest = useCallback(async (term: string) => {
        if (term.length < 2) {
            setSearchedQuotes([]);
            return;
        }
        setIsSearchingQuotes(true);
        try {
            const response = await authFetch(`/api/quotes/search-for-manifest?term=${encodeURIComponent(term)}`);
            if (response.ok) {
                setSearchedQuotes(await response.json());
            } else {
                toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível buscar cotações.'});
                setSearchedQuotes([]);
            }
        } catch (error) {
            console.error("Failed to search quotes:", error);
        } finally {
            setIsSearchingQuotes(false);
        }
    }, [toast]);
    
    const handleQuoteSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const term = event.target.value;
        setQuoteSearchTerm(term);
        if (searchQuotesTimeoutRef.current) {
            clearTimeout(searchQuotesTimeoutRef.current);
        }
        searchQuotesTimeoutRef.current = setTimeout(() => {
            searchQuotesForManifest(term);
        }, 500);
    };

    const searchDrivers = useCallback(async (term: string) => {
        if (term.length < 2) {
            setSearchedDrivers([]);
            return;
        }
        setIsSearchingDrivers(true);
        try {
            const response = await authFetch(`/api/drivers/search?term=${encodeURIComponent(term)}`);
            if (response.ok) {
                setSearchedDrivers(await response.json());
            } else {
                setSearchedDrivers([]);
            }
        } catch (error: any) {
            console.error("Failed to search for drivers:", error);
            toast({ variant: 'destructive', title: 'Erro de Busca', description: 'Não foi possível buscar os motoristas.' });
        } finally {
            setIsSearchingDrivers(false);
        }
    }, [toast]);

    const handleDriverSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const term = event.target.value;
        setDriverSearchTerm(term);

        if (searchDriverTimeoutRef.current) {
            clearTimeout(searchDriverTimeoutRef.current);
        }
        
        searchDriverTimeoutRef.current = setTimeout(() => {
            searchDrivers(term);
        }, 500);
    };
    
    const handleQuoteSelectionChange = (quote: Quote, isSelected: boolean) => {
        if (isSelected) {
            if (!selectedQuoteIdsForManifest.includes(quote.id)) {
                setSelectedQuoteIdsForManifest(prev => [...prev, quote.id]);
                setStagedQuotesForManifest(prev => [...prev, quote]);
            }
        } else {
            setSelectedQuoteIdsForManifest(prev => prev.filter(id => id !== quote.id));
            setStagedQuotesForManifest(prev => prev.filter(q => q.id !== quote.id));
        }
    };


    const selectedDriverName = useMemo(() => {
        return selectedDriver?.name || '';
    }, [selectedDriver]);

    const resetCreateDialog = () => {
        setIsManifestDialogOpen(false);
        setIsPaymentDialogOpen(false);
        setSelectedQuoteIdsForManifest([]);
        setStagedQuotesForManifest([]);
        setManifestDriverId('');
        setSelectedDriver(null);
        setManifestConsultationNumber('');
        setDriverPayments({});
        setManifestToEdit(null);
        setDriverSearchTerm('');
        setSearchedDrivers([]);
        setQuoteSearchTerm('');
        setSearchedQuotes([]);
    };

    const handleOpenPaymentDialog = () => {
        if (!manifestDriverId || selectedQuoteIdsForManifest.length === 0 || !manifestConsultationNumber.trim()) {
            toast({ variant: 'destructive', title: 'Erro de Validação', description: 'Selecione um motorista, ao menos uma cotação e insira o número da consulta.' });
            return;
        }

        const initialPayments: Record<string, number> = {};
        selectedQuoteIdsForManifest.forEach(id => {
            initialPayments[id] = 0;
        });
        setDriverPayments(initialPayments);

        setIsManifestDialogOpen(false);
        setIsPaymentDialogOpen(true);
    };

    const handleOpenEditDialog = async (manifest: Manifest) => {
        setManifestToEdit(manifest);
        const driverRes = await authFetch(`/api/drivers/${manifest.driverId}`);
        if(driverRes.ok) {
            setSelectedDriver(await driverRes.json());
        }
        setManifestDriverId(manifest.driverId);
        setManifestConsultationNumber(manifest.consultationNumber);
        setIsManifestDialogOpen(true);
    };

    const handleSaveManifest = useCallback(async () => {
        if (!manifestDriverId || !manifestConsultationNumber || !user) return;
    
        const isEditing = !!manifestToEdit;
        const quoteIds = isEditing ? (manifestToEdit.quotes || []).map(q => q.quoteId) : selectedQuoteIdsForManifest;
        
        let payments: Record<string, number> = {};
        if (!isEditing) {
            payments = driverPayments;
        } else if (manifestToEdit) {
            payments = manifestToEdit.quotes.reduce((acc, q) => ({...acc, [q.quoteId]: q.driverPaymentAmount || 0}), {} as Record<string, number>);
        }
    
        const hasInvalidPayment = !isEditing && Object.values(payments).some(val => typeof val !== 'number' || val <= 0);
        if (hasInvalidPayment) {
            toast({ variant: 'destructive', title: 'Valores Inválidos', description: 'Todos os valores de pagamento devem ser preenchidos e maiores que zero.' });
            return;
        }
    
        setIsSubmitting(true);
        try {
            const endpoint = isEditing ? `/api/manifests/${manifestToEdit!.id}` : '/api/manifests';
            const method = isEditing ? 'PUT' : 'POST';
    
            const body: any = {
                driverId: manifestDriverId,
                consultationNumber: manifestConsultationNumber,
                user: { id: user.id, username: user.username }
            };

            if (!isEditing) {
              body.quoteIds = quoteIds;
              body.payments = payments;
            }
    
            const response = await authFetch(endpoint, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
    
            if (response.ok) {
                toast({ title: 'Sucesso!', description: `Romaneio ${isEditing ? 'atualizado' : 'criado'}.` });
                await fetchManifests();
                resetCreateDialog();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || `Falha ao ${isEditing ? 'atualizar' : 'criar'} o romaneio.`);
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: `Erro ao ${isEditing ? 'Atualizar' : 'Criar'} Romaneio`, description: e.message });
        } finally {
            setIsSubmitting(false);
        }
    }, [manifestDriverId, manifestToEdit, selectedQuoteIdsForManifest, manifestConsultationNumber, driverPayments, toast, fetchManifests, user]);

    const handleDeleteManifest = async (manifestId: string) => {
        setIsSubmitting(true);
        try {
            const response = await authFetch(`/api/manifests/${manifestId}`, { method: 'DELETE' });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Falha ao apagar romaneio.');
            }
            toast({ title: 'Sucesso!', description: 'Romaneio apagado e cotações revertidas.' });
            await fetchManifests();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Erro', description: e.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const sortedManifests = useMemo(() => {
        return [...manifests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [manifests]);

    if (isDataLoading || authLoading || !user) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }
    
    const isAdmin = user?.role === 'admin';
    const canCreateEdit = isAdmin || !!user?.subPermissions?.operational?.canCreateJourney;
    const canDelete = isAdmin || !!user?.subPermissions?.operational?.canDeleteJourney;

    return (
        <main className="container mx-auto p-4 md:p-8 relative overflow-hidden">
            {/* Efeitos de desfoque e brilho aurora neon atrás dos cards */}
            <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/15 rounded-full blur-[100px] pointer-events-none -z-10 animate-float-blur-1" />
            <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-purple-500/15 rounded-full blur-[120px] pointer-events-none -z-10 animate-float-blur-2" />

            <PageHeader
                icon={<BookOpen className="h-4 w-4" />}
                badge="Romaneios"
                titlePrefix="Gerenciar"
                titleHighlight="Romaneios"
                description="Crie novos romaneios e visualize os que já foram gerados."
                backHref="/operational"
                backLabel="Voltar para Área Operacional"
            />

            {canCreateEdit && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    <Card className="flex flex-col w-full border border-border/40 bg-card/45 backdrop-blur-2xl shadow-xl rounded-2xl relative overflow-hidden p-6 hover:shadow-2xl hover:border-primary/20 transition-all duration-300 cursor-pointer" onClick={() => { setManifestToEdit(null); setIsManifestDialogOpen(true); }}>
                        <CardHeader className="flex-row items-center gap-4 space-y-0 pb-4 p-0">
                            <PlusCircle className="h-8 w-8 text-primary" />
                            <div className="flex-grow">
                                <CardTitle className="text-xl font-bold">Criar Novo Romaneio</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-grow p-0 mt-3">
                            <CardDescription className="text-sm text-muted-foreground">Agrupe cotações que estão no galpão para criar um novo romaneio de carregamento.</CardDescription>
                        </CardContent>
                    </Card>
                </div>
            )}
            
            <Card className="border border-border/40 bg-card/45 backdrop-blur-2xl shadow-xl rounded-2xl relative overflow-hidden p-6 hover:shadow-2xl transition-all duration-300">
                <CardHeader className="p-0 pb-5">
                    <CardTitle className="text-xl font-bold">Romaneios Gerados</CardTitle>
                    <CardDescription className="text-sm text-muted-foreground">Lista de todos os romaneios criados no sistema.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="border rounded-xl overflow-hidden bg-background/30 backdrop-blur-md max-h-[60vh] overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Código</TableHead>
                                    <TableHead>Motorista</TableHead>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedManifests.length > 0 ? sortedManifests.map(m => (
                                    <TableRow key={m.id}>
                                        <TableCell>{m.manifestCode}</TableCell>
                                        <TableCell>{m.driverName}</TableCell>
                                        <TableCell>{format(new Date(m.createdAt), 'dd/MM/yyyy')}</TableCell>
                                        <TableCell><Badge variant={m.status === 'Pendente' ? 'secondary' : 'default'} className={m.status === 'Finalizado' ? 'bg-green-600' : ''}>{m.status}</Badge></TableCell>
                                        <TableCell className="text-right">
                                             <Button variant="ghost" size="icon" onClick={() => companyProfile && printLoadingManifest(m, companyProfile)}>
                                                <Printer className="h-4 w-4"/>
                                             </Button>
                                             <AlertDialog>
                                                <DropdownMenu modal={false}>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4"/></Button>
                                                    </DropdownMenuTrigger>
                                                          {(canCreateEdit || canDelete) && (
                                                            <DropdownMenuContent>
                                                                {canCreateEdit && <DropdownMenuItem onSelect={() => handleOpenEditDialog(m)}><Edit className="mr-2 h-4 w-4"/>Editar</DropdownMenuItem>}
                                                                {canDelete && (
                                                                    <AlertDialogTrigger asChild>
                                                                        <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={(e) => e.preventDefault()}><Trash2 className="mr-2 h-4 w-4"/>Apagar</DropdownMenuItem>
                                                                    </AlertDialogTrigger>
                                                                )}
                                                            </DropdownMenuContent>
                                                          )}
                                                      </DropdownMenu>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Apagar Romaneio?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Esta ação não pode ser desfeita. Apagar o romaneio <span className="font-bold">{m.manifestCode}</span> irá fazer com que todas as cotações associadas voltem ao status "No Galpão".
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteManifest(m.id)} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
                                                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Apagar'}
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                             </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">Nenhum romaneio gerado.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isManifestDialogOpen} onOpenChange={(open) => { if(!open) resetCreateDialog(); setIsManifestDialogOpen(open); }}>
                <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>{manifestToEdit ? `Editar Romaneio ${manifestToEdit?.manifestCode}` : 'Criar Novo Romaneio'}</DialogTitle>
                        <DialogDescription>{manifestToEdit ? 'Altere o motorista ou o número da consulta.' : 'Selecione o motorista, o número da consulta e as cotações que ele irá carregar.'}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 flex-grow overflow-hidden flex flex-col">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Motorista</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="driverName"
                                        readOnly
                                        value={selectedDriverName}
                                        placeholder="Pesquisar e selecionar motorista..."
                                        className="flex-grow"
                                    />
                                    <Button type="button" variant="outline" size="icon" onClick={() => setIsDriverSearchOpen(true)}><UserSearch className="h-4 w-4"/></Button>
                                </div>
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="manifestConsultationNumber">Nº da Consulta</Label>
                                <Input
                                    id="manifestConsultationNumber"
                                    value={manifestConsultationNumber}
                                    onChange={(e) => setManifestConsultationNumber(e.target.value)}
                                    placeholder="Até 10 dígitos"
                                    maxLength={10}
                                />
                            </div>
                        </div>
                        {!manifestToEdit && (
                        <>
                            <Separator />
                            <div className="flex-shrink-0">
                                <Label>Cotações Selecionadas ({stagedQuotesForManifest.length})</Label>
                                <ScrollArea className="h-40 border rounded-md mt-2">
                                    {stagedQuotesForManifest.length > 0 ? (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Cotação</TableHead>
                                                    <TableHead>Destino</TableHead>
                                                    <TableHead className="text-right">Ações</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {stagedQuotesForManifest.map(q => (
                                                    <TableRow key={`staged-${q.id}`}>
                                                        <TableCell>{q.quoteCode}</TableCell>
                                                        <TableCell>{q.cidadeDestino}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="ghost" size="icon" onClick={() => handleQuoteSelectionChange(q, false)}>
                                                                <Trash2 className="h-4 w-4 text-destructive"/>
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                            Nenhuma cotação selecionada.
                                        </div>
                                    )}
                                </ScrollArea>
                            </div>
                            <div className="flex-grow flex flex-col min-h-0">
                                <Label>Adicionar Cotações (disponíveis no galpão)</Label>
                                <div className="relative w-full mt-2">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar por código, destino, NF..."
                                        value={quoteSearchTerm}
                                        onChange={handleQuoteSearchChange}
                                        className="pl-10"
                                    />
                                </div>
                                <ScrollArea className="flex-grow border rounded-md mt-2">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[50px]"></TableHead>
                                                <TableHead>Cotação</TableHead>
                                                <TableHead>Destino</TableHead>
                                                <TableHead>NF</TableHead>
                                                <TableHead>Volumes</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {isSearchingQuotes ? (
                                                <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></TableCell></TableRow>
                                            ) : searchedQuotes.length > 0 ? searchedQuotes.map(q => (
                                                <TableRow key={q.id}>
                                                    <TableCell>
                                                        <Checkbox
                                                            checked={selectedQuoteIdsForManifest.includes(q.id)}
                                                            onCheckedChange={(checked) => handleQuoteSelectionChange(q, !!checked)}
                                                        />
                                                    </TableCell>
                                                    <TableCell>{q.quoteCode}</TableCell>
                                                    <TableCell>{q.cidadeDestino}</TableCell>
                                                    <TableCell>{q.nfNumber || 'N/A'}</TableCell>
                                                    <TableCell>{q.volumeCount || 'N/A'}</TableCell>
                                                </TableRow>
                                            )) : (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">Digite para buscar cotações no galpão.</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            </div>
                        </>
                        )}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
                        {manifestToEdit ? (
                            <Button onClick={handleSaveManifest} disabled={isSubmitting || !manifestDriverId || !manifestConsultationNumber}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Salvar Alterações'}
                            </Button>
                        ) : (
                            <Button onClick={handleOpenPaymentDialog} disabled={isSubmitting || !manifestDriverId || selectedQuoteIdsForManifest.length === 0 || !manifestConsultationNumber}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ChevronRight className="mr-2 h-4 w-4"/>}
                                Avançar para Pagamento
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <QuoteCard.ManifestPaymentDialog
                isOpen={isPaymentDialogOpen}
                onOpenChange={setIsPaymentDialogOpen}
                onConfirm={handleSaveManifest}
                isSubmitting={isSubmitting}
                selectedQuotes={stagedQuotesForManifest}
                driverPayments={driverPayments}
                setDriverPayments={setDriverPayments}
                onBack={() => {
                    setIsPaymentDialogOpen(false);
                    setIsManifestDialogOpen(true);
                }}
            />
             <QuoteCard.DriverSearchDialog
                isOpen={isDriverSearchOpen}
                onOpenChange={setIsDriverSearchOpen}
                drivers={searchedDrivers}
                isLoading={isSearchingDrivers}
                onSelectDriver={(driver) => {
                    setSelectedDriver(driver as Driver);
                    setManifestDriverId((driver as Driver).id);
                    setIsDriverSearchOpen(false);
                    setDriverSearchTerm('');
                    setSearchedDrivers([]);
                }}
                searchTerm={driverSearchTerm}
                onSearchTermChange={handleDriverSearchChange}
            />

            <style>{`
              @keyframes floatBlur1 {
                0%, 100% {
                  transform: translate(0, 0) scale(1);
                  background-color: hsl(var(--primary) / 0.15);
                }
                25% {
                  transform: translate(120px, 60px) scale(1.15);
                  background-color: rgba(99, 102, 241, 0.18);
                }
                50% {
                  transform: translate(40px, 160px) scale(0.95);
                  background-color: rgba(236, 72, 153, 0.14);
                }
                75% {
                  transform: translate(-80px, 100px) scale(1.08);
                  background-color: rgba(59, 130, 246, 0.18);
                }
              }

              @keyframes floatBlur2 {
                0%, 100% {
                  transform: translate(0, 0) scale(1);
                  background-color: rgba(168, 85, 247, 0.15);
                }
                33% {
                  transform: translate(-100px, -120px) scale(1.1);
                  background-color: rgba(59, 130, 246, 0.16);
                }
                66% {
                  transform: translate(80px, -60px) scale(0.9);
                  background-color: rgba(236, 72, 153, 0.14);
                }
              }

              .animate-float-blur-1 {
                animation: floatBlur1 28s infinite ease-in-out alternate !important;
              }

              .animate-float-blur-2 {
                animation: floatBlur2 38s infinite ease-in-out alternate !important;
              }
            `}</style>
        </main>
    );
}

