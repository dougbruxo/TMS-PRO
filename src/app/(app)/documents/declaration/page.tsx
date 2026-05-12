
"use client";

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Printer, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DeclarationDocument } from '@/components/DeclarationDocument';

const declarationSchema = z.object({
  remetente: z.string().min(1, 'Remetente é obrigatório.'),
  remetenteCnpj: z.string().min(1, 'CNPJ/CPF do remetente é obrigatório.'),
  destinatario: z.string().min(1, 'Destinatário é obrigatório.'),
  destinatarioCnpj: z.string().min(1, 'CNPJ/CPF do destinatário é obrigatório.'),
  produto: z.string().min(1, 'Descrição do produto é obrigatória.'),
  valor: z.string().min(1, 'Valor da mercadoria é obrigatório.'),
  veiculoPlaca: z.string().min(1, 'Veículo/Placa é obrigatório.'),
  motorista: z.string().min(1, 'Nome do motorista é obrigatório.'),
  motoristaCpf: z.string().min(1, 'CPF do motorista é obrigatório.'),
  nfNumero: z.string().optional(),
});

export type DeclarationData = z.infer<typeof declarationSchema>;

function DeclarationPageContent() {
  const { user, companyProfile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [documentData, setDocumentData] = useState<DeclarationData | null>(null);

  const form = useForm<DeclarationData>({
    resolver: zodResolver(declarationSchema),
    defaultValues: {
      remetente: '', remetenteCnpj: '', destinatario: '', destinatarioCnpj: '',
      produto: '', valor: '', veiculoPlaca: '', motorista: '', motoristaCpf: '',
      nfNumero: ''
    },
  });

  const onSubmit = (data: DeclarationData) => {
    setDocumentData(data);
    setTimeout(() => window.print(), 500);
  };

  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
          @media print { 
              body * { visibility: hidden; } 
              .printable-document, .printable-document * { visibility: visible; } 
              .printable-document { position: absolute; left: 0; top: 0; width: 100%; height: 100%; padding: 2rem; } 
              .no-print { display: none; } 
          }
      `}</style>
      
      <main className="container mx-auto p-4 md:p-8 no-print">
          <div>
              <Button variant="outline" onClick={() => router.push('/documents')} className="mb-4">
                &larr; Voltar para Documentos
              </Button>
              <h1 className="text-3xl font-bold text-primary mb-2">Declaração de Transporte</h1>
              <p className="text-muted-foreground">Preencha os dados abaixo para gerar a declaração.</p>
          </div>
          
          <Card className="max-w-4xl mx-auto mt-8">
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardHeader>
                <CardTitle>Gerar Declaração</CardTitle>
                <CardDescription>Para mercadorias sem nota fiscal.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2"><Label>Remetente</Label><Input {...form.register('remetente')} />{form.formState.errors.remetente && <p className="text-sm font-medium text-destructive">{form.formState.errors.remetente.message}</p>}</div>
                  <div className="space-y-2"><Label>CNPJ/CPF (Remetente)</Label><Input {...form.register('remetenteCnpj')} />{form.formState.errors.remetenteCnpj && <p className="text-sm font-medium text-destructive">{form.formState.errors.remetenteCnpj.message}</p>}</div>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2"><Label>Destinatário</Label><Input {...form.register('destinatario')} />{form.formState.errors.destinatario && <p className="text-sm font-medium text-destructive">{form.formState.errors.destinatario.message}</p>}</div>
                  <div className="space-y-2"><Label>CNPJ/CPF (Destinatário)</Label><Input {...form.register('destinatarioCnpj')} />{form.formState.errors.destinatarioCnpj && <p className="text-sm font-medium text-destructive">{form.formState.errors.destinatarioCnpj.message}</p>}</div>
                </div>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="space-y-2 col-span-2"><Label>Produto(s)</Label><Input {...form.register('produto')} />{form.formState.errors.produto && <p className="text-sm font-medium text-destructive">{form.formState.errors.produto.message}</p>}</div>
                  <div className="space-y-2"><Label>Valor da Mercadoria</Label><Input {...form.register('valor')} />{form.formState.errors.valor && <p className="text-sm font-medium text-destructive">{form.formState.errors.valor.message}</p>}</div>
                </div>
                 <div className="grid md:grid-cols-3 gap-6">
                  <div className="space-y-2"><Label>Veículo/Placa</Label><Input {...form.register('veiculoPlaca')} />{form.formState.errors.veiculoPlaca && <p className="text-sm font-medium text-destructive">{form.formState.errors.veiculoPlaca.message}</p>}</div>
                  <div className="space-y-2"><Label>Motorista</Label><Input {...form.register('motorista')} />{form.formState.errors.motorista && <p className="text-sm font-medium text-destructive">{form.formState.errors.motorista.message}</p>}</div>
                  <div className="space-y-2"><Label>CPF (Motorista)</Label><Input {...form.register('motoristaCpf')} />{form.formState.errors.motoristaCpf && <p className="text-sm font-medium text-destructive">{form.formState.errors.motoristaCpf.message}</p>}</div>
                </div>
                <div className="space-y-2">
                  <Label>Nº da NF (Opcional)</Label>
                  <Input {...form.register('nfNumero')} />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit"><Printer className="mr-2 h-4 w-4"/> Gerar e Imprimir</Button>
              </CardFooter>
            </form>
          </Card>
      </main>

      {documentData && (
        <div className="printable-document">
          <DeclarationDocument data={documentData} companyProfile={companyProfile} />
        </div>
      )}
    </>
  );
}

export default function DeclarationPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <DeclarationPageContent />
    </Suspense>
  );
}
