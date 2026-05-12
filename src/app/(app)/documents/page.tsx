
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function DocumentsHubPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user || !user.documentsAccess) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  if (authLoading || !user || !user.documentsAccess) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const documentCards = [
    {
      title: "Ordem de Coleta",
      description: "Crie e imprima uma Ordem de Coleta (O.C.) para designar um motorista para buscar uma mercadoria.",
      link: "/documents/collection-order",
      icon: <FileText className="h-8 w-8 text-primary" />,
      enabled: true,
    },
    {
      title: "Gerir Declaração",
      description: "Gere uma declaração de transporte para mercadorias sem nota fiscal.",
      link: "/documents/declaration",
      icon: <FileText className="h-8 w-8 text-primary" />,
      enabled: true,
    },
    {
      title: "Gerir CT-e",
      description: "Gere e gerencie o Conhecimento de Transporte Eletrônico.",
      link: "/documents/cte",
      icon: <FileText className="h-8 w-8 text-primary" />,
      enabled: true,
    },
     {
      title: "Gerir MDF-e",
      description: "Gere e gerencie o Manifesto Eletrônico de Documentos Fiscais.",
      link: "/documents/mdfe",
      icon: <FileText className="h-8 w-8 text-primary" />,
      enabled: true,
    },
    {
      title: "Histórico de Emissões",
      description: "Visualize e baixe os PDFs e XMLs das Notas e Manifestos já autorizados.",
      link: "/documents/history",
      icon: <FileText className="h-8 w-8 text-primary" />,
      enabled: true,
    },
    {
      title: "Consulta SEFAZ",
      description: "Consulte o status oficial de CT-e ou MDF-e diretamente na SEFAZ.",
      link: "/documents/consulta-danfe",
      icon: <FileText className="h-8 w-8 text-primary" />,
      enabled: true,
    },
     {
      title: "Gerir CIOT",
      description: "Gere o Código Identificador da Operação de Transporte integrado com o órgão regulamentador.",
      link: "/documents/ciot",
      icon: <FileText className="h-8 w-8 text-primary" />,
      enabled: true,
    },
  ];

  return (
    <main className="container mx-auto p-4 md:p-8">
      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-bold text-primary">Gerador de Documentos</h1>
        <p className="text-muted-foreground">Selecione o tipo de documento que deseja gerar.</p>
      </div>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {documentCards.map((card) => {
          const content = (
            <Card className={cn("relative flex flex-col w-full h-full transition-all duration-300", card.enabled ? "hover:shadow-glow hover:-translate-y-1 hover:ring-2 hover:ring-primary" : "bg-muted/50 cursor-not-allowed")}>
                <CardHeader className="flex-row items-center gap-4 space-y-0 pb-4">
                  {card.icon}
                  <CardTitle className={cn(!card.enabled && "text-muted-foreground", "text-lg")}>{card.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                  <CardDescription>{card.description}</CardDescription>
                </CardContent>
                {!card.enabled && (
                  <CardFooter>
                    <Button className="w-full" disabled>Em Breve</Button>
                  </CardFooter>
                )}
            </Card>
          );

          if (card.enabled) {
            return (
              <Link key={card.title} href={card.link} className="flex">
                {content}
              </Link>
            );
          }

          return (
            <div key={card.title} className="flex">
              {content}
            </div>
          );
        })}
      </div>
    </main>
  );
}
