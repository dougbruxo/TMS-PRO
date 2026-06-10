

"use client";

import { memo, useMemo, useState, useEffect, useRef, ReactNode, ChangeEvent } from 'react';
import { useParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Truck,
  Warehouse,
  Move,
  PackageCheck,
  CheckCircle,
  AlertTriangle,
  Clock,
  ShieldCheck,
  FileText,
  Eye,
  History,
  Info,
  Undo2,
  Wrench,
  CircleDollarSign,
  ClipboardCheck,
  PlusCircle,
  Loader2,
  Upload,
  Trash2,
  AlertOctagon,
  ChevronDown,
  ChevronRight,
  Edit,
  Mail,
  Printer,
  RefreshCw,
  Lock,
  Wallet,
  MapPin,
  Share2,
  Copy,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import type {
  Quote,
  QuoteStatus,
  Driver,
  OperationalEvent,
  User,
  QuotePriority,
  Occurrence,
  DeliveryStatus,
  OccurrenceType,
  SharedItem,
} from '@/lib/types';
import { cn, getInitials, getQuoteCode, statusToSlug } from '@/lib/utils';
import { differenceInDays, parseISO, formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { OperationalInfo } from './OperationalInfo';
import { Textarea } from './ui/textarea';
import { WhatsAppIcon } from './WhatsAppIcon';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { ShareItemDialog } from './chat/ShareItemDialog';
import { StarRating } from './StarRating';

type QuoteCardProps = {
  quote: Quote;
  drivers: Driver[];
  currentUser: User;
  children?: ReactNode;
  hideFinancials?: boolean;
  isSac?: boolean;
  onOpenManage?: (quote: Quote) => void;
  manageButtonLabel?: string;
  isManageActionDisabled?: boolean;
  onOpenDetails?: (quote: Quote) => void;
  onOpenHistory?: (quote: Quote) => void;
  onOpenObs?: (quote: Quote) => void;
  onOpenOccurrences?: (quote: Quote) => void;
  onOpenAddressDialog?: (quote: Quote) => void;
  onGenerateOC?: (quote: Quote) => void;
  onSetQuoteToRevert?: (quote: Quote | null) => void;

  onUploadProof?: (quote: Quote) => void;
  onDeleteProof?: (quote: Quote, url?: string) => void;
  onSetPriority?: (priority: QuotePriority) => void;
  onConfirmDispatch?: (quote: Quote) => void;
  isSubmitting?: boolean;
  onManualConfirmCollection?: (quote: Quote) => void;
  onManualConfirmDelivery?: (quote: Quote) => void;
  onClone?: (quote: Quote) => void;
};

const statusColors: Record<QuoteStatus, string> = {
    'Aberta': 'bg-gray-500',
    'Em Análise': 'bg-amber-500',
    'Fechada': 'bg-blue-500',
    'Coleta': 'bg-cyan-500',
    'Aguardando Recebimento': 'bg-yellow-500 animate-pulse',
    'Entregue no Galpão': 'bg-blue-600 animate-pulse',
    'No Galpão': 'bg-orange-500',
    'Aguardando Saída': 'bg-yellow-500 animate-pulse',
    'Em Carregamento': 'bg-blue-600',
    'Em Rota': 'bg-purple-500',
    'Entregue': 'bg-yellow-600',
    'Finalizado': 'bg-green-600',
};

const priorityDetails: Record<QuotePriority, { label: string, color: string }> = {
    'Baixa': { label: 'Baixa', color: 'border-gray-400' },
    'Normal': { label: 'Normal', color: 'border-blue-500' },
    'Alta': { label: 'Alta', color: 'border-yellow-500' },
    'Urgente': { label: 'Urgente', color: 'border-red-500 animate-pulse' },
};

const _MapDialog = ({ isOpen, onOpenChange, driver }: { isOpen: boolean, onOpenChange: (open: boolean) => void, driver: Driver | null }) => {
    if (!driver || !driver.lastKnownLocation) return null;

    const [longitude, latitude] = driver.lastKnownLocation.coordinates;
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Localização de {driver.name}</DialogTitle>
                    <DialogDescription>
                        Última atualização: {driver.lastLocationUpdate ? format(parseISO(driver.lastLocationUpdate), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'N/A'}
                    </DialogDescription>
                </DialogHeader>
                <div className="h-80 w-full bg-muted rounded-md flex items-center justify-center">
                     <a href={mapUrl} target="_blank" rel="noopener noreferrer">
                        <Button size="lg">
                            <MapPin className="mr-2 h-5 w-5" />
                            Abrir no Google Maps
                        </Button>
                    </a>
                </div>
                 <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Fechar</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


const _QuoteCard = ({
  quote,
  drivers,
  currentUser,
  children,
  hideFinancials = false,
  isSac = false,
  onOpenManage,
  manageButtonLabel = 'Gerenciar',
  isManageActionDisabled = false,
  onOpenDetails,
  onOpenHistory,
  onOpenObs,
  onOpenOccurrences,
  onOpenAddressDialog,
  onGenerateOC,
  onSetQuoteToRevert,

  onUploadProof,
  onDeleteProof,
  onSetPriority,
  onConfirmDispatch,
  isSubmitting,
  onManualConfirmCollection,
  onManualConfirmDelivery,
  onClone,
}: QuoteCardProps) => {
    const params = useParams();
    const statusParam = Array.isArray(params.status) ? params.status[0] : params.status;
    const { toast } = useToast();

    const [isMapOpen, setIsMapOpen] = useState(false);
    const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
    const [itemToShare, setItemToShare] = useState<SharedItem | null>(null);

    const handleOpenShareDialog = (quote: Quote) => {
        const quoteCode = getQuoteCode(quote);
        const sharedItem: SharedItem = {
          type: 'cotação',
          id: quote.id,
          title: quoteCode,
          description: `${quote.remetente} para ${quote.cidadeDestino}`,
          link: `/operational/status/${statusToSlug(quote.status)}?quoteCode=${quoteCode}`,
        };
        setItemToShare(sharedItem);
        setIsShareDialogOpen(true);
    };

    const effectiveStatus = quote.status === 'Fechada' ? 'Coleta' : quote.status;
    const currentGain = (quote.grossProfit || 0) - (quote.totalExpense || 0);
    const isAdmin = currentUser?.role === 'admin';

    const lastOccurrence = useMemo(() => {
        if (!quote.occurrences || quote.occurrences.length === 0) return null;
        return [...quote.occurrences].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    }, [quote.occurrences]);

    const isBlockedByOccurrence = lastOccurrence?.blocksOperation === true;

     const timeWaiting = useMemo(() => {
        const relevantStatuses: QuoteStatus[] = ['Fechada', 'Coleta', 'No Galpão', 'Aguardando Saída'];
        if (!relevantStatuses.includes(quote.status)) {
            return -1;
        }

        const history = [...(quote.history || []), ...(quote.operationalHistory || [])];
        const lastRelevantEvent = history
            .filter(e => e.action === 'STATUS_ALTERADO' || e.action === 'ETAPA_OPERACIONAL' || e.action === 'CRIADA' || e.action === 'RECEBIDO_GALPAO' || e.action === 'FECHADA')
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
        
        if (lastRelevantEvent) {
            return differenceInDays(new Date(), parseISO(lastRelevantEvent.timestamp));
        }
        return -1;
    }, [quote.status, quote.history, quote.operationalHistory]);

    const waitingAlert = useMemo(() => {
        if (timeWaiting < 0) return null;
        
        const level = timeWaiting >= 2 ? 'critical' : 'warning';
        let text = `Aguardando há ${timeWaiting} dia(s)`;

        if (['Fechada', 'Coleta'].includes(quote.status)) {
            text = `Aguardando coleta há ${timeWaiting} dia(s)`;
        } else if (['No Galpão', 'Aguardando Saída'].includes(quote.status)) {
            text = `Parado no galpão há ${timeWaiting} dia(s)`;
        }

        if (timeWaiting === 0) {
           return { level: 'info', text };
        }
        if(timeWaiting > 0) {
          return { level, text };
        }
        return null;

    }, [timeWaiting, quote.status]);
    
    const deliveryDeadlineInfo = useMemo(() => {
        if (quote.status === 'Finalizado') {
            return null;
        }

        if (!quote.deliveryForecast || ['Aberta', 'Fechada', 'Coleta', 'Aguardando Recebimento'].includes(quote.status)) {
            return null;
        }

        const forecastDate = parseISO(quote.deliveryForecast);
        const now = new Date();
        const daysRemaining = differenceInDays(forecastDate, now);
        
        if (daysRemaining < 0) {
            return {
                text: `Atrasado há ${Math.abs(daysRemaining)} dia(s)`,
                color: 'text-red-500',
                bgColor: 'bg-red-100 dark:bg-red-900/30'
            };
        }

        const deadlinePercentage = 1 - (daysRemaining / (quote.prazoEntrega || 1));
        if (deadlinePercentage > 0.7) {
            return {
                text: `Restam ${daysRemaining} dia(s) para entrega`,
                color: 'text-orange-500',
                bgColor: 'bg-orange-100 dark:bg-orange-900/30'
            };
        }

        return {
            text: `Restam ${daysRemaining} dia(s) para entrega`,
            color: 'text-green-600',
            bgColor: 'bg-green-100 dark:bg-green-900/30'
        };

    }, [quote.deliveryForecast, quote.prazoEntrega, quote.status]);
    
    const canRevert = quote.operationalHistory && quote.operationalHistory.length > 0;
    const hasDriverAssigned = quote.status === 'Coleta' && quote.operationalHistory?.some(e => e.driverId);
    const isFirstOperationalStage = (effectiveStatus === 'Coleta' && !hasDriverAssigned) || quote.status === 'Fechada';
    const showRevertButton = canRevert && !isFirstOperationalStage && (effectiveStatus !== 'Finalizado' || (effectiveStatus === 'Finalizado' && isAdmin));
    const internalManageButtonDisabled = ['Finalizado'].includes(effectiveStatus) || isBlockedByOccurrence || hasDriverAssigned;
    
    const cardBorderClass = quote.priority ? `border-l-4 ${priorityDetails[quote.priority].color}` : '';
    
    const canManuallyConfirmCollection = isAdmin && quote.status === 'Coleta' && quote.operationalHistory?.some(e => e.driverId);
    const canManuallyConfirmDelivery = isAdmin && quote.status === 'Em Rota';

    const lastDriverEvent = useMemo(() => 
        [...(quote.operationalHistory || [])].reverse().find(e => e.driverId), 
        [quote.operationalHistory]
    );

    const driverWithLocation = useMemo(() => 
        lastDriverEvent ? drivers.find(d => d.id === lastDriverEvent.driverId) : null, 
        [lastDriverEvent, drivers]
    );

    const canShowTracking = useMemo(() => 
        driverWithLocation && 
        driverWithLocation.lastKnownLocation && 
        driverWithLocation.lastLocationUpdate && 
        ['Coleta', 'Aguardando Recebimento', 'Em Rota', 'Entregue no Galpão'].includes(quote.status), 
        [driverWithLocation, quote.status]
    );

    return (
     <>
     <Card key={quote.id} className={cn("flex flex-col shadow-md bg-card hover:bg-card/90", cardBorderClass)}>
        <CardHeader className="p-4 space-y-1">
            <div className="flex justify-between items-start gap-2">
                <CardTitle className="text-base">{quote.remetente}</CardTitle>
                <div className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                    {getQuoteCode(quote)}
                </div>
            </div>
             <div className="text-xs text-muted-foreground space-y-1">
                <p className="flex items-center gap-1.5"><strong className="font-semibold">De:</strong> {quote.cidadeOrigem} <Move className="h-3 w-3" /> <strong className="font-semibold">Para:</strong> {quote.cidadeDestino}</p>
                <p><strong className="font-semibold">Por:</strong> {quote.usuario}</p>
                 {quote.status === 'Aguardando Recebimento' && (
                    <Badge variant="default" className="mt-1 bg-cyan-600 animate-pulse">
                        <Truck className="mr-1 h-3 w-3" /> Motorista a Caminho
                    </Badge>
                 )}
                 {quote.status === 'Entregue no Galpão' && (
                    <Badge variant="default" className="mt-1 bg-blue-600 animate-pulse">
                        <Warehouse className="mr-1 h-3 w-3" /> Motorista Chegou
                    </Badge>
                 )}
                 {quote.status === 'Aguardando Saída' && <Badge variant="destructive" className="mt-1 animate-pulse">Aguardando Saída do Galpão</Badge>}
                 {waitingAlert && (
                    <Badge variant={waitingAlert.level === 'critical' ? 'destructive' : 'default'} className={cn('mt-1', { 'bg-orange-500 hover:bg-orange-600 animate-pulse': waitingAlert.level === 'warning', 'animate-pulse': waitingAlert.level === 'critical'})}>
                        <AlertTriangle className="mr-1 h-3 w-3" /> {waitingAlert.text}
                    </Badge>
                 )}
                 {deliveryDeadlineInfo && (
                    <Badge variant="outline" className={cn("mt-1", deliveryDeadlineInfo.color, deliveryDeadlineInfo.bgColor)}>
                        <Clock className="mr-1 h-3 w-3"/>
                        {deliveryDeadlineInfo.text}
                    </Badge>
                )}
                 {(() => {
                    if (quote.status !== 'Finalizado') return null;
                    let delStatus = quote.deliveryStatus;
                    if (!delStatus && quote.deliveryForecast) {
                        const deliveryDateStr = quote.deliveredAt || quote.closedAt;
                        if (deliveryDateStr) {
                            const forecast = new Date(quote.deliveryForecast);
                            const actual = new Date(deliveryDateStr);
                            if (!isNaN(forecast.getTime()) && !isNaN(actual.getTime())) {
                                delStatus = actual <= forecast ? 'No Prazo' : 'Atrasado';
                            }
                        }
                    }
                    if (!delStatus) return null;
                    return (
                        <Badge variant={delStatus === 'No Prazo' ? 'default' : 'destructive'} className={cn('mt-1', {'bg-green-600 hover:bg-green-600': delStatus === 'No Prazo'})}>
                            <CheckCircle className="mr-1 h-3 w-3"/>
                            Entregue {delStatus}
                        </Badge>
                    );
                 })()}
                 {quote.priority && <Badge className={`mt-1 border ${priorityDetails[quote.priority].color}`}>{priorityDetails[quote.priority].label}</Badge>}
                 {lastOccurrence && (
                    <Badge variant="destructive" className={cn('mt-1', { 'animate-pulse': isBlockedByOccurrence })}>
                        <AlertOctagon className="mr-1 h-3 w-3"/>
                        {lastOccurrence.description}
                    </Badge>
                 )}
             </div>
        </CardHeader>
        {!hideFinancials && (
        <CardContent className="p-4 pt-0 flex-grow space-y-2 text-xs">
            <div className="flex justify-between">
                <span>Ganho Atual:</span> 
                <strong className={currentGain < 0 ? 'text-red-500' : 'text-green-600'}>
                    {currentGain.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
                </strong>
            </div>
            <div className="flex justify-between">
                <span>Despesas:</span> 
                <strong className="text-red-500">
                    -{Math.abs(quote.totalExpense || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </strong>
            </div>
             
            {(quote.operationalHistory || []).some(e => e.expense && e.expense > 0 && e.driverId) && (
                <OperationalInfo 
                    operationalHistory={quote.operationalHistory || []}
                    drivers={drivers}
                    isAdmin={isAdmin}
                    quoteId={quote.id}
                />
            )}

            {canShowTracking && (
                <div className="pt-2">
                    <Button variant="outline" size="sm" className="w-full text-green-600 border-green-500/50 hover:bg-green-500/10 hover:text-green-700" onClick={() => setIsMapOpen(true)}>
                        <MapPin className="mr-2 h-4 w-4 animate-pulse" />
                        Rastrear ({formatDistanceToNow(parseISO(driverWithLocation!.lastLocationUpdate!), { addSuffix: true, locale: ptBR })})
                    </Button>
                </div>
            )}
            
            {(statusParam === 'entregue' || statusParam === 'finalizado') && onUploadProof && onDeleteProof && (
                <div className="pt-2 space-y-2">
                    {(() => {
                        const proofs = quote.proofOfDeliveryUrls && quote.proofOfDeliveryUrls.length > 0
                            ? quote.proofOfDeliveryUrls 
                            : (quote.proofOfDeliveryUrl ? [quote.proofOfDeliveryUrl] : []);
                        
                        return (
                           <>
                             {proofs.length > 0 && proofs.map((url, idx) => (
                               <div key={idx} className="flex gap-2">
                                  <a href={`${url}?t=${new Date().getTime()}`} target="_blank" rel="noopener noreferrer" className="flex-grow">
                                      <Button size="sm" variant="outline" className="w-full text-green-600 border-green-600">
                                          <CheckCircle className="mr-2 h-4 w-4"/>Ver Comprovante {proofs.length > 1 ? idx + 1 : ''}
                                      </Button>
                                  </a>
                                  {isAdmin && (
                                      <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                              <Button size="sm" variant="destructive" disabled={isSubmitting}>
                                                  <Trash2 className="h-4 w-4"/>
                                              </Button>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent>
                                              <AlertDialogHeader><AlertDialogTitle>Remover Comprovante?</AlertDialogTitle><AlertDialogDescription>Tem certeza que deseja remover este comprovante de entrega?</AlertDialogDescription></AlertDialogHeader>
                                              <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => onDeleteProof(quote, url)}>Confirmar</AlertDialogAction>
                                              </AlertDialogFooter>
                                          </AlertDialogContent>
                                      </AlertDialog>
                                  )}
                               </div>
                             ))}
                             
                             <Button size="sm" variant="secondary" className="w-full hover:bg-secondary/80" onClick={() => onUploadProof(quote)} disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4" />}
                                {proofs.length > 0 ? "Anexar Outro Comprovante" : "Anexar Comprovante"}
                             </Button>
                           </>
                        );
                    })()}
                </div>
            )}

        </CardContent>
        )}
        <div className="mt-auto">
          {children}
        </div>
        <CardFooter className="p-2 pt-0 flex-wrap justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => handleOpenShareDialog(quote)}> <Share2 className="mr-1 h-3 w-3"/> Partilhar </Button>
            {onOpenDetails && <Button size="sm" variant="ghost" onClick={() => onOpenDetails(quote)}> <Eye className="mr-1 h-3 w-3"/> Detalhes </Button>}
            {onOpenHistory && <Button size="sm" variant="ghost" onClick={() => onOpenHistory(quote)}> <History className="mr-1 h-3 w-3"/> Etapas </Button>}
            {onOpenObs && <Button size="sm" variant="ghost" onClick={() => onOpenObs(quote)}> <Info className="mr-1 h-3 w-3"/> Obs </Button>}
            
            {isSac && onOpenOccurrences && onOpenAddressDialog && onSetPriority && (
                 <>
                    <Button size="sm" variant="ghost" onClick={() => onOpenOccurrences(quote)}><AlertOctagon className="mr-1 h-3 w-3" />Ocorrências</Button>
                    <Button size="sm" variant="ghost" onClick={() => onOpenAddressDialog(quote)}><Edit className="mr-1 h-3 w-3" />Endereço</Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost"><ChevronDown className="mr-1 h-3 w-3"/>Prioridade</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                          {Object.keys(priorityDetails).map(p => (
                              <DropdownMenuItem key={p} onClick={() => onSetPriority(p as QuotePriority)}>{priorityDetails[p as QuotePriority].label}</DropdownMenuItem>
                          ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                 </>
            )}
            
            {onGenerateOC && effectiveStatus === 'Coleta' && (
                <Button size="sm" variant="outline" onClick={() => onGenerateOC(quote)}>
                    <FileText className="mr-2 h-3 w-3"/> Gerar O.C.
                </Button>
            )}
            
            {canManuallyConfirmCollection && onManualConfirmCollection && (
              <Button size="sm" variant="outline" className="text-blue-600 border-blue-600" onClick={() => onManualConfirmCollection(quote)} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin"/> : <ClipboardCheck className="mr-2 h-4 w-4" />}
                Confirmar Coleta
              </Button>
            )}
            {canManuallyConfirmDelivery && onManualConfirmDelivery && (
              <Button size="sm" variant="outline" className="text-blue-600 border-blue-600" onClick={() => onManualConfirmDelivery(quote)} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin"/> : <ClipboardCheck className="mr-2 h-4 w-4" />}
                Confirmar Entrega
              </Button>
            )}

            {onOpenManage && (
              <TooltipProvider>
                  <Tooltip>
                      <TooltipTrigger asChild>
                          <span tabIndex={0}>
                              <Button size="sm" onClick={() => onOpenManage(quote)} disabled={internalManageButtonDisabled || isManageActionDisabled || isSubmitting}>
                                  {isBlockedByOccurrence && <Lock className="mr-2 h-3 w-3"/>}
                                  <Wrench className="mr-2 h-3 w-3"/> {manageButtonLabel}
                              </Button>
                          </span>
                      </TooltipTrigger>
                      {(isBlockedByOccurrence || isManageActionDisabled) && (
                          <TooltipContent>
                              {isBlockedByOccurrence ? <p>Operação bloqueada por ocorrência crítica no SAC.</p> : <p>Ação não disponível nesta etapa para o seu perfil.</p>}
                          </TooltipContent>
                      )}
                  </Tooltip>
              </TooltipProvider>
            )}

            {onClone && (
                <Button size="sm" variant="outline" onClick={() => onClone(quote)} title="Clonar Cotação">
                    <Copy className="h-3 w-3 mr-1" /> Clonar
                </Button>
            )}


            {showRevertButton && onSetQuoteToRevert && (
                <Button size="sm" variant="outline" onClick={() => onSetQuoteToRevert(quote)}>
                    <Undo2 className="mr-2 h-3 w-3"/> Retroceder
                </Button>
            )}
        </CardFooter>
    </Card>
    <_MapDialog isOpen={isMapOpen} onOpenChange={setIsMapOpen} driver={driverWithLocation as any} />
    <ShareItemDialog item={itemToShare} open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen} />
     </>
    )
};

const _DetailsDialog = ({ quote, isOpen, onOpenChange }: { quote: Quote | null; isOpen: boolean; onOpenChange: (open: boolean) => void; }) => {
    if (!quote) return null;
    const getFinalValue = (q: Quote) => (q.valorFinal || q.totalFrete) + (q.icmsValor || 0);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Detalhes da Cotação: {getQuoteCode(quote)}</DialogTitle>
                    <DialogDescription>
                        Visualização completa dos dados da cotação.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[70vh] p-1">
                <div className="space-y-4 pr-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><p className="font-semibold text-muted-foreground">Remetente</p><p>{quote.remetente}</p></div>
                        <div><p className="font-semibold text-muted-foreground">Solicitante</p><p>{quote.responsavelSolicitante}</p></div>
                        <div><p className="font-semibold text-muted-foreground">Contato</p><p>{quote.contato}</p></div>
                        <div><p className="font-semibold text-muted-foreground">Email</p><p>{quote.email}</p></div>
                    </div>
                    <Separator />
                     <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div><p className="font-semibold text-muted-foreground">Origem</p><p>{quote.cidadeOrigem}</p></div>
                        <div><p className="font-semibold text-muted-foreground">Destino</p><p>{quote.cidadeDestino}</p></div>
                        <div><p className="font-semibold text-muted-foreground">Distância</p><p>{quote.kmIda > 0 ? `${quote.kmIda.toFixed(2)} km` : 'N/A'}</p></div>
                        <div><p className="font-semibold text-muted-foreground">Veículo</p><p>{quote.veiculo}</p></div>
                        <div><p className="font-semibold text-muted-foreground">Prazo</p><p>{quote.prazoEntrega} dias</p></div>
                        <div><p className="font-semibold text-muted-foreground">Nº da NF</p><p>{quote.nfNumber || 'N/A'}</p></div>
                        <div><p className="font-semibold text-muted-foreground">Volumes</p><p>{quote.quantidade || 'N/A'}</p></div>
                    </div>
                    {quote.cubageItems && quote.cubageItems.length > 0 && (
                        <>
                            <Separator />
                            <div>
                                <p className="font-semibold text-muted-foreground mb-2">Detalhamento de Cubagem Declarado</p>
                                <div className="flex flex-wrap gap-2">
                                    {quote.cubageItems.map((item, idx) => (
                                        <div key={idx} className="bg-primary/10 border border-primary/20 text-primary rounded px-2 py-1 text-xs">
                                            <span className="font-bold">{item.quantity}x</span> [{item.length}m x {item.width}m x {item.height}m]
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                    <Separator />
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm"><Move className="h-4 w-4 text-muted-foreground"/> <span className="font-semibold">Endereço de Coleta:</span> <p>{quote.enderecoColeta || 'Não informado'}</p></div>
                        <div className="flex items-center gap-2 text-sm"><Move className="h-4 w-4 text-muted-foreground"/> <span className="font-semibold">Endereço de Entrega:</span> <p>{quote.enderecoEntrega || 'Não informado'}</p></div>
                    </div>
                    <Separator />
                    <div className="text-center">
                        <p className="text-muted-foreground">Total Final (Frete + Taxas + ICMS)</p>
                        <p className="text-4xl font-bold text-primary">
                        {getFinalValue(quote).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                        <div className="text-xs text-muted-foreground mt-2">
                        <span>Frete Bruto: {quote.totalFrete.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        <span className="mx-2">|</span>
                        <span>ICMS ({quote.icmsAliquota || 0}%): {(quote.icmsValor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        {(quote.desconto || 0) > 0 && (
                                <>
                                <span className="mx-2">|</span>
                                <span className="text-red-500">Desconto: -{(quote.desconto || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                </>
                        )}
                        </div>
                    </div>
                     <Separator />
                    <div className="space-y-2 text-sm">
                       <h4 className="font-semibold">Observações</h4>
                       <p className="text-muted-foreground p-2 border rounded-md bg-secondary/50">{quote.obs || 'Nenhuma observação.'}</p>
                    </div>
                </div>
                </ScrollArea>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline">Fechar</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

const _HistoryDialog = ({ quote, isOpen, onOpenChange }: { quote: Quote | null, isOpen: boolean, onOpenChange: (open: boolean) => void }) => {
    if (!quote) return null;
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Histórico de Etapas: {getQuoteCode(quote)}</DialogTitle>
                     <DialogDescription>
                        Acompanhe todas as etapas e despesas registradas para esta cotação.
                    </DialogDescription>
                </DialogHeader>
                 <ScrollArea className="max-h-[60vh] my-4">
                    <div className="pr-6 space-y-6">
                        {(quote.operationalHistory && Array.isArray(quote.operationalHistory) && quote.operationalHistory.length > 0) ? (
                             [...quote.operationalHistory].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((event: OperationalEvent, index, arr) => (
                                <div key={event.id} className="flex gap-4 relative">
                                    <div className="flex flex-col items-center">
                                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-primary-foreground", statusColors[event.status])}>
                                          <Info className="h-4 w-4" />
                                        </div>
                                        {index < arr.length - 1 && (
                                          <div className="w-px h-full bg-border flex-grow" />
                                        )}
                                    </div>
                                    <div className="flex-grow">
                                        <div className="font-semibold">Status alterado para: <Badge variant="secondary" className={`${statusColors[event.status]} text-white`}>{event.status}</Badge></div>
                                        <p className="text-sm text-muted-foreground">{new Date(event.timestamp).toLocaleString('pt-BR')}</p>
                                        <div className="text-sm mt-2 p-3 rounded-md bg-muted/50 space-y-1">
                                           {event.driverName && <p><strong>Motorista:</strong> {event.driverName}</p>}
                                           {event.expense && event.expense > 0 && <p><strong>Despesa Adicionada:</strong> <span className="text-red-500">{(event.expense).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></p>}
                                           <p className="text-xs pt-1">{event.details}</p>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-2">Por: {event.username}</p>
                                    </div>
                                </div>
                             ))
                        ) : (
                            <div className="text-center text-muted-foreground py-8">
                                <p>Nenhuma etapa operacional registrada ainda.</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline">Fechar</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
};

const _ObservationsDialog = ({ quote, isOpen, onOpenChange, onSubmit, isSubmitting }: { quote: Quote | null; isOpen: boolean; onOpenChange: (open: boolean) => void; onSubmit: (quote: Quote, updates: Partial<Quote>, action: string, details: string) => void; isSubmitting: boolean; }) => {
    const [obsText, setObsText] = useState('');

    useEffect(() => {
        if (isOpen && quote) {
            setObsText(quote.obs || '');
        }
    }, [isOpen, quote]);

    const handleSave = () => {
        if (!quote) return;
        onSubmit(quote, { obs: obsText }, 'OBS_ALTERADA', 'Observações da cotação foram atualizadas.');
    };
    
    if (!quote) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Observações da Cotação: {getQuoteCode(quote)}</DialogTitle>
                </DialogHeader>
                <Textarea value={obsText} onChange={(e) => setObsText(e.target.value)} rows={6} placeholder="Insira as observações aqui..." />
                <DialogFooter>
                    <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Salvar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


const _OccurrencesDialog = ({ quote, occurrenceTypes, isOpen, onOpenChange, onSubmit, isSubmitting }: { quote: Quote | null; occurrenceTypes: OccurrenceType[], isOpen: boolean; onOpenChange: (open: boolean) => void; onSubmit: (quote: Quote, code: string, notes: string) => void; isSubmitting: boolean; }) => {
    const [occurrenceCode, setOccurrenceCode] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (!isOpen) {
            setOccurrenceCode('');
            setNotes('');
        }
    }, [isOpen]);

    const handleSubmit = () => {
        if (quote && occurrenceCode) {
            onSubmit(quote, occurrenceCode, notes);
        }
    };
    
    if (!quote) return null;

    return <Dialog open={isOpen} onOpenChange={onOpenChange}><DialogContent>
        <DialogHeader>
            <DialogTitle>Ocorrências: {getQuoteCode(quote)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
            <ScrollArea className="h-48 border rounded-md p-4">
                {quote.occurrences && quote.occurrences.length > 0 ? (
                    [...quote.occurrences].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(occ => (
                        <div key={occ.id} className="mb-4">
                            <p className="text-sm font-semibold">{occ.description}</p>
                             <p className="text-xs text-muted-foreground">{occ.notes}</p>
                            <p className="text-xs text-muted-foreground">{new Date(occ.timestamp).toLocaleString('pt-BR')} por {occ.author}</p>
                        </div>
                    ))
                ) : <p className="text-sm text-muted-foreground text-center">Nenhuma ocorrência registrada.</p>}
            </ScrollArea>
             <div className="space-y-2">
                <Label>Adicionar Nova Ocorrência</Label>
                <Select onValueChange={setOccurrenceCode} value={occurrenceCode}>
                    <SelectTrigger><SelectValue placeholder="Selecione o tipo de ocorrência..." /></SelectTrigger>
                    <SelectContent>
                        {occurrenceTypes.map(ot => <SelectItem key={ot.id} value={ot.code}>{ot.code} - {ot.description}</SelectItem>)}
                    </SelectContent>
                </Select>
             </div>
             <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Adicione notas adicionais (opcional)..." />
        </div>
        <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Fechar</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || !occurrenceCode}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4"/>}
                Adicionar
            </Button>
        </DialogFooter>
        </DialogContent></Dialog>;
};

const _AddressDialog = ({ quote, isOpen, onOpenChange, onSubmit, isSubmitting }: { quote: Quote | null; isOpen: boolean; onOpenChange: (open: boolean) => void; onSubmit: (quote: Quote, updates: Partial<Quote>, action: string, details: string) => void; isSubmitting: boolean; }) => {
    const [enderecoEntrega, setEnderecoEntrega] = useState('');

    useEffect(() => {
        if (isOpen && quote) {
            setEnderecoEntrega(quote.enderecoEntrega || '');
        }
    }, [isOpen, quote]);

    const handleSave = () => {
        if (!quote) return;
        onSubmit(quote, { enderecoEntrega }, 'ENDERECO_ALTERADO', 'Endereço de entrega alterado.');
    };
    
    if (!quote) return null;
    return <Dialog open={isOpen} onOpenChange={onOpenChange}><DialogContent>
        <DialogHeader>
            <DialogTitle>Editar Endereço de Entrega</DialogTitle>
        </DialogHeader>
        <Textarea value={enderecoEntrega} onChange={e => setEnderecoEntrega(e.target.value)} rows={4} placeholder="Digite o novo endereço de entrega completo..."/>
        <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Salvar Endereço"}
            </Button>
        </DialogFooter>
    </DialogContent></Dialog>;
};


const _DriverPaymentDialogContent = ({ driver, expense }: { driver: Driver; expense: number }) => (
    <div className="py-4 space-y-4 text-sm">
        <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
            <Avatar>
                <AvatarFallback>{getInitials(driver.name)}</AvatarFallback>
            </Avatar>
            <div>
                <p className="font-semibold">{driver.name}</p>
                <p className="text-muted-foreground">{driver.licensePlate || 'Placa não informada'}</p>
            </div>
        </div>
        <div className="space-y-2">
            <div className="flex items-center gap-2"><CircleDollarSign className="h-4 w-4 text-muted-foreground"/> <span className="font-semibold">Valor da Despesa:</span> <span>{expense.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
            <div className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-muted-foreground"/> <span className="font-semibold">Chave PIX:</span> <span>{driver.pixKey || 'Não informada'}</span></div>
        </div>
    </div>
);

type ManifestDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  drivers: Driver[];
  quotesForManifest: Quote[];
  onConfirm: () => void;
  isSubmitting: boolean;
  driverId: string;
  setDriverId: (id: string) => void;
  selectedQuoteIds: string[];
  setSelectedQuoteIds: (ids: string[]) => void;
  consultationNumber: string;
  setConsultationNumber: (num: string) => void;
};


const _ManifestDialog = ({
  isOpen,
  onOpenChange,
  drivers,
  quotesForManifest,
  onConfirm,
  isSubmitting,
  driverId,
  setDriverId,
  selectedQuoteIds,
  setSelectedQuoteIds,
  consultationNumber,
  setConsultationNumber,
}: ManifestDialogProps) => {

    const handleConfirm = () => {
        onConfirm();
    };
    
    return (
         <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Criar Novo Romaneio de Carregamento</DialogTitle>
                    <DialogDescription>Selecione o motorista, o número da consulta e as cotações que ele irá carregar.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 flex-grow overflow-hidden flex flex-col">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Motorista</Label>
                            <Select value={driverId} onValueChange={setDriverId}>
                                <SelectTrigger><SelectValue placeholder="Selecione um motorista..." /></SelectTrigger>
                                <SelectContent>
                                    {drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="manifestConsultationNumber">Nº da Consulta</Label>
                            <Input
                                id="manifestConsultationNumber"
                                value={consultationNumber}
                                onChange={(e) => setConsultationNumber(e.target.value)}
                                placeholder="Até 10 dígitos"
                                maxLength={10}
                            />
                        </div>
                    </div>
                    <Separator />
                    <Label>Cotações disponíveis no galpão</Label>
                    <ScrollArea className="flex-grow border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]"></TableHead>
                                    <TableHead>Cotação</TableHead>
                                    <TableHead>Destino</TableHead>
                                    <TableHead>NF</TableHead>
                                    <TableHead>Volumes</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {quotesForManifest.length > 0 ? quotesForManifest.map(q => (
                                    <TableRow key={q.id}>
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedQuoteIds.includes(q.id)}
                                                onCheckedChange={(checked) => {
                                                    setSelectedQuoteIds(checked ? [...selectedQuoteIds, q.id] : selectedQuoteIds.filter(id => id !== q.id))
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>{getQuoteCode(q)}</TableCell>
                                        <TableCell>{q.cidadeDestino}</TableCell>
                                        <TableCell>{q.nfNumber || 'N/A'}</TableCell>
                                        <TableCell>{q.volumeCount || 'N/A'}</TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">Nenhuma cotação no galpão.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
                    <Button onClick={handleConfirm} disabled={isSubmitting || !driverId || selectedQuoteIds.length === 0 || !consultationNumber}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ChevronRight className="mr-2 h-4 w-4"/>}
                        Avançar para Pagamento
                    </Button>
                </DialogFooter>
            </DialogContent>
          </Dialog>
    )
}

type ManifestPaymentDialogProps = {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    isSubmitting: boolean;
    selectedQuotes: Quote[];
    driverPayments: Record<string, number>;
    setDriverPayments: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    onBack: () => void;
};

const _ManifestPaymentDialog = ({
    isOpen,
    onOpenChange,
    onConfirm,
    isSubmitting,
    selectedQuotes,
    driverPayments,
    setDriverPayments,
    onBack,
}: ManifestPaymentDialogProps) => {

    const [maskedPayments, setMaskedPayments] = useState<Record<string, string>>({});
    
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    }

    useEffect(() => {
        if (isOpen) {
            const initialMasked: Record<string, string> = {};
            selectedQuotes.forEach(quote => {
                initialMasked[quote.id] = formatCurrency(driverPayments[quote.id] || 0);
            });
            setMaskedPayments(initialMasked);
        }
    }, [isOpen, selectedQuotes, driverPayments]);


    const handlePaymentChange = (e: ChangeEvent<HTMLInputElement>, quoteId: string) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        const numericValue = Number(rawValue) / 100;
        
        setDriverPayments((prev: Record<string, number>) => ({...prev, [quoteId]: numericValue}));
        setMaskedPayments((prev: Record<string, string>) => ({...prev, [quoteId]: formatCurrency(numericValue)}));
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Definir Pagamento do Motorista</DialogTitle>
                    <DialogDescription>Insira o valor a ser pago ao motorista para cada entrega.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] my-4">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Cotação</TableHead>
                                <TableHead>Destino</TableHead>
                                <TableHead className="w-[180px]">Valor (R$)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {selectedQuotes.map(q => (
                                <TableRow key={q.id}>
                                    <TableCell>{getQuoteCode(q)}</TableCell>
                                    <TableCell>{q.cidadeDestino}</TableCell>
                                    <TableCell>
                                        <Input
                                            placeholder="R$ 0,00"
                                            value={maskedPayments[q.id] || ''}
                                            onChange={(e) => handlePaymentChange(e, q.id)}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
                <DialogFooter>
                    <Button variant="outline" onClick={onBack} disabled={isSubmitting}>Voltar</Button>
                    <Button onClick={onConfirm} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4"/>}
                        Criar Romaneio e Lançar Despesas
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const _DriverSearchDialog = ({ isOpen, onOpenChange, drivers, onSelectDriver, searchTerm, onSearchTermChange, isLoading }: { isOpen: boolean, onOpenChange: (open: boolean) => void, drivers: Driver[], onSelectDriver: (driver: Driver) => void, searchTerm: string, onSearchTermChange: (e: ChangeEvent<HTMLInputElement>) => void, isLoading?: boolean }) => (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
            <DialogTitle>Buscar Motorista</DialogTitle>
        </DialogHeader>
        <Input
            placeholder="Buscar por nome, CPF, placa ou telefone"
            value={searchTerm}
            onChange={onSearchTermChange}
            className="my-4"
        />
        <ScrollArea className="h-72">
             {isLoading ? (
                 <div className="flex justify-center items-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin"/>
                </div>
            ) : drivers.map(d => (
                <div key={d.id} onClick={() => onSelectDriver(d)} className="flex items-center gap-4 p-2 rounded-lg cursor-pointer hover:bg-accent">
                    <Avatar>
                        <AvatarImage src={d.avatarUrl} alt={d.name} />
                        <AvatarFallback>{getInitials(d.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-grow">
                        <div className="flex justify-between items-center">
                            <p className="font-semibold">{d.name}</p>
                            {d.ratingCount && d.ratingCount > 0 ? (
                                <StarRating value={d.rating || 0} readonly size={12} />
                            ) : (
                                <span className="text-[10px] text-muted-foreground italic">Sem avaliações</span>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">{d.licensePlate || 'Placa não informada'}</p>
                    </div>
                </div>
            ))}
        </ScrollArea>
      </DialogContent>
    </Dialog>
);

const _PageTitle = ({ currentStatus, onCreateManifest }: { currentStatus: QuoteStatus, onCreateManifest?: () => void }) => (
    <div className="flex justify-between items-start">
        <div className='space-y-2'>
            <h1 className="text-3xl font-bold text-primary mb-2 flex items-center gap-3">
            <Badge className={`text-white text-xl p-2 ${statusColors[currentStatus]} `}>{currentStatus}</Badge>
            <span>Cotações em {currentStatus}</span>
            </h1>
            <p className="text-muted-foreground">Gerencie as cotações nesta etapa do fluxo operacional.</p>
        </div>
        {currentStatus === 'No Galpão' && onCreateManifest && (
            <Button onClick={onCreateManifest}>
                <PlusCircle className="mr-2 h-4 w-4" /> Criar Romaneio
            </Button>
        )}
    </div>
);


export const QuoteCard = Object.assign(memo(_QuoteCard), {
  DetailsDialog: memo(_DetailsDialog),
  HistoryDialog: memo(_HistoryDialog),
  ObservationsDialog: memo(_ObservationsDialog),
  OccurrencesDialog: memo(_OccurrencesDialog),
  AddressDialog: memo(_AddressDialog),
  DriverPaymentDialogContent: memo(_DriverPaymentDialogContent),
  ManifestDialog: memo(_ManifestDialog),
  ManifestPaymentDialog: memo(_ManifestPaymentDialog),
  DriverSearchDialog: memo(_DriverSearchDialog),
  PageTitle: memo(_PageTitle),
  MapDialog: memo(_MapDialog),
});
