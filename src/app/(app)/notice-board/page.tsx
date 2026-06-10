"use client";

import { useMemo, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ClipboardList, AlertTriangle, Siren, Check, Megaphone } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import type { Notice, NoticeUrgency } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/api-client';

const statusDetails: Record<NoticeUrgency | 'finalizado', { 
    icon: React.ReactElement, 
    title: string,
    description: string, 
    href: string,
    color: string,
    pulseColor?: string,
}> = {
    'normal': { 
        icon: <ClipboardList className="h-8 w-8 text-blue-500" />, 
        title: 'Avisos',
        description: "Avisos gerais e comunicados do dia a dia.", 
        href: "/notice-board/status/normal",
        color: "border-blue-500",
        pulseColor: "bg-green-500"
    },
    'atencao': { 
        icon: <AlertTriangle className="h-8 w-8 text-yellow-500" />, 
        title: 'Atenção',
        description: "Informações importantes que requerem atenção.", 
        href: "/notice-board/status/atencao",
        color: "border-yellow-500",
        pulseColor: "bg-yellow-500"
    },
    'critico': { 
        icon: <Siren className="h-8 w-8 text-red-500" />, 
        title: 'Crítico',
        description: "Avisos urgentes que precisam de ação imediata.", 
        href: "/notice-board/status/critico",
        color: "border-red-500",
        pulseColor: "bg-red-500"
    },
    'finalizado': { 
        icon: <Check className="h-8 w-8 text-green-500" />, 
        title: 'Finalizados',
        description: "Avisos que já foram concluídos ou resolvidos.", 
        href: "/notice-board/status/finalizado",
        color: "border-green-500"
    },
};


export default function NoticeBoardPage() {
  const { user } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  const fetchNotices = useCallback(async () => {
    setIsDataLoading(true);
    try {
        const res = await authFetch('/api/notices');
        if (!res.ok) throw new Error("Failed to fetch notices");
        setNotices(await res.json());
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
        setIsDataLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  if (isDataLoading || !user) {
    return (
        <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  const noticesByUrgency = notices.reduce((acc, notice) => {
      const key = notice.status === 'finalizado' ? 'finalizado' : notice.urgency;
      if (!acc[key]) {
          acc[key] = 0;
      }
      acc[key]++;
      return acc;
  }, {} as Record<NoticeUrgency | 'finalizado', number>);

  return (
    <main className="container mx-auto p-4 md:p-8">
        <PageHeader
            icon={<Megaphone className="h-4 w-4" />}
            badge="Comunicação Interna"
            titlePrefix="Quadro de"
            titleHighlight="Avisos"
            description="Visualize e gerencie os avisos da equipe."
        />
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {(Object.keys(statusDetails) as Array<keyof typeof statusDetails>).map(key => {
                 const details = statusDetails[key];
                 const count = noticesByUrgency[key] || 0;
                 const shouldBlink = count > 0 && key !== 'finalizado';
                 return (
                     <Link key={key} href={details.href} className="flex">
                        <Card className={`flex flex-col w-full transition-all duration-300 hover:shadow-glow hover:-translate-y-1 hover:ring-2 hover:ring-primary ${details.color} border-2`}>
                            <CardHeader className="flex-row items-center gap-4 space-y-0 pb-4">
                                {details.icon}
                                <div className="flex-grow">
                                     <CardTitle>{details.title}</CardTitle>
                                     <Badge className={`mt-1 ${shouldBlink ? `animate-pulse text-white ${details.pulseColor}` : ''}`}>
                                        {count} Avisos
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-grow">
                                <CardDescription>{details.description}</CardDescription>
                            </CardContent>
                        </Card>
                     </Link>
                 )
            })}
        </div>
    </main>
  );
}
