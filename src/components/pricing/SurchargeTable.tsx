
"use client";

import { useState } from 'react';
import type { Surcharges } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '../ui/separator';

interface SurchargeTableProps {
  surcharges: Surcharges;
  onRateChange: (mode: 'dezlog' | 'fracionado', region: string, type: 'regional' | 'cubageMultiplier', value: number) => void;
}

export function SurchargeTable({ surcharges, onRateChange }: SurchargeTableProps) {

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Acréscimos para Frete Dedicado (%)</CardTitle>
          <CardDescription>
            Defina a percentagem de acréscimo para o frete dedicado em cada região.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <div className="border rounded-md">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Região</TableHead>
                        <TableHead>Acréscimo (%)</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {Object.entries(surcharges.dezlog).map(([region, rate]) => (
                         <TableRow key={`dedicado-${region}`}>
                            <TableCell className="font-medium">{region}</TableCell>
                            <TableCell>
                                <Input 
                                    type="number"
                                    className="w-24"
                                    value={rate * 100}
                                    onChange={(e) => onRateChange('dezlog', region, 'regional', parseFloat(e.target.value))}
                                />
                            </TableCell>
                         </TableRow>
                    ))}
                </TableBody>
            </Table>
           </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Configurações para Frete Fracionado</CardTitle>
           <CardDescription>
            Defina o acréscimo regional (%) e o multiplicador de cubagem para cada região.
          </CardDescription>
        </CardHeader>
        <CardContent>
             <div className="border rounded-md">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Região</TableHead>
                        <TableHead>Acréscimo Regional (%)</TableHead>
                        <TableHead>Multiplicador de Cubagem</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {Object.entries(surcharges.fracionado).map(([region, config]) => (
                         <TableRow key={`fracionado-${region}`}>
                            <TableCell className="font-medium">{region}</TableCell>
                            <TableCell>
                                <Input 
                                    type="number"
                                    className="w-24"
                                    value={(config.regional || 0) * 100}
                                    onChange={(e) => onRateChange('fracionado', region, 'regional', parseFloat(e.target.value))}
                                />
                            </TableCell>
                             <TableCell>
                                <Input 
                                    type="number"
                                    step="0.1"
                                    className="w-24"
                                    value={config.cubageMultiplier || 1.5}
                                    onChange={(e) => onRateChange('fracionado', region, 'cubageMultiplier', parseFloat(e.target.value))}
                                />
                            </TableCell>
                         </TableRow>
                    ))}
                </TableBody>
            </Table>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}

