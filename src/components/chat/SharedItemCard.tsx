

"use client";

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import type { SharedItem } from '@/lib/types';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

interface SharedItemCardProps {
  item: SharedItem;
}

export function SharedItemCard({ item }: SharedItemCardProps) {
  return (
    <Card className="max-w-sm bg-background">
      <CardHeader className="pb-2 p-4">
        <CardDescription className="capitalize">{item.type}</CardDescription>
        <CardTitle className="text-base">{item.title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="text-sm text-muted-foreground">{item.description}</p>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Link href={item.link} passHref legacyBehavior>
          <a className="w-full">
            <Button className="w-full">
              Ver Item <ArrowUpRight className="ml-2 h-4 w-4" />
            </Button>
          </a>
        </Link>
      </CardFooter>
    </Card>
  );
}
