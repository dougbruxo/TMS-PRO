
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
    const [useVideo, setUseVideo] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const isLowEnd = 
                (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) ||
                /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
            
            if (!isLowEnd) {
                const randomVideo = backgroundVideos[Math.floor(Math.random() * backgroundVideos.length)];
                setVideoSrc(randomVideo);
                setUseVideo(true);
            } else {
                setUseVideo(false);
            }
        }
    }, []);

    if (!useVideo) {
        return (
            <div className="absolute inset-0 z-0 bg-gradient-to-tr from-black via-[#080d1a] to-black overflow-hidden">
                {/* High-performance CSS static glowing bubbles with zero GPU overhead */}
                <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-[radial-gradient(circle,rgba(59,130,246,0.08)_0%,transparent_70%)] pointer-events-none" />
                <div className="absolute bottom-[-20%] right-[-20%] w-[90%] h-[90%] bg-[radial-gradient(circle,rgba(168,85,247,0.06)_0%,transparent_70%)] pointer-events-none" />
            </div>
        );
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
  const [lookupState, setLookupState] = useState<'form' | 'result'>('form');
  
  const handleLogin = async (identifier: string, password: string): Promise<LoginResult> => {
    return await login(identifier, password);
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

      <div className={cn("relative z-10 w-full transition-all duration-500", lookupState === 'result' ? "max-w-3xl" : "max-w-md")}>
        {lookupState === 'form' && (
          <>
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
          </>
        )}
        
        <Card className={cn(
          "shadow-2xl transition-all duration-500", 
          lookupState === 'result' 
            ? "mt-0 bg-white border-none text-slate-900 light" 
            : "mt-6 bg-card/80 backdrop-blur-sm border-white/10 text-card-foreground"
        )}>
            {lookupState === 'form' && (
              <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-center text-xl font-semibold text-primary">Consultar/Rastreio/Comprovante</CardTitle>
              </CardHeader>
            )}
            <CardContent className="p-4">
                <QuoteLookupForm onStateChange={setLookupState} />
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
