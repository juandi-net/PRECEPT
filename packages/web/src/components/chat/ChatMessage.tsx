import type { ConversationMessage } from '@precept/shared';

interface ChatMessageProps {
  message: ConversationMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isOwner = message.role === 'owner';

  return (
    <div className={`chat-message ${isOwner ? 'chat-message--owner' : ''}`}>
      <div className="chat-message-role">{isOwner ? 'You' : 'CEO'}</div>
      <div className="chat-message-content">{message.content}</div>
    </div>
  );
}
