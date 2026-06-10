
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, FileText, FileStack } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { cn } from '@/lib/utils';
import { PremiumNavigationCard } from '@/components/PremiumNavigationCard';


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
      description: "Consulte o status oficial de NF-e, CT-e ou MDF-e diretamente na SEFAZ.",
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
      <PageHeader
        icon={<FileStack className="h-4 w-4" />}
        badge="Central de Documentos"
        titlePrefix="Gerador de"
        titleHighlight="Documentos"
        description="Selecione o tipo de documento que deseja gerar."
      />
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {documentCards.map((card) => (
          <PremiumNavigationCard
            key={card.title}
            title={card.title}
            description={card.description}
            href={card.link}
            icon={card.icon}
            disabled={!card.enabled}
          />
        ))}
      </div>
    </main>
  );
}
