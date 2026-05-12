"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Settings, Building2, Users } from 'lucide-react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ConfigMinhaEmpresaPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    // Apenas clientes e sub-clientes ADM com acesso podem entrar
    const isClienteGroup = user.role === 'cliente' || user.role === 'sub-cliente';
    const hasSubRolePermission = user.role === 'sub-cliente' ? user.subRole === 'ADM' : true;
    
    if (!isClienteGroup || !hasSubRolePermission || !user.myCompanyAccess) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isClienteGroup = user.role === 'cliente' || user.role === 'sub-cliente';
  const hasSubRolePermission = user.role === 'sub-cliente' ? user.subRole === 'ADM' : true;
  
  if (!isClienteGroup || !hasSubRolePermission || !user.myCompanyAccess) {
    return null;
  }

  // Futuras configurações podem ser adicionadas aqui
  const configCards = [
    {
      title: 'Minha Empresa',
      description: 'Adicione, edite ou remova os endereços das suas filiais e matriz.',
      icon: <Building2 className="w-8 h-8 text-primary" />,
      link: '/configuracoes/minha-empresa',
    },
    {
      title: 'Usuários da Conta',
      description: 'Convide e gerencie parceiros e colaboradores da sua empresa.',
      icon: <Users className="w-8 h-8 text-primary" />,
      link: '/configuracoes/cliente-users',
      disabled: false,
    },
    // Exemplo de futuros cards (podem estar desativados ou apontando para rotas em construção)
    {
      title: 'Integrações (Em breve)',
      description: 'Conecte seu ERP ou sistema próprio via API da Dez Log.',
      icon: <Settings className="w-8 h-8 text-muted-foreground" />,
      link: '#',
      disabled: true,
    }
  ];

  return (
    <main className="container mx-auto p-4 md:p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Configurações da Minha Empresa</h1>
        <p className="text-muted-foreground mt-2">
          Gerencie as preferências globais do seu perfil corporativo, filiais e integrações do sistema.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
        {configCards.map((card, index) => (
          card.disabled ? (
            <Card key={index} className="flex flex-col w-full opacity-60">
                <CardHeader className="flex-row items-center gap-4 space-y-0 pb-4">
                    {card.icon}
                    <CardTitle className="text-muted-foreground">{card.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                    <CardDescription>{card.description}</CardDescription>
                </CardContent>
            </Card>
          ) : (
            <Link key={index} href={card.link} className="flex">
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
          )
        ))}
      </div>
    </main>
  );
}
