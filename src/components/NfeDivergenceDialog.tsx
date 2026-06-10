"use client";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, Building2, ShieldCheck, Scale, Boxes } from 'lucide-react';
import { useState, useEffect } from 'react';

export interface NfeDivergenceData {
  quoteWeight: number;
  quoteVolumes: number;
  nfeWeight: number;
  nfeVolumes: number;
  xmlContent: string;
  nfeParties?: {
    emitente?: { name: string; cnpjCpf: string; address?: string };
    destinatario?: { name: string; cnpjCpf: string; address?: string };
    tomador?: { name: string; cnpjCpf: string; address?: string };
  };
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
      icon: Icon,
      quoteValue, 
      nfeValue, 
      isDivergent, 
      selectedSource, 
      onSelect 
  }: { 
      title: string, 
      icon: any,
      quoteValue: number, 
      nfeValue: number, 
      isDivergent: boolean,
      selectedSource: 'quote' | 'nfe',
      onSelect: (source: 'quote' | 'nfe') => void
  }) => {
      if (!isDivergent) {
          return (
              <div className="border border-border/40 rounded-lg p-4 bg-muted/20 backdrop-blur-md">
                  <div className="flex items-center gap-2 mb-2 text-green-600 dark:text-green-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="font-semibold text-sm">{title} (Consistente)</span>
                  </div>
                  <p className="text-sm font-medium">Valor correspondente: <span className="font-mono text-base font-bold">{quoteValue}</span></p>
              </div>
          );
      }

      return (
          <div className="border border-amber-200/50 bg-amber-50/20 dark:border-amber-900/30 dark:bg-amber-950/10 rounded-lg p-4 backdrop-blur-md">
              <div className="flex items-center gap-2 mb-3 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-semibold text-sm">{title} (Divergente)</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                  <div 
                      className={`cursor-pointer border rounded-md p-3 transition-all ${selectedSource === 'quote' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50'}`}
                      onClick={() => onSelect('quote')}
                  >
                      <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Gravado na Cotação</p>
                      <p className="font-mono text-lg font-semibold">{quoteValue}</p>
                  </div>
                  <div 
                      className={`cursor-pointer border rounded-md p-3 transition-all ${selectedSource === 'nfe' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50'}`}
                      onClick={() => onSelect('nfe')}
                  >
                      <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Lido da NF-e (XML)</p>
                      <p className="font-mono text-lg font-semibold">{nfeValue}</p>
                  </div>
              </div>
          </div>
      );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border border-border/50 backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary font-bold text-xl">
            <ShieldCheck className="h-6 w-6 text-green-600 animate-pulse" />
            Conferência e Confirmação de NF-e (XML)
          </DialogTitle>
          <DialogDescription className="text-muted-foreground mt-1">
            Por favor, revise atentamente as informações fiscais lidas da Nota Fiscal Eletrônica antes de confirmar a exportação. Esta confirmação atualizará a cotação e a cobrança correspondente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-1">
           {/* Seção Tomador do Serviço */}
           {data.nfeParties?.tomador && (
               <div className="border border-blue-200/60 bg-blue-50/20 dark:border-blue-900/40 dark:bg-blue-950/25 rounded-lg p-4 transition-all">
                   <div className="flex items-center gap-2 mb-2 text-blue-700 dark:text-blue-400">
                       <Building2 className="h-5 w-5" />
                       <span className="font-bold text-sm tracking-wide">Tomador do Serviço (Payer de Cobrança)</span>
                   </div>
                   <div className="space-y-1">
                       <p className="text-sm font-semibold">{data.nfeParties.tomador.name}</p>
                       <p className="text-xs text-muted-foreground">CNPJ/CPF: <span className="font-mono">{data.nfeParties.tomador.cnpjCpf}</span></p>
                       {data.nfeParties.tomador.address && (
                           <p className="text-xs text-muted-foreground truncate">Endereço: {data.nfeParties.tomador.address}</p>
                       )}
                   </div>
                   <div className="mt-3 p-2 bg-green-500/10 dark:bg-green-500/5 border border-green-500/20 rounded-md">
                       <p className="text-[11px] text-green-700 dark:text-green-400 font-medium">
                         ✓ A cotação e a cobrança vinculada serão associadas a esta empresa na base de dados de clientes (/customers).
                       </p>
                   </div>
               </div>
           )}

           {/* Seção Peso */}
           <SelectionBox 
               title="Peso Físico (Kg)" 
               icon={Scale}
               quoteValue={data.quoteWeight} 
               nfeValue={data.nfeWeight} 
               isDivergent={hasWeightDivergence} 
               selectedSource={selectedWeightSource}
               onSelect={setSelectedWeightSource}
           />

           {/* Seção Volumes */}
           <SelectionBox 
               title="Quantidade de Volumes" 
               icon={Boxes}
               quoteValue={data.quoteVolumes} 
               nfeValue={data.nfeVolumes} 
               isDivergent={hasVolumeDivergence} 
               selectedSource={selectedVolumeSource}
               onSelect={setSelectedVolumeSource}
           />
        </div>

        <DialogFooter className="border-t border-border/20 pt-4 flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-lg">
            Cancelar Importação
          </Button>
          <Button onClick={handleConfirm} className="bg-green-600 hover:bg-green-700 text-white rounded-lg flex gap-1.5 items-center">
            <CheckCircle2 className="h-4 w-4" />
            Confirmar e Exportar XML
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
