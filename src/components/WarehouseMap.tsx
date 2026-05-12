"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { StockPosition } from '@/lib/types';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Input } from './ui/input';
import { Search, Loader2 } from 'lucide-react';
import { authFetch } from '@/lib/api-client';

interface WarehouseMapProps {
    positions: StockPosition[];
    onPositionClick: (pos: StockPosition) => void;
}

export function WarehouseMap({ positions, onPositionClick }: WarehouseMapProps) {
    const corridors = useMemo(() => {
        const map: Record<string, StockPosition[]> = {};
        positions.forEach(p => {
            const letter = /^[A-Z]/.test(p.name) ? p.name[0] : 'Misc';
            if (!map[letter]) map[letter] = [];
            map[letter].push(p);
        });
        
        return Object.keys(map).sort().map(key => ({
            name: key,
            positions: map[key].sort((a, b) => {
                const numA = parseInt(a.name.replace(/^\D+/g, '')) || 0;
                const numB = parseInt(b.name.replace(/^\D+/g, '')) || 0;
                return numA - numB;
            })
        }));
    }, [positions]);

    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [highlightedPositions, setHighlightedPositions] = useState<Set<string>>(new Set());

    useEffect(() => {
        const handler = setTimeout(async () => {
            if (!searchQuery.trim()) {
                setHighlightedPositions(new Set());
                return;
            }
            setIsSearching(true);
            try {
                const res = await authFetch(`/api/stock/items?q=${encodeURIComponent(searchQuery.trim())}`);
                if (res.ok) {
                    const items = await res.json();
                    const positionIds = new Set<string>();
                    items.forEach((item: any) => {
                        if (item.positionId) positionIds.add(item.positionId);
                    });
                    setHighlightedPositions(positionIds);
                }
            } catch (error) {
                console.error("Search error", error);
            } finally {
                setIsSearching(false);
            }
        }, 500);

        return () => clearTimeout(handler);
    }, [searchQuery]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Vazio': return 'bg-green-500/20 border-green-500 text-green-700 dark:text-green-400 hover:bg-green-500/30';
            case 'Ocupado': return 'bg-orange-500/20 border-orange-500 text-orange-700 dark:text-orange-400 hover:bg-orange-500/30';
            case 'Manutenção': return 'bg-gray-500/20 border-gray-500 text-gray-700 dark:text-gray-400 hover:bg-gray-500/30';
            default: return 'bg-slate-500/20 border-slate-500';
        }
    };

    return (
        <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
            <CardHeader className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                    <CardTitle className="text-lg">Mapa Visual do Armazém</CardTitle>
                    <div className="flex gap-4 mt-2">
                        <div className="flex items-center gap-1.5 text-xs">
                            <div className="w-3 h-3 rounded-sm bg-green-500/50 border border-green-500"></div>
                            <span>Disponível</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                            <div className="w-3 h-3 rounded-sm bg-orange-500/50 border border-orange-500"></div>
                            <span>Ocupado</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                            <div className="w-3 h-3 rounded-sm bg-gray-500/50 border border-gray-500"></div>
                            <span>Manutenção</span>
                        </div>
                    </div>
                </div>
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Buscar SKU, Produto ou Empresa..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 pr-10"
                    />
                    {isSearching && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-8">
                    {corridors.map((corridor) => (
                        <div key={corridor.name} className="space-y-3">
                            <h3 className="text-sm font-semibold text-muted-foreground ml-1">Corredor {corridor.name}</h3>
                            <div className="flex flex-wrap gap-2">
                                <TooltipProvider>
                                    {corridor.positions.map((pos) => (
                                        <Tooltip key={pos.id}>
                                            <TooltipTrigger asChild>
                                                <button
                                                    onClick={() => onPositionClick(pos)}
                                                    className={`
                                                        w-12 h-12 rounded-lg border-2 flex items-center justify-center 
                                                        text-[10px] font-bold transition-all duration-200
                                                        shadow-sm hover:scale-105 active:scale-95
                                                        ${getStatusColor(pos.status)}
                                                        ${highlightedPositions.size > 0 && highlightedPositions.has(pos.id) ? 'ring-4 ring-blue-500 animate-pulse' : highlightedPositions.size > 0 ? 'opacity-30 grayscale' : ''}
                                                    `}
                                                >
                                                    {pos.name}
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <div className="p-1">
                                                    <p className="font-bold">{pos.name}</p>
                                                    <p className="text-xs">{pos.status}</p>
                                                    {pos.quoteCode && <p className="text-[10px] opacity-70">Cotação: {pos.quoteCode}</p>}
                                                </div>
                                            </TooltipContent>
                                        </Tooltip>
                                    ))}
                                </TooltipProvider>
                            </div>
                        </div>
                    ))}
                    {corridors.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                            Nenhuma posição cadastrada para exibir no mapa.
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
