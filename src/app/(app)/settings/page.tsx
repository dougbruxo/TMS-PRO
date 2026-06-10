
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Truck, Users, DollarSign, Map, BarChartBig, Megaphone, PiggyBank, DatabaseZap, Briefcase, Palette, BookUser, AlertTriangle, Tags, Building2, Printer, AlertOctagon, MessageSquare, Server, Package, ShieldCheck, Scale, Settings } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useToast } from '@/hooks/use-toast';
import { PremiumNavigationCard } from '@/components/PremiumNavigationCard';

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (authLoading) return;

    if (!user || user.role !== 'admin' || !user.settingsAccess) {
      toast({
        variant: "destructive",
        title: "Acesso Negado",
        description: "Você não tem permissão para aceder à página de configurações.",
      });
      router.push('/dashboard');
    }
  }, [user, authLoading, router, toast]);

  if (authLoading || !user || user.role !== 'admin' || !user.settingsAccess) {
    return (
        <div className="flex h-full items-center justify-center">
             <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  const settingsCards = [
     {
      title: 'Gerenciar Veículos',
      description: 'Adicione, edite ou remova tipos de veículos e suas especificações.',
      link: '/settings/vehicles',
      icon: <Truck className="h-8 w-8 text-primary" />,
    },
    {
      title: 'Opções da Frota',
      description: 'Gerencie marcas, modelos, cores e outras opções para a frota.',
      link: '/settings/fleet-options',
      icon: <Truck className="h-8 w-8 text-primary" />,
    },
    {
      title: 'Gerenciar Usuários',
      description: 'Adicione, edite ou remova usuários e gerencie seus níveis de acesso.',
      link: '/settings/users',
      icon: <Users className="h-8 w-8 text-primary" />,
    },
    {
      title: 'Dados da Empresa',
      description: 'Gerencie os dados da sua empresa que são usados nos documentos.',
      link: '/settings/companies',
      icon: <Building2 className="h-8 w-8 text-primary" />,
    },
     {
      title: 'Cadastros Gerais',
      description: 'Gerencie motoristas e outros registos mestres.',
      link: '/cadastros',
      icon: <BookUser className="h-8 w-8 text-primary" />,
    },

    {
      title: 'Estilo Visual',
      description: 'Personalize as cores e a aparência do sistema para todos os usuários.',
      link: '/settings/visual-style',
      icon: <Palette className="h-8 w-8 text-primary" />,
    },
    {
      title: 'Configurações do Chat',
      description: 'Crie e gerencie grupos de atendimento (hubs) para o chat interno.',
      link: '/settings/chat',
      icon: <MessageSquare className="h-8 w-8 text-primary" />,
    },
    {
      title: 'Emissão Fiscal',
      description: 'Configure alíquotas IBS/CBS, ambiente SEFAZ (Produção/Homologação) e numeração de documentos.',
      link: '/settings/fiscal',
      icon: <Server className="h-8 w-8 text-primary" />,
    },
    {
      title: 'Certificado Digital A1',
      description: 'Importe o certificado .pfx para assinatura digital de CT-e e MDF-e direto na SEFAZ.',
      link: '/settings/certificate',
      icon: <ShieldCheck className="h-8 w-8 text-primary" />,
    },
    {
      title: 'Precificação de Frete',
      description: 'Defina valores mínimos de frete (Fracionado e Dedicado) para rotas UF x UF.',
      link: '/settings/freight-pricing',
      icon: <DollarSign className="h-8 w-8 text-primary" />,
    },
    {
      title: 'Regras de Precificação',
      description: 'Ajuste taxas, impostos (ICMS, GRIS/AdValorem) e outros valores.',
      link: '/settings/pricing',
      icon: <DollarSign className="h-8 w-8 text-primary" />,
    },
    {
      title: 'Tabela ANTT 2026',
      description: 'Manutenção dos coeficientes CCD e CC para o cálculo de piso mínimo regulamentado.',
      link: '/settings/antt',
      icon: <Scale className="h-8 w-8 text-primary" />,
    },
    {
      title: 'Regiões e Taxas',
      description: 'Configure regiões, estados e os acréscimos regionais correspondentes.',
      link: '/settings/regions',
      icon: <Map className="h-8 w-8 text-primary" />,
    },
    {
      title: "Taxa de Dificuldade",
      description: "Configure os valores para a Taxa de Dificuldade de entrega/coleta.",
      link: "/settings/difficulty-tax",
      icon: <AlertTriangle className="h-8 w-8 text-primary" />,
    },
    {
      title: 'Ajustes de Impressão',
      description: "Configure a aparência de etiquetas, cotações e outros documentos.",
      link: '/settings/printing',
      icon: <Printer className="h-8 w-8 text-primary" />,
    },
     {
      title: 'Categorias de Despesas',
      description: 'Crie e edite as categorias para organizar as despesas.',
      link: '/settings/expense-categories',
      icon: <Tags className="h-8 w-8 text-primary" />,
    },
     {
      title: 'Tipos de Ocorrência',
      description: 'Cadastre e gerencie os tipos de ocorrências para o SAC.',
      link: '/settings/occurrences',
      icon: <AlertOctagon className="h-8 w-8 text-primary" />,
    },
    {
      title: 'Gatilhos e Alertas',
      description: 'Configure prazos e gatilhos para alertas de coleta e entrega.',
      link: '/settings/operational-alerts',
      icon: <AlertTriangle className="h-8 w-8 text-primary" />,
    },
     {
      title: 'Configurações Operacionais',
      description: 'Ajuste taxas e regras relacionadas à operação e cálculo de lucro.',
      link: '/settings/operational',
      icon: <PiggyBank className="h-8 w-8 text-primary" />,
    },
     {
      title: 'Gerenciar Avisos',
      description: 'Crie, edite e fixe avisos que aparecerão para os usuários no chat.',
      link: '/settings/announcements',
      icon: <Megaphone className="h-8 w-8 text-primary" />,
    },
    {
      title: 'Gráfico de Produção',
      description: 'Visualize o desempenho e os resultados das cotações em um gráfico.',
      link: '/settings/production-chart',
      icon: <BarChartBig className="h-8 w-8 text-primary" />,
    },
    {
      title: 'Códigos Fiscais (CFOP)',
      description: 'Gerencie os códigos de operação usados nos conhecimentos de transporte.',
      link: '/settings/cfop',
      icon: <Tags className="h-8 w-8 text-primary" />,
    },
    {
      title: 'Espécie da Carga',
      description: 'Gerencie as espécies de carga (ex: CAIXAS, PALETES) usadas nos CT-e.',
      link: '/settings/cargo-types',
      icon: <Package className="h-8 w-8 text-primary" />,
    },
    {
      title: 'Regras de Armazenagem',
      description: 'Configure preços de armazenagem (peso, palete, descarga).',
      link: '/settings/storage-pricing',
      icon: <Package className="h-8 w-8 text-primary" />,
    },
    {
      title: 'Backup e Redefinir',
      description: 'Exporte cotações ou limpe os dados do sistema para um novo começo.',
      link: '/settings/backup',
      icon: <DatabaseZap className="h-8 w-8 text-primary" />,
    }
  ];

  return (
      <main className="container mx-auto p-4 md:p-8">
        <PageHeader
          icon={<Settings className="h-4 w-4" />}
          badge="Administração do Sistema"
          titlePrefix="Configurações"
          titleHighlight="Globais"
          description="Gerencie as regras e dados principais do sistema."
        />
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {settingsCards.map((card) => (
                <PremiumNavigationCard
                    key={card.title}
                    title={card.title}
                    description={card.description}
                    href={card.link}
                    icon={card.icon}
                />
            ))}
        </div>
      </main>
  );
}
