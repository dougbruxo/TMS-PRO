
"use client";

import { useAuth } from '@/hooks/use-auth';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { printLoadingManifest } from '@/lib/print';
import { format, parseISO } from 'date-fns';
import type { Manifest } from '@/lib/types';
import { Printer, Package } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';

interface ManifestListProps {
  title: string;
  manifests: Manifest[];
  emptyMessage: string;
  actionButton?: (quote: Manifest['quotes'][0], manifest: Manifest) => React.ReactNode;
  footerButton?: (manifest: Manifest) => React.ReactNode;
  showPrintButton?: boolean;
}

export function ManifestList({ title, manifests, emptyMessage, actionButton, footerButton, showPrintButton = true }: ManifestListProps) {
  const { companyProfile } = useAuth();

  return (
     <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            Acompanhe aqui os seus romaneios.
          </CardDescription>
        </CardHeader>
        <CardContent>
            {manifests.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-8">{emptyMessage}</p>
            ) : (
                <Accordion type="single" collapsible className="w-full">
                {manifests.map((manifest) => (
                    <AccordionItem value={manifest.id} key={manifest.id}>
                    <AccordionTrigger>
                        <div className="flex flex-col items-start text-left">
                        <p className="font-semibold">{manifest.manifestCode}</p>
                        <p className="text-sm text-muted-foreground">
                            {format(parseISO(manifest.createdAt), 'dd/MM/yyyy')} - {manifest.quotes.length} entregas
                        </p>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <div className="space-y-3 pl-2">
                        {manifest.quotes.map(quote => (
                            <div key={quote.quoteId} className="flex flex-col p-3 border rounded-md">
                                <div className='flex justify-between items-start'>
                                    <div>
                                        <p className="font-semibold">{quote.destinatario}</p>
                                        <p className="text-sm text-muted-foreground">{quote.cidadeDestino}</p>
                                    </div>
                                    {actionButton && <div className="ml-4 shrink-0">{actionButton(quote, manifest)}</div>}
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    <Badge variant="secondary"><Package className="h-3 w-3 mr-1" /> {quote.totalVolumes} vol.</Badge>
                                    <Badge variant="outline">NF: {quote.nfNumber}</Badge>
                                </div>
                            </div>
                        ))}
                        {showPrintButton && (
                            <div className="pt-4">
                                <Button onClick={() => printLoadingManifest(manifest, companyProfile)} size="sm">
                                <Printer className="mr-2 h-4 w-4" />
                                Imprimir Romaneio
                                </Button>
                            </div>
                        )}
                        {footerButton && <div className="pt-4">{footerButton(manifest)}</div>}
                        </div>
                    </AccordionContent>
                    </AccordionItem>
                ))}
                </Accordion>
            )}
        </CardContent>
      </Card>
  );
};
