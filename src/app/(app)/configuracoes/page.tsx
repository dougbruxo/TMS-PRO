"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Settings, Building2, Users } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import Link from 'next/link';
import { PremiumNavigationCard } from '@/components/PremiumNavigationCard';


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
      <PageHeader
        icon={<Settings className="h-4 w-4" />}
        badge="Perfil Corporativo"
        titlePrefix="Configurações da"
        titleHighlight="Minha Empresa"
        description="Gerencie as preferências globais do seu perfil corporativo, filiais e integrações do sistema."
      />

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
        {configCards.map((card, index) => (
          <PremiumNavigationCard
            key={index}
            title={card.title}
            description={card.description}
            href={card.link}
            icon={card.icon}
            disabled={card.disabled}
          />
        ))}
      </div>
    </main>
  );
}
