
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowRight, Briefcase, Building2, HandCoins, CalendarClock, ReceiptText } from 'lucide-react';

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
         <Button variant="outline" onClick={() => router.push('/dashboard')} className="mb-8">
          &larr; Voltar para o Início
        </Button>
        <h1 className="text-3xl font-bold text-primary mb-2">Recursos Humanos</h1>
        <p className="text-muted-foreground mb-8">Gerencie talentos, contratos, pagamentos e outras configurações de RH.</p>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {hrSettingsCards.map((card) => (
                <Link key={card.title} href={card.link} className="flex">
                    <Card className="flex flex-col w-full transition-all duration-300 hover:shadow-glow hover:-translate-y-1 hover:ring-2 hover:ring-primary">
                        <CardHeader className="flex-row items-center gap-4 space-y-0 pb-4">
                            {card.icon}
                            <CardTitle>{card.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-grow">
                            <CardDescription>{card.description}</CardDescription>
                        </CardContent>
                    </Card>
                </Link>
            ))}
        </div>
      </main>
  );
}
