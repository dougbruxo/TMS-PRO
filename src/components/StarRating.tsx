
"use client";

import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: number;
  className?: string;
}

export function StarRating({ value, onChange, readonly = false, size = 20, className }: StarRatingProps) {
  const [hover, setHover] = useState(0);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          className={cn(
            "transition-colors",
            readonly ? "cursor-default" : "cursor-pointer hover:scale-110",
            (hover || value) >= star ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground fill-none"
          )}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
          onClick={() => !readonly && onChange?.(star)}
        >
          <Star size={size} />
        </button>
      ))}
      {readonly && value > 0 && (
        <span className="text-xs font-semibold ml-1">{value.toFixed(1)}</span>
      )}
    </div>
  );
}
