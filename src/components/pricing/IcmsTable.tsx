
"use client";

import { useState, useMemo } from 'react';
import type { IcmsRates, Regions } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ALL_UFS } from '@/lib/ufs';

interface IcmsTableProps {
  icmsRates: IcmsRates | null | undefined;
  regions: Regions | null | undefined;
  onRateChange: (origin: string, dest: string, value: string) => void;
}

export function IcmsTable({ icmsRates, regions, onRateChange }: IcmsTableProps) {
  // Verificação de segurança para impedir a renderização se os dados não estiverem prontos
  if (!regions || !icmsRates) {
    return null; // Não renderiza nada se as props essenciais não forem fornecidas
  }

  const [selectedOrigin, setSelectedOrigin] = useState('SP');
  
  const ufsByRegion = useMemo(() => {
    const sorted: Record<string, string[]> = {};
    for (const region in regions) {
      if (regions[region]) {
        sorted[region] = [...regions[region]].sort();
      }
    }
    return sorted;
  }, [regions]);

  const originUfs = useMemo(() => Object.keys(regions).sort(), [regions]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tabela de Alíquotas de ICMS (%)</CardTitle>
        <CardDescription>
          Selecione o estado de origem para ver e editar as alíquotas para cada estado de destino.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-1/4">
            <h3 className="font-semibold mb-2">Origem (UF)</h3>
            <ScrollArea className="h-96 border rounded-md">
              <div className="p-2">
                {originUfs.map(region => (
                  <div key={region} className="mb-2">
                    <h4 className="font-semibold text-sm text-primary px-2 mb-1">{region}</h4>
                    {(ufsByRegion[region] || []).map(uf => (
                      <button
                        key={uf}
                        onClick={() => setSelectedOrigin(uf)}
                        className={`w-full text-left p-2 text-sm rounded-md ${selectedOrigin === uf ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
                      >
                        {uf}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
          <div className="w-full md:w-3/4">
             <h3 className="font-semibold mb-2">Destinos a partir de <Badge>{selectedOrigin}</Badge></h3>
            <ScrollArea className="h-96 border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Destino (UF)</TableHead>
                            <TableHead>Alíquota (%)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {ALL_UFS.map(destUf => (
                             <TableRow key={`${selectedOrigin}-${destUf}`}>
                                <TableCell>{destUf}</TableCell>
                                <TableCell>
                                    <Input 
                                        type="number"
                                        className="w-24"
                                        value={icmsRates?.[selectedOrigin]?.[destUf] || ''}
                                        onChange={(e) => onRateChange(selectedOrigin, destUf, e.target.value)}
                                        placeholder="Ex: 12"
                                    />
                                </TableCell>
                             </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ScrollArea>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
