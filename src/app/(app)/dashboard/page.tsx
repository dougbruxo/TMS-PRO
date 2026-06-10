"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Loader2, LayoutDashboard } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { AnnouncementsPanel } from '@/components/AnnouncementsPanel';
import { dashboardCardsConfig } from '@/lib/dashboard-cards';
import type { User, ChatAnnouncement } from '@/lib/types';
import useLocalStorage from '@/hooks/use-local-storage';
import { useAuth } from '@/hooks/use-auth';
import { FirstLoginTutorial } from '@/components/FirstLoginTutorial';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { authFetch } from '@/lib/api-client';
import { PremiumNavigationCard } from '@/components/PremiumNavigationCard';


const CardSkeleton = () => (
    <Card className="flex flex-col w-full h-full border border-border/40 bg-card/45 backdrop-blur-2xl shadow-xl rounded-2xl p-5">
        <CardHeader className="flex-row items-center gap-4 space-y-0 pb-4 p-0">
            <Skeleton className="h-10 w-10 rounded-2xl" />
            <div className="flex-grow space-y-2">
                <Skeleton className="h-5 w-3/4" />
            </div>
        </CardHeader>
        <CardContent className="p-0 mt-2 flex-grow">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5 mt-2" />
        </CardContent>
    </Card>
);

export default function DashboardPage() {
  const { user, loading: isAuthLoading, completeFirstLoginTutorial, operationalAlertCount, receivingAlertCount, expenseAlertCount, billingAlertCount } = useAuth();
  const { toast } = useToast();
  
  const [cardOrder, setCardOrder] = useLocalStorage<string[]>('dashboardCardOrder', []);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [announcements, setAnnouncements] = useState<ChatAnnouncement[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setIsDataLoading(true);
    try {
        const token = localStorage.getItem('sessionToken');
        const res = await authFetch('/api/announcements', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            setAnnouncements(await res.json());
        }
    } catch(e) {
        toast({variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os avisos.'});
    } finally {
        setIsDataLoading(false);
    }
  }, [user, toast]);
  
  useEffect(() => {
    if (!isAuthLoading && user) {
        if (user.role === 'cliente' || user.role === 'sub-cliente') {
            window.location.replace('/cliente/dashboard');
            return;
        }
        setIsTutorialOpen(user.firstLogin === true);
        fetchData();
    }
  }, [isAuthLoading, user, fetchData]);


  const handleFinishTutorial = () => {
    setIsTutorialOpen(false);
    completeFirstLoginTutorial();
  };

  const accessibleCards = React.useMemo(() => {
    if (!user) return [];
    return dashboardCardsConfig.filter(card => {
      if (card.isClientOnly && (user.role === 'admin' || user.role === 'user')) return false;
      if (user.role === 'admin') return true;
      return !!user[card.permissionKey as keyof User];
    });
  }, [user]);

  const sortedCards = React.useMemo(() => {
    if (cardOrder.length === 0) {
      return accessibleCards;
    }
    
    const cardMap = new Map(accessibleCards.map(card => [card.title, card]));
    const orderedCards = cardOrder.flatMap(title => {
        const card = cardMap.get(title);
        if (card) {
            cardMap.delete(title);
            return [card];
        }
        return [];
    });
    
    return [...orderedCards, ...Array.from(cardMap.values())];

  }, [accessibleCards, cardOrder]);

  if (isAuthLoading || !user) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  const financialAlerts = (expenseAlertCount || 0) + (billingAlertCount || 0);

  return (
    <main className="container mx-auto p-4 md:p-8 relative overflow-hidden">
        {/* Efeitos de desfoque e brilho aurora neon atrás dos cards */}
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/15 rounded-full blur-[100px] pointer-events-none -z-10 animate-float-blur-1" />
        <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-purple-500/15 rounded-full blur-[120px] pointer-events-none -z-10 animate-float-blur-2" />

        <FirstLoginTutorial open={isTutorialOpen} onFinish={handleFinishTutorial} />
        <PageHeader
            icon={<LayoutDashboard className="h-4 w-4" />}
            badge="Painel de Controle"
            titlePrefix="Página"
            titleHighlight="Inicial"
            description={`Bem-vindo(a) de volta, ${user.username}! Selecione uma área para começar.`}
        />
        
        {isDataLoading ? (
            <div className="space-y-6">
                <Skeleton className="h-20 w-full" />
                <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {Array.from({ length: 8 }).map((_, index) => <CardSkeleton key={index} />)}
                </div>
            </div>
        ) : (
            <>
                <AnnouncementsPanel announcements={announcements || []} />
                <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {sortedCards.map((card) => {
                      const pulsingCount = 
                        card.link === '/operational' ? (operationalAlertCount || 0) :
                        card.link === '/receiving' ? (receivingAlertCount || 0) :
                        card.link === '/financial' ? (financialAlerts || 0) : 0;
                        
                      return (
                        <PremiumNavigationCard
                          key={card.title}
                          title={card.title}
                          description={card.description}
                          href={card.link}
                          icon={card.icon}
                          pulsingBadgeCount={pulsingCount}
                        />
                      );
                    })}
                </div>
            </>
        )}

        <style>{`
          @keyframes floatBlur1 {
            0%, 100% {
              transform: translate(0, 0) scale(1);
              background-color: hsl(var(--primary) / 0.15);
            }
            25% {
              transform: translate(120px, 60px) scale(1.15);
              background-color: rgba(99, 102, 241, 0.18);
            }
            50% {
              transform: translate(40px, 160px) scale(0.95);
              background-color: rgba(236, 72, 153, 0.14);
            }
            75% {
              transform: translate(-80px, 100px) scale(1.08);
              background-color: rgba(59, 130, 246, 0.18);
            }
          }

          @keyframes floatBlur2 {
            0%, 100% {
              transform: translate(0, 0) scale(1);
              background-color: rgba(168, 85, 247, 0.15);
            }
            33% {
              transform: translate(-100px, -120px) scale(1.1);
              background-color: rgba(59, 130, 246, 0.16);
            }
            66% {
              transform: translate(80px, -60px) scale(0.9);
              background-color: rgba(236, 72, 153, 0.14);
            }
          }

          .animate-float-blur-1 {
            animation: floatBlur1 28s infinite ease-in-out alternate !important;
          }

          .animate-float-blur-2 {
            animation: floatBlur2 38s infinite ease-in-out alternate !important;
          }
        `}</style>
    </main>
  );
}