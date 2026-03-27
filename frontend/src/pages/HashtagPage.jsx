import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Hash } from '@phosphor-icons/react';
import axios from 'axios';
import Layout from '../components/Layout';
import PostCard from '../components/PostCard';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const HashtagPage = () => {
  const { tag } = useParams();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef(null);
  const observerRef = useRef(null);

  const fetchPosts = useCallback(async (currentSkip = 0, append = false) => {
    if (currentSkip === 0) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await axios.get(`${API}/hashtag/${encodeURIComponent(tag)}`, {
        params: { skip: currentSkip, limit: 20 },
      });
      const data = res.data;
      if (append) setPosts(prev => [...prev, ...data]);
      else setPosts(data);
      setHasMore(data.length === 20);
      setSkip(currentSkip + data.length);
    } catch {}
    finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [tag]);

  useEffect(() => {
    setSkip(0);
    setHasMore(true);
    fetchPosts(0, false);
  }, [tag, fetchPosts]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
        fetchPosts(skip, true);
      }
    }, { threshold: 0.1 });
    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current);
    return () => observerRef.current?.disconnect();
  }, [hasMore, loadingMore, loading, skip, fetchPosts]);

  const handleDelete = (postId) => setPosts(prev => prev.filter(p => p.id !== postId));

  return (
    <Layout>
      <header className="sticky top-0 z-30 bg-[#FCFBF4]/90 dark:bg-[#0F0F0F]/90 backdrop-blur-md border-b border-[#111111]/10 dark:border-[#333333] px-4 py-3 flex items-center gap-3">
        <button
          data-testid="back-btn"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl hover:bg-[#111111]/10 dark:hover:bg-[#F5F5F5]/10 text-[#111111] dark:text-[#F5F5F5] transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#A3E6D0]/40 dark:bg-[#85D4B9]/20 border border-[#111111]/10 dark:border-[#333333] flex items-center justify-center">
            <Hash size={16} className="text-[#111111] dark:text-[#F5F5F5]" weight="bold" />
          </div>
          <div>
            <h1 className="font-['Outfit',sans-serif] font-bold text-lg text-[#111111] dark:text-[#F5F5F5] leading-tight">#{tag}</h1>
            <p className="text-xs text-[#555555] dark:text-[#A0A0A0]">{posts.length > 0 ? `${posts.length}+ posts` : 'Hashtag feed'}</p>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-col">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="border-b border-[#111111]/10 dark:border-[#333333] px-4 py-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#111111]/10 dark:bg-[#F5F5F5]/10 flex-shrink-0" />
                <div className="flex-1 space-y-2"><div className="h-3 bg-[#111111]/10 rounded w-1/3" /><div className="h-3 bg-[#111111]/10 rounded w-full" /></div>
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div data-testid="empty-hashtag" className="flex flex-col items-center py-20 text-center px-8">
          <p className="text-[#555555] dark:text-[#A0A0A0]">No posts with <strong>#{tag}</strong> yet.</p>
        </div>
      ) : (
        <>
          {posts.map(post => <PostCard key={post.id} post={post} onDelete={handleDelete} />)}
          <div ref={sentinelRef} className="h-10 flex items-center justify-center">
            {loadingMore && <div className="animate-spin w-5 h-5 border-2 border-[#A3E6D0] border-t-transparent rounded-full" />}
          </div>
        </>
      )}
    </Layout>
  );
};

export default HashtagPage;
