import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, MapPin, AlertTriangle, Activity, XCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { StockPosition, StockItem, StockMovement, ReceivingBatch } from '@/lib/types';
import { differenceInDays, parseISO } from 'date-fns';
import { ExpiryAlertPanel } from './ExpiryAlertPanel';
import { cn } from '@/lib/utils';

interface StockDashboardProps {
    positions: StockPosition[];
    items: StockItem[];
    movements: StockMovement[];
    receivingBatches: ReceivingBatch[];
    onNavigateToTab?: (tab: string) => void;
}

export function StockDashboard({ positions, items, movements, receivingBatches, onNavigateToTab }: StockDashboardProps) {
    const [isExpiryPanelOpen, setIsExpiryPanelOpen] = useState(false);

    const totalPositions = positions.length;
    const occupiedPositions = positions.filter(p => p.status === 'Ocupado').length;
    const occupancyRate = totalPositions > 0 ? (occupiedPositions / totalPositions) * 100 : 0;

    const expiryStats = useMemo(() => {
        let expired = 0;
        let expiringSoon = 0;

        items.forEach(item => {
            if (!item.expirationDate) return;
            try {
                const days = differenceInDays(parseISO(item.expirationDate), new Date());
                if (days < 0) {
                    expired++;
                } else if (days <= 30) {
                    expiringSoon++;
                }
            } catch (e) {
                // Invalid date
            }
        });

        return { expired, expiringSoon, total: expired + expiringSoon };
    }, [items]);

    const movementsToday = movements.filter(m => {
        try {
            const days = differenceInDays(new Date(), parseISO(m.timestamp));
            return days === 0;
        } catch (e) {
            return false;
        }
    }).length;

    const pendingReceiving = receivingBatches.filter(b => b.status === 'Pendente').length;
    const hasExpiryAlerts = expiryStats.total > 0;

    return (
        <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-2">
                <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Taxa de Ocupação</CardTitle>
                        <MapPin className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{occupancyRate.toFixed(1)}%</div>
                        <p className="text-xs text-muted-foreground">
                            {occupiedPositions} de {totalPositions} posições em uso
                        </p>
                        <div className="w-full bg-secondary h-1.5 mt-3 rounded-full overflow-hidden">
                            <div 
                                className="bg-primary h-full transition-all duration-500" 
                                style={{ width: `${occupancyRate}%` }}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total de Itens</CardTitle>
                        <Package className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{items.reduce((acc, i) => acc + i.quantity, 0)}</div>
                        <p className="text-xs text-muted-foreground">
                            Volume total armazenado
                        </p>
                    </CardContent>
                </Card>

                {/* Expiry card — now clickable and shows both expired and expiring */}
                <Card 
                    className={cn(
                        "bg-card/50 backdrop-blur-sm cursor-pointer transition-all duration-200 hover:scale-[1.02]",
                        expiryStats.expired > 0 
                            ? "border-red-500/40 shadow-red-500/10 shadow-md" 
                            : expiryStats.expiringSoon > 0
                            ? "border-amber-500/40 shadow-amber-500/10 shadow-md"
                            : "border-primary/20"
                    )}
                    onClick={() => hasExpiryAlerts && setIsExpiryPanelOpen(!isExpiryPanelOpen)}
                >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            {expiryStats.expired > 0 ? 'Alerta de Validade' : 'Validade (30 dias)'}
                        </CardTitle>
                        <div className="flex items-center gap-1">
                            {expiryStats.expired > 0 ? (
                                <XCircle className="h-4 w-4 text-red-500 animate-pulse" />
                            ) : (
                                <AlertTriangle className={`h-4 w-4 ${expiryStats.expiringSoon > 0 ? 'text-amber-500 animate-pulse' : 'text-muted-foreground'}`} />
                            )}
                            {hasExpiryAlerts && (
                                isExpiryPanelOpen 
                                    ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> 
                                    : <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            {expiryStats.expired > 0 && (
                                <span className="text-2xl font-bold text-red-500">{expiryStats.expired}</span>
                            )}
                            {expiryStats.expired > 0 && expiryStats.expiringSoon > 0 && (
                                <span className="text-muted-foreground text-sm">+</span>
                            )}
                            <span className={cn(
                                "font-bold",
                                expiryStats.expired > 0 ? "text-lg text-amber-500" : "text-2xl"
                            )}>
                                {expiryStats.expiringSoon}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {expiryStats.expired > 0 
                                ? `${expiryStats.expired} vencido(s) • ${expiryStats.expiringSoon} próximo(s)`
                                : 'Itens com validade próxima'
                            }
                        </p>
                        {hasExpiryAlerts && (
                            <p className="text-[10px] text-muted-foreground mt-2 opacity-70">
                                Clique para ver detalhes
                            </p>
                        )}
                    </CardContent>
                </Card>

                <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Giro (Hoje)</CardTitle>
                        <Activity className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{movementsToday}</div>
                        <p className="text-xs text-muted-foreground">
                            Movimentações nas últimas 24h
                        </p>
                    </CardContent>
                </Card>

                <Card 
                    className={cn(
                        "bg-card/50 backdrop-blur-sm transition-all duration-200 border-primary/20",
                        pendingReceiving > 0 && "cursor-pointer hover:scale-[1.02] border-blue-500/40 shadow-blue-500/10 shadow-md"
                    )}
                    onClick={() => pendingReceiving > 0 && onNavigateToTab?.('receiving')}
                >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Recebimentos Pendentes</CardTitle>
                        <ChevronRight className={cn("h-4 w-4 text-primary", pendingReceiving === 0 && "text-muted-foreground opacity-20")} />
                    </CardHeader>
                    <CardContent>
                        <div className={cn("text-2xl font-bold", pendingReceiving > 0 && "text-blue-500")}>
                            {pendingReceiving}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Lotes aguardando conferência
                        </p>
                        {pendingReceiving > 0 && (
                            <p className="text-[10px] text-blue-500/70 mt-2">
                                Clique para conferir agora
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Expiry Alert Panel — expandable */}
            {isExpiryPanelOpen && hasExpiryAlerts && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <ExpiryAlertPanel items={items} />
                </div>
            )}
        </div>
    );
}
