
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Map, Save, Percent, Truck, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IcmsTable } from '@/components/pricing/IcmsTable';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PricingSettings } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SurchargeTable } from '@/components/pricing/SurchargeTable';
import { authFetch } from '@/lib/api-client';

export default function ManagePricingPage() {
  const { user, loading: authLoading, refreshPricingSettings } = useAuth();
  const [pricingSettings, setPricingSettings] = useState<PricingSettings | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  const [localSettings, setLocalSettings] = useState<PricingSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const fetchPricingSettings = useCallback(async () => {
    setIsDataLoading(true);
    try {
      const response = await authFetch('/api/settings/pricing');
      if (!response.ok) throw new Error("Failed to fetch pricing settings");
      const data = await response.json();
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
    if (!user || !user.settingsAccess) {
      router.push('/dashboard');
      return;
    }
    fetchPricingSettings();
  }, [user, authLoading, router, fetchPricingSettings]);
  
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
        toast({ title: "Sucesso!", description: "Configurações de preço atualizadas." });
        await fetchPricingSettings(); // Re-fetch to confirm
        if (refreshPricingSettings) {
           await refreshPricingSettings();
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: "Erro", description: "Não foi possível salvar as alterações." });
    } finally {
        setIsSaving(false);
    }
  };
  
  const handleResetDefaults = async () => {
    setIsResetting(true);
    try {
      const response = await authFetch('/api/settings/pricing/reset', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Falha ao restaurar as configurações padrão.');
      }
      toast({ title: 'Sucesso!', description: 'As configurações de precificação foram restauradas para o padrão. A página será recarregada.' });
      
      // Recarrega a página para buscar os novos dados semeados
      window.location.reload();

    } catch (e: any) {
       toast({ variant: 'destructive', title: "Erro", description: e.message });
    } finally {
      setIsResetting(false);
    }
  };

  const handleRateChange = (origin: string, dest: string, value: string) => {
    setLocalSettings(prev => {
        if (!prev) return null;
        const newRates = { ...prev.icmsRates };
        if (!newRates[origin]) {
            newRates[origin] = {};
        }
        newRates[origin][dest] = parseFloat(value) || 0;
        return { ...prev, icmsRates: newRates };
    });
  };
  
  const handleSurchargeChange = (mode: 'dezlog' | 'fracionado', region: string, type: 'regional' | 'cubageMultiplier', value: number) => {
    setLocalSettings(prev => {
        if (!prev) return null;
        const newSurcharges = JSON.parse(JSON.stringify(prev.surcharges));
        if (mode === 'dezlog') {
            newSurcharges.dezlog[region] = value / 100;
        } else {
            if (type === 'regional') {
                newSurcharges.fracionado[region].regional = value / 100;
            } else {
                newSurcharges.fracionado[region].cubageMultiplier = value;
            }
        }
        return { ...prev, surcharges: newSurcharges };
    });
  };

  const handleOperationalSettingChange = (key: keyof PricingSettings['operational'], value: string) => {
      setLocalSettings(prev => {
          if(!prev) return null;
          return {
              ...prev,
              operational: {
                  ...prev.operational,
                  [key]: parseFloat(value) / 100 // Convert percentage to decimal
              }
          }
      })
  }



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
              <Button variant="outline" onClick={() => router.push('/settings')} className="mb-4">
                &larr; Voltar para Configurações
              </Button>
              <h1 className="text-3xl font-bold text-primary mb-2">Regras de Precificação e Regiões</h1>
              <p className="text-muted-foreground max-w-2xl">
                Ajuste as taxas, impostos e acréscimos regionais que afetam o cálculo do frete.
              </p>
           </div>
           <div className="flex gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" disabled={isResetting}>
                      <RefreshCw className="mr-2 h-4 w-4"/> Restaurar Padrões
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Restaurar Configurações Padrão?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação irá apagar todas as configurações de precificação e regiões, restaurando-as para os valores padrão do sistema. 
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleResetDefaults} disabled={isResetting}>
                        {isResetting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Confirmar e Restaurar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>}
                    Salvar Todas as Alterações
                </Button>
           </div>
        </div>

        <Tabs defaultValue="icms" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="icms">Tabela de ICMS</TabsTrigger>
                <TabsTrigger value="surcharges">Taxas de Acréscimo</TabsTrigger>
                <TabsTrigger value="operational">Taxas Operacionais</TabsTrigger>
            </TabsList>
            <TabsContent value="icms">
                <IcmsTable 
                    icmsRates={localSettings.icmsRates} 
                    regions={localSettings.regions} 
                    onRateChange={handleRateChange} 
                />
            </TabsContent>
            <TabsContent value="surcharges">
                <SurchargeTable surcharges={localSettings.surcharges} onRateChange={handleSurchargeChange} />
            </TabsContent>
            <TabsContent value="operational">
                <Card>
                    <CardHeader>
                        <CardTitle>Configurações Operacionais</CardTitle>
                        <CardDescription>Defina taxas usadas em cálculos de lucro e outros.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 max-w-sm">
                        <div className="space-y-2">
                            <Label htmlFor="profitTaxRate">Taxa de Lucro sobre o Frete (%)</Label>
                            <div className="relative">
                                <Input
                                    id="profitTaxRate"
                                    type="number"
                                    value={(localSettings.operational?.profitTaxRate || 0) * 100}
                                    onChange={(e) => handleOperationalSettingChange('profitTaxRate', e.target.value)}
                                    className="pl-8"
                                />
                                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            </div>
                            <p className="text-xs text-muted-foreground">Esta taxa é aplicada sobre o valor do frete para calcular a margem de lucro.</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="grisAdvaloremRate">GRIS/Advalorem (%)</Label>
                            <div className="relative">
                                <Input
                                    id="grisAdvaloremRate"
                                    type="number"
                                    value={(localSettings.operational?.grisAdvaloremRate || 0) * 100}
                                    onChange={(e) => handleOperationalSettingChange('grisAdvaloremRate', e.target.value)}
                                    className="pl-8"
                                />
                                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            </div>
                            <p className="text-xs text-muted-foreground">Taxa aplicada sobre o valor do produto para seguro da carga.</p>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

        </Tabs>
      </main>
  );
}
