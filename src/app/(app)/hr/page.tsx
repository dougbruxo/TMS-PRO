
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Briefcase, Building2, HandCoins, CalendarClock, ReceiptText, Users } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { PremiumNavigationCard } from '@/components/PremiumNavigationCard';

export default function HRSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/');
    } else if (!user.talentsAccess) { // Corrigido para verificar a permissão correta
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  if (authLoading || !user || !user.talentsAccess) {
    return (
        <div className="flex h-full items-center justify-center">
             <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  const isAdmin = user.role === 'admin';
  const subPerms = user.subPermissions?.hr || {};
  
  const canViewTalents = isAdmin || subPerms.canViewTalents || subPerms.canEditTalents || subPerms.canDeleteTalents || subPerms.canManagePayroll;
  const canManagePayroll = isAdmin || subPerms.canManagePayroll;
  const canEditTalents = isAdmin || subPerms.canEditTalents;
  
  const hrSettingsCards = [
    ...(canViewTalents ? [{
      title: 'Gerenciar Talentos',
      description: 'Adicione, edite e gerencie os funcionários e as suas informações.',
      link: '/talents',
      icon: <Briefcase className="h-8 w-8 text-primary" />,
    }] : []),
    ...(canEditTalents || canManagePayroll ? [{
      title: 'Tipos de Contratação',
      description: 'Configure os tipos de contrato para os funcionários (ex: CLT, PJ).',
      link: '/settings/hiring-types',
      icon: <Building2 className="h-8 w-8 text-primary" />,
    },
    {
      title: 'Proventos e Descontos',
      description: 'Defina os códigos de itens para a folha de pagamento.',
      link: '/settings/earnings-deductions',
      icon: <HandCoins className="h-8 w-8 text-primary" />,
    }] : []),
     ...(canManagePayroll ? [{
      title: 'Folha de Pagamento',
      description: 'Ajuste as datas padrão para adiantamento e pagamento de salários.',
      link: '/settings/payroll',
      icon: <CalendarClock className="h-8 w-8 text-primary" />,
    },
     {
      title: 'Gerar Holerites',
      description: 'Crie e imprima os recibos de pagamento mensais para os talentos.',
      link: '/talents/payslip',
      icon: <ReceiptText className="h-8 w-8 text-primary" />,
    }] : []),
  ];

  return (
      <main className="container mx-auto p-4 md:p-8">
        <PageHeader
          icon={<Users className="h-4 w-4" />}
          badge="Gestão de Pessoas"
          titlePrefix="Recursos"
          titleHighlight="Humanos"
          description="Gerencie talentos, contratos, pagamentos e outras configurações de RH."
          backHref="/dashboard"
          backLabel="Voltar ao Painel"
        />
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {hrSettingsCards.map((card) => (
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
