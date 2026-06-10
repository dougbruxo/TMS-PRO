
"use client";

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Printer, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
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
      
      <main className="container mx-auto p-4 md:p-8 no-print relative overflow-hidden">
          {/* Efeitos de desfoque e brilho aurora neon atrás dos cards */}
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/15 rounded-full blur-[100px] pointer-events-none -z-10 animate-float-blur-1" />
          <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-purple-500/15 rounded-full blur-[120px] pointer-events-none -z-10 animate-float-blur-2" />

          <PageHeader
              icon={<FileText className="h-4 w-4" />}
              badge="Declaração"
              titlePrefix="Gerar"
              titleHighlight="Declaração de Transporte"
              description="Preencha os dados abaixo para gerar a declaração de transporte de mercadorias sem nota fiscal."
              backHref="/documents"
              backLabel="Voltar para Documentos"
          />
          
          <Card className="max-w-4xl mx-auto mt-8 border border-border/40 bg-card/45 backdrop-blur-2xl shadow-xl rounded-2xl relative overflow-hidden transition-all duration-300 hover:shadow-2xl">
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
