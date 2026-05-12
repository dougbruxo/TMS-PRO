
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';

// This is a temporary redirect page.
// If a user lands on /app, it will redirect them to the dashboard.
export default function AppPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        if(user.role === 'driver') {
            router.replace('/driver-portal');
        } else {
            router.replace('/dashboard');
        }
      } else {
        router.replace('/');
      }
    }
  }, [user, loading, router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}
