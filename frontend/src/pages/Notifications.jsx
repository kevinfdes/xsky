import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Heart, ArrowsClockwise, ChatTeardrop, UserPlus, Quotes, Seal, Bell } from '@phosphor-icons/react';
import axios from 'axios';
import Layout from '../components/Layout';
import { formatRelativeTime } from '../utils/helpers';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const NOTIF_CFG = {
  like:    { icon: Heart,           color: '#FF6B6B', bg: 'bg-red-50 dark:bg-red-900/20',        label: 'liked your post', weight: 'fill' },
  repost:  { icon: ArrowsClockwise, color: '#A3E6D0', bg: 'bg-[#A3E6D0]/20 dark:bg-[#85D4B9]/10', label: 'reposted your post' },
  reply:   { icon: ChatTeardrop,    color: '#90C2F0', bg: 'bg-[#BDE0FE]/20 dark:bg-[#90C2F0]/10', label: 'replied to your post' },
  follow:  { icon: UserPlus,        color: '#E1D4F9', bg: 'bg-[#E1D4F9]/30 dark:bg-[#B8A3E6]/10', label: 'followed you' },
  quote:   { icon: Quotes,          color: '#B8A3E6', bg: 'bg-[#E1D4F9]/30 dark:bg-[#B8A3E6]/10', label: 'quoted your post' },
  mention: { icon: Bell,            color: '#FAD9A6', bg: 'bg-[#FAD9A6]/20 dark:bg-[#EBBF7E]/10', label: 'mentioned you' },
};

const Notifications = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/notifications`);
      setNotifications(res.data);
      await axios.put(`${API}/notifications/read`);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleNotifClick = (notif) => {
    if (notif.type === 'follow') navigate(`/profile/${notif.from_user?.username}`);
    else if (notif.post_id) navigate(`/post/${notif.post_id}`);
  };

  return (
    <Layout>
      <header className="sticky top-0 z-30 bg-[#FCFBF4]/90 dark:bg-[#0F0F0F]/90 backdrop-blur-md border-b border-[#111111]/10 dark:border-[#333333] px-4 py-3">
        <h1 className="font-['Outfit',sans-serif] font-bold text-xl text-[#111111] dark:text-[#F5F5F5]">Notifications</h1>
      </header>

      {loading ? (
        <div className="flex flex-col">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="border-b border-[#111111]/10 dark:border-[#333333] px-4 py-4 animate-pulse flex gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#111111]/10 dark:bg-[#F5F5F5]/10 flex-shrink-0" />
              <div className="flex-1 space-y-2"><div className="h-3 bg-[#111111]/10 rounded w-1/2" /><div className="h-3 bg-[#111111]/10 rounded w-1/3" /></div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div data-testid="empty-notifications" className="flex flex-col items-center justify-center py-20 text-center px-8">
          <div className="w-16 h-16 rounded-2xl bg-[#E1D4F9]/30 dark:bg-[#B8A3E6]/10 border border-[#111111]/10 dark:border-[#333333] flex items-center justify-center mb-4">
            <Bell size={28} className="text-[#555555] dark:text-[#A0A0A0]" />
          </div>
          <h3 className="font-['Outfit',sans-serif] font-semibold text-[#111111] dark:text-[#F5F5F5] mb-2">No notifications yet</h3>
          <p className="text-sm text-[#555555] dark:text-[#A0A0A0]">When someone likes, replies, quotes, mentions or follows you, it'll show up here.</p>
        </div>
      ) : (
        <div data-testid="notifications-list">
          {notifications.map((notif) => {
            const cfg = NOTIF_CFG[notif.type] || NOTIF_CFG.like;
            const IconComponent = cfg.icon;
            return (
              <button
                key={notif.id}
                data-testid={`notification-${notif.id}`}
                onClick={() => handleNotifClick(notif)}
                className={`w-full flex items-start gap-3 px-4 py-4 border-b border-[#111111]/10 dark:border-[#333333] text-left transition-colors hover:bg-[#111111]/[0.02] dark:hover:bg-[#F5F5F5]/[0.02] ${!notif.read ? 'bg-[#A3E6D0]/10 dark:bg-[#85D4B9]/5' : ''}`}
              >
                <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                  <IconComponent size={18} style={{ color: cfg.color }} weight={cfg.weight || 'regular'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {notif.from_user && (
                      <div className="w-6 h-6 rounded-lg bg-[#E1D4F9] dark:bg-[#B8A3E6]/40 border border-[#111111]/10 dark:border-[#333333] flex items-center justify-center text-[10px] font-bold overflow-hidden flex-shrink-0">
                        {notif.from_user.avatar_url
                          ? <img src={notif.from_user.avatar_url} alt="" className="w-full h-full object-cover" />
                          : notif.from_user.display_name?.slice(0, 2).toUpperCase()
                        }
                      </div>
                    )}
                    <p className="text-sm text-[#111111] dark:text-[#F5F5F5]">
                      <span className="font-semibold">{notif.from_user?.display_name || 'Someone'}</span>
                      {' '}{cfg.label}
                    </p>
                  </div>
                  <p className="text-xs text-[#555555] dark:text-[#A0A0A0] mt-0.5">{formatRelativeTime(notif.created_at)}</p>
                </div>
                {!notif.read && <div className="w-2 h-2 rounded-full bg-[#A3E6D0] dark:bg-[#85D4B9] flex-shrink-0 mt-2" />}
              </button>
            );
          })}
        </div>
      )}
    </Layout>
  );
};

export default Notifications;
