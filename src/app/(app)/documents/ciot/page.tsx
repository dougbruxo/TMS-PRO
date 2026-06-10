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
import { Loader2, FileText, Truck, Calculator, Send, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { authFetch } from '@/lib/api-client';
import type { FleetVehicle, Driver } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';

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
    const [lastQueriedKey, setLastQueriedKey] = useState('');

    // ANTT 2026 States
    const [tipoOperacao, setTipoOperacao] = useState('Carga Lotação');
    const [cargoType, setCargoType] = useState('Geral');
    const [distanceKm, setDistanceKm] = useState<number | null>(null);
    const [minFreight, setMinFreight] = useState<number | null>(null);
    const [isCheckingFreight, setIsCheckingFreight] = useState(false);

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

    // Cálculo dinâmico do piso mínimo de frete da ANTT
    useEffect(() => {
        const checkMinFreight = async () => {
            if (!selectedVehicle || !origem || !destino) {
                setMinFreight(null);
                setDistanceKm(null);
                return;
            }

            const vehicleObj = vehicles.find(v => v._id === selectedVehicle);
            if (!vehicleObj || !vehicleObj.axles) {
                setMinFreight(null);
                setDistanceKm(null);
                return;
            }

            setIsCheckingFreight(true);
            try {
                // 1. Obter a distância da rota via Nominatim + OpenRouteService
                const routeUrl = `/api/location/route?origin=${encodeURIComponent(origem)}&dest=${encodeURIComponent(destino)}`;
                const routeRes = await authFetch(routeUrl);
                if (!routeRes.ok) throw new Error("Erro ao traçar rota");
                const routeData = await routeRes.json();
                setDistanceKm(routeData.distanceKm);

                // 2. Calcular o piso mínimo de frete via API ANTT
                const calcUrl = `/api/antt/calculate?distance=${routeData.distanceKm}&axles=${vehicleObj.axles}&cargoType=${encodeURIComponent(cargoType)}`;
                const calcRes = await authFetch(calcUrl);
                if (!calcRes.ok) throw new Error("Erro ao calcular frete mínimo");
                const calcData = await calcRes.json();
                setMinFreight(calcData.total);
            } catch (error) {
                console.error("Erro no cálculo do piso mínimo:", error);
                setMinFreight(null);
                setDistanceKm(null);
            } finally {
                setIsCheckingFreight(false);
            }
        };

        const timer = setTimeout(() => {
            checkMinFreight();
        }, 800);

        return () => clearTimeout(timer);
    }, [selectedVehicle, origem, destino, cargoType, vehicles]);

    // Buscar dados do CT-e automaticamente quando a chave for inserida
    useEffect(() => {
        const matches = documentos.match(/\b\d{44}\b/);
        if (!matches) return;

        const chaveCte = matches[0];
        if (chaveCte === lastQueriedKey) return;

        const fetchCteDetails = async () => {
            setLastQueriedKey(chaveCte);
            try {
                const res = await authFetch(`/api/documents/cte-search?chave=${chaveCte}`);
                if (!res.ok) return;
                
                const data = await res.json();
                if (data) {
                    if (data.cidadeOrigem) setOrigem(data.cidadeOrigem);
                    if (data.cidadeDestino) setDestino(data.cidadeDestino);
                    if (data.vFrete !== undefined) setVFrete(String(data.vFrete));
                    if (data.vAdiantamento !== undefined) setVAdiantamento(String(data.vAdiantamento));
                    
                    if (data.driverId) {
                        const driverExists = drivers.some(d => d._id === data.driverId);
                        if (driverExists) {
                            setSelectedDriver(data.driverId);
                        }
                    }
                    if (data.vehicleId) {
                        const vehicleExists = vehicles.some(v => v._id === data.vehicleId);
                        if (vehicleExists) {
                            setSelectedVehicle(data.vehicleId);
                        }
                    }
                    
                    toast({
                        title: "Dados Preenchidos",
                        description: "Rota, valores e motorista preenchidos a partir do CT-e.",
                    });
                }
            } catch (error) {
                console.error("Erro ao buscar detalhes do CT-e:", error);
            }
        };

        fetchCteDetails();
    }, [documentos, lastQueriedKey, drivers, vehicles, toast]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedVehicle || !selectedDriver || !vFrete || !origem || !destino) {
            toast({ variant: 'destructive', title: "Campos Obrigatórios", description: "Por favor, preencha todos os campos básicos." });
            return;
        }

        // Bloqueio preventivo no frontend caso esteja abaixo do piso mínimo legal
        if (minFreight !== null && Number(vFrete) < minFreight) {
            toast({
                variant: 'destructive',
                title: "Frete Abaixo do Piso",
                description: `A emissão foi travada. O frete negociado (R$ ${Number(vFrete).toFixed(2)}) é inferior ao piso mínimo obrigatório da ANTT (R$ ${minFreight.toFixed(2)}) para esta rota.`
            });
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
                    documentos,
                    distanceKm: distanceKm || 0,
                    tipoOperacao,
                    cargoType
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Erro ao gerar CIOT");

            toast({
                title: "CIOT Gerado!",
                description: `Código: ${data.ciot} | Protocolo: ${data.protocolo}`,
            });

            // Limpar formulário
            setVFrete('');
            setVAdiantamento('');
            setDocumentos('');
            setLastQueriedKey('');
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
        <main className="container mx-auto p-4 md:p-8 relative overflow-hidden">
            {/* Efeitos de desfoque e brilho aurora neon atrás dos cards */}
            <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/15 rounded-full blur-[100px] pointer-events-none -z-10 animate-float-blur-1" />
            <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-purple-500/15 rounded-full blur-[120px] pointer-events-none -z-10 animate-float-blur-2" />

            <PageHeader
                icon={<FileText className="h-4 w-4" />}
                badge="CIOT"
                titlePrefix="Gestão de"
                titleHighlight="CIOT"
                description="Emissão e conformidade do Código Identificador da Operação de Transporte (CIOT para Todos - Regulação 2026)."
                backHref="/documents"
                backLabel="Voltar para Documentos"
            />

            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <Card className="border border-border/40 bg-card/45 backdrop-blur-2xl shadow-xl rounded-2xl relative overflow-hidden transition-all duration-300 hover:shadow-2xl">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Truck className="h-5 w-5 text-primary" />
                                    1. Veículo e Motorista (Operação de Carga)
                                </CardTitle>
                                <CardDescription>Selecione o veículo da frota e o transportador autônomo (TAC) ou próprio (ETC).</CardDescription>
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
                                                <SelectItem key={v._id} value={v._id}>{v.plate} - {v.brand} {v.model} ({v.axles || 2} eixos)</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Motorista / Contratado</Label>
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

                        <Card className="border border-border/40 bg-card/45 backdrop-blur-2xl shadow-xl rounded-2xl relative overflow-hidden transition-all duration-300 hover:shadow-2xl">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Calculator className="h-5 w-5 text-primary" />
                                    2. Valores e Custos do Frete
                                </CardTitle>
                                <CardDescription>Valores negociados para a operação do frete rodoviário.</CardDescription>
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

                        <Card className="border border-border/40 bg-card/45 backdrop-blur-2xl shadow-xl rounded-2xl relative overflow-hidden transition-all duration-300 hover:shadow-2xl">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Send className="h-5 w-5 text-primary" />
                                    3. Rota, Classificação e Documentação
                                </CardTitle>
                                <CardDescription>Localização, classificação ANTT 2026 e documentos associados.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid gap-6 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>Tipo de Operação (Regulação 2026)</Label>
                                        <Select value={tipoOperacao} onValueChange={setTipoOperacao}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione o tipo de operação" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Carga Lotação">Carga Lotação</SelectItem>
                                                <SelectItem value="Carga Fracionada">Carga Fracionada</SelectItem>
                                                <SelectItem value="TAC-Agregado">TAC-Agregado</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Tipo de Carga (Piso ANTT)</Label>
                                        <Select value={cargoType} onValueChange={setCargoType}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione o tipo de carga" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Geral">Carga Geral</SelectItem>
                                                <SelectItem value="Granel Sólido">Granel Sólido</SelectItem>
                                                <SelectItem value="Granel Líquido">Granel Líquido</SelectItem>
                                                <SelectItem value="Frigorificada">Frigorificada ou Aquecida</SelectItem>
                                                <SelectItem value="Conteinerizada">Conteinerizada</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid gap-6 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>Cidade de Origem (IBGE ou Nome, UF)</Label>
                                        <Input placeholder="Ex: RIO CLARO - SP" value={origem} onChange={(e) => setOrigem(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Cidade de Destino (IBGE ou Nome, UF)</Label>
                                        <Input placeholder="Ex: BELO HORIZONTE - MG" value={destino} onChange={(e) => setDestino(e.target.value)} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Chaves de Acesso Vinculadas (CT-e/NF-e)</Label>
                                    <Input 
                                        placeholder="Cole as chaves separadas por vírgula" 
                                        value={documentos}
                                        onChange={(e) => setDocumentos(e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground italic">Conforme a Portaria SUROC nº 16/2026, é obrigatória a vinculação de todos os documentos fiscais da viagem.</p>
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
                    {/* CARD DE CONFORMIDADE DE PISO MÍNIMO */}
                    <Card className="border border-border/40 bg-card/45 backdrop-blur-2xl shadow-xl rounded-2xl relative overflow-hidden transition-all duration-300 hover:shadow-2xl">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Calculator className="h-5 w-5 text-primary" />
                                Conformidade ANTT
                            </CardTitle>
                            <CardDescription>Cálculo do piso mínimo em tempo real (Resolução 6.078/2026).</CardDescription>
                        </CardHeader>
                        <CardContent className="text-sm space-y-4">
                            {isCheckingFreight ? (
                                <div className="flex items-center gap-2 text-muted-foreground py-2 justify-center">
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                    <span>Calculando piso de frete...</span>
                                </div>
                            ) : minFreight !== null && distanceKm !== null ? (
                                <div className="space-y-3">
                                    <div className="flex justify-between text-xs border-b border-border/30 pb-1.5">
                                        <span className="text-muted-foreground">Distância da rota:</span>
                                        <span className="font-bold text-foreground">{distanceKm.toFixed(2)} KM</span>
                                    </div>
                                    <div className="flex justify-between text-xs border-b border-border/30 pb-1.5">
                                        <span className="text-muted-foreground">Veículo (Eixos):</span>
                                        <span className="font-bold text-foreground">
                                            {vehicles.find(v => v._id === selectedVehicle)?.axles || 2} eixos
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-xs border-b border-border/30 pb-1.5">
                                        <span className="text-muted-foreground">Tipo de Carga:</span>
                                        <span className="font-bold text-foreground">{cargoType}</span>
                                    </div>
                                    <div className="flex justify-between text-xs border-b border-border/30 pb-1.5">
                                        <span className="text-muted-foreground">Frete Mínimo ANTT:</span>
                                        <span className="font-extrabold text-primary">R$ {minFreight.toFixed(2)}</span>
                                    </div>

                                    {vFrete ? (
                                        Number(vFrete) >= minFreight ? (
                                            <div className="flex items-center gap-2 p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-xl text-xs font-semibold mt-2">
                                                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                                                <span>Valor Conforme com o Piso ANTT!</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 p-2.5 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-xs font-semibold mt-2">
                                                <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                                                <span>Abaixo do Piso (Bloqueado no Envio)</span>
                                            </div>
                                        )
                                    ) : null}
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground italic text-center py-4">
                                    Preencha o veículo, origem e destino para calcular a rota e o piso mínimo de frete.
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="bg-primary/5 border border-primary/20 backdrop-blur-md rounded-2xl shadow-lg relative overflow-hidden">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-amber-500" />
                                Regras do CIOT 2026
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm space-y-4 text-muted-foreground">
                            <p>O CIOT é obrigatório para todas as operações remuneradas. A vinculação ao MDF-e deve ser feita antes de iniciar a viagem.</p>
                            <p>O frete negociado não pode estar abaixo do piso mínimo calculado em tempo real sob risco de bloqueio e autuação automática da ANTT.</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
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
