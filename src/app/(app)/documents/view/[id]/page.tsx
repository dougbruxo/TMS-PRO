"use client";

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BackButton } from '@/components/BackButton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Printer, Download, ArrowLeft, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/api-client';

export default function DocumentViewerPage() {
    const params = useParams();
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();
    
    const [doc, setDoc] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        if (authLoading) return;
        if (!user || (!user.documentsAccess && !user.operationalAccess)) {
            router.push('/dashboard');
            return;
        }

        authFetch(`/api/documents/${params.id}`)
            .then(res => {
                if (!res.ok) throw new Error('Falha ao carregar documento.');
                return res.json();
            })
            .then(data => setDoc(data))
            .catch(err => toast({ variant: 'destructive', title: 'Erro', description: err.message }))
            .finally(() => setLoading(false));
    }, [user, authLoading, params.id, router, toast]);

    const handlePrint = () => {
        if (iframeRef.current && iframeRef.current.contentWindow) {
            const oldTitle = document.title;
            const cleanNumero = String(doc?.numeroCte || '').replace(/\D/g, '').replace(/^0+/, '') || '0';
            const dacteNumFormatado = cleanNumero.padStart(2, '0');
            document.title = `CTe-${dacteNumFormatado}`;

            iframeRef.current.contentWindow.print();

            setTimeout(() => {
                document.title = oldTitle;
            }, 1000);
        } else {
            toast({ title: 'Aviso', description: 'Abrindo guia oficial para impressão.', variant: 'default' });
            window.open(doc.pdfUrl, '_blank');
        }
    };

    if (authLoading || loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;
    
    if (!doc) return <div className="p-8 text-center text-xl flex flex-col justify-center items-center"><AlertCircle className="w-12 h-12 mb-4 text-rose-500 opacity-50"/> Referência de ID Fiscal Inválida. </div>;

    const isSuccess = ['autorizado', 'concluido', 'sucesso'].some(s => doc.status?.toLowerCase().includes(s));

    return (
        <main className="container mx-auto p-4 md:p-8 space-y-6 animate-fade-in fade-in duration-300">
            <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
                <div />
                <div className="flex items-center gap-3">
                    {doc.xmlUrl && <Button variant="outline" onClick={() => window.open(doc.xmlUrl, '_blank')}><Download className="mr-2 w-4 h-4"/> Baixar XML</Button>}
                    {doc.pdfUrl && (
                        <Button variant="outline" asChild>
                            <a 
                                href={doc.pdfUrl} 
                                download={`CTe-${String(doc.numeroCte || '').replace(/\D/g, '').replace(/^0+/, '').padStart(2, '0') || 'Documento'}.pdf`}
                            >
                                <Download className="mr-2 w-4 h-4" /> Baixar PDF
                            </a>
                        </Button>
                    )}
                    {doc.pdfUrl && <Button onClick={handlePrint} className="bg-primary shadow-lg"><Printer className="mr-2 w-4 h-4"/> Imprimir {doc.type}</Button>}
                    <BackButton className="mb-0" />
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center shadow-sm">
                <div className="space-y-1">
                    <h1 className="text-2xl font-black flex items-center gap-3">
                        Monitor de {doc.type}
                        {isSuccess ? <Badge className="bg-emerald-500/10 text-emerald-600 border-none"><CheckCircle2 className="w-4 h-4 mr-1"/> AUTORIZADO SEFAZ</Badge> : <Badge variant="destructive" className="border-none shadow-none"><AlertCircle className="w-4 h-4 mr-1"/> {doc.status}</Badge>}
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm font-mono tracking-tighter">
                        CHAVE: {doc.chaveAcesso || 'N/A'} <br/> Protocolo SEFAZ: {doc.protocolo || 'Aguardando'}
                    </p>
                </div>
                <div className="text-left md:text-right mt-4 md:mt-0 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Emitido em</p>
                    <p className="font-bold text-lg">{new Date(doc.dataEmissao).toLocaleString('pt-BR')}</p>
                </div>
            </div>

            <Tabs defaultValue="pdf" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6 h-12 bg-slate-100 dark:bg-slate-900">
                    <TabsTrigger value="pdf" className="data-[state=active]:bg-white data-[state=active]:shadow-md font-semibold tracking-tight"><FileText className="w-5 h-5 mr-2 text-primary"/> Espelho Oficial (PDF)</TabsTrigger>
                    <TabsTrigger value="ficha" className="data-[state=active]:bg-white data-[state=active]:shadow-md font-semibold tracking-tight"><CheckCircle2 className="w-5 h-5 mr-2 text-primary"/> Ficha Estendida</TabsTrigger>
                </TabsList>
                
                <TabsContent value="pdf" className="h-[820px] border-2 border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center animate-fade-in shadow-inner">
                    {doc.pdfUrl ? (
                        <iframe 
                            ref={iframeRef} 
                            src={doc.pdfUrl} 
                            className="w-full h-full" 
                            title={`CTe-${String(doc.numeroCte || '').replace(/\D/g, '').replace(/^0+/, '').padStart(2, '0') || 'Documento'}`} 
                        />
                    ) : (
                        <div className="text-muted-foreground flex flex-col items-center">
                            <AlertCircle className="w-16 h-16 mb-4 opacity-20"/>
                            <h2 className="text-xl font-bold opacity-50">Documento Sem Recibo em Anexo</h2>
                            <p className="opacity-50">Isso ocorre quando a SEFAZ não autoriza a geração do boleto (Ex: Rejeição de Dados).</p>
                        </div>
                    )}
                </TabsContent>
                
                <TabsContent value="ficha" className="space-y-6 animate-fade-in">
                    <div className="grid md:grid-cols-2 gap-6">
                        <Card className="shadow-none border-dashed border-2">
                            <CardHeader className="bg-slate-50/50"><CardTitle className="text-lg">Raio-X / Valoração</CardTitle></CardHeader>
                            <CardContent className="space-y-4 pt-6">
                                <div className="flex justify-between items-center"><span className="text-muted-foreground block text-sm">Empresa Ativa</span> <span className="font-bold text-sm bg-primary/10 px-2 py-1 rounded text-primary">DezLog Secure Freight</span></div>
                                <div className="flex justify-between items-center"><span className="text-muted-foreground block text-sm">Topologia da Carga</span> <span className="font-bold text-sm">{doc.type} Eletrônico</span></div>
                                <div className="flex justify-between items-center"><span className="text-muted-foreground block text-sm">Ambiente de Operação</span> <span className="font-bold text-sm uppercase">{doc.environment}</span></div>
                                <div className="border-t my-2 pt-2"></div>
                                {doc.valorServico && <div className="flex justify-between items-center"><span className="text-muted-foreground block text-sm">Montante Base Declarado</span> <span className="font-black text-lg text-emerald-600">R$ {doc.valorServico}</span></div>}
                            </CardContent>
                        </Card>
                        <Card className="shadow-none border-dashed border-2">
                            <CardHeader className="bg-slate-50/50"><CardTitle className="text-lg">Cadeia Produtiva</CardTitle></CardHeader>
                            <CardContent className="space-y-4 pt-6">
                                {doc.remetenteNome && <div className="flex flex-col"><span className="text-muted-foreground block text-xs font-bold uppercase tracking-wider mb-1">Rolo Remetente</span> <span className="font-medium text-sm p-3 bg-slate-50 rounded-lg">{doc.remetenteNome}</span></div>}
                                {doc.destinatarioNome && <div className="flex flex-col"><span className="text-muted-foreground block text-xs font-bold uppercase tracking-wider mb-1">Ponto de Descarga (Destinatário)</span> <span className="font-medium text-sm p-3 bg-slate-50 rounded-lg">{doc.destinatarioNome}</span></div>}
                                {doc.motoristaNome && <div className="flex justify-between items-center mt-4"><span className="text-muted-foreground block text-sm">Escala (Condutor)</span> <span className="font-bold text-sm">{doc.motoristaNome}</span></div>}
                                {doc.veiculoPlacas && <div className="flex justify-between items-center"><span className="text-muted-foreground block text-sm">Tracionamento (Placa)</span> <span className="font-bold text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded">{doc.veiculoPlacas}</span></div>}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>

        </main>
    );
}
