"use client";

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, ArrowRight, Download, FileText, FileCheck2, XCircle, Clock, Printer, CheckCircle2, AlertCircle, MoreVertical, Ban, Send, Copy, Trash2, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { BackButton } from '@/components/BackButton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { authFetch } from '@/lib/api-client';

export default function DocumentsHistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Cancel State
  const [cancelDoc, setCancelDoc] = useState<any | null>(null);
  const [justificativa, setJustificativa] = useState('');
  const [isCanceling, setIsCanceling] = useState(false);

  // CC-e State
  const [cceDoc, setCceDoc] = useState<any | null>(null);
  const [cceGrupo, setCceGrupo] = useState('infCTe');
  const [cceCampo, setCceCampo] = useState('xObs');
  const [cceValor, setCceValor] = useState('');

  // Encerramento State
  const [closeMdfeDoc, setCloseMdfeDoc] = useState<any | null>(null);
  const [isClosingMdfe, setIsClosingMdfe] = useState(false);
  const [cMunEncerramento, setCMunEncerramento] = useState('');
  const [ufEncerramento, setUfEncerramento] = useState('');
  const [isSendingCce, setIsSendingCce] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user || (!user.documentsAccess && !user.operationalAccess)) {
      router.push('/dashboard');
      return;
    }

    authFetch('/api/documents/history')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setDocuments(data);
        else toast({ variant: 'destructive', title: 'Erro', description: data.message });
      })
      .catch(err => toast({ variant: 'destructive', title: 'Erro de conexão', description: err.message }))
      .finally(() => setIsLoading(false));

  }, [user, authLoading, router, toast]);

  const handlePrint = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      const oldTitle = document.title;
      const cleanNumero = String(selectedDoc?.numeroCte || '').replace(/\D/g, '').replace(/^0+/, '') || '0';
      const dacteNumFormatado = cleanNumero.padStart(2, '0');
      document.title = `CTe-${dacteNumFormatado}`;

      iframeRef.current.contentWindow.print();

      setTimeout(() => {
        document.title = oldTitle;
      }, 1000);
    } else if (selectedDoc?.pdfUrl) {
      toast({ title: 'Aviso', description: 'Abrindo guia oficial para impressão.', variant: 'default' });
      window.open(selectedDoc.pdfUrl, '_blank');
    }
  };

  const openCancelDialog = (doc: any) => {
    setCancelDoc(doc);
    setJustificativa('');
  };

  const openCceDialog = (doc: any) => {
    setCceDoc(doc);
    setCceGrupo('infCTe');
    setCceCampo('xObs');
    setCceValor('');
  };

  const openEncerramentoDialog = (doc: any) => {
    setCloseMdfeDoc(doc);
    setCMunEncerramento(doc.cMunDescarga || '');
    setUfEncerramento(doc.ufFim || '');
  };

  const handleCancelCte = async () => {
    if (justificativa.length < 15) {
      toast({ variant: 'destructive', title: 'Atenção', description: 'A justificativa deve ter pelo menos 15 caracteres.' });
      return;
    }

    setIsCanceling(true);
    try {
      const response = await authFetch(`/api/sefaz/evento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: cancelDoc._id,
          tipoEvento: '110111',
          justificativa: justificativa.trim()
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        toast({ title: 'Sucesso', description: 'O CT-e foi cancelado com sucesso na SEFAZ.' });
        setCancelDoc(null);
        // Recarregar a lista
        const reloadRes = await authFetch('/api/documents/history');
        const reloadData = await reloadRes.json();
        setDocuments(reloadData);
      } else {
        toast({ variant: 'destructive', title: 'Falha ao Cancelar', description: data.message || 'Erro desconhecido.' });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro de conexão', description: err.message });
    } finally {
      setIsCanceling(false);
    }
  };

  const handleCloseMdfe = async () => {
    setIsClosingMdfe(true);
    try {
      const response = await authFetch(`/api/sefaz/evento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: closeMdfeDoc._id,
          tipoEvento: '110112', // Encerramento
          codigoMunicipioEncerramento: cMunEncerramento.trim(),
          ufEncerramento: ufEncerramento.trim()
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        toast({ title: 'Sucesso', description: 'MDF-e encerrado com sucesso na SEFAZ.' });
        setCloseMdfeDoc(null);
        // Recarregar a lista
        const reloadRes = await authFetch('/api/documents/history');
        const reloadData = await reloadRes.json();
        setDocuments(reloadData);
      } else {
        toast({ variant: 'destructive', title: 'Falha no Encerramento', description: data.message || 'Erro desconhecido.' });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro de conexão', description: err.message });
    } finally {
      setIsClosingMdfe(false);
    }
  };

  const handleSendCce = async () => {
    if (cceValor.length < 15) {
      toast({ variant: 'destructive', title: 'Atenção', description: 'O novo valor/correção deve ter pelo menos 15 caracteres.' });
      return;
    }

    setIsSendingCce(true);
    try {
      const response = await authFetch(`/api/sefaz/evento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: cceDoc._id,
          tipoEvento: '110110', // Carta de Correção
          justificativa: cceValor.trim(), // xml-builder exige justificativa para CC-e
          grupoAlterado: cceGrupo.trim(),
          campoAlterado: cceCampo.trim(),
          valorAlterado: cceValor.trim()
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        toast({ title: 'Sucesso', description: 'Carta de Correção (CC-e) registrada com sucesso na SEFAZ.' });
        setCceDoc(null);
        // Recarregar a lista
        const reloadRes = await authFetch('/api/documents/history');
        const reloadData = await reloadRes.json();
        setDocuments(reloadData);
      } else {
        toast({ variant: 'destructive', title: 'Falha na CC-e', description: data.message || 'Erro desconhecido.' });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro de conexão', description: err.message });
    } finally {
      setIsSendingCce(false);
    }
  };

  const handleDeleteDoc = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir permanentemente esta emissão? Isso só deve ser feito para testes ou notas com falha.')) return;
    try {
      const response = await authFetch(`/api/nfe/cte/${id}`, { method: 'DELETE' });
      if (response.ok) {
        toast({ title: 'Sucesso', description: 'Documento excluído.' });
        setDocuments(prev => prev.filter(d => d._id !== id));
      } else {
        const data = await response.json();
        toast({ variant: 'destructive', title: 'Falha ao Excluir', description: data.message || 'Erro desconhecido.' });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro de conexão', description: err.message });
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase() || '';
    if (s.includes('autorizado') || s.includes('concluido') || s.includes('sucesso')) {
      return <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"><FileCheck2 className="w-3 h-3 mr-1" /> Autorizado</Badge>;
    }
    if (s.includes('erro') || s.includes('rejeitado') || s.includes('denegado')) {
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Falha</Badge>;
    }
    return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> {status || 'Processando'}</Badge>;
  };

  if (authLoading || isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <main className="container mx-auto p-4 md:p-8 space-y-8">
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div className="flex flex-col">
          <h1 className="text-3xl font-extrabold text-primary whitespace-nowrap">Histórico de Emissões</h1>
          <p className="text-sm text-muted-foreground">Últimos documentos fiscais eletrônicos gerados pelo sistema.</p>
        </div>
        <BackButton href="/documents" className="mb-0 mt-1" />
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Data Emissão</TableHead>
              <TableHead>Identificação / Chave</TableHead>
              <TableHead>Status SEFAZ</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Nenhum documento emitido ainda.</TableCell></TableRow>
            ) : (
              documents.map((doc) => (
                <TableRow key={doc._id}>
                  <TableCell>
                    <Badge variant="outline" className="font-bold">{doc.type}</Badge>
                    <span className="text-xs text-muted-foreground block mt-1">Ambiente: {doc.environment}</span>
                  </TableCell>
                  <TableCell>{new Date(doc.dataEmissao).toLocaleString('pt-BR')}</TableCell>
                  <TableCell className="max-w-[300px] truncate">
                    {doc.chaveAcesso && <span className="font-medium text-sm block">Chave: {doc.chaveAcesso.substring(0, 20)}...</span>}
                    {doc.remetenteNome && <span className="text-xs text-muted-foreground block">Remetente: {doc.remetenteNome}</span>}
                  </TableCell>
                  <TableCell>{getStatusBadge(doc.status)}</TableCell>
                  <TableCell className="text-right flex items-center justify-end gap-2">
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 ml-1 hover:bg-slate-100 dark:hover:bg-slate-800">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Opções Fiscais</DropdownMenuLabel>
                        <DropdownMenuSeparator />

                        <DropdownMenuItem className="cursor-pointer" onClick={() => setSelectedDoc(doc)}>
                          <FileText className="mr-2 h-4 w-4 text-primary" />
                          Visualizar Detalhes
                        </DropdownMenuItem>

                        <DropdownMenuItem className="cursor-pointer" onClick={() => router.push(`/documents/cte?draftId=${doc._id}`)}>
                          <Copy className="mr-2 h-4 w-4 text-emerald-500" />
                          Clonar CT-e
                        </DropdownMenuItem>

                        {['rejeitado', 'erro', 'denegado', 'falha'].some(s => doc.status?.toLowerCase().includes(s)) && (
                          <DropdownMenuItem className="cursor-pointer font-medium" onClick={() => router.push(`/documents/cte?draftId=${doc._id}`)}>
                            <Edit className="mr-2 h-4 w-4 text-amber-500" />
                            Corrigir Falha
                          </DropdownMenuItem>
                        )}

                        {['autorizado', 'concluido', 'sucesso'].some(s => doc.status?.toLowerCase().includes(s)) && (
                          <>
                            {(doc.type === 'CT-e' || doc.type === 'CTE') && (
                              <DropdownMenuItem className="text-blue-600 font-medium cursor-pointer" onClick={() => openCceDialog(doc)}>
                                <FileText className="mr-2 h-4 w-4" />
                                Carta de Correção (CC-e)
                              </DropdownMenuItem>
                            )}
                            {(doc.type === 'MDF-e' || doc.type === 'MDFE') && (
                              <DropdownMenuItem className="text-emerald-600 font-medium cursor-pointer" onClick={() => openEncerramentoDialog(doc)}>
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Encerrar MDF-e
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="text-destructive font-medium cursor-pointer" onClick={() => openCancelDialog(doc)}>
                              <Ban className="mr-2 h-4 w-4" />
                              Cancelar {doc.type}
                            </DropdownMenuItem>
                          </>
                        )}

                        {['rejeitado', 'erro', 'denegado', 'falha'].some(s => doc.status?.toLowerCase().includes(s)) && (
                          <DropdownMenuItem className="text-destructive font-bold cursor-pointer bg-destructive/5 hover:bg-destructive/10" onClick={() => handleDeleteDoc(doc._id)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* MODAL VISUALIZADOR */}
      <Dialog open={!!selectedDoc} onOpenChange={(open) => !open && setSelectedDoc(null)}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-6 overflow-hidden bg-slate-50 dark:bg-slate-950">
          <DialogHeader className="flex flex-row justify-between items-start pb-4 border-b">
            <div>
              <DialogTitle className="text-2xl font-black flex items-center gap-3">
                Monitor de {selectedDoc?.type?.toUpperCase() || 'Documento'}
                {selectedDoc && (['autorizado', 'concluido', 'sucesso'].some(s => selectedDoc.status?.toLowerCase().includes(s))
                  ? <Badge className="bg-emerald-500/10 text-emerald-600 border-none"><CheckCircle2 className="w-4 h-4 mr-1" /> AUTORIZADO SEFAZ</Badge>
                  : <Badge variant="destructive" className="border-none shadow-none"><AlertCircle className="w-4 h-4 mr-1" /> {selectedDoc.status}</Badge>
                )}
              </DialogTitle>
              <p className="text-muted-foreground mt-1 text-sm font-mono tracking-tighter">
                CHAVE: {selectedDoc?.chaveAcesso || 'N/A'} • Protocolo: {selectedDoc?.protocolo || 'Aguardando'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {selectedDoc?.pdfUrl && (
                <>
                  <Button variant="outline" asChild>
                    <a 
                      href={selectedDoc.pdfUrl} 
                      download={`CTe-${String(selectedDoc.numeroCte || '').replace(/\D/g, '').replace(/^0+/, '').padStart(2, '0') || 'Documento'}.pdf`}
                    >
                      <Download className="mr-2 w-4 h-4" /> Baixar PDF
                    </a>
                  </Button>
                  <Button variant="outline" asChild>
                    <a 
                      href={`/api/documents/download?id=${selectedDoc._id}&type=${selectedDoc.type?.toLowerCase() || 'cte'}&format=xml`}
                      download={`${selectedDoc.chaveAcesso || selectedDoc._id}-procCTe.xml`}
                    >
                      <Download className="mr-2 w-4 h-4" /> Baixar XML
                    </a>
                  </Button>
                  <Button onClick={handlePrint} className="bg-primary shadow-lg" title="Imprimir Espelho">
                    <Printer className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pt-4">
            <Tabs defaultValue="pdf" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 h-12 bg-slate-100 dark:bg-slate-900 border">
                <TabsTrigger value="pdf" className="data-[state=active]:bg-white data-[state=active]:shadow-sm font-semibold tracking-tight"><FileText className="w-5 h-5 mr-2 text-primary" /> Espelho Oficial (PDF)</TabsTrigger>
                <TabsTrigger value="ficha" className="data-[state=active]:bg-white data-[state=active]:shadow-sm font-semibold tracking-tight"><CheckCircle2 className="w-5 h-5 mr-2 text-primary" /> Ficha Estendida</TabsTrigger>
              </TabsList>

              <TabsContent value="pdf" className="h-[650px] border-2 border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center shadow-inner relative">
                {selectedDoc?.pdfUrl && ['autorizado', 'concluido', 'sucesso'].some(s => selectedDoc.status?.toLowerCase().includes(s)) ? (
                  <iframe 
                    ref={iframeRef} 
                    src={selectedDoc.pdfUrl} 
                    className="w-full h-full absolute inset-0 bg-transparent" 
                    title={`CTe-${String(selectedDoc.numeroCte || '').replace(/\D/g, '').replace(/^0+/, '').padStart(2, '0') || 'Documento'}`} 
                  />
                ) : (
                  <div className="text-muted-foreground flex flex-col items-center p-8 text-center">
                    <AlertCircle className="w-16 h-16 mb-4 opacity-50 text-destructive" />
                    <h2 className="text-2xl font-bold opacity-80 mb-2">Recibo PDF Indisponível</h2>
                    <p className="opacity-70 max-w-md">Documentos que foram <b>{selectedDoc?.status?.toUpperCase() || 'PROCESSANDO'}</b> não geram espelho oficial. O PDF (DaCTE/Damdfe) só é desenhado pela SEFAZ após a autorização com êxito da malha fiscal.</p>

                    {selectedDoc?.motivoStatus && (
                      <div className="mt-8 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-left w-full max-w-lg shadow-sm">
                        <p className="text-sm font-bold text-red-600 mb-1 flex items-center"><AlertCircle className="w-4 h-4 mr-2" /> Motivo da Recusa (Sefaz):</p>
                        <p className="text-sm text-red-600/90 font-mono tracking-tight">{selectedDoc.motivoStatus}</p>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="ficha" className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="shadow-none border-dashed border-2">
                    <CardHeader className="bg-slate-50/50"><CardTitle className="text-lg">Raio-X / Valoração</CardTitle></CardHeader>
                    <CardContent className="space-y-4 pt-6">
                      <div className="flex justify-between items-center"><span className="text-muted-foreground block text-sm">Empresa Ativa</span> <span className="font-bold text-sm bg-primary/10 px-2 py-1 rounded text-primary">DezLog Secure Freight</span></div>
                      <div className="flex justify-between items-center"><span className="text-muted-foreground block text-sm">Ambiente Operação</span> <span className="font-bold text-sm uppercase">{selectedDoc?.environment}</span></div>
                      <div className="border-t my-2 pt-2"></div>
                      {selectedDoc?.valorServico && <div className="flex justify-between items-center"><span className="text-muted-foreground block text-sm">Montante Base</span> <span className="font-black text-lg text-emerald-600">R$ {selectedDoc?.valorServico}</span></div>}
                      {selectedDoc?.dataEmissao && <div className="flex justify-between items-center"><span className="text-muted-foreground block text-sm">Emitido em</span> <span className="font-bold text-sm">{new Date(selectedDoc.dataEmissao).toLocaleString('pt-BR')}</span></div>}
                    </CardContent>
                  </Card>
                  <Card className="shadow-none border-dashed border-2">
                    <CardHeader className="bg-slate-50/50"><CardTitle className="text-lg">Cadeia Produtiva</CardTitle></CardHeader>
                    <CardContent className="space-y-4 pt-6">
                      {selectedDoc?.remetenteNome && <div className="flex flex-col"><span className="text-muted-foreground block text-xs font-bold uppercase tracking-wider mb-1">Rolo Remetente</span> <span className="font-medium text-sm p-3 bg-white dark:bg-slate-900 border rounded-lg">{selectedDoc.remetenteNome}</span></div>}
                      {selectedDoc?.destinatarioNome && <div className="flex flex-col"><span className="text-muted-foreground block text-xs font-bold uppercase tracking-wider mb-1">Ponto de Descarga</span> <span className="font-medium text-sm p-3 bg-white dark:bg-slate-900 border rounded-lg">{selectedDoc.destinatarioNome}</span></div>}
                      {selectedDoc?.motoristaNome && <div className="flex justify-between items-center mt-4"><span className="text-muted-foreground block text-sm">Escala (Condutor)</span> <span className="font-bold text-sm">{selectedDoc.motoristaNome}</span></div>}
                      {selectedDoc?.veiculoPlacas && <div className="flex justify-between items-center"><span className="text-muted-foreground block text-sm">Tracionamento (Placa)</span> <span className="font-bold text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded">{selectedDoc.veiculoPlacas}</span></div>}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL DE CANCELAMENTO */}
      <Dialog open={!!cancelDoc} onOpenChange={(open) => !open && setCancelDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar CT-e</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Para cancelar este CT-e na SEFAZ, é obrigatório informar uma justificativa detalhada com no mínimo 15 caracteres. O cancelamento só é permitido se a prestação de serviço não tiver iniciado (prazo legal de 168h).
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Justificativa de Cancelamento</label>
              <Textarea
                value={justificativa}
                onChange={e => setJustificativa(e.target.value)}
                placeholder="Ex: Erro de digitação no valor da nota fiscal. O CT-e correto será emitido na sequência."
                rows={4}
              />
              <p className="text-xs text-right text-muted-foreground">Mínimo: {Math.max(0, 15 - justificativa.length)} caracteres restantes</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCancelDoc(null)} disabled={isCanceling}>Voltar</Button>
            <Button variant="destructive" onClick={handleCancelCte} disabled={isCanceling || justificativa.length < 15}>
              {isCanceling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Ban className="w-4 h-4 mr-2" />}
              Solicitar Cancelamento
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL DE CARTA DE CORREÇÃO (CC-e) */}
      <Dialog open={!!cceDoc} onOpenChange={(open) => !open && setCceDoc(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Carta de Correção Eletrônica (CC-e)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              A CC-e permite corrigir erros em campos específicos do CT-e autorizado, desde que não alterem variáveis de impostos, dados de emitente/tomador/remetente/destinatário ou a data de emissão.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Grupo Alterado</label>
                <input 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={cceGrupo}
                  onChange={e => setCceGrupo(e.target.value)}
                  placeholder="Ex: infCTe"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Campo Alterado</label>
                <input 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={cceCampo}
                  onChange={e => setCceCampo(e.target.value)}
                  placeholder="Ex: xObs"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Novo Valor / Correção (Min. 15 caracteres)</label>
              <Textarea
                value={cceValor}
                onChange={e => setCceValor(e.target.value)}
                placeholder="Descreva detalhadamente a correção ou o novo valor para o campo..."
                rows={4}
              />
              <p className="text-xs text-right text-muted-foreground">Mínimo: {Math.max(0, 15 - cceValor.length)} caracteres restantes</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCceDoc(null)} disabled={isSendingCce}>Cancelar</Button>
            <Button onClick={handleSendCce} disabled={isSendingCce || cceValor.length < 15} className="bg-blue-600 hover:bg-blue-700">
              {isSendingCce ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Enviar Correção
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* MODAL DE ENCERRAMENTO MDF-e */}
      <Dialog open={!!closeMdfeDoc} onOpenChange={(open) => !open && setCloseMdfeDoc(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Encerrar MDF-e</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 text-sm">
            <p className="text-muted-foreground">
              O encerramento deve ser realizado após o término do percurso ou quando houver alteração nas informações do MDF-e (como troca de motorista ou veículo).
            </p>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">UF de Encerramento</label>
                <input 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={ufEncerramento}
                  onChange={e => setUfEncerramento(e.target.value)}
                  placeholder="Ex: SP"
                  maxLength={2}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cód. Município</label>
                <input 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={cMunEncerramento}
                  onChange={e => setCMunEncerramento(e.target.value)}
                  placeholder="Ex: 3550308"
                />
              </div>
            </div>
            <p className="bg-amber-50 dark:bg-amber-950 p-3 rounded-lg border border-amber-200 dark:border-amber-900 text-[11px] text-amber-800 dark:text-amber-300">
              <b>Nota:</b> Por padrão, o sistema utiliza o município de descarga final do MDF-e. Altere apenas se o encerramento ocorreu em local diferente.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCloseMdfeDoc(null)} disabled={isClosingMdfe}>Cancelar</Button>
            <Button onClick={handleCloseMdfe} disabled={isClosingMdfe} className="bg-emerald-600 hover:bg-emerald-700 shadow-md">
              {isClosingMdfe ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Confirmar Encerramento
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
