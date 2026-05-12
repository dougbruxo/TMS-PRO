
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
import type { Vehicle } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { authFetch } from '@/lib/api-client';

export default function DedicatedDifficultyTaxPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [tempFees, setTempFees] = useState<Record<string, number>>({});
  const [maskedFees, setMaskedFees] = useState<Record<string, string>>({}); // State for masked values

  const formatCurrency = (value: number) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await authFetch('/api/vehicles');
      if (!res.ok) throw new Error('Falha ao buscar veículos.');
      const data: Vehicle[] = await res.json();
      setVehicles(data);
      
      const initialFees: Record<string, number> = {};
      const initialMaskedFees: Record<string, string> = {};
      data.forEach(v => {
        const fee = v.taxaDificuldade || 0;
        initialFees[v.id] = fee;
        initialMaskedFees[v.id] = formatCurrency(fee);
      });
      setTempFees(initialFees);
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

  const handleCurrencyChange = (e: ChangeEvent<HTMLInputElement>, vehicleId: string) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    if (!rawValue) {
        setTempFees(prev => ({...prev, [vehicleId]: 0}));
        setMaskedFees(prev => ({...prev, [vehicleId]: formatCurrency(0)}));
        return;
    }
    const numericValue = Number(rawValue) / 100;
    
    setTempFees(prev => ({...prev, [vehicleId]: numericValue}));
    setMaskedFees(prev => ({...prev, [vehicleId]: formatCurrency(numericValue)}));
  };
  
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const promises = vehicles.map(vehicle => {
        const originalFee = vehicle.taxaDificuldade || 0;
        const newFee = tempFees[vehicle.id];
        // Only update if the value has changed
        if (originalFee !== newFee) {
          return authFetch(`/api/vehicles/${vehicle.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taxaDificuldade: newFee }),
          });
        }
        return Promise.resolve(null);
      }).filter(Boolean);
      
      if (promises.length > 0) {
        const results = await Promise.all(promises);
        const failed = results.some(res => res && !res.ok);
        
        if(failed) {
          throw new Error('Uma ou mais atualizações falharam.');
        }
        
        toast({ title: 'Sucesso!', description: 'Taxas de dificuldade atualizadas.' });
        await fetchData(); // re-fetch to sync state
      } else {
        toast({ title: 'Nenhuma alteração', description: 'Nenhum valor foi modificado.' });
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
              <CardTitle>Taxa de Dificuldade para Frete Dedicado</CardTitle>
              <CardDescription>Defina o valor fixo (R$) da taxa de dificuldade a ser adicionado para cada tipo de veículo.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Veículo</TableHead>
                  <TableHead className="text-right">Valor da Taxa (R$)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-32 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  vehicles.map(vehicle => (
                    <TableRow key={vehicle.id}>
                      <TableCell className="font-medium">{vehicle.displayName}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          className="w-32 ml-auto text-right"
                          value={maskedFees[vehicle.id] || ''}
                          onChange={e => handleCurrencyChange(e, vehicle.id)}
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
