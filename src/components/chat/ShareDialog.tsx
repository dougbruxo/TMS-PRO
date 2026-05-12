

"use client";

import { useState, useCallback, ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search } from 'lucide-react';
import type { SharedItem, SharedItemType } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { statusToSlug } from '@/lib/utils';
import { authFetch } from '@/lib/api-client';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendSharedItem: (item: SharedItem) => void;
}

interface SearchTabProps {
  type: SharedItemType;
  apiPath: string;
  renderResult: (item: any) => ReactNode;
  buildSharedItem: (item: any) => SharedItem;
  onSendSharedItem: (item: SharedItem) => void;
}

const SearchTab = ({ type, apiPath, renderResult, buildSharedItem, onSendSharedItem }: SearchTabProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    setIsLoading(true);
    try {
      const res = await authFetch(`${apiPath}?term=${encodeURIComponent(searchTerm)}`);
      if (!res.ok) throw new Error(`Falha ao buscar ${type}.`);
      const data = await res.json();
      setResults(data);
      if (data.length === 0) {
        toast({ title: 'Nenhum resultado', description: `Nenhum(a) ${type} encontrado.` });
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <form onSubmit={handleSearch} className="flex gap-2 p-1">
        <Input
          placeholder={`Buscar ${type}...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Button type="submit" disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </form>
      <ScrollArea className="flex-grow mt-4">
        <div className="space-y-2 pr-4">
          {results.map((item) => (
            <div
              key={item.id}
              className="border p-2 rounded-md hover:bg-accent cursor-pointer"
              onClick={() => onSendSharedItem(buildSharedItem(item))}
            >
              {renderResult(item)}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export function ShareDialog({ open, onOpenChange, onSendSharedItem }: ShareDialogProps) {

  const tabs: Omit<SearchTabProps, 'onSendSharedItem'>[] = [
    {
      type: 'cotação',
      apiPath: '/api/quotes/search',
      renderResult: (item: any) => (
        <div><strong>{item.quoteCode}</strong>: {item.remetente} &rarr; {item.cidadeDestino}</div>
      ),
      buildSharedItem: (item: any) => ({
        type: 'cotação',
        id: item.id,
        title: item.quoteCode,
        description: `${item.remetente} para ${item.cidadeDestino}`,
        link: `/operational/status/${statusToSlug(item.status)}?quoteCode=${item.quoteCode}`,
      }),
    },
    {
      type: 'motorista',
      apiPath: '/api/drivers/search',
      renderResult: (item: any) => <div><strong>{item.name}</strong> - CPF: {item.cpf}</div>,
      buildSharedItem: (item: any) => ({
        type: 'motorista',
        id: item.id,
        title: item.name,
        description: `CPF: ${item.cpf} | Placa: ${item.licensePlate || 'N/A'}`,
        link: '/drivers',
      }),
    },
     {
      type: 'veículo',
      apiPath: '/api/fleet/search',
      renderResult: (item: any) => <div><strong>{item.plate}</strong> - {item.brand} {item.model}</div>,
      buildSharedItem: (item: any) => ({
        type: 'veículo',
        id: item.id,
        title: `${item.brand} ${item.model}`,
        description: `Placa: ${item.plate} | Tipo: ${item.type}`,
        link: '/fleet',
      }),
    },
    {
      type: 'cliente',
      apiPath: '/api/customers/search',
      renderResult: (item: any) => <div><strong>{item.razaoSocial}</strong> - {item.cnpj}</div>,
      buildSharedItem: (item: any) => ({
        type: 'cliente',
        id: item.id,
        title: item.razaoSocial,
        description: `CNPJ: ${item.cnpj}`,
        link: '/customers',
      }),
    },
     {
      type: 'proprietário',
      apiPath: '/api/owners/search',
      renderResult: (item: any) => <div><strong>{item.name}</strong> - Doc: {item.document}</div>,
      buildSharedItem: (item: any) => ({
        type: 'proprietário',
        id: item.id,
        title: item.name,
        description: `Documento: ${item.document}`,
        link: '/owners',
      }),
    },
     {
      type: 'talento',
      apiPath: '/api/talents/search',
      renderResult: (item: any) => <div><strong>{item.fullName}</strong> - {item.jobTitle}</div>,
      buildSharedItem: (item: any) => ({
        type: 'talento',
        id: item.id,
        title: item.fullName,
        description: `Cargo: ${item.jobTitle} | CPF: ${item.cpf}`,
        link: '/talents',
      }),
    },
     {
      type: 'fatura',
      apiPath: '/api/billing/search',
      renderResult: (item: any) => <div><strong>{item.invoiceCode || item.quoteCode}</strong> - {item.tomador}</div>,
      buildSharedItem: (item: any) => ({
        type: 'fatura',
        id: item.id,
        title: `Fatura ${item.invoiceCode || item.quoteCode}`,
        description: `Tomador: ${item.tomador} | Valor: ${(item.totalValue || item.valorFinal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
        link: `/financial/billing/${item.billingDueDate.substring(0, 7)}`,
      }),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Compartilhar Item no Chat</DialogTitle>
          <DialogDescription>
            Selecione uma categoria, pesquise pelo item desejado e clique para partilhar.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="cotação" className="flex-grow overflow-hidden flex flex-col">
          <ScrollArea>
            <TabsList>
              {tabs.map(tab => (
                <TabsTrigger key={tab.type} value={tab.type} className="capitalize">{tab.type}</TabsTrigger>
              ))}
            </TabsList>
          </ScrollArea>
          {tabs.map(tab => (
            <TabsContent key={tab.type} value={tab.type} className="flex-grow mt-4 h-full">
              <SearchTab {...tab} onSendSharedItem={onSendSharedItem} />
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
