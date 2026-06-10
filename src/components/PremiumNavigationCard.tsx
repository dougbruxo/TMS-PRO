"use client";

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PremiumNavigationCardProps {
  /** Título principal do card */
  title: string;
  /** Descrição detalhada sobre o destino */
  description: string;
  /** Link de destino para o roteamento Next.js */
  href: string;
  /** Ícone decorativo em formato ReactNode */
  icon: React.ReactNode;
  /** Texto que acompanha a contagem no badge (ex: "Cargas", "Cotações") */
  badgeText?: string;
  /** Valor numérico ou string a ser exibido no badge principal */
  badgeCount?: number | string;
  /** Variante visual do badge (Padrão: "secondary") */
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  /** Define se o card está em desenvolvimento ou indisponível */
  disabled?: boolean;
  /** Número de notificações ou alertas pendentes para renderizar o PulsingBadge */
  pulsingBadgeCount?: number;
  /** Badges extras customizados a serem exibidos abaixo ou ao lado do título */
  extraBadges?: React.ReactNode;
  /** Classes CSS adicionais para o contêiner do card */
  className?: string;
}

export function PremiumNavigationCard({
  title,
  description,
  href,
  icon,
  badgeText,
  badgeCount,
  badgeVariant = "secondary",
  disabled = false,
  pulsingBadgeCount = 0,
  extraBadges,
  className = ""
}: PremiumNavigationCardProps) {
  
  // Elemento interno do Card que contém todo o layout visual de luxo
  const cardContent = (
    <Card className={cn(
      "flex flex-col w-full h-full border border-border/40 bg-white dark:bg-card shadow-xl transition-all duration-500 relative overflow-hidden group/card rounded-2xl p-5",
      disabled 
        ? "opacity-60 cursor-not-allowed bg-muted/30" 
        : "hover:shadow-primary/15 hover:-translate-y-1.5 hover:border-primary/50 cursor-pointer",
      className
    )}>
      {/* Efeito de revelação de gradiente aurora suave no hover */}
      {!disabled && (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-700 pointer-events-none" />
      )}
      
      {/* Alerta de pulso vermelho para pendências (PulsingBadge) */}
      {!disabled && pulsingBadgeCount > 0 && (
        <Badge className="absolute top-4 right-4 animate-pulse bg-destructive text-destructive-foreground hover:bg-destructive h-6 w-6 justify-center p-0 text-xs font-semibold rounded-full shadow-lg shadow-destructive/20 border border-destructive-foreground/20">
          {pulsingBadgeCount}
        </Badge>
      )}

      {/* Topo do Card: Ícone e Badge Principal de Cargas/Contas */}
      <div className="flex items-center justify-between relative z-10 mb-4 w-full">
        {/* Ícone com caixinha de vidro neon */}
        <div className={cn(
          "p-3 rounded-2xl transition-all duration-500",
          disabled
            ? "bg-muted/50 text-muted-foreground border border-muted"
            : "bg-primary/10 border border-primary/40 text-primary group-hover/card:bg-primary/20 group-hover/card:border-primary/65 group-hover/card:scale-105"
        )}>
          {icon}
        </div>

        {/* Badge da quantidade principal (com fonte premium sans-serif estilizada) */}
        {!disabled && badgeCount !== undefined && (
          <Badge 
            variant="outline" 
            className="font-semibold tracking-wide text-xs px-2.5 py-1 bg-primary/10 text-primary border border-primary/15 hover:bg-primary/20 backdrop-blur-md rounded-lg transition-all duration-300"
          >
            {badgeCount} {badgeText}
          </Badge>
        )}

        {disabled && (
          <Badge 
            variant="outline" 
            className="font-medium text-xs px-2.5 py-1 text-muted-foreground border-muted rounded-lg"
          >
            Em Breve
          </Badge>
        )}
      </div>

      {/* Meio: Título, Descrição e Badges Extras */}
      <div className="flex-grow flex flex-col justify-between relative z-10">
        <div>
          <h3 className={cn(
            "text-lg font-bold tracking-tight mb-2 transition-colors duration-300",
            disabled ? "text-muted-foreground" : "text-primary dark:text-blue-400 group-hover/card:text-blue-700 dark:group-hover/card:text-blue-300"
          )}>
            {title}
          </h3>
          
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        </div>

        {/* Slot para badges de ações extras (como pagamentos pendentes na operacional) */}
        {!disabled && extraBadges && (
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-2 border-t border-border/20">
            {extraBadges}
          </div>
        )}
      </div>
    </Card>
  );

  // Se estiver desativado, retorna o card estático comum sem link
  if (disabled || href === "#") {
    return (
      <div className="flex w-full h-full">
        {cardContent}
      </div>
    );
  }

  // Caso contrário, encapsula com a tag Link do Next.js para navegação SPA limpa
  return (
    <Link href={href} className="flex w-full h-full group">
      {cardContent}
    </Link>
  );
}
