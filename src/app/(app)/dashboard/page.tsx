"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { AnnouncementsPanel } from '@/components/AnnouncementsPanel';
import { dashboardCardsConfig } from '@/lib/dashboard-cards';
import type { User, ChatAnnouncement } from '@/lib/types';
import useLocalStorage from '@/hooks/use-local-storage';
import { useAuth } from '@/hooks/use-auth';
import { FirstLoginTutorial } from '@/components/FirstLoginTutorial';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { authFetch } from '@/lib/api-client';


const CardSkeleton = () => (
    <Card>
        <CardHeader className="flex-row items-center gap-4 space-y-0 pb-4">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="flex-grow space-y-2">
                <Skeleton className="h-5 w-3/4" />
            </div>
        </CardHeader>
        <CardContent>
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
    <div className="container mx-auto p-4 md:p-8">
        <FirstLoginTutorial open={isTutorialOpen} onFinish={handleFinishTutorial} />
        <div className="space-y-2 mb-8">
            <h1 className="text-3xl font-bold text-primary">Página Inicial</h1>
            <p className="text-muted-foreground">Bem-vindo(a) de volta, {user.username}! Selecione uma área para começar.</p>
        </div>
        
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
                      const hasAlert = 
                        (card.link === '/operational' && operationalAlertCount > 0) ||
                        (card.link === '/receiving' && receivingAlertCount > 0) ||
                        (card.link === '/financial' && financialAlerts > 0);
                        
                      return (
                      <Link key={card.title} href={card.link} className="flex">
                        <Card className="relative flex flex-col w-full transition-all duration-300 hover:shadow-glow hover:-translate-y-1 hover:ring-2 hover:ring-primary">
                            {hasAlert && <span className="absolute top-2 right-2 flex h-3 w-3 rounded-full bg-red-500 animate-pulse" />}
                            <CardHeader className="flex-row items-center gap-4 space-y-0 pb-4">
                              {card.icon}
                              <CardTitle className="text-lg">{card.title}</CardTitle>
                            </CardHeader>
                            <CardContent className="flex-grow">
                              <CardDescription>{card.description}</CardDescription>
                            </CardContent>
                        </Card>
                      </Link>
                    )})}
                </div>
            </>
        )}
    </div>
  );
}