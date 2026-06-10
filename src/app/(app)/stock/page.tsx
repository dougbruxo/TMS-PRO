
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { StockManagement } from '@/components/StockManagement';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BackButton } from '@/components/BackButton';
import { useToast } from '@/hooks/use-toast';
import type { StockPosition, StockItem, Quote, StockMovement, ReceivingBatch } from '@/lib/types';
import { authFetch } from '@/lib/api-client';

const POSITIONS_PER_PAGE = 50;

export default function StockPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [positions, setPositions] = useState<StockPosition[]>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isPositionsLoading, setIsPositionsLoading] = useState(false);
  const [positionsPage, setPositionsPage] = useState(1);
  const [hasMorePositions, setHasMorePositions] = useState(true);
  const [receivingBatches, setReceivingBatches] = useState<ReceivingBatch[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !user.stockAccess) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  const fetchPositions = useCallback(async (pageNum: number, refresh = false) => {
    setIsPositionsLoading(true);
    try {
      const response = await authFetch(`/api/stock/positions?page=${pageNum}&limit=${POSITIONS_PER_PAGE}`);
      if (response.ok) {
        const newPositions = await response.json();
        setPositions(prev => refresh ? newPositions : [...prev, ...newPositions]);
        setHasMorePositions(newPositions.length === POSITIONS_PER_PAGE);
      } else {
        setHasMorePositions(false);
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro de Rede', description: 'Não foi possível carregar as posições.' });
    } finally {
      setIsPositionsLoading(false);
    }
  }, [toast]);

  const [historyDate, setHistoryDate] = useState<string>('');

  const fetchMovements = useCallback(async (date?: string) => {
    try {
      const url = `/api/stock/movements?limit=100${date ? `&date=${date}` : ''}`;
      const response = await authFetch(url);
      if (response.ok) {
        setMovements(await response.json());
      }
    } catch (e) {
      console.error('Failed to fetch movements', e);
    }
  }, []);

  const fetchAllData = useCallback(async () => {
    setIsDataLoading(true);
    await fetchPositions(1, true); // Fetch first page of positions
    try {
      const [itemsRes, receivingRes] = await Promise.all([
        authFetch('/api/stock/items'),
        authFetch('/api/stock/receiving'),
        fetchMovements(historyDate)
      ]);

      if (!itemsRes.ok) {
        throw new Error('Falha ao carregar dados do estoque.');
      }

      if (receivingRes.ok) {
        setReceivingBatches(await receivingRes.json());
      }
      setItems(await itemsRes.json());

    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro de Carregamento', description: e.message });
    } finally {
      setIsDataLoading(false);
    }
  }, [toast, fetchPositions, fetchMovements, historyDate]);

  useEffect(() => {
    if (user?.stockAccess && !isDataLoading) {
      fetchMovements(historyDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyDate]);

  const handleLoadMorePositions = () => {
    const nextPage = positionsPage + 1;
    setPositionsPage(nextPage);
    fetchPositions(nextPage);
  };

  const handleDataMutated = () => {
    setPositionsPage(1);
    fetchAllData();
  }

  useEffect(() => {
    if (user?.stockAccess) {
      handleDataMutated();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);


  if (authLoading || isDataLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-start flex-wrap gap-4 mb-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-primary">Gestão de Estoque</h1>
          <p className="text-muted-foreground text-sm">Gerencie as posições de paletes e os itens armazenados no armazém.</p>
        </div>
        <div className="flex items-center gap-4 mt-2">
          <Button onClick={() => router.push('/stock/expeditions')} variant="outline">
            Painel de Expedição
          </Button>
          <BackButton href="/dashboard" label="Voltar para Dashboard" className="mb-0" />
        </div>
      </div>

      <StockManagement
        positions={positions}
        items={items}
        receivingBatches={receivingBatches}
        movements={movements}
        onDataMutated={handleDataMutated}
        isLoadingPositions={isPositionsLoading}
        hasMorePositions={hasMorePositions}
        onLoadMorePositions={handleLoadMorePositions}
        historyDate={historyDate}
        setHistoryDate={setHistoryDate}
      />
    </main>
  );
}
