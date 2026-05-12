"use client";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useState, useEffect } from 'react';

export interface NfeDivergenceData {
  quoteWeight: number;
  quoteVolumes: number;
  nfeWeight: number;
  nfeVolumes: number;
  xmlContent: string;
}

interface NfeDivergenceDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  data: NfeDivergenceData | null;
  onConfirm: (finalWeight: number, finalVolumes: number, xmlContent: string) => void;
}

export function NfeDivergenceDialog({ isOpen, onOpenChange, data, onConfirm }: NfeDivergenceDialogProps) {
  const [selectedWeightSource, setSelectedWeightSource] = useState<'quote' | 'nfe'>('nfe');
  const [selectedVolumeSource, setSelectedVolumeSource] = useState<'quote' | 'nfe'>('nfe');

  useEffect(() => {
     if (isOpen) {
         setSelectedWeightSource('nfe');
         setSelectedVolumeSource('nfe');
     }
  }, [isOpen]);

  if (!data) return null;

  const hasWeightDivergence = data.quoteWeight !== data.nfeWeight;
  const hasVolumeDivergence = data.quoteVolumes !== data.nfeVolumes;

  const handleConfirm = () => {
      const finalWeight = selectedWeightSource === 'quote' ? data.quoteWeight : data.nfeWeight;
      const finalVolumes = selectedVolumeSource === 'quote' ? data.quoteVolumes : data.nfeVolumes;
      onConfirm(finalWeight, finalVolumes, data.xmlContent);
  };

  const SelectionBox = ({ 
      title, 
      quoteValue, 
      nfeValue, 
      isDivergent, 
      selectedSource, 
      onSelect 
  }: { 
      title: string, 
      quoteValue: number, 
      nfeValue: number, 
      isDivergent: boolean,
      selectedSource: 'quote' | 'nfe',
      onSelect: (source: 'quote' | 'nfe') => void
  }) => {
      if (!isDivergent) {
          return (
              <div className="border rounded-md p-4 bg-muted/30">
                  <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="font-semibold text-sm">{title} (Consistente)</span>
                  </div>
                  <p className="text-sm font-medium">Valor único: {quoteValue}</p>
              </div>
          );
      }

      return (
          <div className="border border-amber-200 bg-amber-50/30 rounded-md p-4">
              <div className="flex items-center gap-2 mb-3 text-amber-700">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-semibold text-sm">{title} (Divergente)</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                  <div 
                      className={`cursor-pointer border rounded-md p-3 transition-colors ${selectedSource === 'quote' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50'}`}
                      onClick={() => onSelect('quote')}
                  >
                      <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Gravado na Cotação</p>
                      <p className="font-mono text-lg font-semibold">{quoteValue}</p>
                  </div>
                  <div 
                      className={`cursor-pointer border rounded-md p-3 transition-colors ${selectedSource === 'nfe' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50'}`}
                      onClick={() => onSelect('nfe')}
                  >
                      <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Lido da NF-e (XML)</p>
                      <p className="font-mono text-lg font-semibold">{nfeValue}</p>
                  </div>
              </div>
          </div>
      );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Divergência de Dados Detectada
          </DialogTitle>
          <DialogDescription>
            Encontramos diferenças entre o que foi negociado inicialmente na Cotação e o que consta oficialmente no arquivo da Nota Fiscal (XML). 
            Por favor, decida quais informações prevalecerão para seguir viagem:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
           {hasWeightDivergence ? (
               <SelectionBox 
                   title="Peso Físico (Kg)" 
                   quoteValue={data.quoteWeight} 
                   nfeValue={data.nfeWeight} 
                   isDivergent={true} 
                   selectedSource={selectedWeightSource}
                   onSelect={setSelectedWeightSource}
               />
           ) : null}

           {hasVolumeDivergence ? (
               <SelectionBox 
                   title="Quantidade de Volumes" 
                   quoteValue={data.quoteVolumes} 
                   nfeValue={data.nfeVolumes} 
                   isDivergent={true} 
                   selectedSource={selectedVolumeSource}
                   onSelect={setSelectedVolumeSource}
               />
           ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar Upload
          </Button>
          <Button onClick={handleConfirm} className="gap-2">
            Confirmar e Anexar XML
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
