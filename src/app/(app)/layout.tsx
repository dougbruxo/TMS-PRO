
"use client";

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';
import Header from '@/components/Header';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { ChatPopupManager } from '@/components/chat/ChatPopupManager';
import { PageTransition } from '@/components/PageTransition';
import { SupportLockBanner } from '@/components/SupportLockBanner';

function ProtectedLayout({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    React.useEffect(() => {
        if (!loading && !user) {
            router.push(`/?redirect=${pathname}`);
        }
    }, [loading, user, router, pathname]);

    if (loading || !user) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
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
