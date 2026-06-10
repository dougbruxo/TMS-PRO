"use client";

import { useState, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { PackagePlus, Users, ShieldCheck, Truck, PackageOpen, Warehouse, Box, Ship } from 'lucide-react';
import type { QuoteExtra } from '@/lib/types';

const EXTRAS_CONFIG = [
  { name: 'Ajudante', icon: Users, quantityLabel: 'Qtd. Ajudantes' },
  { name: 'Escolta', icon: ShieldCheck, quantityLabel: 'Quantidade' },
  { name: 'Munck', icon: Truck, quantityLabel: 'Quantidade' },
  { name: 'Filme Stretch', icon: PackageOpen, quantityLabel: 'Quantidade' },
  { name: 'Armazenagem', icon: Warehouse, quantityLabel: 'Qtd. Dias' },
  { name: 'Embalagens', icon: Box, quantityLabel: 'Quantidade' },
  { name: 'Balsa', icon: Ship, quantityLabel: 'Quantidade' },
];

interface QuoteExtrasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (extras: QuoteExtra[], total: number) => void;
  initialExtras?: QuoteExtra[];
}

function formatCurrencyInput(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  const amount = parseInt(digits) / 100;
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseCurrencyInput(formatted: string): number {
  const digits = formatted.replace(/\D/g, '');
  if (!digits) return 0;
  return parseInt(digits) / 100;
}

export function QuoteExtrasDialog({ open, onOpenChange, onConfirm, initialExtras }: QuoteExtrasDialogProps) {
  const [extras, setExtras] = useState<Record<string, { enabled: boolean; quantity: number; unitValueFormatted: string }>>(() => {
    const initial: Record<string, { enabled: boolean; quantity: number; unitValueFormatted: string }> = {};
    EXTRAS_CONFIG.forEach(cfg => {
      const existing = initialExtras?.find(e => e.name === cfg.name);
      initial[cfg.name] = {
        enabled: existing?.enabled || false,
        quantity: existing?.quantity || 1,
        unitValueFormatted: existing?.unitValue ? (existing.unitValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '',
      };
    });
    return initial;
  });

  const handleToggle = useCallback((name: string, checked: boolean) => {
    setExtras(prev => ({
      ...prev,
      [name]: { ...prev[name], enabled: checked }
    }));
  }, []);

  const handleQuantityChange = useCallback((name: string, value: string) => {
    const qty = parseInt(value) || 0;
    setExtras(prev => ({
      ...prev,
      [name]: { ...prev[name], quantity: qty }
    }));
  }, []);

  const handleValueChange = useCallback((name: string, value: string) => {
    const formatted = formatCurrencyInput(value);
    setExtras(prev => ({
      ...prev,
      [name]: { ...prev[name], unitValueFormatted: formatted }
    }));
  }, []);

  const getItemTotal = useCallback((name: string): number => {
    const item = extras[name];
    if (!item?.enabled) return 0;
    const unitValue = parseCurrencyInput(item.unitValueFormatted);
    return item.quantity * unitValue;
  }, [extras]);

  const grandTotal = useMemo(() => {
    return EXTRAS_CONFIG.reduce((sum, cfg) => sum + getItemTotal(cfg.name), 0);
  }, [extras, getItemTotal]);

  const handleConfirm = () => {
    const result: QuoteExtra[] = EXTRAS_CONFIG
      .filter(cfg => extras[cfg.name]?.enabled)
      .map(cfg => {
        const item = extras[cfg.name];
        const unitValue = parseCurrencyInput(item.unitValueFormatted);
        return {
          name: cfg.name,
          enabled: true,
          quantity: item.quantity,
          unitValue,
          total: item.quantity * unitValue,
        };
      });
    onConfirm(result, grandTotal);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-primary" /> Itens Extras da Cotação
          </DialogTitle>
          <DialogDescription>
            Selecione os serviços adicionais e defina quantidade e valor unitário. O total será adicionado ao valor do frete.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-2">
          {EXTRAS_CONFIG.map((cfg) => {
            const item = extras[cfg.name];
            const Icon = cfg.icon;
            const itemTotal = getItemTotal(cfg.name);

            return (
              <div
                key={cfg.name}
                className={`p-3 rounded-xl border transition-all duration-200 ${
                  item.enabled
                    ? 'border-primary/40 bg-primary/5 shadow-sm'
                    : 'border-border bg-card hover:border-muted-foreground/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id={`extra-${cfg.name}`}
                      checked={item.enabled}
                      onCheckedChange={(checked) => handleToggle(cfg.name, !!checked)}
                    />
                    <Icon className={`h-4 w-4 ${item.enabled ? 'text-primary' : 'text-muted-foreground'}`} />
                    <Label
                      htmlFor={`extra-${cfg.name}`}
                      className={`font-medium cursor-pointer text-sm ${item.enabled ? 'text-foreground' : 'text-muted-foreground'}`}
                    >
                      {cfg.name}
                    </Label>
                  </div>
                  {item.enabled && itemTotal > 0 && (
                    <span className="text-xs font-semibold text-primary">
                      {itemTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  )}
                </div>

                {item.enabled && (
                  <div className="mt-3 grid grid-cols-2 gap-3 pl-9">
                    <div>
                      <Label className="text-xs text-muted-foreground">{cfg.quantityLabel}</Label>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(cfg.name, e.target.value)}
                        className="h-8 text-sm mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Valor Unitário</Label>
                      <Input
                        type="text"
                        placeholder="R$ 0,00"
                        value={item.unitValueFormatted}
                        onChange={(e) => handleValueChange(cfg.name, e.target.value)}
                        className="h-8 text-sm mt-1"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <Separator />

        <DialogFooter className="flex-col sm:flex-row gap-3 pt-2">
          <div className="flex-1 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Total Extras:</span>
            <span className="text-lg font-bold text-primary">
              {grandTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={grandTotal === 0}>
              <PackagePlus className="mr-2 h-4 w-4" /> Adicionar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
