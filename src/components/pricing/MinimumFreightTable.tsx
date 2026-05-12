"use client";

import React, { useState, useMemo, useLayoutEffect, useRef, useCallback, memo, useTransition, useEffect } from 'react';
import type { Regions } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ALL_UFS } from '@/lib/ufs';
import { DollarSign } from 'lucide-react';

interface MinimumFreightTableProps {
  rates: any | null | undefined;
  regions: Regions | null | undefined;
  onRateChange: (origin: string, dest: string, field: string, value: string) => void;
  onBulkApply?: (origin: string, field: string, value: number | string) => void;
  title?: string;
  description?: string;
}

// Componentes auxiliares fora para evitar perda de foco durante re-renderização
const CurrencyInput = memo(({ value, ...props }: any) => {
  const inputRef = useRef<HTMLInputElement>(null);
  
  const forceEnd = () => {
      if (inputRef.current && document.activeElement === inputRef.current) {
          const len = inputRef.current.value.length;
          inputRef.current.setSelectionRange(len, len);
      }
  };

  useLayoutEffect(() => {
      forceEnd();
  });

  return (
      <Input
          {...props}
          ref={inputRef}
          value={value}
          onFocus={(e) => { forceEnd(); props.onFocus?.(e); }}
          onClick={(e) => { forceEnd(); props.onClick?.(e); }}
          onSelect={(e) => { forceEnd(); props.onSelect?.(e); }}
          onKeyUp={(e) => { forceEnd(); props.onKeyUp?.(e); }}
      />
  );
});

CurrencyInput.displayName = "CurrencyInput";

const BulkInput = memo(({ field, label, value, formatCurrency, onChange }: any) => (
  <div className="flex flex-col items-center gap-0.5 py-1">
      <span className="text-[9px] text-muted-foreground uppercase font-black">{label}</span>
      <CurrencyInput 
          type="text" 
          className="h-8 w-full text-right text-[10px] font-mono border-orange-200 focus:border-orange-500 bg-orange-50/20" 
          value={formatCurrency(value || "")}
          onChange={(e: any) => onChange(e.target.value)}
      />
  </div>
));

BulkInput.displayName = "BulkInput";

const DataInput = memo(({ value, onChange, formatCurrency, isKg = false }: any) => (
  <CurrencyInput 
      type="text"
      className={`text-right h-8 font-mono text-xs w-full transition-all ${isKg ? 'bg-blue-50/30 border-blue-200 text-blue-700 font-bold focus:bg-blue-50' : 'bg-muted/30 focus:bg-background'}`}
      value={formatCurrency(value || 0)}
      onChange={(e: any) => onChange(e.target.value)}
      placeholder="R$ 0,00"
  />
));

DataInput.displayName = "DataInput";

export function MinimumFreightTable({ rates, regions, onRateChange, onBulkApply, title, description }: MinimumFreightTableProps) {
  if (!regions) return null;

  const [selectedOrigin, setSelectedOrigin] = useState('SP');
  const [bulkValues, setBulkValues] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();
  const bulkTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  
  const ufsByRegion = useMemo(() => {
    const sorted: Record<string, string[]> = {};
    for (const region in regions) {
      if (regions[region]) sorted[region] = [...regions[region]].sort();
    }
    return sorted;
  }, [regions]);

  const originUfs = useMemo(() => Object.keys(regions).sort(), [regions]);

  const formatCurrencyValue = useCallback((value: number | string) => {
    const numeric = typeof value === 'string' ? (Number(value.replace(/\D/g, '')) / 100) : value;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numeric || 0);
  }, []);

  const handleMaskedInput = useCallback((val: string, origin: string, dest: string, field: string) => {
    const rawValue = val.replace(/\D/g, '');
    const numericValue = Number(rawValue) / 100;
    // Para inputs individuais, useTransition ajuda a manter a UI rápida
    startTransition(() => {
        onRateChange(origin, dest, field, numericValue.toString());
    });
  }, [onRateChange]);

  const handleBulkChange = useCallback((field: string, value: string) => {
    const onlyDigits = value.replace(/\D/g, '');
    setBulkValues(prev => ({ ...prev, [field]: onlyDigits }));
    
    if (!onBulkApply) return;
    
    // De-bounce de 400ms para o processo pesado de propagação em lote
    if (bulkTimeoutRef.current[field]) clearTimeout(bulkTimeoutRef.current[field]);
    
    bulkTimeoutRef.current[field] = setTimeout(() => {
        const numeric = Number(onlyDigits) / 100;
        startTransition(() => {
            onBulkApply(selectedOrigin, field, numeric);
        });
    }, 400);
  }, [onBulkApply, selectedOrigin]);

  // Limpeza de timers ao desmontar
  useEffect(() => {
    const refs = bulkTimeoutRef.current;
    return () => {
        Object.values(refs).forEach(timer => clearTimeout(timer));
    };
  }, []);

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <div>
                <CardTitle>{title || "Precificação por UF"}</CardTitle>
                <CardDescription>
                {description || "Defina valores de frete mínimo e taxa por kg para cada tipo de localidade."}
                </CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="w-full md:w-[130px] shrink-0">
            <h3 className="font-bold mb-2 text-[10px] uppercase text-muted-foreground tracking-tighter text-center">Origem</h3>
            <ScrollArea className="h-[650px] border rounded-lg bg-muted/5 shadow-inner">
              <div className="p-1.5 flex flex-col gap-1">
                {originUfs.map(region => (
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
          <div className="flex-1 min-w-0">
             <div className="flex items-center justify-between mb-4 bg-muted/20 p-3 rounded-lg border">
                <h3 className="font-bold text-sm uppercase text-muted-foreground flex items-center gap-3">
                    Destinos saindo de <Badge variant="secondary" className="text-sm py-1 px-4 border-primary/20 bg-primary/10 text-primary">{selectedOrigin}</Badge>
                </h3>
                <div className="flex gap-4">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                        <div className="w-3 h-3 rounded bg-muted/40 border" /> Mínimo
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-blue-600 uppercase">
                        <div className="w-3 h-3 rounded bg-blue-100 border-blue-200" /> Kg Cubado
                    </div>
                </div>
             </div>
             
            <ScrollArea className="h-[600px] border rounded-lg">
                <div style={{ minWidth: '920px' }} className="bg-background text-sm">
                    {/* Header Sticky */}
                    <div className="sticky top-0 z-30 bg-background shadow-sm border-b-2">
                        {/* Define Row Style constant */}
                        {(() => {
                            const rowStyle = {
                                display: 'flex',
                                width: '920px',
                                alignItems: 'stretch'
                            };
                            const labelColStyle = { width: '100px', minWidth: '100px', flexShrink: 0, borderRight: '1px solid #e5e7eb' };
                            const dataColStyle = { width: '205px', minWidth: '205px', flexShrink: 0, borderRight: '1px solid #e5e7eb' };
                            const lastDataColStyle = { width: '205px', minWidth: '205px', flexShrink: 0 };
                            
                            return (
                                <>
                                    {/* Lote Mínimo - Bulk Header Row */}
                                    <div style={rowStyle} className="border-b bg-background hover:bg-transparent">
                                        <div style={labelColStyle} className="font-bold text-[10px] text-primary whitespace-nowrap p-4 text-left flex items-center">
                                            Lote <br/> <span className="text-muted-foreground">MÍNIMO</span>
                                        </div>
                                        <div style={dataColStyle} className="p-0 flex items-center justify-center">
                                            <BulkInput 
                                                field="capital" 
                                                label="Capital" 
                                                value={bulkValues.capital}
                                                formatCurrency={formatCurrencyValue}
                                                onChange={(val: string) => handleBulkChange("capital", val)}
                                            />
                                        </div>
                                        <div style={dataColStyle} className="p-0 flex items-center justify-center">
                                            <BulkInput 
                                                field="metropolitana" 
                                                label="Metro" 
                                                value={bulkValues.metropolitana}
                                                formatCurrency={formatCurrencyValue}
                                                onChange={(val: string) => handleBulkChange("metropolitana", val)}
                                            />
                                        </div>
                                        <div style={dataColStyle} className="p-0 flex items-center justify-center">
                                            <BulkInput 
                                                field="interior" 
                                                label="Interior" 
                                                value={bulkValues.interior}
                                                formatCurrency={formatCurrencyValue}
                                                onChange={(val: string) => handleBulkChange("interior", val)}
                                            />
                                        </div>
                                        <div style={lastDataColStyle} className="p-0 flex items-center justify-center">
                                            <BulkInput 
                                                field="rural" 
                                                label="Rural" 
                                                value={bulkValues.rural}
                                                formatCurrency={formatCurrencyValue}
                                                onChange={(val: string) => handleBulkChange("rural", val)}
                                            />
                                        </div>
                                    </div>

                                    {/* Lote Kg Cubado - Bulk Header Row */}
                                    <div style={rowStyle} className="border-b bg-background hover:bg-transparent">
                                        <div style={labelColStyle} className="font-bold text-[10px] text-blue-600 whitespace-nowrap p-4 text-left flex items-center">
                                            Lote <br/> <span className="text-blue-400">KG CUBADO</span>
                                        </div>
                                        <div style={dataColStyle} className="p-0 flex items-center justify-center">
                                            <BulkInput 
                                                field="kgCapital" 
                                                label="Capital" 
                                                value={bulkValues.kgCapital}
                                                formatCurrency={formatCurrencyValue}
                                                onChange={(val: string) => handleBulkChange("kgCapital", val)}
                                            />
                                        </div>
                                        <div style={dataColStyle} className="p-0 flex items-center justify-center">
                                            <BulkInput 
                                                field="kgMetropolitana" 
                                                label="Metro" 
                                                value={bulkValues.kgMetropolitana}
                                                formatCurrency={formatCurrencyValue}
                                                onChange={(val: string) => handleBulkChange("kgMetropolitana", val)}
                                            />
                                        </div>
                                        <div style={dataColStyle} className="p-0 flex items-center justify-center">
                                            <BulkInput 
                                                field="kgInterior" 
                                                label="Interior" 
                                                value={bulkValues.kgInterior}
                                                formatCurrency={formatCurrencyValue}
                                                onChange={(val: string) => handleBulkChange("kgInterior", val)}
                                            />
                                        </div>
                                        <div style={lastDataColStyle} className="p-0 flex items-center justify-center">
                                            <BulkInput 
                                                field="kgRural" 
                                                label="Rural" 
                                                value={bulkValues.kgRural}
                                                formatCurrency={formatCurrencyValue}
                                                onChange={(val: string) => handleBulkChange("kgRural", val)}
                                            />
                                        </div>
                                    </div>

                                    {/* Column Labels Row */}
                                    <div style={rowStyle} className="bg-muted/50 border-b-2">
                                        <div style={labelColStyle} className="font-black text-sm uppercase text-primary p-4 text-left flex items-center">Destino</div>
                                        <div style={dataColStyle} className="text-center text-[11px] font-black uppercase tracking-widest text-muted-foreground p-4 flex items-center justify-center">Capital</div>
                                        <div style={dataColStyle} className="text-center text-[11px] font-black uppercase tracking-widest text-muted-foreground p-4 flex items-center justify-center">Metro</div>
                                        <div style={dataColStyle} className="text-center text-[11px] font-black uppercase tracking-widest text-muted-foreground p-4 flex items-center justify-center">Interior</div>
                                        <div style={lastDataColStyle} className="text-center text-[11px] font-black uppercase tracking-widest text-muted-foreground p-4 flex items-center justify-center">Rural</div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>

                    {/* Body Rows outside of sticky header */}
                    <div>
                        {(() => {
                            const rowStyle = {
                                display: 'flex',
                                width: '920px',
                                alignItems: 'stretch'
                            };
                            const labelColStyle = { width: '100px', minWidth: '100px', flexShrink: 0, borderRight: '1px solid #e5e7eb' };
                            const dataColStyle = { width: '205px', minWidth: '205px', flexShrink: 0, borderRight: '1px solid #e5e7eb' };
                            const lastDataColStyle = { width: '205px', minWidth: '205px', flexShrink: 0 };

                            return ALL_UFS.map(destUf => (
                                <div key={`${selectedOrigin}-${destUf}`} style={rowStyle} className="hover:bg-muted/10 group border-b bg-background">
                                    <div style={labelColStyle} className="font-black text-xl text-primary/30 group-hover:text-primary transition-all text-center bg-muted/5 p-4 flex items-center justify-center">
                                        {destUf}
                                    </div>
                                    <div style={dataColStyle} className="p-2 flex flex-col justify-center">
                                        <div className="space-y-1">
                                            <DataInput 
                                                value={rates?.[selectedOrigin]?.[destUf]?.capital} 
                                                onChange={(val: string) => handleMaskedInput(val, selectedOrigin, destUf, 'capital')} 
                                                formatCurrency={formatCurrencyValue}
                                            />
                                            <DataInput 
                                                value={rates?.[selectedOrigin]?.[destUf]?.kgCapital} 
                                                onChange={(val: string) => handleMaskedInput(val, selectedOrigin, destUf, 'kgCapital')} 
                                                isKg 
                                                formatCurrency={formatCurrencyValue}
                                            />
                                        </div>
                                    </div>
                                    <div style={dataColStyle} className="p-2 flex flex-col justify-center">
                                        <div className="space-y-1">
                                            <DataInput 
                                                value={rates?.[selectedOrigin]?.[destUf]?.metropolitana} 
                                                onChange={(val: string) => handleMaskedInput(val, selectedOrigin, destUf, 'metropolitana')} 
                                                formatCurrency={formatCurrencyValue}
                                            />
                                            <DataInput 
                                                value={rates?.[selectedOrigin]?.[destUf]?.kgMetropolitana} 
                                                onChange={(val: string) => handleMaskedInput(val, selectedOrigin, destUf, 'kgMetropolitana')} 
                                                isKg 
                                                formatCurrency={formatCurrencyValue}
                                            />
                                        </div>
                                    </div>
                                    <div style={dataColStyle} className="p-2 flex flex-col justify-center">
                                        <div className="space-y-1">
                                            <DataInput 
                                                value={rates?.[selectedOrigin]?.[destUf]?.interior} 
                                                onChange={(val: string) => handleMaskedInput(val, selectedOrigin, destUf, 'interior')} 
                                                formatCurrency={formatCurrencyValue}
                                            />
                                            <DataInput 
                                                value={rates?.[selectedOrigin]?.[destUf]?.kgInterior} 
                                                onChange={(val: string) => handleMaskedInput(val, selectedOrigin, destUf, 'kgInterior')} 
                                                isKg 
                                                formatCurrency={formatCurrencyValue}
                                            />
                                        </div>
                                    </div>
                                    <div style={lastDataColStyle} className="p-2 flex flex-col justify-center">
                                        <div className="space-y-1">
                                            <DataInput 
                                                value={rates?.[selectedOrigin]?.[destUf]?.rural} 
                                                onChange={(val: string) => handleMaskedInput(val, selectedOrigin, destUf, 'rural')} 
                                                formatCurrency={formatCurrencyValue}
                                            />
                                            <DataInput 
                                                value={rates?.[selectedOrigin]?.[destUf]?.kgRural} 
                                                onChange={(val: string) => handleMaskedInput(val, selectedOrigin, destUf, 'kgRural')} 
                                                isKg 
                                                formatCurrency={formatCurrencyValue}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>

                </div>
            </ScrollArea>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
