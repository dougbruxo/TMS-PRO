"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ScanBarcode,
  Keyboard,
  Package,
} from 'lucide-react';
import type { ExpeditionRequest } from '@/lib/types';
import { authFetch } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';

interface PickingDialogProps {
  request: ExpeditionRequest | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (requestId: string) => Promise<void>;
  isSubmitting: boolean;
}

interface PickingLineState {
  sku: string;
  description: string;
  quantityRequested: number;
  quantityChecked: number;
  isComplete: boolean;
  manualCheck: boolean;
  stockItemIds: string[];
}

export function PickingDialog({
  request,
  isOpen,
  onOpenChange,
  onConfirm,
  isSubmitting,
}: PickingDialogProps) {
  const { toast } = useToast();
  const scanInputRef = useRef<HTMLInputElement>(null);

  const [scanMode, setScanMode] = useState<'scanner' | 'manual'>('scanner');
  const [scanInput, setScanInput] = useState('');
  const [lines, setLines] = useState<PickingLineState[]>([]);
  const [lastScanResult, setLastScanResult] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);

  // Initialize lines when request changes
  useEffect(() => {
    if (request && isOpen) {
      setLines(
        request.items.map(item => ({
          sku: item.sku,
          description: item.description,
          quantityRequested: item.quantityRequested,
          quantityChecked: 0,
          isComplete: false,
          manualCheck: false,
          stockItemIds: (item.stockItemIds || []).map((id: any) => String(id)),
        }))
      );
      setLastScanResult(null);
      setScanInput('');
    }
  }, [request, isOpen]);

  // Auto-focus scanner input
  useEffect(() => {
    if (isOpen && scanMode === 'scanner' && scanInputRef.current) {
      const timer = setTimeout(() => scanInputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, scanMode]);

  const allComplete = useMemo(() => lines.length > 0 && lines.every(l => l.isComplete), [lines]);

  const progress = useMemo(() => {
    if (lines.length === 0) return 0;
    const completed = lines.filter(l => l.isComplete).length;
    return Math.round((completed / lines.length) * 100);
  }, [lines]);

  const handleScan = useCallback(
    async (scannedCode: string) => {
      const code = scannedCode.trim();
      setScanInput('');
      if (!code) return;

      if (code.toUpperCase().startsWith('PAL-')) {
        try {
          const reqId = request?.id || (request as any)?._id;
          if (!reqId) {
             console.error('[Picking] Request ID missing', request);
             setLastScanResult({ type: 'error', message: 'Erro interno: ID do pedido não encontrado.' });
             return;
          }
          const res = await authFetch(`/api/stock/pallets/${code}?expeditionId=${reqId}`);
          if (!res.ok) {
            setLastScanResult({ type: 'error', message: `Erro ao buscar palete ${code}.` });
            return;
          }
          const palletItems = await res.json();
          
          if (palletItems.length === 0) {
            setLastScanResult({ type: 'warning', message: `Palete ${code} vazio ou não encontrado.` });
            return;
          }

          setLines(prev => {
            const updated = [...prev];
            let foundAny = false;
            let allAlreadyComplete = false;
            let matchedCount = 0;

            palletItems.forEach((pItem: any) => {
              const pItemSku = String(pItem.sku || '').toLowerCase();
              const pItemId = String(pItem._id);
              let remainingQty = Number(pItem.effectiveQuantity ?? pItem.quantity) || 0;
              
              // 1. Exact match by stockItemId
              const exactLineIndex = updated.findIndex(l => 
                l.stockItemIds?.includes(pItemId) && !l.isComplete
              );

              if (exactLineIndex !== -1) {
                matchedCount++;
                const line = { ...updated[exactLineIndex] };
                const needed = line.quantityRequested - line.quantityChecked;
                const toAdd = Math.min(needed, remainingQty);
                
                if (toAdd > 0) {
                  line.quantityChecked += toAdd;
                  if (line.quantityChecked >= line.quantityRequested) {
                    line.isComplete = true;
                  }
                  updated[exactLineIndex] = line;
                  remainingQty -= toAdd;
                  foundAny = true;
                }
              }

              // 2. Fallback: distribute remaining quantity across other lines of same SKU
              if (remainingQty > 0) {
                for (let i = 0; i < updated.length; i++) {
                  if (remainingQty <= 0) break;
                  
                  if (String(updated[i].sku || '').toLowerCase() === pItemSku && !updated[i].isComplete) {
                    matchedCount++;
                    const line = { ...updated[i] };
                    const needed = line.quantityRequested - line.quantityChecked;
                    const toAdd = Math.min(needed, remainingQty);
                    
                    if (toAdd > 0) {
                      line.quantityChecked += toAdd;
                      if (line.quantityChecked >= line.quantityRequested) {
                        line.isComplete = true;
                      }
                      updated[i] = line;
                      remainingQty -= toAdd;
                      foundAny = true;
                    }
                  }
                }
              }

              // Track if we matched the SKU at all for feedback
              if (!foundAny) {
                const anyMatch = updated.some(l => String(l.sku || '').toLowerCase() === pItemSku);
                if (anyMatch) matchedCount++;
              }
            });

            // If we matched SKUs but didn't add any, all matched lines were already complete
            if (matchedCount > 0 && !foundAny) {
              allAlreadyComplete = true;
            }

            if (foundAny) {
              setLastScanResult({ type: 'success', message: `✓ Palete ${code} lido: Volumes baixados com sucesso.` });
            } else if (allAlreadyComplete) {
              setLastScanResult({ type: 'warning', message: `Palete ${code}: Os itens deste palete já foram totalmente conferidos.` });
            } else {
              setLastScanResult({ type: 'warning', message: `Palete ${code} não contém itens pendentes para esta expedição.` });
            }
            return updated;
          });
        } catch (e) {
          setLastScanResult({ type: 'error', message: `Falha ao processar palete ${code}.` });
        }
        return;
      }

      // Logic for single SKU scanning
      setLines(prev => {
        const lineIndex = prev.findIndex(
          l => String(l.sku || '').toLowerCase() === String(code || '').toLowerCase() && !l.isComplete
        );

        if (lineIndex === -1) {
          // Check if it's already complete
          const completedLine = prev.find(
            l => String(l.sku || '').toLowerCase() === String(code || '').toLowerCase() && l.isComplete
          );

          if (completedLine) {
            setLastScanResult({
              type: 'warning',
              message: `SKU "${code}" já foi totalmente conferido.`,
            });
          } else {
            setLastScanResult({
              type: 'error',
              message: `SKU "${code}" não encontrado na lista de separação.`,
            });
          }
          return prev;
        }

        const updated = [...prev];
        const line = { ...updated[lineIndex] };
        line.quantityChecked += 1;
        if (line.quantityChecked >= line.quantityRequested) {
          line.isComplete = true;
        }
        updated[lineIndex] = line;
        
        setLastScanResult({
          type: 'success',
          message: `✓ ${code} — ${line.description}`,
        });

        return updated;
      });
    },
    [request]
  );

  const handleScanKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleScan(scanInput);
    }
  };

  const handleManualToggle = (index: number) => {
    setLines(prev => {
      const updated = [...prev];
      const line = { ...updated[index] };
      line.manualCheck = !line.manualCheck;
      line.isComplete = line.manualCheck;
      line.quantityChecked = line.manualCheck ? line.quantityRequested : 0;
      updated[index] = line;
      return updated;
    });
  };

  const handleConfirmExpedition = async () => {
    if (!request || !allComplete) return;
    await onConfirm(request.id);
  };

  if (!request) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanBarcode className="h-5 w-5 text-primary" />
            Conferência de Separação
          </DialogTitle>
          <DialogDescription>
            NF: <strong>{request.fractionalNfNumber}</strong> — Cliente:{' '}
            <strong>{request.clientName}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="flex gap-2">
          <Button
            variant={scanMode === 'scanner' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setScanMode('scanner')}
            className="gap-1.5"
          >
            <ScanBarcode className="h-3.5 w-3.5" />
            Scanner
          </Button>
          <Button
            variant={scanMode === 'manual' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setScanMode('manual')}
            className="gap-1.5"
          >
            <Keyboard className="h-3.5 w-3.5" />
            Sem Scanner
          </Button>
        </div>

        {/* Scanner input */}
        {scanMode === 'scanner' && (
          <div className="space-y-2">
            <div className="relative">
              <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={scanInputRef}
                value={scanInput}
                onChange={e => setScanInput(e.target.value)}
                onKeyDown={handleScanKeyDown}
                placeholder="Escaneie ou digite o código do item..."
                className="pl-9 text-lg font-mono h-12"
                autoComplete="off"
                autoFocus
              />
            </div>
            {lastScanResult && (
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium animate-in fade-in duration-200 ${
                  lastScanResult.type === 'success'
                    ? 'bg-green-500/10 text-green-600 border border-green-500/20'
                    : lastScanResult.type === 'error'
                    ? 'bg-red-500/10 text-red-600 border border-red-500/20'
                    : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                }`}
              >
                {lastScanResult.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                ) : lastScanResult.type === 'error' ? (
                  <XCircle className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                )}
                {lastScanResult.message}
              </div>
            )}
          </div>
        )}

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progresso da conferência</span>
            <span className="font-bold">{progress}%</span>
          </div>
          <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                allComplete ? 'bg-green-500' : 'bg-primary'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <Separator />

        {/* Items checklist */}
        <ScrollArea className="max-h-[40vh]">
          <div className="space-y-2 pr-4">
            {lines.map((line, index) => (
              <div
                key={`${line.sku}-${index}`}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 ${
                  line.isComplete
                    ? 'bg-green-500/5 border-green-500/30'
                    : 'bg-card border-border hover:border-primary/30'
                }`}
              >
                {/* Manual mode checkbox */}
                {scanMode === 'manual' && (
                  <Checkbox
                    checked={line.manualCheck}
                    onCheckedChange={() => handleManualToggle(index)}
                  />
                )}

                {/* Status icon */}
                <div className="flex-shrink-0">
                  {line.isComplete ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <Package className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>

                {/* Item info */}
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{line.sku}</span>
                    {line.isComplete && (
                      <Badge variant="default" className="bg-green-600 text-[10px] h-4">
                        Conferido
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium truncate">{line.description}</p>
                </div>

                {/* Quantity counter */}
                <div className="flex-shrink-0 text-right">
                  <div
                    className={`text-lg font-bold tabular-nums ${
                      line.isComplete ? 'text-green-600' : 'text-foreground'
                    }`}
                  >
                    {line.quantityChecked}/{line.quantityRequested}
                  </div>
                  <span className="text-[10px] text-muted-foreground">conferidos</span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button
            onClick={handleConfirmExpedition}
            disabled={!allComplete || isSubmitting}
            className={allComplete ? 'bg-green-600 hover:bg-green-700' : ''}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            {allComplete ? 'Confirmar Expedição' : `Faltam ${lines.filter(l => !l.isComplete).length} item(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
