

"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { FreightForm, type FreightFormHandle } from '@/components/FreightForm';
import { QuoteList } from '@/components/QuoteList';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { Quote, QuoteExtra, Company, Vehicle, User as AuthUser, FreightMode, BillingHistoryEvent, QuoteStatus, MinimumFreightValues } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, Truck, ClipboardList, Plus } from 'lucide-react';
import { QuoteExtrasDialog } from '@/components/QuoteExtrasDialog';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { format, parse } from 'date-fns';
import { identifyLocationType } from '@/lib/location-utils';
import { authFetch } from '@/lib/api-client';
import { getWeightTierFactor } from '@/lib/weight-tiers';

const QUOTES_PER_PAGE = 12;

export default function QuotesPage() {
  const { user, pricingSettings: authPricingSettings } = useAuth();
  const { toast } = useToast();
  const formRef = useRef<FreightFormHandle>(null);

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [pricingSettings, setPricingSettings] = useState(authPricingSettings);
  
  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ['vehicles-list'],
    queryFn: () => {
      const token = localStorage.getItem('sessionToken');
      return authFetch('/api/vehicles', {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(res => res.json());
    },
    enabled: !!user,
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ['companies-list'],
    queryFn: () => {
      const token = localStorage.getItem('sessionToken');
      return authFetch('/api/customers', {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(res => res.json());
    },
    enabled: !!user,
  });

  const { data: users = [] } = useQuery<AuthUser[]>({
    queryKey: ['users-list'],
    queryFn: () => {
      const token = localStorage.getItem('sessionToken');
      return authFetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(res => res.json());
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
  const [manualOverrideValue, setManualOverrideValue] = useState<string>('');
  const [isExtrasOpen, setIsExtrasOpen] = useState(false);
  const [pendingExtras, setPendingExtras] = useState<QuoteExtra[]>([]);
  const [pendingExtrasTotal, setPendingExtrasTotal] = useState(0);

  const fetchQuotes = useCallback(async (pageNum: number, refresh = false) => {
    setIsLoading(true);
    try {
        const token = localStorage.getItem('sessionToken');
        const response = await authFetch(`/api/quotes?page=${pageNum}&limit=${QUOTES_PER_PAGE}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
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
    } else if (user && user.role === 'user') {
        const canFrac = user.subPermissions?.freight?.canQuoteFracionado ?? true;
        const canDed = user.subPermissions?.freight?.canQuoteDedicado ?? true;
        if (!canFrac && canDed) {
            setFreightMode('dedicado');
        } else if (!canDed && canFrac) {
            setFreightMode('fracionado');
        }
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

  const getPricingImpactField = (newData: any, originalData: any, currentMode?: FreightMode) => {
    if (!originalData) return null;
    
    const fields = [
        'cidadeOrigem', 'cidadeDestino', 'veiculo', 'peso', 
        'cubagem', 'valorProduto', 'valorFrete', 'isRuralOrigem', 'isRuralDestino', 
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
        else if (['peso', 'cubagem', 'valorProduto', 'valorFrete'].includes(field)) {
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

    // ── ARMAZENAGEM MODE ──────────────────────────────────────────────
    if (freightMode === 'armazenagem') {
      try {
        const token = localStorage.getItem('sessionToken');
        const settingsRes = await authFetch('/api/settings/storage-pricing', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!settingsRes.ok) throw new Error('Falha ao carregar preços de armazenagem.');
        const storageSettings = await settingsRes.json();

        const dias = Number(data.prazoEntrega) || 30;
        const posicoes = Number(data.quantidade) || 0;
        const peso = Number(data.peso) || 0;
        const cubagem = Number(data.cubagem) || 0;
        const incluirDescarga = data.incluirDescarga !== false;

        const fatorTempo = dias / 30;
        const valorPosicoes = posicoes * storageSettings.pricePerPosition * fatorTempo;
        const valorPeso = peso * storageSettings.weightPricePerKg * fatorTempo;
        const valorCubagem = cubagem * storageSettings.cbmPrice * fatorTempo;
        const valorDescarga = incluirDescarga
          ? (posicoes > 0 ? posicoes * storageSettings.unloadingRate : storageSettings.unloadingRate)
          : 0;

        let total = valorPosicoes + valorPeso + valorCubagem + valorDescarga;
        let valorFinal = total;

        if (company) {
          valorFinal = valorFinal
            - (valorFinal * (company.discountPercentage || 0))
            + (valorFinal * (company.surchargePercentage || 0));
        }

        const obsDetalhes = [
          `Cotação de Armazenagem (${dias} dias)`,
          posicoes > 0 ? `Posições: ${posicoes}` : null,
          peso > 0 ? `Peso: ${peso}kg` : null,
          cubagem > 0 ? `Cubagem: ${cubagem}m³` : null,
          `Taxa Descarga: ${incluirDescarga ? 'Inclusa' : 'Não Inclusa'}`,
        ].filter(Boolean).join(' | ');

        const storageResult: any = {
          ...data,
          userId: user.id,
          usuario: data.usuario || user.username,
          freightMode: 'armazenagem',
          cidadeOrigem: 'Armazém DezLog',
          cidadeDestino: 'Armazém DezLog',
          veiculo: 'Armazenagem',
          data: new Date().toISOString(),
          status: user.role === 'cliente' ? 'Em Análise' : 'Aberta',
          valorProduto: 0,
          totalFrete: total,
          valorFinal: valorFinal,
          desconto: total - valorFinal,
          grossProfit: valorFinal,
          totalExpense: 0,
          icmsAliquota: 0,
          icmsValor: 0,
          kmIda: 0,
          kmTotal: 0,
          kmExcedente: 0,
          adicional: 0,
          adicionalProduto: 0,
          acrescimoRegional: 0,
          taxaDificuldade: 0,
          regiao: null,
          prazoEntrega: dias,
          obs: data.obs ? `${data.obs}\n${obsDetalhes}` : obsDetalhes,
        };

        setCalculationResult(storageResult);
        setLastCalculatedData(data);
      } catch (e: any) {
        toast({ variant: 'destructive', title: 'Erro de Armazenagem', description: e.message });
      } finally {
        setIsCalculationLoading(false);
      }
      return;
    }
    // ─────────────────────────────────────────────────────────────────

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
      
      const subtotalBase = vehicle.valorBase + additionalKmCost + productValueCost + taxaDificuldade;
      const profitRate = pricingSettings.operational.profitTaxRate || 0;
      const subtotal = subtotalBase * (1 + profitRate);

      const region = getRegion(ufDestino) || '';
      const regionalSurcharge = ((pricingSettings as any).surcharges.dezlog[region] || 0);
      let total = subtotal * (1 + regionalSurcharge);
      if (company) total = total - (total * (company.discountPercentage || 0)) + (total * (company.surchargePercentage || 0));
      
      const icmsAliquota = ((pricingSettings as any).icmsRates[ufOrigem]?.[ufDestino] ?? 0);
      
      let anttSuggestion = undefined;
      try {
          const cargoType = data.cargoType || 'Geral';
          const anttRes = await fetch(`/api/antt/calculate?distance=${kmTotal}&vehicleKey=${data.veiculo}&cargoType=${cargoType}&isRoundTrip=${isRoundTrip}`);
          if (anttRes.ok) {
              const anttData = await anttRes.json();
              const pisoAntt = anttData.total || 0;
              const grisPercent = pricingSettings.operational.grisAdvaloremRate || 0;
              const grisValue = (data.valorProduto || 0) * grisPercent;
              const baseForProfit = pisoAntt + grisValue;
              const profitValue = baseForProfit * profitRate;
              const baseForIcms = baseForProfit + profitValue;
              const icmsValueSug = baseForIcms * (icmsAliquota / 100);
              
              anttSuggestion = {
                  pisoAntt,
                  grisPercent: grisPercent * 100,
                  grisValue,
                  lucroPercent: profitRate * 100,
                  lucroValue: profitValue,
                  icmsPercent: icmsAliquota,
                  icmsValue: icmsValueSug,
                  totalSugestao: baseForIcms + icmsValueSug
              };
          }
      } catch (e) {
          console.error("Erro ao calcular sugestão ANTT", e);
      }

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
        anttSuggestion,
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

        // Aplicar fator da faixa de peso (decrescente, com fallback cascata)
        const tierFactor = getWeightTierFactor(pricingSettings, pesoTaxavel, ufOrigem!, ufDestino!);
        const kgRateFinal = kgCubadoRate * tierFactor;
        
        let total = 0;
        let regionalSurchargeRate = (pricingSettings as any).surcharges.fracionado[region]?.regional || 0;

        if (!isPricingSensitiveChanged && quoteToRedo) {
            total = quoteToRedo.totalFrete;
        } else {
            const hasManualBaseValue = data.valorFrete && data.valorFrete > 0;
            const valorBaseFrete = hasManualBaseValue ? data.valorFrete : pesoTaxavel * kgRateFinal;
            const subtotalBase = valorBaseFrete + productValueCost + taxaDificuldade;
            const profitRate = pricingSettings.operational.profitTaxRate || 0;
            let subtotal = subtotalBase * (1 + profitRate);
            total = subtotal * (1 + regionalSurchargeRate);
        }

        if (company) total = total - (total * (company.discountPercentage || 0)) + (total * (company.surchargePercentage || 0));
        const icmsAliquota = ((pricingSettings as any).icmsRates[ufOrigem]?.[ufDestino] ?? 0);
        
        const hasManualBaseValue = data.valorFrete && data.valorFrete > 0;
            
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
            hasManualBaseFreight: hasManualBaseValue,
            valorBaseManual: hasManualBaseValue ? data.valorFrete : undefined,
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

    // Apply pending extras if they exist before building the final result
    // IMPORTANT: DO NOT add extras to calculationData.totalFrete directly,
    // otherwise it breaks the backward calculation of Frete Peso in the PDF.
    const appliedExtrasTotal = pendingExtras.length > 0 ? pendingExtrasTotal : 0;
    
    // ICMS applies to everything (Frete + Extras)
    calculationData.icmsValor = (calculationData.totalFrete + appliedExtrasTotal) * ((calculationData.icmsAliquota || 0) / 100);

    const icmsValue = calculationData.icmsValor || 0;
    // valorFinal is the base value of the quote before ICMS (Frete + Extras)
    const finalValueSemIcms = calculationData.totalFrete + appliedExtrasTotal;
    const currentTotal = finalValueSemIcms + icmsValue;

    const result: Omit<CalculationResult, 'id'> & { id?: string } = {
      ...data,
      userId: user.id,
      data: new Date().toISOString(),
      status: (user.role === 'cliente' ? 'Em Análise' : 'Aberta'),
      desconto: 0,
      valorFinal: finalValueSemIcms,
      grossProfit: currentTotal, 
      totalExpense: icmsValue, 
      kmIda: distanceOneWay,
      kmTotal: kmTotal,
      extras: pendingExtras.length > 0 ? pendingExtras : undefined,
      extrasTotal: appliedExtrasTotal > 0 ? appliedExtrasTotal : undefined,
      kmExcedente: kmExcedente,
      taxaDificuldade: taxaDificuldade,
      ...calculationData
    };
    
    if (editingQuoteId && quoteToRedo) {
        result.id = editingQuoteId;
        const impactField = getPricingImpactField(data, quoteToRedo, freightMode);
        
        // Ensure that changing extras also counts as an impact
        const oldExtrasTotal = quoteToRedo.extrasTotal || 0;
        const hasExtrasChanged = oldExtrasTotal !== appliedExtrasTotal;
        const finalImpactField = impactField || (hasExtrasChanged ? 'extras' : null);
        
        result.impactField = finalImpactField;
        
        if (!isQuickUpdate) {
            if (!finalImpactField) {
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
      setManualOverrideValue('');
      setPendingExtras([]);
      setPendingExtrasTotal(0);
      formRef.current?.reset();
  }, []);
  
  const applyManualOverride = () => {
      if (!calculationResult || !manualOverrideValue) return;
      
      const numericValue = manualOverrideValue.replace(/\D/g, '');
      const desiredTotal = parseInt(numericValue) / 100;

      if (isNaN(desiredTotal) || desiredTotal <= 0) {
          toast({ variant: 'destructive', title: 'Valor inválido', description: 'Por favor, insira um valor numérico válido.' });
          return;
      }
      
      const icmsAliquota = calculationResult.icmsAliquota || 0;
      const newTotalFrete = desiredTotal / (1 + icmsAliquota / 100);
      const newIcmsValor = desiredTotal - newTotalFrete;

      setCalculationResult(prev => ({
          ...prev!,
          valorFinal: newTotalFrete,
          totalFrete: newTotalFrete,
          icmsValor: newIcmsValor,
          grossProfit: desiredTotal,
          hasManualFinalValue: true,
      }));
      
      setManualOverrideValue('');
      toast({
          title: 'Valor Atualizado',
          description: 'O valor final foi ajustado manualmente.'
      });
  };

  const handleManualOverrideChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value === '') {
        setManualOverrideValue('');
        return;
    }
    const amount = parseInt(value) / 100;
    setManualOverrideValue(amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
  };
  
  const apiAction = async (endpoint: string, method: 'POST' | 'PUT' | 'DELETE', body: any) => {
    const token = localStorage.getItem('sessionToken');
    const response = await authFetch(endpoint, {
        method,
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
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

  const handleExtrasConfirm = (extras: QuoteExtra[], total: number) => {
    setPendingExtras(extras);
    setPendingExtrasTotal(total);
    
    if (calculationResult) {
      // The totalFrete is strictly the base freight (never includes extras)
      const baseFrete = calculationResult.totalFrete || 0;
      const finalValueSemIcms = baseFrete + total;
      const icmsAliquota = calculationResult.icmsAliquota || 0;
      const newIcmsValor = finalValueSemIcms * (icmsAliquota / 100);

      setCalculationResult(prev => ({
        ...prev!,
        valorFinal: finalValueSemIcms,
        icmsValor: newIcmsValor,
        grossProfit: finalValueSemIcms + newIcmsValor,
        extras: extras.length > 0 ? extras : undefined,
        extrasTotal: total > 0 ? total : undefined,
      }));
    }
    
    toast({ title: 'Extras Adicionados', description: `${extras.length} item(ns) adicionado(s) totalizando ${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.` });
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
      const finalResult = {
          ...currentFormData,
          ...calculationResult,
          extras: pendingExtras.length > 0 ? pendingExtras : calculationResult.extras,
          extrasTotal: pendingExtras.length > 0 ? pendingExtrasTotal : calculationResult.extrasTotal,
      };
      await updateQuote(editingQuoteId, finalResult as Quote, 'EDITADA', 'Cotação recalculada e atualizada.');
    } else {
      setIsCalculationLoading(true);
      const quoteWithExtras = {
        ...calculationResult,
        extras: pendingExtras.length > 0 ? pendingExtras : calculationResult.extras,
        extrasTotal: pendingExtras.length > 0 ? pendingExtrasTotal : calculationResult.extrasTotal,
      };
      await saveQuote(quoteWithExtras);
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

  const handleCloneQuote = (quote: Quote) => {
    setEditingQuoteId(null);
    setQuoteToRedo(null);
    setFreightMode(quote.freightMode || (quote.veiculo === 'Fracionado' ? 'fracionado' : 'dedicado'));
    setIsRoundTrip(quote.isRoundTrip || false);
    
    setTimeout(() => {
        formRef.current?.prefill({
            cidadeOrigem: quote.cidadeOrigem,
            cidadeDestino: quote.cidadeDestino,
            remetente: quote.remetente,
            destinatario: quote.destinatario,
            tomador: quote.tomador,
            valorProduto: quote.valorProduto,
            peso: quote.peso,
            quantidade: quote.quantidade,
            cubagem: quote.cubagem,
            veiculo: quote.veiculo,
            totalFrete: quote.totalFrete,
            hasManualBaseFreight: quote.hasManualBaseFreight,
            valorBaseManual: quote.valorBaseManual,
            freightMode: quote.freightMode,
            obs: quote.obs,
            nfNumber: quote.nfNumber,
            nfeXml: quote.nfeXml,
        });
        
        toast({ 
            title: 'Cotação Clonada', 
            description: 'O formulário foi preenchido. Altere o que for necessário e salve a nova cotação.' 
        });
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 50);
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
  
  let canSwitchMode = false;
  if (user.role === 'admin') {
      canSwitchMode = true;
  } else if (user.role === 'cliente' || user.role === 'sub-cliente') {
      canSwitchMode = !!user.fracionadoEnabled;
  } else if (user.role === 'user') {
      const canFrac = user.subPermissions?.freight?.canQuoteFracionado ?? true;
      const canDed = user.subPermissions?.freight?.canQuoteDedicado ?? true;
      canSwitchMode = canFrac && canDed;
  }

  return (
    <main className="container mx-auto p-4 md:p-8 relative overflow-hidden">
      {/* Efeitos de desfoque e brilho aurora neon atrás dos cards */}
      <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/15 rounded-full blur-[100px] pointer-events-none -z-10 animate-float-blur-1" />
      <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-purple-500/15 rounded-full blur-[120px] pointer-events-none -z-10 animate-float-blur-2" />
      <PageHeader
          icon={<ClipboardList className="h-4 w-4" />}
          badge={editingQuoteId ? 'Edição de Cotação' : 'Calculadora de Frete'}
          titlePrefix={editingQuoteId ? 'Refazendo' : freightMode === 'armazenagem' ? 'Cotação de' : 'Cotação de'}
          titleHighlight={editingQuoteId ? 'Cotação' : freightMode === 'armazenagem' ? 'Armazenagem' : 'Frete'}
          description={editingQuoteId
            ? `Modifique os dados e clique em "${freightMode === 'armazenagem' ? 'Calcular Armazenagem' : 'Calcular Frete'}" para atualizar.`
            : freightMode === 'armazenagem'
            ? 'Gere cotações para recebimento e estocagem no galpão.'
            : 'Calcule e gerencie suas cotações de frete.'}
          actions={
            <>
              {editingQuoteId && (
                  <Button variant="destructive" onClick={resetFormAndState} disabled={isCalculationLoading}>
                      Cancelar Edição
                  </Button>
              )}
              <Button variant="outline" onClick={resetFormAndState} disabled={isCalculationLoading}>
                  <RefreshCw className="mr-2 h-4 w-4"/> Limpar
              </Button>
            </>
          }
      />
      
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
        onCloneQuote={handleCloneQuote}
        onExtrasClick={() => setIsExtrasOpen(true)}
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
                <p className="text-muted-foreground">{freightMode === 'armazenagem' ? 'Total da Armazenagem' : 'Total do Frete (Frete + Taxas + ICMS)'}</p>
                <div className="flex flex-col items-center gap-1">
                  <p className="text-4xl font-bold text-primary">
                    {(calculationResult.valorFinal! + (calculationResult.icmsValor || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <span>Base: {((calculationResult.valorFinal || 0) - (calculationResult.extrasTotal || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    {calculationResult.extrasTotal && calculationResult.extrasTotal > 0 && (
                      <>
                        <span>+</span>
                        <span className="text-blue-600 font-medium">Extras: {calculationResult.extrasTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                      </>
                    )}
                    <span>+</span>
                    <span>ICMS: {(calculationResult.icmsValor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>

                  {editingQuoteId && (calculationResult as any).isInformativeOnly && (
                    <span className="text-sm px-3 py-1 bg-amber-100 text-amber-800 rounded-lg font-medium animate-pulse mt-2">
                      Foram alterados apenas dados informativos
                    </span>
                  )}
                </div>
                
                {calculationResult.anttSuggestion && user.subPermissions?.freight?.canViewAnttSuggestion && (
                  <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-sm max-w-2xl mx-auto">
                    <p className="font-semibold mb-2 flex items-center justify-center gap-2">
                      <Truck className="h-4 w-4" /> Sugestão ANTT (Informativo)
                    </p>
                    <p className="text-center text-emerald-800/80 mb-3 text-xs md:text-sm">
                      {calculationResult.anttSuggestion.pisoAntt.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (piso) + {' '}
                      {calculationResult.anttSuggestion.grisValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (gris) + {' '}
                      {calculationResult.anttSuggestion.lucroValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (lucro) + {' '}
                      {calculationResult.anttSuggestion.icmsValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (ICMS)
                    </p>
                    <div className="flex flex-col items-center gap-2">
                        <p className="font-bold text-emerald-700 text-lg">
                          Frete Sugerido = {calculationResult.anttSuggestion.totalSugestao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          className="border-emerald-600 text-emerald-700 hover:bg-emerald-100 mt-1"
                          onClick={() => {
                             const sug = calculationResult.anttSuggestion!.totalSugestao;
                             const icmsAliquota = calculationResult.icmsAliquota || 0;
                             const newTotalFrete = sug / (1 + icmsAliquota / 100);
                             const newIcmsValor = sug - newTotalFrete;

                             setCalculationResult(prev => ({
                                 ...prev!,
                                 valorFinal: newTotalFrete,
                                 totalFrete: newTotalFrete,
                                 icmsValor: newIcmsValor,
                                 grossProfit: sug,
                                 hasManualFinalValue: true,
                             }));
                             
                             toast({ title: 'Sugestão Aplicada', description: 'O valor ANTT foi aplicado como valor final.' });
                          }}
                        >
                            Usar Sugestão ANTT
                        </Button>
                    </div>
                  </div>
                )}
                
                {user.subPermissions?.freight?.canDefineFreightValue && freightMode !== 'armazenagem' && (
                  <div className="mt-6 flex flex-col items-center gap-2 border-t pt-4 border-blue-100">
                    <Label htmlFor="override-value" className="text-sm font-medium text-muted-foreground">Substituir Valor Final do Frete</Label>
                    <div className="flex gap-2 items-center">
                        <Input 
                            id="override-value"
                            type="text" 
                            className="w-40 text-center font-bold text-blue-600" 
                            placeholder="R$ 0,00"
                            value={manualOverrideValue}
                            onChange={handleManualOverrideChange}
                        />
                        <Button type="button" variant="secondary" size="sm" onClick={applyManualOverride}>
                            Aplicar
                        </Button>
                    </div>
                  </div>
                )}
              </div>
            {/* Extras Summary */}
            {pendingExtras.length > 0 && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm font-semibold text-amber-800 mb-2">Itens Extras Adicionados:</p>
                <div className="space-y-1">
                  {pendingExtras.map((ext, i) => (
                    <div key={i} className="flex justify-between text-xs text-amber-700">
                      <span>{ext.quantity}x {ext.name} ({ext.unitValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} un.)</span>
                      <span className="font-medium">{ext.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-sm font-bold text-amber-900 mt-2 pt-2 border-t border-amber-300">
                  <span>Total Extras:</span>
                  <span>{pendingExtrasTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
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
        onCloneQuote={handleCloneQuote}
        onQuoteMutated={handleDataMutated}
        quotes={quotes}
        onCloseQuote={closeQuote}
        onLoadMore={handleLoadMore}
        hasMore={hasMore}
        isLoading={isLoading}
      />

      <QuoteExtrasDialog
        open={isExtrasOpen}
        onOpenChange={setIsExtrasOpen}
        onConfirm={handleExtrasConfirm}
        initialExtras={pendingExtras.length > 0 ? pendingExtras : calculationResult?.extras}
      />

      <style>{`
        @keyframes floatBlur1 {
          0%, 100% {
            transform: translate(0, 0) scale(1);
            background-color: hsl(var(--primary) / 0.15);
          }
          25% {
            transform: translate(120px, 60px) scale(1.15);
            background-color: rgba(99, 102, 241, 0.18); /* Indigo */
          }
          50% {
            transform: translate(40px, 160px) scale(0.95);
            background-color: rgba(236, 72, 153, 0.14); /* Pink */
          }
          75% {
            transform: translate(-80px, 100px) scale(1.08);
            background-color: rgba(59, 130, 246, 0.18); /* Blue */
          }
        }

        @keyframes floatBlur2 {
          0%, 100% {
            transform: translate(0, 0) scale(1);
            background-color: rgba(168, 85, 247, 0.15); /* Purple */
          }
          33% {
            transform: translate(-100px, -120px) scale(1.1);
            background-color: rgba(59, 130, 246, 0.16); /* Blue */
          }
          66% {
            transform: translate(80px, -60px) scale(0.9);
            background-color: rgba(236, 72, 153, 0.14); /* Pink */
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
