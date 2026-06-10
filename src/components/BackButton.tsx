"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BackButtonProps {
  /** Se fornecido, utiliza o <Link> do Next.js para fazer o roteamento SPA (melhor SEO e performance) */
  href?: string;
  /** Se fornecido, executa esta função ao clicar no botão */
  onClick?: () => void;
  /** Texto personalizado a ser exibido ao lado do ícone (Padrão: "Voltar") */
  label?: string;
  /** Classes CSS adicionais para customização (Padrão: "mb-6") */
  className?: string;
  /** Variante do botão (Padrão: "ghost") */
  variant?: "ghost" | "outline" | "default" | "secondary" | "link" | "destructive";
}

export function BackButton({
  href,
  onClick,
  label = "Voltar",
  className = "",
  variant = "ghost"
}: BackButtonProps) {
  const router = useRouter();
  const [isAnimating, setIsAnimating] = useState(false);

  const handleBack = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isAnimating) return;

    setIsAnimating(true);

    // Executa a navegação ou onClick após a animação de cinema (380ms)
    setTimeout(() => {
      if (onClick) {
        onClick();
      } else if (href) {
        router.push(href);
      } else {
        router.back();
      }
      setIsAnimating(false);
    }, 380);
  };

  // Injeção de estilo dinâmico e isolado para as animações de cinema
  const styleBlock = (
    <style dangerouslySetInnerHTML={{ __html: `
      @keyframes cinema-ripple {
        0% {
          transform: scale(1);
          opacity: 0.95;
          filter: blur(0px);
          box-shadow: 0 0 0 0px hsla(var(--primary), 0.6);
        }
        50% {
          opacity: 0.65;
        }
        100% {
          transform: scale(2.4);
          opacity: 0;
          filter: blur(8px);
          box-shadow: 0 0 40px 15px hsla(var(--primary), 0);
        }
      }
      @keyframes cinema-pulse-idle {
        0% {
          transform: scale(1);
          opacity: 0.35;
        }
        50% {
          opacity: 0.15;
        }
        100% {
          transform: scale(1.6);
          opacity: 0;
        }
      }
      @keyframes cinema-arrow-fly {
        0% {
          transform: translateX(0) scale(1);
          opacity: 1;
        }
        25% {
          transform: translateX(0.15rem) scale(0.9);
          opacity: 1;
        }
        100% {
          transform: translateX(-3.5rem) scale(0.5);
          opacity: 0;
          filter: blur(4px);
        }
      }
    `}} />
  );

  // Seta estilizada com efeitos especiais dignos de cinema
  const content = (
    <span className="relative flex items-center justify-center w-full h-full group/back-btn rounded-full">
      {styleBlock}
      
      {/* Halo de luz neon interna que brilha suavemente e expande no hover */}
      <span className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary/10 via-purple-500/5 to-pink-500/10 opacity-0 group-hover/back-btn:opacity-100 transition-opacity duration-500 blur-sm pointer-events-none" />
      
      {/* Anel de Pulso Radar sutil contínuo em repouso para convidar ao clique */}
      {!isAnimating && (
        <span 
          className="absolute inset-0 rounded-full bg-primary/15 pointer-events-none"
          style={{ animation: 'cinema-pulse-idle 2.5s infinite cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      )}

      {/* Pulso Neon de Choque Rápido ao Clicar */}
      {isAnimating && (
        <span 
          className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/70 to-purple-500/70 pointer-events-none"
          style={{ animation: 'cinema-ripple 420ms cubic-bezier(0.1, 0.8, 0.3, 1) forwards' }}
        />
      )}

      {/* Ícone ArrowLeft com transição premium de cinema e disparo dinâmico de ejeção */}
      <ArrowLeft 
        className="h-5 w-5 text-primary group-hover/back-btn:text-purple-400 filter drop-shadow-[0_0_8px_hsla(var(--primary),0.6)]" 
        style={isAnimating ? {
          animation: 'cinema-arrow-fly 380ms cubic-bezier(0.4, 0, 0.2, 1) forwards'
        } : {
          transition: 'all 300ms'
        }}
      />
    </span>
  );

  // Classes do botão: Círculo perfeito, bordas neon refinadas, sombras glow dignas de cinema
  const premiumClasses = cn(
    "relative flex items-center justify-center w-11 h-11 rounded-full p-0 border transition-all duration-300",
    "bg-white/50 dark:bg-black/35 backdrop-blur-2xl border-primary/20 text-foreground/80 hover:text-primary",
    "hover:border-primary/45 hover:bg-primary/5 hover:scale-105",
    "hover:shadow-[0_0_20px_hsla(var(--primary),0.25),_inset_0_0_10px_hsla(var(--primary),0.05)]",
    isAnimating 
      ? "scale-90 border-primary/60 shadow-[0_0_30px_hsla(var(--primary),0.45),_inset_0_0_15px_hsla(var(--primary),0.2)]" 
      : "active:scale-85 active:bg-primary/15 active:border-primary/60 active:shadow-[0_0_30px_hsla(var(--primary),0.45),_inset_0_0_15px_hsla(var(--primary),0.2)] active:duration-75",
    className
  );

  // NOTA: Como interceptamos o clique para rodar a animação e o delay, 
  // nós tratamos a navegação programaticamente em todos os casos para garantir a execução do efeito.
  // Mantemos o elemento HTML 'Link' se tiver href para fins de SEO (rastreabilidade de links), 
  // mas prevenimos a ação padrão para disparar a animação de ejeção antes de navegar.
  if (href) {
    return (
      <Button 
        asChild 
        className={premiumClasses} 
        variant={variant} 
        title={label} 
        aria-label={label}
        onClick={handleBack}
      >
        <Link href={href} onClick={(e) => e.preventDefault()}>
          {content}
        </Link>
      </Button>
    );
  }

  // Caso contrário, renderiza como botão interativo comum
  return (
    <Button
      onClick={handleBack}
      className={premiumClasses}
      variant={variant}
      title={label}
      aria-label={label}
    >
      {content}
    </Button>
  );
}
