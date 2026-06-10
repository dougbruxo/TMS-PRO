import React, { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Upload, Search, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface NfeAttachmentDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onXmlObtained: (xmlContent: string) => void;
    title?: string;
    description?: string;
}

export function NfeAttachmentDialog({ 
    isOpen, 
    onOpenChange, 
    onXmlObtained,
    title = "Importar Dados da NF-e",
    description = "Preencha os dados a partir de uma Chave de Acesso ou enviando o arquivo XML diretamente."
}: NfeAttachmentDialogProps) {
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [accessKey, setAccessKey] = useState('');
    const [isFetching, setIsFetching] = useState(false);

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const xmlContent = e.target?.result as string;
            onXmlObtained(xmlContent);
            onOpenChange(false);
            setAccessKey(''); // Reset for next time
        };
        reader.onerror = () => {
            toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao ler o arquivo selecionado.' });
        };
        reader.readAsText(file);
        event.target.value = ''; // Reset
    };

    const handleFetchByKey = async () => {
        if (accessKey.length !== 44) return;
        setIsFetching(true);
        try {
            const res = await fetch('/api/nfe/consulta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chave: accessKey })
            });
            
            if (!res.ok) {
                let msg = 'Documento não encontrado ou erro no serviço externo.';
                try {
                    const data = await res.json();
                    if (data.message) msg = data.message;
                } catch(e) {
                    console.error('Error parsing error response:', e);
                }
                toast({ 
                    variant: 'destructive', 
                    title: 'Falha na Busca', 
                    description: msg 
                });
                return;
            }

            const data = await res.json();
            if (data && data.xml_base64) {
                const xmlText = atob(data.xml_base64);
                let decodedXml = xmlText;
                try {
                    decodedXml = decodeURIComponent(escape(xmlText));
                } catch(e) {
                    console.error('Failed to decode UTF-8 XML string, using fallback', e);
                }
                onXmlObtained(decodedXml);
                onOpenChange(false);
                setAccessKey(''); // Reset for next time
            } else {
                toast({ variant: 'destructive', title: 'Erro', description: 'Nenhum XML retornado pelo serviço de consulta.' });
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erro de conexão', description: 'Não foi possível buscar a NF-e no momento.' });
        } finally {
            setIsFetching(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md bg-card/95 backdrop-blur-xl border-border/50">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                    <div className="flex flex-col space-y-3">
                        <Label className="text-foreground/80 font-medium">Buscar por Chave de Acesso</Label>
                        <div className="flex flex-col gap-2">
                            <div className="flex gap-2">
                                <Input 
                                    placeholder="Digite ou cole a chave (aceita espaços)" 
                                    value={accessKey}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        // Permitir dígitos e espaços enquanto digita/cola
                                        const filtered = val.replace(/[^\d\s]/g, '');
                                        // Mas para o estado interno, mantemos apenas dígitos para facilitar a busca
                                        setAccessKey(filtered.replace(/\s/g, '').substring(0, 44));
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && accessKey.length === 44 && !isFetching) {
                                            handleFetchByKey();
                                        }
                                    }}
                                    className="font-mono text-sm bg-background/50 focus:bg-background h-12"
                                />
                                <Button 
                                    className="h-12 px-6"
                                    disabled={accessKey.length !== 44 || isFetching} 
                                    onClick={handleFetchByKey}
                                >
                                    {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                                    {isFetching ? "Buscando..." : "Buscar"}
                                </Button>
                            </div>
                            {accessKey.length > 0 && accessKey.length < 44 && (
                                <span className="text-[10px] text-muted-foreground animate-pulse">
                                    {accessKey.length} de 44 dígitos informados
                                </span>
                            )}
                        </div>
                    </div>
                    
                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/50" /></div>
                        <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground font-semibold">OU ANEXE O ARQUIVO</span></div>
                    </div>

                    <div 
                        className="border-2 border-dashed border-primary/20 hover:border-primary/50 hover:bg-primary/5 transition-all rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer bg-muted/10 group"
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                            e.preventDefault();
                            const file = e.dataTransfer.files?.[0];
                            if (file && file.name.endsWith('.xml')) {
                                const reader = new FileReader();
                                reader.onload = (e) => {
                                    onXmlObtained(e.target?.result as string);
                                    onOpenChange(false);
                                };
                                reader.readAsText(file);
                            } else {
                                toast({ variant: 'destructive', title: 'Arquivo inválido', description: 'Por favor, arraste um arquivo .xml válido.' });
                            }
                        }}
                    >
                        <Input 
                            type="file" 
                            accept=".xml" 
                            ref={fileInputRef} 
                            onChange={handleFileSelect} 
                            className="hidden" 
                        />
                        <div className="rounded-full bg-primary/10 p-3 mb-4 group-hover:scale-110 transition-transform">
                            <Upload className="h-6 w-6 text-primary" />
                        </div>
                        <p className="text-sm font-medium mb-1 text-foreground">Clique para procurar ou arraste o XML</p>
                        <p className="text-xs text-muted-foreground text-center">
                            Apenas arquivos estruturados da NF-e
                        </p>
                    </div>
                </div>

                <DialogFooter className="mt-4">
                    <DialogClose asChild>
                        <Button type="button" variant="ghost">Cancelar</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
