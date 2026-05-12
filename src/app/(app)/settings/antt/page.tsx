
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Save, Plus, Trash2, Info } from 'lucide-react';
import { authFetch } from '@/lib/api-client';
import type { AnttCoefficient } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AnttSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [coefficients, setCoefficients] = useState<AnttCoefficient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedType, setSelectedType] = useState('Geral');

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'admin') {
      router.push('/dashboard');
      return;
    }
    fetchCoefficients();
  }, [user, authLoading, router]);

  const fetchCoefficients = async () => {
    setIsLoading(true);
    try {
      const res = await authFetch('/api/settings/antt');
      if (res.ok) {
        setCoefficients(await res.json());
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao carregar coeficientes.' });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro de Rede', description: 'Não foi possível conectar ao servidor.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async (id: string, field: string, value: any) => {
    setCoefficients(prev => prev.map(c => (c.id === id || (c as any)._tempId === id) ? { ...c, [field]: value } : c));
  };

  const formatCurrency = (value: number, decimals: number = 2) => {
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value);
  };

  const handleCurrencyUpdate = (id: string, field: 'ccd' | 'cc', rawString: string) => {
    const digits = rawString.replace(/\D/g, '');
    if (!digits) {
        setCoefficients(prev => prev.map(c => (c.id === id || (c as any)._tempId === id) ? { ...c, [field]: 0 } : c));
        return;
    }
    
    // Ambos CCD e CC agora usam 2 casas decimais conforme solicitado
    const divisor = 100;
    let numericValue = Number(digits) / divisor;
    
    // Regra de arredondamento (2 casas decimais para ambos)
    numericValue = Math.ceil(numericValue * 100) / 100;
    
    setCoefficients(prev => prev.map(c => (c.id === id || (c as any)._tempId === id) ? { ...c, [field]: numericValue } : c));
  };

  const saveCoefficient = async (coeff: AnttCoefficient) => {
    setIsSaving(true);
    try {
      const isNew = !(coeff.id);
      const res = await authFetch('/api/settings/antt', {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(coeff),
      });
      if (res.ok) {
        toast({ title: 'Sucesso!', description: `Coeficiente para ${coeff.axles} eixos (${coeff.cargoType}) salvo.` });
        fetchCoefficients();
      } else {
        const err = await res.json();
        toast({ variant: 'destructive', title: 'Erro', description: err.message || 'Falha ao salvar.' });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro de Rede' });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteCoefficient = async (id: string) => {
    if (!confirm('Deseja realmente excluir este coeficiente?')) return;
    
    // Se for um item temporário (não salvo no banco), remove apenas do estado
    if (id.startsWith('temp_')) {
        setCoefficients(prev => prev.filter(c => (c as any)._tempId !== id));
        return;
    }

    try {
      const res = await authFetch(`/api/settings/antt?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'Removido', description: 'Coeficiente excluído com sucesso.' });
        fetchCoefficients();
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro ao excluir' });
    }
  };

  const addNewRow = () => {
    const newCoeff: any = {
        _tempId: `temp_${Date.now()}`,
        axles: 2,
        cargoType: selectedType,
        ccd: 0,
        cc: 0,
        updatedAt: new Date().toISOString()
    };
    setCoefficients(prev => [...prev, newCoeff]);
  };

  const cargoTypes = Array.from(new Set(coefficients.map(c => c.cargoType)));
  if (!cargoTypes.includes('Geral')) cargoTypes.unshift('Geral');

  const filteredCoefficients = coefficients
    .filter(c => c.cargoType === selectedType)
    .sort((a, b) => a.axles - b.axles);

  if (authLoading || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="container mx-auto p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/settings')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-primary">Tabela ANTT 2024</h1>
            <p className="text-muted-foreground text-sm">Resolução nº 6.046/2024 - Coeficientes CCD e CC</p>
          </div>
        </div>
        <Button onClick={addNewRow} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Eixo
        </Button>
      </div>

      <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-800 dark:text-blue-400">Piso Mínimo de Frete</AlertTitle>
        <AlertDescription className="text-blue-700 dark:text-blue-300 text-xs">
          Fórmula: <strong>Piso = (Distância × CCD) + CC</strong>. 
          CCD (Custo de Deslocamento) e CC (Custo de Carga e Descarga).
        </AlertDescription>
      </Alert>

      <div className="flex items-center gap-4 bg-muted/30 p-2 rounded-lg overflow-x-auto">
        <span className="text-sm font-medium px-2">Categoria:</span>
        {cargoTypes.map(type => (
            <Button 
                key={type}
                variant={selectedType === type ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedType(type)}
                className="whitespace-nowrap"
            >
                {type}
            </Button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle>Coeficientes - {selectedType}</CardTitle>
          <CardDescription>Gerencie os valores para a modalidade selecionada.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Eixos</TableHead>
                <TableHead>Custo Deslocamento (CCD)</TableHead>
                <TableHead>Custo Carga/Descarga (CC)</TableHead>
                <TableHead className="w-32 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCoefficients.length === 0 && (
                  <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          Nenhum coeficiente cadastrado para esta categoria.
                      </TableCell>
                  </TableRow>
              )}
              {filteredCoefficients.map((coeff) => {
                const id = coeff.id || (coeff as any)._tempId;
                return (
                  <TableRow key={id}>
                    <TableCell>
                      <Input 
                        type="number"
                        value={coeff.axles} 
                        onChange={(e) => handleUpdate(id, 'axles', parseInt(e.target.value))} 
                        className="h-8 w-16"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Input 
                          value={formatCurrency(coeff.ccd, 2)} 
                          onChange={(e) => handleCurrencyUpdate(id, 'ccd', e.target.value)} 
                          className="h-8 text-sm font-mono"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Input 
                          value={formatCurrency(coeff.cc, 2)} 
                          onChange={(e) => handleCurrencyUpdate(id, 'cc', e.target.value)} 
                          className="h-8 text-sm font-mono"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => saveCoefficient(coeff)} 
                        disabled={isSaving}
                        className="h-8 w-8 p-0 text-green-600"
                        title="Salvar"
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => deleteCoefficient(id)} 
                        className="h-8 w-8 p-0 text-destructive"
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <div className="flex justify-center">
          <Badge variant="secondary" className="px-4 py-1">
              Total de registros: {coefficients.length}
          </Badge>
      </div>
    </main>
  );
}
