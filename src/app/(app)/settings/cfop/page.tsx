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
import { Loader2, PlusCircle, Search, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { authFetch } from '@/lib/api-client';

const cfopSchema = z.object({
    code: z.string().length(4, 'O código CFOP deve ter exatamente 4 dígitos.'),
    description: z.string().min(5, 'A descrição deve ter pelo menos 5 caracteres.')
});

type Cfop = {
    id: string;
    code: string;
    description: string;
};

export default function CfopSettingsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [cfops, setCfops] = useState<Cfop[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const form = useForm<z.infer<typeof cfopSchema>>({
        resolver: zodResolver(cfopSchema),
        defaultValues: { code: '', description: '' }
    });

    useEffect(() => {
        if (authLoading) return;
        if (!user || user.role !== 'admin') {
            router.push('/dashboard');
            return;
        }
        fetchCfops();
    }, [user, authLoading, router]);

    const fetchCfops = async () => {
        setIsLoading(true);
        try {
            const response = await authFetch('/api/settings/cfop');
            if (response.ok) {
                const data = await response.json();
                setCfops(data);
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao carregar CFOPs.' });
        } finally {
            setIsLoading(false);
        }
    };

    const onSubmit = async (values: z.infer<typeof cfopSchema>) => {
        setIsSubmitting(true);
        try {
            const response = await authFetch('/api/settings/cfop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values)
            });

            if (response.ok) {
                toast({ title: 'Sucesso', description: 'CFOP adicionado com sucesso.' });
                setIsDialogOpen(false);
                form.reset();
                fetchCfops();
            } else {
                const error = await response.json();
                toast({ variant: 'destructive', title: 'Erro', description: error.message || 'Falha ao salvar CFOP.' });
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Erro na requisição.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredCfops = cfops.filter(cfop => 
        cfop.code.includes(searchTerm) || 
        cfop.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (authLoading || !user) {
        return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
    }

    return (
        <main className="container mx-auto p-4 md:p-8">
            <Button variant="outline" onClick={() => router.push('/settings')} className="mb-8">
                &larr; Voltar para Configurações
            </Button>

            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-primary">Códigos Fiscais (CFOP)</h1>
                    <p className="text-muted-foreground">Gerencie os CFOPs disponíveis para transporte.</p>
                </div>
                <Button onClick={() => setIsDialogOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Novo CFOP
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Pesquisar por código ou descrição..." 
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
                                    <TableHead className="w-[100px]">Código</TableHead>
                                    <TableHead>Descrição</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={2} className="text-center h-24"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                                ) : filteredCfops.length === 0 ? (
                                    <TableRow><TableCell colSpan={2} className="text-center h-24 text-muted-foreground">Nenhum CFOP encontrado.</TableCell></TableRow>
                                ) : (
                                    filteredCfops.map((cfop) => (
                                        <TableRow key={cfop.id}>
                                            <TableCell className="font-mono font-bold text-primary">{cfop.code}</TableCell>
                                            <TableCell>{cfop.description}</TableCell>
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
                        <DialogTitle>Novo Código Fiscal (CFOP)</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="code"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Código CFOP</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Ex: 5352" maxLength={4} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Descrição</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Descrição da operação" {...field} />
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
                                    Salvar CFOP
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </main>
    );
}
