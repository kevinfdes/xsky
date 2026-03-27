import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import PostCard from '../components/PostCard';
import PostComposer from '../components/PostComposer';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Home = () => {
  const [tab, setTab] = useState('for_you');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchFeed = useCallback(async (feedType, currentSkip = 0, append = false) => {
    if (currentSkip === 0) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await axios.get(`${API}/feed`, {
        params: { type: feedType, skip: currentSkip, limit: 20 },
      });
      const data = res.data;
      if (append) {
        setPosts(prev => [...prev, ...data]);
      } else {
        setPosts(data);
      }
      setHasMore(data.length === 20);
      setSkip(currentSkip + data.length);
    } catch (err) {
      console.error('Feed error', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    setSkip(0);
    setHasMore(true);
    fetchFeed(tab, 0, false);
  }, [tab, fetchFeed]);

  const handlePost = (newPost) => {
    if (tab === 'for_you') {
      setPosts(prev => [newPost, ...prev]);
    }
  };

  const handleDelete = (postId) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchFeed(tab, skip, true);
    }
  };

  return (
    <Layout>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#FCFBF4]/90 dark:bg-[#0F0F0F]/90 backdrop-blur-md border-b border-[#111111]/10 dark:border-[#333333]">
        <div className="px-4 pt-3 pb-0">
          <h1 className="font-['Outfit',sans-serif] font-bold text-xl text-[#111111] dark:text-[#F5F5F5] pb-3">
            Home
          </h1>
          {/* Tabs */}
          <div className="flex">
            {[
              { key: 'for_you', label: 'For You' },
              { key: 'following', label: 'Following' },
            ].map(t => (
              <button
                key={t.key}
                data-testid={`feed-tab-${t.key}`}
                onClick={() => setTab(t.key)}
                className={`flex-1 py-3 text-sm font-semibold transition-all duration-150 border-b-2 ${
                  tab === t.key
                    ? 'border-[#A3E6D0] dark:border-[#85D4B9] text-[#111111] dark:text-[#F5F5F5]'
                    : 'border-transparent text-[#555555] dark:text-[#A0A0A0] hover:text-[#111111] dark:hover:text-[#F5F5F5]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Composer */}
      <PostComposer onPost={handlePost} />

      {/* Feed */}
      {loading ? (
        <div className="flex flex-col">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="border-b border-[#111111]/10 dark:border-[#333333] px-4 py-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#111111]/10 dark:bg-[#F5F5F5]/10 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-[#111111]/10 dark:bg-[#F5F5F5]/10 rounded w-1/3" />
                  <div className="h-3 bg-[#111111]/10 dark:bg-[#F5F5F5]/10 rounded w-full" />
                  <div className="h-3 bg-[#111111]/10 dark:bg-[#F5F5F5]/10 rounded w-3/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div data-testid="empty-feed" className="flex flex-col items-center justify-center py-20 text-center px-8">
          <div className="w-16 h-16 rounded-2xl bg-[#A3E6D0]/30 dark:bg-[#85D4B9]/20 border border-[#111111]/10 dark:border-[#333333] flex items-center justify-center mb-4">
            <span className="text-2xl">✦</span>
          </div>
          <h3 className="font-['Outfit',sans-serif] font-semibold text-[#111111] dark:text-[#F5F5F5] mb-2">
            {tab === 'following' ? 'Follow some people to see their posts' : 'Nothing here yet'}
          </h3>
          <p className="text-sm text-[#555555] dark:text-[#A0A0A0]">
            {tab === 'following' ? 'Find people to follow in Explore' : 'Be the first to post something!'}
          </p>
        </div>
      ) : (
        <>
          {posts.map(post => (
            <PostCard key={post.id} post={post} onDelete={handleDelete} />
          ))}

          {hasMore && (
            <div className="flex justify-center py-6">
              <button
                data-testid="load-more-btn"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-6 py-2.5 text-sm font-semibold text-[#555555] dark:text-[#A0A0A0] border border-[#111111]/10 dark:border-[#333333] rounded-xl hover:bg-[#111111]/5 dark:hover:bg-[#F5F5F5]/5 transition-colors disabled:opacity-50"
              >
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </Layout>
  );
};

export default Home;
