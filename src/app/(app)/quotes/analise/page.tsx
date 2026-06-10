"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { FreightForm, type FreightFormHandle } from '@/components/FreightForm';
import type { Quote, Company, Vehicle, User as AuthUser, FreightMode, MinimumFreightValues } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, ShieldCheck, Search, ArrowRight, Calculator, Check, X, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { authFetch } from '@/lib/api-client';
import { identifyLocationType } from '@/lib/location-utils';
import { getWeightTierFactor } from '@/lib/weight-tiers';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

const getQuoteCode = (quote: Quote) => quote.quoteCode || `LEGACY-${quote.id.slice(0, 5)}`;

export default function QuotesAnalisePage() {
  const { user, loading: authLoading, pricingSettings } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const formRef = useRef<FreightFormHandle>(null);

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // State for the analysis panel
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [freightMode, setFreightMode] = useState<FreightMode>('fracionado');
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [isCalculationLoading, setIsCalculationLoading] = useState(false);
  const [calculationResult, setCalculationResult] = useState<Quote | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Reject dialog
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [quoteToReject, setQuoteToReject] = useState<Quote | null>(null);

  // Detail view (read-only summary before full form)
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null);

  // Load reference data
  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ['vehicles-list'],
    queryFn: () => authFetch('/api/vehicles').then(res => res.json()),
    enabled: !!user,
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ['companies-list'],
    queryFn: () => authFetch('/api/customers').then(res => res.json()),
    enabled: !!user,
  });

  const { data: users = [] } = useQuery<AuthUser[]>({
    queryKey: ['users-list'],
    queryFn: () => authFetch('/api/users').then(res => res.json()),
    enabled: !!user,
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user || (user.role !== 'admin' && !user.analyzeQuotesAccess)) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  const fetchPendingQuotes = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await authFetch('/api/quotes?status=Em+An%C3%A1lise&limit=100');
      if (!response.ok) throw new Error("Falha ao carregar cotações pendentes.");
      const data = await response.json();
      setQuotes(data);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (user) {
      fetchPendingQuotes();
    }
  }, [user, fetchPendingQuotes]);

  // --- Calculation Logic (mirrored from /quotes) ---
  const getDistance = async (origin: string, destination: string): Promise<{ distance: number; includesFerry: boolean } | null> => {
    try {
      const response = await authFetch('/api/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin, destination })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Serviço de localização indisponível.');
      }
      return await response.json();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro de Rota', description: error.message });
      return null;
    }
  };

  const getRegion = (uf: string) => {
    if (!pricingSettings) return null;
    for (const region in (pricingSettings as any).regions) {
      if ((pricingSettings as any).regions[region].includes(uf)) return region;
    }
    return null;
  };

  const getUf = (cidade: string): string | null => {
    const match = cidade.trim().match(/[,\-\/]\s*([A-Z]{2})$/i);
    return match ? match[1].toUpperCase() : null;
  };

  const calculateDeliveryTime = (km: number, destino: string, mode: FreightMode, manualPrazo?: number, additionalDays: number = 0): number => {
    let basePrazo = manualPrazo && manualPrazo > 0 ? manualPrazo : 0;
    if (!basePrazo) {
      basePrazo = Math.max(1, Math.ceil(km / 700)) * (mode === 'fracionado' ? 2 : 1);
      const destinoUF = getUf(destino);
      if (destinoUF) {
        if (['AP', 'AM'].includes(destinoUF)) basePrazo += 5;
        if (destinoUF === 'RR') basePrazo += 14;
      }
    }
    return Math.ceil(basePrazo + additionalDays);
  };

  const handleCalculate = async (data: any, company: Company | null) => {
    if (!user || !pricingSettings) return;
    setIsCalculationLoading(true);
    setCalculationResult(null);

    const routeInfo = await getDistance(data.cidadeOrigem, data.cidadeDestino);
    if (!routeInfo) {
      setIsCalculationLoading(false);
      return;
    }
    if (routeInfo.includesFerry) toast({ title: 'Aviso de Rota', description: 'Este trajeto inclui uma balsa.' });
    if ((routeInfo as any).isFallback) toast({ title: 'Distância Estimada', description: 'O serviço de rotas está indisponível. A distância usada é uma estimativa geográfica.' });

    const distanceOneWay = routeInfo.distance;
    const ufOrigem = getUf(data.cidadeOrigem);
    const ufDestino = getUf(data.cidadeDestino);
    if (!ufOrigem || !ufDestino) {
      toast({ variant: 'destructive', title: 'UF Inválida', description: "Inclua a UF na origem e destino (ex: 'Curitiba, PR')." });
      setIsCalculationLoading(false);
      return;
    }

    const originType = identifyLocationType(data.cidadeOrigem);
    const destType = identifyLocationType(data.cidadeDestino);

    data.isCapitalOrigem = originType.type === 'capital';
    data.isMetropolitanaOrigem = originType.type === 'metropolitana';
    data.isRuralOrigem = data.isRuralOrigem || false;
    data.isCapitalDestino = destType.type === 'capital';
    data.isMetropolitanaDestino = destType.type === 'metropolitana';
    data.isRuralDestino = data.isRuralDestino || false;

    let calculationData: any;
    let kmTotal = 0;
    let kmExcedente = 0;

    const productValueCost = data.valorProduto * (pricingSettings.operational.grisAdvaloremRate || 0);
    let taxaDificuldade = 0;

    if (freightMode === 'dedicado') {
      const vehicle = vehicles.find(v => v.key === data.veiculo);
      if (!vehicle) {
        toast({ variant: 'destructive', title: 'Veículo Inválido' });
        setIsCalculationLoading(false);
        return;
      }

      const tdValue = vehicle.taxaDificuldade || 0;
      if (data.isRuralOrigem) taxaDificuldade += tdValue;
      if (data.isRuralDestino) taxaDificuldade += tdValue;

      kmTotal = isRoundTrip ? distanceOneWay * 2 : distanceOneWay;
      kmExcedente = Math.max(0, kmTotal - vehicle.kmGratis);
      const additionalKmCost = kmExcedente * vehicle.adicionalKm;

      const subtotal = vehicle.valorBase + additionalKmCost + productValueCost + taxaDificuldade;
      const region = getRegion(ufDestino) || '';
      const regionalSurcharge = ((pricingSettings as any).surcharges.dezlog[region] || 0);
      let total = subtotal * (1 + regionalSurcharge);
      if (company) total = total - (total * (company.discountPercentage || 0)) + (total * (company.surchargePercentage || 0));

      const icmsAliquota = ((pricingSettings as any).icmsRates[ufOrigem]?.[ufDestino] ?? 0);
      calculationData = {
        totalFrete: total,
        icmsAliquota,
        icmsValor: total * (icmsAliquota / 100),
        veiculo: vehicle.name,
        prazoEntrega: calculateDeliveryTime(distanceOneWay, data.cidadeDestino, 'dedicado', data.prazoEntrega, company?.additionalDays || 0),
        freightMode: 'dedicado',
        isRoundTrip,
        adicionalProduto: productValueCost,
        adicional: additionalKmCost,
        regiao: region,
        acrescimoRegional: regionalSurcharge,
      };
    } else {
      kmTotal = distanceOneWay;
      kmExcedente = 0;
      const pesoTaxavel = Math.max(data.peso || 0, (data.cubagem || 0) * 300);
      const region = getRegion(ufDestino) || '';

      const originRegion = getRegion(ufOrigem);
      const difficultyFees = (pricingSettings as any).difficultyFees?.fracionado || {};
      if (data.isRuralOrigem && originRegion) taxaDificuldade += (difficultyFees[originRegion] || 0);
      if (data.isRuralDestino && region) taxaDificuldade += (difficultyFees[region] || 0);

      const routeRates = pricingSettings.fractionalMinimumFreight?.[ufOrigem]?.[ufDestino];
      let kgCubadoRate = (routeRates as any)?.kgCubado || 1.50;

      if (data.isRuralDestino) kgCubadoRate = (routeRates as any)?.kgRural || kgCubadoRate;
      else if (data.isMetropolitanaDestino) kgCubadoRate = (routeRates as any)?.kgMetropolitana || kgCubadoRate;
      else if (data.isCapitalDestino) kgCubadoRate = (routeRates as any)?.kgCapital || kgCubadoRate;
      else kgCubadoRate = (routeRates as any)?.kgInterior || kgCubadoRate;

      // Aplicar fator da faixa de peso (decrescente, cascata)
      const tierFactor = getWeightTierFactor(pricingSettings, pesoTaxavel, ufOrigem!, ufDestino!);
      const kgRateFinal = kgCubadoRate * tierFactor;

      let total = 0;
      const regionalSurchargeRate = (pricingSettings as any).surcharges.fracionado[region]?.regional || 0;

      const hasManualBaseValue = data.valorFrete && data.valorFrete > 0;
      const valorBaseFrete = hasManualBaseValue ? data.valorFrete : pesoTaxavel * kgRateFinal;
      const subtotal = valorBaseFrete + productValueCost + taxaDificuldade;
      total = subtotal * (1 + regionalSurchargeRate);

      if (company) total = total - (total * (company.discountPercentage || 0)) + (total * (company.surchargePercentage || 0));
      const icmsAliquota = ((pricingSettings as any).icmsRates[ufOrigem]?.[ufDestino] ?? 0);

      calculationData = {
        totalFrete: total,
        icmsAliquota,
        icmsValor: total * (icmsAliquota / 100),
        veiculo: "Fracionado",
        prazoEntrega: calculateDeliveryTime(distanceOneWay, data.cidadeDestino, 'fracionado', data.prazoEntrega, company?.additionalDays || 0),
        freightMode: 'fracionado',
        adicionalProduto: productValueCost,
        adicional: 0,
        regiao: region,
        acrescimoRegional: regionalSurchargeRate,
      };

      const minFreightRates = pricingSettings.fractionalMinimumFreight?.[ufOrigem]?.[ufDestino];
      if (minFreightRates) {
        let category: keyof MinimumFreightValues = 'interior';
        if (data.isRuralDestino) category = 'rural';
        else if ((data as any).isMetropolitanaDestino) category = 'metropolitana';
        else if ((data as any).isCapitalDestino) category = 'capital';
        const minFreight = typeof minFreightRates === 'number' ? minFreightRates : (minFreightRates[category as keyof MinimumFreightValues] || 0);
        if (calculationData.totalFrete < minFreight) {
          calculationData.totalFrete = minFreight;
          calculationData.icmsValor = minFreight * (calculationData.icmsAliquota / 100);
        }
      }
    }

    setIsCalculationLoading(false);

    const icmsValue = calculationData.icmsValor || 0;

    const result: any = {
      ...data,
      ...(selectedQuote ? { id: selectedQuote.id } : {}),
      userId: user.id,
      data: new Date().toISOString(),
      status: 'Aberta',
      desconto: 0,
      valorFinal: calculationData.totalFrete,
      grossProfit: calculationData.totalFrete + icmsValue,
      totalExpense: icmsValue,
      kmIda: distanceOneWay,
      kmTotal,
      kmExcedente,
      taxaDificuldade,
      ...calculationData,
    };

    setCalculationResult(result);
  };

  // --- Actions ---
  const handleStartAnalysis = (quote: Quote) => {
    setSelectedQuote(quote);
    setFreightMode(quote.freightMode || (quote.veiculo === 'Fracionado' ? 'fracionado' : 'dedicado'));
    setIsRoundTrip(quote.isRoundTrip || false);
    setCalculationResult(null);
    setIsAnalyzing(true);
    window.scrollTo(0, 0);
  };

  const handleCancelAnalysis = () => {
    setSelectedQuote(null);
    setIsAnalyzing(false);
    setCalculationResult(null);
    formRef.current?.reset();
  };

  const handleApprove = async () => {
    if (!selectedQuote || !user) return;
    setIsSaving(true);

    try {
      // Use calculation result if available, otherwise approve as-is
      const updates: any = calculationResult
        ? { ...calculationResult, status: 'Aberta' }
        : { status: 'Aberta' };

      // If analyst recalculated, merge current form data
      if (calculationResult) {
        const currentFormData = formRef.current?.getValues();
        if (currentFormData) {
          Object.assign(updates, {
            enderecoColeta: currentFormData.enderecoColeta || updates.enderecoColeta,
            enderecoEntrega: currentFormData.enderecoEntrega || updates.enderecoEntrega,
            obs: currentFormData.obs || updates.obs,
            nfeXml: currentFormData.nfeXml || updates.nfeXml,
            nfeChave: currentFormData.nfeChave || updates.nfeChave,
            nfNumber: currentFormData.nfNumber || updates.nfNumber,
          });
        }
      }

      const response = await authFetch(`/api/quotes/${selectedQuote.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updates, user }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha ao aprovar cotação.');
      }

      toast({ title: '✅ Cotação Aprovada!', description: `A cotação ${getQuoteCode(selectedQuote)} foi aprovada e está aberta.` });
      handleCancelAnalysis();
      fetchPendingQuotes();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenRejectDialog = (quote: Quote) => {
    setQuoteToReject(quote);
    setRejectReason('');
    setIsRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!quoteToReject || !user) return;
    setIsSaving(true);

    try {
      const response = await authFetch(`/api/quotes/${quoteToReject.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error('Falha ao rejeitar cotação.');

      toast({ title: 'Cotação Rejeitada', description: `A cotação ${getQuoteCode(quoteToReject)} foi removida.` });
      setIsRejectDialogOpen(false);
      setQuoteToReject(null);
      if (selectedQuote?.id === quoteToReject.id) handleCancelAnalysis();
      fetchPendingQuotes();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  // --- Quick Approve (without opening form) ---
  const handleQuickApprove = async (quote: Quote) => {
    setIsSaving(true);
    try {
      const response = await authFetch(`/api/quotes/${quote.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Aberta', user }),
      });
      if (!response.ok) throw new Error('Falha ao aprovar cotação.');
      toast({ title: '✅ Cotação Aprovada!', description: `A cotação ${getQuoteCode(quote)} foi aprovada sem alterações.` });
      fetchPendingQuotes();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || !user || (user.role !== 'admin' && !user.analyzeQuotesAccess)) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!pricingSettings) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-4">A carregar configurações de precificação...</p>
      </div>
    );
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  return (
    <main className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-start flex-wrap gap-4 mb-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-primary">Análise de Cotações</h1>
          <p className="text-muted-foreground text-sm">
            Revise, edite e delibere sobre cotações enviadas pelos clientes B2B.
          </p>
        </div>
        <BackButton onClick={() => isAnalyzing ? handleCancelAnalysis() : router.push('/dashboard')} label={isAnalyzing ? 'Voltar à Lista' : 'Voltar ao Início'} className="mb-0 mt-2" />
      </div>

      <Card className="mb-6 border-amber-200 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-950/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-amber-600 animate-pulse" />
              <div>
                <CardTitle className="text-xl text-amber-900 dark:text-amber-200">
                  {isAnalyzing ? `Analisando: ${getQuoteCode(selectedQuote!)}` : 'Painel de Deliberação'}
                </CardTitle>
                <CardDescription className="text-amber-700 dark:text-amber-400">
                  {isAnalyzing
                    ? 'Revise os dados calculados pelo cliente e decida a precificação final.'
                    : 'Cotações aguardando sua análise e aprovação de margens.'}
                </CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="text-lg px-4 py-1 bg-amber-200 text-amber-900">
              {isLoading ? '...' : quotes.length} pendente{quotes.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* ===== ANALYSIS PANEL ===== */}
      {isAnalyzing && selectedQuote && (
        <div className="space-y-6 mb-8 animate-fade-in">
          {/* Original Quote Summary */}
          <Card className="border-blue-200 bg-blue-50/30 dark:border-blue-900/30 dark:bg-blue-950/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-blue-800 dark:text-blue-300 flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Resumo Original do Cliente — {getQuoteCode(selectedQuote)}
              </CardTitle>
              <CardDescription className="text-blue-600 dark:text-blue-400">
                Dados enviados pelo cliente em {new Date(selectedQuote.data).toLocaleDateString('pt-BR')} • Usuário: {selectedQuote.usuario}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Origem</p>
                  <p className="font-medium">{selectedQuote.cidadeOrigem}</p>
                  {selectedQuote.enderecoColeta && <p className="text-xs text-muted-foreground">{selectedQuote.enderecoColeta}</p>}
                </div>
                <div>
                  <p className="text-muted-foreground">Destino</p>
                  <p className="font-medium">{selectedQuote.cidadeDestino}</p>
                  {selectedQuote.enderecoEntrega && <p className="text-xs text-muted-foreground">{selectedQuote.enderecoEntrega}</p>}
                </div>
                <div>
                  <p className="text-muted-foreground">Remetente</p>
                  <p className="font-medium">{selectedQuote.remetente || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Destinatário</p>
                  <p className="font-medium">{selectedQuote.destinatario || selectedQuote.empresaDestino || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tomador</p>
                  <p className="font-medium">{selectedQuote.tomador || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Modalidade</p>
                  <p className="font-medium capitalize">{selectedQuote.freightMode || 'Fracionado'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Peso / Qtd Volumes</p>
                  <p className="font-medium">{selectedQuote.peso ? `${selectedQuote.peso} kg` : '-'} / {selectedQuote.quantidade || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Valor Produto</p>
                  <p className="font-medium">{formatCurrency(selectedQuote.valorProduto || 0)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Valor do Frete (calculado)</p>
                  <p className="font-bold text-lg text-primary">{formatCurrency((selectedQuote.valorFinal || 0) + (selectedQuote.icmsValor || 0))}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Prazo de Entrega</p>
                  <p className="font-medium">{selectedQuote.prazoEntrega ? `${selectedQuote.prazoEntrega} dias úteis` : '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">KM</p>
                  <p className="font-medium">{selectedQuote.kmIda ? `${selectedQuote.kmIda.toFixed(0)} km` : '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Veículo</p>
                  <p className="font-medium">{selectedQuote.veiculo || '-'}</p>
                </div>
              </div>
              {selectedQuote.obs && (
                <div className="mt-4 p-3 bg-white dark:bg-gray-900 border rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Observações do Cliente:</p>
                  <p className="text-sm whitespace-pre-wrap">{selectedQuote.obs}</p>
                </div>
              )}
              {selectedQuote.responsavelSolicitante && (
                <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                  <span>Solicitante: <strong>{selectedQuote.responsavelSolicitante}</strong></span>
                  {selectedQuote.contato && <span>Contato: <strong>{selectedQuote.contato}</strong></span>}
                  {selectedQuote.email && <span>E-mail: <strong>{selectedQuote.email}</strong></span>}
                </div>
              )}
            </CardContent>
          </Card>

          <Separator />

          {/* Editable Form */}
          <div>
            <h2 className="text-xl font-bold text-primary mb-2 flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Formulário de Análise — Editar e Recalcular
            </h2>
            <p className="text-muted-foreground text-sm mb-4">
              Modifique os dados necessários e clique em <strong>"Calcular Frete"</strong> para obter o novo valor. Após a análise, aprove ou rejeite a cotação.
            </p>

            <FreightForm
              ref={formRef}
              onCalculate={handleCalculate}
              isLoading={isCalculationLoading}
              currentUser={user}
              users={users}
              vehicles={vehicles}
              companies={companies}
              mode={freightMode}
              setMode={setFreightMode}
              isRoundTrip={isRoundTrip}
              setIsRoundTrip={setIsRoundTrip}
              initialData={selectedQuote}
              isEditing={true}
              canSwitchMode={true}
              hideQuickSave={true}
              readOnlyUsuario={selectedQuote.usuario}
            />
          </div>

          {/* Calculation Result */}
          {calculationResult && (
            <Card className="animate-fade-in border-green-200 bg-green-50/30 dark:border-green-900/30 dark:bg-green-950/10">
              <CardHeader>
                <CardTitle className="text-green-800 dark:text-green-300">Novo Resultado do Cálculo</CardTitle>
                <CardDescription className="text-green-600 dark:text-green-400">
                  Revise o novo valor antes de aprovar.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  {/* Original value */}
                  <div className="p-3 bg-white dark:bg-gray-900 border rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Valor Original</p>
                    <p className="text-lg font-semibold text-muted-foreground line-through">
                      {formatCurrency((selectedQuote.valorFinal || 0) + (selectedQuote.icmsValor || 0))}
                    </p>
                  </div>
                  {/* New value */}
                  <div className="p-3 bg-white dark:bg-gray-900 border border-green-300 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Novo Total (Frete + ICMS)</p>
                    <p className="text-2xl font-bold text-primary">
                      {formatCurrency((calculationResult.valorFinal || 0) + (calculationResult.icmsValor || 0))}
                    </p>
                  </div>
                  <div className="p-3 bg-white dark:bg-gray-900 border rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Prazo de Entrega</p>
                    <p className="text-lg font-semibold">{calculationResult.prazoEntrega} dias úteis</p>
                  </div>
                  <div className="p-3 bg-white dark:bg-gray-900 border rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Distância</p>
                    <p className="text-lg font-semibold">{calculationResult.kmIda?.toFixed(0)} km</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-end p-4 bg-card border rounded-lg shadow-sm">
            <Button variant="outline" onClick={handleCancelAnalysis} disabled={isSaving} className="sm:mr-auto">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar à Lista
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleOpenRejectDialog(selectedQuote)}
              disabled={isSaving}
            >
              <X className="mr-2 h-4 w-4" /> Rejeitar Cotação
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleApprove}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              {calculationResult ? 'Aprovar com Novo Valor' : 'Aprovar Sem Alteração'}
            </Button>
          </div>
        </div>
      )}

      {/* ===== QUOTES LIST ===== */}
      {!isAnalyzing && (
        <>
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : quotes.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                <ShieldCheck className="h-16 w-16 text-green-500 mb-4" />
                <h2 className="text-2xl font-bold text-green-700 dark:text-green-400">Tudo Limpo!</h2>
                <p className="text-muted-foreground mt-2">
                  Não há cotações de clientes B2B aguardando análise neste momento.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {quotes.map((quote) => (
                <Card key={quote.id} className="transition-all duration-200 hover:shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{getQuoteCode(quote)}</CardTitle>
                          <Badge className="capitalize bg-amber-100 text-amber-800 border-amber-300">
                            {quote.freightMode || 'Fracionado'}
                          </Badge>
                        </div>
                        <CardDescription>
                          {quote.remetente} — {quote.cidadeOrigem}
                          <ArrowRight className="inline h-3 w-3 mx-1" />
                          {quote.cidadeDestino}
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-primary">
                          {formatCurrency((quote.valorFinal || 0) + (quote.icmsValor || 0))}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(quote.data).toLocaleDateString('pt-BR')} • {quote.usuario}
                        </p>
                      </div>
                    </div>
                  </CardHeader>

                  {/* Expandable Details */}
                  <CardContent className="pt-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-center text-muted-foreground"
                      onClick={() => setExpandedQuoteId(expandedQuoteId === quote.id ? null : quote.id)}
                    >
                      {expandedQuoteId === quote.id ? (
                        <><ChevronUp className="mr-2 h-4 w-4" /> Ocultar Detalhes</>
                      ) : (
                        <><ChevronDown className="mr-2 h-4 w-4" /> Ver Detalhes</>
                      )}
                    </Button>

                    {expandedQuoteId === quote.id && (
                      <div className="mt-3 p-4 bg-muted/50 rounded-lg space-y-3 animate-fade-in">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-muted-foreground">Remetente</p>
                            <p className="font-medium">{quote.remetente || '-'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Destinatário</p>
                            <p className="font-medium">{quote.destinatario || quote.empresaDestino || '-'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Tomador</p>
                            <p className="font-medium">{quote.tomador || '-'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Solicitante</p>
                            <p className="font-medium">{quote.responsavelSolicitante || '-'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Peso</p>
                            <p className="font-medium">{quote.peso ? `${quote.peso} kg` : '-'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Volumes</p>
                            <p className="font-medium">{quote.quantidade || '-'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Valor do Produto</p>
                            <p className="font-medium">{formatCurrency(quote.valorProduto || 0)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">KM / Prazo</p>
                            <p className="font-medium">{quote.kmIda ? `${quote.kmIda.toFixed(0)} km` : '-'} / {quote.prazoEntrega || '-'} dias</p>
                          </div>
                          {quote.enderecoColeta && (
                            <div className="col-span-2">
                              <p className="text-muted-foreground">Endereço de Coleta</p>
                              <p className="font-medium text-xs">{quote.enderecoColeta}</p>
                            </div>
                          )}
                          {quote.enderecoEntrega && (
                            <div className="col-span-2">
                              <p className="text-muted-foreground">Endereço de Entrega</p>
                              <p className="font-medium text-xs">{quote.enderecoEntrega}</p>
                            </div>
                          )}
                        </div>
                        {quote.obs && (
                          <div className="p-3 bg-white dark:bg-gray-900 border rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">Observações:</p>
                            <p className="text-sm whitespace-pre-wrap">{quote.obs}</p>
                          </div>
                        )}
                        {quote.contato && (
                          <p className="text-xs text-muted-foreground">Contato: <strong>{quote.contato}</strong> {quote.email && `| ${quote.email}`}</p>
                        )}
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="flex flex-wrap gap-2 justify-end pt-0 pb-4 px-6">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleOpenRejectDialog(quote)}
                      disabled={isSaving}
                    >
                      <X className="mr-1 h-4 w-4" /> Rejeitar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-green-300 text-green-700 hover:bg-green-50"
                      onClick={() => handleQuickApprove(quote)}
                      disabled={isSaving}
                    >
                      <Check className="mr-1 h-4 w-4" /> Aprovar
                    </Button>
                    <Button
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => handleStartAnalysis(quote)}
                    >
                      <Search className="mr-1 h-4 w-4" /> Analisar e Editar
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Reject Confirmation Dialog */}
      <AlertDialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rejeitar Cotação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja rejeitar a cotação <strong>{quoteToReject ? getQuoteCode(quoteToReject) : ''}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label htmlFor="reject-reason">Motivo da Rejeição (opcional)</Label>
            <Textarea
              id="reject-reason"
              placeholder="Informe o motivo da rejeição..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={isSaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
              Confirmar Rejeição
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
