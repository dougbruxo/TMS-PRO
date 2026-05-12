"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { PayrollSettings, PricingSettings } from '@/lib/types';
import { authFetch } from '@/lib/api-client';

export default function PayrollSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [pricingSettings, setPricingSettings] = useState<PricingSettings | null>(null);
  const [settings, setSettings] = useState<PayrollSettings>({
    advancePaymentDay: 20,
    finalPaymentDay: 5,
  });
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const fetchAllData = useCallback(async () => {
    setIsDataLoading(true);
    try {
        const res = await authFetch('/api/settings/pricing');
        if (!res.ok) throw new Error("Failed to fetch pricing settings");
        const data = await res.json();
        setPricingSettings(data);
        if (data?.payroll) {
            setSettings(data.payroll);
        }
    } catch(e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
        setIsDataLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
    if (authLoading) return;
    if (!user || !user.settingsAccess || !user.talentsAccess) {
      router.push('/dashboard');
      return;
    }
    fetchAllData();
  }, [user, authLoading, router, fetchAllData]);
  

  const handleSave = async () => {
    setIsSaving(true);
    try {
        const response = await authFetch('/api/settings/pricing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payroll: settings }),
        });
        if (response.ok) {
            toast({ title: 'Sucesso!', description: 'Configurações da folha de pagamento salvas.' });
            await fetchAllData();
        } else {
            throw new Error('Não foi possível salvar as configurações.');
        }
    } catch(e: any) {
        toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
        setIsSaving(false);
    }
  };


  if (authLoading || isDataLoading || !user) {
    return (
        <div className="flex h-full items-center justify-center">
             <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
      <main className="container mx-auto p-4 md:p-8">
        <Button variant="outline" onClick={() => router.push('/hr')} className="mb-8">
            &larr; Voltar para Recursos Humanos
        </Button>

        <Card className="max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle>Configurações da Folha de Pagamento</CardTitle>
                <CardDescription>Defina os dias padrão para o pagamento de adiantamentos e salários.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="advanceDay">Dia do Adiantamento</Label>
                    <Input 
                        id="advanceDay"
                        type="number"
                        min="1"
                        max="31"
                        value={settings.advancePaymentDay}
                        onChange={(e) => setSettings(s => ({ ...s, advancePaymentDay: parseInt(e.target.value) || 1 }))}
                    />
                    <p className="text-sm text-muted-foreground">O dia do mês para o pagamento do adiantamento quinzenal.</p>
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="finalDay">Dia do Pagamento Final</Label>
                    <Input 
                        id="finalDay"
                        type="number"
                        min="1"
                        max="31"
                        value={settings.finalPaymentDay}
                        onChange={(e) => setSettings(s => ({ ...s, finalPaymentDay: parseInt(e.target.value) || 1 }))}
                    />
                    <p className="text-sm text-muted-foreground">O dia do mês para o pagamento do salário final.</p>
                </div>
            </CardContent>
            <CardFooter>
                 <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                    Salvar Configurações
                </Button>
            </CardFooter>
        </Card>
      </main>
  );
}
