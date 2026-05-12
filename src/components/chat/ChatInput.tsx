"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader2, Smile, Paperclip } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { SharedItem } from '@/lib/types';
import { ShareDialog } from './ShareDialog';

interface ChatInputProps {
  onSendMessage: (message: { text?: string; sharedItem?: SharedItem }) => void;
  isSending: boolean;
}

const commonEmojis = [
  '😊', '😂', '❤️', '👍', '🙏', '🎉', '😢', '🤔',
  '🔥', '🚀', '👀', '✨', '😉', '😍', '😎', '😭',
  '😠', '😴', '🥳', '👏', '👌', '✌️', '🤞', '🙌',
  '💻', '📱', '💡', '💰', '☕️', '🍕', '✈️', '🚗',
  '🚚', '📦', '🗺️', '🚢', '⛽', '🚥', '🛣️', '🚧',
  '✅', '❌', '⚠️', '➡️', '⬅️', '⬆️', '⬇️', '🕒',
];

export function ChatInput({ onSendMessage, isSending }: ChatInputProps) {
  const [text, setText] = useState('');
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isSending) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isSending]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onSendMessage({ text });
      setText('');
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setText(prev => prev + emoji);
    inputRef.current?.focus();
  };

  const handleSendSharedItem = (item: SharedItem) => {
    onSendMessage({ sharedItem: item });
    setIsShareDialogOpen(false);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="p-2 border-t border-border flex items-center gap-1 bg-background">
          <Popover>
              <PopoverTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" disabled={isSending}>
                      <Smile className="h-5 w-5" />
                  </Button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-auto p-2">
                  <div className="grid grid-cols-8 gap-1">
                      {commonEmojis.map(emoji => (
                          <Button
                              key={emoji}
                              variant="ghost"
                              size="icon"
                              className="text-xl"
                              onClick={() => handleEmojiSelect(emoji)}
                          >
                              {emoji}
                          </Button>
                      ))}
                  </div>
              </PopoverContent>
          </Popover>
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setIsShareDialogOpen(true)} disabled={isSending}>
            <Paperclip className="h-5 w-5" />
          </Button>
        <Input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Digite uma mensagem..."
          autoComplete="off"
          disabled={isSending}
          className="h-9"
          onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                  handleSubmit(e);
              }
          }}
        />
        <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={isSending || !text.trim()}>
          {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </Button>
      </form>
      <ShareDialog 
        open={isShareDialogOpen}
        onOpenChange={setIsShareDialogOpen}
        onSendSharedItem={handleSendSharedItem}
      />
    </>
  );
}
