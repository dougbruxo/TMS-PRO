"use client";

import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';
import { LocationTracker } from '@/components/driver/LocationTracker';

function DriverPortalLayout({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();

    if (loading || !user) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    return (
        <div className="flex flex-col min-h-screen bg-muted/40">
            <main className="flex-grow container mx-auto max-w-4xl p-0 sm:p-4">
                {children}
            </main>
            <LocationTracker />
        </div>
    );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <DriverPortalLayout>
        {children}
    </DriverPortalLayout>
  );
}
