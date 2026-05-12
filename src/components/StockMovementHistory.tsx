import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from './ui/badge';
import { format, parseISO } from 'date-fns';
import { StockMovement } from '@/lib/types';
import { ArrowRight, Move, Plus, Minus, Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface StockMovementHistoryProps {
    movements: StockMovement[];
    historyDate?: string;
    setHistoryDate?: (date: string) => void;
}

export function StockMovementHistory({ movements, historyDate, setHistoryDate }: StockMovementHistoryProps) {
    const getMovementIcon = (type: string) => {
        switch (type) {
            case 'ENTRY': return <Plus className="w-3 h-3 mr-1 text-green-500" />;
            case 'EXIT': return <Minus className="w-3 h-3 mr-1 text-red-500" />;
            case 'TRANSFER': return <Move className="w-3 h-3 mr-1 text-blue-500" />;
            case 'ADJUSTMENT': return <Settings className="w-3 h-3 mr-1 text-amber-500" />;
            default: return null;
        }
    };

    const getMovementBadge = (type: string) => {
        const colors: Record<string, string> = {
            ENTRY: 'bg-green-500/10 text-green-700 border-green-200',
            EXIT: 'bg-red-500/10 text-red-700 border-red-200',
            TRANSFER: 'bg-blue-500/10 text-blue-700 border-blue-200',
            ADJUSTMENT: 'bg-amber-500/10 text-amber-700 border-amber-200',
            EXPEDITION: 'bg-purple-500/10 text-purple-700 border-purple-200',
        };

        const typeLabels: Record<string, string> = {
            ENTRY: 'Entrada',
            EXIT: 'Saída',
            TRANSFER: 'Transferência',
            ADJUSTMENT: 'Ajuste',
            EXPEDITION: 'Expedição',
        };

        return (
            <Badge variant="outline" className={`${colors[type]} flex items-center w-fit`}>
                {getMovementIcon(type)}
                {typeLabels[type] || type}
            </Badge>
        );
    };

    return (
        <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-lg">Histórico de Movimentações (Audit Log)</CardTitle>
                    <CardDescription>Rastreabilidade imutável de todas as alterações físicas e de quantidade.</CardDescription>
                </div>
                {setHistoryDate && (
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">Filtrar data:</span>
                        <Input 
                            type="date" 
                            value={historyDate} 
                            onChange={(e) => setHistoryDate(e.target.value)}
                            className="w-auto"
                        />
                    </div>
                )}
            </CardHeader>
            <CardContent>
                <div className="border rounded-xl overflow-hidden">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="w-[180px]">Data/Hora</TableHead>
                                <TableHead>Item</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Quantidade</TableHead>
                                <TableHead>Movimentação</TableHead>
                                <TableHead>Motivo</TableHead>
                                <TableHead className="text-right">Usuário</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {movements.map((m) => (
                                <TableRow key={m.id} className="hover:bg-muted/30 transition-colors">
                                    <TableCell className="text-xs font-medium">
                                        {format(parseISO(m.timestamp), 'dd/MM/yyyy HH:mm:ss')}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-sm">{m.itemName}</span>
                                            <span className="text-[10px] text-muted-foreground font-mono">{m.sku}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {getMovementBadge(m.type)}
                                    </TableCell>
                                    <TableCell className="font-bold">
                                        {m.type === 'EXIT' ? '-' : '+'}{m.quantity}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 text-[11px]">
                                            <span className="bg-muted px-1.5 py-0.5 rounded border">{m.fromPositionName || 'N/A'}</span>
                                            <ArrowRight className="w-3 h-3 opacity-50" />
                                            <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20">{m.toPositionName || 'N/A'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-xs max-w-[200px] truncate" title={m.reason}>
                                        {m.reason}
                                    </TableCell>
                                    <TableCell className="text-right text-xs font-medium">
                                        {m.username}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {movements.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                                        Nenhuma movimentação registrada no histórico.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
