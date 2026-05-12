
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, UserSearch, Building, Truck, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';

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
      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-bold text-primary">Central de Cadastros</h1>
        <p className="text-muted-foreground">Gerencie os registos mestres do sistema.</p>
      </div>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {registrationCards.filter(card => card.permission).map((card) => (
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
