"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Loader2, Settings, Users, Calculator, HandCoins, MessageSquare, ClipboardCheck, Receipt, Warehouse, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { PremiumNavigationCard } from '@/components/PremiumNavigationCard';
import { PageHeader } from '@/components/PageHeader';

const CardSkeleton = () => (
    <Card className="flex flex-col w-full h-full border border-border/40 bg-card/45 backdrop-blur-2xl shadow-xl rounded-2xl p-5">
        <CardHeader className="flex-row items-center gap-4 space-y-0 pb-4 p-0">
            <Skeleton className="h-10 w-10 rounded-2xl" />
            <div className="flex-grow space-y-2">
                <Skeleton className="h-5 w-3/4" />
            </div>
        </CardHeader>
        <CardContent className="p-0 mt-2 flex-grow">
            <Skeleton className="h-4 w-full" />
        </CardContent>
    </Card>
);

export default function ClienteDashboardPage() {
  const { user, loading: isAuthLoading } = useAuth();
  const [isDataLoading, setIsDataLoading] = useState(true);

  useEffect(() => {
    if (!isAuthLoading && user) {
        setIsDataLoading(false);
    }
  }, [isAuthLoading, user]);

  if (isAuthLoading || !user) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  // Lista dinâmica de menus exclusiva para clientes. Checa a permissão em 'user'.
  const clientCardsConfig = [
    {
      title: "Cotações",
      description: "Calcule novas cotações e agende seus fretes.",
      link: "/cliente/cotacoes",
      icon: <Calculator className="h-8 w-8 text-primary" />,
      hasAccess: user.freightAccess,
    },
    {
      title: "Meus Fretes",
      description: "Acompanhe e transfira as cotações da sua equipe.",
      link: "/cliente/meus-fretes",
      icon: <HandCoins className="h-8 w-8 text-primary" />,
      hasAccess: user.myFreightsAccess,
    },
    {
      title: "Meu Estoque",
      description: "Gerencie seu inventário e solicite expedições e fulfillment.",
      link: "/cliente/armazenagem",
      icon: <Warehouse className="h-8 w-8 text-primary" />,
      hasAccess: user.armazenagemAccess,
    },

    {
      title: "Faturas",
      description: "Visualize o status de pagamento das suas cotações.",
      link: "/cliente/faturas",
      icon: <Receipt className="h-8 w-8 text-primary" />,
      hasAccess: user.freightAccess, // Tem acesso se pode ver cotações
    },
    {
      title: "Clientes e Fornecedores",
      description: "Cadastre seus Principais Parceiros de Negócio.",
      link: "/clientes-fornecedores",
      icon: <Users className="h-8 w-8 text-primary" />,
      hasAccess: user.clientPartnersAccess,
    },
    {
      title: "Quadro de Avisos",
      description: "Comunique-se de forma geral com sua equipe.",
      link: "/cliente/avisos",
      icon: <ClipboardCheck className="h-8 w-8 text-primary" />,
      hasAccess: user.noticeBoardAccess,
    },
    {
      title: "Chat Interno",
      description: "Fale com seus colaboradores ou com o Suporte.",
      link: "/chat",
      icon: <MessageSquare className="h-8 w-8 text-primary" />,
      hasAccess: user.chatEnabled,
    },
    {
      title: "Configurações Globais",
      description: "Volte para o portal de configurações de equipe.",
      link: "/configuracoes",
      icon: <Settings className="h-8 w-8 text-primary" />,
      hasAccess: user.role === 'cliente' || (user.role === 'sub-cliente' && user.subRole === 'ADM'),
    },
  ];

  const accessibleCards = clientCardsConfig.filter(c => !!c.hasAccess);

  return (
    <main className="container mx-auto p-4 md:p-8 relative overflow-hidden">
        {/* Efeitos de desfoque e brilho aurora neon atrás dos cards */}
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/15 rounded-full blur-[100px] pointer-events-none -z-10 animate-float-blur-1" />
        <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-purple-500/15 rounded-full blur-[120px] pointer-events-none -z-10 animate-float-blur-2" />

        <PageHeader
            icon={<LayoutDashboard className="h-4 w-4" />}
            badge="Painel do Cliente B2B"
            titlePrefix="Painel do"
            titleHighlight="Cliente"
            description={`Bem-vindo(a) de volta, ${user.username}! Como podemos ajudar sua operação hoje?`}
        />
        
        {isDataLoading ? (
            <div className="space-y-6">
                <Skeleton className="h-20 w-full" />
                <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {Array.from({ length: 4 }).map((_, index) => <CardSkeleton key={index} />)}
                </div>
            </div>
        ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {accessibleCards.map((card) => (
                  <PremiumNavigationCard
                    key={card.title}
                    title={card.title}
                    description={card.description}
                    href={card.link}
                    icon={card.icon}
                  />
                ))}
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
