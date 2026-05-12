"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Server, ShieldAlert, ShieldCheck, KeyRound, Eye, EyeOff, Undo2, FileText, Truck, Send, Hash } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { authFetch } from '@/lib/api-client';
import { SefazStatusIndicator } from '@/components/SefazStatusIndicator';

export default function FiscalSettings() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    
    const [environment, setEnvironment] = useState<'homologacao' | 'producao'>('homologacao');
    const [nextCteNumber, setNextCteNumber] = useState(1);
    const [nextMdfeNumber, setNextMdfeNumber] = useState(1);
    const [defaultIbsRate, setDefaultIbsRate] = useState(0);
    const [defaultCbsRate, setDefaultCbsRate] = useState(0);
    const [defaultCstIbsCbs, setDefaultCstIbsCbs] = useState('00');
    const [defaultNaturezaOperacao, setDefaultNaturezaOperacao] = useState('PRESTACAO DE SERVICO DE TRANSPORTE');
    const [showToken, setShowToken] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // CIOT Settings
    const [ciotUser, setCiotUser] = useState('');
    const [ciotPassword, setCiotPassword] = useState('');
    const [ciotEnv, setCiotEnv] = useState<'homologacao' | 'producao'>('homologacao');

    // CT-e Emission Modes
    const [defaultTpCTe, setDefaultTpCTe] = useState(0);
    const [defaultTpServ, setDefaultTpServ] = useState(0);
    const [defaultTpEmis, setDefaultTpEmis] = useState(1);
    const [defaultSerie, setDefaultSerie] = useState(1);

    useEffect(() => {
        if (!authLoading && (!user || user.role !== 'admin' || !user.settingsAccess)) {
            router.push('/settings');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        const fetchEnv = async () => {
            try {
                const res = await authFetch('/api/settings/fiscal');
                if (res.ok) {
                    const data = await res.json();
                    setEnvironment(data.sefazEnvironment);
                    setNextCteNumber(data.nextCteNumber || 1);
                    setNextMdfeNumber(data.nextMdfeNumber || 1);
                    setDefaultIbsRate(data.defaultIbsRate || 0);
                    setDefaultCbsRate(data.defaultCbsRate || 0);
                    setDefaultCstIbsCbs(data.defaultCstIbsCbs || '00');
                    setDefaultNaturezaOperacao(data.defaultNaturezaOperacao || 'PRESTACAO DE SERVICO DE TRANSPORTE');
                    setDefaultTpCTe(data.defaultTpCTe ?? 0);
                    setDefaultTpServ(data.defaultTpServ ?? 0);
                    setDefaultTpEmis(data.defaultTpEmis ?? 1);
                    setDefaultSerie(data.defaultSerie ?? 1);
                    setCiotUser(data.ciotUser || '');
                    setCiotPassword(data.ciotPassword || '');
                    setCiotEnv(data.ciotEnv || 'homologacao');
                }
            } catch (error) {
                console.error(error);
            } finally {
                setIsLoading(false);
            }
        };
        if (user) fetchEnv();
    }, [user]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await authFetch('/api/settings/fiscal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    sefazEnvironment: environment, 
                    nextCteNumber, 
                    nextMdfeNumber,
                    defaultIbsRate,
                    defaultCbsRate,
                    defaultCstIbsCbs,
                    defaultNaturezaOperacao,
                    defaultTpCTe,
                    defaultTpServ,
                    defaultTpEmis,
                    defaultSerie,
                    ciotUser,
                    ciotPassword,
                    ciotEnv
                }),
            });
            if (!res.ok) throw new Error("Erro ao salvar os dados.");
            toast({
                title: "Configurações Fiscais Salvas",
                description: `O motor fiscal e alíquotas foram atualizados com sucesso.`,
            });
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Erro na Operação", description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    if (authLoading || isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

    return (
        <main className="container mx-auto p-4 md:p-8">
            <div className="relative isolate mb-8">
                <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
                    <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-primary to-primary/30 opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
                </div>
                
                <Button variant="ghost" onClick={() => router.push('/settings')} className="mb-6 hover:bg-primary/10 hover:text-primary transition-colors">
                    <Undo2 className="mr-2 h-4 w-4" /> Voltar para Configurações Globais
                </Button>
                
                <div className="space-y-4">
                    <div className="inline-flex items-center rounded-lg bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                        <Server className="mr-2 h-4 w-4" /> Configurações do Motor Fiscal
                    </div>
                    <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl text-foreground">
                        Emissão <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/60">Fiscal</span>
                    </h1>
                    <p className="text-xl text-muted-foreground max-w-2xl">
                        Configure o ambiente SEFAZ, numeração fiscal e regras de tributação (IBS/CBS) para a reforma de 2026. O certificado digital A1 é gerenciado em Configurações &gt; Certificado Digital.
                    </p>
                </div>
            </div>

            <Card className={`overflow-hidden transition-all duration-300 bg-card/60 backdrop-blur-xl shadow-lg border relative ${environment === 'producao' ? 'border-red-500 shadow-red-500/10' : 'border-border/50 hover:border-primary/50'}`}>
                <div className={`absolute inset-0 bg-gradient-to-br ${environment === 'producao' ? 'from-red-500/5' : 'from-primary/5'} via-transparent to-transparent opacity-100 transition-opacity`} />
                <CardHeader className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="flex items-center gap-2 pt-2 text-2xl">
                            <div className={`p-2 rounded-lg ${environment === 'producao' ? 'bg-red-500/10' : 'bg-primary/10'}`}>
                                <Server className={`h-6 w-6 ${environment === 'producao' ? 'text-red-500' : 'text-primary'}`} />
                            </div>
                            Ambientes do Sistema (SEFAZ)
                        </CardTitle>
                        <CardDescription className="text-base mt-2">
                            Alterar essa variável mudará simultaneamente se TODOS os próximos emitidos vão cobrar imposto da empresa ou se serão apenas simulações SEFAZ (Sem valor legal).
                        </CardDescription>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-3">
                        <SefazStatusIndicator />
                    </div>
                </CardHeader>
                <CardContent className="relative z-10">
                    <RadioGroup value={environment} onValueChange={(v: 'homologacao'|'producao') => setEnvironment(v)} className="grid gap-6 md:grid-cols-2 pt-4">
                        <div>
                            <RadioGroupItem value="homologacao" id="homologacao" className="peer sr-only" />
                            <Label htmlFor="homologacao" className="flex flex-col items-center justify-between rounded-xl border-2 border-border/50 bg-background/50 backdrop-blur-sm p-6 hover:bg-primary/5 hover:border-primary/30 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer relative overflow-hidden transition-all">
                                <ShieldCheck className="mb-4 h-10 w-10 text-primary" />
                                <div className="font-bold text-xl text-foreground">Homologação (Sandbox)</div>
                                <div className="text-sm text-center text-muted-foreground mt-3 leading-relaxed">Documentos emitidos com a marca d'água <b className="text-foreground">"SEM VALOR FISCAL"</b>. A SEFAZ não cobra imposto. Testes encorajados.</div>
                            </Label>
                        </div>
                        <div>
                            <RadioGroupItem value="producao" id="producao" className="peer sr-only" />
                            <Label htmlFor="producao" className="flex flex-col items-center justify-between rounded-xl border-2 border-border/50 bg-background/50 backdrop-blur-sm p-6 hover:bg-red-500/5 hover:border-red-500/30 peer-data-[state=checked]:border-red-500 peer-data-[state=checked]:bg-red-500/5 cursor-pointer relative overflow-hidden transition-all">
                                <ShieldAlert className={`mb-4 h-10 w-10 ${environment === 'producao' ? 'text-red-500' : 'text-muted-foreground'}`} />
                                <div className={`font-bold text-xl text-foreground ${environment === 'producao' ? 'text-red-500' : ''}`}>Produção (Ao Vivo)</div>
                                <div className="text-sm text-center text-muted-foreground mt-3 leading-relaxed">Emissões reais. Irreversível. O caminhão poderá transitar caso seja Autorizado. Os tributos já estarão validando na Base Governamental.</div>
                            </Label>
                        </div>
                    </RadioGroup>
                </CardContent>
            </Card>

            <Card className="mt-8 relative overflow-hidden transition-all duration-300 bg-card/60 backdrop-blur-xl shadow-lg border border-border/50 hover:border-primary/50">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent opacity-100 transition-opacity" />
                <CardHeader className="relative z-10">
                    <CardTitle className="flex items-center gap-2 pt-2 text-2xl text-amber-600 dark:text-amber-500">
                        <div className="p-2 rounded-lg bg-amber-500/10">
                            <Server className="h-6 w-6" />
                        </div>
                        Parâmetros de Tributação e Operação (Reforma 2026)
                    </CardTitle>
                    <CardDescription className="text-base">
                        Defina os valores padrão de IBS e CBS que serão sugeridos em todos os novos CT-es.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2 pt-4 relative z-10">
                    <div className="space-y-2">
                        <Label htmlFor="default_ibs" className="text-foreground">Alíquota IBS Padrão (%)</Label>
                        <Input 
                            id="default_ibs"
                            type="number" 
                            step="0.01"
                            min="0"
                            value={defaultIbsRate}
                            onChange={(e) => setDefaultIbsRate(Number(e.target.value))}
                            className="text-lg font-mono bg-background/50 border-border/50 focus:border-primary/50"
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <Label htmlFor="default_cbs" className="text-foreground">Alíquota CBS Padrão (%)</Label>
                        <Input 
                            id="default_cbs"
                            type="number" 
                            step="0.01"
                            min="0"
                            value={defaultCbsRate}
                            onChange={(e) => setDefaultCbsRate(Number(e.target.value))}
                            className="text-lg font-mono bg-background/50 border-border/50 focus:border-primary/50"
                        />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="default_cst" className="text-foreground">Situação Tributária Padrão (CST IBS/CBS)</Label>
                        <Select value={defaultCstIbsCbs} onValueChange={setDefaultCstIbsCbs}>
                            <SelectTrigger className="w-full md:max-w-[400px] h-12 bg-background/50 border-border/50 focus:ring-primary/20">
                                <SelectValue placeholder="Selecione a CST padrão" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="00">00 - Tributada Integralmente</SelectItem>
                                <SelectItem value="01">01 - Imunidade</SelectItem>
                                <SelectItem value="10">10 - Isenção</SelectItem>
                                <SelectItem value="11">11 - Não Incidência</SelectItem>
                                <SelectItem value="20">20 - Alíquota Reduzida</SelectItem>
                                <SelectItem value="21">21 - Redução de Base de Cálculo</SelectItem>
                                <SelectItem value="30">30 - Regime Diferenciado</SelectItem>
                                <SelectItem value="40">40 - Suspensão</SelectItem>
                                <SelectItem value="51">51 - Diferimento</SelectItem>
                                <SelectItem value="90">90 - Outras</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-sm text-muted-foreground italic mt-2">Este valor será sugerido automaticamente em todos os novos CT-es.</p>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="default_nat" className="text-foreground">Natureza da Operação Padrão</Label>
                        <Input 
                            id="default_nat"
                            type="text" 
                            value={defaultNaturezaOperacao}
                            onChange={(e) => setDefaultNaturezaOperacao(e.target.value)}
                            placeholder="PRESTACAO DE SERVICO DE TRANSPORTE"
                            className="text-lg bg-background/50 border-border/50 focus:border-primary/50"
                        />
                        <p className="text-sm text-muted-foreground mt-2">Texto padrão que descreve a finalidade do transporte (Ex: Prestação de serviço de transporte, Retorno de mercadoria, etc).</p>
                    </div>
                </CardContent>
            </Card>

            {/* =============== CT-e EMISSION MODES =============== */}
            <Card className="mt-8 relative overflow-hidden transition-all duration-300 bg-card/60 backdrop-blur-xl shadow-lg border border-border/50 hover:border-blue-500/50">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent opacity-100 transition-opacity" />
                <CardHeader className="relative z-10">
                    <CardTitle className="flex items-center gap-2 pt-2 text-2xl text-blue-600 dark:text-blue-400">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                            <FileText className="h-6 w-6" />
                        </div>
                        Modos de Emissão CT-e
                    </CardTitle>
                    <CardDescription className="text-base">
                        Defina os padrões de emissão do Conhecimento de Transporte Eletrônico. Estes valores serão pré-selecionados na tela de emissão e podem ser alterados individualmente em cada CT-e.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2 pt-4 relative z-10">
                    
                    {/* Finalidade de Emissão (tpCTe) */}
                    <div className="space-y-2">
                        <Label htmlFor="default_tpCTe" className="text-foreground flex items-center gap-2">
                            <Send className="h-4 w-4 text-blue-500" />
                            Finalidade de Emissão (tpCTe)
                        </Label>
                        <Select value={String(defaultTpCTe)} onValueChange={(v) => setDefaultTpCTe(Number(v))}>
                            <SelectTrigger className="w-full h-12 bg-background/50 border-border/50 focus:ring-blue-500/20">
                                <SelectValue placeholder="Selecione a finalidade" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="0">0 - CT-e Normal</SelectItem>
                                <SelectItem value="1">1 - CT-e Complementar</SelectItem>
                                <SelectItem value="2">2 - CT-e de Anulação</SelectItem>
                                <SelectItem value="3">3 - CT-e Substituto</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground italic">
                            Normal: emissão padrão. Complementar: complementa valores. Anulação: anula CT-e anterior. Substituto: substitui CT-e anulado.
                        </p>
                    </div>

                    {/* Tipo de Serviço (tpServ) */}
                    <div className="space-y-2">
                        <Label htmlFor="default_tpServ" className="text-foreground flex items-center gap-2">
                            <Truck className="h-4 w-4 text-blue-500" />
                            Tipo de Serviço (tpServ)
                        </Label>
                        <Select value={String(defaultTpServ)} onValueChange={(v) => setDefaultTpServ(Number(v))}>
                            <SelectTrigger className="w-full h-12 bg-background/50 border-border/50 focus:ring-blue-500/20">
                                <SelectValue placeholder="Selecione o tipo de serviço" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="0">0 - Normal</SelectItem>
                                <SelectItem value="1">1 - Subcontratação</SelectItem>
                                <SelectItem value="2">2 - Redespacho</SelectItem>
                                <SelectItem value="3">3 - Redespacho Intermediário</SelectItem>
                                <SelectItem value="4">4 - Serviço Vinculado a Multimodal</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground italic">
                            Normal: frete direto. Subcontratação: terceiriza integralmente. Redespacho: contrata outro transportador para trecho.
                        </p>
                    </div>

                    {/* Tipo de Emissão (tpEmis) */}
                    <div className="space-y-2">
                        <Label htmlFor="default_tpEmis" className="text-foreground flex items-center gap-2">
                            <Server className="h-4 w-4 text-blue-500" />
                            Tipo de Emissão (tpEmis)
                        </Label>
                        <Select value={String(defaultTpEmis)} onValueChange={(v) => setDefaultTpEmis(Number(v))}>
                            <SelectTrigger className="w-full h-12 bg-background/50 border-border/50 focus:ring-blue-500/20">
                                <SelectValue placeholder="Selecione o tipo de emissão" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="1">1 - Normal</SelectItem>
                                <SelectItem value="4">4 - EPEC pela SVC</SelectItem>
                                <SelectItem value="5">5 - Contingência FSDA</SelectItem>
                                <SelectItem value="7">7 - Autorização pela SVC-RS</SelectItem>
                                <SelectItem value="8">8 - Autorização pela SVC-SP</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground italic">
                            Normal: emissão direta pela SEFAZ. Os demais modos são contingência (quando a SEFAZ de origem está fora do ar).
                        </p>
                    </div>

                    {/* Série Padrão */}
                    <div className="space-y-2">
                        <Label htmlFor="default_serie" className="text-foreground flex items-center gap-2">
                            <Hash className="h-4 w-4 text-blue-500" />
                            Série Padrão
                        </Label>
                        <Input 
                            id="default_serie"
                            type="number" 
                            min="1"
                            max="999"
                            value={defaultSerie}
                            onChange={(e) => setDefaultSerie(Number(e.target.value))}
                            className="text-lg font-mono bg-background/50 border-border/50 focus:border-blue-500/50 h-12"
                        />
                        <p className="text-xs text-muted-foreground italic">
                            Série fiscal do CT-e. Padrão = 1. Altere apenas se sua empresa utiliza múltiplas séries.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* =============== CIOT CONFIGURATION =============== */}
            <Card className="mt-8 relative overflow-hidden transition-all duration-300 bg-card/60 backdrop-blur-xl shadow-lg border border-border/50 hover:border-emerald-500/50">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent opacity-100 transition-opacity" />
                <CardHeader className="relative z-10">
                    <CardTitle className="flex items-center gap-2 pt-2 text-2xl text-emerald-600 dark:text-emerald-400">
                        <div className="p-2 rounded-lg bg-emerald-500/10">
                            <Truck className="h-6 w-6" />
                        </div>
                        Configuração CIOT Gratuito (ANTT)
                    </CardTitle>
                    <CardDescription className="text-base">
                        Configure as credenciais para emissão direta do CIOT sem custo de IPEF. 
                        A assinatura digital utilizará o mesmo certificado A1 configurado na aba "Certificado Digital".
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2 pt-4 relative z-10">
                    <div className="space-y-2">
                        <Label htmlFor="ciot_user" className="text-foreground">Usuário/CPF ANTT</Label>
                        <Input 
                            id="ciot_user"
                            type="text" 
                            value={ciotUser}
                            onChange={(e) => setCiotUser(e.target.value)}
                            placeholder="CPF ou Usuário da integração"
                            className="text-lg bg-background/50 border-border/50 focus:border-emerald-500/50"
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <Label htmlFor="ciot_pass" className="text-foreground">Senha ANTT</Label>
                        <div className="relative">
                            <Input 
                                id="ciot_pass"
                                type={showToken ? "text" : "password"} 
                                value={ciotPassword}
                                onChange={(e) => setCiotPassword(e.target.value)}
                                className="text-lg bg-background/50 border-border/50 focus:border-emerald-500/50 pr-10"
                            />
                            <button 
                                type="button"
                                onClick={() => setShowToken(!showToken)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
                            >
                                {showToken ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                        <Label className="text-foreground">Ambiente de Emissão CIOT</Label>
                        <RadioGroup value={ciotEnv} onValueChange={(v: 'homologacao'|'producao') => setCiotEnv(v)} className="flex gap-6 mt-2">
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="homologacao" id="ciot_homolog" />
                                <Label htmlFor="ciot_homolog" className="cursor-pointer">Homologação (Testes)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="producao" id="ciot_prod" />
                                <Label htmlFor="ciot_prod" className="cursor-pointer font-bold text-emerald-600">Produção (Real)</Label>
                            </div>
                        </RadioGroup>
                    </div>
                </CardContent>
            </Card>

            <Card className="mt-8 relative overflow-hidden transition-all duration-300 bg-card/60 backdrop-blur-xl shadow-lg border border-border/50 hover:border-primary/50">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-100 transition-opacity" />
                <CardHeader className="relative z-10">
                    <CardTitle className="flex items-center gap-2 pt-2 text-2xl">
                        <div className="p-2 rounded-lg bg-primary/10">
                            <KeyRound className="h-6 w-6 text-primary" />
                        </div>
                        Numeração Fiscal (Contador)
                    </CardTitle>
                    <CardDescription className="text-base">
                        Determine a partir de qual número o portal irá assinar o próximo Conhecimento e Manifesto. O sistema realiza o Auto-Incremento (+1) sozinho após cada SUCESSO.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2 pt-4 relative z-10">
                    <div className="space-y-2">
                        <Label htmlFor="next_cte" className="text-foreground">Próximo N° CT-e</Label>
                        <Input 
                            id="next_cte"
                            type="number" 
                            min="1"
                            value={nextCteNumber}
                            onChange={(e) => setNextCteNumber(Number(e.target.value))}
                            className="text-xl font-mono font-bold bg-background/50 border-border/50 focus:border-primary/50 h-14"
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <Label htmlFor="next_mdfe" className="text-foreground">Próximo N° MDF-e</Label>
                        <Input 
                            id="next_mdfe"
                            type="number" 
                            min="1"
                            value={nextMdfeNumber}
                            onChange={(e) => setNextMdfeNumber(Number(e.target.value))}
                            className="text-xl font-mono font-bold bg-background/50 border-border/50 focus:border-primary/50 h-14"
                        />
                    </div>
                </CardContent>
                <CardFooter className="bg-muted/10 backdrop-blur-md flex justify-end p-6 border-t border-border/50 mt-4 relative z-10">
                    <Button onClick={handleSave} disabled={isSaving} size="lg" className="text-base px-8 h-12 shadow-md hover:shadow-primary/25 hover:-translate-y-0.5 transition-all">
                        {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : null}
                        Salvar Configurações Fiscais
                    </Button>
                </CardFooter>
            </Card>
        </main>
    )
}
