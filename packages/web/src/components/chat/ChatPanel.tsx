'use client';

import { useState, useRef, useEffect } from 'react';
import type { ConversationMessage } from '@precept/shared';
import { ChatMessage } from './ChatMessage';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ChatPanelProps {
  messages: ConversationMessage[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function ChatPanel({ messages, onSendMessage, isLoading, disabled }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || disabled) return;
    onSendMessage(input.trim());
    setInput('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6">
        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}
        {isLoading && (
          <div className="flex justify-start mb-4">
            <div className="bg-neutral-100 rounded-2xl px-4 py-3">
              <p className="text-sm text-neutral-400">Thinking...</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-neutral-200 p-4">
        <div className="flex gap-3">
          <Input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={disabled ? 'Interview complete' : 'Type your message...'}
            disabled={isLoading || disabled}
            className="flex-1 rounded-xl px-4 py-3 h-auto"
          />
          <Button
            type="submit"
            disabled={!input.trim() || isLoading || disabled}
            size="lg"
            className="rounded-xl px-6"
          >
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}
