
"use client";

import { useMemo } from 'react';
import type { ChatAnnouncement } from '@/lib/types';
import { Megaphone, Pin } from 'lucide-react';

interface ChatAnnouncementsProps {
  announcements: ChatAnnouncement[];
}

export function ChatAnnouncements({ announcements }: ChatAnnouncementsProps) {
  const pinnedAnnouncement = useMemo(() => announcements.find(a => a.pinned), [announcements]);

  if (!pinnedAnnouncement) {
    return null;
  }

  return (
    <div className="bg-accent text-accent-foreground p-2 text-sm flex items-center gap-3">
      <Pin className="h-5 w-5 shrink-0" />
      <p className="flex-grow">
        <span className="font-semibold">AVISO FIXADO:</span> {pinnedAnnouncement.text}
      </p>
    </div>
  );
}
