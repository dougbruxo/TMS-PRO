"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Settings, Users, Calculator, HandCoins, MessageSquare, ClipboardCheck, Receipt, Warehouse } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';

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
      title: "Cotação de Armazenagem",
      description: "Simule custos de armazenagem e movimentação de estoque.",
      link: "/cliente/armazenagem/cotacao",
      icon: <Calculator className="h-8 w-8 text-primary" />,
      hasAccess: user.quoteArmazenagemAccess,
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
    <div className="container mx-auto p-4 md:p-8">
        <div className="space-y-2 mb-8 border-b pb-6 border-zinc-200 dark:border-zinc-800">
            <h1 className="text-3xl font-bold text-primary">Painel do Cliente</h1>
            <p className="text-muted-foreground">Bem-vindo(a) de volta, {user.username}! Como podemos ajudar sua operação hoje?</p>
        </div>
        
        {isDataLoading ? (
            <div className="space-y-6">
                <Skeleton className="h-20 w-full" />
                <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <Card key={index}>
                          <CardHeader className="flex-row items-center gap-4 space-y-0 pb-4">
                              <Skeleton className="h-8 w-8 rounded-lg" />
                              <Skeleton className="h-5 w-3/4" />
                          </CardHeader>
                          <CardContent><Skeleton className="h-4 w-full" /></CardContent>
                      </Card>
                    ))}
                </div>
            </div>
        ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {accessibleCards.map((card) => (
                  <Link key={card.title} href={card.link} className="flex">
                    <Card className="relative flex flex-col w-full transition-all duration-300 hover:shadow-glow hover:-translate-y-1 hover:ring-2 hover:ring-primary">
                        <CardHeader className="flex-row items-center gap-4 space-y-0 pb-4">
                          {card.icon}
                          <CardTitle className="text-lg">{card.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-grow">
                          <CardDescription>{card.description}</CardDescription>
                        </CardContent>
                    </Card>
                  </Link>
                ))}
            </div>
        )}
    </div>
  );
}
