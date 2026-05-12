

"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { FreightForm, type FreightFormHandle } from '@/components/FreightForm';
import { QuoteList } from '@/components/QuoteList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { Quote, Company, Vehicle, User as AuthUser, FreightMode, BillingHistoryEvent, QuoteStatus, MinimumFreightValues, ClientCompany } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, parse } from 'date-fns';
import { identifyLocationType } from '@/lib/location-utils';
import { authFetch } from '@/lib/api-client';
import { getWeightTierFactor } from '@/lib/weight-tiers';

const QUOTES_PER_PAGE = 12;

export default function ClienteCotacoesPage() {
  const { user, pricingSettings: authPricingSettings } = useAuth();
  const { toast } = useToast();
  const formRef = useRef<FreightFormHandle>(null);

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [pricingSettings, setPricingSettings] = useState(authPricingSettings);
  
  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ['vehicles-list'],
    queryFn: () => authFetch('/api/vehicles').then(res => res.json()),
    enabled: !!user,
  });

  // ISOLAMENTO: Cliente NÃO deve acessar a coleção 'customers' da transportadora.
  // Os dados do cliente (empresas e parceiros) são carregados diretamente dentro do FreightForm
  // via /api/my-companies e /api/client-partners.
  const companies: Company[] = [];

  const { data: users = [] } = useQuery<AuthUser[]>({
    queryKey: ['cliente-users-list'],
    queryFn: async () => {
        const token = localStorage.getItem('sessionToken');
        const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res = await authFetch('/api/cliente-users', { headers });
        return res.json();
    },
    enabled: !!user,
  });

  const { data: clientCompanies = [] } = useQuery<ClientCompany[]>({
    queryKey: ['my-companies-list'],
    queryFn: async () => {
        const token = localStorage.getItem('sessionToken');
        const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res = await authFetch('/api/my-companies', { headers });
        return res.json();
    },
    enabled: !!user,
  });
  
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isCalculationLoading, setIsCalculationLoading] = useState(false);
  
  const [calculationResult, setCalculationResult] = useState<Quote | null>(null);
  const [freightMode, setFreightMode] = useState<FreightMode>('fracionado');
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [quoteToRedo, setQuoteToRedo] = useState<Quote | null>(null);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [lastCalculatedData, setLastCalculatedData] = useState<any>(null);

  const fetchQuotes = useCallback(async (pageNum: number, refresh = false) => {
    setIsLoading(true);
    try {
        const response = await authFetch(`/api/quotes?page=${pageNum}&limit=${QUOTES_PER_PAGE}`);
        if (!response.ok) throw new Error("Falha ao carregar cotações.");
        const newQuotes = await response.json();
        setQuotes(prev => refresh ? newQuotes : [...prev, ...newQuotes]);
        setHasMore(newQuotes.length === QUOTES_PER_PAGE);
    } catch(e: any) {
        toast({ variant: 'destructive', title: 'Erro ao Carregar Cotações', description: e.message });
        setHasMore(false);
    } finally {
        setIsLoading(false);
    }
  }, [toast]);
  
  // Os dados estáticos agora são cacheados pelo React Query (vehicles, companies, users)

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchQuotes(nextPage);
  };

  const handleDataMutated = useCallback(() => {
    setPage(1);
    fetchQuotes(1, true);
  }, [fetchQuotes]);

  useEffect(() => {
    if(user) {
      handleDataMutated();
      setPricingSettings(authPricingSettings);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authPricingSettings]);

  useEffect(() => {
    if (user && user.role === 'cliente' && !user.fracionadoEnabled) {
      setFreightMode('dedicado');
    }
  }, [user]);

  // getCoords e roteamento agora são processados no servidor com cache no MongoDB
  // via /api/location para melhor performance.

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
  }

  useEffect(() => {
    if (clientCompanies.length > 0 && !editingQuoteId && !quoteToRedo && formRef.current) {
        const currentData = formRef.current.getValues();
        if (!currentData.remetente && !currentData.cidadeOrigem && !currentData.tomador) {
             const defaultCompany = clientCompanies.find(c => c.isDefault) || clientCompanies[0];
             if (defaultCompany) {
                 const cidadeEstado = `${defaultCompany.cidade} - ${defaultCompany.estado}`;
                 formRef.current.prefill({
                     remetente: defaultCompany.razaoSocial,
                     tomador: defaultCompany.razaoSocial,
                     cidadeOrigem: cidadeEstado,
                     enderecoColeta: `${defaultCompany.endereco}, ${defaultCompany.numero || 'S/N'}${defaultCompany.complemento ? ' - ' + defaultCompany.complemento : ''} - ${defaultCompany.bairro || ''}, ${defaultCompany.cep}`
                 });
             }
        }
    }
  }, [clientCompanies, editingQuoteId, quoteToRedo]);

  const getPricingImpactField = (newData: any, originalData: any, currentMode?: FreightMode) => {
    if (!originalData) return null;
    
    const fields = [
        'cidadeOrigem', 'cidadeDestino', 'veiculo', 'peso', 
        'cubagem', 'valorProduto', 'isRuralOrigem', 'isRuralDestino', 
        'isRoundTrip'
    ];

    for (const field of fields) {
        let val1 = newData[field];
        let val2 = originalData[field];

        let changed = false;

        // 1. Comparação de Veículo (Ignorar no modo fracionado) - ALTA PRECEDÊNCIA
        if (field === 'veiculo') {
            if (currentMode === 'fracionado') {
                changed = false;
            } else {
                const v1 = (val1 || '').toString().trim().toLowerCase();
                const v2 = (val2 || '').toString().trim().toLowerCase();
                changed = v1 !== v2;
            }
        }
        // 2. Normalização de Booleano (Tratar null/undefined/false como equivalentes)
        else if (typeof val1 === 'boolean' || typeof val2 === 'boolean' || (field && field.toString().startsWith('is'))) {
            changed = (!!val1) !== (!!val2);
        } 
        // 3. Normalização Numérica (Tratar vazios/null como 0)
        else if (['peso', 'cubagem', 'valorProduto'].includes(field)) {
            changed = Number(val1 || 0) !== Number(val2 || 0);
        } 
        // 4. Normalização de Strings (Trim e Capitalização para Cidades)
        else if (typeof val1 === 'string' || typeof val2 === 'string') {
            const s1 = (val1 || '').toString().trim().toLowerCase();
            const s2 = (val2 || '').toString().trim().toLowerCase();
            changed = s1 !== s2;
        } 
        // 5. Comparação Genérica (Tratar null/undefined/"")
        else {
            const v1 = val1 ?? '';
            const v2 = val2 ?? '';
            changed = v1 !== v2;
        }

        if (changed) return field;
    }

    return null;
  };

  const calculateDeliveryTime = (km: number, destino: string, mode: FreightMode, role: 'admin' | 'user' | 'cliente', manualPrazo?: number, additionalDays: number = 0): number => {
    let basePrazo = manualPrazo && manualPrazo > 0 ? manualPrazo : 0;
    
    if (role === 'cliente' || !basePrazo) {
      basePrazo = Math.max(1, Math.ceil(km / 700)) * (mode === 'fracionado' ? 2 : 1);
      const destinoUF = getUf(destino);
      if (destinoUF) {
        if (['AP', 'AM'].includes(destinoUF)) basePrazo += 5;
        if (destinoUF === 'RR') basePrazo += 14;
      }
    }
    
    return Math.ceil(basePrazo + additionalDays);
  };

  /**
   * Represents the result of a calculation, potentially including metadata for the update flow.
   */
  interface CalculationResult extends Quote {
    isInformativeOnly?: boolean;
    originalTotal?: number;
    impactField?: string | null;
  }
  
  const handleCalculate = async (data: any, company: Company | null, isQuickUpdate?: boolean) => {
    if (!user || !pricingSettings) return;
    setIsCalculationLoading(true);
    setCalculationResult(null);

    const routeInfo = await getDistance(data.cidadeOrigem, data.cidadeDestino);
    if (!routeInfo) {
      setIsCalculationLoading(false);
      return;
    }
    if (routeInfo.includesFerry) toast({ title: 'Aviso de Rota', description: 'Este trajeto inclui uma balsa.' });

    const distanceOneWay = routeInfo.distance;
    const ufOrigem = getUf(data.cidadeOrigem);
    const ufDestino = getUf(data.cidadeDestino);
    if (!ufOrigem || !ufDestino) {
      toast({ variant: 'destructive', title: 'UF Inválida', description: "Inclua a UF na origem e destino (ex: 'Curitiba, PR')." });
      setIsCalculationLoading(false);
      return;
    }

    // Identificar Tipos de Localidade Automaticamente (Origem e Destino)
    const originType = identifyLocationType(data.cidadeOrigem);
    const destType = identifyLocationType(data.cidadeDestino);

    data.isCapitalOrigem = originType.type === 'capital';
    data.isMetropolitanaOrigem = originType.type === 'metropolitana';
    data.isRuralOrigem = data.isRuralOrigem || false; // Manter rural manual se ativado, mas interior/metro/capital são auto

    data.isCapitalDestino = destType.type === 'capital';
    data.isMetropolitanaDestino = destType.type === 'metropolitana';
    data.isRuralDestino = data.isRuralDestino || false;

    let calculationData: any;
    let kmTotal = 0;
    let kmExcedente = 0;

    // Detect if we are re-opening and if any "pricing-sensitive" data changed
    const isPricingSensitiveChanged = !editingQuoteId || !quoteToRedo || 
        getPricingImpactField(data, quoteToRedo) !== null;

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
        icmsAliquota: icmsAliquota,
        icmsValor: total * (icmsAliquota / 100),
        veiculo: vehicle.name,
        prazoEntrega: calculateDeliveryTime(distanceOneWay, data.cidadeDestino, 'dedicado', user.role as any, data.prazoEntrega, company?.additionalDays || 0),
        freightMode: 'dedicado',
        isRoundTrip: isRoundTrip,
        adicionalProduto: productValueCost,
        adicional: additionalKmCost,
        regiao: region,
        acrescimoRegional: regionalSurcharge,
      };
    } else { // fracionado
        kmTotal = distanceOneWay; 
        kmExcedente = 0; 
        const pesoTaxavel = Math.max(data.peso || 0, (data.cubagem || 0) * 300);
        const region = getRegion(ufDestino) || '';
        
        const originRegion = getRegion(ufOrigem);
        const difficultyFees = (pricingSettings as any).difficultyFees?.fracionado || {};
        if (data.isRuralOrigem && originRegion) taxaDificuldade += (difficultyFees[originRegion] || 0);
        if (data.isRuralDestino && region) taxaDificuldade += (difficultyFees[region] || 0);

        // Get route-specific weight rate (Kg Cubado) from the matrix
        const routeRates = pricingSettings.fractionalMinimumFreight?.[ufOrigem]?.[ufDestino];
        let kgCubadoRate = (routeRates as any)?.kgCubado || 1.50;
        
        // Determine category-specific kg rate
        if (data.isRuralDestino) kgCubadoRate = (routeRates as any)?.kgRural || kgCubadoRate;
        else if (data.isMetropolitanaDestino) kgCubadoRate = (routeRates as any)?.kgMetropolitana || kgCubadoRate;
        else if (data.isCapitalDestino) kgCubadoRate = (routeRates as any)?.kgCapital || kgCubadoRate;
        else kgCubadoRate = (routeRates as any)?.kgInterior || kgCubadoRate;

        // Aplicar fator da faixa de peso (decrescente, cascata)
        const tierFactor = getWeightTierFactor(pricingSettings as any, pesoTaxavel, ufOrigem!, ufDestino!);
        const kgRateFinal = kgCubadoRate * tierFactor;
        
        let total = 0;
        let regionalSurchargeRate = (pricingSettings as any).surcharges.fracionado[region]?.regional || 0;

        if (!isPricingSensitiveChanged && quoteToRedo) {
            total = quoteToRedo.totalFrete;
        } else {
            const hasManualBaseValue = data.valorFrete && data.valorFrete > 0;
            const valorBaseFrete = hasManualBaseValue ? data.valorFrete : pesoTaxavel * kgRateFinal;
            let subtotal = valorBaseFrete + productValueCost + taxaDificuldade;
            total = subtotal * (1 + regionalSurchargeRate);
        }

        if (company) total = total - (total * (company.discountPercentage || 0)) + (total * (company.surchargePercentage || 0));
        const icmsAliquota = ((pricingSettings as any).icmsRates[ufOrigem]?.[ufDestino] ?? 0);
        
        calculationData = {
            totalFrete: total,
            icmsAliquota: icmsAliquota,
            icmsValor: total * (icmsAliquota / 100),
            veiculo: "Fracionado",
            prazoEntrega: calculateDeliveryTime(distanceOneWay, data.cidadeDestino, 'fracionado', user.role as any, data.prazoEntrega, company?.additionalDays || 0),
            freightMode: 'fracionado',
            adicionalProduto: productValueCost,
            adicional: 0,
            regiao: region,
            acrescimoRegional: regionalSurchargeRate,
        };

        // Apply Minimum Freight Check by Category
        const minFreightRates = pricingSettings.fractionalMinimumFreight?.[ufOrigem]?.[ufDestino];
        
        if (minFreightRates) {
            let category: keyof MinimumFreightValues = 'interior'; // Default
            
            // Logic to determine category
            if (data.isRuralDestino) {
                category = 'rural';
            } else if ((data as any).isMetropolitanaDestino) {
                category = 'metropolitana';
            } else if ((data as any).isCapitalDestino) {
                category = 'capital';
            }
            
            const minFreight = typeof minFreightRates === 'number' ? minFreightRates : (minFreightRates[category as keyof MinimumFreightValues] || 0);

            if (calculationData.totalFrete < minFreight) {
                calculationData.totalFrete = minFreight;
                // Recalculate ICMS based on the new total
                calculationData.icmsValor = minFreight * (calculationData.icmsAliquota / 100);
            }
        }
    }
    setIsCalculationLoading(false);

    const icmsValue = calculationData.icmsValor || 0;
    const currentTotal = calculationData.totalFrete + icmsValue;

    const result: Omit<CalculationResult, 'id'> & { id?: string } = {
      ...data,
      userId: user.id,
      data: new Date().toISOString(),
      status: ((user.role === 'cliente' || user.role === 'sub-cliente') ? 'Em Análise' : 'Aberta'),
      desconto: 0,
      valorFinal: calculationData.totalFrete,
      grossProfit: currentTotal, 
      totalExpense: icmsValue, 
      kmIda: distanceOneWay,
      kmTotal: kmTotal,
      kmExcedente: kmExcedente,
      taxaDificuldade: taxaDificuldade,
      ...calculationData
    };
    
    if (editingQuoteId && quoteToRedo) {
        result.id = editingQuoteId;
        const impactField = getPricingImpactField(data, quoteToRedo, freightMode);
        result.impactField = impactField;
        
        if (!isQuickUpdate) {
            if (!impactField) {
                // Cenário 1: Apenas CI alterado
                result.isInformativeOnly = true;
                result.valorFinal = quoteToRedo.valorFinal;
                result.icmsValor = quoteToRedo.icmsValor;
                result.grossProfit = (quoteToRedo.valorFinal || 0) + (quoteToRedo.icmsValor || 0);
                // Manter lucro e taxas originais
                result.taxaDificuldade = quoteToRedo.taxaDificuldade;
            } else {
                // Cenário 2: Impacto no frete
                result.isInformativeOnly = false;
                result.originalTotal = (quoteToRedo.valorFinal || 0) + (quoteToRedo.icmsValor || 0);
            }
        }
    }

    if (isQuickUpdate === true && editingQuoteId) {
        const impactField = getPricingImpactField(data, quoteToRedo, freightMode);
        const dirtyField = lastCalculatedData ? getPricingImpactField(data, lastCalculatedData, freightMode) : 'inicial';

        if (impactField && dirtyField) {
            toast({ 
                variant: 'destructive', 
                title: 'Recálculo Obrigatório', 
                description: `O campo "${impactField}" foi alterado e impacta o valor do frete. Por favor, clique em "Recalcular Frete" antes de atualizar.` 
            });
            setIsCalculationLoading(false);
            return;
        }

        await updateQuote(editingQuoteId, result as Quote, 'EDITADA', 'Cotação atualizada.');
        resetFormAndState();
    } else {
        setCalculationResult(result as any);
        if (!isQuickUpdate) {
            setLastCalculatedData(data);
        }
    }
  };
  
  const resetFormAndState = useCallback(() => {
      setCalculationResult(null);
      setEditingQuoteId(null);
      setQuoteToRedo(null);
      setLastCalculatedData(null);
      setIsRoundTrip(false);
      formRef.current?.reset();
  }, []);
  
  const apiAction = async (endpoint: string, method: 'POST' | 'PUT' | 'DELETE', body: any) => {
    const response = await authFetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Falha na operação ${method}`);
    }
    return response.json();
  };

  const saveQuote = async (quoteData: Omit<Quote, 'id'>) => {
    try {
      const result = await apiAction('/api/quotes', 'POST', { ...quoteData, userId: user!.id });
      handleDataMutated();
      return result.quote;
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao Salvar', description: e.message });
      return null;
    }
  };

  const updateQuote = async (quoteId: string, updates: Partial<Quote>, action: string, details: string) => {
    try {
      await apiAction(`/api/quotes/${quoteId}`, 'PUT', { ...updates, user });
      handleDataMutated();
      return true;
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao Atualizar', description: e.message });
      return false;
    }
  };
  
   const closeQuote = async (quote: Quote, enderecoColeta: string, enderecoEntrega: string, billingDueDate: string) => {
    if (!user) return false;
    
    const billingHistoryEvent: BillingHistoryEvent = {
        id: `hist-${Date.now()}-billing`,
        timestamp: new Date().toISOString(),
        userId: user.id,
        username: user.username,
        action: 'CRIADA',
        details: `Cobrança criada com vencimento em ${format(parse(billingDueDate, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy')}.`
    };

    const totalValue = (quote.valorFinal || 0) + (quote.icmsValor || 0);

    const updates = {
      status: 'Fechada' as QuoteStatus,
      enderecoColeta,
      enderecoEntrega,
      billingDueDate: new Date(`${billingDueDate}T12:00:00Z`).toISOString(),
      paymentStatus: 'Pendente' as const,
      grossProfit: totalValue,
      billingHistory: [billingHistoryEvent] // Pass history to be pushed by the API
    };
    
    const success = await updateQuote(quote.id, updates, 'COTACAO_FECHADA', `Cotação fechada e cobrança gerada com vencimento para ${format(new Date(`${billingDueDate}T12:00:00Z`), 'dd/MM/yyyy')}.`);
    
    if (success) {
      toast({ title: 'Sucesso!', description: 'Cotação fechada e cobrança gerada.' });
    }
    
    return success;
  };

  const handleSaveQuote = async () => {
    if (!calculationResult) return;

    if (editingQuoteId) {
      const currentFormData = formRef.current?.getValues();
      const impactField = currentFormData ? getPricingImpactField(currentFormData, lastCalculatedData, freightMode) : null;
      if (impactField) {
          toast({ 
              variant: 'destructive', 
              title: 'Novo Cálculo Necessário', 
              description: `O campo "${impactField}" foi alterado após o último cálculo. Por favor, recalcule antes de salvar.` 
          });
          return;
      }
      setIsCalculationLoading(true);
      // Mesclar dados atuais do formulário com o resultado do cálculo para salvar campos não-calculados (ex: obs)
      const finalResult = {
          ...currentFormData,
          ...calculationResult
      };
      await updateQuote(editingQuoteId, finalResult as Quote, 'EDITADA', 'Cotação recalculada e atualizada.');
    } else {
      setIsCalculationLoading(true);
      await saveQuote(calculationResult);
    }
    
    resetFormAndState();
    setIsCalculationLoading(false);
  };

  const handleRedoQuote = (quote: Quote) => {
    setFreightMode(quote.freightMode || (quote.veiculo === 'Fracionado' ? 'fracionado' : 'dedicado'));
    setEditingQuoteId(quote.id);
    setQuoteToRedo(quote);
    setIsRoundTrip(quote.isRoundTrip || false);
    window.scrollTo(0, 0); 
  };
  
  if (!user) {
    return (
        <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
  
  const canSwitchMode = user.fracionadoEnabled || user.role === 'admin' || user.role === 'user';

  return (
    <main className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-2">
          <h1 className="text-3xl font-bold text-primary">
              {editingQuoteId ? 'Refazendo Cotação' : 'Cotação de Frete'}
          </h1>
          <Button variant="outline" onClick={resetFormAndState} disabled={isCalculationLoading}>
              <RefreshCw className="mr-2 h-4 w-4"/> Limpar
          </Button>
      </div>
      <p className="text-muted-foreground mb-6">
          {editingQuoteId ? `Modifique os dados e clique em "Calcular Frete" para atualizar.` : 'Calcule e gerencie suas cotações de frete.'}
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
        initialData={quoteToRedo}
        isEditing={!!editingQuoteId}
        canSwitchMode={canSwitchMode}
        hideQuickSave={!!calculationResult}
      />
      
      {calculationResult && (
        <Card className="my-8 animate-fade-in border-blue-200 bg-blue-50/30">
          <CardHeader>
            <CardTitle>{editingQuoteId ? 'Novo Resultado' : 'Resultado do Cálculo'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
              {(calculationResult as any).originalTotal !== undefined && (calculationResult as any).originalTotal !== (calculationResult.valorFinal! + (calculationResult.icmsValor || 0)) && (
                <div className="mb-4 p-3 bg-white border border-blue-100 rounded-lg flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Valor Anterior (Total):</span>
                  <span className="font-semibold text-muted-foreground line-through">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((calculationResult as any).originalTotal)}
                  </span>
                </div>
              )}



              <div className="text-center">
                <p className="text-muted-foreground">Total do Frete (Frete + Taxas + ICMS)</p>
                <div className="flex flex-col items-center gap-1">
                  <p className="text-4xl font-bold text-primary">
                    {(calculationResult.valorFinal! + (calculationResult.icmsValor || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                  {editingQuoteId && (calculationResult as any).isInformativeOnly && (
                    <span className="text-sm px-3 py-1 bg-amber-100 text-amber-800 rounded-lg font-medium animate-pulse">
                      Foram alterados apenas dados informativos
                    </span>
                  )}
                </div>
              </div>
            <div className="flex justify-end gap-2">
              {editingQuoteId && <Button variant="outline" onClick={resetFormAndState} disabled={isCalculationLoading}>Cancelar Edição</Button>}
              <Button onClick={handleSaveQuote} disabled={isCalculationLoading}>
                {isCalculationLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingQuoteId ? 'Atualizar Cotação' : 'Salvar Cotação'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator className="my-12" />

      <QuoteList 
        onRedoQuote={handleRedoQuote}
        onQuoteMutated={handleDataMutated}
        quotes={quotes}
        onCloseQuote={closeQuote}
        onLoadMore={handleLoadMore}
        hasMore={hasMore}
        isLoading={isLoading}
      />
    </main>
  );
}
