

"use client";

import { useEffect, useState, useMemo, ChangeEvent, forwardRef, useImperativeHandle, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cityList } from '@/lib/data';
import { Loader2, Calculator, Box, Plus, PlusCircle, Trash2, Search, User, Upload, Copy, Info, ArrowLeft, ArrowRight, ArrowDown, Package, Weight, Map, Warehouse, Truck, Layers, Clock, Navigation, Ruler } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { User as AuthUser, Quote, Vehicle, Company, FreightMode } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { ScrollArea } from './ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { XmlPreviewDialog } from '@/components/XmlPreviewDialog';
import { NfeAttachmentDialog } from '@/components/NfeAttachmentDialog';
import { parseNfeXml, ParsedNfeData } from '@/lib/xml-parser';
import { findBestFitVehicle, parseCapacity, calculateFloorOccupancy, type FloorOccupancyResult } from '@/lib/vehicle-utils';

// Base schema for freight modes
const baseSchema = z.object({
    usuario: z.string({ required_error: 'Selecione um usuário.' }).min(1, 'Selecione um usuário.'),
    cidadeOrigem: z.string().min(3, 'Cidade de origem é obrigatória.'),
    cidadeDestino: z.string().min(3, 'Cidade de destino é obrigatória.'),
    valorProduto: z.coerce.number().min(0, 'Valor do produto deve ser positivo.'),
    remetente: z.string().min(1, 'Nome do remetente é obrigatório.'),
    remetenteId: z.string().optional(),
    destinatario: z.string().optional(),
    destinatarioId: z.string().optional(),
    tomador: z.string().min(1, 'O tomador do frete (pagador) é obrigatório.'),
    tomadorId: z.string().optional(),
    responsavelSolicitante: z.string().optional(),
    contato: z.string().optional(),
    email: z.string().email({ message: "E-mail inválido." }).optional().or(z.literal('')),
    obs: z.string().optional(),
    quantidade: z.coerce.number().optional(),
    peso: z.coerce.number().optional(),
    cubagem: z.coerce.number().optional(),
    isRuralOrigem: z.boolean().optional(),
    isRuralDestino: z.boolean().optional(),
    nfNumber: z.string().optional(),
    nfeXml: z.string().optional(),
    nfeChave: z.string().optional(),
    cargoType: z.string().optional().default('Geral'),
});

// Schema for 'dedicado' mode
const dedicadoSchema = baseSchema.extend({
    veiculo: z.string().min(1, 'Selecione um veículo.'),
    valorFrete: z.coerce.number().optional(),
    prazoEntrega: z.coerce.number().optional(),
});

// Schema for 'fracionado' mode
const fracionadoSchema = baseSchema.extend({
    valorFrete: z.coerce.number().optional(),
    veiculo: z.string().optional(),
    prazoEntrega: z.coerce.number().optional(),
});

// Schema for 'armazenagem' mode
const armazenagemSchema = z.object({
    usuario: z.string({ required_error: 'Selecione um usuário.' }).min(1, 'Selecione um usuário.'),
    tomador: z.string().min(1, 'O nome do cliente é obrigatório.'),
    tomadorId: z.string().optional(),
    remetente: z.string().optional(),
    responsavelSolicitante: z.string().optional(),
    contato: z.string().optional(),
    email: z.string().email({ message: "E-mail inválido." }).optional().or(z.literal('')),
    obs: z.string().optional(),
    quantidade: z.coerce.number().min(1, 'Informe ao menos 1 posição (palete).'),
    peso: z.coerce.number().optional(),
    cubagem: z.coerce.number().optional(),
    prazoEntrega: z.coerce.number().min(1, 'Informe o período de armazenagem em dias.'),
    // Freight-only fields as optional so they don't break form reset
    cidadeOrigem: z.string().optional(),
    cidadeDestino: z.string().optional(),
    valorProduto: z.coerce.number().optional(),
    veiculo: z.string().optional(),
    isRuralOrigem: z.boolean().optional(),
    isRuralDestino: z.boolean().optional(),
    valorFrete: z.coerce.number().optional(),
    incluirDescarga: z.boolean().optional(),
});

type FreightFormProps = {
    onCalculate: (data: any, company: Company | null) => void;
    isLoading: boolean;
    currentUser: AuthUser;
    users: AuthUser[];
    vehicles: Vehicle[];
    companies: Company[];
    mode: FreightMode;
    setMode: (mode: FreightMode) => void;
    isRoundTrip: boolean;
    setIsRoundTrip: (checked: boolean) => void;
    initialData?: Quote | null;
    isEditing?: boolean;
    canSwitchMode?: boolean;
    readOnlyUsuario?: string;
    hideQuickSave?: boolean;
    onCloneQuote?: (quote: Quote) => void;
    onExtrasClick?: () => void;
};

export interface FreightFormHandle {
    reset: () => void;
    getValues: () => any;
    prefill: (data: Partial<Quote>) => void;
}

interface CubageItem {
    id: number;
    length: number;
    width: number;
    height: number;
    quantity: number;
}

export const FreightForm = forwardRef<FreightFormHandle, FreightFormProps>(({ onCalculate, isLoading, currentUser, users, vehicles, companies, mode, setMode, isRoundTrip, setIsRoundTrip, initialData, isEditing, canSwitchMode, readOnlyUsuario, hideQuickSave, onCloneQuote, onExtrasClick }, ref) => {
    const { fetchAddressByCnpj, fetchAddressByCep, pricingSettings } = useAuth();
    const isAdmin = currentUser?.role === 'admin';
    const isCliente = currentUser?.role === 'cliente' || currentUser?.role === 'sub-cliente';
    const { toast } = useToast();
    const isArmazenagem = mode === 'armazenagem';
    const [activeCalculateGlow, setActiveCalculateGlow] = useState(false);
    const triggerCalculateClickAnimation = () => {
        setActiveCalculateGlow(true);
        setTimeout(() => setActiveCalculateGlow(false), 800);
    };

    const [fullAddressOrigem, setFullAddressOrigem] = useState<string | undefined>(undefined);
    const [fullAddressDestino, setFullAddressDestino] = useState<string | undefined>(undefined);
    const [isFetchingCnpj, setIsFetchingCnpj] = useState(false);
    const [maskedValue, setMaskedValue] = useState('R$ 0,00');
    const [maskedValorFrete, setMaskedValorFrete] = useState('R$ 0,00');
    const [incluirDescarga, setIncluirDescarga] = useState(true);

    const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);
    const [searchFieldTarget, setSearchFieldTarget] = useState<'origem' | 'destino' | 'tomador' | null>(null);
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');
    const [customerSearchResults, setCustomerSearchResults] = useState<Company[]>([]);
    const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);

    const [isResponsibleSelectOpen, setIsResponsibleSelectOpen] = useState(false);
    const [availableResponsibles, setAvailableResponsibles] = useState<any[]>([]);
    const [pendingCustomer, setPendingCustomer] = useState<Company | null>(null);

    // Nfe Attachment Dialog State
    const [isNfeAttachmentOpen, setIsNfeAttachmentOpen] = useState(false);

    // Cubage Calculator Input Refs
    const cubageQtyRef = useRef<HTMLInputElement>(null);
    const cubageHeightRef = useRef<HTMLInputElement>(null);
    const cubageWidthRef = useRef<HTMLInputElement>(null);
    const cubageLengthRef = useRef<HTMLInputElement>(null);

    // Clone dialog state
    const [isCloneDialogOpen, setIsCloneDialogOpen] = useState(false);
    const [cloneSearchTerm, setCloneSearchTerm] = useState('');
    const [cloneSearchResult, setCloneSearchResult] = useState<Quote | null>(null);
    const [isSearchingClone, setIsSearchingClone] = useState(false);
    const [cloneSearchError, setCloneSearchError] = useState<string | null>(null);

    // Custom XML preview states
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [parsedXmlData, setParsedXmlData] = useState<ParsedNfeData | null>(null);

    // ANTT Calculation Result Dialog State
    const [isAnttResultOpen, setIsAnttResultOpen] = useState(false);
    const [anttCalcResult, setAnttCalcResult] = useState<{
        total: number;
        ccd: number;
        cc: number;
        axles: number;
        distanceKm: number;
        durationHours: number;
        cargoType: string;
        vehicleName?: string;
    } | null>(null);

    const formSchema = useMemo(() => {
        if (mode === 'armazenagem') return armazenagemSchema;
        let schema: any = mode === 'dedicado' ? dedicadoSchema : fracionadoSchema;

        if (isCliente) {
            schema = schema.extend({
                cubagem: z.coerce.number({ invalid_type_error: ' ' })
                    .min(0.001, 'A cubagem detalhada é obrigatória (use o botão de caixa).')
            });
            if (mode === 'fracionado') {
                schema = schema.extend({
                    valorFrete: z.coerce.number().optional(),
                    prazoEntrega: z.coerce.number().optional(),
                });
            }
        }
        return schema;
    }, [mode, isCliente]);

    const defaultValues = {
        usuario: currentUser.username,
        remetente: '',
        remetenteId: '',
        cidadeOrigem: '',
        cidadeDestino: '',
        valorProduto: 0,
        destinatario: '',
        destinatarioId: '',
        tomador: '',
        tomadorId: '',
        responsavelSolicitante: '',
        contato: '',
        email: '',
        obs: '',
        valorFrete: '' as any,
        prazoEntrega: '' as any,
        veiculo: '',
        peso: '' as any,
        cubagem: '' as any,
        quantidade: '' as any,
        isRuralDestino: false,
        cargoType: 'Geral',
        nfeChave: '',
    };

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: defaultValues,
    });

    useImperativeHandle(ref, () => ({
        reset() {
            form.reset(defaultValues);
            setMaskedValue('R$ 0,00');
            setMaskedValorFrete('R$ 0,00');
            setFullAddressOrigem(undefined);
            setFullAddressDestino(undefined);
            // Reset cubage state
            setCubageItems([]);
            setNewItem({ length: 0, width: 0, height: 0, quantity: 1 });
            setTotalCubage(null);
            setTotalCubedWeight(null);
            setSuggestedVehicle(null);
            setIncluirDescarga(true);
        },
        getValues() {
            return form.getValues();
        },
        prefill(data: Partial<Quote>) {
            if (data.cidadeOrigem) form.setValue('cidadeOrigem', data.cidadeOrigem, { shouldValidate: true });
            if (data.cidadeDestino) form.setValue('cidadeDestino', data.cidadeDestino, { shouldValidate: true });
            if (data.remetente) form.setValue('remetente', data.remetente, { shouldValidate: true });
            if (data.remetenteId) form.setValue('remetenteId', data.remetenteId);
            if (data.destinatario) form.setValue('destinatario', data.destinatario, { shouldValidate: true });
            if (data.destinatarioId) form.setValue('destinatarioId', data.destinatarioId);
            if (data.tomador) form.setValue('tomador', data.tomador, { shouldValidate: true });
            if (data.tomadorId) form.setValue('tomadorId', data.tomadorId);

            if (data.valorProduto) {
                form.setValue('valorProduto', data.valorProduto, { shouldValidate: true });
                setMaskedValue(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.valorProduto));
            }
            if (data.peso) form.setValue('peso', data.peso, { shouldValidate: true });
            if (data.quantidade) form.setValue('quantidade', data.quantidade, { shouldValidate: true });
            if (data.cubagem) form.setValue('cubagem', data.cubagem, { shouldValidate: true });
            if (data.veiculo && mode === 'dedicado') form.setValue('veiculo', data.veiculo, { shouldValidate: true });
            if (data.valorBaseManual !== undefined) {
                form.setValue('valorFrete', data.valorBaseManual, { shouldValidate: true });
                setMaskedValorFrete(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.valorBaseManual));
            } else if (data.hasManualBaseFreight === undefined && data.freightMode !== 'fracionado' && data.totalFrete) {
                form.setValue('valorFrete', data.totalFrete, { shouldValidate: true });
                setMaskedValorFrete(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.totalFrete));
            } else {
                form.setValue('valorFrete', undefined as any, { shouldValidate: true });
                setMaskedValorFrete('R$ 0,00');
            }
            if (data.obs) form.setValue('obs', data.obs, { shouldValidate: true });
            if (data.enderecoColeta) setFullAddressOrigem(data.enderecoColeta);
            if (data.enderecoEntrega) setFullAddressDestino(data.enderecoEntrega);
            if (data.prazoEntrega) form.setValue('prazoEntrega', data.prazoEntrega, { shouldValidate: true });
            
            if (data.nfNumber) form.setValue('nfNumber', data.nfNumber);
            if (data.nfeXml) form.setValue('nfeXml', data.nfeXml);
            if (data.nfeChave) form.setValue('nfeChave', data.nfeChave);
        }
    }));

    const handleXmlObtained = (xmlContent: string) => {
        const parsed = parseNfeXml(xmlContent);
        if (parsed) {
            setParsedXmlData({ ...parsed, _rawXml: xmlContent } as any);
            setIsPreviewOpen(true);
        } else {
            toast({ variant: "destructive", title: "Erro no XML", description: "Falha ao processar a estrutura do XML." });
        }
    };

    const handleConfirmXmlImport = async () => {
        if (!parsedXmlData) return;
        
        const parsed = parsedXmlData;
        const prefillData: Partial<Quote> = {};

        // Auto-save/Lookup emitente and destinatario in parallel
        let emitenteId = '';
        let destinatarioId = '';

        const getOrRegisterCustomer = async (party: any, typeLabel: string): Promise<string> => {
            if (!party || !party.cnpjCpf) return '';
            const cleanCnpj = party.cnpjCpf.replace(/[^\d]/g, '');
            if (!cleanCnpj) return '';
            
            try {
                // 1. Tries GET /api/cnpj/${cleanCnpj} to find the customer
                const res = await fetch(`/api/cnpj/${cleanCnpj}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.id) {
                        return data.id;
                    }
                }
                
                // 2. If not found (404/500), make a POST /api/customers call to register the customer
                const isPJ = cleanCnpj.length > 11;
                const customerPayload = {
                    cnpj: cleanCnpj,
                    razaoSocial: party.nome || `Cliente ${typeLabel}`,
                    nomeFantasia: party.nome || `Cliente ${typeLabel}`,
                    endereco: party.endereco || '',
                    cidade: party.cidade || '',
                    estado: party.estado || '',
                    cep: party.cep || '',
                    codigo_ibge: party.cMun || null,
                    telefone: '',
                    email: '',
                    inscricaoEstadual: party.ie || (isPJ ? 'ISENTO' : ''),
                    type: isPJ ? 'PJ' : 'PF'
                };
                
                const registerRes = await fetch('/api/customers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(customerPayload)
                });
                
                if (registerRes.ok) {
                    const data = await registerRes.json();
                    if (data && data.id) {
                        return data.id;
                    }
                } else if (registerRes.status === 409) {
                    // 3. If a 409 conflict occurs (duplicate), query GET /api/customers?term=${cleanCnpj}
                    const searchRes = await fetch(`/api/customers?term=${cleanCnpj}`);
                    if (searchRes.ok) {
                        const list = await searchRes.json();
                        if (list && list.length > 0 && list[0].id) {
                            return list[0].id;
                        }
                    }
                }
            } catch (err) {
                console.error(`Erro ao obter/registrar cliente (${typeLabel}):`, err);
            }
            return '';
        };

        try {
            const [emitId, destId] = await Promise.all([
                getOrRegisterCustomer(parsed.emitente, 'Emitente'),
                getOrRegisterCustomer(parsed.destinatario, 'Destinatário')
            ]);
            emitenteId = emitId;
            destinatarioId = destId;
        } catch (err) {
            console.error("Erro ao auto-salvar empresas do XML", err);
        }

        setIsPreviewOpen(false);

        if (parsed.emitente.nome) prefillData.remetente = parsed.emitente.nome;
        if (emitenteId) prefillData.remetenteId = emitenteId;
        if (parsed.emitente.cidade && parsed.emitente.estado) prefillData.cidadeOrigem = `${parsed.emitente.cidade} - ${parsed.emitente.estado}`;
        if (parsed.emitente.endereco) prefillData.enderecoColeta = `${parsed.emitente.endereco}, ${parsed.emitente.cep}`;

        if (parsed.destinatario.nome) prefillData.destinatario = parsed.destinatario.nome;
        if (destinatarioId) prefillData.destinatarioId = destinatarioId;
        if (parsed.destinatario.cidade && parsed.destinatario.estado) prefillData.cidadeDestino = `${parsed.destinatario.cidade} - ${parsed.destinatario.estado}`;
        if (parsed.destinatario.endereco) prefillData.enderecoEntrega = `${parsed.destinatario.endereco}, ${parsed.destinatario.cep}`;
        
        if (parsed.vNF) prefillData.valorProduto = parsed.vNF; // vNF or vProd mapping
        if (parsed.pesoB) prefillData.peso = parsed.pesoB;
        if (parsed.qVol) prefillData.quantidade = parsed.qVol;
        
        if (parsed.emitente.nome) prefillData.tomador = parsed.emitente.nome;
        if (emitenteId) prefillData.tomadorId = emitenteId;

        prefillData.nfNumber = parsed.nNF;
        prefillData.nfeXml = (parsed as any)._rawXml;
        if (parsed.chNFe) prefillData.nfeChave = parsed.chNFe;

        if (ref && typeof ref === 'function') {
            // Unlikely since we use it as ObjectRef
        } else if (ref && ref.current) {
            (ref as any).current.prefill(prefillData);
        }
        
        toast({ title: "XML Processado", description: "O formulário foi preenchido e as empresas foram salvas com sucesso!" });
        setParsedXmlData(null);
    };

    const handleCurrencyChange = (e: ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        const numericValue = Number(rawValue) / 100;
        setMaskedValue(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numericValue));
        form.setValue('valorProduto', numericValue, { shouldValidate: true });
    };

    const handleValorFreteChange = (e: ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        const numericValue = Number(rawValue) / 100;
        setMaskedValorFrete(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numericValue));
        form.setValue('valorFrete', numericValue, { shouldValidate: true });
    };

    const handleAddressLookup = async (field: 'cidadeOrigem' | 'cidadeDestino', value: string) => {
        const cleanValue = value.replace(/[^\d]/g, '');
        if (cleanValue.length !== 8 && cleanValue.length !== 14) return;

        setIsFetchingCnpj(true);
        try {
            let addressInfo;
            if (cleanValue.length === 8) {
                addressInfo = await fetchAddressByCep(cleanValue);
            } else {
                addressInfo = await fetchAddressByCnpj(cleanValue);
            }

            if (addressInfo) {
                const formattedCity = `${addressInfo.city}, ${addressInfo.state}`;
                form.setValue(field, formattedCity, { shouldValidate: true });

                if (field === 'cidadeOrigem') {
                    if (addressInfo.razaoSocial) form.setValue('remetente', addressInfo.razaoSocial);
                    if (addressInfo.id) form.setValue('remetenteId', addressInfo.id);
                    setFullAddressOrigem(addressInfo.endereco);
                } else {
                    if (addressInfo.razaoSocial) form.setValue('destinatario', addressInfo.razaoSocial);
                    if (addressInfo.id) form.setValue('destinatarioId', addressInfo.id);
                    setFullAddressDestino(addressInfo.endereco);
                }
                toast({ title: 'Endereço encontrado!', description: 'Dados carregados com sucesso.' });
            }
        } finally {
            setIsFetchingCnpj(false);
        }
    };

    const handleOpenCustomerSearch = (target: 'origem' | 'destino') => {
        setSearchFieldTarget(target);
        setCustomerSearchTerm('');
        setCustomerSearchResults([]);
        setIsCustomerSearchOpen(true);
    };

    const handleCustomerSearch = async () => {
        if (customerSearchTerm.length < 2) {
            setCustomerSearchResults([]);
            return;
        }
        setIsSearchingCustomers(true);
        try {
            const response = await fetch(`/api/customers/search?term=${encodeURIComponent(customerSearchTerm)}`);
            if (response.ok) {
                setCustomerSearchResults(await response.json());
            } else {
                setCustomerSearchResults([]);
            }
        } catch (e) {
            setCustomerSearchResults([]);
            toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao buscar clientes.' });
        } finally {
            setIsSearchingCustomers(false);
        }
    };

    const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
    const [routeResult, setRouteResult] = useState<{distanceKm: number, durationHours: number} | null>(null);

    const handleCalculateRoute = async () => {
        const origin = form.getValues('cidadeOrigem');
        const dest = form.getValues('cidadeDestino');
        if (!origin || !dest) {
            toast({ title: 'Aviso', description: 'Preencha a cidade de Origem e de Destino (via CEP, CNPJ ou Nome) para calcular a rota logística.'});
            return;
        }
        setIsCalculatingRoute(true);
        try {
            const res = await fetch(`/api/location/route?origin=${encodeURIComponent(origin)}&dest=${encodeURIComponent(dest)}`);
            const data = await res.json();
            if (res.ok) {
                setRouteResult(data);
                
                let vehicleKey = form.getValues('veiculo');
                let suggestedVehicleName = '';

                // Se for fracionado, tenta encontrar o melhor veículo baseado no peso/cubagem
                if (mode === 'fracionado') {
                    const weight = Number(form.getValues('peso')) || 0;
                    const cubage = Number(form.getValues('cubagem')) || 0;
                    const bestFit = findBestFitVehicle(weight, cubage, vehicles, cubageItems, stackItems);
                    if (bestFit) {
                        vehicleKey = bestFit.key;
                        suggestedVehicleName = bestFit.displayName;
                    }
                }
                
                if (vehicleKey) {
                    try {
                        const cargoType = form.getValues('cargoType') || 'Geral';
                        const anttRes = await fetch(`/api/antt/calculate?distance=${data.distanceKm}&vehicleKey=${vehicleKey}&cargoType=${cargoType}&isRoundTrip=${isRoundTrip}`);
                        if (anttRes.ok) {
                            const anttData = await anttRes.json();
                            setAnttCalcResult({
                                ...anttData,
                                distanceKm: data.distanceKm,
                                durationHours: data.durationHours,
                                vehicleName: suggestedVehicleName || vehicles.find(v => v.key === vehicleKey)?.displayName
                            });
                            setIsAnttResultOpen(true);
                        }
                    } catch (e) {
                        console.error('Erro ao calcular ANTT na rota:', e);
                        toast({ variant: 'destructive', title: 'Erro ANTT', description: 'Não foi possível calcular o piso mínimo.' });
                    }
                } else {
                    toast({ 
                        title: 'Rota Encontrada!', 
                        description: `Distância: ${data.distanceKm} Km. (Configure peso/cubagem para sugerirmos um veículo para o cálculo ANTT).` 
                    });
                }
                
                const currentPrazo = form.getValues('prazoEntrega');
                if (!currentPrazo) {
                    const diasExtrapolados = Math.max(1, Math.ceil(data.durationHours / 10));
                    form.setValue('prazoEntrega', diasExtrapolados, { shouldValidate: true });
                }
            } else {
                toast({ variant: 'destructive', title: 'Erro de Rota', description: data.error || 'Nenhuma rota factível encontrada pelas vias.' });
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erro de Rede', description: 'Falha ao contatar a inteligência de roteamento.' });
        } finally {
            setIsCalculatingRoute(false);
        }
    };

    const useAnttValue = () => {
        if (anttCalcResult) {
            const val = anttCalcResult.total;
            form.setValue('valorFrete', val, { shouldValidate: true });
            setMaskedValorFrete(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val));
            setIsAnttResultOpen(false);
            toast({ title: 'Valor Aplicado', description: 'O valor do frete mínimo ANTT foi aplicado ao formulário.' });
        }
    };

    const applyCustomerData = (customer: Company, responsible?: any) => {
        if (!searchFieldTarget) return;

        const city = `${customer.cidade}, ${customer.estado}`;
        if (searchFieldTarget === 'origem') {
            form.setValue('cidadeOrigem', city, { shouldValidate: true });
            form.setValue('remetente', customer.razaoSocial, { shouldValidate: true });
            form.setValue('remetenteId', customer.id, { shouldValidate: true });
            setFullAddressOrigem(customer.endereco);
        } else if (searchFieldTarget === 'destino') {
            form.setValue('cidadeDestino', city, { shouldValidate: true });
            form.setValue('destinatario', customer.razaoSocial, { shouldValidate: true });
            form.setValue('destinatarioId', customer.id, { shouldValidate: true });
            setFullAddressDestino(customer.endereco);
        } else if (searchFieldTarget === 'tomador') {
            form.setValue('tomador', customer.razaoSocial, { shouldValidate: true });
            form.setValue('tomadorId', customer.id);
        }

        if (responsible) {
            form.setValue('responsavelSolicitante', responsible.name, { shouldValidate: true });
            form.setValue('email', responsible.email, { shouldValidate: true });
            form.setValue('contato', responsible.phone || '', { shouldValidate: true });
        }

        setIsCustomerSearchOpen(false);
        setIsResponsibleSelectOpen(false);
        setPendingCustomer(null);
        setAvailableResponsibles([]);
    };

    // Handler for storage mode: search by tomador
    const handleStorageCustomerSearch = async () => {
        if (customerSearchTerm.length < 2) {
            setCustomerSearchResults([]);
            return;
        }
        setIsSearchingCustomers(true);
        try {
            const response = await fetch(`/api/customers/search?term=${encodeURIComponent(customerSearchTerm)}`);
            if (response.ok) {
                setCustomerSearchResults(await response.json());
            } else {
                setCustomerSearchResults([]);
            }
        } catch (e) {
            setCustomerSearchResults([]);
        } finally {
            setIsSearchingCustomers(false);
        }
    };

    const handleSelectStorageCustomer = (customer: Company) => {
        form.setValue('tomador', customer.razaoSocial, { shouldValidate: true });
        form.setValue('tomadorId', customer.id);
        if (customer.contacts && customer.contacts.length > 0) {
            const contact = customer.contacts[0];
            form.setValue('responsavelSolicitante', contact.name || '', { shouldValidate: true });
            form.setValue('email', contact.email || '', { shouldValidate: true });
            form.setValue('contato', contact.phone || '', { shouldValidate: true });
        }
        setIsCustomerSearchOpen(false);
    };

    const handleSelectCustomer = (customer: Company) => {
        if (!searchFieldTarget) return;

        const contacts = customer.contacts || [];

        if (contacts.length === 1) {
            applyCustomerData(customer, contacts[0]);
        } else if (contacts.length > 1) {
            setAvailableResponsibles(contacts);
            setPendingCustomer(customer);
            setIsResponsibleSelectOpen(true);
            setIsCustomerSearchOpen(false);
        } else {
            applyCustomerData(customer);
        }
    };

    const getUfFromCityString = (cityString: string): string | null => {
        const match = cityString.match(/[,\-\/]\s*([A-Z]{2})$/i);
        return match ? match[1].toUpperCase() : null;
    }

    const watchedOrigem = form.watch('cidadeOrigem');
    const watchedDestino = form.watch('cidadeDestino');
    const watchedRemetente = form.watch('remetente');
    const watchedTomador = form.watch('tomador');

    useEffect(() => {
        if (isArmazenagem) return;
        const cleanValue = (watchedOrigem || '').replace(/[^\d]/g, '');
        if (cleanValue.length === 14 || cleanValue.length === 8) {
            handleAddressLookup('cidadeOrigem', cleanValue);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [watchedOrigem]);

    useEffect(() => {
        if (isArmazenagem) return;
        const cleanValue = (watchedDestino || '').replace(/[^\d]/g, '');
        if (cleanValue.length === 14 || cleanValue.length === 8) {
            handleAddressLookup('cidadeDestino', cleanValue);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [watchedDestino]);

    const selectedCompany = useMemo(() => {
        return companies.find(c => c.razaoSocial === watchedTomador) || null;
    }, [companies, watchedTomador]);

    useEffect(() => {
        if (initialData) {
            const valorProduto = initialData.valorProduto || 0;
            
            let valorFretePreenchido: number | undefined = undefined;
            if (initialData.valorBaseManual !== undefined) {
                valorFretePreenchido = initialData.valorBaseManual;
            } else if (initialData.hasManualBaseFreight === undefined && initialData.freightMode !== 'fracionado' && initialData.totalFrete) {
                valorFretePreenchido = initialData.totalFrete;
            }

            let matchedVehicleKey = '';
            if (initialData.veiculo && initialData.veiculo !== 'Fracionado' && initialData.veiculo !== 'Armazenagem') {
                const matched = vehicles.find(v => v.name === initialData.veiculo || v.displayName === initialData.veiculo || v.key === initialData.veiculo);
                if (matched) matchedVehicleKey = matched.key;
            }

            const resetData = {
                ...defaultValues,
                ...initialData,
                destinatario: initialData.destinatario || initialData.empresaDestino || '',
                usuario: initialData.usuario || currentUser.username,
                valorFrete: valorFretePreenchido,
                valorProduto: valorProduto,
                isRuralOrigem: initialData.isRuralOrigem || false,
                isRuralDestino: initialData.isRuralDestino || false,
                veiculo: matchedVehicleKey || initialData.veiculo || '',
                prazoEntrega: initialData.prazoEntrega || '',
            };
            form.reset(resetData);
            setMaskedValue(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorProduto));
            setMaskedValorFrete(valorFretePreenchido !== undefined ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorFretePreenchido) : 'R$ 0,00');
            setFullAddressOrigem(initialData.enderecoColeta);
            setFullAddressDestino(initialData.enderecoEntrega);

            if (initialData.cubageItems && Array.isArray(initialData.cubageItems)) {
                setCubageItems(initialData.cubageItems as CubageItem[]);
            } else {
                setCubageItems([]);
            }
        } else {
            form.reset(defaultValues);
            setMaskedValue('R$ 0,00');
            setMaskedValorFrete('R$ 0,00');
            setFullAddressOrigem(undefined);
            setFullAddressDestino(undefined);
            setCubageItems([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialData, form]);

    useEffect(() => {
        if (initialData?.veiculo && initialData.veiculo !== 'Fracionado' && initialData.veiculo !== 'Armazenagem' && vehicles.length > 0) {
            const currentVeiculo = form.getValues('veiculo');
            const target = initialData.veiculo.trim().toLowerCase();
            const matched = vehicles.find(v =>
                v.name.trim().toLowerCase() === target ||
                v.displayName.trim().toLowerCase() === target ||
                v.key.trim().toLowerCase() === target
            );
            if (matched && currentVeiculo !== matched.key) {
                form.setValue('veiculo', matched.key);
            }
        }
    }, [vehicles, initialData, form]);

    useEffect(() => {
        if (isEditing) return;
        const currentValues = form.getValues();
        if (currentValues.cidadeOrigem || currentValues.cidadeDestino || currentValues.remetente || currentValues.tomador) {
            form.reset({
                ...currentValues,
                veiculo: '',
                cidadeOrigem: isArmazenagem ? '' : currentValues.cidadeOrigem,
                cidadeDestino: isArmazenagem ? '' : currentValues.cidadeDestino,
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode]);

    const [isCubageDialogOpen, setIsCubageDialogOpen] = useState(false);
    const [cubageItems, setCubageItems] = useState<CubageItem[]>([]);
    const [newItem, setNewItem] = useState({ length: 0, width: 0, height: 0, quantity: 1 });
    const [totalCubage, setTotalCubage] = useState<number | null>(null);
    const [totalCubedWeight, setTotalCubedWeight] = useState<number | null>(null);
    const [suggestedVehicle, setSuggestedVehicle] = useState<{ key: string, name: string, cubagem?: string, peso?: string, comprimento?: number, largura?: number } | null>(null);
    const [stackItems, setStackItems] = useState(true);
    const [floorOccupancy, setFloorOccupancy] = useState<FloorOccupancyResult | null>(null);

    const FRACIONADO_TRUCK_WIDTH = 2.40; // Largura padrão referência para fracionado

    const updateTotals = (items: CubageItem[], forceStackMode?: boolean) => {
        const shouldStack = forceStackMode !== undefined ? forceStackMode : stackItems;
        const total = items.reduce((acc, item) => {
            return acc + (item.length * item.width * item.height * item.quantity);
        }, 0);
        const cubedWeight = total * 300;
        const totalQuantity = items.reduce((acc, item) => acc + item.quantity, 0);

        setTotalCubage(total);
        setTotalCubedWeight(cubedWeight);

        form.setValue('cubagem', parseFloat(total.toFixed(3)) || 0);
        form.setValue('quantidade', totalQuantity || 0);

        // Calcular ocupação do piso quando "Empilhar?" está desmarcado
        if (!shouldStack && items.length > 0) {
            const refWidth = mode === 'fracionado' ? FRACIONADO_TRUCK_WIDTH : 2.60; // Largura referência
            const occupancy = calculateFloorOccupancy(items, refWidth, vehicles);
            setFloorOccupancy(occupancy);
        } else {
            setFloorOccupancy(null);
        }

        if (total > 0) {
            suggestVehicle(total, items, shouldStack);
        } else {
            setSuggestedVehicle(null);
            setFloorOccupancy(null);
        }
    };

    const handleCubageKeyDown = (e: React.KeyboardEvent, nextRef: React.RefObject<HTMLInputElement> | 'add') => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (nextRef === 'add') {
                handleAddItem();
            } else {
                nextRef.current?.focus();
            }
        }
    };

    const handleAddItem = () => {
        if (newItem.length > 0 && newItem.width > 0 && newItem.height > 0 && newItem.quantity > 0) {
            const updatedItems = [...cubageItems, { ...newItem, id: Date.now() }];
            setCubageItems(updatedItems);
            setNewItem({ length: 0, width: 0, height: 0, quantity: 1 });
            updateTotals(updatedItems);
            setTimeout(() => cubageQtyRef.current?.focus(), 0);
        } else {
            toast({ variant: 'destructive', title: 'Erro', description: 'Preencha todas as dimensões e a quantidade.' });
        }
    };

    const handleRemoveItem = (id: number) => {
        const updatedItems = cubageItems.filter(item => item.id !== id);
        setCubageItems(updatedItems);
        updateTotals(updatedItems);
    };

    const calculateTotalCubage = () => {
        updateTotals(cubageItems);
        if (mode === 'fracionado') {
            toast({ title: 'Cubagem Calculada!', description: `Os valores calculados foram inseridos no formulário.` });
        }
    };

    const suggestVehicle = (totalCubageValue: number, items: CubageItem[], shouldStack?: boolean) => {
        const weight = Number(form.getValues('peso')) || 0;
        const useStack = shouldStack !== undefined ? shouldStack : stackItems;
        
        // Calcular ocupação do piso para informar no fracionado
        if (!useStack && items.length > 0) {
            const refWidth = mode === 'fracionado' ? FRACIONADO_TRUCK_WIDTH : 2.60;
            const occupancy = calculateFloorOccupancy(items, refWidth, vehicles);
            setFloorOccupancy(occupancy);
        }

        if (mode === 'dedicado') {
            const suitableVehicle = findBestFitVehicle(weight, totalCubageValue, vehicles, items, useStack);
            
            if (suitableVehicle) {
                setSuggestedVehicle({
                    key: suitableVehicle.key,
                    name: suitableVehicle.displayName,
                    cubagem: suitableVehicle.cubagem,
                    peso: suitableVehicle.peso,
                    comprimento: suitableVehicle.comprimento,
                    largura: suitableVehicle.largura,
                });
            } else {
                setSuggestedVehicle(null);
                if (totalCubageValue > 0 || weight > 0) {
                    toast({ 
                        title: "Aviso de Compatibilidade", 
                        description: "Nenhum veículo disponível suporta o peso, cubagem ou dimensões informadas.",
                        variant: "destructive"
                    });
                }
            }
        } else {
            setSuggestedVehicle(null);
        }
    };

    const handleUseSuggestedVehicle = () => {
        if (suggestedVehicle && mode === 'dedicado') {
            form.setValue('veiculo', suggestedVehicle.key);
            setIsCubageDialogOpen(false);
            toast({ title: 'Sucesso!', description: `Veículo ${suggestedVehicle.name} selecionado.` });
        }
    };

    const handleFormSubmit = async (data: z.infer<typeof formSchema>) => {
        if (!isArmazenagem && isCliente) {
            if (cubageItems.length === 0) {
                toast({ variant: 'destructive', title: 'Cubagem Obrigatória', description: 'Por favor, abra a calculadora de cubagem (ícone de caixa) e insira o detalhamento dos itens.' });
                return;
            }
            const formVolumes = data.quantidade || 0;
            const cubageVolumes = cubageItems.reduce((acc, item) => acc + item.quantity, 0);
            if (formVolumes !== cubageVolumes) {
                toast({ variant: 'destructive', title: 'Volumes Incompatíveis', description: `A Quantidade (Volumes) informada (${formVolumes}) deve ser igual à soma de volumes na cubagem detalhada (${cubageVolumes}).` });
                return;
            }
        }

        if (isArmazenagem) {
            onCalculate({
                ...data,
                incluirDescarga,
                freightMode: 'armazenagem',
            }, selectedCompany);
            return;
        }

        // Validação ANTT para frete Dedicado
        if (mode === 'dedicado' && routeResult?.distanceKm && data.veiculo) {
            try {
                const cargoType = data.cargoType || 'Geral';
                const anttRes = await fetch(`/api/antt/calculate?distance=${routeResult.distanceKm}&vehicleKey=${data.veiculo}&cargoType=${cargoType}&isRoundTrip=${isRoundTrip}`);
                if (anttRes.ok) {
                    const anttData = await anttRes.json();
                    const totalFrete = data.valorFrete || 0;
                    const minFrete = anttData.total;

                    if (totalFrete < minFrete) {
                        toast({
                            variant: 'destructive',
                            title: 'Piso Mínimo Não Atingido!',
                            description: `O valor do frete (${totalFrete.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) está abaixo do mínimo regulamentado pela ANTT (${minFrete.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}).`,
                            duration: 6000
                        });
                    } else {
                        toast({
                            title: 'Conformidade ANTT OK',
                            description: `O frete está acima do piso mínimo de ${minFrete.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
                            className: 'bg-green-600 text-white border-green-700',
                            duration: 4000
                        });
                    }
                }
            } catch (e) {
                console.error('Erro na validação ANTT no submit:', e);
            }
        }

        // Auto-preencher observações com cubagem detalhada se o campo estiver vazio
        if (cubageItems.length > 0 && !data.obs?.trim()) {
            const cubageText = cubageItems.map(item => `${item.quantity}x [${item.height}m x ${item.width}m x ${item.length}m]`).join(', ');
            data.obs = `Cubagem: ${cubageText}`;
            form.setValue('obs', data.obs, { shouldValidate: true });
        }

        onCalculate({
            ...data,
            enderecoColeta: fullAddressOrigem,
            enderecoEntrega: fullAddressDestino,
            cubageItems: cubageItems.length > 0 ? cubageItems : undefined
        } as any, selectedCompany);
    };

    // Weight check logic
    const watchedVehicle = form.watch('veiculo');
    const watchedWeight = form.watch('peso');

    useEffect(() => {
        if (mode === 'dedicado' && watchedVehicle && watchedWeight) {
            const selectedVehicle = vehicles.find(v => v.key === watchedVehicle);
            if (selectedVehicle) {
                const maxWeightStr = selectedVehicle.peso.replace(/\D/g, '');
                const maxWeight = parseInt(maxWeightStr, 10);
                if (!isNaN(maxWeight) && watchedWeight > maxWeight) {
                    toast({
                        variant: "destructive",
                        title: "Peso Excedido",
                        description: `O peso de ${watchedWeight} kg ultrapassa a capacidade de ${maxWeight} kg do veículo ${selectedVehicle.name}.`,
                        duration: 5000,
                    });
                }
            }
        }
    }, [watchedVehicle, watchedWeight, vehicles, mode, toast]);


    const responsibleUsers = users.filter(u => u.role === 'admin' || u.role === 'user');

    const activeVehicles = useMemo(() => {
        const orderMap: Record<string, number> = {
            'fiorino': 1,
            'van': 2,
            'vuc': 3,
            'toco': 4,
            'truck': 5,
            'bi-truck': 6,
            'carreta': 7,
            'carreta-ls': 8,
            'bi-trem': 9,
            'prancha': 10
        };
        return [...vehicles]
            .filter(v => !v.disabled)
            .sort((a, b) => {
                const orderA = orderMap[a.key] || 99;
                const orderB = orderMap[b.key] || 99;
                if (orderA !== orderB) return orderA - orderB;
                return a.valorBase - b.valorBase;
            });
    }, [vehicles]);

    const CubageCalculatorDialog = (
        <Dialog open={isCubageDialogOpen} onOpenChange={setIsCubageDialogOpen}>
            <DialogTrigger asChild>
                <Button type="button" variant="outline" size="icon" className="shrink-0"><Box className="h-5 w-5" /></Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Calculadora de Cubagem</DialogTitle>
                    <DialogDescription>
                        Adicione itens para calcular a cubagem total.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
                    <div>
                        <h3 className="font-semibold mb-4">Adicionar Item</h3>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Input ref={cubageQtyRef} type="number" placeholder="Qtd" value={newItem.quantity || ''} onChange={e => setNewItem({ ...newItem, quantity: parseInt(e.target.value) })} onKeyDown={e => handleCubageKeyDown(e, cubageHeightRef)} className="sm:w-20" />
                            <Input ref={cubageHeightRef} type="number" placeholder="Altura (m)" step="0.01" value={newItem.height || ''} onChange={e => setNewItem({ ...newItem, height: parseFloat(e.target.value) })} onKeyDown={e => handleCubageKeyDown(e, cubageWidthRef)} />
                            <Input ref={cubageWidthRef} type="number" placeholder="Largura (m)" step="0.01" value={newItem.width || ''} onChange={e => setNewItem({ ...newItem, width: parseFloat(e.target.value) })} onKeyDown={e => handleCubageKeyDown(e, cubageLengthRef)} />
                            <Input ref={cubageLengthRef} type="number" placeholder="Comprimento (m)" step="0.01" value={newItem.length || ''} onChange={e => setNewItem({ ...newItem, length: parseFloat(e.target.value) })} onKeyDown={e => handleCubageKeyDown(e, 'add')} />
                        </div>
                        <Button type="button" onClick={handleAddItem} className="mt-4 w-full"><PlusCircle className="mr-2 h-4 w-4" /> Adicionar</Button>

                        <div className="flex items-center gap-2 mt-4 p-3 bg-muted/50 rounded-lg border">
                            <Checkbox
                                id="stackItems"
                                checked={stackItems}
                                onCheckedChange={(checked) => {
                                    const newVal = !!checked;
                                    setStackItems(newVal);
                                    if (cubageItems.length > 0 && totalCubage !== null) {
                                        updateTotals(cubageItems, newVal);
                                    }
                                }}
                            />
                            <label htmlFor="stackItems" className="text-sm font-medium cursor-pointer select-none">
                                Empilhar?
                            </label>
                            <span className="text-xs text-muted-foreground ml-auto">
                                {stackItems ? 'Itens podem ser empilhados' : 'Itens lado a lado no piso'}
                            </span>
                        </div>

                        <div className="mt-6">
                            <Button type="button" onClick={calculateTotalCubage} className="w-full" disabled={cubageItems.length === 0}>Calcular Cubagem</Button>
                            {(totalCubage !== null && totalCubedWeight !== null) && (
                                <div className="mt-4 p-4 bg-secondary rounded-lg text-center space-y-2">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-muted-foreground">Cubagem Total</p>
                                            <p className="text-2xl font-bold">{totalCubage.toFixed(3)} m³</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Peso Cubado</p>
                                            <p className="text-2xl font-bold">{totalCubedWeight.toFixed(2)} kg</p>
                                        </div>
                                    </div>

                                    {/* Informação de ocupação da carroceria (modo não empilhar) */}
                                    {!stackItems && floorOccupancy && (
                                        <div className="pt-3 border-t border-amber-500/30">
                                            <p className="text-sm font-semibold mb-2 flex items-center gap-1.5 justify-center">
                                                <Ruler className="h-4 w-4 text-amber-600" />
                                                <span className="text-amber-700 dark:text-amber-400">Ocupação da Carroceria (sem empilhar)</span>
                                            </p>
                                            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-left">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-sm text-muted-foreground">Comprimento ocupado:</span>
                                                    <span className="text-lg font-bold text-amber-700 dark:text-amber-400">
                                                        {floorOccupancy.totalLengthUsed.toFixed(2)}m
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-sm text-muted-foreground">Fileiras formadas:</span>
                                                    <span className="text-sm font-semibold">{floorOccupancy.rows.length}</span>
                                                </div>
                                                {floorOccupancy.rows.map((row, idx) => (
                                                    <div key={idx} className="text-xs text-muted-foreground border-t border-amber-200/50 dark:border-amber-800/50 pt-1 mt-1">
                                                        <span className="font-medium">Fileira {idx + 1}:</span> {row.items.length} peça(s) — Larg. {row.widthUsed.toFixed(2)}m × Comp. {row.lengthUsed.toFixed(2)}m
                                                    </div>
                                                ))}
                                                {mode === 'fracionado' && (
                                                    <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded text-xs text-blue-700 dark:text-blue-400">
                                                        <strong>Fracionado (ref. largura {FRACIONADO_TRUCK_WIDTH}m):</strong> Os itens ocupariam <strong>{floorOccupancy.totalLengthUsed.toFixed(2)} metros</strong> de carroceria.
                                                    </div>
                                                )}
                                            </div>
                                            {floorOccupancy.exceedsLargest && floorOccupancy.largestVehicle && (
                                                <div className="mt-2 p-2 bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-400 font-medium">
                                                    ⚠️ A carga ({floorOccupancy.totalLengthUsed.toFixed(2)}m) excede a maior carroceria cadastrada: {floorOccupancy.largestVehicle.name} ({floorOccupancy.largestVehicle.comprimento}m × {floorOccupancy.largestVehicle.largura}m)
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {mode === 'dedicado' && suggestedVehicle && (
                                        <div className="pt-3 border-t border-primary/20">
                                            <p className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                                                <Truck className="h-4 w-4 text-primary" />
                                                Veículo Sugerido: <span className="text-primary">{suggestedVehicle.name}</span>
                                                {!stackItems && <span className="text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded">sem empilhar</span>}
                                            </p>
                                            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-3">
                                                {suggestedVehicle.cubagem && (
                                                    <div className="flex items-center gap-1">
                                                        <Package className="h-3 w-3" />
                                                        <span>Cubagem: <strong>{suggestedVehicle.cubagem}</strong></span>
                                                    </div>
                                                )}
                                                {suggestedVehicle.peso && (
                                                    <div className="flex items-center gap-1">
                                                        <Weight className="h-3 w-3" />
                                                        <span>Peso: <strong>{suggestedVehicle.peso}</strong></span>
                                                    </div>
                                                )}
                                                {suggestedVehicle.comprimento ? (
                                                    <div className="flex items-center gap-1">
                                                        <Ruler className="h-3 w-3" />
                                                        <span>Comp.: <strong>{suggestedVehicle.comprimento}m</strong></span>
                                                    </div>
                                                ) : null}
                                                {suggestedVehicle.largura ? (
                                                    <div className="flex items-center gap-1">
                                                        <Ruler className="h-3 w-3" />
                                                        <span>Larg.: <strong>{suggestedVehicle.largura}m</strong></span>
                                                    </div>
                                                ) : null}
                                            </div>
                                            <Button size="sm" className="w-full" onClick={handleUseSuggestedVehicle}>Usar este veículo</Button>
                                        </div>
                                    )}
                                    {mode === 'fracionado' && (
                                        <div className="pt-2">
                                            <Button size="sm" className="mt-2" onClick={() => setIsCubageDialogOpen(false)}>Usar Valor Calculado</Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        <h3 className="font-semibold mb-4">Itens Adicionados</h3>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Item</TableHead>
                                    <TableHead>m³</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {cubageItems.length > 0 ? cubageItems.map(item => (
                                    <TableRow key={item.id}>
                                        <TableCell>{item.quantity}x ({item.height}x{item.width}x{item.length})</TableCell>
                                        <TableCell>{(item.length * item.width * item.height * item.quantity).toFixed(3)}</TableCell>
                                        <TableCell><Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center text-muted-foreground">Nenhum item adicionado</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );

    const AnttResultDialog = (
        <Dialog open={isAnttResultOpen} onOpenChange={setIsAnttResultOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Truck className="h-5 w-5 text-primary" />
                        Resultado do Frete Mínimo ANTT
                    </DialogTitle>
                    <DialogDescription>
                        Cálculo baseado na Resolução nº 6.046/2024 ({anttCalcResult?.cargoType}).
                    </DialogDescription>
                </DialogHeader>
                {anttCalcResult && (
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-secondary/50 rounded-lg">
                                <p className="text-xs text-muted-foreground uppercase font-semibold">Distância</p>
                                <p className="text-lg font-bold flex items-center gap-1">
                                    <Navigation className="h-4 w-4 text-primary" />
                                    {anttCalcResult.distanceKm} km
                                </p>
                            </div>
                            <div className="p-3 bg-secondary/50 rounded-lg">
                                <p className="text-xs text-muted-foreground uppercase font-semibold">Tempo Est.</p>
                                <p className="text-lg font-bold flex items-center gap-1">
                                    <Clock className="h-4 w-4 text-primary" />
                                    ~{anttCalcResult.durationHours} hrs
                                </p>
                            </div>
                        </div>

                        <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl text-center">
                            <p className="text-sm text-primary font-semibold uppercase tracking-wider mb-1">Valor do Piso Mínimo</p>
                            <p className="text-4xl font-black text-primary">
                                {anttCalcResult.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                            <div className="mt-2 flex justify-center gap-3 text-[10px] text-muted-foreground font-mono">
                                <span>CCD: {anttCalcResult.ccd.toFixed(4)}</span>
                                <span>CC: {anttCalcResult.cc.toFixed(2)}</span>
                                <span>Eixos: {anttCalcResult.axles}</span>
                            </div>
                        </div>

                        {anttCalcResult.vehicleName && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted p-2 rounded border">
                                <Truck className="h-3 w-3" />
                                <span>Veículo Base: <strong>{anttCalcResult.vehicleName}</strong></span>
                            </div>
                        )}

                        <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900">
                            <Info className="h-4 w-4 text-amber-600" />
                            <AlertDescription className="text-amber-700 dark:text-amber-400 text-xs">
                                {mode === 'fracionado' 
                                    ? "Deseja utilizar este valor calculado como Valor Base do Frete?" 
                                    : "Este valor é o piso regulamentado para a configuração de veículo selecionada."}
                            </AlertDescription>
                        </Alert>
                    </div>
                )}
                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="ghost" onClick={() => setIsAnttResultOpen(false)}>Fechar</Button>
                    {mode === 'fracionado' && (
                        <Button onClick={useAnttValue} className="gap-2">
                            <PlusCircle className="h-4 w-4" />
                            Usar este valor
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );

    // ── Card style per mode
    const cardStyle = isArmazenagem
        ? 'quote-card-armazenagem'
        : mode === 'dedicado'
        ? 'quote-card-dedicado'
        : 'quote-card-fracionado';

    return (
        <>
            <Card className={cn("shadow-lg freight-form-custom-theme", cardStyle)}>
                <CardHeader>
                    <div className="flex justify-between items-center flex-wrap gap-3">
                        <div className="flex items-center gap-2">
                            <CardTitle>{isEditing ? 'Editando Cotação' : 'Informações da Cotação'}</CardTitle>
                            {!isEditing && !isArmazenagem && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-muted-foreground hover:text-primary hover:border-primary/50" title="Ações rápidas para preencher o formulário">
                                            <PlusCircle className="h-4 w-4" />
                                            <span className="text-xs">Ações Rápidas</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-56">
                                        <DropdownMenuItem onClick={() => setIsNfeAttachmentOpen(true)}>
                                            <Upload className="mr-2 h-4 w-4" />
                                            <span>Importar dados via NF-e (XML/Chave)</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setIsCloneDialogOpen(true)}>
                                            <Copy className="mr-2 h-4 w-4" />
                                            <span>Clonar cotação existente</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={handleCalculateRoute} disabled={isCalculatingRoute}>
                                            {isCalculatingRoute ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Map className="mr-2 h-4 w-4" />}
                                            <span>Calcular Rota Logística (ORS)</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                            {!isEditing && !isArmazenagem && (
                                <NfeAttachmentDialog 
                                    isOpen={isNfeAttachmentOpen} 
                                    onOpenChange={setIsNfeAttachmentOpen} 
                                    onXmlObtained={handleXmlObtained}
                                    title="Importar dados da NF-e"
                                    description="Selecione um arquivo XML ou insira a chave de acesso para preencher o formulário automaticamente."
                                />
                            )}
                        </div>

                        {/* Mode selector: 3 buttons */}
                        {canSwitchMode && !isEditing && (
                            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className={cn(
                                        "h-8 px-3 text-xs font-medium rounded-md transition-all",
                                        mode === 'fracionado'
                                            ? 'bg-background shadow text-emerald-700 dark:text-emerald-400'
                                            : 'text-muted-foreground hover:text-foreground'
                                    )}
                                    onClick={() => setMode('fracionado')}
                                >
                                    <Layers className="h-3.5 w-3.5 mr-1.5" />
                                    Fracionado
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className={cn(
                                        "h-8 px-3 text-xs font-medium rounded-md transition-all",
                                        mode === 'dedicado'
                                            ? 'bg-background shadow text-blue-700 dark:text-blue-400'
                                            : 'text-muted-foreground hover:text-foreground'
                                    )}
                                    onClick={() => setMode('dedicado')}
                                >
                                    <Truck className="h-3.5 w-3.5 mr-1.5" />
                                    Dedicado
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className={cn(
                                        "h-8 px-3 text-xs font-medium rounded-md transition-all",
                                        mode === 'armazenagem'
                                            ? 'bg-background shadow text-indigo-700 dark:text-indigo-400'
                                            : 'text-muted-foreground hover:text-foreground'
                                    )}
                                    onClick={() => setMode('armazenagem')}
                                >
                                    <Warehouse className="h-3.5 w-3.5 mr-1.5" />
                                    Armazenagem
                                </Button>

                                {/* Round trip only for dedicado */}
                                {mode === 'dedicado' && (
                                    <div className="flex items-center gap-1.5 pl-3 border-l ml-1">
                                        <Checkbox
                                            id="round-trip-checkbox"
                                            checked={isRoundTrip}
                                            onCheckedChange={setIsRoundTrip}
                                        />
                                        <Label htmlFor="round-trip-checkbox" className="font-normal text-xs whitespace-nowrap">Ida e volta</Label>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-8">
                            {/* ── ARMAZENAGEM FIELDS ── */}
                            {isArmazenagem ? (
                                <div className="space-y-6">
                                    {/* Client info section */}
                                    <div>
                                        <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                            <Warehouse className="h-3.5 w-3.5" /> Serviço de Armazenagem
                                        </p>
                                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            <FormField control={form.control} name="usuario" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>{readOnlyUsuario ? 'Enviado por (Cliente)' : 'Usuário responsável'}</FormLabel>
                                                    {readOnlyUsuario ? (
                                                        <div className="flex items-center h-10 px-3 py-2 border rounded-md bg-muted/50 text-muted-foreground w-full">
                                                            <User className="mr-2 h-4 w-4" />
                                                            {readOnlyUsuario}
                                                        </div>
                                                    ) : (
                                                        <Select onValueChange={field.onChange} value={field.value} disabled={!isAdmin}>
                                                            <FormControl>
                                                                <SelectTrigger><SelectValue placeholder="-- Selecione --" /></SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {isAdmin ? (
                                                                    responsibleUsers.map(user => <SelectItem key={user.id} value={user.username}>{user.username}</SelectItem>)
                                                                ) : (
                                                                    <SelectItem key={currentUser.id} value={currentUser.username}>{currentUser.username}</SelectItem>
                                                                )}
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                                    <FormMessage />
                                                </FormItem>
                                            )} />

                                            <FormField control={form.control} name="tomador" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Cliente / Tomador</FormLabel>
                                                    <div className="flex gap-2">
                                                        <FormControl>
                                                            <Input placeholder="Nome da empresa cliente" {...field} />
                                                        </FormControl>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="icon"
                                                            className="shrink-0"
                                                            onClick={() => {
                                                                setSearchFieldTarget('tomador');
                                                                setCustomerSearchTerm('');
                                                                setCustomerSearchResults([]);
                                                                setIsCustomerSearchOpen(true);
                                                            }}
                                                            title="Buscar cliente cadastrado"
                                                        >
                                                            <Search className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />

                                            <FormField control={form.control} name="responsavelSolicitante" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Responsável Solicitante</FormLabel>
                                                    <div className="relative">
                                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                        <FormControl><Input placeholder="Nome do contato" {...field} className="pl-10" /></FormControl>
                                                    </div>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />

                                            <FormField control={form.control} name="contato" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Contato</FormLabel>
                                                    <FormControl><Input placeholder="Telefone/Celular" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />

                                            <FormField control={form.control} name="email" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>E-mail</FormLabel>
                                                    <FormControl><Input type="email" placeholder="E-mail do solicitante" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                        </div>
                                    </div>

                                    {/* Warehouse specifics */}
                                    <div>
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Detalhes da Carga</p>
                                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                                            <FormField control={form.control} name="prazoEntrega" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Período (dias)</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" min={1} placeholder="Ex: 30" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />

                                            <FormField control={form.control} name="quantidade" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Posições / Paletes</FormLabel>
                                                    <div className="relative">
                                                        <Box className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                        <FormControl><Input type="number" min={0} placeholder="Qtd posições" {...field} className="pl-10" /></FormControl>
                                                    </div>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />

                                            <FormField control={form.control} name="peso" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Peso Total (kg)</FormLabel>
                                                    <div className="relative">
                                                        <Weight className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                        <FormControl><Input type="number" min={0} placeholder="Kg" {...field} className="pl-10" /></FormControl>
                                                    </div>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />

                                            <FormField control={form.control} name="cubagem" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Cubagem (m³)</FormLabel>
                                                    <div className="relative">
                                                        <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                        <FormControl><Input type="number" step="0.001" min={0} placeholder="Ex: 1.25" {...field} className="pl-10" /></FormControl>
                                                    </div>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                        </div>
                                    </div>

                                    {/* Unloading toggle */}
                                    <div className="flex items-center gap-3 p-3 rounded-lg border border-indigo-100 bg-indigo-50/50">
                                        <Switch
                                            checked={incluirDescarga}
                                            onCheckedChange={setIncluirDescarga}
                                            id="incluir-descarga"
                                        />
                                        <Label htmlFor="incluir-descarga" className="font-normal cursor-pointer">
                                            Incluir Taxa de Carga/Descarga (movimentação)
                                        </Label>
                                    </div>

                                    {/* Obs */}
                                    <div>
                                        <FormField control={form.control} name="obs" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Observações</FormLabel>
                                                <FormControl><Textarea placeholder="Informações adicionais sobre a armazenagem..." {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    </div>
                                </div>
                            ) : (
                                // ── FREIGHT FIELDS (fracionado / dedicado) ──
                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                                    <FormField control={form.control} name="usuario" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{readOnlyUsuario ? 'Enviado por (Cliente)' : 'Usuário responsável'}</FormLabel>
                                            {readOnlyUsuario ? (
                                                <div className="flex items-center h-10 px-3 py-2 border rounded-md bg-muted/50 text-muted-foreground w-full">
                                                    <User className="mr-2 h-4 w-4" />
                                                    {readOnlyUsuario}
                                                </div>
                                            ) : (
                                                <Select onValueChange={field.onChange} value={field.value} disabled={!isAdmin}>
                                                    <FormControl>
                                                        <SelectTrigger><SelectValue placeholder="-- Selecione --" /></SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {isAdmin ? (
                                                            responsibleUsers.map(user => <SelectItem key={user.id} value={user.username}>{user.username}</SelectItem>)
                                                        ) : (
                                                            <SelectItem key={currentUser.id} value={currentUser.username}>{currentUser.username}</SelectItem>
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    <FormField control={form.control} name="cidadeOrigem" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Origem (CEP ou CNPJ)</FormLabel>
                                            <div className="flex items-center gap-2">
                                                <FormControl>
                                                    <Input
                                                        placeholder="Ex: Guarulhos, SP ou CNPJ/CEP"
                                                        {...field}
                                                        list="city-list"
                                                    />
                                                </FormControl>
                                                <Button type="button" variant="outline" size="icon" onClick={() => handleOpenCustomerSearch('origem')}><Search className="h-4 w-4" /></Button>
                                            </div>
                                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                                <Info className="h-3 w-3" /> Tipo identificado automaticamente pelo sistema.
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    <FormField control={form.control} name="remetente" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Remetente (Coleta)</FormLabel>
                                            <FormControl><Input placeholder="Nome da empresa" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    <FormField control={form.control} name="cidadeDestino" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Destino (CEP ou CNPJ)</FormLabel>
                                            <div className="flex items-center gap-2">
                                                <FormControl>
                                                    <Input
                                                        placeholder="Ex: Curitiba, PR ou CNPJ/CEP"
                                                        {...field}
                                                        list="city-list"
                                                    />
                                                </FormControl>
                                                <Button type="button" variant="outline" size="icon" onClick={() => handleOpenCustomerSearch('destino')}><Search className="h-4 w-4" /></Button>
                                            </div>
                                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                                <Info className="h-3 w-3" /> Tipo identificado automaticamente pelo sistema.
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    <FormField control={form.control} name="destinatario" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Destinatário (Entrega)</FormLabel>
                                            <FormControl><Input placeholder="Nome da empresa" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    <datalist id="city-list">
                                        {cityList.map(city => <option key={city} value={city} />)}
                                    </datalist>

                                    <FormField control={form.control} name="tomador" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Tomador do Frete (Pagador)</FormLabel>
                                            <div className="flex items-center gap-1">
                                                <FormControl><Input placeholder="Nome da empresa pagadora" {...field} /></FormControl>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    className="shrink-0"
                                                    onClick={() => {
                                                        setSearchFieldTarget('tomador');
                                                        setCustomerSearchTerm('');
                                                        setCustomerSearchResults([]);
                                                        setIsCustomerSearchOpen(true);
                                                    }}
                                                    title="Buscar tomador cadastrado"
                                                >
                                                    <Search className="h-4 w-4" />
                                                </Button>
                                                <Button type="button" variant="outline" size="icon" onClick={() => form.setValue('tomador', form.getValues('remetente'))} title="Usar Remetente"><ArrowLeft className="h-4 w-4" /></Button>
                                                <Button type="button" variant="outline" size="icon" onClick={() => form.setValue('tomador', form.getValues('destinatario'))} title="Usar Destinatário"><ArrowRight className="h-4 w-4" /></Button>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    {!isCliente && (
                                        <FormField control={form.control} name="responsavelSolicitante" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Responsável Solicitante</FormLabel>
                                                <div className="relative">
                                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                    <FormControl><Input placeholder="Nome do contato" {...field} className="pl-10" /></FormControl>
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    )}



                                    <FormField control={form.control} name="cargoType" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Tipo de Carga (ANTT)</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger><SelectValue placeholder="Geral" /></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="Geral">Carga Geral</SelectItem>
                                                    <SelectItem value="Granel Sólido">Granel Sólido</SelectItem>
                                                    <SelectItem value="Granel Líquido">Granel Líquido</SelectItem>
                                                    <SelectItem value="Frigorificada">Frigorificada</SelectItem>
                                                    <SelectItem value="Conteinerizada">Conteinerizada</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />



                                    <FormField control={form.control} name="valorProduto" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Valor do produto (R$)</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="R$ 0,00"
                                                    value={maskedValue}
                                                    onChange={handleCurrencyChange}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1.4fr 1fr' }}>
                                        <FormField control={form.control} name="peso" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Peso (kg)</FormLabel>
                                                <div className="relative">
                                                    <Weight className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                    <FormControl><Input type="number" placeholder="Kg" {...field} className="pl-10" /></FormControl>
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                        )} />

                                        <FormField control={form.control} name="cubagem" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Cubagem (m³)</FormLabel>
                                                <div className="flex gap-1">
                                                    <div className="relative flex-grow">
                                                        <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                        <FormControl><Input type="number" step="0.001" placeholder="Ex: 1.25" {...field} className={cn("pl-10", !currentUser?.subPermissions?.freight?.canDefineManualCubage && "bg-muted")} readOnly={!currentUser?.subPermissions?.freight?.canDefineManualCubage} tabIndex={currentUser?.subPermissions?.freight?.canDefineManualCubage ? undefined : -1} /></FormControl>
                                                    </div>
                                                    {CubageCalculatorDialog}
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                        )} />

                                        <FormField control={form.control} name="quantidade" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Volumes</FormLabel>
                                                <div className="relative">
                                                    <Box className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                    <FormControl><Input type="number" placeholder="Qtd" {...field} className={cn("pl-10", (isCliente || (!isAdmin && !currentUser?.subPermissions?.freight?.canDefineVolumes)) && "bg-muted")} readOnly={isCliente || (!isAdmin && !currentUser?.subPermissions?.freight?.canDefineVolumes)} tabIndex={(isCliente || (!isAdmin && !currentUser?.subPermissions?.freight?.canDefineVolumes)) ? -1 : undefined} /></FormControl>
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    </div>

                                    <FormField control={form.control} name="veiculo" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Tipo de veículo</FormLabel>
                                            <div className="flex gap-2">
                                                <Select onValueChange={field.onChange} value={field.value} disabled={mode === 'fracionado'}>
                                                    <FormControl>
                                                        <SelectTrigger><SelectValue placeholder="-- Selecione --" /></SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {activeVehicles.map((vehicle) => <SelectItem key={vehicle.key} value={vehicle.key}>{vehicle.displayName}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    {mode === 'fracionado' && (!isCliente || isAdmin) && (isAdmin || currentUser?.subPermissions?.freight?.canViewBasePrice !== false) && (
                                        <FormField control={form.control} name="valorFrete" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Valor Base do Frete (R$)</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="R$ 0,00"
                                                        value={maskedValorFrete}
                                                        onChange={handleValorFreteChange}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    )}



                                    {mode === 'fracionado' && (!isCliente || isAdmin) && (isAdmin || currentUser?.subPermissions?.freight?.canViewDeliveryTime !== false) && (
                                        <FormField control={form.control} name="prazoEntrega" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Prazo de Entrega (dias)</FormLabel>
                                                <FormControl><Input type="number" placeholder="Definir prazo manualmente" {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    )}

                                    <FormField control={form.control} name="contato" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Contato</FormLabel>
                                            <FormControl><Input placeholder="Telefone/Celular" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    <FormField control={form.control} name="email" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>E-mail</FormLabel>
                                            <FormControl><Input type="email" placeholder="E-mail do solicitante" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    {cubageItems.length > 0 && (
                                        <div className="md:col-span-2 lg:col-span-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="text-xs font-semibold text-muted-foreground uppercase">Itens de Cubagem Detalhada ({cubageItems.length})</p>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-5 w-5 rounded-full"
                                                    onClick={() => {
                                                        const cubageText = cubageItems.map(item => `${item.quantity}x [${item.height}m x ${item.width}m x ${item.length}m]`).join(', ');
                                                        const currentObs = form.getValues('obs') || '';
                                                        const newObs = currentObs ? `${currentObs}\nCubagem: ${cubageText}` : `Cubagem: ${cubageText}`;
                                                        form.setValue('obs', newObs, { shouldValidate: true });
                                                    }}
                                                    title="Adicionar detalhamento às observações"
                                                >
                                                    <ArrowDown className="h-3 w-3" />
                                                </Button>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {cubageItems.map((item, idx) => (
                                                    <div key={idx} className="bg-primary/10 border border-primary/20 text-primary rounded px-2 py-1 text-xs">
                                                        <span className="font-bold">{item.quantity}x</span> [{item.height}m x {item.width}m x {item.length}m]
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <div className="md:col-span-2 lg:col-span-3">
                                        <FormField control={form.control} name="obs" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Observações</FormLabel>
                                                <FormControl><Textarea placeholder="Informações adicionais..." {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-2">
                                {onExtrasClick && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-auto w-16 text-primary border-primary/20 hover:bg-primary/10 transition-colors"
                                        onClick={onExtrasClick}
                                        title="Adicionar Itens Extras"
                                    >
                                        <Plus className="h-6 w-6" />
                                    </Button>
                                )}
                                <Button
                                    type="submit"
                                    className={cn(
                                        "flex-1 text-lg py-6 premium-calculate-btn transition-all duration-300 relative overflow-hidden",
                                        isArmazenagem ? "premium-calculate-btn-storage" : "premium-calculate-btn-standard",
                                        activeCalculateGlow && "blooming"
                                    )}
                                    disabled={isLoading || !!isFetchingCnpj}
                                    onClick={triggerCalculateClickAnimation}
                                >
                                    {/* Inner premium blooming light burst */}
                                    {activeCalculateGlow && <span className="premium-btn-bloom" />}
                                    
                                    <span className="relative z-10 flex items-center justify-center">
                                        {isLoading || isFetchingCnpj ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Calculator className="mr-2 h-5 w-5" />}
                                        {isLoading ? 'Calculando...' : isFetchingCnpj ? 'Buscando...' : isArmazenagem ? 'Calcular Armazenagem' : 'Calcular Frete'}
                                    </span>
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            {/* Customer search dialog — used for both freight & storage modes */}
            <Dialog open={isCustomerSearchOpen} onOpenChange={setIsCustomerSearchOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Buscar Cliente Cadastrado</DialogTitle>
                        <DialogDescription>
                            Pesquise por nome, fantasia ou CNPJ para preencher os dados.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex w-full items-center space-x-2 pt-4">
                        <Input
                            placeholder="Digite para pesquisar..."
                            value={customerSearchTerm}
                            onChange={(e) => setCustomerSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (isArmazenagem ? handleStorageCustomerSearch() : handleCustomerSearch())}
                        />
                        <Button type="button" onClick={isArmazenagem ? handleStorageCustomerSearch : handleCustomerSearch} disabled={isSearchingCustomers}>
                            {isSearchingCustomers ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        </Button>
                    </div>
                    <ScrollArea className="h-72 mt-4 border rounded-md">
                        {isSearchingCustomers ? (
                            <div className="flex justify-center items-center h-full">
                                <Loader2 className="h-6 w-6 animate-spin" />
                            </div>
                        ) : customerSearchResults.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Razão Social</TableHead>
                                        <TableHead>CNPJ</TableHead>
                                        <TableHead>Cidade/UF</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {customerSearchResults.map(customer => (
                                        <TableRow
                                            key={customer.id}
                                            onClick={() => isArmazenagem ? handleSelectStorageCustomer(customer) : handleSelectCustomer(customer)}
                                            className="cursor-pointer"
                                        >
                                            <TableCell>{customer.razaoSocial}</TableCell>
                                            <TableCell>{customer.cnpj}</TableCell>
                                            <TableCell>{customer.cidade}/{customer.estado}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <p className="text-center text-sm text-muted-foreground p-8">Nenhum cliente encontrado. Digite ao menos 2 caracteres para buscar.</p>
                        )}
                    </ScrollArea>
                </DialogContent>
            </Dialog>

            <Dialog open={isResponsibleSelectOpen} onOpenChange={setIsResponsibleSelectOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Qual responsável solicitar?</DialogTitle>
                        <DialogDescription>
                            O cliente selecionado possui múltiplos responsáveis cadastrados. Selecione um para preencher os dados.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                        {availableResponsibles.map((contact, idx) => (
                            <Button
                                key={idx}
                                variant="outline"
                                className="w-full justify-start h-auto py-3 px-4 flex flex-col items-start gap-1"
                                onClick={() => pendingCustomer && applyCustomerData(pendingCustomer, contact)}
                            >
                                <span className="font-bold">{contact.name}</span>
                                <span className="text-xs text-muted-foreground">{contact.email} · {contact.phone || contact.telefone || 'Sem telefone'}</span>
                            </Button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Clone dialog */}
            <Dialog open={isCloneDialogOpen} onOpenChange={(open) => { setIsCloneDialogOpen(open); if (!open) { setCloneSearchTerm(''); setCloneSearchResult(null); setCloneSearchError(null); } }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Clonar Cotação Existente</DialogTitle>
                        <DialogDescription>
                            Digite o número da cotação para buscar e importar todos os dados no formulário.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={async (e) => {
                        e.preventDefault();
                        if (!cloneSearchTerm.trim()) return;
                        setIsSearchingClone(true);
                        setCloneSearchResult(null);
                        setCloneSearchError(null);
                        try {
                            const token = localStorage.getItem('sessionToken');
                            const res = await fetch(`/api/quotes?term=${encodeURIComponent(cloneSearchTerm.trim())}&limit=1`, {
                                headers: { 'Authorization': `Bearer ${token}` }
                            });
                            if (!res.ok) throw new Error('Erro ao buscar cotação.');
                            const data = await res.json();
                            if (data.length > 0) {
                                setCloneSearchResult(data[0]);
                            } else {
                                setCloneSearchError(`Nenhuma cotação encontrada com "${cloneSearchTerm.trim()}".`);
                            }
                        } catch (err: any) {
                            setCloneSearchError(err.message || 'Erro ao buscar.');
                        } finally {
                            setIsSearchingClone(false);
                        }
                    }} className="flex gap-2">
                        <div className="relative flex-grow">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Ex: COT-2026-0042"
                                value={cloneSearchTerm}
                                onChange={(e) => setCloneSearchTerm(e.target.value)}
                                className="pl-10"
                                autoFocus
                            />
                        </div>
                        <Button type="submit" disabled={isSearchingClone || !cloneSearchTerm.trim()} size="sm">
                            {isSearchingClone ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        </Button>
                    </form>

                    {cloneSearchError && (
                        <p className="text-center text-sm text-destructive py-4">{cloneSearchError}</p>
                    )}

                    {cloneSearchResult && (
                        <div className="border rounded-lg p-4 space-y-3 bg-accent/30">
                            <div className="flex justify-between items-center">
                                <span className="font-mono font-semibold text-primary">{cloneSearchResult.quoteCode || 'S/N'}</span>
                                <span className="text-sm font-medium">
                                    {cloneSearchResult.totalFrete != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cloneSearchResult.totalFrete) : '—'}
                                </span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {cloneSearchResult.cidadeOrigem} → {cloneSearchResult.cidadeDestino}
                            </div>
                            <div className="text-sm text-muted-foreground">
                                Rem: {cloneSearchResult.remetente || '—'} · Dest: {cloneSearchResult.destinatario || '—'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                                Peso: {cloneSearchResult.peso ? `${cloneSearchResult.peso} kg` : '—'} · Vol: {cloneSearchResult.quantidade || '—'}
                            </div>
                            <Button
                                type="button"
                                className="w-full"
                                onClick={() => {
                                    if (onCloneQuote && cloneSearchResult) {
                                        onCloneQuote(cloneSearchResult);
                                    }
                                    setIsCloneDialogOpen(false);
                                    setCloneSearchTerm('');
                                    setCloneSearchResult(null);
                                }}
                            >
                                <Copy className="mr-2 h-4 w-4" />
                                Clonar esta Cotação
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {AnttResultDialog}
            {/* XML Upload Preview Verification Dialog */}
            <XmlPreviewDialog
                isOpen={isPreviewOpen}
                onClose={() => {
                    setIsPreviewOpen(false);
                    setParsedXmlData(null);
                }}
                parsedData={parsedXmlData}
                onConfirm={handleConfirmXmlImport}
            />

            <style>{`
                .premium-calculate-btn {
                    position: relative !important;
                    overflow: hidden !important;
                    border: 1px solid rgba(255, 255, 255, 0.15) !important;
                    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
                    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15) !important;
                }
                
                .premium-calculate-btn-standard {
                    background: linear-gradient(135deg, hsl(var(--primary)) 0%, #3b82f6 50%, #1d4ed8 100%) !important;
                    color: white !important;
                }
                
                .premium-calculate-btn-standard:hover:not(:disabled) {
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1e40af 100%) !important;
                    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.45) !important;
                    transform: translateY(-2px);
                }
                
                .premium-calculate-btn-storage {
                    background: linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #4338ca 100%) !important;
                    color: white !important;
                }
                
                .premium-calculate-btn-storage:hover:not(:disabled) {
                    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #3730a3 100%) !important;
                    box-shadow: 0 8px 25px rgba(99, 102, 241, 0.45) !important;
                    transform: translateY(-2px);
                }
                
                .premium-calculate-btn:active:not(:disabled) {
                    transform: scale(0.95) translateY(1px) !important;
                    transition: transform 0.05s linear !important;
                }

                /* Shine Sweep Effect */
                .premium-calculate-btn::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -150%;
                    width: 80%;
                    height: 100%;
                    background: linear-gradient(
                        to right,
                        rgba(255, 255, 255, 0) 0%,
                        rgba(255, 255, 255, 0.3) 50%,
                        rgba(255, 255, 255, 0) 100%
                    );
                    transform: skewX(-25deg);
                    transition: 0.75s;
                    pointer-events: none;
                    z-index: 5;
                }
                
                .premium-calculate-btn:hover:not(:disabled)::after {
                    left: 150%;
                    transition: 1.2s cubic-bezier(0.19, 1, 0.22, 1);
                }

                /* Bloom radial burst */
                .premium-btn-bloom {
                    position: absolute;
                    border-radius: 50%;
                    background: radial-gradient(circle, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0) 70%);
                    width: 120px;
                    height: 120px;
                    left: 50%;
                    top: 50%;
                    transform: translate(-50%, -50%) scale(0.2);
                    pointer-events: none;
                    z-index: 2;
                    animation: innerBloomEffect 0.8s cubic-bezier(0.1, 0.8, 0.2, 1) forwards;
                }

                @keyframes innerBloomEffect {
                    0% {
                        transform: translate(-50%, -50%) scale(0.2);
                        opacity: 1;
                    }
                    100% {
                        transform: translate(-50%, -50%) scale(4);
                        opacity: 0;
                    }
                }
            `}</style>
        </>
    );
});

FreightForm.displayName = 'FreightForm';
