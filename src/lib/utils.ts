import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Quote, QuoteStatus } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getInitials = (name: string = '') => {
  if (!name) return '';
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

export const getQuoteCode = (quote: Quote) => {
    if (quote.quoteCode) return quote.quoteCode;
    const date = new Date(quote.data);
    return `LEGACY-${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2,'0')}${date.getDate().toString().padStart(2,'0')}`;
};

export const statusToSlug = (status: QuoteStatus): string => {
    switch (status) {
        case 'No Galpão': return 'no-galpao';
        case 'Em Rota': return 'em-rota';
        case 'Entregue': return 'entregue';
        case 'Finalizado': return 'finalizado';
        case 'Coleta':
        case 'Fechada':
        case 'Aguardando Recebimento':
             return 'coleta';
        case 'Em Carregamento': 
        case 'Aguardando Saída':
            return 'no-galpao';
        default: return status.toLowerCase().replace(' ', '-');
    }
}
