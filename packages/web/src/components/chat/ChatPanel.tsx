'use client';

import { useState, useRef, useEffect } from 'react';
import type { ConversationMessage, ContextDocument } from '@precept/shared';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (centerRef.current) {
      centerRef.current.scrollTop = centerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || disabled) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      onUploadFiles(files);
    }
    e.target.value = '';
  };

  // Show the latest CEO message prominently, with the preceding owner message above it
  const latestCeoIdx = messages.findLastIndex((m) => m.role === 'ceo');
  const latestCeoMsg = latestCeoIdx >= 0 ? messages[latestCeoIdx] : null;
  const prevOwnerMsg = latestCeoIdx > 0 && messages[latestCeoIdx - 1]?.role === 'owner'
    ? messages[latestCeoIdx - 1]
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="chat-center" ref={centerRef}>
        <div className="chat-content">
          {prevOwnerMsg && (
            <div className="chat-owner-msg">{prevOwnerMsg.content}</div>
          )}

          {latestCeoMsg && (
            <div className="chat-letter">{latestCeoMsg.content}</div>
          )}

          {isLoading && <div className="chat-typing">Thinking...</div>}

          <form onSubmit={handleSubmit}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={disabled ? 'Interview complete' : ''}
              disabled={isLoading || disabled}
              className="chat-textarea"
            />

            {documents.length > 0 && (
              <div className="chat-documents">
                {documents.map((doc, i) => (
                  <span key={`${doc.filename}-${i}`} className="chat-doc-chip">
                    {doc.filename}
                    <button
                      type="button"
                      onClick={() => onRemoveDocument(i)}
                      className="chat-doc-chip-remove"
                      aria-label={`Remove ${doc.filename}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="chat-input-footer">
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".md,.txt,.pdf"
                  multiple
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading || disabled || isUploading}
                  className="chat-attach-btn"
                  aria-label="Attach files"
                >
                  Attach
                </button>
              </div>
              <button
                type="submit"
                disabled={!input.trim() || isLoading || disabled}
                className="chat-send"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
