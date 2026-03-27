import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlass, TrendUp } from '@phosphor-icons/react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const RightSidebar = () => {
  const navigate = useNavigate();
  const [trending, setTrending] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [searchQ, setSearchQ] = useState('');

  useEffect(() => {
    fetchTrending();
    fetchSuggestions();
  }, []);

  const fetchTrending = async () => {
    try {
      const res = await axios.get(`${API}/explore/trending`);
      setTrending(res.data.slice(0, 8));
    } catch {}
  };

  const fetchSuggestions = async () => {
    try {
      const res = await axios.get(`${API}/users/suggestions`);
      setSuggestions(res.data.slice(0, 4));
    } catch {}
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQ.trim()) navigate(`/explore?q=${encodeURIComponent(searchQ.trim())}`);
  };

  const handleFollow = async (username) => {
    try {
      await axios.post(`${API}/users/${username}/follow`);
      setSuggestions(prev => prev.filter(u => u.username !== username));
    } catch {}
  };

  return (
    <div className="sticky top-0 h-screen overflow-y-auto py-6 px-4 space-y-5">
      {/* Search */}
      <form onSubmit={handleSearch} className="relative">
        <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555555] dark:text-[#A0A0A0]" />
        <input
          data-testid="search-input-sidebar"
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
          placeholder="Search Agora..."
          className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-[#1A1A1A] border border-[#111111]/20 dark:border-[#333333] rounded-xl text-sm text-[#111111] dark:text-[#F5F5F5] placeholder-[#555555] dark:placeholder-[#A0A0A0] focus:outline-none focus:border-[#A3E6D0] dark:focus:border-[#85D4B9] transition-colors"
        />
      </form>

      {/* Trending */}
      {trending.length > 0 && (
        <div className="bg-white dark:bg-[#1A1A1A] border border-[#111111]/10 dark:border-[#333333] rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#111111]/10 dark:border-[#333333] flex items-center gap-2">
            <TrendUp size={16} className="text-[#A3E6D0] dark:text-[#85D4B9]" weight="bold" />
            <h3 className="font-['Outfit',sans-serif] font-semibold text-sm text-[#111111] dark:text-[#F5F5F5]">
              Trending
            </h3>
          </div>
          <div className="divide-y divide-[#111111]/5 dark:divide-[#333333]">
            {trending.map((t, i) => (
              <button
                key={t.tag}
                data-testid={`trending-tag-${t.tag}`}
                onClick={() => navigate(`/explore?q=${encodeURIComponent(t.tag)}`)}
                className="w-full px-4 py-3 text-left hover:bg-[#FCFBF4] dark:hover:bg-[#111111] transition-colors group"
              >
                <p className="text-xs text-[#555555] dark:text-[#A0A0A0]">#{i + 1} Trending</p>
                <p className="font-semibold text-sm text-[#111111] dark:text-[#F5F5F5] group-hover:text-[#A3E6D0] dark:group-hover:text-[#85D4B9] transition-colors">
                  #{t.tag}
                </p>
                <p className="text-xs text-[#555555] dark:text-[#A0A0A0]">{t.count} posts</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Who to Follow */}
      {suggestions.length > 0 && (
        <div className="bg-white dark:bg-[#1A1A1A] border border-[#111111]/10 dark:border-[#333333] rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#111111]/10 dark:border-[#333333]">
            <h3 className="font-['Outfit',sans-serif] font-semibold text-sm text-[#111111] dark:text-[#F5F5F5]">
              Who to Follow
            </h3>
          </div>
          <div className="divide-y divide-[#111111]/5 dark:divide-[#333333]">
            {suggestions.map(user => (
              <div key={user.id} className="px-4 py-3 flex items-center gap-3">
                <button
                  onClick={() => navigate(`/profile/${user.username}`)}
                  className="flex items-center gap-3 flex-1 min-w-0"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#E1D4F9] dark:bg-[#B8A3E6]/40 border border-[#111111]/10 dark:border-[#333333] flex items-center justify-center text-xs font-bold text-[#111111] dark:text-[#F5F5F5] overflow-hidden flex-shrink-0">
                    {user.avatar_url
                      ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                      : user.display_name?.slice(0, 2).toUpperCase()
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#111111] dark:text-[#F5F5F5] truncate">{user.display_name}</p>
                    <p className="text-xs text-[#555555] dark:text-[#A0A0A0] truncate">@{user.username}</p>
                  </div>
                </button>
                <button
                  data-testid={`follow-btn-${user.username}`}
                  onClick={() => handleFollow(user.username)}
                  className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 bg-[#111111] dark:bg-[#F5F5F5] text-[#F5F5F5] dark:text-[#111111] rounded-lg border border-[#111111] dark:border-[#F5F5F5] hover:bg-[#A3E6D0] hover:text-[#111111] dark:hover:bg-[#85D4B9] dark:hover:border-[#85D4B9] dark:hover:text-[#111111] transition-all duration-150"
                >
                  Follow
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-[#555555]/60 dark:text-[#A0A0A0]/50 px-1">
        © 2026 Agora · Made with care
      </p>
    </div>
  );
};

export default RightSidebar;
