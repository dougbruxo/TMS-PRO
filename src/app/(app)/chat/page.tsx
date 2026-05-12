
"use client";

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { ChatPageClient } from '@/components/chat/ChatPageClient';

function ChatPage() {
    return (
        // Define a height for the chat container to fill the screen below the header
        <div className="h-[calc(100vh_-_6rem)] p-4">
            <ChatPageClient />
        </div>
    );
}

export default function ChatPageWrapper() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <ChatPage />
    </Suspense>
  );
}
