
"use client";

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BackButton } from '@/components/BackButton';
import { Truck, Package } from 'lucide-react';
import Link from 'next/link';

export default function FreightPricingPage() {
  const router = useRouter();

  const pricingOptions = [
    {
      title: 'Precificação Fracionado',
      description: 'Defina o valor do frete mínimo por rota para o modo Fracionado.',
      link: '/settings/freight-pricing/fractional',
      icon: <Package className="h-8 w-8 text-primary" />,
    },
    {
      title: 'Precificação Dedicado',
      description: 'Defina o valor do frete mínimo por rota para o modo Dedicado.',
      link: '#', // dedicated will be implemented later
      icon: <Truck className="h-8 w-8 text-primary" />,
      disabled: true,
    }
  ];

  return (
    <main className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-start flex-wrap gap-4 mb-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-primary">Precificação de Frete</h1>
          <p className="text-muted-foreground">
            Gerencie os valores mínimos de frete para as diferentes modalidades de transporte.
          </p>
        </div>
        <BackButton href="/settings" label="Voltar para Configurações" className="mb-0 mt-2" />
      </div>

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl">
        {pricingOptions.map((option) => (
          <Link 
            key={option.title} 
            href={option.disabled ? '#' : option.link} 
            className={`flex ${option.disabled ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            <Card className="flex flex-col w-full transition-all duration-300 hover:shadow-glow hover:-translate-y-1 hover:ring-2 hover:ring-primary h-full">
              <CardHeader className="flex-row items-center gap-4 space-y-0 pb-4">
                {option.icon}
                <CardTitle>{option.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-grow">
                <CardDescription>{option.description}</CardDescription>
                {option.disabled && (
                    <p className="mt-4 text-xs font-semibold text-warning">(Em breve)</p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
