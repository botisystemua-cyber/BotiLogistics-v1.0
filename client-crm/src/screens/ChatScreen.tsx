import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { chatMessages as initialMessages } from '../data/mock';
import type { ChatMessage } from '../types';

interface Props {
  onClearBadge: () => void;
}

export default function ChatScreen({ onClearBadge }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onClearBadge();
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, onClearBadge]);

  const handleSend = () => {
    if (!text.trim()) return;
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    setMessages(prev => [...prev, { id: Date.now(), sender: 'user', text: text.trim(), time }]);
    setText('');
  };

  return (
    <div className="animate-fade-in flex flex-col h-[calc(100vh-4rem)] md:h-screen">
      <div className="bg-navy px-4 pt-6 pb-4 rounded-b-3xl md:rounded-none md:px-10 md:pt-8 md:pb-5 shrink-0">
        <h1 className="text-xl md:text-2xl font-bold text-white">Чат з менеджером</h1>
        <div className="flex items-center gap-2 mt-1">
          <span className="w-2 h-2 bg-status-confirmed rounded-full" />
          <span className="text-blue-200/60 text-xs">Онлайн</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] md:max-w-[60%] rounded-2xl px-4 py-2.5 ${
              msg.sender === 'user'
                ? 'bg-accent text-white rounded-br-md'
                : 'bg-white text-gray-800 rounded-bl-md shadow-sm'
            }`}>
              {msg.sender === 'manager' && (
                <p className="text-[10px] font-semibold text-accent mb-0.5">Менеджер</p>
              )}
              <p className="text-sm leading-relaxed">{msg.text}</p>
              <p className={`text-[10px] mt-1 text-right ${msg.sender === 'user' ? 'text-white/60' : 'text-gray-400'}`}>
                {msg.time}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-200 shrink-0 md:px-10">
        <div className="flex gap-2 md:max-w-3xl md:mx-auto">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Написати повідомлення..."
            className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-accent transition"
          />
          <button
            onClick={handleSend}
            className="w-11 h-11 bg-accent rounded-xl flex items-center justify-center text-white active:scale-90 transition-transform shrink-0"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
