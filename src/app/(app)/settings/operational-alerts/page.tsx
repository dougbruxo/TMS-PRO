
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, AlertTriangle } from 'lucide-react';
import type { PricingSettings, OperationalAlertsSettings } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { initialPricingSettings } from '@/lib/data';
import { authFetch } from '@/lib/api-client';

export default function OperationalAlertsSettingsPage() {
  const { user, loading: authLoading, refreshPricingSettings, refreshNotificationCounts } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [settings, setSettings] = useState<OperationalAlertsSettings>(initialPricingSettings.alerts);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    setIsDataLoading(true);
    try {
      const response = await authFetch('/api/settings/pricing');
      if (!response.ok) throw new Error("Falha ao carregar as configurações.");
      const data: PricingSettings = await response.json();
      if (data.alerts) {
        setSettings(data.alerts);
      }
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
    fetchSettings();
  }, [user, authLoading, router, fetchSettings]);

  const handleSettingChange = (key: keyof OperationalAlertsSettings, value: string) => {
    const numericValue = parseInt(value, 10);
    if (!isNaN(numericValue)) {
      setSettings(prev => ({
        ...prev,
        [key]: numericValue
      }));
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setIsSaving(true);
    try {
        const response = await authFetch('/api/settings/pricing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ alerts: settings }),
        });
        if (!response.ok) throw new Error("Falha ao atualizar as configurações.");
        if (refreshPricingSettings) {
            await refreshPricingSettings();
        }
        if (refreshNotificationCounts) {
            await refreshNotificationCounts();
        }
        toast({ title: "Sucesso!", description: "Configurações de alerta atualizadas." });
        await fetchSettings();
    } catch (error: any) {
        toast({ variant: 'destructive', title: "Erro", description: "Não foi possível salvar as alterações." });
    } finally {
        setIsSaving(false);
    }
  };
  
  if (isDataLoading || authLoading || !user) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="container mx-auto p-4 md:p-8">
        <Button variant="outline" onClick={() => router.push('/settings')} className="mb-8">
          &larr; Voltar para Configurações
        </Button>
        <Card className="max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle>Gatilhos e Alertas</CardTitle>
                <CardDescription>Defina os prazos e gatilhos para alertas importantes na operação e no financeiro.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2 p-4 border rounded-lg">
                    <h3 className="font-semibold text-lg flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-yellow-500" /> Alertas Operacionais</h3>
                    <div className="space-y-2">
                        <Label htmlFor="collectionDeadlineDays">Prazo de Coleta (dias)</Label>
                        <Input
                            id="collectionDeadlineDays"
                            type="number"
                            value={settings.collectionDeadlineDays}
                            onChange={(e) => handleSettingChange('collectionDeadlineDays', e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">Quantos dias a equipe tem para coletar uma carga após a cotação ser 'Fechada'.</p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="collectionAlertTriggerDays">Gatilho do Alerta de Coleta (dias após prazo)</Label>
                        <Input
                            id="collectionAlertTriggerDays"
                            type="number"
                            value={settings.collectionAlertTriggerDays}
                            onChange={(e) => handleSettingChange('collectionAlertTriggerDays', e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">Após quantos dias do vencimento do prazo de coleta o alerta deve ser exibido.</p>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="deliveryAlertTriggerDays">Gatilho do Alerta de Entrega (dias)</Label>
                        <Input
                            id="deliveryAlertTriggerDays"
                            type="number"
                            value={settings.deliveryAlertTriggerDays}
                            onChange={(e) => handleSettingChange('deliveryAlertTriggerDays', e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">Com quantos dias de antecedência o alerta deve aparecer. Use um número negativo para alertar X dias *após* o vencimento.</p>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="warehouseStagnationDays">Prazo de Estadia no Galpão (dias)</Label>
                        <Input
                            id="warehouseStagnationDays"
                            type="number"
                            value={settings.warehouseStagnationDays}
                            onChange={(e) => handleSettingChange('warehouseStagnationDays', e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">Após quantos dias no status "No Galpão" um alerta deve ser gerado.</p>
                    </div>
                </div>

                <div className="space-y-2 p-4 border rounded-lg">
                     <h3 className="font-semibold text-lg flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-green-500" /> Alertas Financeiros</h3>
                     <div className="space-y-2">
                        <Label htmlFor="expenseDueTriggerDays">Gatilho do Alerta de Despesas (dias)</Label>
                        <Input
                            id="expenseDueTriggerDays"
                            type="number"
                            value={settings.expenseDueTriggerDays}
                            onChange={(e) => handleSettingChange('expenseDueTriggerDays', e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">Com quantos dias de antecedência o sistema deve alertar sobre uma despesa a vencer.</p>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="billingDueTriggerDays">Gatilho do Alerta de Cobranças (dias)</Label>
                        <Input
                            id="billingDueTriggerDays"
                            type="number"
                            value={settings.billingDueTriggerDays}
                            onChange={(e) => handleSettingChange('billingDueTriggerDays', e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">Com quantos dias de antecedência o sistema deve alertar sobre uma cobrança de cliente a vencer.</p>
                    </div>
                </div>
            </CardContent>
             <CardFooter>
                 <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                    Salvar Alterações
                </Button>
            </CardFooter>
        </Card>
    </main>
  )
}

    