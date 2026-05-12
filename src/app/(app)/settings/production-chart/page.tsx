"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Printer } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from 'recharts';
import { DateRange } from 'react-day-picker';
import { subDays, format, parseISO, parse } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import type { DeliveryStatus, Quote } from '@/lib/types';
import { authFetch } from '@/lib/api-client';

type ChartData = {
  date: string;
  quotesCreated: number;
  closedValue: number;
};

type DeliveryChartData = {
    name: DeliveryStatus | 'Pendente';
    value: number;
}

export default function ProductionChartPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });

  const [startDateStr, setStartDateStr] = useState(dateRange?.from ? format(dateRange.from, 'dd/MM/yyyy') : '');
  const [endDateStr, setEndDateStr] = useState(dateRange?.to ? format(dateRange.to, 'dd/MM/yyyy') : '');

  const fetchAllData = useCallback(async () => {
    setIsDataLoading(true);
    try {
        const res = await authFetch('/api/quotes?limit=10000'); // Fetch all quotes for stats
        if (!res.ok) throw new Error("Failed to fetch quotes");
        setQuotes(await res.json());
    } catch(e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
        setIsDataLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
    if(authLoading) return;
    if(!user || user.role !== 'admin') {
      router.push('/dashboard');
      return;
    }
    fetchAllData();
  }, [user, authLoading, router, fetchAllData]);

  useEffect(() => {
    setStartDateStr(dateRange?.from ? format(dateRange.from, 'dd/MM/yyyy') : '');
    setEndDateStr(dateRange?.to ? format(dateRange.to, 'dd/MM/yyyy') : '');
  }, [dateRange]);


  const { barChartData, deliveryChartData } = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return { barChartData: [], deliveryChartData: []};

    const filteredQuotes = quotes.filter(quote => {
      const quoteDate = parseISO(quote.data);
      return quoteDate >= dateRange.from! && quoteDate <= dateRange.to!;
    });

    const dataByDate = filteredQuotes.reduce((acc, quote) => {
      const dateKey = format(parseISO(quote.data), 'yyyy-MM-dd');
      
      if (!acc[dateKey]) {
        acc[dateKey] = { date: format(parseISO(quote.data), 'dd/MM'), quotesCreated: 0, closedValue: 0 };
      }
      
      acc[dateKey].quotesCreated += 1;
      
      if (quote.status === 'Fechada' || quote.status === 'Finalizado') {
        acc[dateKey].closedValue += (quote.valorFinal || 0) + (quote.icmsValor || 0);
      }
      
      return acc;
    }, {} as Record<string, ChartData>);

    const finalBarChartData = Object.values(dataByDate).sort((a,b) => a.date.localeCompare(b.date));
    
    const finalizedQuotes = filteredQuotes.filter(q => q.status === 'Finalizado');
    const deliveryCounts = finalizedQuotes.reduce((acc, quote) => {
        const status = quote.deliveryStatus || 'Pendente';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {} as Record<DeliveryStatus | 'Pendente', number>);

    const finalDeliveryChartData: DeliveryChartData[] = Object.entries(deliveryCounts).map(([name, value]) => ({
        name: name as DeliveryStatus | 'Pendente',
        value,
    }));

    return { barChartData: finalBarChartData, deliveryChartData: finalDeliveryChartData };

  }, [quotes, dateRange]);
  
  const handlePrint = () => {
    window.print();
  }
  
  const handleApplyDateFilter = () => {
    try {
      const from = parse(startDateStr, 'dd/MM/yyyy', new Date());
      const to = parse(endDateStr, 'dd/MM/yyyy', new Date());
      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        throw new Error('Formato de data inválido.');
      }
      if (from > to) {
        throw new Error('A data de início não pode ser maior que a data de fim.');
      }
      setDateRange({ from, to });
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Erro de Data',
        description: e.message || 'Por favor, use o formato DD/MM/AAAA.'
      });
    }
  };

  if (authLoading || isDataLoading || !user || user.role !== 'admin') {
    return (
        <div className="flex h-full items-center justify-center">
             <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  const DELIVERY_COLORS: Record<DeliveryStatus | 'Pendente', string> = {
    'No Prazo': '#16a34a',
    'Atrasado': '#dc2626',
    'Em Andamento': '#f59e0b',
    'Pendente': '#6b7280',
  };

  return (
    <main className="container mx-auto p-4 md:p-8">
      <style jsx global>{`
          @media print {
            body * {
              visibility: hidden;
            }
            .printable-area, .printable-area * {
              visibility: visible;
            }
            .printable-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
            .no-print {
              display: none;
            }
          }
      `}</style>
      <div className="no-print">
          <Button variant="outline" onClick={() => router.push('/settings')} className="mb-8">
              &larr; Voltar para Configurações
          </Button>
          <h1 className="text-3xl font-bold text-primary mb-2">Gráfico de Produção</h1>
          <p className="text-muted-foreground mb-8">Analise o volume de cotações e o desempenho das entregas por período.</p>
      </div>
      
      <div className="space-y-8 printable-area">
          <Card>
              <CardHeader>
                  <CardTitle>Filtro e Ações</CardTitle>
                    <CardDescription>
                      {dateRange?.from && dateRange?.to ? 
                          `Exibindo resultados de ${format(dateRange.from, "dd/MM/yyyy")} a ${format(dateRange.to, "dd/MM/yyyy")}`
                          : 'Selecione um período'}
                      </CardDescription>
                  <div className="flex flex-col md:flex-row gap-4 items-end justify-between pt-4 no-print">
                      <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                          <div className="flex items-center gap-2 flex-wrap">
                              <Button variant="outline" onClick={() => setDateRange({ from: subDays(new Date(), 6), to: new Date() })}>7 dias</Button>
                              <Button variant="outline" onClick={() => setDateRange({ from: subDays(new Date(), 14), to: new Date() })}>15 dias</Button>
                              <Button variant="outline" onClick={() => setDateRange({ from: subDays(new Date(), 29), to: new Date() })}>30 dias</Button>
                          </div>
                          <div className="flex items-center gap-2">
                              <Input
                                  placeholder="DD/MM/AAAA"
                                  value={startDateStr}
                                  onChange={(e) => setStartDateStr(e.target.value)}
                                  className="w-32"
                              />
                              <span className="text-muted-foreground">-</span>
                              <Input
                                  placeholder="DD/MM/AAAA"
                                  value={endDateStr}
                                  onChange={(e) => setEndDateStr(e.target.value)}
                                  className="w-32"
                              />
                              <Button onClick={handleApplyDateFilter}>Aplicar</Button>
                          </div>
                      </div>
                      <Button onClick={handlePrint} className="w-full md:w-auto">
                          <Printer className="mr-2 h-4 w-4" /> Imprimir Gráficos
                      </Button>
                  </div>
              </CardHeader>
          </Card>

          <Card>
              <CardHeader>
                  <CardTitle>Desempenho de Cotações (Criação vs. Valor Fechado)</CardTitle>
              </CardHeader>
              <CardContent className="h-[500px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis yAxisId="left" orientation="left" stroke="#3b82f6" label={{ value: 'Cotações Realizadas', angle: -90, position: 'insideLeft', fill: '#3b82f6' }} />
                          <YAxis yAxisId="right" orientation="right" stroke="#16a34a" label={{ value: 'Valor Fechado (R$)', angle: -90, position: 'insideRight', fill: '#16a34a' }} />
                          <Tooltip
                          formatter={(value, name) => {
                              if (name === 'closedValue') {
                                  return [new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value as number), 'Valor Fechado'];
                              }
                              return [value, 'Cotações Realizadas'];
                          }}
                          />
                          <Legend />
                          <Bar yAxisId="left" dataKey="quotesCreated" fill="#3b82f6" name="Cotações Realizadas" />
                          <Bar yAxisId="right" dataKey="closedValue" fill="#16a34a" name="Valor Fechado" />
                      </BarChart>
                  </ResponsiveContainer>
              </CardContent>
          </Card>
          
          <Card>
                <CardHeader>
                  <CardTitle>Desempenho de Entregas</CardTitle>
                  <CardDescription>Distribuição das entregas finalizadas por status de cumprimento do prazo.</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <Pie
                              data={deliveryChartData}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              outerRadius={150}
                              fill="#8884d8"
                              dataKey="value"
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          >
                              {deliveryChartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={DELIVERY_COLORS[entry.name]} />
                              ))}
                          </Pie>
                          <Tooltip formatter={(value) => `${value} entregas`}/>
                          <Legend />
                      </PieChart>
                  </ResponsiveContainer>
              </CardContent>
          </Card>
      </div>
    </main>
  );
}
