'use client';

import { useState, useRef, useEffect } from 'react';
import type { ConversationMessage, ContextDocument } from '@precept/shared';
import { ChatMessage } from './ChatMessage';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Paperclip, X } from 'lucide-react';

interface ChatPanelProps {
  messages: ConversationMessage[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  documents: ContextDocument[];
  onUploadFiles: (files: File[]) => void;
  onRemoveDocument: (index: number) => void;
  isUploading?: boolean;
}

export function ChatPanel({
  messages,
  onSendMessage,
  isLoading,
  disabled,
  documents,
  onUploadFiles,
  onRemoveDocument,
  isUploading,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || disabled) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      onUploadFiles(files);
    }
    // Reset so the same file can be re-selected
    e.target.value = '';
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
      <div className="border-t border-neutral-200 p-4">
        {/* Document chips */}
        {documents.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {documents.map((doc, i) => (
              <span
                key={`${doc.filename}-${i}`}
                className="inline-flex items-center gap-1.5 bg-neutral-100 text-neutral-700 text-xs font-medium px-2.5 py-1 rounded-lg"
              >
                <Paperclip className="h-3 w-3" />
                {doc.filename}
                <button
                  type="button"
                  onClick={() => onRemoveDocument(i)}
                  className="text-neutral-400 hover:text-neutral-600 ml-0.5"
                  aria-label={`Remove ${doc.filename}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.txt,.pdf"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || disabled || isUploading}
            className="shrink-0 text-neutral-400 hover:text-neutral-600"
            aria-label="Attach files"
          >
            <Paperclip className="h-5 w-5" />
          </Button>
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
        </form>
      </div>
    </div>
  );
}
