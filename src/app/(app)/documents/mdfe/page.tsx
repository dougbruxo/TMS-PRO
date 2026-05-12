"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/api-client';
import { ALL_UFS } from '@/lib/ufs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Loader2, ArrowLeft, Truck, FileText, CheckCircle2, AlertCircle, PackageCheck, MapPin, Plus, Trash2, Send, Info, ShieldAlert, ShieldCheck, Hash, Search, X, Check, User, Car, Building2, ArrowRight } from 'lucide-react';
import { BrazilMapSelector } from '@/components/BrazilMapSelector';

// ── Types ──
interface CteItem { _id: string; numeroCte: number; serie: number; chaveAcesso: string; remetenteNome: string; destinatarioNome: string; valorServico: number; valorCarga?: number; peso: number; cidadeOrigem: string; ufOrigem: string; cidadeDestino: string; ufDestino: string; codigoIbgeDestino?: string; dataEmissao: string; vinculado: boolean; tomadorNome?: string; tomadorCnpj?: string; }
interface Fiscal { sefazEnvironment: 'homologacao' | 'producao'; nextMdfeNumber: number; }

// ── Schema ──
const munSchema = z.object({
  cMunDescarga: z.string().min(7).max(7, 'Código IBGE deve ter 7 dígitos'),
  xMunDescarga: z.string().min(2, 'Município obrigatório'),
  chavesCte: z.array(z.string()).min(1, 'Selecione ao menos um CT-e'),
});
const schema = z.object({
  tpAmb: z.enum(['1','2']),
  ufInicio: z.string().length(2, 'UF obrigatória'),
  ufFim: z.string().length(2, 'UF obrigatória'),
  veiculoTracaoId: z.string().min(1, 'Veículo obrigatório'),
  condutorId: z.string().min(1, 'Condutor obrigatório'),
  tpRod: z.string().min(2, 'Tipo de rodado obrigatório'),
  tpCar: z.string().min(2, 'Tipo de carroceria obrigatório'),
  vCarga: z.coerce.number().min(0.01, 'Valor obrigatório'),
  qCarga: z.coerce.number().min(0.01, 'Peso obrigatório'),
  infCpl: z.string().optional(),
  nAver: z.string().optional(),
  munsDescarga: z.array(munSchema).min(1, 'Adicione ao menos um município de descarga'),
  ufsPercurso: z.array(z.string()).optional(),
  contratanteCnpj: z.string().optional(),
  contratanteCpf: z.string().optional(),
  contratanteNome: z.string().optional(),
  cepCarrega: z.string().optional(),
  cepDescarrega: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

// ── CTE Search Component ──
function CteSearchPanel({ munIdx, selectedChaves, onToggle, usedElsewhere }: {
  munIdx: number; selectedChaves: string[]; onToggle: (chave: string, cte: CteItem) => void; usedElsewhere: string[];
}) {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<NodeJS.Timeout>();

  const search = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/documents/cte-search?q=${encodeURIComponent(q)}&limit=15`);
      if (res.ok) setResults(await res.json());
    } catch { toast({ variant:'destructive', title:'Erro na busca' }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => search(query), 350);
    return () => clearTimeout(debounce.current);
  }, [query, search]);

  useEffect(() => { search(''); }, []);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por Nº, remetente, destinatário, cidade, CNPJ..." className="pl-9 pr-8" value={query} onChange={e => setQuery(e.target.value)} />
        {query && <button className="absolute right-2 top-2.5" onClick={() => setQuery('')}><X className="h-4 w-4 text-muted-foreground" /></button>}
      </div>
      {loading && <div className="flex items-center gap-2 text-xs text-muted-foreground py-2"><Loader2 className="h-3 w-3 animate-spin" />Buscando...</div>}
      {!loading && results.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-3 px-3 border rounded bg-muted/20">
          <AlertCircle className="h-4 w-4 shrink-0" />{query ? 'Nenhum CT-e encontrado para esta busca.' : 'Nenhum CT-e autorizado disponível.'}
        </div>
      )}
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {results.map(cte => {
          const isSel = selectedChaves.includes(cte.chaveAcesso);
          const isUsed = usedElsewhere.includes(cte.chaveAcesso);
          const isLinked = cte.vinculado && !isSel;
          return (
            <div key={cte._id} onClick={() => { if (!isUsed && !isLinked) onToggle(cte.chaveAcesso, cte); }}
              className={`flex items-start gap-2.5 p-2.5 border rounded cursor-pointer transition-all text-sm ${isSel ? 'border-primary bg-primary/5' : isUsed || isLinked ? 'opacity-40 cursor-not-allowed bg-muted/10' : 'hover:bg-muted/30'}`}>
              <div className="mt-0.5 shrink-0 pointer-events-none">
                <div className={`h-4 w-4 shrink-0 rounded-sm border border-primary flex items-center justify-center ${(isUsed || isLinked) ? 'opacity-50' : ''} ${isSel ? 'bg-primary text-primary-foreground' : ''}`}>
                  {isSel && <Check className="h-3 w-3" />}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold">CT-e {String(cte.numeroCte).padStart(9,'0')}/{cte.serie}</span>
                  <Badge variant="outline" className="text-xs px-1">{cte.ufOrigem}→{cte.ufDestino}</Badge>
                  {isLinked && <Badge variant="secondary" className="text-xs px-1">Já em MDF-e</Badge>}
                  {isUsed && <Badge variant="secondary" className="text-xs px-1">Outro município</Badge>}
                </div>
                <p className="text-xs text-muted-foreground truncate">{cte.remetenteNome} → {cte.destinatarioNome}</p>
                <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground">
                  <span>R$ <b>{Number(cte.valorServico||0).toFixed(2)}</b></span>
                  <span><b>{Number(cte.peso||0).toFixed(2)}</b> kg</span>
                  <span className="font-mono">{cte.chaveAcesso?.slice(0,22)}...</span>
                </div>
              </div>
              {isSel && <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Driver Search Component ──
function DriverSearchField({ onSelect, drivers }: { onSelect: (driver: any) => void; drivers: any[] }) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  
  const filteredDrivers = drivers.filter(d => 
    d.name?.toLowerCase().includes(searchValue.toLowerCase()) || 
    d.cpf?.includes(searchValue) ||
    d.licensePlate?.toLowerCase().includes(searchValue.toLowerCase())
  ).slice(0, 8);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between h-12 border-dashed hover:border-primary hover:bg-primary/5">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 shrink-0 opacity-50 text-primary" />
            <span className="text-muted-foreground font-normal">Buscar motorista por Nome, CPF ou Placa...</span>
          </div>
          <Plus className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[450px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Pesquisar..." value={searchValue} onValueChange={setSearchValue} />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>Nenhum motorista encontrado.</CommandEmpty>
            <CommandGroup heading="Resultados">
              {filteredDrivers.map((driver) => (
                <CommandItem
                  key={driver.id}
                  onSelect={() => {
                    onSelect(driver);
                    setOpen(false);
                  }}
                  className="flex items-start gap-3 p-3 cursor-pointer"
                >
                  <Avatar className="h-10 w-10 shrink-0 border">
                    <AvatarImage src={driver.avatarUrl} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                      {driver.name?.split(' ').map((n:any)=>n[0]).join('').slice(0,2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-sm truncate text-primary">{driver.name}</p>
                      <Badge variant="outline" className="text-[10px] py-0 h-4">{driver.licensePlate || 'Frota'}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Hash className="h-3 w-3"/> CPF: {driver.cpf}</span>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── Vehicle Search Component ──
function VehicleSearchField({ onSelect, fleet }: { onSelect: (vehicle: any) => void; fleet: any[] }) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  
  const filteredVehicles = fleet.filter(v => 
    v.plate?.toLowerCase().includes(searchValue.toLowerCase()) || 
    v.brand?.toLowerCase().includes(searchValue.toLowerCase()) ||
    v.model?.toLowerCase().includes(searchValue.toLowerCase())
  ).slice(0, 8);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between h-12 border-dashed hover:border-primary hover:bg-primary/5">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 shrink-0 opacity-50 text-primary" />
            <span className="text-muted-foreground font-normal">Buscar veículo por Placa, Marca ou Modelo...</span>
          </div>
          <Plus className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[450px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Pesquisar..." value={searchValue} onValueChange={setSearchValue} />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>Nenhum veículo encontrado.</CommandEmpty>
            <CommandGroup heading="Veículos Disponíveis">
              {filteredVehicles.map((vehicle) => (
                <CommandItem
                  key={vehicle.id}
                  onSelect={() => {
                    onSelect(vehicle);
                    setOpen(false);
                  }}
                  className="flex items-start gap-3 p-3 cursor-pointer"
                >
                  <div className={cn(
                    "h-10 w-10 shrink-0 rounded-lg flex items-center justify-center border",
                    vehicle.antt && vehicle.renavam ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground opacity-50"
                  )}>
                    <Truck className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-extrabold text-sm text-primary tracking-tight">{vehicle.plate}</p>
                      {vehicle.antt ? <Badge className="bg-blue-100 text-blue-700 text-[10px] py-0 h-4">ANTT OK</Badge> : <Badge variant="destructive" className="text-[10px] py-0 h-4">SEM ANTT</Badge>}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{vehicle.brand} {vehicle.model} • {vehicle.vehicleType}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── Main Page ──
export default function MdfePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [drivers, setDrivers] = useState<any[]>([]);
  const [fleet, setFleet] = useState<any[]>([]);
  const [fiscal, setFiscal] = useState<Fiscal>({ sefazEnvironment: 'homologacao', nextMdfeNumber: 1 });
  const [companyProfile, setCompanyProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { 
      tpAmb:'2', 
      ufInicio:'', 
      ufFim:'', 
      veiculoTracaoId:'', 
      condutorId:'', 
      tpRod:'03', 
      tpCar:'02', 
      vCarga:0, 
      qCarga:0, 
      infCpl:'', 
      nAver:'', 
      munsDescarga:[{cMunDescarga:'',xMunDescarga:'',chavesCte:[]}], 
      ufsPercurso:[], 
      contratanteCnpj:'', 
      contratanteCpf:'',
      contratanteNome: '',
      cepCarrega: '',
      cepDescarrega: ''
    },
  });
  const [selectedCtesData, setSelectedCtesData] = useState<Record<string, CteItem>>({});
  const [maskedValorCarga, setMaskedValorCarga] = useState('R$ 0,00');
  const [maskedQCarga, setMaskedQCarga] = useState('0,000');
  
  const { fields: munFields, append: appendMun, remove: removeMun } = useFieldArray({ control: form.control, name: 'munsDescarga' });

  useEffect(() => {
    if (authLoading || !user) return;
    const load = async () => {
      try {
        const [dr, fl, fs, cp] = await Promise.all([
          authFetch('/api/drivers').then(r => r.ok ? r.json() : []),
          authFetch('/api/fleet').then(r => r.ok ? r.json() : []),
          authFetch('/api/settings/fiscal').then(r => r.ok ? r.json() : null),
          authFetch('/api/company-profile').then(r => r.ok ? r.json() : null),
        ]);
        setDrivers(dr); setFleet(fl);
        if (Array.isArray(cp)) {
          const defaultProfile = cp.find(p => p.isDefault) || cp[0];
          setCompanyProfile(defaultProfile);
        }
        if (fs) { setFiscal({ sefazEnvironment: fs.sefazEnvironment, nextMdfeNumber: fs.nextMdfeNumber||1 }); form.setValue('tpAmb', fs.sefazEnvironment==='producao'?'1':'2'); }
      } catch (e:any) { toast({ variant:'destructive', title:'Erro', description: e.message }); }
      finally { setIsLoading(false); }
    };
    load();
  }, [user, authLoading]);

  const munsWatch = form.watch('munsDescarga');

  // Auto-set UF Inicio from Company Profile
  useEffect(() => {
    if (companyProfile?.estado && !form.getValues('ufInicio')) {
      form.setValue('ufInicio', companyProfile.estado);
    }
  }, [companyProfile, form]);

  // Check insurance expiration
  useEffect(() => {
    if (companyProfile) {
      const checks = [
        { name: 'RCTR-C', date: companyProfile.insuranceExpirationRctrc },
        { name: 'RC-DC', date: companyProfile.insuranceExpirationRcdc },
        { name: 'RC-V', date: companyProfile.insuranceExpirationRcv }
      ];
      
      checks.forEach(c => {
        if (c.date) {
          const expDate = new Date(c.date);
          const today = new Date();
          expDate.setHours(23, 59, 59, 999);
          today.setHours(0, 0, 0, 0);
          
          const diffTime = expDate.getTime() - today.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays < 0) {
            toast({ 
              variant: 'destructive', 
              title: `Seguro ${c.name} Vencido! ⚠️`, 
              description: `O seguro expirou em ${new Date(c.date).toLocaleDateString('pt-BR')}. Regularize antes de emitir.` 
            });
          } else if (diffDays <= 15) {
            toast({ 
              title: `Seguro ${c.name} Próximo do Vencimento! ⏳`, 
              description: diffDays === 0 ? 'Vence hoje!' : `Expira em ${diffDays} dias (${new Date(c.date).toLocaleDateString('pt-BR')}).` 
            });
          }
        }
      });
    }
  }, [companyProfile, toast]);

  // Check insurance coverage limits against cargo value
  useEffect(() => {
    const vCarga = form.watch('vCarga');
    if (companyProfile && vCarga > 0) {
      const checks = [
        { name: 'RCTR-C', limit: companyProfile.insuranceCoverageRctrc },
        { name: 'RC-DC', limit: companyProfile.insuranceCoverageRcdc },
      ];

      checks.forEach(c => {
        if (c.limit && vCarga > c.limit) {
          toast({
            variant: 'destructive',
            title: `Atenção: Limite Excedido (${c.name})! 🚨`,
            description: `O valor da carga (R$ ${vCarga.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) ultrapassa o limite de cobertura do seguro (R$ ${c.limit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`
          });
        }
      });
    }
  }, [form.watch('vCarga'), companyProfile, toast]);

  // Auto-set UF Fim from last discharge municipality
  useEffect(() => {
    if (munsWatch && munsWatch.length > 0) {
      const lastMun = munsWatch[munsWatch.length - 1];
      if (lastMun.chavesCte && lastMun.chavesCte.length > 0) {
        const lastCteKey = lastMun.chavesCte[0];
        const cte = selectedCtesData[lastCteKey];
        if (cte?.ufDestino) {
          form.setValue('ufFim', cte.ufDestino);
        }
      }
    }
  }, [munsWatch, selectedCtesData, form]);

  const allSelected = munsWatch.flatMap(m => m.chavesCte||[]);
  
  const selectedVehicleId = form.watch('veiculoTracaoId');
  const selectedVehicle = fleet.find(v => v.id === selectedVehicleId);
  const isTac = String(selectedVehicle?.category || '').toUpperCase().includes('TAC');

  const handleToggleCte = (munIdx: number, chave: string, cte: CteItem) => {
    const cur = form.getValues(`munsDescarga.${munIdx}.chavesCte`)||[];
    const next = cur.includes(chave) ? cur.filter(c=>c!==chave) : [...cur, chave];
    form.setValue(`munsDescarga.${munIdx}.chavesCte`, next, { shouldValidate:true });

    setSelectedCtesData(prev => {
      const newData = { ...prev };
      if (!cur.includes(chave)) {
        newData[chave] = cte;
      } else {
        const muns = form.getValues('munsDescarga');
        const stillUsed = muns.some(m => m.chavesCte?.includes(chave));
        if (!stillUsed) delete newData[chave];
      }
      return newData;
    });

    if (!cur.includes(chave)) {
      if (!form.getValues(`munsDescarga.${munIdx}.xMunDescarga`) && cte.cidadeDestino) form.setValue(`munsDescarga.${munIdx}.xMunDescarga`, cte.cidadeDestino);
      if (!form.getValues(`munsDescarga.${munIdx}.cMunDescarga`) && cte.codigoIbgeDestino) form.setValue(`munsDescarga.${munIdx}.cMunDescarga`, String(cte.codigoIbgeDestino));
      if (!form.getValues('ufInicio') && cte.ufOrigem) form.setValue('ufInicio', cte.ufOrigem);
      if (!form.getValues('ufFim') && cte.ufDestino) form.setValue('ufFim', cte.ufDestino);

      // Lógica de Contratante baseada na categoria do veículo
      if (isTac) {
        // Se for TAC, o contratante é a própria transportadora (Emitente)
        if (companyProfile) {
          form.setValue('contratanteCnpj', companyProfile.cnpj?.replace(/\D/g, '') || '');
          form.setValue('contratanteCpf', '');
          form.setValue('contratanteNome', companyProfile.razaoSocial || '');
          
          toast({
            title: "Contratante: Sua Empresa (TAC)",
            description: "Como o veículo é um TAC, sua empresa foi definida como contratante."
          });
        }
      } else if (cte.tomadorCnpj) {
        // Se for Frota Própria (ETC), o contratante é o cliente (Tomador do CT-e)
        const cleanDoc = cte.tomadorCnpj.replace(/\D/g, '');
        if (cleanDoc.length === 11) {
          form.setValue('contratanteCpf', cleanDoc);
          form.setValue('contratanteCnpj', '');
        } else {
          form.setValue('contratanteCnpj', cleanDoc);
          form.setValue('contratanteCpf', '');
        }
        
        if (cte.tomadorNome) {
          form.setValue('contratanteNome', cte.tomadorNome);
        }

        toast({
          title: "Contratante: Cliente (Frota Própria)",
          description: `Contratante ${cte.tomadorNome || 'importado'} importado do CT-e.`
        });
      }
    }
  };

  useEffect(() => {
    const uniqueChaves = new Set<string>();
    munsWatch.forEach(m => (m.chavesCte||[]).forEach(c => uniqueChaves.add(c)));
    
    let totalCarga = 0;
    let totalPeso = 0;
    
    if (uniqueChaves.size > 0) {
      uniqueChaves.forEach(chave => {
        const cte = selectedCtesData[chave];
        if (cte) {
          totalCarga += (cte.valorCarga || cte.valorServico || 0);
          totalPeso += (cte.peso || 0);
        }
      });
      
      form.setValue('vCarga', totalCarga, { shouldValidate: true });
      setMaskedValorCarga(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCarga));
      
      form.setValue('qCarga', totalPeso, { shouldValidate: true });
      setMaskedQCarga(new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(totalPeso));
    } else {
      form.setValue('vCarga', 0);
      setMaskedValorCarga('R$ 0,00');
      form.setValue('qCarga', 0);
      setMaskedQCarga('0,000');
    }
  }, [munsWatch, selectedCtesData, form]);

  // Reagir à troca de veículo para atualizar o contratante
  useEffect(() => {
    if (!selectedVehicleId || !companyProfile) return;
    
    if (isTac) {
      form.setValue('contratanteCnpj', companyProfile.cnpj?.replace(/\D/g, '') || '');
      form.setValue('contratanteCpf', '');
      form.setValue('contratanteNome', companyProfile.razaoSocial || '');
    } else {
      // Se mudar para ETC, tenta recuperar o tomador do primeiro CT-e selecionado
      const firstCte = Object.values(selectedCtesData)[0];
      if (firstCte?.tomadorCnpj) {
        const cleanDoc = firstCte.tomadorCnpj.replace(/\D/g, '');
        if (cleanDoc.length === 11) {
          form.setValue('contratanteCpf', cleanDoc);
          form.setValue('contratanteCnpj', '');
        } else {
          form.setValue('contratanteCnpj', cleanDoc);
          form.setValue('contratanteCpf', '');
        }
        form.setValue('contratanteNome', firstCte.tomadorNome || '');
      }
    }
  }, [selectedVehicleId, isTac, companyProfile, selectedCtesData, form]);

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: 'vCarga', setMasked: React.Dispatch<React.SetStateAction<string>>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    const numericValue = Number(rawValue) / 100;
    setMasked(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numericValue));
    form.setValue(fieldName, numericValue, { shouldValidate: true });
  };

  const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    const numericValue = Number(rawValue) / 1000;
    setMaskedQCarga(new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(numericValue));
    form.setValue('qCarga', numericValue, { shouldValidate: true });
  };

  const recalcTotals = () => {
    const uniqueChaves = new Set<string>();
    munsWatch.forEach(m => (m.chavesCte||[]).forEach(c => uniqueChaves.add(c)));
    
    let totalCarga = 0;
    let totalPeso = 0;
    uniqueChaves.forEach(chave => {
      const cte = selectedCtesData[chave];
      if (cte) {
        totalCarga += (cte.valorCarga || cte.valorServico || 0);
        totalPeso += (cte.peso || 0);
      }
    });
    
    form.setValue('vCarga', totalCarga, { shouldValidate: true });
    setMaskedValorCarga(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCarga));
    form.setValue('qCarga', totalPeso, { shouldValidate: true });
    setMaskedQCarga(new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(totalPeso));
    
    toast({ title: 'Totais Recalculados', description: `Valor: R$ ${totalCarga.toFixed(2)} | Peso: ${totalPeso.toFixed(3)} kg` });
  };

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const payload = { 
        ...values, 
        documentos: values.munsDescarga.flatMap(m=>m.chavesCte), 
        munsDescarga: values.munsDescarga.map(m=>({ cMunDescarga:m.cMunDescarga, xMunDescarga:m.xMunDescarga, chaves:m.chavesCte })),
        tpTransp: isTac ? 2 : 1, // 2=TAC (Agregado), 1=ETC (Próprio)
        infLotacao: allSelected.length === 1 ? {
          cepCarrega: values.cepCarrega || companyProfile?.cep?.replace(/\D/g, '') || '',
          cepDescarrega: values.cepDescarrega || ''
        } : undefined
      };
      const res = await authFetch('/api/nfe/mdfe', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      toast({ title:'✅ MDF-e Emitido!', description:`Protocolo: ${result.protocolo}` });
      router.push('/documents/history');
    } catch (err:any) { toast({ variant:'destructive', title:'Erro', description: err.message }); }
    finally { setIsSubmitting(false); }
  };

  if (authLoading || isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const isProducao = fiscal.sefazEnvironment === 'producao';

  return (
    <main className="container mx-auto p-4 md:p-8 space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => router.push('/documents')}><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2"><Truck className="h-6 w-6" />Emissão de MDF-e</h1>
          <p className="text-xs text-muted-foreground">Manifesto Eletrônico de Documentos Fiscais — Mod. 58 (Modal Rodoviário)</p>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold ${isProducao?'border-red-400 bg-red-500/10 text-red-600':'border-primary/40 bg-primary/10 text-primary'}`}>
          {isProducao?<ShieldAlert className="h-3.5 w-3.5"/>:<ShieldCheck className="h-3.5 w-3.5"/>}
          {isProducao?'PRODUÇÃO':'HOMOLOGAÇÃO'}
        </div>
      </div>

      {/* Info bar */}
      <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 text-xs">
        <Hash className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">Próximo Nº MDF-e:</span>
        <span className="font-mono font-bold">{String(fiscal.nextMdfeNumber).padStart(9,'0')}</span>
        <Separator orientation="vertical" className="h-4" />
        <span className="text-muted-foreground">Configure em <a href="/settings/fiscal" className="underline text-primary">Configurações Fiscais</a></span>
      </div>

      {/* SEFAZ rules */}
      <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
        <CardContent className="py-2.5 flex gap-2 items-start">
          <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <ul className="text-xs text-amber-800 dark:text-amber-200 list-disc pl-3 space-y-0.5">
            <li>Ao menos <b>1 CT-e autorizado</b> é obrigatório — regra SEFAZ ETC (Ajuste SINIEF 21/10).</li>
            <li>Veículo precisa ter <b>RNTRC/ANTT</b> e RENAVAM. Emitente precisa ter <b>IE</b> e RNTRC.</li>
            <li><b>Tipo de Rodado e Carroceria</b> são campos obrigatórios no XML (schema MDF-e 3.00).</li>
            <li>MDF-e deve ser <b>encerrado</b> após chegada ao destino final.</li>
          </ul>
        </CardContent>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

          {/* ── 1. CT-e por Município ── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2"><PackageCheck className="h-4 w-4 text-primary" />1. Selecionar CT-e por Município</CardTitle>
                <Button type="button" variant="outline" size="sm" className="gap-1" onClick={()=>appendMun({cMunDescarga:'',xMunDescarga:'',chavesCte:[]})}>
                  <Plus className="h-3.5 w-3.5" />Município
                </Button>
              </div>
              <CardDescription className="text-xs">Busque CT-e por número, remetente, destinatário, cidade ou CNPJ. Ao selecionar, os dados são preenchidos automaticamente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {munFields.map((mf, munIdx) => {
                const selChaves = form.watch(`munsDescarga.${munIdx}.chavesCte`)||[];
                const usedElsewhere = munFields.filter((_,i)=>i!==munIdx).flatMap((_,i2)=>form.getValues(`munsDescarga.${i2 < munIdx ? i2 : i2+1}.chavesCte`)||[]);
                const cityName = form.watch(`munsDescarga.${munIdx}.xMunDescarga`);
                const cityIbge = form.watch(`munsDescarga.${munIdx}.cMunDescarga`);
                
                return (
                  <div key={mf.id} className={cn(
                    "border-2 rounded-xl p-5 space-y-4 transition-all",
                    selChaves.length > 0 ? "border-primary/20 bg-primary/5" : "border-dashed bg-muted/5"
                  )}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider">Município {munIdx+1}</Badge>
                          {selChaves.length > 0 && (
                            <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-[10px] gap-1 px-2 h-5">
                              <CheckCircle2 className="h-3 w-3" /> {selChaves.length} CT-e(s)
                            </Badge>
                          )}
                        </div>
                        {cityName ? (
                          <div className="flex items-center gap-2 text-primary">
                            <MapPin className="h-4 w-4 shrink-0" />
                            <span className="font-bold text-base leading-tight">{cityName}</span>
                            <span className="text-xs opacity-60 font-mono">({cityIbge})</span>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">Nenhum CT-e selecionado para este município.</p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {munFields.length > 1 && (
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8" 
                            onClick={() => removeMun(munIdx)}
                          >
                            <Trash2 className="h-4 w-4"/>
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Seleção de CT-es via Popover/Search */}
                    <div className="space-y-3">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-between h-11 border-dashed hover:border-primary/50 hover:bg-primary/5 group">
                            <span className="flex items-center gap-2 text-muted-foreground group-hover:text-primary transition-colors">
                              <Search className="h-4 w-4" />
                              {selChaves.length === 0 ? "Selecionar CT-es para este município..." : "Adicionar mais CT-es..."}
                            </span>
                            <Plus className="h-4 w-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-4" align="start">
                          <CteSearchPanel 
                            munIdx={munIdx} 
                            selectedChaves={selChaves} 
                            usedElsewhere={usedElsewhere} 
                            onToggle={(chave, cte) => handleToggleCte(munIdx, chave, cte)} 
                          />
                        </PopoverContent>
                      </Popover>

                      {/* Lista de CT-es selecionados */}
                      {selChaves.length > 0 && (
                        <div className="grid gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                          {selChaves.map(chave => {
                            const cte = selectedCtesData[chave];
                            if (!cte) return null;
                            return (
                              <div key={chave} className="flex items-center justify-between p-2.5 bg-white dark:bg-black/40 border rounded-lg group hover:border-primary/30 transition-colors">
                                <div className="flex items-center gap-3 overflow-hidden">
                                  <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                    <FileText className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold leading-none">CT-e {String(cte.numeroCte).padStart(9,'0')}</p>
                                    <p className="text-[10px] text-muted-foreground truncate mt-1">Destinatário: {cte.destinatarioNome}</p>
                                  </div>
                                </div>
                                <Button 
                                  type="button" 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" 
                                  onClick={() => handleToggleCte(munIdx, chave, cte)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Campos Técnicos (Bastidores) */}
                    <div className="hidden">
                      <FormField control={form.control} name={`munsDescarga.${munIdx}.cMunDescarga`} render={({field})=>(
                        <FormItem><FormLabel>IBGE</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>
                      )}/>
                      <FormField control={form.control} name={`munsDescarga.${munIdx}.xMunDescarga`} render={({field})=>(
                        <FormItem><FormLabel>Nome</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>
                      )}/>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* ── 2. Trajeto ── */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4 text-primary"/>2. Trajeto</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <FormField control={form.control} name="ufInicio" render={({field})=>(
                <FormItem><FormLabel>UF de Carregamento *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione..."/></SelectTrigger></FormControl>
                  <SelectContent>{ALL_UFS.map(uf=><SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent></Select><FormMessage/></FormItem>
              )}/>
              <FormField control={form.control} name="ufFim" render={({field})=>(
                <FormItem><FormLabel>UF de Descarregamento *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione..."/></SelectTrigger></FormControl>
                  <SelectContent>{ALL_UFS.map(uf=><SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent></Select><FormMessage/></FormItem>
              )}/>
              
              <div className="md:col-span-2 space-y-4">
                <div className="flex flex-col gap-1">
                  <FormLabel className="text-base flex items-center gap-2">
                    UFs de Percurso 
                    <Badge variant="secondary" className="font-normal text-[10px]">Mapa Interativo</Badge>
                  </FormLabel>
                  <p className="text-xs text-muted-foreground">
                    Selecione no mapa os estados por onde o veículo passará durante o trajeto (em ordem).
                  </p>
                </div>
                
                <FormField control={form.control} name="ufsPercurso" render={({ field }) => (
                  <FormItem className="p-1 border rounded-2xl bg-muted/5">
                    <BrazilMapSelector 
                      selectedUfs={field.value || []} 
                      ufInicio={form.watch('ufInicio')}
                      ufFim={form.watch('ufFim')}
                      onSetUfs={(ufs) => field.onChange(ufs)}
                      onToggleUf={(uf) => {
                        const current = field.value || [];
                        const next = current.includes(uf)
                          ? current.filter(u => u !== uf)
                          : [...current, uf];
                        field.onChange(next);
                      }}
                    />
                    <FormMessage />
                  </FormItem>
                )}/>
              </div>
            </CardContent>
          </Card>

          {/* ── 3. Veículo e Condutor ── */}
          <Card className="overflow-hidden border-primary/20 shadow-lg shadow-primary/5">
            <CardHeader className="pb-3 bg-primary/5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2 text-primary"><Truck className="h-4 w-4" />3. Veículo e Condutor</CardTitle>
                  <CardDescription className="text-[11px]">Vincule o motorista e o veículo para esta operação. Dados fiscais serão herdados automaticamente.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid md:grid-cols-2 gap-8">
                
                {/* Motorista Selection */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <User className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-bold">Motorista Responsável</span>
                  </div>

                  {!form.watch('condutorId') ? (
                    <DriverSearchField 
                      drivers={drivers} 
                      onSelect={(d) => {
                        form.setValue('condutorId', d.id, { shouldValidate: true });
                        if (d.mainVehicleId) {
                          form.setValue('veiculoTracaoId', d.mainVehicleId, { shouldValidate: true });
                          const vh = fleet.find(f => f.id === d.mainVehicleId);
                          if (vh) {
                            if (vh.tpRod) form.setValue('tpRod', vh.tpRod, { shouldValidate: true });
                            if (vh.tpCar) form.setValue('tpCar', vh.tpCar, { shouldValidate: true });
                            
                            // Herança do Contratante: Se o veículo principal do motorista for TAC
                            if (vh.category === 'TAC' && companyProfile?.cnpj) {
                              form.setValue('contratanteCnpj', companyProfile.cnpj, { shouldValidate: true });
                            }

                            toast({ 
                              title: 'Vínculo Automático 🚚', 
                              description: `Motorista ${d.name} vinculado ao veículo ${vh.plate}${vh.category === 'TAC' ? ' (TAC - Contratante Definido)' : ''}.` 
                            });
                          }
                        }
                      }} 
                    />
                  ) : (
                    <div className="relative group">
                      <div className="p-4 border-2 border-primary/30 rounded-xl bg-primary/5 flex items-start gap-4 transition-all hover:bg-primary/10">
                        <Avatar className="h-12 w-12 border-2 border-white shadow-sm shrink-0">
                          <AvatarImage src={drivers.find(d => d.id === form.watch('condutorId'))?.avatarUrl} />
                          <AvatarFallback className="bg-primary text-white text-lg">
                            {drivers.find(d => d.id === form.watch('condutorId'))?.name?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-primary truncate">{drivers.find(d => d.id === form.watch('condutorId'))?.name}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Hash className="h-3 w-3"/>{drivers.find(d => d.id === form.watch('condutorId'))?.cpf}</span>
                            <Badge variant="secondary" className="text-[10px] h-4 bg-primary/10 text-primary border-none">Condutor</Badge>
                          </div>
                        </div>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" 
                          onClick={() => {
                            form.setValue('condutorId', '', { shouldValidate: true });
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                  <FormField control={form.control} name="condutorId" render={() => <FormMessage />} />
                </div>

                {/* Veículo Selection */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <Car className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-bold">Veículo de Tração</span>
                  </div>

                  {!form.watch('veiculoTracaoId') ? (
                    <VehicleSearchField 
                      fleet={fleet} 
                      onSelect={(v) => {
                        form.setValue('veiculoTracaoId', v.id, { shouldValidate: true });
                        if (v.tpRod) form.setValue('tpRod', v.tpRod, { shouldValidate: true });
                        if (v.tpCar) form.setValue('tpCar', v.tpCar, { shouldValidate: true });
                        
                        // Herança do Contratante: Se for TAC, a própria transportadora é o contratante
                        if (v.category === 'TAC' && companyProfile?.cnpj) {
                          form.setValue('contratanteCnpj', companyProfile.cnpj, { shouldValidate: true });
                          toast({
                            title: "Contratante Automático",
                            description: "Veículo TAC detectado. Sua transportadora foi definida como contratante do serviço."
                          });
                        }
                      }} 
                    />
                  ) : (
                    <div className="relative group">
                      <div className="p-4 border-2 border-primary/30 rounded-xl bg-primary/5 flex items-start gap-4 transition-all hover:bg-primary/10">
                        <div className="h-12 w-12 rounded-xl bg-primary text-white flex items-center justify-center shadow-md shrink-0">
                          <Truck className="h-6 w-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-extrabold text-primary text-lg tracking-wider">{fleet.find(v => v.id === form.watch('veiculoTracaoId'))?.plate}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                            <span className="truncate">{fleet.find(v => v.id === form.watch('veiculoTracaoId'))?.brand} {fleet.find(v => v.id === form.watch('veiculoTracaoId'))?.model}</span>
                            <Badge variant="outline" className="text-[10px] h-4 border-primary/30 text-primary">{fleet.find(v => v.id === form.watch('veiculoTracaoId'))?.vehicleType}</Badge>
                          </div>
                        </div>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" 
                          onClick={() => {
                            form.setValue('veiculoTracaoId', '', { shouldValidate: true });
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                  <FormField control={form.control} name="veiculoTracaoId" render={() => <FormMessage />} />
                </div>
              </div>

              {/* Hidden/Informational area for SEFAZ fields */}
              {(form.watch('tpRod') || form.watch('tpCar')) && (
                <div className="mt-4 pt-4 border-t border-dashed flex flex-wrap gap-4 items-center">
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-full">
                    <Info className="h-3 w-3 text-primary" />
                    <span>Dados Fiscais Herdados:</span>
                    <span className="font-bold text-primary ml-1">
                      Rodado: {
                        { '01':'Truck', '02':'Toco', '03':'Cavalo Mecânico', '04':'VAN', '05':'Utilitário', '06':'Outros' }[form.watch('tpRod')] || form.watch('tpRod')
                      }
                    </span>
                    <span className="mx-1 opacity-30">|</span>
                    <span className="font-bold text-primary">
                      Carroceria: {
                        { '00':'N/A', '01':'Aberta', '02':'Fechada/Baú', '03':'Graneleira', '04':'Container', '05':'Sider' }[form.watch('tpCar')] || form.watch('tpCar')
                      }
                    </span>
                  </div>
                  
                  {/* Invisible inputs to satisfy React Hook Form validation if needed, 
                      though they are already in the form state via setValue */}
                  <div className="hidden">
                    <FormField control={form.control} name="tpRod" render={({field}) => <Input {...field} />} />
                    <FormField control={form.control} name="tpCar" render={({field}) => <Input {...field} />} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── 4. Contratante (Obrigatório / Automático) ── */}
          <Card className={cn(
            "transition-all duration-300",
            (!form.watch('contratanteCnpj') && !form.watch('contratanteCpf')) ? "border-amber-300 bg-amber-50/30" : "border-primary/20"
          )}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                4. Informações do Contratante
              </CardTitle>
              <CardDescription className="text-xs">Identificação de quem contratou o serviço de transporte. Obrigatório para MDF-e com CT-e.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <FormField control={form.control} name="contratanteCnpj" render={({field})=>(
                  <FormItem>
                    <FormLabel>CNPJ do Contratante</FormLabel>
                    <FormControl>
                      <Input placeholder="00.000.000/0000-00" {...field} onChange={e => {
                        const val = e.target.value.replace(/\D/g, '');
                        field.onChange(val);
                        if (val) form.setValue('contratanteCpf', '');
                      }} />
                    </FormControl>
                    <FormMessage/>
                  </FormItem>
                )}/>
                <FormField control={form.control} name="contratanteCpf" render={({field})=>(
                  <FormItem>
                    <FormLabel>CPF do Contratante (Pessoa Física)</FormLabel>
                    <FormControl>
                      <Input placeholder="000.000.000-00" {...field} onChange={e => {
                        const val = e.target.value.replace(/\D/g, '');
                        field.onChange(val);
                        if (val) form.setValue('contratanteCnpj', '');
                      }} />
                    </FormControl>
                    <FormMessage/>
                  </FormItem>
                )}/>
              </div>
              
              <FormField control={form.control} name="contratanteNome" render={({field})=>(
                <FormItem>
                  <FormLabel>Nome do Contratante *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome ou Razão Social" {...field} />
                  </FormControl>
                  <FormMessage/>
                </FormItem>
              )}/>
              
              {(!form.watch('contratanteCnpj') && !form.watch('contratanteCpf')) && (
                <div className="flex items-center gap-2 p-2 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                  <AlertCircle className="h-3 w-3" />
                  ATENÇÃO: A SEFAZ exige a informação do contratante. Selecione um CT-e para preencher automaticamente.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-primary"/>4. Totais e Informações Adicionais</CardTitle>
                <Button type="button" variant="ghost" size="sm" onClick={recalcTotals} className="h-7 text-xs gap-1">
                  <ArrowLeft className="h-3 w-3 rotate-90" /> Recalcular
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <FormField control={form.control} name="vCarga" render={()=>(
                <FormItem><FormLabel>Valor Total da Carga (R$) *</FormLabel><FormControl>
                  <Input value={maskedValorCarga} onChange={(e) => handleCurrencyChange(e, 'vCarga', setMaskedValorCarga)} />
                </FormControl><FormMessage/></FormItem>
              )}/>
              <FormField control={form.control} name="qCarga" render={()=>(
                <FormItem><FormLabel>Peso Total (Kg) *</FormLabel><FormControl>
                  <Input value={maskedQCarga} onChange={handleWeightChange} />
                </FormControl><FormMessage/></FormItem>
              )}/>
              <div className="md:col-span-1">
                <FormField control={form.control} name="nAver" render={({field})=>(
                  <FormItem>
                    <FormLabel>Número da Averbação (Seguro) *</FormLabel>
                    <FormControl>
                      <Input placeholder="Obrigatório para modal rodoviário" {...field}/>
                    </FormControl>
                    <FormDescription className="text-[10px]">
                      A SEFAZ exige ao menos uma averbação para o modal rodoviário.
                    </FormDescription>
                    <FormMessage/>
                  </FormItem>
                )}/>
              </div>
              <div className="md:col-span-1">
                <FormField control={form.control} name="infCpl" render={({field})=>(
                  <FormItem><FormLabel>Informações Adicionais (infAdic/infCpl)</FormLabel><FormControl><Input placeholder="Observações para o DAMDFE e SEFAZ..." {...field}/></FormControl><FormMessage/></FormItem>
                )}/>
              </div>

              {allSelected.length === 1 && (
                <div className="md:col-span-2 grid md:grid-cols-2 gap-4 pt-4 border-t border-dashed border-primary/20">
                  <div className="md:col-span-2">
                    <p className="text-[10px] font-bold text-amber-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> CARGA LOTAÇÃO DETECTADA: Para 1 documento, os CEPs abaixo são obrigatórios pela SEFAZ.
                    </p>
                  </div>
                  <FormField control={form.control} name="cepCarrega" render={({field})=>(
                    <FormItem>
                      <FormLabel>CEP de Carregamento *</FormLabel>
                      <FormControl>
                        <Input placeholder="00000-000" {...field} onChange={e => field.onChange(e.target.value.replace(/\D/g, ''))} />
                      </FormControl>
                      <FormMessage/>
                    </FormItem>
                  )}/>
                  <FormField control={form.control} name="cepDescarrega" render={({field})=>(
                    <FormItem>
                      <FormLabel>CEP de Descarregamento *</FormLabel>
                      <FormControl>
                        <Input placeholder="00000-000" {...field} onChange={e => field.onChange(e.target.value.replace(/\D/g, ''))} />
                      </FormControl>
                      <FormDescription className="text-[10px]">Consulte o CEP de destino no CT-e vinculado.</FormDescription>
                      <FormMessage/>
                    </FormItem>
                  )}/>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary */}
          {allSelected.length>0 && (
            <Card className="border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20">
              <CardContent className="py-3 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0"/>
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">{allSelected.length} CT-e(s) selecionado(s) no MDF-e</p>
              </CardContent>
            </Card>
          )}

          <Separator/>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={()=>router.push('/documents')}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting} className={`gap-2 min-w-44 ${isProducao?'bg-red-600 hover:bg-red-700':''}`}>
              {isSubmitting?<><Loader2 className="h-4 w-4 animate-spin"/>Enviando...</>:<><Send className="h-4 w-4"/>Emitir MDF-e{isProducao?' (PRODUÇÃO)':''}</>}
            </Button>
          </div>
        </form>
      </Form>
    </main>
  );
}
