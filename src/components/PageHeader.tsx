"use client";

import React from 'react';
import { BackButton } from './BackButton';

interface PageHeaderProps {
    /** Icon to display in the badge pill */
    icon: React.ReactNode;
    /** Badge label (e.g. "Monitor de Recepção") */
    badge: string;
    /** First part of the title (plain text) */
    titlePrefix: string;
    /** Highlighted part of the title (gradient text) */
    titleHighlight: string;
    /** Description text below the title */
    description: string;
    /** Optional children rendered below the description (e.g. search bars, buttons) */
    children?: React.ReactNode;
    /** Optional action buttons rendered to the right of the header */
    actions?: React.ReactNode;
    /** Optional URL to navigate back to */
    backHref?: string;
    /** Optional label for the back button */
    backLabel?: string;
}

export function PageHeader({ icon, badge, titlePrefix, titleHighlight, description, children, actions, backHref, backLabel }: PageHeaderProps) {
    return (
        <div className="relative isolate mb-8">
            <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80 pointer-events-none page-header-decor">
                <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-primary via-primary/50 to-purple-500/30 opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
            </div>
            
            <div className="flex justify-between items-start flex-wrap gap-4">
                <div className="space-y-4">
                    {/* Etiqueta (badge) removida a pedido do usuário para um visual mais clean */}
                    
                    <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl text-foreground">
                        {titlePrefix}{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/60">
                            {titleHighlight}
                        </span>
                    </h1>
                    <p className="text-xl text-muted-foreground max-w-2xl">
                        {description}
                    </p>
                </div>
                
                {/* Lado direito do cabeçalho: botões de ação e o botão Voltar cinematográfico no canto direito */}
                <div className="flex items-center gap-3 shrink-0 self-start mt-2">
                    {actions}
                    {backHref && (
                        <BackButton href={backHref} label={backLabel} className="mb-0" />
                    )}
                </div>
            </div>

            {children && (
                <div className="mt-8">
                    {children}
                </div>
            )}
        </div>
    );
}
