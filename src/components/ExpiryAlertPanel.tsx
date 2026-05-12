"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, AlertOctagon, Clock, Package, XCircle } from 'lucide-react';
import type { StockItem } from '@/lib/types';
import { differenceInDays, parseISO, format } from 'date-fns';

interface ExpiryAlertPanelProps {
  items: StockItem[];
}

type ExpiryGroup = 'expired' | 'critical' | 'warning';

interface CategorizedItem {
  item: StockItem;
  daysRemaining: number;
  group: ExpiryGroup;
}

const groupConfig: Record<ExpiryGroup, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  expired: {
    label: 'Vencidos',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10 border-red-500/30',
    icon: <XCircle className="h-4 w-4 text-red-500" />,
  },
  critical: {
    label: 'Crítico (1-7 dias)',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10 border-orange-500/30',
    icon: <AlertOctagon className="h-4 w-4 text-orange-500" />,
  },
  warning: {
    label: 'Atenção (8-30 dias)',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10 border-amber-500/30',
    icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  },
};

export function ExpiryAlertPanel({ items }: ExpiryAlertPanelProps) {
  const categorized = useMemo(() => {
    const result: CategorizedItem[] = [];
    const now = new Date();

    items.forEach(item => {
      if (!item.expirationDate) return;
      try {
        const daysRemaining = differenceInDays(parseISO(item.expirationDate), now);
        let group: ExpiryGroup | null = null;

        if (daysRemaining < 0) {
          group = 'expired';
        } else if (daysRemaining <= 7) {
          group = 'critical';
        } else if (daysRemaining <= 30) {
          group = 'warning';
        }

        if (group) {
          result.push({ item, daysRemaining, group });
        }
      } catch (e) {
        // Invalid date — skip
      }
    });

    // FEFO: sort by expiration ascending (soonest first)
    return result.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [items]);

  const groups: ExpiryGroup[] = ['expired', 'critical', 'warning'];

  if (categorized.length === 0) {
    return (
      <Card className="border-dashed border-2">
        <CardContent className="py-12 flex flex-col items-center justify-center text-muted-foreground">
          <Package className="w-10 h-10 mb-3 opacity-50" />
          <p className="text-sm font-medium">Nenhum item com validade próxima ou vencida</p>
          <p className="text-xs mt-1">Todos os itens estão dentro do prazo de validade.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        {groups.map(group => {
          const count = categorized.filter(c => c.group === group).length;
          if (count === 0) return null;
          const cfg = groupConfig[group];
          return (
            <Badge
              key={group}
              variant="outline"
              className={`${cfg.bgColor} ${cfg.color} gap-1.5 px-3 py-1.5 text-sm font-semibold ${group === 'expired' ? 'animate-pulse' : ''}`}
            >
              {cfg.icon}
              {count} {cfg.label}
            </Badge>
          );
        })}
      </div>

      {/* Grouped tables */}
      {groups.map(group => {
        const groupItems = categorized.filter(c => c.group === group);
        if (groupItems.length === 0) return null;
        const cfg = groupConfig[group];

        return (
          <Card key={group} className={`border ${cfg.bgColor}`}>
            <CardHeader className="pb-3">
              <CardTitle className={`text-sm flex items-center gap-2 ${cfg.color}`}>
                {cfg.icon}
                {cfg.label} — {groupItems.length} item(s)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ScrollArea className="max-h-[300px]">
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Lote</TableHead>
                        <TableHead>Validade</TableHead>
                        <TableHead>Dias</TableHead>
                        <TableHead>Qtd</TableHead>
                        <TableHead>Posição</TableHead>
                        <TableHead>Empresa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupItems.map(({ item, daysRemaining }) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                          <TableCell className="font-medium text-sm">{item.name}</TableCell>
                          <TableCell className="text-xs">{item.batch || '--'}</TableCell>
                          <TableCell className="text-xs">
                            {item.expirationDate
                              ? format(parseISO(item.expirationDate), 'dd/MM/yyyy')
                              : '--'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-xs font-bold ${
                                daysRemaining < 0
                                  ? 'text-red-600 bg-red-100 dark:bg-red-900/30'
                                  : daysRemaining <= 7
                                  ? 'text-orange-600 bg-orange-100 dark:bg-orange-900/30'
                                  : 'text-amber-600 bg-amber-100 dark:bg-amber-900/30'
                              }`}
                            >
                              {daysRemaining < 0
                                ? `${Math.abs(daysRemaining)}d vencido`
                                : daysRemaining === 0
                                ? 'Hoje!'
                                : `${daysRemaining}d restantes`}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-bold text-center">{item.quantity}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-muted/50">{item.positionName}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{item.companyName || '--'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
