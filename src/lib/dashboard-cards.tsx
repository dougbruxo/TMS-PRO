
import {
  Calculator,
  Headset,
  PackageCheck,
  Archive,
  FileText,
  Briefcase,
  Wallet,
  ClipboardCheck,
  BarChart3,
  Settings,
  BookUser,
  Map,
  MessageSquare,
  HandCoins,
  Warehouse,
  Boxes,
  Route,
  Store,
  Users,
  Building,
  Factory,
} from 'lucide-react';
import type { User } from '@/lib/types';

export type DashboardCardConfig = {
  title: string;
  description: string;
  link: string;
  icon: React.ReactElement;
  permissionKey: keyof User | 'admin';
  isClientOnly?: boolean;
};

export const dashboardCardsConfig: DashboardCardConfig[] = [

  {
    title: "Clientes e Fornecedores",
    description: "Cadastre seus Principais Parceiros de Negócio.",
    link: "/clientes-fornecedores",
    icon: <Users className="h-8 w-8 text-primary" />,
    permissionKey: 'clientPartnersAccess',
    isClientOnly: true,
  },
  {
    title: "Portais de Clientes B2B",
    description: "Desbloqueie acessos Mestre para que clientes usem o painel White-Label.",
    link: "/portais-clientes",
    icon: <Factory className="h-8 w-8 text-primary" />,
    permissionKey: 'clientPortalsAccess',
  },
  {
    title: "Cotação",
    description: "Calcule e gerencie suas cotações de frete.",
    link: "/quotes",
    icon: <Calculator className="h-8 w-8 text-primary" />,
    permissionKey: 'freightAccess',
  },
  {
    title: "Cotações em Análise",
    description: "Analise e aprove cotações B2B pendentes.",
    link: "/quotes/analise",
    icon: <ClipboardCheck className="h-8 w-8 text-primary" />,
    permissionKey: 'analyzeQuotesAccess',
  },
  {
    title: "Meus Fretes",
    description: "Visualize suas cotações, bônus e desempenho.",
    link: "/my-freights",
    icon: <HandCoins className="h-8 w-8 text-primary" />,
    permissionKey: 'myFreightsAccess',
  },
  {
    title: "Meu Estoque",
    description: "Gerencie seu inventário e solicite expedições e fulfillment.",
    link: "/cliente/armazenagem",
    icon: <Warehouse className="h-8 w-8 text-primary" />,
    permissionKey: 'armazenagemAccess',
    isClientOnly: true,
  },
  {
    title: "Cotação de Armazenagem",
    description: "Simule custos de armazenagem e movimentação de estoque.",
    link: "/cliente/armazenagem/cotacao",
    icon: <Calculator className="h-8 w-8 text-primary" />,
    permissionKey: 'quoteArmazenagemAccess',
    isClientOnly: true,
  },
   {
    title: "Chat Interno",
    description: "Comunique-se com outros usuários do sistema.",
    link: "/chat",
    icon: <MessageSquare className="h-8 w-8 text-primary" />,
    permissionKey: 'chatEnabled',
  },
  {
    title: "Panorama",
    description: "Visualize coletas e entregas no mapa do Brasil.",
    link: "/panorama",
    icon: <Map className="h-8 w-8 text-primary" />,
    permissionKey: 'panoramaAccess',
  },
   {
    title: "Planejador de Rotas",
    description: "Calcule a melhor rota para múltiplas paragens.",
    link: "/operational/route-planner",
    icon: <Route className="h-8 w-8 text-primary" />,
    permissionKey: 'operationalAccess',
  },
  {
    title: "SAC",
    description: "Acompanhe as entregas e gerencie ocorrências.",
    link: "/sac",
    icon: <Headset className="h-8 w-8 text-primary" />,
    permissionKey: 'sacAccess',
  },
  {
    title: "Operacional",
    description: "Gerencie o fluxo de coleta, rota e entrega.",
    link: "/operational",
    icon: <PackageCheck className="h-8 w-8 text-primary" />,
    permissionKey: 'operationalAccess',
  },
  {
    title: "Recebimento",
    description: "Gerencie o recebimento e saída de cargas.",
    link: "/receiving",
    icon: <Archive className="h-8 w-8 text-primary" />,
    permissionKey: 'receivingAccess',
  },
  {
    title: "Estoque",
    description: "Controle posições de paletes e itens armazenados.",
    link: "/stock",
    icon: <Boxes className="h-8 w-8 text-primary" />,
    permissionKey: 'stockAccess',
  },
  {
    title: "Expedição",
    description: "Gerencie e aprove a separação e envio de pedidos de armazenamento.",
    link: "/stock/expeditions",
    icon: <PackageCheck className="h-8 w-8 text-primary" />,
    permissionKey: 'stockAccess',
  },
  {
    title: "Documentos",
    description: "Crie Ordens de Coleta, Declarações e outros.",
    link: "/documents",
    icon: <FileText className="h-8 w-8 text-primary" />,
    permissionKey: 'documentsAccess',
  },
   {
    title: "Cadastros",
    description: "Gerencie motoristas, empresas e outros registos.",
    link: "/cadastros",
    icon: <BookUser className="h-8 w-8 text-primary" />,
    permissionKey: 'registrationsAccess',
  },
  {
    title: "R H",
    description: "Gerencie talentos, pagamentos e holerites.",
    link: "/hr",
    icon: <Briefcase className="h-8 w-8 text-primary" />,
    permissionKey: 'talentsAccess',
  },
  {
    title: "Financeiro",
    description: "Controle despesas, cobranças e faturamento.",
    link: "/financial",
    icon: <Wallet className="h-8 w-8 text-primary" />,
    permissionKey: 'expensesAccess',
  },
  {
    title: "Avisos",
    description: "Visualize e gerencie os avisos da equipe.",
    link: "/notice-board",
    icon: <ClipboardCheck className="h-8 w-8 text-primary" />,
    permissionKey: 'noticeBoardAccess',
  },
  {
    title: "Relatórios",
    description: "Analise o desempenho da sua equipe e operação.",
    link: "/reports",
    icon: <BarChart3 className="h-8 w-8 text-primary" />,
    permissionKey: 'admin',
  },
  {
    title: "Configurações",
    description: "Gerencie as regras e dados principais do sistema.",
    link: "/settings",
    icon: <Settings className="h-8 w-8 text-primary" />,
    permissionKey: 'settingsAccess',
  },
  {
    title: "Configurações Globais",
    description: "Configurações gerais e gerenciamento avançado da sua conta.",
    link: "/configuracoes",
    icon: <Settings className="h-8 w-8 text-primary" />,
    permissionKey: 'myCompanyAccess',
    isClientOnly: true,
  },
];

    