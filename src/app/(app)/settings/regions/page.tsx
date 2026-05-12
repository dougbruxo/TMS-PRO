
"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PricingSettings } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { SurchargeTable } from '@/components/pricing/SurchargeTable';
import { RegionManager } from '@/components/pricing/RegionManager';
import { authFetch } from '@/lib/api-client';

export default function ManageRegionsPage() {
  const { user, loading: authLoading, refreshPricingSettings } = useAuth();
  const [pricingSettings, setPricingSettings] = useState<PricingSettings | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  const [localRegions, setLocalRegions] = useState<PricingSettings['regions'] | null>(null);
  const [localSurcharges, setLocalSurcharges] = useState<PricingSettings['surcharges'] | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchPricingSettings = useCallback(async () => {
    setIsDataLoading(true);
    try {
      const response = await authFetch('/api/settings/pricing');
      if (!response.ok) throw new Error("Failed to fetch pricing settings");
      const data: PricingSettings = await response.json();
      setPricingSettings(data);
      setLocalRegions(data.regions);
      setLocalSurcharges(data.surcharges);
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
  
  // This effect synchronizes the surcharges state when regions are added or removed.
  useEffect(() => {
    if (localRegions && localSurcharges) {
      const regionKeys = Object.keys(localRegions);
      
      let updated = false;
      const newSurcharges = JSON.parse(JSON.stringify(localSurcharges));

      // Add new regions with default values
      regionKeys.forEach(regionKey => {
        if (!newSurcharges.dezlog.hasOwnProperty(regionKey)) {
          newSurcharges.dezlog[regionKey] = 0; // default value
          updated = true;
        }
        if (!newSurcharges.fracionado.hasOwnProperty(regionKey)) {
          newSurcharges.fracionado[regionKey] = { regional: 0, cubageMultiplier: 1.5 }; // default values
          updated = true;
        }
      });

      // Remove deleted regions
      Object.keys(newSurcharges.dezlog).forEach(key => {
        if (!regionKeys.includes(key)) {
          delete newSurcharges.dezlog[key];
          updated = true;
        }
      });
      Object.keys(newSurcharges.fracionado).forEach(key => {
        if (!regionKeys.includes(key)) {
          delete newSurcharges.fracionado[key];
          updated = true;
        }
      });

      if (updated) {
        setLocalSurcharges(newSurcharges);
      }
    }
  }, [localRegions, localSurcharges]);

  const handleSave = async () => {
    if (!localRegions || !localSurcharges) return;
    setIsSaving(true);
    try {
        const settingsToSave: Partial<PricingSettings> = {
            regions: localRegions,
            surcharges: localSurcharges,
        };
        const response = await authFetch('/api/settings/pricing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settingsToSave),
        });
        if (!response.ok) throw new Error("Failed to update settings");
        toast({ title: "Sucesso!", description: "Configurações de regiões e taxas atualizadas." });
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

  const handleSurchargeChange = (mode: 'dezlog' | 'fracionado', region: string, type: 'regional' | 'cubageMultiplier', value: number) => {
    setLocalSurcharges(prev => {
        if (!prev) return null;
        const newSurcharges = JSON.parse(JSON.stringify(prev));
        if (mode === 'dezlog') {
            newSurcharges.dezlog[region] = value / 100;
        } else {
            if (type === 'regional') {
                newSurcharges.fracionado[region].regional = value / 100;
            } else {
                newSurcharges.fracionado[region].cubageMultiplier = value;
            }
        }
        return newSurcharges;
    });
  };

  if (authLoading || isDataLoading || !user || !localRegions || !localSurcharges) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
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
              <h1 className="text-3xl font-bold text-primary mb-2">Gerenciar Regiões e Taxas</h1>
              <p className="text-muted-foreground max-w-2xl">
                Organize os estados em regiões e defina as taxas de acréscimo para cada uma.
              </p>
           </div>
           <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>}
                Salvar Alterações
            </Button>
        </div>

        <div className="space-y-8">
            <RegionManager regions={localRegions} onRegionsChange={setLocalRegions} />
            <SurchargeTable surcharges={localSurcharges} onRateChange={handleSurchargeChange} />
        </div>
      </main>
  );
}
