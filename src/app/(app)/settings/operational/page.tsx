
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Percent } from 'lucide-react';
import type { PricingSettings } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/api-client';

export default function OperationalSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [settings, setSettings] = useState<PricingSettings['operational'] | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    setIsDataLoading(true);
    try {
      const response = await authFetch('/api/settings/pricing');
      if (!response.ok) throw new Error("Failed to fetch settings");
      const data: PricingSettings = await response.json();
      setSettings(data.operational);
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

  const handleSettingChange = (key: keyof PricingSettings['operational'], value: string) => {
    const numericValue = parseFloat(value);
    if (!isNaN(numericValue)) {
      setSettings(prev => {
        if (!prev) return null;
        return {
          ...prev,
          [key]: numericValue / 100 // Store as decimal
        }
      });
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setIsSaving(true);
    try {
        const response = await authFetch('/api/settings/pricing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operational: settings }),
        });
        if (!response.ok) throw new Error("Failed to update settings");
        toast({ title: "Sucesso!", description: "Configurações operacionais atualizadas." });
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
                <CardTitle>Configurações Operacionais</CardTitle>
                <CardDescription>Defina taxas usadas em cálculos de lucro e outros.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="profitTaxRate">Taxa de Lucro sobre o Frete (%)</Label>
                    <div className="relative">
                        <Input
                            id="profitTaxRate"
                            type="number"
                            value={(settings?.profitTaxRate || 0) * 100}
                            onChange={(e) => handleSettingChange('profitTaxRate', e.target.value)}
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
                            value={(settings?.grisAdvaloremRate || 0) * 100}
                            onChange={(e) => handleSettingChange('grisAdvaloremRate', e.target.value)}
                            className="pl-8"
                        />
                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground">Taxa aplicada sobre o valor do produto para seguro da carga.</p>
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
