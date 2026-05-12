
"use client";

import type { Driver, OperationalEvent, DriverPaymentStatus, User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Truck, ShieldCheck, CircleDollarSign, ClipboardCheck, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { useMemo } from 'react';

interface OperationalInfoProps {
  operationalHistory: OperationalEvent[];
  drivers: Driver[];
  isAdmin: boolean;
  quoteId: string;
}

const statusDetails: Record<DriverPaymentStatus, { label: string; color: string; icon: React.ReactNode }> = {
    'pendente': { label: 'Pendente', color: 'bg-yellow-500 hover:bg-yellow-600', icon: <CircleDollarSign className="mr-1 h-3 w-3" /> },
    'parcial': { label: 'Parcial', color: 'bg-orange-500 hover:bg-orange-600', icon: <CircleDollarSign className="mr-1 h-3 w-3" /> },
    'pago': { label: 'Pago', color: 'bg-green-600 hover:bg-green-700', icon: <ClipboardCheck className="mr-1 h-3 w-3" /> },
};


export function OperationalInfo({
  operationalHistory,
  drivers,
  isAdmin,
  quoteId,
}: OperationalInfoProps) {
  const router = useRouter();

  const groupedExpenses = useMemo(() => {
    if (!operationalHistory) return {};
    
    const eventsWithExpenses = operationalHistory.filter(event => event.expense && event.expense > 0 && !!event.driverId);

    const grouped: Record<string, { driver: Driver | undefined; events: OperationalEvent[] }> = {};

    eventsWithExpenses.forEach(event => {
      const driverId = event.driverId!;
      if (!grouped[driverId]) {
        grouped[driverId] = {
          driver: drivers.find(d => d.id === driverId),
          events: []
        };
      }
      grouped[driverId].events.push(event);
    });

    return grouped;
  }, [operationalHistory, drivers]);


  if (!operationalHistory || Object.keys(groupedExpenses).length === 0) {
    return null;
  }
  
  const navigateToExpense = (event: OperationalEvent) => {
    const monthYear = event.timestamp ? format(parseISO(event.timestamp), 'yyyy-MM') : '';
    if (monthYear) {
      router.push(`/financial/expenses/${monthYear}`);
    }
  };
  
  const formatCurrency = (value?: number) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });


  return (
    <div className="space-y-2 mt-2">
      <Separator className="my-2" />
      {Object.entries(groupedExpenses).map(([driverId, { driver, events }]) => {
        if (!driver) return null;

        return (
          <div key={driverId} className="flex justify-between items-center text-xs">
            <span className="flex items-center gap-1.5">
              <Truck className="h-3 w-3" /> {driver.name}
            </span>
            <div className="flex flex-col items-end gap-1">
              {events.map(event => {
                 const paymentStatus = event.driverPaymentStatus || 'pendente';
                 const details = statusDetails[paymentStatus];
                 const pendingValue = (event.expense || 0) - (event.paidValue || 0);

                 return (
                  <TooltipProvider key={event.id}>
                      <Tooltip>
                          <TooltipTrigger asChild>
                              <Button
                                  size="sm"
                                  variant="default"
                                  className={cn('h-6 px-2 text-xs text-white', details.color)}
                                  onClick={() => navigateToExpense(event)}
                              >
                                  {paymentStatus === 'pago' ? <ClipboardCheck className="mr-1 h-3 w-3" /> : <Wallet className="mr-1 h-3 w-3" />}
                                  {paymentStatus === 'pago' ? 'Pago' : formatCurrency(pendingValue)}
                                  {event.consultationNumber && <ShieldCheck className="h-3 w-3 ml-1 text-green-200" />}
                              </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {paymentStatus !== 'pago' && <p>Ir para a Gestão Financeira para pagar.</p>}
                            {event.consultationNumber && <p>Nº Consulta: {event.consultationNumber}</p>}
                            {paymentStatus === 'pago' ? (
                                <p className="font-bold">Total pago: {formatCurrency(event.expense)}</p>
                            ) : (
                                <p className="font-bold">Pendente: {formatCurrency(pendingValue)}</p>
                            )}
                          </TooltipContent>
                      </Tooltip>
                  </TooltipProvider>
                 )
              })}
            </div>
          </div>
        )
      })}
    </div>
  );
}
