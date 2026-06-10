"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Search, Trash2, Package } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { authFetch } from '@/lib/api-client';
import { BackButton } from '@/components/BackButton';
import { PageHeader } from '@/components/PageHeader';

const cargoTypeSchema = z.object({
    name: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres.')
});

type CargoType = {
    id: string;
    name: string;
};

export default function CargoTypesSettingsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [cargoTypes, setCargoTypes] = useState<CargoType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const form = useForm<z.infer<typeof cargoTypeSchema>>({
        resolver: zodResolver(cargoTypeSchema),
        defaultValues: { name: '' }
    });

    useEffect(() => {
        if (authLoading) return;
        if (!user || user.role !== 'admin') {
            router.push('/dashboard');
            return;
        }
        fetchCargoTypes();
    }, [user, authLoading, router]);

    const fetchCargoTypes = async () => {
        setIsLoading(true);
        try {
            const response = await authFetch('/api/settings/cargo-types');
            if (response.ok) {
                const data = await response.json();
                setCargoTypes(data);
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao carregar espécies de carga.' });
        } finally {
            setIsLoading(false);
        }
    };

    const onSubmit = async (values: z.infer<typeof cargoTypeSchema>) => {
        setIsSubmitting(true);
        try {
            const response = await authFetch('/api/settings/cargo-types', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values)
            });

            if (response.ok) {
                toast({ title: 'Sucesso', description: 'Espécie de carga adicionada com sucesso.' });
                setIsDialogOpen(false);
                form.reset();
                fetchCargoTypes();
            } else {
                const error = await response.json();
                toast({ variant: 'destructive', title: 'Erro', description: error.message || 'Falha ao salvar espécie de carga.' });
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Erro na requisição.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem a certeza que deseja excluir esta espécie de carga?')) return;
        
        try {
            const response = await authFetch(`/api/settings/cargo-types/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                toast({ title: 'Sucesso', description: 'Espécie de carga excluída com sucesso.' });
                fetchCargoTypes();
            } else {
                toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao excluir espécie de carga.' });
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Erro na requisição.' });
        }
    };

    const filteredCargoTypes = cargoTypes.filter(ct => 
        ct.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (authLoading || !user) {
        return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
    }

    return (
        <main className="container mx-auto p-4 md:p-8">
            <PageHeader
                icon={<Package className="h-4 w-4" />}
                badge="Configurações Globais"
                titlePrefix="Espécie da"
                titleHighlight="Carga"
                description="Gerencie as espécies de carga disponíveis para o CT-e."
                backHref="/settings"
                backLabel="Voltar para Configurações"
                actions={
                    <Button onClick={() => setIsDialogOpen(true)}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Nova Espécie
                    </Button>
                }
            />

            <Card>
                <CardHeader>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Pesquisar por nome..." 
                            className="pl-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nome</TableHead>
                                    <TableHead className="w-[100px] text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={2} className="text-center h-24"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                                ) : filteredCargoTypes.length === 0 ? (
                                    <TableRow><TableCell colSpan={2} className="text-center h-24 text-muted-foreground">Nenhuma espécie encontrada.</TableCell></TableRow>
                                ) : (
                                    filteredCargoTypes.map((ct) => (
                                        <TableRow key={ct.id}>
                                            <TableCell className="font-medium">{ct.name}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(ct.id)} className="text-destructive hover:text-destructive">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
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
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nova Espécie da Carga</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nome da Espécie</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Ex: CAIXAS, PALETES, DIVERSOS" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button type="button" variant="outline">Cancelar</Button>
                                </DialogClose>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Salvar
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </main>
    );
}
