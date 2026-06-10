"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { CompanyManagement } from '@/components/CompanyManagement';
import { DriverManagement } from '@/components/DriverManagement';
import { FleetManagement } from '@/components/FleetManagement';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import type { Quote, Company, Driver, FleetVehicle } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, Check, Pencil, Upload, Building2, User, Truck, FileText, ArrowLeft, Send, ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import { authFetch } from '@/lib/api-client';
import { XmlPreviewDialog } from '@/components/XmlPreviewDialog';
import { parseNfeXml, ParsedNfeData } from '@/lib/xml-parser';
import { NfeAttachmentDialog } from '@/components/NfeAttachmentDialog';
import { SefazStatusIndicator } from '@/components/SefazStatusIndicator';
import { PageHeader } from '@/components/PageHeader';

const NATUREZAS_OPERACAO = [
  "Prestação de serviço de transporte interestadual",
  "Prestação de serviço de transporte intermunicipal",
  "Prestação de serviço de transporte a estabelecimento industrial",
  "Prestação de serviço de transporte a estabelecimento comercial",
  "Subcontratação de serviço de transporte",
  "Redespacho",
  "Redespacho Intermediário",
  "Anulação de valores de prestação de serviço de transporte",
  "Prestação de serviço de transporte de mercadoria dispensada de nota fiscal",
  "Complemento de valor"
];

const cteFormSchema = z.object({
  quoteId: z.string().optional(),
  naturezaOperacao: z.string().min(1, "Natureza da operação é obrigatória."),
  cfop: z.string().min(4, "CFOP deve ter 4 dígitos.").max(4, "CFOP deve ter 4 dígitos."),
  serie: z.coerce.number().min(0).optional(),

  // Modos de emissão
  tpCTe: z.coerce.number().optional(),
  tpServ: z.coerce.number().optional(),

  remetenteId: z.string().min(1, "Selecione um remetente."),
  destinatarioId: z.string().min(1, "Selecione um destinatário."),
  tomadorId: z.string().min(1, "Selecione o tomador do serviço."),
  tomadorIE: z.string().optional(),
  remetenteIE: z.string().optional(),
  destinatarioIE: z.string().optional(),
  
  condutorId: z.string().optional(),
  veiculoId: z.string().optional(),
  
  valorTotal: z.coerce.number().min(0.01, "Valor do serviço é obrigatório."),
  valorReceber: z.coerce.number().min(0.01, "Valor a receber é obrigatório."),
  
  nfeKey: z.string().length(44, "A chave da NF-e deve ter 44 dígitos."),
  valorProdutos: z.coerce.number(),
  valorNota: z.coerce.number().optional(),
  peso: z.coerce.number(),
  
  produtoPredominante: z.string().min(1, "Produto predominante é obrigatório."),
  especieCarga: z.string().optional(),
  quantidadeVolumes: z.coerce.number().min(1, "Quantidade de volumes é obrigatória."),

  cstIbsCbs: z.string().optional(),
  aliquotaIbs: z.coerce.number().optional(),
  aliquotaCbs: z.coerce.number().optional(),
  observacoes: z.string().max(2000, "Máximo de 2000 caracteres.").optional(),
});

type CteFormData = z.infer<typeof cteFormSchema>;


const AsyncSearchableCombobox = ({
  value,
  defaultLabel,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  renderOption,
  fetchUrl,
  displayKey,
  disabled,
  onEdit,
}: {
  value: string;
  defaultLabel?: React.ReactNode;
  onChange: (id: string, opt?: any) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  renderOption: (option: any) => React.ReactNode;
  fetchUrl: string;
  displayKey: string;
  disabled?: boolean;
  onEdit?: (id: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
      // Sem digitação mínima, mantemos apenas a opção já selecionada se existir, ou vazio
      if (searchTerm.trim().length < 2) {
          setOptions(prev => prev.filter(p => p.id === value));
          return;
      }
      
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      
      setIsLoading(true);
      searchTimeoutRef.current = setTimeout(async () => {
          try {
              const res = await authFetch(`${fetchUrl}?term=${encodeURIComponent(searchTerm)}&limit=20`);
              if (res.ok) {
                  const data = await res.json();
                  setOptions(prev => {
                      const ids = new Set(data.map((d: any) => d.id));
                      const kept = prev.filter(p => !ids.has(p.id) && p.id === value);
                      return [...kept, ...data];
                  });
              }
          } catch(e) {
              console.error("Failed to fetch options:", e);
          } finally { setIsLoading(false); }
      }, 500);
      
      return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [searchTerm, fetchUrl, value]);

  const selectedOption = options.find(opt => opt.id === value);
  const currentLabel = selectedOption 
    ? (selectedOption.label || selectedOption.name || selectedOption.razaoSocial || selectedOption.plate) 
    : (defaultLabel || placeholder);

  return (
    <div className="flex items-center gap-2 w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between", !value && "text-muted-foreground")}
            disabled={disabled}
          >
            <div className="flex items-center gap-2 overflow-hidden">
               <Search className="h-4 w-4 shrink-0 opacity-50" />
               <span className="truncate">
                {value ? currentLabel : placeholder}
               </span>
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={searchPlaceholder}
              value={searchTerm}
              onValueChange={setSearchTerm}
            />
            <CommandList>
              {isLoading && <div className="p-4 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mx-auto mb-2"/>Buscando...</div>}
              {!isLoading && searchTerm.length < 2 && <div className="p-4 text-center text-sm text-muted-foreground">Digite pelo menos 2 caracteres para buscar.</div>}
              {!isLoading && searchTerm.length >= 2 && options.length === 0 && (
                <CommandEmpty>{emptyText}</CommandEmpty>
              )}
              {options.length > 0 && (
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem
                      key={option.id}
                      value={option.id}
                      onSelect={() => {
                        onChange(option.id, option);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === option.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col flex-1">
                        <span className="font-semibold">{option.label || option.name || option.razaoSocial || option.plate}</span>
                        {option.subLabel && <span className="text-xs text-muted-foreground">{option.subLabel}</span>}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      {value && onEdit && (
        <Button 
          type="button" 
          variant="ghost" 
          size="icon" 
          onClick={(e) => {
            e.stopPropagation();
            onEdit(value);
          }}
          className="h-9 w-9 text-primary hover:bg-primary/10"
          title="Editar Dados"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};


export default function CtePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = searchParams.get('draftId');
  const { toast } = useToast();

  const [entityLabels, setEntityLabels] = useState<Record<string, string>>({});
  const [quickEditTarget, setQuickEditTarget] = useState<{ type: 'customer' | 'driver' | 'fleet' | null, id: string | null }>({ type: null, id: null });
  const [cargoTypes, setCargoTypes] = useState<string[]>([]);
  const [showNewCargoTypeDialog, setShowNewCargoTypeDialog] = useState(false);
  const [pendingCteData, setPendingCteData] = useState<z.infer<typeof cteFormSchema> | null>(null);
  const [searchedQuotes, setSearchedQuotes] = useState<Quote[]>([]);
  const [isQuoteSearchOpen, setIsQuoteSearchOpen] = useState(false);
  const [quoteSearchTerm, setQuoteSearchTerm] = useState('');
  const [isSearchingQuotes, setIsSearchingQuotes] = useState(false);
  const [selectedQuoteObj, setSelectedQuoteObj] = useState<Quote | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [fiscalSettings, setFiscalSettings] = useState<any>(null);
  const [showTransport, setShowTransport] = useState(false);

  const [customerSearch, setCustomerSearch] = useState('');
  const [driverSearch, setDriverSearch] = useState('');
  const [cfops, setCfops] = useState<{id: string, code: string, description: string}[]>([]);

  // Custom XML preview states
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isNfeAttachmentOpen, setIsNfeAttachmentOpen] = useState(false);
  const [parsedXmlData, setParsedXmlData] = useState<ParsedNfeData | null>(null);
  const [pendingXmlText, setPendingXmlText] = useState<string | null>(null);

  const form = useForm<CteFormData>({
    resolver: zodResolver(cteFormSchema),
    defaultValues: {
      quoteId: "",
      naturezaOperacao: "",
      cfop: "",
      serie: 1,
      tpCTe: 0,
      tpServ: 0,
      remetenteId: "",
      destinatarioId: "",
      tomadorId: "",
      tomadorIE: "",
      condutorId: "",
      veiculoId: "",
      valorTotal: 0,
      valorReceber: 0,
      nfeKey: "",
      valorProdutos: 0,
      valorNota: 0,
      peso: 0,
      produtoPredominante: "DIVERSOS",
      especieCarga: "VOLUMES",
      quantidadeVolumes: 1,
      cstIbsCbs: "00",
      aliquotaIbs: 0.0,
      aliquotaCbs: 0.0,
      observacoes: "",
    }
  });

  const [maskedValorTotal, setMaskedValorTotal] = useState('R$ 0,00');
  const [maskedValorReceber, setMaskedValorReceber] = useState('R$ 0,00');
  const [maskedValorProdutos, setMaskedValorProdutos] = useState('R$ 0,00');
  const [maskedValorNota, setMaskedValorNota] = useState('R$ 0,00');

  const watchedCfop = form.watch('cfop');
  const watchedTpCTe = form.watch('tpCTe');
  const watchedTpServ = form.watch('tpServ');

  useEffect(() => {
    let natureza = form.getValues('naturezaOperacao') || "Prestação de serviço de transporte interestadual";
    
    if (watchedTpCTe === 1) {
      natureza = "Complemento de valor";
    } else if (watchedTpCTe === 2) {
      natureza = "Anulação de valores de prestação de serviço de transporte";
    } else if (watchedTpServ === 1) {
      natureza = "Subcontratação de serviço de transporte";
    } else if (watchedTpServ === 2) {
      natureza = "Redespacho";
    } else if (watchedTpServ === 3) {
      natureza = "Redespacho Intermediário";
    } else if (watchedCfop) {
      if (watchedCfop.startsWith('5')) {
        natureza = "Prestação de serviço de transporte intermunicipal";
      } else if (watchedCfop.startsWith('6')) {
        natureza = "Prestação de serviço de transporte interestadual";
      }
    }
    
    if (form.getValues('naturezaOperacao') !== natureza) {
      form.setValue('naturezaOperacao', natureza, { shouldValidate: true });
    }
  }, [watchedCfop, watchedTpCTe, watchedTpServ, form]);

  useEffect(() => {
    const fetchCargoTypes = async () => {
        try {
            const res = await authFetch('/api/settings/cargo-types');
            if (res.ok) {
                const data = await res.json();
                setCargoTypes(data.map((c: any) => (typeof c === 'string' ? c : (c.name || ''))));
            }
        } catch (e) {}
    };
    fetchCargoTypes();
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const [cfopsRes, fiscalRes] = await Promise.all([
        authFetch(`/api/settings/cfop`),
        authFetch(`/api/settings/fiscal`),
      ]);

      if (!cfopsRes.ok || !fiscalRes.ok) {
        throw new Error("Falha ao carregar dados para emissão de CT-e.");
      }
      setCfops(await cfopsRes.json());
      const fiscalData = await fiscalRes.json();
      setFiscalSettings(fiscalData);
      
      // Preencher os modos de emissão com os padrões do fiscal settings
      form.setValue('tpCTe', fiscalData.defaultTpCTe ?? 0);
      form.setValue('tpServ', fiscalData.defaultTpServ ?? 0);
      form.setValue('serie', fiscalData.defaultSerie ?? 1);
      
      // Se for uma emissão avulsa, já preencher os impostos padrão
      if (form.getValues('quoteId') === 'avulso') {
          form.setValue('aliquotaIbs', fiscalData.defaultIbsRate || 0);
          form.setValue('aliquotaCbs', fiscalData.defaultCbsRate || 0);
          form.setValue('cstIbsCbs', fiscalData.defaultCstIbsCbs || '00');
          form.setValue('naturezaOperacao', fiscalData.defaultNaturezaOperacao || 'PRESTACAO DE SERVICO DE TRANSPORTE');
      }
      
      if (draftId) {
          try {
              const draftRes = await authFetch(`/api/documents/${draftId}`);
              if (draftRes.ok) {
                  const draftData = await draftRes.json();
                  if (draftData && draftData.formData) {
                      form.reset(draftData.formData);
                      
                      // Ajustar MASCARAS manuais para refletirem os dados do formdata
                      setMaskedValorTotal(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(draftData.formData.valorTotal || 0));
                      setMaskedValorReceber(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(draftData.formData.valorReceber || 0));
                      setMaskedValorProdutos(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(draftData.formData.valorProdutos || 0));
                      setMaskedValorNota(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(draftData.formData.valorNota || 0));

                      if (draftData.formData.quoteId && draftData.formData.quoteId !== 'avulso') {
                           const qtRes = await authFetch(`/api/quotes?status=all_operational&term=${draftData.formData.quoteId}`);
                           if (qtRes.ok) {
                               const qtArr = await qtRes.json();
                               if (qtArr.length > 0) setSelectedQuoteObj(qtArr[0]);
                           }
                      }
                      toast({ title: 'Correção de Falha ✏️', description: 'Todos os seus dados rejeitados anteriormente foram recuperados e colados no formulário.' });
                  }
              }
          } catch(e) {
              console.error("Falha ao puxar Rascunho", e);
          }
      }
    } catch(e: any) {
      toast({ variant: 'destructive', title: 'Erro de Carregamento', description: e.message });
    } finally {
      setIsLoadingData(false);
    }
  }, [form, toast, draftId]);
  
  useEffect(() => {
    if (user?.operationalAccess) {
      fetchData();
    }
  }, [user, fetchData]);

  useEffect(() => {
      if (!isQuoteSearchOpen) return;
      
      if (quoteSearchTerm.trim().length < 2) {
          setSearchedQuotes([]);
          return;
      }

      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

      setIsSearchingQuotes(true);
      searchTimeoutRef.current = setTimeout(async () => {
          try {
              const res = await authFetch(`/api/quotes?status=all_operational&term=${quoteSearchTerm}&limit=10`);
              if (res.ok) setSearchedQuotes(await res.json());
          } catch (e) {
              console.error("Erro ao buscar cotações", e);
          } finally {
              setIsSearchingQuotes(false);
          }
      }, 500);

      return () => {
          if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      }
  }, [quoteSearchTerm, isQuoteSearchOpen]);

  const watchedQuoteId = form.watch('quoteId');

  const mapNfeToCteCfop = useCallback((nfeCfop?: string, tomador?: Company, isInterstate?: boolean) => {
    const isIsento = tomador?.inscricaoEstadual?.toUpperCase().trim() === 'ISENTO' || !tomador?.inscricaoEstadual;
    
    if (!nfeCfop) {
      if (isInterstate) return isIsento ? '6357' : '6352';
      return isIsento ? '5357' : '5352';
    }

    const nfePrefix = nfeCfop.charAt(0);
    
    // Internacional
    if (nfePrefix === '7' || nfePrefix === '3') return '7358';
    
    // Mapeamento Inteligente (Estadual / Interestadual)
    if (nfePrefix === '1' || nfePrefix === '2' || nfePrefix === '5') {
      return isIsento ? '5357' : '5352';
    }
    
    if (nfePrefix === '3' || nfePrefix === '6') {
      return isIsento ? '6357' : '6352';
    }
    
    return isInterstate ? '6352' : '5352';
  }, []);

  // Automatizar Natureza da Operação baseado no CFOP e Tipo de Serviço (lógica consolidada no useEffect acima - linha ~306)

  useEffect(() => {
    if (watchedQuoteId && watchedQuoteId !== 'avulso' && selectedQuoteObj) {
      const selectedQuote = selectedQuoteObj;
      if (selectedQuote) {
        const prepareQuoteData = async () => {
            let remetenteEstado = '';
            let destEstado = '';
            let tomadorIE = '';
            
            // Sync Labels
            const updates: Record<string, string> = {};
            if (selectedQuote.remetenteId) updates[selectedQuote.remetenteId] = selectedQuote.remetente;
            if (selectedQuote.destinatarioId) updates[selectedQuote.destinatarioId] = selectedQuote.destinatario || selectedQuote.empresaDestino;
            
            const lastDriverEvent = selectedQuote.operationalHistory?.slice().reverse().find(e => e.driverId);
            const condutorId = lastDriverEvent?.driverId || '';
            const veiculoId = ''; // Requires expanding if needed, but not required for CFOP.
            
            // Side Fetch to determine CFOP (Requires States)
            try {
                if (selectedQuote.remetenteId) {
                   const rr = await authFetch(`/api/customers/${selectedQuote.remetenteId}`);
                   if (rr.ok) { const rc = await rr.json(); remetenteEstado = rc.estado; updates[rc.id] = rc.razaoSocial; }
                }
                if (selectedQuote.destinatarioId) {
                   const dr = await authFetch(`/api/customers/${selectedQuote.destinatarioId}`);
                   if (dr.ok) { const dc = await dr.json(); destEstado = dc.estado; updates[dc.id] = dc.razaoSocial; }
                }
                
                // Em cotações nativas tomadorId não existe nativamente mas podemos mapear pelo nome.
                if (selectedQuote.remetente) {
                    tomadorIE = 'ISENTO'; // Assumir isento temporário, ou resgatar do tomador real
                }
            } catch(e) {}
            
            setEntityLabels(p => ({...p, ...updates}));
            
            const isInterstate = remetenteEstado && destEstado ? remetenteEstado !== destEstado : false;
            const suggestedCfop = mapNfeToCteCfop('', { inscricaoEstadual: tomadorIE } as any, isInterstate);

            form.reset({
                quoteId: selectedQuote.id,
            cfop: suggestedCfop, 
            serie: 1,
            remetenteId: selectedQuote.remetenteId || '',
            destinatarioId: selectedQuote.destinatarioId || '',
            tomadorId: selectedQuote.tomadorId || selectedQuote.remetenteId || '', 
            condutorId: condutorId,
            veiculoId: veiculoId,
            tomadorIE: tomadorIE,
            nfeKey: selectedQuote.nfNumber || '',
            valorProdutos: selectedQuote.valorProduto || 0,
            peso: selectedQuote.peso || 0,
            quantidadeVolumes: selectedQuote.volumes || 1,
            valorTotal: Number(((selectedQuote.valorFinal || 0) + (selectedQuote.icmsValor || 0)).toFixed(2)),
            valorReceber: Number(((selectedQuote.valorFinal || 0) + (selectedQuote.icmsValor || 0)).toFixed(2)),
            aliquotaIbs: selectedQuote.aliquotaIbs || 0,
            aliquotaCbs: selectedQuote.aliquotaCbs || 0,
            cstIbsCbs: selectedQuote.cstIbsCbs || '00',
            naturezaOperacao: selectedQuote.naturezaOperacao || 'PRESTACAO DE SERVICO DE TRANSPORTE',
            produtoPredominante: 'DIVERSOS',
            especieCarga: '',
        });
        
        setMaskedValorProdutos(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedQuote.valorProduto || 0));
        setMaskedValorTotal(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(((selectedQuote.valorFinal || 0) + (selectedQuote.icmsValor || 0)).toFixed(2))));
        setMaskedValorReceber(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(((selectedQuote.valorFinal || 0) + (selectedQuote.icmsValor || 0)).toFixed(2))));
        
        if (selectedQuote.nfeXml) {
             try {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(selectedQuote.nfeXml, "text/xml");

                const chNFe = xmlDoc.getElementsByTagName("chNFe")[0]?.textContent || xmlDoc.getElementsByTagName("Id")[0]?.textContent?.replace('NFe', '');
                const vNF = xmlDoc.getElementsByTagName("vNF")[0]?.textContent || xmlDoc.getElementsByTagName("vProd")[0]?.textContent;
                const pesoB = xmlDoc.getElementsByTagName("pesoB")[0]?.textContent || xmlDoc.getElementsByTagName("qVol")[0]?.textContent;
                const qVol = xmlDoc.getElementsByTagName("qVol")[0]?.textContent;
                const xProd = xmlDoc.getElementsByTagName("xProd")[0]?.textContent;
                const esp = xmlDoc.getElementsByTagName("esp")[0]?.textContent;
                
                if (chNFe) form.setValue('nfeKey', chNFe);
                if (vNF) {
                   const numVnf = Number(vNF);
                   setMaskedValorNota(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numVnf));
                   form.setValue('valorNota', numVnf);
                   if (!selectedQuote.valorProduto) {
                       setMaskedValorProdutos(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numVnf));
                       form.setValue('valorProdutos', numVnf);
                   }
                }
                if (pesoB && !selectedQuote.peso) form.setValue('peso', Number(pesoB));
                if (qVol && !selectedQuote.volumes) form.setValue('quantidadeVolumes', Number(qVol));
                if (xProd) form.setValue('produtoPredominante', xProd.substring(0, 60));
                if (esp) form.setValue('especieCarga', esp.substring(0, 30));

                toast({ title: 'Herança XML', description: 'Valores, Peso, Produto e Espécie extraídos nativamente da cotação.', duration: 5000 });
             } catch (e) {
                console.error("Erro ao extrair legado XML", e);
             }
        }
        
        }; // FECHA a function async prepareQuoteData
        
        prepareQuoteData();
      }
    }
  }, [watchedQuoteId, selectedQuoteObj, form, toast, mapNfeToCteCfop]);

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: 'valorTotal' | 'valorReceber' | 'valorProdutos' | 'valorNota', setMasked: React.Dispatch<React.SetStateAction<string>>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    const numericValue = Number(rawValue) / 100;
    
    setMasked(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numericValue));
    form.setValue(fieldName, numericValue, { shouldValidate: true });
  };

  const handleXmlObtained = (xmlContent: string) => {
    const parsed = parseNfeXml(xmlContent);
    if (parsed && parsed.errors.length === 0) {
      setParsedXmlData(parsed);
      setPendingXmlText(xmlContent);
      setIsPreviewOpen(true);
      setIsNfeAttachmentOpen(false);
    } else {
      toast({ title: 'Erro ao processar NF-e', description: 'O formato do documento não é válido.', variant: 'destructive' });
    }
  };

  const handleConfirmXmlImport = async () => {
    if (!pendingXmlText || !parsedXmlData) return;
    
    setIsPreviewOpen(false);
    setIsSubmitting(true);
    
    try {
        const data = parsedXmlData;
        
        // Basic fields
        if (data.chNFe) form.setValue('nfeKey', data.chNFe, { shouldValidate: true });
        if (data.vNF) {
           setMaskedValorNota(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.vNF));
           form.setValue('valorNota', data.vNF);
           // Sugerir o mesmo valor para produtos se estiver vazio
           if (!form.getValues('valorProdutos')) {
               setMaskedValorProdutos(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.vNF));
               form.setValue('valorProdutos', data.vNF);
           }
        }
        if (data.pesoB) form.setValue('peso', data.pesoB);
        if (data.qVol) form.setValue('quantidadeVolumes', data.qVol);
        if (data.xProd) form.setValue('produtoPredominante', data.xProd.substring(0, 60));
        if (data.esp) form.setValue('especieCarga', data.esp.substring(0, 30));
        
        const registerCustomerIfMissing = async (party: any) => {
            if (!party.cnpjCpf) return null;
            const cleanedCnpj = party.cnpjCpf.replace(/\D/g, '');
            
            let found = null;
            try {
                const searchRes = await authFetch(`/api/customers?term=${cleanedCnpj}&limit=1`);
                if (searchRes.ok) {
                   const d = await searchRes.json();
                   if (d && d.length > 0) found = d[0];
                }
            } catch(e) {
                console.error("Erro ao buscar cliente por CNPJ:", e);
            }
            
            if (found) return found;
            
            // Register it!
            if (party.nome) {
                const isPJ = cleanedCnpj.length > 11;
                try {
                    const res = await authFetch('/api/customers', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            razaoSocial: party.nome,
                            cnpj: cleanedCnpj,
                            inscricaoEstadual: party.ie || (isPJ ? 'ISENTO' : ''),
                            endereco: party.endereco,
                            cidade: party.cidade,
                            estado: party.estado,
                            cep: party.cep,
                            codigo_ibge: party.cMun,
                            type: isPJ ? 'PJ' : 'PF'
                        })
                    });
                    if (res.ok) {
                        return await res.json();
                    }
                } catch(e) { 
                    console.error("Erro ao auto-cadastrar cliente:", e); 
                }
            }
            return null;
        };

        // Parallel registration for speed
        const [remetenteCustomer, destCustomer] = await Promise.all([
            registerCustomerIfMissing(data.emitente),
            registerCustomerIfMissing(data.destinatario)
        ]);

        const updates: Record<string, string> = {};
        
        const getPreferredIE = (customerIe: string | undefined | null, xmlIe: string | undefined | null) => {
            const cleanDb = customerIe ? customerIe.trim().toUpperCase() : '';
            const cleanXml = xmlIe ? xmlIe.trim().toUpperCase() : '';
            if (cleanDb && cleanDb !== 'ISENTO') return cleanDb;
            return cleanXml || cleanDb || 'ISENTO';
        };

        if (remetenteCustomer) {
            form.setValue('remetenteId', remetenteCustomer.id, { shouldValidate: true });
            const preferredIe = getPreferredIE(remetenteCustomer.inscricaoEstadual, data.emitente.ie);
            form.setValue('remetenteIE', preferredIe);
            updates[remetenteCustomer.id] = remetenteCustomer.razaoSocial || data.emitente.nome;
        }

        if (destCustomer) {
            form.setValue('destinatarioId', destCustomer.id, { shouldValidate: true });
            const preferredIe = getPreferredIE(destCustomer.inscricaoEstadual, data.destinatario.ie);
            form.setValue('destinatarioIE', preferredIe);
            updates[destCustomer.id] = destCustomer.razaoSocial || data.destinatario.nome;
            
            // CFOP Logic
            const isInterstate = data.emitente.estado !== data.destinatario.estado;
            const suggestedCfop = mapNfeToCteCfop(data.nfeCfop, remetenteCustomer, isInterstate);
            form.setValue('cfop', suggestedCfop);
        }

        // Definir Tomador com base no modFrete (0=CIF=Remetente, 1=FOB=Destinatário)
        let finalTomadorId = remetenteCustomer?.id || '';
        let finalTomadorIE = form.getValues('remetenteIE') || '';
        
        if (data.modFrete === '1' && destCustomer) {
            finalTomadorId = destCustomer.id;
            finalTomadorIE = form.getValues('destinatarioIE') || '';
        }
        
        if (finalTomadorId) {
            form.setValue('tomadorId', finalTomadorId, { shouldValidate: true });
            if (finalTomadorIE) {
                form.setValue('tomadorIE', finalTomadorIE);
            }
        }
        
        setEntityLabels(prev => ({ ...prev, ...updates }));

        toast({ title: 'NF-e Importada!', description: 'Remetente, Destinatário e dados da carga preenchidos automaticamente.' });
    } catch (err) {
        console.error("Erro no processamento do XML:", err);
        toast({ title: 'Erro ao processar NF-e', description: 'Não foi possível extrair todos os dados do arquivo.', variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
        setPendingXmlText(null);
        setParsedXmlData(null);
    }
  };

  async function onSubmit(values: z.infer<typeof cteFormSchema>) {
    // Check for new cargo type
    if (values.especieCarga && !cargoTypes.includes(values.especieCarga)) {
        setPendingCteData(values);
        setShowNewCargoTypeDialog(true);
        return;
    }
    await processCteSubmission(values);
  }

  const handleSaveNewCargoType = async () => {
    if (pendingCteData?.especieCarga) {
        try {
            await authFetch('/api/settings/cargo-types', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: pendingCteData.especieCarga })
            });
            setCargoTypes(prev => [...prev, pendingCteData.especieCarga!]);
        } catch (e) {}
    }
    setShowNewCargoTypeDialog(false);
    if (pendingCteData) await processCteSubmission(pendingCteData);
  };

  async function processCteSubmission(values: z.infer<typeof cteFormSchema>) {
    setIsSubmitting(true);
    try {
        console.log('[CTE Submit] Enviando dados:', JSON.stringify(values, null, 2));
        const response = await authFetch('/api/nfe/cte', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(values)
        });
        const result = await response.json();
        if (!response.ok) {
            console.error('[CTE Submit Error] Status:', response.status);
            console.error('[CTE Submit Error] Resposta:', JSON.stringify(result, null, 2));
            if (result.xmlRetorno) {
              console.error('[CTE Submit Error] === XML RETORNO SEFAZ ===');
              console.error(result.xmlRetorno);
              console.error('[CTE Submit Error] ========================');
            }
            if (result.cStat) {
              console.error(`[CTE Submit Error] cStat=${result.cStat}`);
            }
            throw new Error(result.message || 'Erro desconhecido ao emitir CT-e.');
        }
        toast({
            title: 'CT-e Emitido com Sucesso!',
            description: `O CT-e foi enviado para a SEFAZ. ID: ${result.id}`,
            action: result.pdfUrl ? <Button onClick={() => window.open(result.pdfUrl, '_blank')}>Abrir DACTE</Button> : undefined,
        });
        form.reset({ serie: 1 });
        fetchData();
        setPendingCteData(null);
    } catch (error: any) {
        console.error('[CTE Submit Error] Exceção:', error.message);
        toast({ variant: 'destructive', title: 'Erro ao Emitir CT-e', description: error.message });
    } finally {
        setIsSubmitting(false);
    }
  }

  if (authLoading || isLoadingData) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="container mx-auto p-4 md:p-8 max-w-5xl relative overflow-hidden animate-in fade-in duration-500">
      <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/15 rounded-full blur-[100px] pointer-events-none -z-10 animate-float-blur-1" />
      <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-purple-500/15 rounded-full blur-[120px] pointer-events-none -z-10 animate-float-blur-2" />

      <PageHeader 
        icon={<FileText className="h-5 w-5" />}
        badge="CT-e"
        titlePrefix="Emissor de"
        titleHighlight="CT-e"
        description="Conhecimento de Transporte Eletrônico — SEFAZ v4.00"
        backHref="/documents"
        backLabel="Documentos"
        actions={
          <div className="flex items-center gap-2">
            <SefazStatusIndicator />
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs px-3 py-1 font-medium",
                fiscalSettings?.sefazEnvironment === 'producao' 
                  ? "border-red-500/50 text-red-600 bg-red-500/5" 
                  : "border-amber-500/50 text-amber-600 bg-amber-500/5"
              )}
            >
              {fiscalSettings?.sefazEnvironment === 'producao' ? '🔴 Produção' : '🟡 Homologação'}
            </Badge>
          </div>
        }
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 relative">
          
          {/* Card 1: Cotação */}
          <Card className="border border-border/40 bg-card/45 backdrop-blur-2xl shadow-xl rounded-2xl relative overflow-hidden transition-all duration-300 hover:shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-400 opacity-85" />
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">1. Cotação de Referência</CardTitle>
                  <CardDescription>Puxe dados de uma cotação aprovada ou inicie uma emissão avulsa.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <FormField
                control={form.control}
                name="quoteId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <div className="flex flex-col lg:flex-row gap-3 items-center w-full">
                      <div className="w-full lg:max-w-md">
                        <Popover open={isQuoteSearchOpen} onOpenChange={setIsQuoteSearchOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "w-full justify-between h-11 text-sm transition-all hover:border-primary/50 hover:bg-primary/5", 
                                  !field.value && "text-muted-foreground",
                                  field.value === 'avulso' && "border-emerald-500 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                                )}
                              >
                                <span className="truncate flex items-center gap-2">
                                  {field.value === 'avulso' 
                                      ? <><FileText className="h-4 w-4 text-emerald-500"/> Emissão Avulsa</>
                                      : selectedQuoteObj 
                                          ? <span className="font-medium text-foreground">{selectedQuoteObj.quoteCode} <span className="text-muted-foreground font-normal ml-1">({selectedQuoteObj.destinatario})</span></span> 
                                          : "Buscar Cotação..."}
                                </span>
                                <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0 shadow-xl border-border/50 backdrop-blur-xl bg-card/95">
                            <Command>
                              <CommandInput 
                                  placeholder="ID, NF-e ou Cliente..." 
                                  value={quoteSearchTerm} 
                                  onValueChange={setQuoteSearchTerm} 
                                  className="h-10"
                              />
                              <CommandList>
                                  {isSearchingQuotes && (
                                      <div className="p-4 text-center text-sm text-muted-foreground flex flex-col items-center">
                                          <Loader2 className="h-4 w-4 animate-spin mb-2 text-primary" />
                                          Buscando...
                                      </div>
                                  )}
                                  {!isSearchingQuotes && quoteSearchTerm.length < 2 && (
                                      <div className="p-4 text-center text-xs text-muted-foreground">
                                          Mínimo de 2 caracteres.
                                      </div>
                                  )}
                                  {!isSearchingQuotes && quoteSearchTerm.length >= 2 && searchedQuotes.length === 0 && (
                                      <CommandEmpty>Nenhuma cotação encontrada.</CommandEmpty>
                                  )}
                                  <CommandGroup>
                                      {searchedQuotes.map((q) => (
                                          <CommandItem
                                              value={q.id + q.quoteCode}
                                              key={q.id}
                                              onSelect={() => {
                                                  field.onChange(q.id);
                                                  setSelectedQuoteObj(q);
                                                  setIsQuoteSearchOpen(false);
                                              }}
                                              className="py-2"
                                          >
                                              <Check className={cn("mr-2 h-4 w-4", field.value === q.id ? "opacity-100" : "opacity-0")} />
                                              <div className="flex flex-col">
                                                <span className="font-medium text-sm">{q.quoteCode} - {q.destinatario}</span>
                                                {q.nfNumber && <span className="text-[10px] text-muted-foreground">NF: {q.nfNumber}</span>}
                                              </div>
                                          </CommandItem>
                                      ))}
                                  </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                         <Button 
                           type="button" 
                           variant="outline" 
                           className={cn("h-11 px-4 border-emerald-500/30 hover:bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 transition-colors", field.value === 'avulso' && "bg-emerald-500/10 border-emerald-500")} 
                           onClick={() => { field.onChange('avulso'); setSelectedQuoteObj(null); setIsQuoteSearchOpen(false); }}
                         >
                            <FileText className="mr-2 h-4 w-4" /> 
                            Avulsa
                         </Button>
                         <Button 
                           type="button" 
                           variant="secondary"
                           className="h-11 px-4" 
                           onClick={() => { field.onChange('avulso'); setSelectedQuoteObj(null); setIsQuoteSearchOpen(false); setIsNfeAttachmentOpen(true); }}
                         >
                            <Upload className="mr-2 h-4 w-4" /> 
                            Importar XML
                         </Button>
                         <Button 
                           type="button" 
                           variant="outline"
                           className="h-11 px-4 border-primary/30 hover:bg-primary/5" 
                           onClick={() => { field.onChange('avulso'); setSelectedQuoteObj(null); setIsQuoteSearchOpen(false); setIsNfeAttachmentOpen(true); }}
                         >
                            <Search className="mr-2 h-4 w-4" /> 
                            Digitar Chave
                         </Button>
                      </div>
                    </div>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Card 1.5: Modos de Emissão */}
          <Card className="border border-border/40 bg-card/45 backdrop-blur-2xl shadow-xl rounded-2xl relative overflow-hidden transition-all duration-300 hover:shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-blue-400 opacity-85" />
            <CardHeader className="pb-3 pt-5">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500">
                  <Settings2 className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Parâmetros de Emissão</CardTitle>
                  <CardDescription className="text-xs">Finalidade, tipo de serviço e configuração fiscal do documento.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-0 pb-5">
              <FormField control={form.control} name="tpCTe" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-foreground/70">Finalidade (tpCTe)</FormLabel>
                  <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value ?? 0)}>
                    <FormControl><SelectTrigger className="h-9 text-sm bg-background/50"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="0">0 - Normal</SelectItem>
                      <SelectItem value="1">1 - Complementar</SelectItem>
                      <SelectItem value="2">2 - Anulação</SelectItem>
                      <SelectItem value="3">3 - Substituto</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="tpServ" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-foreground/70">Tipo de Serviço (tpServ)</FormLabel>
                  <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value ?? 0)}>
                    <FormControl><SelectTrigger className="h-9 text-sm bg-background/50"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="0">0 - Normal</SelectItem>
                      <SelectItem value="1">1 - Subcontratação</SelectItem>
                      <SelectItem value="2">2 - Redespacho</SelectItem>
                      <SelectItem value="3">3 - Redesp. Intermediário</SelectItem>
                      <SelectItem value="4">4 - Multimodal</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="cfop" render={({ field }) => ( 
                <FormItem> 
                  <FormLabel className="text-xs text-foreground/70">CFOP</FormLabel> 
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger className="h-9 text-sm bg-background/50"><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {cfops.map(c => (
                        <SelectItem key={c.id} value={c.code}>
                          <span className="font-medium">{c.code}</span> - <span className="text-muted-foreground">{c.description}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage /> 
                </FormItem> 
              )}/>
              <FormField control={form.control} name="serie" render={({ field }) => ( 
                <FormItem> 
                  <FormLabel className="text-xs text-foreground/70">Série</FormLabel> 
                  <FormControl><Input type="number" className="h-9 text-sm bg-background/50" {...field} /></FormControl> 
                  <FormMessage /> 
                </FormItem> 
              )}/>
            </CardContent>
          </Card>

          {/* Card 2: Partes Envolvidas */}
          <Card className="border border-border/40 bg-card/45 backdrop-blur-2xl shadow-xl rounded-2xl relative overflow-hidden transition-all duration-300 hover:shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 to-purple-400 opacity-85" />
            <CardHeader className="pb-3 pt-5">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-violet-500/10 rounded-lg text-violet-500">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Partes Envolvidas</CardTitle>
                  <CardDescription className="text-xs">Remetente, destinatário e tomador do serviço.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
              <FormField control={form.control} name="remetenteId" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground/80">Remetente</FormLabel>
                  <AsyncSearchableCombobox fetchUrl="/api/customers" displayKey="razaoSocial" value={field.value} onChange={(v, o)=>{field.onChange(v); if(o) { setEntityLabels(p=>({...p, [v]: o.razaoSocial})); form.setValue('remetenteIE', o.inscricaoEstadual || ''); } }} placeholder="Selecione o remetente" searchPlaceholder="Buscando empresas..." emptyText="Nenhum cliente encontrado" defaultLabel={entityLabels[field.value] ? <><Building2 className="mr-2 h-4 w-4 inline-block text-muted-foreground"/>{entityLabels[field.value]}</>: undefined} renderOption={(opt) => <div className="flex justify-between items-center w-full"><span className="truncate flex items-center"><Building2 className="mr-2 h-4 w-4 text-muted-foreground"/> {opt.razaoSocial}</span></div>} onEdit={(id) => setQuickEditTarget({ type: 'customer', id })} />
                  <FormMessage/>
                </FormItem>
              )} />
              
              <FormField control={form.control} name="remetenteIE" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center text-foreground/80">
                    IE do Remetente
                    <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0 h-4 bg-muted text-muted-foreground border-none">Opcional</Badge>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="ISENTO ou numeração" className="bg-background/50 focus:bg-background" {...field} />
                  </FormControl>
                  <FormMessage/>
                </FormItem>
              )} />
              
              <FormField control={form.control} name="destinatarioId" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground/80">Destinatário</FormLabel>
                  <AsyncSearchableCombobox fetchUrl="/api/customers" displayKey="razaoSocial" value={field.value} onChange={(v, o)=>{field.onChange(v); if(o) { setEntityLabels(p=>({...p, [v]: o.razaoSocial})); form.setValue('destinatarioIE', o.inscricaoEstadual || ''); } }} placeholder="Selecione o destinatário" searchPlaceholder="Buscando empresas..." emptyText="Nenhum cliente encontrado" defaultLabel={entityLabels[field.value] ? <><Building2 className="mr-2 h-4 w-4 inline-block text-muted-foreground"/>{entityLabels[field.value]}</>: undefined} renderOption={(opt) => <div className="flex justify-between items-center w-full"><span className="truncate flex items-center"><Building2 className="mr-2 h-4 w-4 text-muted-foreground"/> {opt.razaoSocial}</span></div>} onEdit={(id) => setQuickEditTarget({ type: 'customer', id })} />
                  <FormMessage/>
                </FormItem>
              )} />

              <FormField control={form.control} name="destinatarioIE" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center text-foreground/80">
                    IE do Destinatário
                    <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0 h-4 bg-muted text-muted-foreground border-none">Opcional</Badge>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="ISENTO ou numeração" className="bg-background/50 focus:bg-background" {...field} />
                  </FormControl>
                  <FormMessage/>
                </FormItem>
              )} />
              
              <FormField control={form.control} name="tomadorId" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground/80">Tomador (Pagador)</FormLabel>
                  <AsyncSearchableCombobox fetchUrl="/api/customers" displayKey="razaoSocial" value={field.value} onChange={(v, o)=>{field.onChange(v); if(o) { setEntityLabels(p=>({...p, [v]: o.razaoSocial})); form.setValue('tomadorIE', o.inscricaoEstadual || ''); } }} placeholder="Selecione o tomador" searchPlaceholder="Buscando empresas..." emptyText="Nenhum cliente encontrado" defaultLabel={entityLabels[field.value] ? <><Building2 className="mr-2 h-4 w-4 inline-block text-muted-foreground"/>{entityLabels[field.value]}</>: undefined} renderOption={(opt) => <div className="flex justify-between items-center w-full"><span className="truncate flex items-center"><Building2 className="mr-2 h-4 w-4 text-muted-foreground"/> {opt.razaoSocial}</span></div>} onEdit={(id) => setQuickEditTarget({ type: 'customer', id })} />
                  <FormMessage/>
                </FormItem>
              )} />
              
              <FormField control={form.control} name="tomadorIE" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center text-foreground/80">
                    IE do Tomador
                    <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0 h-4 bg-muted text-muted-foreground border-none">Opcional</Badge>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="ISENTO ou numeração" className="bg-background/50 focus:bg-background" {...field} />
                  </FormControl>
                  <FormMessage/>
                </FormItem>
              )} />
            </CardContent>
          </Card>
          
          {/* Card 3: Transporte (Opcional) */}
          <Card className="border border-border/40 bg-card/45 backdrop-blur-2xl shadow-xl rounded-2xl relative overflow-hidden transition-all duration-300 hover:shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-amber-400 opacity-85" />
            <CardHeader className="pb-2 pt-5 cursor-pointer" onClick={() => setShowTransport(!showTransport)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-orange-500/10 rounded-lg text-orange-500">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      Dados de Transporte
                      <Badge variant="secondary" className="text-[10px] px-2 py-0 h-5 bg-orange-500/10 text-orange-600 dark:text-orange-400 border-none font-normal">Opcional</Badge>
                    </CardTitle>
                    <CardDescription className="text-xs">Motorista e veículo não são obrigatórios para a emissão do CT-e.</CardDescription>
                  </div>
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                  {showTransport ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </CardHeader>
            {showTransport && (
            <CardContent className="grid md:grid-cols-2 gap-5 pt-2 pb-5 animate-in slide-in-from-top-2 duration-200">
              <FormField control={form.control} name="condutorId" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground/80 text-sm">Motorista Responsável</FormLabel>
                  <AsyncSearchableCombobox 
                    fetchUrl="/api/drivers" 
                    displayKey="name" 
                    value={field.value || ''} 
                    onChange={(v, o)=>{
                        field.onChange(v); 
                        if(o) {
                            setEntityLabels(p=>({...p, [v]: o.name}));
                            if (o.mainVehicleId) {
                                form.setValue('veiculoId', o.mainVehicleId);
                                if (o.licensePlate) {
                                    setEntityLabels(p => ({ ...p, [o.mainVehicleId]: `${o.licensePlate}${o.vehicleType ? ' - ' + o.vehicleType : ''}` }));
                                }
                                toast({ 
                                    title: 'Veículo Herdado 🚚', 
                                    description: `Veículo ${o.licensePlate || ''} vinculado automaticamente ao motorista ${o.name}.`,
                                    duration: 3000
                                });
                            }
                        }
                    }} 
                    placeholder="Selecione o motorista" 
                    searchPlaceholder="Buscando..." 
                    emptyText="Nenhum motorista encontrado" 
                    defaultLabel={entityLabels[field.value || ''] ? <><User className="mr-2 h-4 w-4 inline-block text-muted-foreground"/>{entityLabels[field.value || '']}</>: undefined} 
                    renderOption={(opt) => <div className="flex justify-between items-center w-full"><span className="truncate flex items-center"><User className="mr-2 h-4 w-4 text-muted-foreground"/> {opt.name}</span></div>} 
                    onEdit={(id) => setQuickEditTarget({ type: 'driver', id })} 
                  />
                  <FormMessage/>
                </FormItem>
              )} />
              
              <FormField control={form.control} name="veiculoId" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground/80 text-sm">Veículo de Tração</FormLabel>
                  <AsyncSearchableCombobox fetchUrl="/api/fleet" displayKey="plate" value={field.value || ''} onChange={(v, o)=>{field.onChange(v); if(o) setEntityLabels(p=>({...p, [v]: `${o.plate} - ${o.brand}`}));}} placeholder="Selecione o veículo" searchPlaceholder="Buscando..." emptyText="Nenhum veículo encontrado" defaultLabel={entityLabels[field.value || ''] ? <><Truck className="mr-2 h-4 w-4 inline-block text-muted-foreground"/>{entityLabels[field.value || '']}</>: undefined} renderOption={(opt) => <div className="flex justify-between items-center w-full"><span className="truncate flex items-center"><Truck className="mr-2 h-4 w-4 text-muted-foreground"/> <span className="font-medium mr-2">{opt.plate}</span> <span className="text-muted-foreground text-sm">{opt.brand} {opt.model}</span></span></div>} onEdit={(id) => setQuickEditTarget({ type: 'fleet', id })} />
                  <FormMessage/>
                </FormItem>
              )} />
            </CardContent>
            )}
          </Card>

          {/* Card 4: Carga e Valores */}
          <Card className="border border-border/40 bg-card/45 backdrop-blur-2xl shadow-xl rounded-2xl relative overflow-hidden transition-all duration-300 hover:shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-400 opacity-85" />
            <CardHeader className="pb-3 pt-5">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Detalhes da Carga e Faturamento</CardTitle>
                  <CardDescription className="text-xs">NF-e referenciada, mercadoria e valores do serviço.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-2">
              <div className="grid md:grid-cols-2 gap-4">
                <FormField control={form.control} name="naturezaOperacao" render={({ field }) => ( 
                  <FormItem> 
                    <FormLabel className="text-foreground/80 text-sm">Natureza da Operação</FormLabel> 
                    <div className="flex gap-2">
                      <FormControl>
                        <Input className="h-9 text-sm bg-background/50 focus:bg-background" list="natureza-list" {...field} />
                      </FormControl> 
                      <datalist id="natureza-list">
                        {NATUREZAS_OPERACAO.map(n => <option key={n} value={n} />)}
                      </datalist>
                    </div>
                    <FormMessage /> 
                  </FormItem> 
                )}/>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
                <FormField control={form.control} name="nfeKey" render={({ field }) => ( 
                  <FormItem className="lg:col-span-2"> 
                    <FormLabel className="text-foreground/80">Chave de Acesso da NF-e (44 dígitos)</FormLabel> 
                    <FormControl>
                      <div className="relative">
                        <Input className="bg-background/50 focus:bg-background font-mono text-sm tracking-widest" {...field} />
                        {field.value?.length === 44 && <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />}
                      </div>
                    </FormControl> 
                    <FormMessage /> 
                  </FormItem> 
                )}/>
                <FormField control={form.control} name="valorNota" render={({ field }) => ( 
                  <FormItem> 
                    <FormLabel className="text-foreground/80">Valor da NF-e</FormLabel> 
                    <FormControl><Input className="bg-background/50 focus:bg-background font-medium text-emerald-600 dark:text-emerald-400" value={maskedValorNota} onChange={(e) => handleCurrencyChange(e, 'valorNota', setMaskedValorNota)} placeholder="R$ 0,00" /></FormControl> 
                    <FormMessage /> 
                  </FormItem> 
                )}/>
                <FormField control={form.control} name="valorProdutos" render={({ field }) => ( 
                  <FormItem> 
                    <FormLabel className="text-foreground/80">Valor das Mercadorias</FormLabel> 
                    <FormControl><Input className="bg-background/50 focus:bg-background font-medium" value={maskedValorProdutos} onChange={(e) => handleCurrencyChange(e, 'valorProdutos', setMaskedValorProdutos)} placeholder="R$ 0,00" /></FormControl> 
                    <FormMessage /> 
                  </FormItem> 
                )}/>
              </div>

              <Separator className="bg-border/40" />

              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
                <FormField control={form.control} name="peso" render={({ field }) => ( 
                  <FormItem> 
                    <FormLabel className="text-foreground/80">Peso Bruto (KG)</FormLabel> 
                    <FormControl>
                      <div className="relative">
                        <Input type="number" step="0.01" className="bg-background/50 focus:bg-background pr-8" {...field} />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">kg</span>
                      </div>
                    </FormControl> 
                    <FormMessage /> 
                  </FormItem> 
                )}/>
                <FormField control={form.control} name="quantidadeVolumes" render={({ field }) => ( 
                  <FormItem> 
                    <FormLabel className="text-foreground/80">Total de Volumes</FormLabel> 
                    <FormControl>
                      <div className="relative">
                        <Input type="number" className="bg-background/50 focus:bg-background pr-10" {...field} />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">unid.</span>
                      </div>
                    </FormControl> 
                    <FormMessage /> 
                  </FormItem> 
                )}/>
                <FormField control={form.control} name="produtoPredominante" render={({ field }) => ( 
                  <FormItem> 
                    <FormLabel className="text-foreground/80">Produto Predominante</FormLabel> 
                    <FormControl><Input className="bg-background/50 focus:bg-background" placeholder="Ex: AUTO PECAS" {...field} /></FormControl> 
                    <FormMessage /> 
                  </FormItem> 
                )}/>
                <FormField control={form.control} name="especieCarga" render={({ field }) => ( 
                  <FormItem> 
                    <FormLabel className="text-foreground/80">Embalagem</FormLabel> 
                    <div className="flex gap-2">
                      <FormControl>
                        <Input className="bg-background/50 focus:bg-background" list="cargo-types-list" placeholder="Ex: VOLUMES, PALLETS" {...field} />
                      </FormControl>
                      <datalist id="cargo-types-list">
                        {cargoTypes.map(ct => <option key={ct} value={ct} />)}
                      </datalist>
                    </div>
                    <FormMessage /> 
                  </FormItem> 
                )}/>
              </div>

              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 grid md:grid-cols-2 gap-5 mt-4">
                <FormField control={form.control} name="valorTotal" render={({ field }) => ( 
                  <FormItem> 
                    <FormLabel className="text-primary font-medium">Valor Total da Prestação do Serviço</FormLabel> 
                    <FormControl><Input className="bg-background font-bold text-lg text-primary border-primary/20" value={maskedValorTotal} onChange={(e) => handleCurrencyChange(e, 'valorTotal', setMaskedValorTotal)} placeholder="R$ 0,00" /></FormControl> 
                    <FormMessage /> 
                  </FormItem> 
                )}/>
                <FormField control={form.control} name="valorReceber" render={({ field }) => ( 
                  <FormItem> 
                    <FormLabel className="text-primary/80 font-medium">Valor Líquido a Receber</FormLabel> 
                    <FormControl><Input className="bg-background font-semibold text-lg border-primary/10" value={maskedValorReceber} onChange={(e) => handleCurrencyChange(e, 'valorReceber', setMaskedValorReceber)} placeholder="R$ 0,00" /></FormControl> 
                    <FormMessage /> 
                  </FormItem> 
                )}/>
              </div>
            </CardContent>
          </Card>

          {/* Card 5: Tributação */}
          <Card className="border border-border/40 bg-card/45 backdrop-blur-2xl shadow-xl rounded-2xl relative overflow-hidden transition-all duration-300 hover:shadow-2xl mb-10">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 to-rose-400 opacity-85" />
            <CardHeader className="pb-3 pt-5">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-pink-500/10 rounded-lg text-pink-500">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    Tributação
                    <Badge variant="secondary" className="text-[10px] bg-pink-500/10 text-pink-600 dark:text-pink-400 border-none">IBS / CBS</Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">Parâmetros tributários do serviço de transporte.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-5 pt-2">
              <FormField control={form.control} name="cstIbsCbs" render={({ field }) => ( 
                <FormItem> 
                  <FormLabel className="text-foreground/80">CST (Situação Tributária)</FormLabel> 
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-background/50 focus:bg-background">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="00">00 - Tributada Integralmente</SelectItem>
                      <SelectItem value="01">01 - Imunidade</SelectItem>
                      <SelectItem value="10">10 - Isenção</SelectItem>
                      <SelectItem value="11">11 - Não Incidência</SelectItem>
                      <SelectItem value="20">20 - Alíquota Reduzida</SelectItem>
                      <SelectItem value="21">21 - Redução de Base de Cálculo</SelectItem>
                      <SelectItem value="30">30 - Regime Diferenciado</SelectItem>
                      <SelectItem value="40">40 - Suspensão</SelectItem>
                      <SelectItem value="51">51 - Diferimento</SelectItem>
                      <SelectItem value="90">90 - Outras</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage /> 
                </FormItem> 
              )}/>
              <FormField control={form.control} name="aliquotaIbs" render={({ field }) => ( 
                <FormItem> 
                  <FormLabel className="text-foreground/80">Alíquota IBS (%)</FormLabel> 
                  <FormControl>
                    <div className="relative">
                      <Input type="number" step="0.01" className="bg-background/50 focus:bg-background pr-8" {...field} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                    </div>
                  </FormControl> 
                  <FormMessage /> 
                </FormItem> 
              )}/>
              <FormField control={form.control} name="aliquotaCbs" render={({ field }) => ( 
                <FormItem> 
                  <FormLabel className="text-foreground/80">Alíquota CBS (%)</FormLabel> 
                  <FormControl>
                    <div className="relative">
                      <Input type="number" step="0.01" className="bg-background/50 focus:bg-background pr-8" {...field} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                    </div>
                  </FormControl> 
                  <FormMessage /> 
                </FormItem> 
              )}/>
            </CardContent>
          </Card>

          {/* Card 6: Informações Adicionais */}
          <Card className="border border-border/40 bg-card/45 backdrop-blur-2xl shadow-xl rounded-2xl relative overflow-hidden transition-all duration-300 hover:shadow-2xl mb-10">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-gray-500 to-slate-400 opacity-85" />
            <CardHeader className="pb-3 pt-5">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-gray-500/10 rounded-lg text-gray-500">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    Informações Adicionais
                    <Badge variant="secondary" className="text-[10px] bg-gray-500/10 text-gray-600 dark:text-gray-400 border-none">Opcional</Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">Observações gerais para impressão no DACTE.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <FormField control={form.control} name="observacoes" render={({ field }) => ( 
                <FormItem> 
                  <FormLabel className="text-foreground/80">Observações (Impressas no DACTE)</FormLabel> 
                  <FormControl>
                    <textarea 
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y" 
                      placeholder="Uso livre para informações complementares de interesse do contribuinte..." 
                      {...field} 
                    />
                  </FormControl> 
                  <FormMessage /> 
                </FormItem> 
              )}/>
            </CardContent>
          </Card>

          {/* Sticky CTA Footer */}
          <div className="sticky bottom-4 z-10 p-4 mt-8 bg-card/45 backdrop-blur-2xl border border-border/40 rounded-2xl shadow-2xl flex items-center justify-between transition-all duration-300">
            <div className="hidden md:flex flex-col">
              <span className="text-sm font-semibold text-foreground">Revisão Final</span>
              <span className="text-xs text-muted-foreground">O CT-e será transmitido via Webservice SEFAZ.</span>
            </div>
            <Button 
              type="submit" 
              disabled={isSubmitting} 
              size="lg"
              className={cn(
                "w-full md:w-auto text-sm px-8 h-12 shadow-md transition-all",
                isSubmitting ? "bg-primary/50" : "bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 hover:scale-105"
              )}
            >
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Autorizando...</>
              ) : (
                <><FileText className="mr-2 h-4 w-4" /> Transmitir CT-e</>
              )}
            </Button>
          </div>
        </form>
      </Form>

      <CompanyManagement 
          quickEditId={quickEditTarget.type === 'customer' ? (quickEditTarget.id || undefined) : undefined} 
          onQuickEditComplete={() => setQuickEditTarget({ type: null, id: null })} 
          hideList={true}
      />
      <DriverManagement 
          quickEditId={quickEditTarget.type === 'driver' ? (quickEditTarget.id || undefined) : undefined} 
          onQuickEditComplete={() => setQuickEditTarget({ type: null, id: null })} 
          hideList={true}
      />
      <FleetManagement 
          quickEditId={quickEditTarget.type === 'fleet' ? (quickEditTarget.id || undefined) : undefined} 
          onQuickEditComplete={() => setQuickEditTarget({ type: null, id: null })} 
          hideList={true}
      />

      <Dialog open={showNewCargoTypeDialog} onOpenChange={setShowNewCargoTypeDialog}>
          <DialogContent className="sm:max-w-md">
              <DialogHeader>
                  <DialogTitle>Nova Espécie de Carga</DialogTitle>
                  <DialogDescription>
                      A espécie <span className="font-bold text-foreground">"{pendingCteData?.especieCarga}"</span> não está cadastrada. Deseja salvar esta espécie no sistema para facilitar futuras emissões?
                  </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
                  <Button variant="outline" onClick={() => { setShowNewCargoTypeDialog(false); if(pendingCteData) processCteSubmission(pendingCteData); }}>Não, apenas emitir o CT-e</Button>
                  <Button onClick={handleSaveNewCargoType}>Sim, salvar no dicionário e emitir</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      {/* XML Upload Preview Verification Dialog */}
      <XmlPreviewDialog
          isOpen={isPreviewOpen}
          onClose={() => { 
              setParsedXmlData(null); 
              setPendingXmlText(null); 
              setIsPreviewOpen(false); 
          }}
          parsedData={parsedXmlData}
          onConfirm={handleConfirmXmlImport}
      />
      <NfeAttachmentDialog
          isOpen={isNfeAttachmentOpen}
          onOpenChange={setIsNfeAttachmentOpen}
          onXmlObtained={handleXmlObtained}
          title="Importar NF-e de Transporte"
      />

      <style>{`
        @keyframes floatBlur1 {
          0%, 100% {
            transform: translate(0, 0) scale(1);
            background-color: hsl(var(--primary) / 0.15);
          }
          25% {
            transform: translate(120px, 60px) scale(1.15);
            background-color: rgba(99, 102, 241, 0.18);
          }
          50% {
            transform: translate(40px, 160px) scale(0.95);
            background-color: rgba(236, 72, 153, 0.14);
          }
          75% {
            transform: translate(-80px, 100px) scale(1.08);
            background-color: rgba(59, 130, 246, 0.18);
          }
        }

        @keyframes floatBlur2 {
          0%, 100% {
            transform: translate(0, 0) scale(1);
            background-color: rgba(168, 85, 247, 0.15);
          }
          33% {
            transform: translate(-100px, -120px) scale(1.1);
            background-color: rgba(59, 130, 246, 0.16);
          }
          66% {
            transform: translate(80px, -60px) scale(0.9);
            background-color: rgba(236, 72, 153, 0.14);
          }
        }

        .animate-float-blur-1 {
          animation: floatBlur1 28s infinite ease-in-out alternate !important;
        }

        .animate-float-blur-2 {
          animation: floatBlur2 38s infinite ease-in-out alternate !important;
        }
      `}</style>
    </main>
  );
}
