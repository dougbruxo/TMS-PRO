"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, CheckCircle2, XCircle, Info } from 'lucide-react';
import { authFetch } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';

export default function ConsultaSefazPage() {
    const [chaveInput, setChaveInput] = useState('');
    const [isConsulting, setIsConsulting] = useState(false);
    const [consultaResult, setConsultaResult] = useState<{ cStat?: string; xMotivo?: string; ambiente?: string; tipo?: string } | null>(null);
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
                    description: "Retorno da SEFAZ obtido com sucesso."
                });
            }
        } catch (error) {
            setConsultaError('Falha na conexão com o servidor. Tente novamente mais tarde.');
        } finally {
            setIsConsulting(false);
        }
    };

    return (
        <div className="container mx-auto p-4 md:p-8 max-w-4xl flex flex-col items-center">
            <div className="text-center mb-10 w-full max-w-2xl mt-10">
                <h1 className="text-4xl font-extrabold text-primary mb-4">Consulta Status SEFAZ</h1>
                <p className="text-lg text-muted-foreground">
                    Verifique a situação atual do CT-e ou MDF-e diretamente nos servidores da SEFAZ utilizando a chave de acesso.
                </p>
            </div>

            <Card className="w-full shadow-lg border-primary/20">
                <CardHeader className="bg-primary/5 pb-6">
                    <CardTitle className="flex items-center gap-2 text-xl">
                        <Search className="w-6 h-6 text-primary" />
                        Consultar via Chave de Acesso
                    </CardTitle>
                    <CardDescription>
                        Insira a chave de 44 dígitos do documento (CT-e ou MDF-e).
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <form onSubmit={handleConsulta} className="flex flex-col md:flex-row gap-4">
                        <Input 
                            placeholder="Digite a Chave de Acesso (44 dígitos)" 
                            value={chaveInput}
                            onChange={(e) => setChaveInput(e.target.value.replace(/\D/g, ''))}
                            maxLength={44}
                            className="flex-grow text-lg py-6"
                            autoFocus
                        />
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
                        <div className="mt-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-3 text-destructive">
                            <XCircle className="w-6 h-6 shrink-0" />
                            <p className="font-medium">{consultaError}</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {consultaResult && (
                <div className="w-full mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <Card className="border-blue-200 bg-blue-50/50">
                        <CardHeader className="text-center pb-2">
                            <div className="mx-auto bg-blue-100 p-3 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                                <Info className="w-8 h-8 text-blue-600" />
                            </div>
                            <CardTitle className="text-2xl text-blue-800">Situação do Documento</CardTitle>
                            <CardDescription className="text-blue-700/80">
                                Retorno oficial dos WebServices da SEFAZ
                            </CardDescription>
                        </CardHeader>
                        
                        <CardContent className="space-y-6 pt-6">
                            <div className="bg-white p-6 rounded-xl border shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div>
                                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Status (cStat)</h3>
                                    <div className="flex items-center gap-2">
                                        {consultaResult.cStat === '100' ? (
                                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                                        ) : consultaResult.cStat === '101' ? (
                                            <XCircle className="w-5 h-5 text-red-600" />
                                        ) : (
                                            <Info className="w-5 h-5 text-blue-600" />
                                        )}
                                        <p className="text-xl font-bold text-slate-800">{consultaResult.cStat}</p>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Motivo (xMotivo)</h3>
                                    <p className="text-lg font-medium text-slate-800">{consultaResult.xMotivo}</p>
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Tipo</h3>
                                    <p className="text-lg font-medium text-slate-800">{consultaResult.tipo || 'Desconhecido'}</p>
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Ambiente</h3>
                                    <p className="text-lg font-medium text-slate-800 capitalize">{consultaResult.ambiente || 'Não informado'}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
