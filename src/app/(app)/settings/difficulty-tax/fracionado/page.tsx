
"use client";

import { useEffect, useState, useCallback, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { PricingSettings } from '@/lib/types';
import { initialPricingSettings } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';
import { authFetch } from '@/lib/api-client';

export default function FracionadoDifficultyTaxPage() {
  const { user, loading: authLoading, refreshPricingSettings } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [settings, setSettings] = useState<PricingSettings['difficultyFees']>(initialPricingSettings.difficultyFees);
  const [regions, setRegions] = useState<PricingSettings['regions'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // New state for masked currency values
  const [maskedFees, setMaskedFees] = useState<Record<string, string>>({});

  const formatCurrency = (value: number) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await authFetch('/api/settings/pricing');
      if (!res.ok) throw new Error('Falha ao buscar configurações.');
      const data: PricingSettings = await res.json();
      setRegions(data.regions);
      
      let currentFees = initialPricingSettings.difficultyFees;
      if (data.difficultyFees && data.difficultyFees.fracionado) {
        currentFees = data.difficultyFees;
      }
      
      const regionKeys = Object.keys(data.regions || {});
      const initialMaskedFees: Record<string, string> = {};
      
      // Ensure all regions have a value
      regionKeys.forEach(key => {
        if (!currentFees.fracionado[key]) {
          currentFees.fracionado[key] = 0;
        }
        initialMaskedFees[key] = formatCurrency(currentFees.fracionado[key]);
      });

      setSettings(currentFees);
      setMaskedFees(initialMaskedFees);

    } catch(e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
    if (!authLoading && user?.settingsAccess) {
      fetchData();
    }
  }, [user, authLoading, fetchData]);

  const handleCurrencyChange = (e: ChangeEvent<HTMLInputElement>, region: string) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    if (!rawValue) {
        setSettings(prev => {
          if (!prev) return { fracionado: {} };
          const newFracionado = { ...prev.fracionado, [region]: 0 };
          return { ...prev, fracionado: newFracionado };
        });
        setMaskedFees(prev => ({...prev, [region]: formatCurrency(0)}));
        return;
    }
    const numericValue = Number(rawValue) / 100;
    
    setSettings(prev => {
        if (!prev) return { fracionado: {} };
        const newFracionado = { ...prev.fracionado, [region]: numericValue };
        return { ...prev, fracionado: newFracionado };
    });
    setMaskedFees(prev => ({...prev, [region]: formatCurrency(numericValue)}));
  };
  
  const handleSave = async () => {
    setIsSaving(true);
    try {
        const response = await authFetch('/api/settings/pricing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ difficultyFees: settings }),
        });
        if (!response.ok) throw new Error("Falha ao salvar as taxas.");
        toast({ title: 'Sucesso!', description: 'Taxas de dificuldade atualizadas.' });
        await fetchData();
        if (refreshPricingSettings) {
            await refreshPricingSettings();
        }
    } catch(e: any) {
        toast({ variant: 'destructive', title: 'Erro ao Salvar', description: e.message });
    } finally {
        setIsSaving(false);
    }
  };

  if (authLoading || isLoading || !user) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <Button variant="outline" onClick={() => router.push('/settings/difficulty-tax')}>
          &larr; Voltar para Taxa de Dificuldade
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
          Salvar Alterações
        </Button>
      </div>
       <Card>
          <CardHeader>
              <CardTitle>Taxa de Dificuldade para Frete Fracionado</CardTitle>
              <CardDescription>Defina o valor fixo (R$) da taxa de dificuldade a ser adicionado para cada região de destino.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Região</TableHead>
                  <TableHead className="text-right">Valor da Taxa (R$)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({length: 5}).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-32 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  regions && Object.keys(regions).sort().map(region => (
                    <TableRow key={region}>
                      <TableCell className="font-medium">{region}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          className="w-32 ml-auto text-right"
                          value={maskedFees[region] || ''}
                          onChange={e => handleCurrencyChange(e, region)}
                          placeholder="R$ 0,00"
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
      </Card>
    </main>
  );
}
