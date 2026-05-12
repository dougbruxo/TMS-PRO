
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileText, Truck, User, Calculator, Send, AlertTriangle } from 'lucide-react';
import { authFetch } from '@/lib/api-client';
import type { FleetVehicle, Driver } from '@/lib/types';

export default function CiotPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [selectedVehicle, setSelectedVehicle] = useState('');
    const [selectedDriver, setSelectedDriver] = useState('');
    const [vFrete, setVFrete] = useState('');
    const [vAdiantamento, setVAdiantamento] = useState('');
    const [origem, setOrigem] = useState('');
    const [destino, setDestino] = useState('');
    const [documentos, setDocumentos] = useState(''); // Chaves de CT-e separadas por vírgula

    useEffect(() => {
        if (!authLoading && (!user || !user.documentsAccess)) {
            router.push('/dashboard');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [vRes, dRes] = await Promise.all([
                    authFetch('/api/fleet'),
                    authFetch('/api/drivers')
                ]);
                if (vRes.ok) setVehicles(await vRes.json());
                if (dRes.ok) setDrivers(await dRes.json());
            } catch (error) {
                console.error("Erro ao carregar dados:", error);
            } finally {
                setIsLoadingData(false);
            }
        };
        if (user) fetchData();
    }, [user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedVehicle || !selectedDriver || !vFrete || !origem || !destino) {
            toast({ variant: 'destructive', title: "Campos Obrigatórios", description: "Por favor, preencha todos os campos básicos." });
            return;
        }

        setIsSubmitting(true);
        
        try {
            const res = await authFetch('/api/documents/ciot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vehicleId: selectedVehicle,
                    driverId: selectedDriver,
                    vFrete,
                    vAdiantamento: vAdiantamento || 0,
                    origem,
                    destino,
                    documentos
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Erro ao gerar CIOT");

            toast({
                title: "CIOT Gerado!",
                description: `Código: ${data.ciot} | Protocolo: ${data.protocolo}`,
            });

            // Limpar formulário ou redirecionar
            setVFrete('');
            setVAdiantamento('');
            setDocumentos('');
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Erro na Emissão", description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (authLoading || isLoadingData) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <main className="container mx-auto p-4 md:p-8">
            <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-primary/10 rounded-xl">
                    <FileText className="h-8 w-8 text-primary" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold">Gestão de CIOT</h1>
                    <p className="text-muted-foreground">Emissão do Código Identificador da Operação de Transporte</p>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <Card className="bg-card/60 backdrop-blur-xl border-border/50">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Truck className="h-5 w-5 text-primary" />
                                    1. Veículo e Motorista (TAC)
                                </CardTitle>
                                <CardDescription>Selecione o transportador autônomo e o veículo tracionado.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-6 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Veículo</Label>
                                    <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione o veículo" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {vehicles.map(v => (
                                                <SelectItem key={v._id} value={v._id}>{v.plate} - {v.brand} {v.model}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Motorista (TAC)</Label>
                                    <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione o motorista" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {drivers.map(d => (
                                                <SelectItem key={d._id} value={d._id}>{d.name} ({d.cpf})</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-card/60 backdrop-blur-xl border-border/50">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Calculator className="h-5 w-5 text-primary" />
                                    2. Valores do Frete
                                </CardTitle>
                                <CardDescription>Informe os valores negociados com o transportador.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-6 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Valor Total do Frete (R$)</Label>
                                    <Input 
                                        type="number" 
                                        placeholder="0.00" 
                                        value={vFrete}
                                        onChange={(e) => setVFrete(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Valor de Adiantamento (R$)</Label>
                                    <Input 
                                        type="number" 
                                        placeholder="0.00" 
                                        value={vAdiantamento}
                                        onChange={(e) => setVAdiantamento(e.target.value)}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-card/60 backdrop-blur-xl border-border/50">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Send className="h-5 w-5 text-primary" />
                                    3. Rota e Documentos
                                </CardTitle>
                                <CardDescription>Origem, destino e chaves dos documentos vinculados.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid gap-6 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>Cidade de Origem (IBGE)</Label>
                                        <Input placeholder="Ex: 3550308" value={origem} onChange={(e) => setOrigem(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Cidade de Destino (IBGE)</Label>
                                        <Input placeholder="Ex: 3304557" value={destino} onChange={(e) => setDestino(e.target.value)} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Chaves de Acesso (CT-e/NF-e)</Label>
                                    <Input 
                                        placeholder="Cole as chaves separadas por vírgula" 
                                        value={documentos}
                                        onChange={(e) => setDocumentos(e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground italic">O CIOT precisa estar vinculado ao documento fiscal transportado.</p>
                                </div>
                            </CardContent>
                            <CardFooter className="flex justify-end border-t border-border/50 p-6">
                                <Button size="lg" disabled={isSubmitting} className="w-full md:w-auto px-12">
                                    {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
                                    Gerar CIOT
                                </Button>
                            </CardFooter>
                        </Card>
                    </form>
                </div>

                <div className="space-y-8">
                    <Card className="bg-primary/5 border-primary/20">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-amber-500" />
                                Atenção Técnica
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm space-y-4 text-muted-foreground">
                            <p>O CIOT é obrigatório na contratação de TAC (Transportador Autônomo de Cargas) e equiparados.</p>
                            <p>Para concluir a integração, precisamos configurar as credenciais do seu provedor de pagamento de frete (IPEF) nas configurações fiscais.</p>
                            <div className="p-3 bg-background rounded border border-border/50">
                                <p className="font-mono text-xs text-primary font-bold">Aguardando definição do WebService/Provedor...</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </main>
    );
}
