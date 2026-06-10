
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, UserSearch, Building, Truck, Briefcase, BookUser } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { cn } from '@/lib/utils';
import { PremiumNavigationCard } from '@/components/PremiumNavigationCard';


export default function RegistrationsHubPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user || !user.registrationsAccess) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  if (authLoading || !user || !user.registrationsAccess) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const registrationCards = [
    {
      title: "Gerenciar Motoristas",
      description: "Adicione, edite ou remova motoristas e gerencie seus acessos.",
      link: "/drivers",
      icon: <UserSearch className="h-8 w-8 text-primary" />,
      permission: user.driverManagementAccess,
    },
    {
      title: "Gerenciar Frota",
      description: "Cadastre e gerencie os veículos da sua frota e agregados.",
      link: "/fleet",
      icon: <Truck className="h-8 w-8 text-primary" />,
      permission: user.driverManagementAccess,
    },
    {
      title: "Gerenciar Clientes",
      description: "Gerencie as empresas parceiras, clientes e suas configurações.",
      link: "/customers",
      icon: <Building className="h-8 w-8 text-primary" />,
      permission: user.settingsAccess, 
    },
    {
      title: "Gerenciar Proprietários",
      description: "Cadastre proprietários de veículos para vincular à frota.",
      link: "/owners",
      icon: <Briefcase className="h-8 w-8 text-primary" />,
      permission: user.driverManagementAccess,
    },

  ];

  return (
    <main className="container mx-auto p-4 md:p-8">
      <PageHeader
        icon={<BookUser className="h-4 w-4" />}
        badge="Registros Mestres"
        titlePrefix="Central de"
        titleHighlight="Cadastros"
        description="Gerencie os registos mestres do sistema."
      />
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {registrationCards.filter(card => card.permission).map((card) => (
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
