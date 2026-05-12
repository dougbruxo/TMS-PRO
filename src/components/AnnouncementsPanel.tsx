
"use client";

import { useState, useEffect, useMemo } from 'react';
import type { ChatAnnouncement } from '@/lib/types';
import { Megaphone, Pin } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AnnouncementsPanelProps {
  announcements: ChatAnnouncement[];
}

export function AnnouncementsPanel({ announcements }: AnnouncementsPanelProps) {
  const pinnedAnnouncement = useMemo(() => announcements.find(a => a.pinned), [announcements]);
  const otherAnnouncements = useMemo(() => announcements.filter(a => !a.pinned), [announcements]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (otherAnnouncements.length === 0) {
      setIsVisible(false);
      return;
    }

    const cycle = () => {
      setIsVisible(true);
      const currentAnnouncement = otherAnnouncements[currentIndex];
      const durationInMs = (currentAnnouncement?.duration || 7) * 1000;

      const hideTimer = setTimeout(() => {
        setIsVisible(false);
      }, durationInMs - 500);

      const switchTimer = setTimeout(() => {
        setCurrentIndex(prevIndex => (prevIndex + 1) % otherAnnouncements.length);
      }, durationInMs);

      return () => {
        clearTimeout(hideTimer);
        clearTimeout(switchTimer);
      };
    };

    const timer = cycle();
    return timer;
  }, [currentIndex, otherAnnouncements]);

  const currentTemporaryAnnouncement = otherAnnouncements.length > 0 ? otherAnnouncements[currentIndex] : null;

  const CountdownCircle = ({ duration }: { duration: number }) => (
    <div className="absolute -top-1 -right-1 w-6 h-6">
      <svg className="w-full h-full" viewBox="0 0 36 36">
        <path
          className="stroke-muted"
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          strokeWidth="4"
        />
        <path
          className="stroke-primary"
          style={{ animation: `countdown ${duration}s linear` }}
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          strokeWidth="4"
          strokeDasharray="100, 100"
        />
      </svg>
      <style jsx>{`
        @keyframes countdown {
          from {
            stroke-dashoffset: 0;
          }
          to {
            stroke-dashoffset: 100;
          }
        }
      `}</style>
    </div>
  );

  const PinnedComponent = () => (
    <div className="bg-accent/20 border-l-4 border-accent text-accent-foreground p-4 rounded-r-lg shadow-sm">
      <div className="flex items-start gap-4">
        <Pin className="h-6 w-6 shrink-0 mt-0.5 text-accent" />
        <div className="flex-grow">
          <p className="font-bold text-base">AVISO FIXADO</p>
          <p className="text-sm">{pinnedAnnouncement!.text}</p>
        </div>
      </div>
    </div>
  );

  const TemporaryComponent = () => (
    <div 
        key={currentTemporaryAnnouncement!.id} 
        className="bg-card border p-4 rounded-lg shadow-sm relative overflow-hidden animate-fade-in"
    >
      <CountdownCircle duration={currentTemporaryAnnouncement!.duration || 7} />
      <div className="flex items-start gap-4">
        <Megaphone className="h-6 w-6 shrink-0 mt-0.5 text-primary" />
        <div className="flex-grow">
            <p className="text-sm">{currentTemporaryAnnouncement!.text}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Postado {formatDistanceToNow(new Date(currentTemporaryAnnouncement!.timestamp), { addSuffix: true, locale: ptBR })} por {currentTemporaryAnnouncement!.authorUsername}
            </p>
        </div>
      </div>
    </div>
  );

  if (!pinnedAnnouncement && (!currentTemporaryAnnouncement || !isVisible)) {
    return null;
  }
  
  return (
    <div className="mb-8 space-y-4">
        {pinnedAnnouncement && <PinnedComponent />}
        {currentTemporaryAnnouncement && isVisible && <TemporaryComponent />}
    </div>
  );
}
