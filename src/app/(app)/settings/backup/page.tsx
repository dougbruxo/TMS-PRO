
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Download, Trash2, ShieldAlert, History, Upload, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authFetch } from '@/lib/api-client';

export default function BackupPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isCreatingRestorePoint, setIsCreatingRestorePoint] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastBackupInfo, setLastBackupInfo] = useState<{ date: string; size: number } | null>(null);
  const [fileToRestore, setFileToRestore] = useState<File | null>(null);

  // Quote Counter State
  const [quoteCounter, setQuoteCounter] = useState<number>(0);
  const [isUpdatingCounter, setIsUpdatingCounter] = useState(false);

  const [isFinalConfirmOpen, setIsFinalConfirmOpen] = useState(false);
  const [finalConfirmText, setFinalConfirmText] = useState('');
  const [mathChallenge, setMathChallenge] = useState({ num1: 0, num2: 0, answer: 0 });
  const [mathAnswer, setMathAnswer] = useState('');

  const fetchBackupInfo = useCallback(async () => {
    try {
      const response = await authFetch('/api/system/backup');
      if (response.ok) {
        setLastBackupInfo(await response.json());
      } else {
        setLastBackupInfo(null);
      }
    } catch (error) {
      setLastBackupInfo(null);
      console.error("Failed to fetch backup info:", error);
    }
  }, []);

  const fetchQuoteCounter = useCallback(async () => {
    try {
      const response = await authFetch('/api/system/quote-counter');
      if (response.ok) {
        const data = await response.json();
        setQuoteCounter(data.seq);
      }
    } catch (error) {
      console.error("Failed to fetch quote counter:", error);
    }
  }, []);

  useEffect(() => {
    if(user?.role === 'admin') {
      fetchBackupInfo();
      fetchQuoteCounter();
    }
  }, [user, fetchBackupInfo, fetchQuoteCounter]);

  const handleExportBackup = async () => {
    setIsBackingUp(true);
    toast({ title: 'A iniciar backup...', description: 'A recolher todos os dados do sistema. Isto pode demorar alguns momentos.' });
    try {
      const response = await authFetch('/api/app-data');
      if (!response.ok) {
        throw new Error('Falha ao obter os dados do servidor.');
      }
      const data = await response.json();
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(data, null, 2)
      )}`;
      const link = document.createElement("a");
      link.href = jsonString;
      const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
      link.download = `dezlog_backup_${timestamp}.json`;
      link.click();
      toast({ title: 'Sucesso!', description: 'O ficheiro de backup foi descarregado.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro no Backup', description: error.message });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    toast({ title: 'A redefinir o sistema...', description: 'Esta ação pode demorar alguns segundos. Não feche esta página.' });
    try {
        const response = await authFetch('/api/system/reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user?.id }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Falha ao redefinir o sistema.');
        }

        toast({ title: 'Sistema Redefinido!', description: 'Todos os dados foram apagados. A aplicação será recarregada.' });
        
        setTimeout(() => {
            window.location.reload();
        }, 2000);

    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Erro ao Redefinir', description: error.message });
        setIsResetting(false);
    }
  };
  
   const handleCreateRestorePoint = async () => {
    setIsCreatingRestorePoint(true);
    toast({ title: 'A criar ponto de restauração...', description: 'A guardar todos os dados do sistema no servidor.' });
    try {
      const response = await authFetch('/api/system/backup', { method: 'POST' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha ao criar o ponto de restauração.');
      }
      toast({ title: 'Sucesso!', description: 'Ponto de restauração criado com sucesso.' });
      fetchBackupInfo();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro ao Criar Ponto de Restauração', description: error.message });
    } finally {
      setIsCreatingRestorePoint(false);
    }
  };

  const handleRestoreFromFile = async () => {
    if (!fileToRestore) {
        toast({ variant: 'destructive', title: 'Nenhum ficheiro selecionado' });
        return;
    }

    setIsRestoring(true);
    toast({ title: 'A iniciar restauração...', description: 'Não feche esta página. O sistema será recarregado ao concluir.' });

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const fileContent = event.target?.result;
            if (typeof fileContent !== 'string') {
                throw new Error("Falha ao ler o ficheiro.");
            }
            const data = JSON.parse(fileContent);

            const response = await authFetch('/api/system/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Falha ao restaurar dados do ficheiro.');
            }

            toast({ title: 'Restauração Concluída!', description: 'Os dados foram restaurados com sucesso. A aplicação será recarregada.' });
            setTimeout(() => window.location.reload(), 3000);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro na Restauração', description: error.message });
            setIsRestoring(false);
        }
    };
    reader.onerror = () => {
        toast({ variant: 'destructive', title: 'Erro de Leitura', description: 'Não foi possível ler o ficheiro selecionado.' });
        setIsRestoring(false);
    };
    reader.readAsText(fileToRestore);
  };

  const handleRestoreFromPoint = async () => {
     setIsRestoring(true);
    toast({ title: 'A restaurar a partir do ponto...', description: 'Esta ação pode demorar alguns momentos. A página será recarregada ao concluir.' });
    try {
        const response = await authFetch('/api/system/restore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: 'server' }), // Indicate to restore from server's file
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Falha ao restaurar dados.');
        }

        toast({ title: 'Restauração Concluída!', description: 'O sistema foi restaurado para o último ponto. A aplicação será recarregada.' });
        setTimeout(() => window.location.reload(), 3000);
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Erro na Restauração', description: error.message });
        setIsRestoring(false);
    }
  };

  const openFinalConfirmDialog = () => {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    setMathChallenge({ num1, num2, answer: num1 + num2 });
    setFinalConfirmText('');
    setMathAnswer('');
    setIsFinalConfirmOpen(true);
  };

  const handleUpdateQuoteCounter = async () => {
    setIsUpdatingCounter(true);
    try {
        const response = await authFetch('/api/system/quote-counter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ seq: quoteCounter })
        });
        if (!response.ok) throw new Error('Falha ao atualizar contador de cotações.');
        toast({ title: 'Contador Atualizado', description: 'A numeração de cotações recomeçará a partir desse valor.' });
    } catch (err: any) {
        toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally {
        setIsUpdatingCounter(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="container mx-auto p-4 md:p-8">
      <Button variant="outline" onClick={() => router.push('/settings')} className="mb-8">
        &larr; Voltar para Configurações
      </Button>
      <h1 className="text-3xl font-bold text-primary mb-2">Backup e Restauração</h1>
      <p className="text-muted-foreground mb-8">Exporte, restaure ou apague os dados do sistema.</p>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
         <Card>
          <CardHeader>
            <CardTitle>Ponto de Restauração</CardTitle>
            <CardDescription>
              Crie um backup completo do estado atual do sistema, que fica guardado no servidor.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {lastBackupInfo ? (
              <div className="text-sm space-y-1">
                <p><strong>Último Ponto:</strong> {format(new Date(lastBackupInfo.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                <p><strong>Tamanho:</strong> {(lastBackupInfo.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum ponto de restauração criado ainda.</p>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={handleCreateRestorePoint} disabled={isCreatingRestorePoint}>
              {isCreatingRestorePoint ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {lastBackupInfo ? 'Atualizar Ponto de Restauração' : 'Criar Ponto de Restauração'}
            </Button>
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Restaurar Sistema</CardTitle>
            <CardDescription>
              Restaure o sistema a partir do ponto de restauração guardado no servidor ou de um ficheiro JSON manual.
            </CardDescription>
          </CardHeader>
           <CardContent className="space-y-4">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="secondary" className="w-full" disabled={!lastBackupInfo || isRestoring}>
                    <History className="mr-2 h-4 w-4" /> Restaurar do Ponto Salvo
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Restaurar a partir do ponto salvo?</AlertDialogTitle><AlertDialogDescription>Isto substituirá todos os dados atuais pelos dados do ponto de restauração de {lastBackupInfo && format(new Date(lastBackupInfo.date), "dd/MM/yyyy 'às' HH:mm")}. Esta ação é irreversível.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleRestoreFromPoint}>Sim, Restaurar</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <div className="space-y-2">
                <Input type="file" accept=".json" onChange={(e) => setFileToRestore(e.target.files?.[0] || null)} ref={fileInputRef} />
                 <AlertDialog>
                  <AlertDialogTrigger asChild>
                     <Button variant="secondary" className="w-full" disabled={!fileToRestore || isRestoring}>
                        <Upload className="mr-2 h-4 w-4" /> Restaurar do Ficheiro
                     </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Restaurar a partir do ficheiro?</AlertDialogTitle><AlertDialogDescription>Isto substituirá todos os dados atuais pelos dados do ficheiro selecionado. Esta ação é irreversível.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleRestoreFromFile}>Sim, Restaurar</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
           </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Backup Manual (Exportar)</CardTitle>
            <CardDescription>
              Crie um backup de todos os dados do sistema e descarregue-o como um ficheiro JSON.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={handleExportBackup} disabled={isBackingUp}>
              {isBackingUp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Exportar Backup Completo
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Numeração de Cotações</CardTitle>
            <CardDescription>
              Ajuste o contador interno de cotações. Útil após um reset de sistema para continuação do antigo numeral.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <div className="space-y-2">
                 <Label htmlFor="counter">Última Numeração Emitida</Label>
                 <Input 
                    id="counter" 
                    type="number" 
                    min={0}
                    value={quoteCounter} 
                    onChange={e => setQuoteCounter(parseInt(e.target.value) || 0)} 
                 />
                 <p className="text-xs text-muted-foreground">O sistema emitirá a próxima cotação usando este número + 1.</p>
             </div>
          </CardContent>
          <CardFooter>
             <Button onClick={handleUpdateQuoteCounter} disabled={isUpdatingCounter} className="w-full">
               {isUpdatingCounter && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
               Salvar Numeração
             </Button>
          </CardFooter>
        </Card>

        <Card className="border-destructive md:col-span-2 lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2"><ShieldAlert />Área de Perigo: Redefinir Dados</CardTitle>
            <CardDescription>
              Esta ação irá apagar permanentemente todos os dados operacionais (cotações, despesas, romaneios, etc.). Os utilizadores e as configurações principais serão mantidos. Use com extrema precaução.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isResetting}>
                  {isResetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Redefinir Dados Agora
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Tem a certeza absoluta?</AlertDialogTitle>
                  <AlertDialogDescription>
                      Esta ação é irreversível. Todos os dados operacionais serão apagados. <strong>Recomendamos fortemente que crie um ponto de restauração antes de prosseguir.</strong>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={openFinalConfirmDialog}>
                      Sim, entendo as consequências
                    </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        </Card>
      </div>

      <Dialog open={isFinalConfirmOpen} onOpenChange={setIsFinalConfirmOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Confirmação Final e Irreversível</DialogTitle>
                <DialogDescription>
                    Esta é a sua última oportunidade de cancelar. Para prosseguir, por favor, complete os desafios abaixo.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="confirm-text">Para confirmar, digite <strong>redefinir dados</strong> abaixo:</Label>
                    <Input
                        id="confirm-text"
                        value={finalConfirmText}
                        onChange={(e) => setFinalConfirmText(e.target.value)}
                        autoComplete="off"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="math-challenge">Para confirmar, resolva: {mathChallenge.num1} + {mathChallenge.num2} = ?</Label>
                    <Input
                        id="math-challenge"
                        type="number"
                        value={mathAnswer}
                        onChange={(e) => setMathAnswer(e.target.value)}
                        autoComplete="off"
                    />
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="secondary" disabled={isResetting}>Cancelar</Button>
                </DialogClose>
                <Button
                    variant="destructive"
                    onClick={handleReset}
                    disabled={
                        isResetting ||
                        finalConfirmText.toLowerCase() !== 'redefinir dados' ||
                        parseInt(mathAnswer, 10) !== mathChallenge.answer
                    }
                >
                    {isResetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldAlert className="mr-2 h-4 w-4" />}
                    Confirmar e Redefinir Permanentemente
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
