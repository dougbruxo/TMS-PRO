
"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Save, ArrowLeft, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MinimumFreightTable } from '@/components/pricing/MinimumFreightTable';
import { MinimumFreightRegionTable } from '@/components/pricing/MinimumFreightRegionTable';
import { WeightTiersConfig } from '@/components/pricing/WeightTiersConfig';
import type { PricingSettings, MinimumFreightValues } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from '@/components/ui/scroll-area';
import { authFetch } from '@/lib/api-client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function FractionalMinimumPricingPage() {
  const { user, loading: authLoading, refreshPricingSettings } = useAuth();
  const [pricingSettings, setPricingSettings] = useState<PricingSettings | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  const [localSettings, setLocalSettings] = useState<PricingSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // States for Propagation Alert
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [pendingPropagation, setPendingPropagation] = useState<{
    originRegion: string,
    destRegion: string,
    field: string,
    value: number
  } | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);

  const fetchSettings = useCallback(async () => {
    setIsDataLoading(true);
    try {
      const response = await authFetch('/api/settings/pricing');
      if (!response.ok) throw new Error("Failed to fetch settings");
      const data = await response.json();
      
      if (!data.fractionalMinimumFreight) data.fractionalMinimumFreight = {};
      if (!data.regionMinimumFreight) data.regionMinimumFreight = {};
      if (!data.icmsRates) data.icmsRates = {};
      
      setPricingSettings(data);
      setLocalSettings(data);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message });
    } finally {
      setIsDataLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'admin' || !user.settingsAccess) {
      router.push('/dashboard');
      return;
    }
    fetchSettings();
  }, [user, authLoading, router, fetchSettings]);
  
  const handleSave = async () => {
    if (!localSettings) return;
    setIsSaving(true);
    try {
        const response = await authFetch('/api/settings/pricing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(localSettings),
        });
        if (!response.ok) throw new Error("Failed to update settings");
        toast({ title: "Sucesso!", description: "Tabela de frete mínimo atualizada." });
        await fetchSettings();
        if (refreshPricingSettings) {
            await refreshPricingSettings();
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: "Erro", description: error.message });
    } finally {
        setIsSaving(false);
    }
  };

  const handleRateChange = (origin: string, dest: string, field: string, value: string) => {
    setLocalSettings(prev => {
        if (!prev) return null;
        const newRates = { ...(prev.fractionalMinimumFreight || {}) };
        if (!newRates[origin]) newRates[origin] = {};
        if (!newRates[origin][dest]) {
            newRates[origin][dest] = { capital: 0, metropolitana: 0, interior: 0, rural: 0, kgCubado: 0, kgCapital: 0, kgMetropolitana: 0, kgInterior: 0, kgRural: 0 };
        }
        
        newRates[origin][dest] = {
            ...newRates[origin][dest],
            [field]: parseFloat(value) || 0
        };
        
        return { ...prev, fractionalMinimumFreight: newRates };
    });
  };

  const handleBulkApply = (origin: string, field: string, value: string | number) => {
    const numericValue = typeof value === 'number' ? value : (Number(value.replace(/\D/g, '')) / 100);
    
    setLocalSettings(prev => {
        if (!prev) return null;
        const newRates = { ...(prev.fractionalMinimumFreight || {}) };
        if (!newRates[origin]) newRates[origin] = {};
        
        // Apply to all destination UFs
        const allUfs = Object.keys(prev.icmsRates);
        allUfs.forEach(destUf => {
            if (!newRates[origin][destUf]) {
              newRates[origin][destUf] = { capital: 0, metropolitana: 0, interior: 0, rural: 0, kgCubado: 0, kgCapital: 0, kgMetropolitana: 0, kgInterior: 0, kgRural: 0 };
            }
            newRates[origin][destUf] = {
                ...newRates[origin][destUf],
                [field]: numericValue
            };
        });
        
        return { ...prev, fractionalMinimumFreight: newRates };
    });
  };

  const handleRegionRateChange = (originRegion: string, destRegion: string, field: string, value: string | number) => {
    // Note: value here comes from getMaskedValue transformation in child, but we handle raw input in child effectively
    const numericValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
    
    // Check for conflicts before applying
    if (localSettings) {
        const originUfs = localSettings.regions[originRegion] || [];
        const destUfs = localSettings.regions[destRegion] || [];
        const currentRegionValues = localSettings.regionMinimumFreight?.[originRegion]?.[destRegion];
        const currentFieldVal = currentRegionValues ? (currentRegionValues as any)[field] : 0;
        
        const overrideList: string[] = [];
        originUfs.forEach(ufO => {
            destUfs.forEach(ufD => {
                const ufRates = localSettings.fractionalMinimumFreight?.[ufO]?.[ufD];
                const ufValue = ufRates ? (ufRates as any)[field] : undefined;
                
                // If the UF value is different from the current region template, it's a "custom override"
                if (ufValue !== undefined && ufValue !== currentFieldVal && ufValue !== 0) {
                    overrideList.push(`${ufO} -> ${ufD}`);
                }
            });
        });

        if (overrideList.length > 0) {
            setConflicts(overrideList);
            setPendingPropagation({ originRegion, destRegion, field, value: numericValue });
            setIsAlertOpen(true);
            return;
        }
    }

    applyRegionUpdate(originRegion, destRegion, field, numericValue);
  };

  const applyRegionUpdate = (originRegion: string, destRegion: string, field: string, value: number) => {
    setLocalSettings(prev => {
        if (!prev) return null;
        
        // 1. Update Region Template
        const newRegionRates = { ...(prev.regionMinimumFreight || {}) };
        if (!newRegionRates[originRegion]) newRegionRates[originRegion] = {};
        if (!newRegionRates[originRegion][destRegion]) {
            newRegionRates[originRegion][destRegion] = { capital: 0, metropolitana: 0, interior: 0, rural: 0, kgCubado: 0, kgCapital: 0, kgMetropolitana: 0, kgInterior: 0, kgRural: 0 };
        }
        newRegionRates[originRegion][destRegion] = {
            ...newRegionRates[originRegion][destRegion],
            [field]: value
        };

        // 2. Propagate to UFs
        const newUfRates = { ...(prev.fractionalMinimumFreight || {}) };
        const originUfs = prev.regions[originRegion] || [];
        const destUfs = prev.regions[destRegion] || [];

        originUfs.forEach(ufO => {
            if (!newUfRates[ufO]) newUfRates[ufO] = {};
            destUfs.forEach(ufD => {
                if (!newUfRates[ufO][ufD]) {
                    newUfRates[ufO][ufD] = { capital: 0, metropolitana: 0, interior: 0, rural: 0, kgCubado: 0, kgCapital: 0, kgMetropolitana: 0, kgInterior: 0, kgRural: 0 };
                }
                newUfRates[ufO][ufD] = {
                    ...newUfRates[ufO][ufD],
                    [field]: value
                };
            });
        });

        return { ...prev, regionMinimumFreight: newRegionRates, fractionalMinimumFreight: newUfRates };
    });
  };

  const confirmPropagation = () => {
    if (pendingPropagation) {
        applyRegionUpdate(pendingPropagation.originRegion, pendingPropagation.destRegion, pendingPropagation.field, pendingPropagation.value);
    }
    setIsAlertOpen(false);
    setPendingPropagation(null);
  };

  if (authLoading || isDataLoading || !user || !localSettings) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
      <main className="container mx-auto p-4 md:p-8">
        <div className="flex justify-between items-start mb-8 flex-wrap gap-4">
           <div>
              <Button variant="outline" onClick={() => router.push('/settings/freight-pricing')} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
              <h1 className="text-3xl font-bold text-primary mb-2">Precificação Fracionado</h1>
              <p className="text-muted-foreground max-w-2xl">
                Defina o valor mínimo de frete para cada rota. Você pode configurar por macro-região ou detalhar por UF.
              </p>
           </div>
           <div>
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>}
                    Salvar Alterações
                </Button>
           </div>
        </div>

        <Tabs defaultValue="region" className="space-y-6">
            <TabsList className="grid w-full md:w-[600px] grid-cols-3">
                <TabsTrigger value="region">Por Região</TabsTrigger>
                <TabsTrigger value="uf">Por UF</TabsTrigger>
                <TabsTrigger value="weightTiers">Faixas de Peso (Decrescente)</TabsTrigger>
            </TabsList>

            <TabsContent value="region" className="space-y-4">
                <div className="bg-primary/5 p-4 rounded-lg flex gap-3 items-start border border-primary/10">
                    <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <p className="text-sm text-primary/80">
                        Alterar um valor aqui atualizará <strong>todas as UFs</strong> pertencentes às regiões selecionadas. 
                        Se uma UF tiver um preço específico já configurado, o sistema irá alertá-lo antes de sobrescrever.
                    </p>
                </div>
                <MinimumFreightRegionTable 
                    regions={localSettings.regions}
                    regionRates={localSettings.regionMinimumFreight || {}}
                    onRateChange={handleRegionRateChange}
                />
            </TabsContent>

            <TabsContent value="uf">
                <MinimumFreightTable 
                    rates={localSettings.fractionalMinimumFreight} 
                    regions={localSettings.regions} 
                    onRateChange={handleRateChange}
                    onBulkApply={handleBulkApply}
                    title="Matriz Detalhada (UF x UF)"
                    description="Ajuste fino dos valores mínimos. Use o campo 'Aplicar tudo' no cabeçalho para preencher a coluna inteira para a origem selecionada."
                />
            </TabsContent>

            <TabsContent value="weightTiers">
                <WeightTiersConfig settings={localSettings as any} setSettings={setLocalSettings as any} />
            </TabsContent>
        </Tabs>

        {/* Overwrite Alert Dialog */}
        <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
            <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                    <AlertDialogTitle>Sobrescrever regras específicas?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta alteração na região irá sobrescrever as regras específicas já configuradas para as seguintes rotas:
                        <ScrollArea className="h-32 mt-4 p-2 border rounded-md">
                            <ul className="text-xs space-y-1">
                                {conflicts.map(c => <li key={c} className="font-mono">{c}</li>)}
                            </ul>
                        </ScrollArea>
                        <p className="mt-4">Deseja continuar e aplicar o novo valor da região para todas estas UFs?</p>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => { setIsAlertOpen(false); setPendingPropagation(null); }}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmPropagation} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                        Sobrescrever Todas
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </main>
  );
}
