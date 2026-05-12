
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowRight, FileText, Tags, ReceiptText } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PrintingSettingsHubPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user || !user.settingsAccess) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  if (authLoading || !user || !user.settingsAccess) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const printCards = [
    {
      title: "Etiquetas de Volume",
      description: "Ajuste o tamanho da fonte, intensidade da cor e o link do QR Code para as etiquetas.",
      link: "/settings/printing/labels",
      icon: <Tags className="h-8 w-8 text-primary" />,
      enabled: true,
    },
    {
      title: "Proposta de Cotação",
      description: "Personalize a aparência do documento da cotação de frete. (Em Breve)",
      link: "#",
      icon: <FileText className="h-8 w-8 text-muted-foreground" />,
      enabled: false,
    },
    {
      title: "Ordem de Coleta",
      description: "Ajuste os campos e o layout da Ordem de Coleta. (Em Breve)",
      link: "#",
      icon: <FileText className="h-8 w-8 text-muted-foreground" />,
      enabled: false,
    },
    {
      title: "Holerite (Recibo de Pagamento)",
      description: "Configure o modelo de impressão dos holerites. (Em Breve)",
      link: "#",
      icon: <ReceiptText className="h-8 w-8 text-muted-foreground" />,
      enabled: false,
    },
  ];

  return (
    <main className="container mx-auto p-4 md:p-8">
       <Button variant="outline" onClick={() => router.push('/settings')} className="mb-8">
          &larr; Voltar para Configurações
        </Button>
      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-bold text-primary">Ajustes de Impressão</h1>
        <p className="text-muted-foreground">Personalize os documentos gerados pelo sistema.</p>
      </div>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {printCards.map((card) => (
          <Card key={card.title} className={cn("flex flex-col w-full transition-all duration-300", card.enabled && "hover:shadow-glow hover:-translate-y-1 hover:ring-2 hover:ring-primary", !card.enabled && "bg-muted/50 cursor-not-allowed")}>
                <CardHeader className="flex-row items-center gap-4 space-y-0 pb-4">
                  {card.icon}
                  <CardTitle className={cn(!card.enabled && "text-muted-foreground")}>{card.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                  <CardDescription>{card.description}</CardDescription>
                </CardContent>
                 <CardFooter>
                    <Button className="w-full" disabled={!card.enabled} onClick={() => card.enabled && router.push(card.link)}>
                        {card.enabled ? "Configurar" : "Em Breve"}
                        {card.enabled && <ArrowRight className="ml-2 h-4 w-4" />}
                    </Button>
                </CardFooter>
          </Card>
        ))}
      </div>
    </main>
  );
}
