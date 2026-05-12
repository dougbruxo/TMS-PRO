"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/api-client';
import {
  Loader2, ArrowLeft, ShieldCheck, Upload, Trash2, AlertTriangle,
  CheckCircle2, XCircle, Calendar, Building2, FileKey2, Eye, EyeOff
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface CertificateStatus {
  configured: boolean;
  commonName?: string;
  cnpjCpf?: string;
  validFrom?: string;
  validUntil?: string;
  isExpired?: boolean;
  daysRemaining?: number;
  uploadedAt?: string;
  message?: string;
}

export default function CertificatePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [certStatus, setCertStatus] = useState<CertificateStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const fetchCertStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await authFetch('/api/settings/certificate');
      if (res.ok) {
        setCertStatus(await res.json());
      }
    } catch (e) {
      console.error('Erro ao buscar status do certificado', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.settingsAccess) {
      fetchCertStatus();
    }
  }, [user, fetchCertStatus]);

  const handleUpload = async () => {
    if (!selectedFile || !password) {
      toast({ variant: 'destructive', title: 'Preencha todos os campos', description: 'Selecione o arquivo .pfx e informe a senha.' });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('pfxFile', selectedFile);
      formData.append('password', password);

      const res = await authFetch('/api/settings/certificate', {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.message || 'Erro ao enviar certificado.');
      }

      toast({
        title: '✅ Certificado Configurado!',
        description: result.warning || `Válido até ${new Date(result.validUntil).toLocaleDateString('pt-BR')} (${result.daysRemaining} dias).`,
      });

      setSelectedFile(null);
      setPassword('');
      fetchCertStatus();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro no Certificado', description: error.message });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await authFetch('/api/settings/certificate', { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'Certificado Removido', description: 'O certificado digital foi desvinculado do sistema.' });
        setCertStatus({ configured: false });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setIsDeleting(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isConfigured = certStatus?.configured;
  const isExpired = certStatus?.isExpired;
  const isExpiring = (certStatus?.daysRemaining ?? 999) <= 30;

  return (
    <main className="container mx-auto p-4 md:p-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/settings')}
          className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <div className="h-4 w-px bg-border hidden md:block" />
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-primary whitespace-nowrap">Certificado Digital A1</h1>
          <p className="text-xs text-muted-foreground hidden md:block">
            Importe o certificado .pfx para assinatura digital de documentos fiscais (CT-e e MDF-e).
          </p>
        </div>
      </div>

      {/* Status Card */}
      <Card className="mb-6">
        <CardHeader className="flex-row items-center gap-4 space-y-0">
          <div className={`p-3 rounded-full ${isConfigured ? (isExpired ? 'bg-destructive/20' : isExpiring ? 'bg-yellow-500/20' : 'bg-green-500/20') : 'bg-muted'}`}>
            {isConfigured ? (
              isExpired ? <XCircle className="h-8 w-8 text-destructive" /> :
              isExpiring ? <AlertTriangle className="h-8 w-8 text-yellow-500" /> :
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            ) : (
              <ShieldCheck className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">
              {isConfigured
                ? isExpired ? 'Certificado Expirado' : isExpiring ? 'Certificado Próximo do Vencimento' : 'Certificado Ativo'
                : 'Nenhum Certificado Configurado'}
            </CardTitle>
            <CardDescription>
              {isConfigured
                ? `Enviado em ${certStatus?.uploadedAt ? new Date(certStatus.uploadedAt).toLocaleDateString('pt-BR') : 'N/A'}`
                : 'Importe um arquivo .pfx ou .p12 para habilitar a emissão fiscal direta.'}
            </CardDescription>
          </div>
          {isConfigured && (
            <Badge variant={isExpired ? 'destructive' : isExpiring ? 'outline' : 'default'} className="text-xs">
              {isExpired ? 'EXPIRADO' : `${certStatus?.daysRemaining} dias`}
            </Badge>
          )}
        </CardHeader>

        {isConfigured && (
          <CardContent className="space-y-4 pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Titular</p>
                  <p className="text-sm font-medium truncate">{certStatus?.commonName || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <FileKey2 className="h-5 w-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">CNPJ/CPF</p>
                  <p className="text-sm font-medium">{certStatus?.cnpjCpf || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Válido Desde</p>
                  <p className="text-sm font-medium">
                    {certStatus?.validFrom ? new Date(certStatus.validFrom).toLocaleDateString('pt-BR') : 'N/A'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Válido Até</p>
                  <p className={`text-sm font-medium ${isExpired ? 'text-destructive' : isExpiring ? 'text-yellow-500' : ''}`}>
                    {certStatus?.validUntil ? new Date(certStatus.validUntil).toLocaleDateString('pt-BR') : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {isConfigured ? 'Substituir Certificado' : 'Importar Certificado A1'}
          </CardTitle>
          <CardDescription>
            {isConfigured
              ? 'Envie um novo certificado para substituir o atual. O anterior será removido automaticamente.'
              : 'Selecione o arquivo .pfx ou .p12 fornecido pela sua Autoridade Certificadora e informe a senha.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pfxFile">Arquivo do Certificado (.pfx / .p12)</Label>
            <Input
              id="pfxFile"
              type="file"
              accept=".pfx,.p12"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="cursor-pointer"
            />
            {selectedFile && (
              <p className="text-xs text-muted-foreground">
                📎 {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pfxPassword">Senha do Certificado</Label>
            <div className="relative">
              <Input
                id="pfxPassword"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite a senha do certificado..."
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between gap-4">
          {isConfigured && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive hover:text-destructive" disabled={isDeleting}>
                  {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Remover
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover Certificado Digital?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Ao remover, o sistema não conseguirá emitir CT-e ou MDF-e até que um novo certificado seja importado.
                    Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Sim, Remover
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <Button
            onClick={handleUpload}
            disabled={!selectedFile || !password || isUploading}
            className="ml-auto"
          >
            {isUploading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...</>
            ) : (
              <><ShieldCheck className="mr-2 h-4 w-4" /> {isConfigured ? 'Substituir Certificado' : 'Importar Certificado'}</>
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Info Box */}
      <div className="mt-6 p-4 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30">
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">ℹ️ Sobre o Certificado Digital A1</h3>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• O certificado digital A1 é obrigatório para emissão de CT-e e MDF-e.</li>
          <li>• Ele é emitido por Autoridades Certificadoras credenciadas (AC) e tem validade de 1 ano.</li>
          <li>• O arquivo <code className="bg-muted px-1 rounded">.pfx</code> e a senha são armazenados de forma <strong>criptografada</strong> no banco de dados.</li>
          <li>• A senha nunca é transmitida em texto aberto e é protegida com AES-256-GCM.</li>
          <li>• Em caso de dúvidas, entre em contato com o suporte técnico.</li>
        </ul>
      </div>
    </main>
  );
}
