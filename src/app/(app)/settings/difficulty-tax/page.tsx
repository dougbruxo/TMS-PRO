"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Truck, Package } from 'lucide-react';

export default function DifficultyTaxHubPage() {
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

  const cards = [
    { title: 'TD Dedicado', description: 'Configure a Taxa de Dificuldade por tipo de veículo para fretes dedicados.', link: '/settings/difficulty-tax/dedicado', icon: <Truck className="h-8 w-8 text-primary" /> },
    { title: 'TD Fracionado', description: 'Configure a Taxa de Dificuldade por região para fretes fracionados.', link: '/settings/difficulty-tax/fracionado', icon: <Package className="h-8 w-8 text-primary" /> },
  ];

  return (
    <main className="container mx-auto p-4 md:p-8">
      <Button variant="outline" onClick={() => router.push('/settings')} className="mb-8">
        &larr; Voltar para Configurações
      </Button>
      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-bold text-primary">Taxa de Dificuldade (TD)</h1>
        <p className="text-muted-foreground">Selecione uma categoria para configurar os valores da taxa.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {cards.map((card) => (
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
