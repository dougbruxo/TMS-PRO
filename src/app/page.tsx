
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginForm } from '@/components/LoginForm';
import Logo from '@/components/Logo';
import { Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { QuoteLookupForm } from '@/components/QuoteLookupForm';
import type { LoginResult, User, CompanyProfile } from '@/lib/types';
import useLocalStorage from '@/hooks/use-local-storage';
import { useAuth } from '@/hooks/use-auth';

const getInitials = (name: string = '') => {
  if (!name) return '';
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
};

const backgroundVideos = [
    '/background.mp4',
    '/background2.mp4',
];

const FuturisticBackground = () => {
    const [videoSrc, setVideoSrc] = useState('');

    useEffect(() => {
        if (typeof window !== "undefined") {
            const randomVideo = backgroundVideos[Math.floor(Math.random() * backgroundVideos.length)];
            setVideoSrc(randomVideo);
        }
    }, []);

    if (!videoSrc) {
        return <div className="absolute inset-0 z-0 bg-black"></div>;
    }

    return (
        <div className="absolute inset-0 z-0 overflow-hidden">
            <video 
                key={videoSrc}
                autoPlay 
                loop 
                muted 
                playsInline
                className="w-full h-full object-cover"
            >
              <source src={videoSrc} type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent"></div>
        </div>
    );
};

export default function LoginPage() {
  const [lastLoggedInUser, setLastLoggedInUser] = useLocalStorage<Partial<User> & { identifier?: string } | null>('lastLoggedInUser', null);
  const { user, companyProfile, loading, login } = useAuth();
  
  const handleLogin = async (identifier: string, password: string): Promise<LoginResult> => {
    return await login(identifier, password);
  };

  const handleLookup = async (code: string) => {
      try {
          const response = await fetch(`/api/quotes/lookup/${code}`);
          if (!response.ok) return null;
          return await response.json();
      } catch (error) {
          console.error("Lookup error:", error);
          return null;
      }
  };

  if (loading) {
    return (
        <div className="flex h-screen items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }
  
  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden p-4">
      <FuturisticBackground />

      <div className="relative z-10 w-full max-w-md">
        {lastLoggedInUser?.username ? (
            <div className="flex flex-col items-center mb-4">
              <Avatar className={cn("h-20 w-20 border-2 border-primary/50")}>
                <AvatarImage src={lastLoggedInUser.avatarUrl} alt={lastLoggedInUser.username} />
                <AvatarFallback>{getInitials(lastLoggedInUser.username)}</AvatarFallback>
              </Avatar>
              <p className="text-muted-foreground mt-2">Bem-vindo(a) de volta, {lastLoggedInUser.username}!</p>
            </div>
        ) : (
             <div className="mb-4 flex justify-center">
                <Logo size="large" />
            </div>
        )}

        <Card className="shadow-2xl bg-card/80 backdrop-blur-sm border-white/10">
          <CardHeader className="p-4 pb-0 items-center">
            <CardTitle className="text-center text-2xl font-semibold text-primary">Acessar Sistema</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-4">
            <LoginForm onLogin={handleLogin} prefilledIdentifier={lastLoggedInUser?.identifier}/>
             <div className="mt-4 text-center">
              <Link href="/forgot-password">
                <Button variant="link" className="text-sm text-muted-foreground">Esqueceu-se da palavra-passe?</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
        
        <Card className="mt-6 shadow-2xl bg-card/80 backdrop-blur-sm border-white/10">
            <CardHeader className="p-4 pb-2">
                <CardTitle className="text-center text-xl font-semibold">Consultar Cotação</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
                <QuoteLookupForm onLookup={handleLookup} />
            </CardContent>
        </Card>

      </div>

       <footer className="relative z-10 mt-6 text-center text-xs text-muted-foreground/80">
        <p>© {new Date().getFullYear()} {companyProfile?.razaoSocial || 'Sua Empresa'}. Todos os direitos reservados.</p>
        {companyProfile && (
            <p className="mt-1">
                CNPJ: {companyProfile.cnpj} | {companyProfile.endereco}
            </p>
        )}
        <p className="mt-2">
          Este sistema está em conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD), Lei nº 13.709/2018.
        </p>
      </footer>
    </div>
  );
}
