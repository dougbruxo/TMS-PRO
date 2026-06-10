"use client";

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { 
  Search, 
  Loader2, 
  ArrowLeft, 
  Calendar, 
  Truck, 
  CheckCircle2, 
  AlertTriangle, 
  Download, 
  ShieldCheck, 
  FileText, 
  ChevronRight, 
  Boxes 
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

// Helper de formatação de CNPJ/CPF em tempo real
function formatCnpjCpf(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  } else {
    return digits
      .substring(0, 14)
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  }
}

interface QuoteLookupFormProps {
  onLookup?: (code: string) => Promise<any>;
  onStateChange?: (state: 'form' | 'result') => void;
}

export function QuoteLookupForm({ onLookup, onStateChange }: QuoteLookupFormProps) {
  const [step, setStep] = useState<'search' | 'verify'>('search');
  const [code, setCode] = useState('');
  const [cnpjCpf, setCnpjCpf] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [showResultInline, setShowResultInline] = useState(false);
  const { toast } = useToast();

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      toast({
        variant: 'destructive',
        title: 'Código Inválido',
        description: 'Por favor, insira o número da cotação ou da Nota Fiscal.',
      });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/quotes/public-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() })
      });

      const data = await res.json();

      if (res.ok && data.requiresVerification) {
        setStep('verify');
      } else {
        toast({
          variant: 'destructive',
          title: 'Não Encontrado',
          description: data.message || 'Nenhum resultado localizado para a busca.',
        });
      }
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Erro de Conexão',
        description: 'Ocorreu um erro ao comunicar-se com o servidor.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDoc = cnpjCpf.replace(/\D/g, '');
    if (cleanDoc.length < 11) {
      toast({
        variant: 'destructive',
        title: 'Documento Inválido',
        description: 'Por favor, insira um CNPJ ou CPF válido de 11 ou 14 dígitos.',
      });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/quotes/public-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), cnpjCpf: cleanDoc })
      });

      const data = await res.json();

      if (res.ok && data.quotes) {
        setQuotes(data.quotes);
        setShowResultInline(true);
        onStateChange?.('result');
        setStep('search'); // Reseta o card para busca inicial
        setCode(''); // Limpa o campo de busca
        setCnpjCpf(''); // Limpa o CPF/CNPJ de segurança
        toast({
          title: 'Acesso Autorizado',
          description: `${data.quotes.length} remessa(s) localizada(s) com sucesso.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Falha na Validação',
          description: data.message || 'O CNPJ ou CPF informado não confere.',
        });
      }
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Erro de Conexão',
        description: 'Erro de comunicação ao validar o documento.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getActiveTimelineStep = (status: string): number => {
    const s = String(status).toLowerCase();
    if (s === 'entregue' || s === 'finalizado') return 4;
    if (s === 'em rota' || s === 'em carregamento' || s === 'aguardando saída') return 3;
    if (['coleta', 'aguardando recebimento', 'no galpão', 'entregue no galpão'].includes(s)) return 2;
    return 1;
  };

  const formatDateString = (isoString?: string) => {
    if (!isoString) return '';
    try {
      return format(parseISO(isoString), 'dd/MM/yyyy HH:mm', { locale: ptBR });
    } catch {
      return isoString;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'Aberta': 'Cotação Criada',
      'Em Análise': 'Em Análise de Viabilidade',
      'Fechada': 'Processando Expedição',
      'Coleta': 'Em Coleta',
      'Aguardando Recebimento': 'Aguardando Recebimento no Hub',
      'Entregue no Galpão': 'Recebido no Hub',
      'No Galpão': 'Processando no Hub',
      'Aguardando Saída': 'Pronto para Transferência',
      'Em Carregamento': 'Em Carregamento',
      'Em Rota': 'Em Trânsito / Rota de Entrega',
      'Entregue': 'Entregue',
      'Finalizado': 'Entregue e Finalizado'
    };
    return labels[status] || status;
  };

  return (
    <div className="w-full">
      {showResultInline ? (
        <div className="space-y-6 w-full animate-in fade-in-50 duration-500 text-left">
          {/* Cabeçalho da visualização inline */}
          <div className="flex items-center justify-between border-b border-primary/10 pb-4">
            <div className="flex items-center gap-2.5">
              <Truck className="h-6 w-6 text-accent animate-pulse" />
              <div>
                <h2 className="text-lg font-extrabold text-primary">Status do Rastreamento</h2>
                <p className="text-xs text-muted-foreground">
                  Acesso seguro sob a Lei Geral de Proteção de Dados (LGPD)
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowResultInline(false);
                setQuotes([]);
                onStateChange?.('form');
              }}
              className="h-9 border-primary/20 hover:bg-muted text-muted-foreground rounded-xl"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Nova Consulta
            </Button>
          </div>

          <div className="space-y-6">
            {quotes.map((quote) => {
              const activeStep = getActiveTimelineStep(quote.status);
              const isDelivered = activeStep === 4;

              return (
                <div 
                  key={quote.id} 
                  className="p-5 rounded-2xl bg-muted/30 border border-primary/10 shadow-sm space-y-4 hover:border-primary/30 transition duration-300"
                >
                  {/* Cabeçalho do Bloco de Remessa */}
                  <div className="flex justify-between items-start text-xs border-b border-muted pb-3">
                    <div>
                      <span className="font-semibold text-muted-foreground">Código de Cotação:</span>{' '}
                      <span className="font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-lg">{quote.quoteCode || 'N/A'}</span>
                    </div>
                    {quote.nfNumber && (
                      <div>
                        <span className="font-semibold text-muted-foreground">Nota Fiscal:</span>{' '}
                        <span className="font-bold text-foreground bg-muted/80 px-2 py-0.5 rounded">{quote.nfNumber}</span>
                      </div>
                    )}
                  </div>

                  {/* Rota (Origem -> Destino) */}
                  <div className="grid grid-cols-7 gap-1 items-center bg-muted/40 p-3 rounded-xl border border-muted/50">
                    <div className="col-span-3 text-center">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Origem</p>
                      <p className="text-xs font-bold text-foreground line-clamp-1">{quote.cidadeOrigem}</p>
                    </div>
                    <div className="col-span-1 flex justify-center text-primary">
                      <ChevronRight className="h-5 w-5 animate-pulse" />
                    </div>
                    <div className="col-span-3 text-center">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Destino</p>
                      <p className="text-xs font-bold text-foreground line-clamp-1">{quote.cidadeDestino}</p>
                    </div>
                  </div>

                  {/* Status Atual */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isDelivered ? 'bg-emerald-400' : 'bg-primary-400'}`}></span>
                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isDelivered ? 'bg-emerald-500' : 'bg-primary-500'}`}></span>
                      </span>
                      <span className="font-semibold text-muted-foreground">Situação Atual:</span>
                    </div>
                    <span className={`font-bold ${isDelivered ? 'text-emerald-500' : 'text-primary'}`}>
                      {getStatusLabel(quote.status)}
                    </span>
                  </div>

                  {/* LINHA DO TEMPO INTERATIVA */}
                  <div className="relative pt-3 pb-3">
                    <div className="absolute top-1/2 left-0 right-0 h-1 bg-muted -translate-y-1/2 rounded-full" />
                    <div 
                      className="absolute top-1/2 left-0 h-1 bg-gradient-to-r from-primary to-accent -translate-y-1/2 rounded-full transition-all duration-700" 
                      style={{ width: `${((activeStep - 1) / 3) * 100}%` }}
                    />
                    
                    <div className="relative flex justify-between">
                      {/* Etapa 1 */}
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition z-10 ${activeStep >= 1 ? 'bg-primary text-primary-foreground border-primary shadow' : 'bg-background text-muted-foreground border-muted'}`}>
                          {activeStep > 1 ? <CheckCircle2 className="h-4 w-4" /> : '1'}
                        </div>
                        <span className="text-[10px] font-bold mt-1.5 text-muted-foreground">Solicitado</span>
                      </div>

                      {/* Etapa 2 */}
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition z-10 ${activeStep >= 2 ? 'bg-primary text-primary-foreground border-primary shadow' : 'bg-background text-muted-foreground border-muted'}`}>
                          {activeStep > 2 ? <CheckCircle2 className="h-4 w-4" /> : '2'}
                        </div>
                        <span className="text-[10px] font-bold mt-1.5 text-muted-foreground">Coletado</span>
                      </div>

                      {/* Etapa 3 */}
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition z-10 ${activeStep >= 3 ? 'bg-primary text-primary-foreground border-primary shadow' : 'bg-background text-muted-foreground border-muted'}`}>
                          {activeStep > 3 ? <CheckCircle2 className="h-4 w-4" /> : '3'}
                        </div>
                        <span className="text-[10px] font-bold mt-1.5 text-muted-foreground">Em Rota</span>
                      </div>

                      {/* Etapa 4 */}
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition z-10 ${activeStep >= 4 ? 'bg-emerald-500 text-white border-emerald-500 shadow' : 'bg-background text-muted-foreground border-muted'}`}>
                          {activeStep >= 4 ? <CheckCircle2 className="h-4 w-4" /> : '4'}
                        </div>
                        <span className="text-[10px] font-bold mt-1.5 text-muted-foreground">Entregue</span>
                      </div>
                    </div>
                  </div>

                  {/* Informações de Envio & Datas */}
                  <div className="grid grid-cols-2 gap-3 text-xs border-t border-muted pt-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground font-semibold">Remetente</p>
                      <p className="font-bold text-foreground truncate">{quote.remetente}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-semibold">Destinatário</p>
                      <p className="font-bold text-foreground truncate">{quote.destinatario}</p>
                    </div>
                    
                    {quote.data && (
                      <div>
                        <p className="text-[10px] text-muted-foreground font-semibold">Data do Registro</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Calendar className="h-3.5 w-3.5 text-primary/70" />
                          <p className="font-bold text-foreground">{formatDateString(quote.data)}</p>
                        </div>
                      </div>
                    )}

                    {isDelivered && quote.deliveredAt ? (
                      <div>
                        <p className="text-[10px] text-emerald-500 font-semibold">Entregue em</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/70" />
                          <p className="font-bold text-emerald-600">{formatDateString(quote.deliveredAt)}</p>
                        </div>
                      </div>
                    ) : quote.deliveryForecast ? (
                      <div>
                        <p className="text-[10px] text-muted-foreground font-semibold">Previsão de Entrega</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Calendar className="h-3.5 w-3.5 text-accent/70" />
                          <p className="font-bold text-foreground">{formatDateString(quote.deliveryForecast)}</p>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* COMPROVANTE DE ENTREGA */}
                  {(quote.proofOfDeliveryUrl || (quote.proofOfDeliveryUrls && quote.proofOfDeliveryUrls.length > 0)) && (
                    <div className="bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/20 mt-3 text-center space-y-2.5">
                      <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-600">
                        <FileText className="h-4 w-4" /> Comprovante de Entrega Disponível
                      </div>
                      <div className="flex flex-wrap justify-center gap-2">
                        {quote.proofOfDeliveryUrls && quote.proofOfDeliveryUrls.length > 0 ? (
                          quote.proofOfDeliveryUrls.map((url: string, podIdx: number) => (
                            <a 
                              key={podIdx}
                              href={url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition shadow-sm"
                            >
                              <Download className="h-3.5 w-3.5" /> Baixar Doc {podIdx + 1}
                            </a>
                          ))
                        ) : (
                          <a 
                            href={quote.proofOfDeliveryUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1.5 text-xs font-bold px-4 py-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition shadow-sm"
                          >
                            <Download className="h-3.5 w-3.5" /> Baixar Comprovante
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Histórico Operacional */}
                  {quote.operationalHistory && quote.operationalHistory.length > 0 && (
                    <div className="space-y-1.5 text-[11px] border-t border-muted pt-3">
                      <p className="font-bold text-muted-foreground uppercase tracking-wider text-[9px] mb-1">Histórico do Percurso</p>
                      <div className="space-y-2.5">
                        {quote.operationalHistory.map((op: any, opIdx: number) => (
                          <div key={opIdx} className="flex gap-2 text-foreground leading-normal animate-in fade-in-25 duration-300">
                            <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                              {formatDateString(op.timestamp).split(' ')[0]}
                            </span>
                            <div className="flex-grow">
                              <strong className="text-primary">{op.status}:</strong>{' '}
                              <span className="text-muted-foreground">{op.details}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ocorrências */}
                  {quote.occurrences && quote.occurrences.length > 0 && (
                    <div className="bg-amber-500/5 p-3.5 rounded-xl border border-amber-500/20 text-xs space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-amber-600">
                        <AlertTriangle className="h-4 w-4" /> Informações Importantes / Ocorrências
                      </div>
                      <div className="space-y-2 max-h-[100px] overflow-y-auto">
                        {quote.occurrences.map((occ: any, occIdx: number) => (
                          <div key={occIdx} className="border-l-2 border-amber-500 pl-2 space-y-0.5">
                            <p className="font-semibold text-foreground text-[10px]">
                              {formatDateString(occ.timestamp)} - {occ.description}
                            </p>
                            {occ.notes && (
                              <p className="text-muted-foreground text-[10px] italic">Notas: {occ.notes}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          {/* CARD DO FORMULÁRIO DE LOGIN (Fase 1 ou 2) */}
          {step === 'search' && (
            <form onSubmit={handleSearchSubmit} className="flex w-full items-center space-x-2">
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-pulse" />
                <Input
                  type="text"
                  placeholder="Nº da cotação ou nota fiscal"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="pl-10 h-11 text-base bg-muted/40 border-primary/20 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl"
                  disabled={isLoading}
                />
              </div>
              <Button 
                type="submit" 
                disabled={isLoading}
                className="h-11 px-5 font-semibold bg-gradient-to-r from-primary to-accent text-primary-foreground hover:brightness-110 shadow-md hover:shadow-lg transition-all rounded-xl"
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Consultar'}
              </Button>
            </form>
          )}

          {step === 'verify' && (
            <form onSubmit={handleVerifySubmit} className="space-y-4 w-full text-left">
              <div className="flex items-center space-x-2 text-primary font-semibold mb-1">
                <ShieldCheck className="h-5 w-5 text-accent animate-bounce" />
                <span className="text-sm">Verificação de Segurança LGPD</span>
              </div>
              
              <p className="text-xs text-muted-foreground leading-relaxed">
                Informações sobre o código <strong className="text-foreground">{code}</strong> foram localizadas. Por motivos de segurança e sigilo de dados, confirme o <strong>CNPJ ou CPF do remetente ou destinatário</strong> para visualizar os dados de rastreamento.
              </p>

              <div className="space-y-2">
                <Input
                  type="text"
                  placeholder="CNPJ ou CPF (Apenas números)"
                  value={cnpjCpf}
                  onChange={(e) => setCnpjCpf(formatCnpjCpf(e.target.value))}
                  className="h-11 text-base bg-muted/40 border-primary/20 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl"
                  disabled={isLoading}
                  maxLength={18}
                />
              </div>

              <div className="flex space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('search')}
                  className="flex-1 h-10 font-semibold border-primary/20 hover:bg-muted text-muted-foreground rounded-xl"
                  disabled={isLoading}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-10 font-semibold bg-gradient-to-r from-primary to-accent text-primary-foreground hover:brightness-110 shadow-sm rounded-xl"
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar'}
                </Button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
