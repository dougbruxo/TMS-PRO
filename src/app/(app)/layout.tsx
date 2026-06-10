"use client";

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';
import Header from '@/components/Header';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { ChatPopupManager } from '@/components/chat/ChatPopupManager';
import { PageTransition } from '@/components/PageTransition';
import { SupportLockBanner } from '@/components/SupportLockBanner';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/lib/types';

function checkRouteAuthorization(user: User, pathname: string): boolean {
    const role = user.role;
    
    // 1. Motorista (driver): Apenas portal do motorista e subpastas
    if (role === 'driver') {
        return pathname === '/driver-portal' || pathname.startsWith('/driver-portal/');
    }
    
    // 2. Clientes B2B (cliente, sub-cliente): Apenas suas áreas e my-freights
    if (role === 'cliente' || role === 'sub-cliente') {
        return (
            pathname.startsWith('/cliente') || 
            pathname.startsWith('/my-freights') || 
            pathname.startsWith('/clientes-fornecedores') ||
            pathname.startsWith('/configuracoes') ||
            pathname.startsWith('/financial/billing/invoice/') ||
            (pathname === '/chat' && !!user.chatEnabled)
        );
    }
    
    // 3. Usuários Operacionais e Administrativos (admin, user, parceiro)
    // Não devem acessar as páginas internas exclusivas de motoristas
    if (pathname.startsWith('/driver-portal')) {
        return false;
    }
    // Não devem acessar o portal do cliente principal (mas podem ver armazenagem se tiverem stockAccess)
    if (pathname.startsWith('/cliente') && !pathname.startsWith('/cliente/armazenagem')) {
        return false;
    }
    
    // Validação granular de permissões individuais para usuários não-administradores
    if (role !== 'admin') {
        if (pathname.startsWith('/quotes') && !user.freightAccess && !user.analyzeQuotesAccess) {
            return false;
        }
        if (pathname.startsWith('/operational') && !user.operationalAccess) {
            return false;
        }
        if (pathname.startsWith('/receiving') && !user.receivingAccess) {
            return false;
        }
        if (pathname.startsWith('/stock') && !user.stockAccess) {
            return false;
        }
        if (pathname.startsWith('/documents') && !user.documentsAccess) {
            return false;
        }
        if (pathname.startsWith('/cadastros') && !user.registrationsAccess) {
            return false;
        }
        if (pathname.startsWith('/hr') && !user.talentsAccess) {
            return false;
        }
        if (pathname.startsWith('/financial') && !user.expensesAccess) {
            return false;
        }
        if (pathname.startsWith('/notice-board') && !user.noticeBoardAccess) {
            return false;
        }
        if (pathname.startsWith('/settings') && !user.settingsAccess) {
            return false;
        }
        if (pathname.startsWith('/panorama') && !user.panoramaAccess) {
            return false;
        }
        if (pathname.startsWith('/sac') && !user.sacAccess) {
            return false;
        }
        if (pathname.startsWith('/portais-clientes') && !user.clientPortalsAccess) {
            return false;
        }
    }
    
    return true;
}

function ProtectedLayout({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const { toast } = useToast();
    const [isEmbedded, setIsEmbedded] = React.useState(false);

    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            const hasEmbeddedQuery = window.location.search.includes('embedded=true');
            const isPrintOrInvoiceRoute = window.location.pathname.includes('/print') || window.location.pathname.includes('/invoice/');
            setIsEmbedded(hasEmbeddedQuery || isPrintOrInvoiceRoute);
        }
    }, [pathname]);

    React.useEffect(() => {
        if (!loading && !user) {
            router.push(`/?redirect=${pathname}`);
        }
    }, [loading, user, router, pathname]);

    React.useEffect(() => {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => {
                    console.log('Service Worker registered successfully:', reg.scope);
                })
                .catch(err => {
                    console.error('Service Worker registration failed:', err);
                });
        }
    }, []);

    // Calcular autorização de forma síncrona se o usuário estiver carregado
    const isAuthorized = React.useMemo(() => {
        if (!user) return true; // Deixa o redirecionamento de login agir no useEffect principal
        return checkRouteAuthorization(user, pathname);
    }, [user, pathname]);

    React.useEffect(() => {
        if (!loading && user && !isAuthorized) {
            toast({
                title: 'Acesso Negado',
                description: 'Você não tem permissão para acessar esta página.',
                variant: 'destructive',
            });

            // Determinar rota padrão de destino
            let redirectPath = '/dashboard';
            if (user.role === 'driver') {
                redirectPath = '/driver-portal';
            } else if (user.role === 'cliente' || user.role === 'sub-cliente') {
                redirectPath = '/cliente/dashboard';
            }
            
            router.replace(redirectPath);
        }
    }, [loading, user, isAuthorized, router, toast]);

    if (loading || !user || !isAuthorized) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    if (isEmbedded) {
        return (
            <main className="flex-grow flex flex-col relative overflow-hidden bg-background">
                <PageTransition>{children}</PageTransition>
            </main>
        );
    }

    // Default to 'header' if not set for existing users
    const layoutMode = user.layoutMode || 'header';

    if (layoutMode === 'sidebar') {
        return (
             <SidebarProvider>
                <AppSidebar />
                <div className="flex flex-1 flex-col">
                    <SupportLockBanner />
                    <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 mt-2">
                        <SidebarTrigger className="md:hidden" />
                        {/* Future: Breadcrumbs or Global Search can go here */}
                    </header>
                    <main className="flex-grow flex flex-col relative overflow-hidden">
                        <PageTransition>{children}</PageTransition>
                    </main>
                </div>
                {user.chatEnabled && (
                    <ChatPopupManager />
                )}
            </SidebarProvider>
        );
    }

    // Default 'header' layout
    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <SupportLockBanner />
            <main className="flex-grow flex flex-col relative overflow-hidden">
                <PageTransition>{children}</PageTransition>
            </main>
             {user.chatEnabled && (
                <ChatPopupManager />
            )}
        </div>
    );
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedLayout>
        {children}
    </ProtectedLayout>
  );
}
