"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Car, ToyBrick, Palette, Truck, Shield } from 'lucide-react';

export default function FleetOptionsHubPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user?.settingsAccess) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  if (authLoading || !user) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const optionCards = [
    { title: 'Marcas', description: 'Gerencie as marcas de veículos.', link: '/settings/fleet-options/brands', icon: <Car className="h-8 w-8 text-primary" /> },
    { title: 'Modelos', description: 'Gerencie os modelos de veículos.', link: '/settings/fleet-options/models', icon: <ToyBrick className="h-8 w-8 text-primary" /> },
    { title: 'Cores', description: 'Gerencie as cores disponíveis.', link: '/settings/fleet-options/colors', icon: <Palette className="h-8 w-8 text-primary" /> },
    { title: 'Tipo de Veículo', description: 'Gerencie os tipos de veículo (Caminhão, Utilitário, etc.).', link: '/settings/fleet-options/vehicleTypes', icon: <Truck className="h-8 w-8 text-primary" /> },
    { title: 'Tipos de Carroceria', description: 'Gerencie os tipos de carroceria.', link: '/settings/fleet-options/bodyTypes', icon: <Truck className="h-8 w-8 text-primary" /> },
    { title: 'Categorias ANTT', description: 'Gerencie as categorias ANTT.', link: '/settings/fleet-options/anttCategories', icon: <Shield className="h-8 w-8 text-primary" /> },
  ];

  return (
    <main className="container mx-auto p-4 md:p-8">
      <Button variant="outline" onClick={() => router.push('/settings')} className="mb-8">
        &larr; Voltar para Configurações
      </Button>
      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-bold text-primary">Opções da Frota</h1>
        <p className="text-muted-foreground">Selecione uma categoria para gerenciar suas opções.</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {optionCards.map((card) => (
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
