
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { LabelPrintingSettings, PricingSettings } from '@/lib/types';
import { initialPricingSettings } from '@/lib/data';
import { authFetch } from '@/lib/api-client';

export default function LabelSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [settings, setSettings] = useState<LabelPrintingSettings>(initialPricingSettings.printing.labels);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    setIsDataLoading(true);
    try {
      const response = await authFetch('/api/settings/pricing');
      if (!response.ok) throw new Error("Falha ao carregar as configurações.");
      const data: PricingSettings = await response.json();
      if (data.printing && data.printing.labels) {
        setSettings(data.printing.labels);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message });
    } finally {
      setIsDataLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!authLoading && user?.settingsAccess) {
      fetchSettings();
    }
  }, [user, authLoading, fetchSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
        const response = await authFetch('/api/settings/pricing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ printing: { labels: settings } }),
        });
        if (!response.ok) throw new Error("Falha ao atualizar as configurações.");
        toast({ title: "Sucesso!", description: "Configurações de etiqueta salvas." });
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
      <Button variant="outline" onClick={() => router.push('/settings/printing')} className="mb-8">
        &larr; Voltar para Ajustes de Impressão
      </Button>
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Configurações de Impressão de Etiquetas</CardTitle>
          <CardDescription>Personalize a aparência das etiquetas de volume.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-4">
            <Label>Intensidade da Cor</Label>
            <RadioGroup
              value={settings.colorLevel}
              onValueChange={(value: 'light' | 'normal' | 'dark') => setSettings(s => ({ ...s, colorLevel: value }))}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="light" id="color-light" />
                <Label htmlFor="color-light" className="font-normal">Claro (Economia)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="normal" id="color-normal" />
                <Label htmlFor="color-normal" className="font-normal">Normal</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dark" id="color-dark" />
                <Label htmlFor="color-dark" className="font-normal">Escuro (Realce)</Label>
              </div>
            </RadioGroup>
          </div>
          <div className="space-y-4">
            <Label>Tamanho da Fonte</Label>
            <RadioGroup
              value={settings.fontSize}
              onValueChange={(value: 'small' | 'medium' | 'large') => setSettings(s => ({ ...s, fontSize: value }))}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="small" id="font-small" />
                <Label htmlFor="font-small" className="font-normal">Pequeno</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="medium" id="font-medium" />
                <Label htmlFor="font-medium" className="font-normal">Médio</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="large" id="font-large" />
                <Label htmlFor="font-large" className="font-normal">Grande</Label>
              </div>
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label htmlFor="qr-code-url">URL do QR Code</Label>
            <Input
              id="qr-code-url"
              value={settings.qrCodeUrl}
              onChange={(e) => setSettings(s => ({ ...s, qrCodeUrl: e.target.value }))}
              placeholder="https://seu-site.com"
            />
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
