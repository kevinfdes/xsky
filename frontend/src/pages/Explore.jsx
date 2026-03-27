import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MagnifyingGlass, TrendUp, User } from '@phosphor-icons/react';
import axios from 'axios';
import Layout from '../components/Layout';
import PostCard from '../components/PostCard';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Explore = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQ);
  const [searchResults, setSearchResults] = useState(null);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTrending();
  }, []);

  useEffect(() => {
    const q = searchParams.get('q') || '';
    setQuery(q);
    if (q) search(q);
    else setSearchResults(null);
  }, [searchParams]);

  const fetchTrending = async () => {
    try {
      const res = await axios.get(`${API}/explore/trending`);
      setTrending(res.data);
    } catch {}
  };

  const search = useCallback(async (q) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/explore/search`, { params: { q } });
      setSearchResults(res.data);
    } catch {}
    setLoading(false);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      setSearchParams({ q: query.trim() });
    }
  };

  const handleTagClick = (tag) => {
    setQuery(tag);
    setSearchParams({ q: tag });
  };

  const handleFollow = async (username) => {
    try {
      await axios.post(`${API}/users/${username}/follow`);
      setSearchResults(prev => ({
        ...prev,
        users: prev.users.map(u =>
          u.username === username ? { ...u, is_following: !u.is_following } : u
        ),
      }));
    } catch {}
  };

  return (
    <Layout>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#FCFBF4]/90 dark:bg-[#0F0F0F]/90 backdrop-blur-md border-b border-[#111111]/10 dark:border-[#333333] px-4 py-3">
        <h1 className="font-['Outfit',sans-serif] font-bold text-xl text-[#111111] dark:text-[#F5F5F5] mb-3">
          Explore
        </h1>
        <form onSubmit={handleSearch} className="relative">
          <MagnifyingGlass
            size={17}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#555555] dark:text-[#A0A0A0]"
          />
          <input
            data-testid="search-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search posts, people, hashtags..."
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-[#1A1A1A] border border-[#111111]/20 dark:border-[#333333] rounded-xl text-sm text-[#111111] dark:text-[#F5F5F5] placeholder-[#555555]/60 dark:placeholder-[#A0A0A0]/60 focus:outline-none focus:border-[#A3E6D0] dark:focus:border-[#85D4B9] transition-colors"
          />
        </form>
      </header>

      {/* Results or Trending */}
      {searchResults ? (
        <div>
          {/* Users */}
          {searchResults.users && searchResults.users.length > 0 && (
            <div className="border-b border-[#111111]/10 dark:border-[#333333]">
              <h3 className="px-4 py-3 font-['Outfit',sans-serif] font-semibold text-sm text-[#555555] dark:text-[#A0A0A0] uppercase tracking-wider">
                People
              </h3>
              {searchResults.users.map(user => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 px-4 py-3 border-b border-[#111111]/5 dark:border-[#333333]/50 hover:bg-[#111111]/[0.02] dark:hover:bg-[#F5F5F5]/[0.02] transition-colors"
                >
                  <button
                    onClick={() => navigate(`/profile/${user.username}`)}
                    className="flex items-center gap-3 flex-1 min-w-0"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#E1D4F9] dark:bg-[#B8A3E6]/40 border border-[#111111]/10 dark:border-[#333333] flex items-center justify-center text-sm font-bold text-[#111111] dark:text-[#F5F5F5] overflow-hidden flex-shrink-0">
                      {user.avatar_url
                        ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                        : user.display_name?.slice(0, 2).toUpperCase()
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-[#111111] dark:text-[#F5F5F5] truncate">{user.display_name}</p>
                      <p className="text-xs text-[#555555] dark:text-[#A0A0A0] truncate">@{user.username}</p>
                    </div>
                  </button>
                  <button
                    data-testid={`search-follow-btn-${user.username}`}
                    onClick={() => handleFollow(user.username)}
                    className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 bg-[#111111] dark:bg-[#F5F5F5] text-[#F5F5F5] dark:text-[#111111] rounded-lg border border-[#111111] dark:border-[#F5F5F5] hover:bg-[#A3E6D0] hover:text-[#111111] dark:hover:bg-[#85D4B9] dark:hover:border-[#85D4B9] dark:hover:text-[#111111] transition-all duration-150"
                  >
                    {user.is_following ? 'Following' : 'Follow'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Posts */}
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin w-6 h-6 border-2 border-[#A3E6D0] border-t-transparent rounded-full" />
            </div>
          ) : searchResults.posts && searchResults.posts.length > 0 ? (
            <>
              <h3 className="px-4 py-3 font-['Outfit',sans-serif] font-semibold text-sm text-[#555555] dark:text-[#A0A0A0] uppercase tracking-wider border-b border-[#111111]/10 dark:border-[#333333]">
                Posts
              </h3>
              {searchResults.posts.map(post => (
                <PostCard key={post.id} post={post} />
              ))}
            </>
          ) : (
            <div data-testid="no-search-results" className="flex flex-col items-center py-16 text-center px-8">
              <p className="text-[#555555] dark:text-[#A0A0A0] text-sm">
                No results found for "<strong>{initialQ}</strong>"
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Trending */
        <div>
          <div className="px-4 py-4 border-b border-[#111111]/10 dark:border-[#333333]">
            <div className="flex items-center gap-2 mb-4">
              <TrendUp size={18} weight="bold" className="text-[#A3E6D0] dark:text-[#85D4B9]" />
              <h2 className="font-['Outfit',sans-serif] font-semibold text-base text-[#111111] dark:text-[#F5F5F5]">
                Trending this week
              </h2>
            </div>

            {trending.length === 0 ? (
              <p className="text-sm text-[#555555] dark:text-[#A0A0A0]">No trending topics yet. Post something!</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {trending.map((t, i) => (
                  <button
                    key={t.tag}
                    data-testid={`trending-pill-${t.tag}`}
                    onClick={() => handleTagClick(t.tag)}
                    className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-all duration-150 active:translate-y-0.5 ${
                      i === 0
                        ? 'bg-[#A3E6D0] dark:bg-[#85D4B9] text-[#111111] border-[#111111]/20 dark:border-transparent neo-shadow-sm'
                        : i === 1
                        ? 'bg-[#E1D4F9] dark:bg-[#B8A3E6]/30 text-[#111111] dark:text-[#F5F5F5] border-[#111111]/20 dark:border-[#333333]'
                        : i === 2
                        ? 'bg-[#FAD9A6] dark:bg-[#EBBF7E]/20 text-[#111111] dark:text-[#F5F5F5] border-[#111111]/20 dark:border-[#333333]'
                        : 'bg-white dark:bg-[#1A1A1A] text-[#555555] dark:text-[#A0A0A0] border-[#111111]/10 dark:border-[#333333] hover:bg-[#FCFBF4] dark:hover:bg-[#222222]'
                    }`}
                  >
                    #{t.tag}
                    <span className="ml-2 text-xs opacity-60">{t.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Explore;
