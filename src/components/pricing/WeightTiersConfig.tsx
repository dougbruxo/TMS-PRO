"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Weight, Plus, Trash2, Info } from 'lucide-react';
import type { PricingSettings, WeightTier } from '@/lib/types';
import { ALL_UFS } from '@/lib/ufs';

interface WeightTiersConfigProps {
    settings: PricingSettings;
    setSettings: React.Dispatch<React.SetStateAction<PricingSettings | null>>;
}

export function WeightTiersConfig({ settings, setSettings }: WeightTiersConfigProps) {
    const mode = settings.weightTiersMode || 'global';

    const handleModeChange = (newMode: 'global' | 'region' | 'route') => {
        setSettings(prev => prev ? { ...prev, weightTiersMode: newMode } : null);
    };

    return (
        <Card className="border-primary/20">
            <CardHeader className="bg-primary/5 border-b">
                <div className="flex items-center gap-2">
                    <Weight className="h-5 w-5 text-primary" />
                    <div>
                        <CardTitle>Faixas de Peso e Multiplicadores</CardTitle>
                        <CardDescription>
                            Configure fatores que multiplicam a taxa Kg Cubado da rota baseada no peso taxável.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
                
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-lg p-4 text-sm text-blue-800 dark:text-blue-300">
                    <p className="font-medium mb-1">Como funciona o cálculo (Cascata):</p>
                    <p className="mb-2">Se a cotação não encontrar faixa na Rota, tenta achar na Região, e se não achar, usa a Global. Fator 1.00 mantém a taxa original.</p>
                </div>

                <div className="space-y-3">
                    <Label className="text-base font-bold">Modo de Aplicação Ativo</Label>
                    <RadioGroup 
                        value={mode} 
                        onValueChange={(val) => handleModeChange(val as 'global' | 'region' | 'route')}
                        className="flex flex-col md:flex-row gap-4"
                    >
                        <div className="flex items-center space-x-2 border p-3 rounded-lg flex-1 cursor-pointer hover:bg-muted/50" onClick={() => handleModeChange('global')}>
                            <RadioGroupItem value="global" id="r-global" />
                            <Label htmlFor="r-global" className="cursor-pointer font-medium cursor-pointer">Global</Label>
                            <span className="text-xs text-muted-foreground ml-auto">Única para todos</span>
                        </div>
                        <div className="flex items-center space-x-2 border p-3 rounded-lg flex-1 cursor-pointer hover:bg-muted/50" onClick={() => handleModeChange('region')}>
                            <RadioGroupItem value="region" id="r-region" />
                            <Label htmlFor="r-region" className="cursor-pointer font-medium cursor-pointer">Por Região</Label>
                            <span className="text-xs text-muted-foreground ml-auto">Macro-regiões</span>
                        </div>
                        <div className="flex items-center space-x-2 border p-3 rounded-lg flex-1 cursor-pointer hover:bg-muted/50" onClick={() => handleModeChange('route')}>
                            <RadioGroupItem value="route" id="r-route" />
                            <Label htmlFor="r-route" className="cursor-pointer font-medium cursor-pointer">Por UF</Label>
                            <span className="text-xs text-muted-foreground ml-auto">Ajuste fino (UFxUF)</span>
                        </div>
                    </RadioGroup>
                </div>

                <div className="pt-4 border-t">
                    {mode === 'global' && <GlobalTiers settings={settings} setSettings={setSettings} />}
                    {mode === 'region' && <RegionTiers settings={settings} setSettings={setSettings} />}
                    {mode === 'route' && <RouteTiers settings={settings} setSettings={setSettings} />}
                </div>

            </CardContent>
        </Card>
    );
}

// ------------------------------
// GLOBAL TIERS
// ------------------------------
function GlobalTiers({ settings, setSettings }: WeightTiersConfigProps) {
    const tiers = settings.weightTiers || [];

    const handleTiersChange = (newTiers: WeightTier[]) => {
        setSettings(prev => prev ? { ...prev, weightTiers: newTiers } : null);
    };

    return (
        <div className="space-y-4">
            <h3 className="font-bold text-lg">Faixas Globais</h3>
            <p className="text-sm text-muted-foreground">Estas faixas se aplicam a todas as cotações, a menos que haja faixas específicas (por Região ou UF).</p>
            <WeightTierTable tiers={tiers} onChange={handleTiersChange} />
        </div>
    );
}

// ------------------------------
// REGION TIERS
// ------------------------------
function RegionTiers({ settings, setSettings }: WeightTiersConfigProps) {
    const { regions } = settings;
    const regionNames = useMemo(() => Object.keys(regions || {}).sort(), [regions]);
    
    const [selectedOrigin, setSelectedOrigin] = useState<string>(regionNames[0] || '');
    const [selectedDest, setSelectedDest] = useState<string>(regionNames[0] || '');

    const tiers = settings.regionWeightTiers?.[selectedOrigin]?.[selectedDest] || [];

    const handleTiersChange = (newTiers: WeightTier[]) => {
        setSettings(prev => {
            if (!prev) return null;
            const updatedRegionTiers = { ...(prev.regionWeightTiers || {}) };
            if (!updatedRegionTiers[selectedOrigin]) updatedRegionTiers[selectedOrigin] = {};
            updatedRegionTiers[selectedOrigin][selectedDest] = newTiers;
            return { ...prev, regionWeightTiers: updatedRegionTiers };
        });
    };

    if (regionNames.length === 0) return <div>Nenhuma região configurada.</div>;

    return (
        <div className="space-y-4">
             <div className="flex flex-col md:flex-row gap-6">
                {/* Seletor Lateral */}
                <div className="w-full md:w-[150px] shrink-0 border rounded-lg p-2 bg-muted/10 h-[400px] flex flex-col">
                    <h3 className="font-bold text-xs uppercase text-muted-foreground text-center mb-2 pb-2 border-b">Origem (Região)</h3>
                    <ScrollArea className="flex-1">
                        <div className="flex flex-col gap-1 pr-3">
                            {regionNames.map(region => (
                                <button
                                    key={region}
                                    onClick={() => setSelectedOrigin(region)}
                                    className={`py-2 px-2 text-center text-xs font-bold rounded-md transition-all ${selectedOrigin === region ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-accent'}`}
                                >
                                    {region}
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
                
                {/* Destinos */}
                <div className="flex-1 space-y-4">
                    <div className="bg-muted p-2 rounded-lg flex overflow-x-auto gap-2 items-center">
                        <span className="text-xs font-bold uppercase text-muted-foreground shrink-0 ml-2">Destino:</span>
                        {regionNames.map(region => (
                             <button
                                key={region}
                                onClick={() => setSelectedDest(region)}
                                className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all whitespace-nowrap ${selectedDest === region ? 'bg-background shadow-sm border border-border text-foreground' : 'text-muted-foreground hover:bg-background/50'}`}
                            >
                                {region}
                            </button>
                        ))}
                    </div>

                    <div className="pt-2">
                        <h3 className="font-bold text-sm mb-4">
                            Faixas para <Badge variant="outline">{selectedOrigin}</Badge> → <Badge variant="outline">{selectedDest}</Badge>
                        </h3>
                        {tiers.length === 0 && (
                            <div className="bg-yellow-50 text-yellow-800 text-xs p-3 rounded-lg border border-yellow-200 mb-4 flex gap-2">
                                <Info className="h-4 w-4 shrink-0" />
                                <p>Sem faixas específicas. O sistema usará as faixas Globais para esta rota.</p>
                            </div>
                        )}
                        <WeightTierTable tiers={tiers} onChange={handleTiersChange} />
                    </div>
                </div>
             </div>
        </div>
    );
}

// ------------------------------
// ROUTE TIERS (UF x UF)
// ------------------------------
function RouteTiers({ settings, setSettings }: WeightTiersConfigProps) {
    const { regions } = settings;
    
    // Agrupar UFs por região para a listagem
    const ufsByRegion = useMemo(() => {
        const sorted: Record<string, string[]> = {};
        for (const region in regions) {
            sorted[region] = [...(regions[region] || [])].sort();
        }
        return sorted;
    }, [regions]);
    const originRegions = Object.keys(regions || {}).sort();

    const [selectedOrigin, setSelectedOrigin] = useState<string>('SP');
    const [selectedDest, setSelectedDest] = useState<string>('SP');

    const tiers = settings.routeWeightTiers?.[selectedOrigin]?.[selectedDest] || [];

    const handleTiersChange = (newTiers: WeightTier[]) => {
        setSettings(prev => {
            if (!prev) return null;
            const updatedRouteTiers = { ...(prev.routeWeightTiers || {}) };
            if (!updatedRouteTiers[selectedOrigin]) updatedRouteTiers[selectedOrigin] = {};
            updatedRouteTiers[selectedOrigin][selectedDest] = newTiers;
            return { ...prev, routeWeightTiers: updatedRouteTiers };
        });
    };

    return (
        <div className="space-y-4">
             <div className="flex flex-col md:flex-row gap-6">
                {/* Seletor Lateral UFs por Região */}
                <div className="w-full md:w-[130px] shrink-0">
                  <h3 className="font-bold mb-2 text-[10px] uppercase text-muted-foreground tracking-tighter text-center">Origem (UF)</h3>
                  <ScrollArea className="h-[400px] border rounded-lg bg-muted/5 shadow-inner">
                    <div className="p-1.5 flex flex-col gap-1">
                      {originRegions.map(region => (
                        <div key={region} className="mb-2">
                          <h4 className="font-black text-[9px] text-primary/60 mb-1 uppercase tracking-tighter text-center border-b pb-0.5 leading-none">{region}</h4>
                          <div className="flex flex-col gap-1">
                              {(ufsByRegion[region] || []).map(uf => (
                              <button
                                  key={uf}
                                  onClick={() => setSelectedOrigin(uf)}
                                  className={`py-1.5 px-0 text-center text-[10px] font-black rounded transition-all border ${selectedOrigin === uf ? 'bg-primary text-primary-foreground border-primary shadow-sm scale-105 z-10' : 'hover:bg-accent border-transparent opacity-60 hover:opacity-100 bg-background/50'}`}
                              >
                                  {uf}
                              </button>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
                
                {/* Destinos */}
                <div className="flex-1 space-y-4 flex flex-col min-h-0">
                    <div>
                        <h3 className="font-bold mb-2 text-[10px] uppercase text-muted-foreground tracking-tighter">Destino (UF)</h3>
                        <ScrollArea className="bg-muted p-2 rounded-lg border">
                            <div className="flex gap-2 pb-2">
                                {ALL_UFS.map(uf => (
                                    <button
                                        key={uf}
                                        onClick={() => setSelectedDest(uf)}
                                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all shrink-0 ${selectedDest === uf ? 'bg-background shadow-sm border border-border text-foreground' : 'text-muted-foreground hover:bg-background/50'}`}
                                    >
                                        {uf}
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>

                    <div className="pt-2 flex-1">
                        <h3 className="font-bold text-sm mb-4">
                            Faixas para Rota <Badge variant="secondary" className="border-primary/20 bg-primary/10 text-primary">{selectedOrigin}</Badge> → <Badge variant="secondary">{selectedDest}</Badge>
                        </h3>
                        {tiers.length === 0 && (
                            <div className="bg-yellow-50 text-yellow-800 text-xs p-3 rounded-lg border border-yellow-200 mb-4 flex gap-2">
                                <Info className="h-4 w-4 shrink-0" />
                                <p>Sem faixas específicas. O sistema usará as faixas da Região ou Globais para esta rota.</p>
                            </div>
                        )}
                        <WeightTierTable tiers={tiers} onChange={handleTiersChange} />
                    </div>
                </div>
             </div>
        </div>
    );
}

// ------------------------------
// SHARED TABLE COMPONENT
// ------------------------------
function WeightTierTable({ tiers, onChange }: { tiers: WeightTier[], onChange: (tiers: WeightTier[]) => void }) {
    const sortedTiers = [...tiers].sort((a, b) => a.maxWeight - b.maxWeight);

    const handleChange = (index: number, field: keyof WeightTier, value: string) => {
        const newTiers = [...sortedTiers];
        if (field === 'label') {
            newTiers[index] = { ...newTiers[index], label: value };
        } else {
            newTiers[index] = { ...newTiers[index], [field]: parseFloat(value) || 0 };
        }
        onChange(newTiers);
    };

    const handleAdd = () => {
        const lastMax = sortedTiers.length > 0 ? sortedTiers[sortedTiers.length - 1].maxWeight : 0;
        const newTiers = [...sortedTiers, { maxWeight: lastMax + 1000, factor: 1.0, label: `Até ${(lastMax + 1000).toLocaleString('pt-BR')} kg` }];
        onChange(newTiers);
    };

    const handleRemove = (index: number) => {
        const newTiers = [...sortedTiers];
        newTiers.splice(index, 1);
        onChange(newTiers);
    };

    return (
        <div className="space-y-4">
            <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-muted">
                            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Faixa (até kg)</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Fator</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground hidden sm:table-cell">Descrição</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Efeito</th>
                            <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground w-16">Ação</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedTiers.map((tier, index) => (
                            <tr key={index} className="border-t hover:bg-muted/50 transition-colors">
                                <td className="px-4 py-2">
                                    <Input
                                        type="number"
                                        value={tier.maxWeight}
                                        onChange={(e) => handleChange(index, 'maxWeight', e.target.value)}
                                        className="w-24 sm:w-32 h-9 font-mono text-xs"
                                        min={1}
                                    />
                                </td>
                                <td className="px-4 py-2">
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={tier.factor}
                                        onChange={(e) => handleChange(index, 'factor', e.target.value)}
                                        className="w-20 sm:w-24 h-9 font-mono text-xs"
                                        min={0.01}
                                    />
                                </td>
                                <td className="px-4 py-2 hidden sm:table-cell">
                                    <Input
                                        type="text"
                                        value={tier.label || ''}
                                        onChange={(e) => handleChange(index, 'label', e.target.value)}
                                        className="h-9 text-xs"
                                        placeholder="Ex: Até 500 kg"
                                    />
                                </td>
                                <td className="px-4 py-2 text-xs">
                                    {tier.factor > 1 ? (
                                        <span className="text-red-600 font-bold bg-red-50 px-2 py-1 rounded">+{((tier.factor - 1) * 100).toFixed(0)}%</span>
                                    ) : tier.factor < 1 ? (
                                        <span className="text-green-600 font-bold bg-green-50 px-2 py-1 rounded">{((tier.factor - 1) * 100).toFixed(0)}%</span>
                                    ) : (
                                        <span className="text-muted-foreground font-medium bg-muted px-2 py-1 rounded">Base</span>
                                    )}
                                </td>
                                <td className="px-4 py-2 text-center">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleRemove(index)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </td>
                            </tr>
                        ))}
                        {sortedTiers.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                                    Clique em "Adicionar Faixa" para começar.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Button variant="outline" size="sm" onClick={handleAdd} className="w-full border-dashed">
                <Plus className="mr-2 h-4 w-4" /> Adicionar Faixa
            </Button>
        </div>
    );
}
