import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, PaperPlaneTilt, ChatCircleDots } from '@phosphor-icons/react';
import axios from 'axios';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { formatRelativeTime } from '../utils/helpers';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DirectMessages = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { convId } = useParams();
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newRecipient, setNewRecipient] = useState('');
  const [showNewDM, setShowNewDM] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (convId && conversations.length > 0) {
      const conv = conversations.find(c => c.id === convId);
      if (conv) openConversation(conv);
    }
  }, [convId, conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/dms`);
      setConversations(res.data);
    } catch {}
    setLoading(false);
  };

  const openConversation = async (conv) => {
    setActiveConv(conv);
    try {
      const res = await axios.get(`${API}/dms/${conv.id}/messages`);
      setMessages(res.data);
      setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c));
    } catch {}
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConv || sending) return;
    setSending(true);
    try {
      const res = await axios.post(`${API}/dms/${activeConv.other_user.username}/send`, {
        content: newMessage.trim(),
      });
      setMessages(prev => [...prev, res.data]);
      setConversations(prev => prev.map(c =>
        c.id === activeConv.id ? { ...c, last_message: newMessage.trim(), last_message_at: new Date().toISOString() } : c
      ));
      setNewMessage('');
    } catch {}
    setSending(false);
  };

  const startNewDM = async (e) => {
    e.preventDefault();
    if (!newRecipient.trim()) return;
    try {
      await axios.post(`${API}/dms/${newRecipient.trim()}/send`, { content: 'Hi! 👋' });
      setShowNewDM(false);
      setNewRecipient('');
      await fetchConversations();
    } catch (err) {
      alert(err?.response?.data?.detail || 'User not found');
    }
  };

  return (
    <Layout>
      <header className="sticky top-0 z-30 bg-[#FCFBF4]/90 dark:bg-[#0F0F0F]/90 backdrop-blur-md border-b border-[#111111]/10 dark:border-[#333333] px-4 py-3 flex items-center gap-3">
        {activeConv ? (
          <>
            <button onClick={() => setActiveConv(null)} className="p-2 rounded-xl hover:bg-[#111111]/10 dark:hover:bg-[#F5F5F5]/10 text-[#111111] dark:text-[#F5F5F5] transition-colors md:hidden">
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#E1D4F9] dark:bg-[#B8A3E6]/40 flex items-center justify-center text-xs font-bold overflow-hidden border border-[#111111]/10 dark:border-[#333333]">
                {activeConv.other_user?.avatar_url
                  ? <img src={activeConv.other_user.avatar_url} alt="" className="w-full h-full object-cover" />
                  : activeConv.other_user?.display_name?.slice(0, 2).toUpperCase()
                }
              </div>
              <div>
                <p className="font-['Outfit',sans-serif] font-semibold text-sm text-[#111111] dark:text-[#F5F5F5]">{activeConv.other_user?.display_name}</p>
                <p className="text-xs text-[#555555] dark:text-[#A0A0A0]">@{activeConv.other_user?.username}</p>
              </div>
            </div>
          </>
        ) : (
          <>
            <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-[#111111]/10 dark:hover:bg-[#F5F5F5]/10 text-[#111111] dark:text-[#F5F5F5] transition-colors">
              <ArrowLeft size={20} />
            </button>
            <h1 className="font-['Outfit',sans-serif] font-bold text-xl text-[#111111] dark:text-[#F5F5F5] flex-1">Messages</h1>
            <button
              data-testid="new-dm-btn"
              onClick={() => setShowNewDM(!showNewDM)}
              className="px-3 py-1.5 bg-[#A3E6D0] dark:bg-[#85D4B9] text-[#111111] text-xs font-semibold rounded-xl border border-[#111111]/20 dark:border-transparent neo-shadow-sm transition-all"
            >
              New
            </button>
          </>
        )}
      </header>

      {/* New DM form */}
      {showNewDM && !activeConv && (
        <form onSubmit={startNewDM} className="px-4 py-3 border-b border-[#111111]/10 dark:border-[#333333] flex gap-2">
          <input
            data-testid="new-dm-username"
            value={newRecipient}
            onChange={e => setNewRecipient(e.target.value)}
            placeholder="Enter @username..."
            className="flex-1 px-3 py-2 bg-white dark:bg-[#1A1A1A] border border-[#111111]/20 dark:border-[#333333] rounded-xl text-sm text-[#111111] dark:text-[#F5F5F5] focus:outline-none focus:border-[#A3E6D0]"
          />
          <button type="submit" className="px-4 py-2 bg-[#111111] dark:bg-[#F5F5F5] text-[#F5F5F5] dark:text-[#111111] text-sm font-semibold rounded-xl">
            Start
          </button>
        </form>
      )}

      {activeConv ? (
        /* Messages view */
        <div className="flex flex-col h-[calc(100vh-120px)]">
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 ? (
              <p className="text-center text-sm text-[#555555] dark:text-[#A0A0A0] py-8">No messages yet. Say hello!</p>
            ) : (
              messages.map(msg => {
                const isMe = msg.sender_id === user?.id;
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div
                      data-testid={`message-${msg.id}`}
                      className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        isMe
                          ? 'bg-[#A3E6D0] dark:bg-[#85D4B9] text-[#111111] rounded-br-sm'
                          : 'bg-white dark:bg-[#1A1A1A] text-[#111111] dark:text-[#F5F5F5] border border-[#111111]/10 dark:border-[#333333] rounded-bl-sm'
                      }`}
                    >
                      {msg.content}
                      <p className={`text-[10px] mt-1 ${isMe ? 'text-[#111111]/50' : 'text-[#555555] dark:text-[#A0A0A0]'}`}>
                        {formatRelativeTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message input */}
          <form onSubmit={sendMessage} className="px-4 py-3 border-t border-[#111111]/10 dark:border-[#333333] flex gap-2">
            <input
              data-testid="message-input"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder={`Message @${activeConv.other_user?.username}...`}
              className="flex-1 px-4 py-2.5 bg-white dark:bg-[#1A1A1A] border border-[#111111]/20 dark:border-[#333333] rounded-xl text-sm text-[#111111] dark:text-[#F5F5F5] focus:outline-none focus:border-[#A3E6D0] dark:focus:border-[#85D4B9]"
            />
            <button
              data-testid="send-message-btn"
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="p-2.5 bg-[#A3E6D0] dark:bg-[#85D4B9] text-[#111111] rounded-xl border border-[#111111]/20 dark:border-transparent transition-all disabled:opacity-40"
            >
              <PaperPlaneTilt size={18} weight="fill" />
            </button>
          </form>
        </div>
      ) : (
        /* Conversations list */
        loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin w-6 h-6 border-2 border-[#A3E6D0] border-t-transparent rounded-full" />
          </div>
        ) : conversations.length === 0 ? (
          <div data-testid="empty-dms" className="flex flex-col items-center py-20 text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-[#BDE0FE]/30 dark:bg-[#90C2F0]/10 border border-[#111111]/10 dark:border-[#333333] flex items-center justify-center mb-4">
              <ChatCircleDots size={28} className="text-[#555555] dark:text-[#A0A0A0]" />
            </div>
            <h3 className="font-['Outfit',sans-serif] font-semibold text-[#111111] dark:text-[#F5F5F5] mb-2">No messages yet</h3>
            <p className="text-sm text-[#555555] dark:text-[#A0A0A0]">Start a conversation with someone you follow.</p>
          </div>
        ) : (
          <div data-testid="conversations-list">
            {conversations.map(conv => (
              <button
                key={conv.id}
                data-testid={`conversation-${conv.id}`}
                onClick={() => openConversation(conv)}
                className="w-full flex items-center gap-3 px-4 py-4 border-b border-[#111111]/10 dark:border-[#333333] hover:bg-[#111111]/[0.02] dark:hover:bg-[#F5F5F5]/[0.02] transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-[#E1D4F9] dark:bg-[#B8A3E6]/40 border border-[#111111]/10 dark:border-[#333333] flex items-center justify-center text-sm font-bold overflow-hidden flex-shrink-0">
                  {conv.other_user?.avatar_url
                    ? <img src={conv.other_user.avatar_url} alt="" className="w-full h-full object-cover" />
                    : conv.other_user?.display_name?.slice(0, 2).toUpperCase()
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm text-[#111111] dark:text-[#F5F5F5] truncate">{conv.other_user?.display_name}</p>
                    <span className="text-xs text-[#555555] dark:text-[#A0A0A0] flex-shrink-0 ml-2">{formatRelativeTime(conv.last_message_at)}</span>
                  </div>
                  <p className="text-xs text-[#555555] dark:text-[#A0A0A0] truncate">{conv.last_message}</p>
                </div>
                {conv.unread_count > 0 && (
                  <div className="w-5 h-5 rounded-full bg-[#A3E6D0] dark:bg-[#85D4B9] flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-[#111111]">{conv.unread_count}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )
      )}
    </Layout>
  );
};

export default DirectMessages;
