"use client";

import React, { useState, useMemo, useLayoutEffect, useRef, useCallback, memo, useTransition, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Map } from 'lucide-react';

interface MinimumFreightRegionTableProps {
  regions: Record<string, string[]>;
  regionRates: Record<string, Record<string, any>>;
  onRateChange: (originRegion: string, destRegion: string, field: string, value: string | number) => void;
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

export function MinimumFreightRegionTable({ 
  regions, 
  regionRates, 
  onRateChange, 
  title, 
  description 
}: MinimumFreightRegionTableProps) {
  const regionKeys = useMemo(() => Object.keys(regions), [regions]);
  const [selectedOrigin, setSelectedOrigin] = useState<string>(regionKeys[0] || "");
  const [bulkValues, setBulkValues] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();
  const bulkTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  const formatCurrencyValue = useCallback((value: number | string | undefined) => {
    const numeric = typeof value === 'string' ? (Number(value.replace(/\D/g, '')) / 100) : value;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numeric || 0);
  }, []);

  const handleBulkChange = useCallback((field: string, value: string) => {
    const onlyDigits = value.replace(/\D/g, '');
    setBulkValues(prev => ({ ...prev, [field]: onlyDigits }));
    
    // De-bounce de 600ms para evitar que o modal de "Sobrescrever" apareça no meio da digitação
    if (bulkTimeoutRef.current[field]) clearTimeout(bulkTimeoutRef.current[field]);
    
    bulkTimeoutRef.current[field] = setTimeout(() => {
        const numeric = Number(onlyDigits) / 100;
        startTransition(() => {
            regionKeys.forEach(dest => {
                onRateChange(selectedOrigin, dest, field, numeric.toString()); 
            });
        });
    }, 600);
  }, [onRateChange, regionKeys, selectedOrigin]);

  const handleDataChange = useCallback((val: string, dest: string, field: string) => {
    const rawValue = val.replace(/\D/g, '');
    startTransition(() => {
        onRateChange(selectedOrigin, dest, field, (Number(rawValue)/100).toString());
    });
  }, [onRateChange, selectedOrigin]);

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
          <Map className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>{title || 'Configuração por Região'}</CardTitle>
            <CardDescription>
              {description || 'Defina valores mínimos entre regiões. Estes valores serão aplicados a todas as UFs pertencentes às regiões selecionadas.'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="w-full md:w-[130px] shrink-0">
            <h3 className="font-bold mb-2 text-[10px] uppercase text-muted-foreground tracking-tighter text-center">Região Origem</h3>
            <ScrollArea className="h-[600px] border rounded-lg bg-muted/5 shadow-inner">
              <div className="p-2 flex flex-col gap-1">
                {regionKeys.map(region => (
                  <button
                    key={region}
                    onClick={() => setSelectedOrigin(region)}
                    className={`py-2.5 px-2 text-center text-[10px] font-black rounded transition-all border leading-tight ${selectedOrigin === region ? 'bg-primary text-primary-foreground border-primary shadow-sm scale-105 z-10' : 'hover:bg-accent border-transparent opacity-60 hover:opacity-100 bg-background/50'}`}
                  >
                    {region}
                  </button>
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
                                    {/* Bulk Header Rows */}
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

                                    {/* Labels Row */}
                                    <div style={rowStyle} className="bg-muted/50 border-b-2">
                                        <div style={labelColStyle} className="font-black text-sm uppercase text-primary p-4 text-left flex items-center">Região Destino</div>
                                        <div style={dataColStyle} className="text-center text-[11px] font-black uppercase tracking-widest text-muted-foreground p-4 flex items-center justify-center">Capital</div>
                                        <div style={dataColStyle} className="text-center text-[11px] font-black uppercase tracking-widest text-muted-foreground p-4 flex items-center justify-center">Metro</div>
                                        <div style={dataColStyle} className="text-center text-[11px] font-black uppercase tracking-widest text-muted-foreground p-4 flex items-center justify-center">Interior</div>
                                        <div style={lastDataColStyle} className="text-center text-[11px] font-black uppercase tracking-widest text-muted-foreground p-4 flex items-center justify-center">Rural</div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>

                    {/* Body (Rows) */}
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

                            return Object.entries(regions).flatMap(([regionKey, ufs]) => {
                                return (ufs as string[]).map((destUf: string) => {
                                    const rates = regionRates[selectedOrigin]?.[destUf] || {};
                                    return (
                                        <div key={destUf} style={rowStyle} className="hover:bg-muted/30 border-b bg-background">
                                            <div style={labelColStyle} className="font-black text-xs bg-muted/10 p-4 text-left flex items-center overflow-hidden shrink-0">{destUf}</div>
                                            <div style={dataColStyle} className="p-2 flex flex-col justify-center">
                                                <div className="flex flex-col gap-1">
                                                    <DataInput 
                                                        value={rates.capital} 
                                                        onChange={(val: string) => handleDataChange(val, destUf, 'capital')} 
                                                        formatCurrency={formatCurrencyValue}
                                                    />
                                                    <DataInput 
                                                        value={rates.kgCapital} 
                                                        onChange={(val: string) => handleDataChange(val, destUf, 'kgCapital')} 
                                                        isKg 
                                                        formatCurrency={formatCurrencyValue}
                                                    />
                                                </div>
                                            </div>
                                            <div style={dataColStyle} className="p-2 flex flex-col justify-center">
                                                <div className="flex flex-col gap-1">
                                                    <DataInput 
                                                        value={rates.metropolitana} 
                                                        onChange={(val: string) => handleDataChange(val, destUf, 'metropolitana')} 
                                                        formatCurrency={formatCurrencyValue}
                                                    />
                                                    <DataInput 
                                                        value={rates.kgMetropolitana} 
                                                        onChange={(val: string) => handleDataChange(val, destUf, 'kgMetropolitana')} 
                                                        isKg 
                                                        formatCurrency={formatCurrencyValue}
                                                    />
                                                </div>
                                            </div>
                                            <div style={dataColStyle} className="p-2 flex flex-col justify-center">
                                                <div className="flex flex-col gap-1">
                                                    <DataInput 
                                                        value={rates.interior} 
                                                        onChange={(val: string) => handleDataChange(val, destUf, 'interior')} 
                                                        formatCurrency={formatCurrencyValue}
                                                    />
                                                    <DataInput 
                                                        value={rates.kgInterior} 
                                                        onChange={(val: string) => handleDataChange(val, destUf, 'kgInterior')} 
                                                        isKg 
                                                        formatCurrency={formatCurrencyValue}
                                                    />
                                                </div>
                                            </div>
                                            <div style={lastDataColStyle} className="p-2 flex flex-col justify-center">
                                                <div className="flex flex-col gap-1">
                                                    <DataInput 
                                                        value={rates.rural} 
                                                        onChange={(val: string) => handleDataChange(val, destUf, 'rural')} 
                                                        formatCurrency={formatCurrencyValue}
                                                    />
                                                    <DataInput 
                                                        value={rates.kgRural} 
                                                        onChange={(val: string) => handleDataChange(val, destUf, 'kgRural')} 
                                                        isKg 
                                                        formatCurrency={formatCurrencyValue}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                });
                            });
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

MinimumFreightRegionTable.displayName = "MinimumFreightRegionTable";
