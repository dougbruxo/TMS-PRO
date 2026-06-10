"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileText, Send, AlertCircle, Info, UserSearch, UserPlus } from 'lucide-react';
import { authFetch } from '@/lib/api-client';
import type { Quote, Driver, FleetVehicle } from '@/lib/types';
import { QuoteCard } from './QuoteCard';
import { DriverManagement } from './DriverManagement';

interface QuickCteDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  quote: Quote | null;
  drivers: Driver[];
  onSuccess: () => void;
}

export function QuickCteDialog({ isOpen, onOpenChange, quote, drivers, onSuccess }: QuickCteDialogProps) {
  const { toast } = useToast();
  const [fleet, setFleet] = useState<FleetVehicle[]>([]);
  const [isLoadingFleet, setIsLoadingFleet] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [nfeKey, setNfeKey] = useState('');

  // Driver search & management states
  const [isDriverSearchOpen, setIsDriverSearchOpen] = useState(false);
  const [isAddDriverDialogOpen, setIsAddDriverDialogOpen] = useState(false);
  const [driverSearchTerm, setDriverSearchTerm] = useState('');
  const [searchedDrivers, setSearchedDrivers] = useState<Driver[]>([]);
  const [isSearchingDrivers, setIsSearchingDrivers] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const selectedDriverName = useMemo(() => {
    if (selectedDriver) return selectedDriver.name;
    if (!selectedDriverId) return '';
    const d = drivers.find(drv => drv.id === selectedDriverId || (drv as any)._id === selectedDriverId);
    return d?.name || '';
  }, [selectedDriverId, selectedDriver, drivers]);

  // Fetch physical fleet
  useEffect(() => {
    if (!isOpen) return;
    const fetchFleet = async () => {
      setIsLoadingFleet(true);
      try {
        const res = await authFetch('/api/fleet');
        if (res.ok) {
          const data = await res.json();
          setFleet(data);
        }
      } catch (e) {
        console.error("Erro ao carregar frota:", e);
      } finally {
        setIsLoadingFleet(false);
      }
    };
    fetchFleet();
  }, [isOpen]);

  // Pre-populate fields when quote changes or modal opens
  useEffect(() => {
    if (!quote || !isOpen) return;

    // 1. Encontrar o último motorista atribuído na cotação
    const lastDriverEvent = [...(quote.operationalHistory || [])]
      .reverse()
      .find(e => e.driverId);
    
    const initialDriverId = lastDriverEvent?.driverId || (quote.driverId ? String(quote.driverId) : '');
    setSelectedDriverId(initialDriverId);

    if (initialDriverId) {
      const driverObj = drivers.find(d => d.id === initialDriverId || (d as any)._id === initialDriverId);
      if (driverObj) {
        setSelectedDriver(driverObj);
      }
    } else {
      setSelectedDriver(null);
    }

    // 2. Chave NF-e
    const cleanKey = (quote.nfeChave || '').replace(/\D/g, '');
    setNfeKey(cleanKey.length === 44 ? cleanKey : '');
    setSelectedVehicleId('');
  }, [quote, isOpen, drivers]);

  // Driver search helper methods
  const searchDrivers = useCallback(async (term: string) => {
    if (term.length < 2) {
      setSearchedDrivers([]);
      return;
    }
    setIsSearchingDrivers(true);
    try {
      const response = await authFetch(`/api/drivers/search?term=${encodeURIComponent(term)}`);
      if (response.ok) {
        setSearchedDrivers(await response.json());
      } else {
        setSearchedDrivers([]);
      }
    } catch (error: any) {
      console.error("Failed to search for drivers:", error);
      toast({ variant: 'destructive', title: 'Erro de Busca', description: 'Não foi possível buscar os motoristas.' });
    } finally {
      setIsSearchingDrivers(false);
    }
  }, [toast]);

  const handleDriverSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const term = event.target.value;
    setDriverSearchTerm(term);

    if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
        searchDrivers(term);
    }, 500); // Debounce de 500ms
  };

  const handleSelectDriver = (driver: Driver) => {
    setSelectedDriver(driver);
    setSelectedDriverId(driver.id || (driver as any)._id);
    setIsDriverSearchOpen(false);
    setDriverSearchTerm('');
    setSearchedDrivers([]);
  };

  // Auto-select vehicle based on selected driver's main vehicle
  useEffect(() => {
    if (!selectedDriverId || fleet.length === 0) {
      setSelectedVehicleId('');
      return;
    }

    const driverObj = (selectedDriver && (selectedDriver.id === selectedDriverId || (selectedDriver as any)._id === selectedDriverId))
      ? selectedDriver
      : drivers.find(d => d.id === selectedDriverId || (d as any)._id === selectedDriverId);

    if (driverObj?.mainVehicleId) {
      const vehicleExists = fleet.some(v => v.id === driverObj.mainVehicleId || (v as any)._id === driverObj.mainVehicleId);
      if (vehicleExists) {
        setSelectedVehicleId(driverObj.mainVehicleId);
      } else {
        setSelectedVehicleId('');
      }
    } else {
      setSelectedVehicleId('');
    }
  }, [selectedDriverId, fleet, drivers, selectedDriver]);

  if (!quote) return null;

  // Extrair UF para cálculo de CFOP
  const getUfFromCity = (cityStr?: string) => {
    if (!cityStr) return '';
    const parts = cityStr.split(',');
    if (parts.length > 1) return parts[parts.length - 1].trim().toUpperCase();
    const partsHyphen = cityStr.split('-');
    if (partsHyphen.length > 1) return partsHyphen[partsHyphen.length - 1].trim().toUpperCase();
    return '';
  };

  const ufOrigem = getUfFromCity(quote.cidadeOrigem);
  const ufDestino = getUfFromCity(quote.cidadeDestino);
  const isInterstate = ufOrigem && ufDestino ? ufOrigem !== ufDestino : false;
  const cfop = isInterstate ? '6352' : '5352';

  const handleEmit = async () => {
    if (!nfeKey || nfeKey.length !== 44) {
      toast({
        variant: 'destructive',
        title: 'Chave NF-e Inválida',
        description: 'A chave da NF-e vinculada é obrigatória e deve conter 44 dígitos.'
      });
      return;
    }

    if (!selectedDriverId) {
      toast({
        variant: 'destructive',
        title: 'Motorista Obrigatório',
        description: 'Selecione um motorista para realizar a prestação do serviço.'
      });
      return;
    }

    if (!selectedVehicleId) {
      toast({
        variant: 'destructive',
        title: 'Veículo Obrigatório',
        description: 'Selecione um veículo da frota com placa, ANTT e RENAVAM válidos.'
      });
      return;
    }

    const vehicleObj = fleet.find(v => v.id === selectedVehicleId || (v as any)._id === selectedVehicleId);
    if (vehicleObj && (!vehicleObj.antt || !vehicleObj.renavam)) {
      toast({
        variant: 'destructive',
        title: 'Veículo Incompleto',
        description: 'O veículo selecionado precisa ter ANTT e RENAVAM cadastrados.'
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        quoteId: quote.id,
        naturezaOperacao: isInterstate 
          ? "Prestação de serviço de transporte interestadual" 
          : "Prestação de serviço de transporte intermunicipal",
        cfop,
        serie: 1,
        tpCTe: 0,
        tpServ: 0,
        remetenteId: quote.remetenteId,
        destinatarioId: quote.destinatarioId,
        tomadorId: quote.tomadorId || quote.remetenteId,
        condutorId: selectedDriverId,
        veiculoId: selectedVehicleId,
        valorTotal: quote.valorFinal,
        valorReceber: quote.valorFinal,
        nfeKey: nfeKey.replace(/\D/g, ''),
        valorProdutos: quote.valorProduto || 0,
        valorNota: quote.valorProduto || 0,
        peso: quote.peso || 1,
        produtoPredominante: "DIVERSOS",
        especieCarga: "VOLUMES",
        quantidadeVolumes: quote.volumeCount || quote.quantidade || 1,
        cstIbsCbs: "00",
        aliquotaIbs: 0,
        aliquotaCbs: 0,
        observacoes: quote.obs || ""
      };

      const response = await authFetch('/api/nfe/cte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Erro desconhecido ao emitir CT-e.');
      }

      toast({
        title: 'CT-e Emitido com Sucesso!',
        description: `O CT-e nº ${result.numeroCte || ''} foi autorizado pela SEFAZ.`,
        action: result.pdfUrl ? (
          <Button size="sm" onClick={() => window.open(result.pdfUrl, '_blank')}>
            DACTE
          </Button>
        ) : undefined
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Erro na Emissão',
        description: error.message || 'Não foi possível processar a emissão do CT-e.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border border-border/40 bg-card/95 backdrop-blur-2xl shadow-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <FileText className="h-5 w-5 text-primary" />
            Emissão Rápida de CT-e (1-Clique)
          </DialogTitle>
          <DialogDescription>
            Confirme as informações abaixo para emitir o CT-e vinculado à cotação <strong>{quote.quoteCode}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2">
          {/* Informações da Cotação */}
          <div className="p-3 bg-muted/40 rounded-xl space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rota:</span>
              <span className="font-semibold">{quote.cidadeOrigem} &rarr; {quote.cidadeDestino}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">CFOP Sugerido:</span>
              <span className="font-semibold text-primary">{cfop}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor do Frete:</span>
              <span className="font-bold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(quote.valorFinal)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Peso / Volumes:</span>
              <span className="font-semibold">{quote.peso || 1} kg / {quote.volumeCount || quote.quantidade || 1} vol</span>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="nfe-key">Chave de Acesso da NF-e (44 dígitos)</Label>
              <Input
                id="nfe-key"
                placeholder="00000000000000000000000000000000000000000000"
                maxLength={44}
                value={nfeKey}
                onChange={e => setNfeKey(e.target.value.replace(/\D/g, ''))}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="quick-driver">Motorista / Condutor</Label>
              <div className="flex gap-2">
                <Input
                  id="quick-driver"
                  readOnly
                  value={selectedDriverName}
                  placeholder="Nenhum motorista selecionado"
                  className="flex-grow"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon" 
                  onClick={() => setIsDriverSearchOpen(true)}
                  disabled={isSubmitting}
                >
                  <UserSearch className="h-4 w-4"/>
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon" 
                  onClick={() => setIsAddDriverDialogOpen(true)}
                  disabled={isSubmitting}
                >
                  <UserPlus className="h-4 w-4"/>
                </Button>
              </div>
            </div>

            {selectedVehicleId ? (
              (() => {
                const v = fleet.find(item => item.id === selectedVehicleId || (item as any)._id === selectedVehicleId);
                if (v) {
                  return (
                    <div className="p-3 bg-muted/40 rounded-xl text-xs space-y-1 mt-1 border border-border/50">
                      <span className="text-muted-foreground uppercase text-[10px] font-semibold block">Veículo Vinculado</span>
                      <span className="font-semibold text-foreground">{v.plate} - {v.brand} {v.model} ({v.type})</span>
                      {(!v.antt || !v.renavam) && (
                        <p className="text-[11px] text-destructive flex items-center gap-1 mt-1 font-medium">
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          Aviso: Veículo sem ANTT ou RENAVAM cadastrado!
                        </p>
                      )}
                    </div>
                  );
                }
                return null;
              })()
            ) : (
              selectedDriverId && (
                <div className="p-3 bg-destructive/10 text-destructive rounded-xl text-xs mt-1 border border-destructive/20 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Nenhum Veículo Vinculado</span>
                    <span>Este motorista não possui nenhum veículo padrão vinculado em /drivers! Por favor, vincule-o no cadastro.</span>
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleEmit} disabled={isSubmitting} className="bg-primary hover:bg-primary/90">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Transmitindo SEFAZ...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Emitir CT-e (1-Clique)
              </>
            )}
          </Button>
        </DialogFooter>

        <QuoteCard.DriverSearchDialog
          isOpen={isDriverSearchOpen}
          onOpenChange={setIsDriverSearchOpen}
          drivers={searchedDrivers}
          isLoading={isSearchingDrivers}
          onSelectDriver={handleSelectDriver}
          searchTerm={driverSearchTerm}
          onSearchTermChange={handleDriverSearchChange}
        />
        
        <Dialog open={isAddDriverDialogOpen} onOpenChange={setIsAddDriverDialogOpen}>
          <DialogContent className="max-w-7xl h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Gerenciar Motoristas</DialogTitle>
              <DialogDescription>Adicione ou edite um motorista. As alterações serão refletidas nesta tela.</DialogDescription>
            </DialogHeader>
            <div className="flex-grow overflow-y-auto">
              <DriverManagement />
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
