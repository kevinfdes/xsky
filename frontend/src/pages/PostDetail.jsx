import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from '@phosphor-icons/react';
import axios from 'axios';
import Layout from '../components/Layout';
import PostCard from '../components/PostCard';
import PostComposer from '../components/PostComposer';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PostDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPost();
  }, [id]);

  const fetchPost = async () => {
    setLoading(true);
    try {
      const [postRes, repliesRes] = await Promise.all([
        axios.get(`${API}/posts/${id}`),
        axios.get(`${API}/posts/${id}/replies`),
      ]);
      setPost(postRes.data);
      setReplies(repliesRes.data);
    } catch (err) {
      console.error('Post fetch error', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReply = (newReply) => {
    setReplies(prev => [...prev, newReply]);
    if (post) {
      setPost(prev => ({ ...prev, reply_count: prev.reply_count + 1 }));
    }
  };

  const handleDeleteReply = (replyId) => {
    setReplies(prev => prev.filter(r => r.id !== replyId));
  };

  return (
    <Layout>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#FCFBF4]/90 dark:bg-[#0F0F0F]/90 backdrop-blur-md border-b border-[#111111]/10 dark:border-[#333333] px-4 py-3 flex items-center gap-4">
        <button
          data-testid="back-btn"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl hover:bg-[#111111]/10 dark:hover:bg-[#F5F5F5]/10 text-[#111111] dark:text-[#F5F5F5] transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-['Outfit',sans-serif] font-bold text-lg text-[#111111] dark:text-[#F5F5F5]">
          Post
        </h1>
      </header>

      {loading ? (
        <div className="flex flex-col animate-pulse px-4 py-4">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#111111]/10 dark:bg-[#F5F5F5]/10 flex-shrink-0" />
            <div className="flex-1 space-y-3">
              <div className="h-4 bg-[#111111]/10 dark:bg-[#F5F5F5]/10 rounded w-1/3" />
              <div className="h-4 bg-[#111111]/10 dark:bg-[#F5F5F5]/10 rounded w-full" />
              <div className="h-4 bg-[#111111]/10 dark:bg-[#F5F5F5]/10 rounded w-3/4" />
            </div>
          </div>
        </div>
      ) : post ? (
        <>
          {/* Main post - shown as full card */}
          <div data-testid="post-detail-main">
            <PostCard post={post} />
          </div>

          {/* Reply composer */}
          <div className="border-b border-[#111111]/10 dark:border-[#333333]">
            <PostComposer
              onPost={handleReply}
              replyTo={id}
              placeholder={`Reply to @${post.author.username}...`}
            />
          </div>

          {/* Replies */}
          {replies.length === 0 ? (
            <div data-testid="no-replies" className="flex flex-col items-center py-16 text-center px-8">
              <p className="text-sm text-[#555555] dark:text-[#A0A0A0]">No replies yet. Start the conversation!</p>
            </div>
          ) : (
            <div data-testid="replies-list">
              {replies.map(reply => (
                <PostCard key={reply.id} post={reply} onDelete={handleDeleteReply} showThread />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center py-20 text-center">
          <p className="text-[#555555] dark:text-[#A0A0A0]">Post not found</p>
          <button
            onClick={() => navigate('/home')}
            className="mt-4 text-sm font-semibold text-[#111111] dark:text-[#F5F5F5] hover:underline"
          >
            Go back home
          </button>
        </div>
      )}
    </Layout>
  );
};

export default PostDetail;
