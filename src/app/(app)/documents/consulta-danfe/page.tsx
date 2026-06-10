"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, CheckCircle2, XCircle, Info, FileText } from 'lucide-react';
import { authFetch } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/PageHeader';

export default function ConsultaSefazPage() {
    const [chaveInput, setChaveInput] = useState('');
    const [isConsulting, setIsConsulting] = useState(false);
    const [consultaResult, setConsultaResult] = useState<{ 
        cStat?: string; 
        xMotivo?: string; 
        ambiente?: string; 
        tipo?: string;
        pdf_base64?: string;
        xml_base64?: string;
        source?: string;
    } | null>(null);
    const [consultaError, setConsultaError] = useState('');
    const { toast } = useToast();

    const handleConsulta = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        
        const cleanChave = chaveInput.replace(/\D/g, '');
        if (cleanChave.length !== 44) {
            setConsultaError('A chave de acesso deve ter exatamente 44 dígitos.');
            return;
        }

        setIsConsulting(true);
        setConsultaError('');
        setConsultaResult(null);

        try {
            const res = await authFetch('/api/nfe/consulta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chave: cleanChave }),
            });
            const data = await res.json();
            
            if (!res.ok) {
                setConsultaError(data.message || 'Erro ao consultar o documento na SEFAZ.');
                toast({
                    variant: "destructive",
                    title: "Erro na Consulta",
                    description: data.message || 'Erro ao consultar o documento na SEFAZ.'
                });
            } else {
                setConsultaResult(data);
                toast({
                    title: "Consulta Finalizada",
                    description: data.source === 'consultadanfe' 
                        ? "Documento localizado via ConsultaDanfe com sucesso." 
                        : "Retorno da SEFAZ obtido com sucesso."
                });
            }
        } catch (error) {
            setConsultaError('Falha na conexão com o servidor. Tente novamente mais tarde.');
        } finally {
            setIsConsulting(false);
        }
    };

    const downloadFile = (base64: string, filename: string, type: string) => {
        const linkSource = `data:${type};base64,${base64}`;
        const downloadLink = document.createElement("a");
        downloadLink.href = linkSource;
        downloadLink.download = filename;
        downloadLink.click();
    };

    const viewFile = (base64: string, type: string) => {
        const blob = base64ToBlob(base64, type);
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    };

    const base64ToBlob = (base64: string, type: string) => {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type });
    };    return (
        <main className="container mx-auto p-4 md:p-8 max-w-4xl flex flex-col relative overflow-hidden animate-in fade-in duration-500">
            <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/15 rounded-full blur-[100px] pointer-events-none -z-10 animate-float-blur-1" />
            <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-purple-500/15 rounded-full blur-[120px] pointer-events-none -z-10 animate-float-blur-2" />

            <PageHeader 
                icon={<Search className="h-5 w-5" />}
                badge="SEFAZ"
                titlePrefix="Consulta Status"
                titleHighlight="SEFAZ"
                description="Verifique a situação atual da NF-e, CT-e ou MDF-e diretamente nos servidores da SEFAZ utilizando a chave de acesso."
                backHref="/documents"
                backLabel="Documentos"
            />

            <Card className="w-full border border-border/40 bg-card/45 backdrop-blur-2xl shadow-xl rounded-2xl relative overflow-hidden transition-all duration-300 hover:shadow-2xl">
                <CardHeader className="pb-6">
                    <CardTitle className="flex items-center gap-2 text-xl">
                        <Search className="w-6 h-6 text-primary" />
                        Consultar via Chave de Acesso
                    </CardTitle>
                    <CardDescription>
                        Insira a chave de 44 dígitos do documento (NF-e, CT-e ou MDF-e).
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <form onSubmit={handleConsulta} className="flex flex-col md:flex-row gap-4">
                        <div className="flex-grow flex flex-col gap-1">
                            <Input 
                                placeholder="Cole a Chave de Acesso (aceita espaços)" 
                                value={chaveInput}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    const clean = val.replace(/\D/g, '').substring(0, 44);
                                    setChaveInput(clean);
                                }}
                                className="text-lg py-6 font-mono"
                                autoFocus
                            />
                            {chaveInput.length > 0 && chaveInput.length < 44 && (
                                <span className="text-xs text-muted-foreground ml-1">
                                    {chaveInput.length} / 44 dígitos
                                </span>
                            )}
                        </div>
                        <Button 
                            type="submit" 
                            disabled={isConsulting || chaveInput.replace(/\D/g, '').length !== 44}
                            className="py-6 px-8 text-lg md:w-auto w-full"
                        >
                            {isConsulting ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Consultando...
                                </>
                            ) : (
                                'Consultar'
                            )}
                        </Button>
                    </form>

                    {consultaError && (
                        <div className="mt-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-3 text-destructive animate-in fade-in duration-300">
                            <XCircle className="w-6 h-6 shrink-0" />
                            <p className="font-medium">{consultaError}</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {consultaResult && (
                <div className="w-full mt-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Header de Sucesso */}
                    <div className="border border-emerald-500/30 bg-emerald-500/5 backdrop-blur-md rounded-2xl p-8 text-center space-y-4 shadow-lg">
                        <div className="mx-auto bg-emerald-500 text-white p-2 rounded-full w-12 h-12 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                            <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <h2 className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">DANF-e Gerado com Sucesso!</h2>
                        <p className="text-emerald-600/80 dark:text-emerald-400/80 text-lg">
                            Seu documento fiscal foi processado e está pronto para download.
                        </p>
                    </div>

                    {/* Card PDF */}
                    {consultaResult.pdf_base64 && (
                        <Card className="border border-border/40 bg-card/45 backdrop-blur-2xl shadow-xl rounded-2xl relative overflow-hidden transition-all duration-300 hover:shadow-2xl">
                            <div className="flex flex-col md:flex-row items-center p-6 gap-6">
                                <div className="bg-red-500/10 p-4 rounded-2xl">
                                    <div className="bg-red-500/20 p-3 rounded-xl">
                                        <FileText className="w-10 h-10 text-red-500" />
                                    </div>
                                </div>
                                <div className="flex-grow text-center md:text-left space-y-2">
                                    <h3 className="text-2xl font-bold text-foreground">DANFe PDF</h3>
                                    <p className="text-muted-foreground text-sm">Documento Auxiliar da Nota Fiscal Eletrônica</p>
                                    <div className="flex flex-wrap justify-center md:justify-start gap-4 pt-2">
                                        <div className="flex items-center gap-1.5 text-primary font-medium">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                            <span className="text-sm">Padrão SEFAZ</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-primary font-medium">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                            <span className="text-sm">Alta Qualidade</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                                    <Button 
                                        variant="outline" 
                                        className="border-primary text-primary hover:bg-primary/5 py-6 px-6 text-lg rounded-xl flex items-center gap-2"
                                        onClick={() => viewFile(consultaResult.pdf_base64!, 'application/pdf')}
                                    >
                                        <Search className="w-5 h-5" />
                                        Visualizar
                                    </Button>
                                    <Button 
                                        className="bg-primary hover:bg-primary/90 text-primary-foreground py-6 px-6 text-lg rounded-xl flex items-center gap-2"
                                        onClick={() => downloadFile(consultaResult.pdf_base64!, `documento_${consultaResult.chave}.pdf`, 'application/pdf')}
                                    >
                                        <FileText className="w-5 h-5" />
                                        Baixar PDF
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Card XML */}
                    {consultaResult.xml_base64 && (
                        <Card className="border border-border/40 bg-card/45 backdrop-blur-2xl shadow-xl rounded-2xl relative overflow-hidden transition-all duration-300 hover:shadow-2xl">
                            <div className="flex flex-col md:flex-row items-center p-6 gap-6">
                                <div className="bg-primary/10 p-4 rounded-2xl">
                                    <div className="bg-primary/20 p-3 rounded-xl">
                                        <FileText className="w-10 h-10 text-primary" />
                                    </div>
                                </div>
                                <div className="flex-grow text-center md:text-left space-y-2">
                                    <h3 className="text-2xl font-bold text-slate-800 dark:text-foreground">DANFe XML</h3>
                                    <p className="text-muted-foreground text-sm">Arquivo fonte da Nota Fiscal Eletrônica (NF-e)</p>
                                    <div className="flex flex-wrap justify-center md:justify-start gap-4 pt-2">
                                        <div className="flex items-center gap-1.5 text-primary font-medium">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                            <span className="text-sm">Arquivo Original</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-primary font-medium">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                            <span className="text-sm">Dados Completos</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="w-full md:w-auto">
                                    <Button 
                                        variant="outline" 
                                        className="border-primary/30 text-primary hover:bg-primary/5 py-6 px-8 text-lg rounded-xl w-full flex items-center justify-center gap-2"
                                        onClick={() => downloadFile(consultaResult.xml_base64!, `documento_${consultaResult.chave}.xml`, 'text/xml')}
                                    >
                                        <FileText className="w-5 h-5" />
                                        Baixar XML
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    )}
                </div>
            )}

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
