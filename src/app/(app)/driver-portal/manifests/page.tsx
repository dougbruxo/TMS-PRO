
"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, BookOpen, Truck, CheckCheck, Download, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Manifest } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { authFetch } from '@/lib/api-client';

export default function DriverManifestsHubPage() {
  const { user } = useAuth();
  const [manifests, setManifests] = useState<Manifest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();

  const fetchData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const response = await authFetch(`/api/driver-portal/data?driverId=${user.id}`);
      if (!response.ok) {
        throw new Error('Falha ao carregar os dados do portal.');
      }
      const data = await response.json();
      setManifests(data.manifests || []);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro de Carregamento',
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [fetchData, user]);

  const { loadingCount, finalizedCount } = useMemo(() => {
    return {
      loadingCount: manifests.filter(m => m.status === 'Pendente').length,
      finalizedCount: manifests.filter(m => m.status === 'Finalizado').length,
    };
  }, [manifests]);

  const cards = [
    { title: 'Carregando', icon: <Download className="h-8 w-8 text-primary" />, count: loadingCount, href: '/driver-portal/manifests/loading', description: 'Romaneios aguardando o carregamento dos volumes.' },
    { title: 'Finalizados', icon: <CheckCheck className="h-8 w-8 text-primary" />, count: finalizedCount, href: '/driver-portal/manifests/finalized', description: 'Romaneios cujas entregas foram concluídas.' },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
       <Button variant="outline" onClick={() => router.push('/driver-portal')} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para o Portal
       </Button>

      <div className="text-left">
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <BookOpen className="h-6 w-6"/>
            Histórico de Romaneios
          </h1>
          <p className="text-muted-foreground mt-1">
            Consulte o histórico de romaneios em carregamento ou já finalizados.
          </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
            {cards.map(card => (
              <Link key={card.title} href={card.href}>
                  <Card className="flex flex-col w-full h-full transition-all duration-300 hover:shadow-glow hover:-translate-y-1 hover:ring-2 hover:ring-primary">
                      <CardHeader className="flex-row items-center gap-4 space-y-0 pb-4">
                          {card.icon}
                          <div>
                              <CardTitle>{card.title}</CardTitle>
                              <Badge className="mt-1">{card.count} romaneios</Badge>
                          </div>
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
