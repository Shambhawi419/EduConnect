'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { IconBack } from '@/components/Icons';

export default function ChatPage() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I'm the EduConnect tutor. What are you stuck on today?" },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    if (!input.trim() || busy) return;
    const nextMessages = [...messages, { role: 'user', content: input.trim() }];
    setMessages(nextMessages);
    const sent = input.trim();
    setInput('');
    setError('');
    setBusy(true);
    try {
      const data = await api.chat(sent, messages);
      setMessages((m) => [...m, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <p className="eyebrow">Tutor</p>
          <h1 className="display sm" style={{ margin: 0 }}>
            Ask anything
          </h1>
        </div>
        <Link href="/" className="circle-btn" title="Back">
          <IconBack />
        </Link>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="panel panel-white panel-flush chat-shell">
        <div className="chat-messages" ref={scrollRef}>
          {messages.map((m, i) => (
            <div key={i} className={`bubble ${m.role}`}>
              {m.content}
            </div>
          ))}
          {busy && <div className="bubble assistant">Thinking…</div>}
        </div>

        <form className="chat-input-row" onSubmit={send}>
          <input
            placeholder="Ask a question about your coursework…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button className="pill-btn" disabled={busy}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
