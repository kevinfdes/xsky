import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, PencilSimple, Check, X } from '@phosphor-icons/react';
import axios from 'axios';
import Layout from '../components/Layout';
import PostCard from '../components/PostCard';
import { useAuth } from '../context/AuthContext';
import { formatRelativeTime } from '../utils/helpers';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TABS = [
  { key: 'posts', label: 'Posts' },
  { key: 'replies', label: 'Replies' },
  { key: 'likes', label: 'Likes' },
];

const Profile = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, setUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [tab, setTab] = useState('posts');
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ display_name: '', bio: '', avatar_url: '' });

  const isMe = currentUser && currentUser.username === username;

  useEffect(() => {
    fetchProfile();
  }, [username]);

  useEffect(() => {
    if (profile) fetchTabContent();
  }, [tab, profile]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/users/${username}`);
      setProfile(res.data);
      setEditForm({ display_name: res.data.display_name, bio: res.data.bio, avatar_url: res.data.avatar_url });
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchTabContent = async () => {
    try {
      let res;
      if (tab === 'posts') res = await axios.get(`${API}/users/${username}/posts`);
      else if (tab === 'replies') res = await axios.get(`${API}/users/${username}/replies`);
      else res = await axios.get(`${API}/users/${username}/likes`);
      setPosts(res.data);
    } catch {}
  };

  const handleFollow = async () => {
    if (!profile) return;
    setFollowLoading(true);
    try {
      const res = await axios.post(`${API}/users/${username}/follow`);
      setProfile(prev => ({
        ...prev,
        is_following: res.data.following,
        followers_count: prev.followers_count + (res.data.following ? 1 : -1),
      }));
    } catch {}
    setFollowLoading(false);
  };

  const handleSaveEdit = async () => {
    try {
      const res = await axios.put(`${API}/users/profile`, editForm);
      setProfile(prev => ({ ...prev, ...res.data }));
      if (setUser) setUser(res.data);
      setEditing(false);
    } catch {}
  };

  const handleDeletePost = (postId) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
    setProfile(prev => prev ? { ...prev, posts_count: Math.max(0, prev.posts_count - 1) } : prev);
  };

  if (loading) {
    return (
      <Layout>
        <div className="animate-pulse">
          <div className="h-32 bg-[#111111]/10 dark:bg-[#F5F5F5]/10" />
          <div className="px-4 pt-4 space-y-3">
            <div className="w-20 h-20 rounded-xl bg-[#111111]/10 dark:bg-[#F5F5F5]/10 -mt-10" />
            <div className="h-5 bg-[#111111]/10 dark:bg-[#F5F5F5]/10 rounded w-1/3" />
            <div className="h-4 bg-[#111111]/10 dark:bg-[#F5F5F5]/10 rounded w-1/2" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <div className="flex flex-col items-center py-20 text-center">
          <p className="text-[#555555] dark:text-[#A0A0A0]">User not found</p>
          <button onClick={() => navigate('/home')} className="mt-4 text-sm font-semibold text-[#111111] dark:text-[#F5F5F5] hover:underline">
            Go home
          </button>
        </div>
      </Layout>
    );
  }

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
        <div>
          <h1 className="font-['Outfit',sans-serif] font-bold text-lg text-[#111111] dark:text-[#F5F5F5] leading-tight">
            {profile.display_name}
          </h1>
          <p className="text-xs text-[#555555] dark:text-[#A0A0A0]">{profile.posts_count} posts</p>
        </div>
      </header>

      {/* Banner */}
      <div
        data-testid="profile-banner"
        className="h-32 sm:h-40"
        style={{
          background: profile.banner_url
            ? `url(${profile.banner_url}) center/cover`
            : 'linear-gradient(135deg, #A3E6D0 0%, #E1D4F9 50%, #FAD9A6 100%)',
        }}
      />

      {/* Profile info */}
      <div className="px-4 pb-0">
        <div className="flex items-end justify-between -mt-10 mb-3">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-xl bg-[#E1D4F9] dark:bg-[#B8A3E6]/40 border-4 border-[#FCFBF4] dark:border-[#0F0F0F] flex items-center justify-center text-xl font-bold text-[#111111] dark:text-[#F5F5F5] overflow-hidden shadow-lg">
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              : profile.display_name?.slice(0, 2).toUpperCase()
            }
          </div>

          {/* Action button */}
          {isMe ? (
            editing ? (
              <div className="flex gap-2">
                <button
                  data-testid="cancel-edit-btn"
                  onClick={() => setEditing(false)}
                  className="p-2 rounded-xl border border-[#111111]/20 dark:border-[#333333] text-[#555555] dark:text-[#A0A0A0] hover:bg-[#111111]/5 dark:hover:bg-[#F5F5F5]/5 transition-colors"
                >
                  <X size={18} />
                </button>
                <button
                  data-testid="save-edit-btn"
                  onClick={handleSaveEdit}
                  className="px-4 py-2 bg-[#A3E6D0] dark:bg-[#85D4B9] text-[#111111] font-semibold text-sm rounded-xl border border-[#111111]/20 dark:border-transparent neo-shadow-sm transition-all duration-150 active:translate-y-0.5 flex items-center gap-1.5"
                >
                  <Check size={16} weight="bold" />
                  Save
                </button>
              </div>
            ) : (
              <button
                data-testid="edit-profile-btn"
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-4 py-2 border border-[#111111]/20 dark:border-[#333333] text-sm font-semibold text-[#111111] dark:text-[#F5F5F5] rounded-xl hover:bg-[#111111]/5 dark:hover:bg-[#F5F5F5]/5 transition-colors"
              >
                <PencilSimple size={15} />
                Edit Profile
              </button>
            )
          ) : (
            <button
              data-testid="follow-btn"
              onClick={handleFollow}
              disabled={followLoading}
              className={`px-5 py-2 text-sm font-semibold rounded-xl border transition-all duration-150 active:translate-y-0.5 disabled:opacity-50 ${
                profile.is_following
                  ? 'border-[#111111]/20 dark:border-[#333333] text-[#111111] dark:text-[#F5F5F5] hover:bg-red-50 hover:text-red-500 hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:text-red-400 dark:hover:border-red-800'
                  : 'bg-[#111111] dark:bg-[#F5F5F5] text-[#F5F5F5] dark:text-[#111111] border-[#111111] dark:border-[#F5F5F5] hover:bg-[#333333] dark:hover:bg-[#E0E0E0] neo-shadow-sm'
              }`}
            >
              {profile.is_following ? 'Following' : 'Follow'}
            </button>
          )}
        </div>

        {/* Edit Form */}
        {editing ? (
          <div className="space-y-3 mb-4 p-4 bg-white dark:bg-[#1A1A1A] border border-[#111111]/10 dark:border-[#333333] rounded-2xl">
            <div>
              <label className="block text-xs font-semibold text-[#555555] dark:text-[#A0A0A0] mb-1.5 uppercase tracking-wide">Display Name</label>
              <input
                data-testid="edit-display-name"
                value={editForm.display_name}
                onChange={e => setEditForm(p => ({ ...p, display_name: e.target.value }))}
                className="w-full px-3 py-2 bg-[#FCFBF4] dark:bg-[#0F0F0F] border border-[#111111]/20 dark:border-[#333333] rounded-xl text-sm text-[#111111] dark:text-[#F5F5F5] focus:outline-none focus:border-[#A3E6D0] dark:focus:border-[#85D4B9]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#555555] dark:text-[#A0A0A0] mb-1.5 uppercase tracking-wide">Bio</label>
              <textarea
                data-testid="edit-bio"
                value={editForm.bio}
                onChange={e => setEditForm(p => ({ ...p, bio: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 bg-[#FCFBF4] dark:bg-[#0F0F0F] border border-[#111111]/20 dark:border-[#333333] rounded-xl text-sm text-[#111111] dark:text-[#F5F5F5] focus:outline-none focus:border-[#A3E6D0] dark:focus:border-[#85D4B9] resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#555555] dark:text-[#A0A0A0] mb-1.5 uppercase tracking-wide">Avatar URL</label>
              <input
                data-testid="edit-avatar-url"
                value={editForm.avatar_url}
                onChange={e => setEditForm(p => ({ ...p, avatar_url: e.target.value }))}
                placeholder="https://..."
                className="w-full px-3 py-2 bg-[#FCFBF4] dark:bg-[#0F0F0F] border border-[#111111]/20 dark:border-[#333333] rounded-xl text-sm text-[#111111] dark:text-[#F5F5F5] focus:outline-none focus:border-[#A3E6D0] dark:focus:border-[#85D4B9]"
              />
            </div>
          </div>
        ) : (
          <>
            <h2 className="font-['Outfit',sans-serif] font-bold text-xl text-[#111111] dark:text-[#F5F5F5]">
              {profile.display_name}
            </h2>
            <p className="text-sm text-[#555555] dark:text-[#A0A0A0]">@{profile.username}</p>
            {profile.bio && (
              <p className="mt-2 text-sm text-[#111111] dark:text-[#F5F5F5] leading-relaxed">
                {profile.bio}
              </p>
            )}
            <p className="mt-1.5 text-xs text-[#555555] dark:text-[#A0A0A0]">
              Joined {formatRelativeTime(profile.created_at)}
            </p>

            {/* Stats */}
            <div data-testid="profile-stats" className="flex gap-5 mt-3">
              {[
                { label: 'posts', value: profile.posts_count },
                { label: 'following', value: profile.following_count },
                { label: 'followers', value: profile.followers_count },
              ].map(s => (
                <div key={s.label}>
                  <span className="font-['Outfit',sans-serif] font-bold text-sm text-[#111111] dark:text-[#F5F5F5]">
                    {s.value}
                  </span>
                  <span className="text-xs text-[#555555] dark:text-[#A0A0A0] ml-1">{s.label}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Tab nav */}
        <div className="flex mt-4 border-b border-[#111111]/10 dark:border-[#333333]">
          {TABS.map(t => (
            <button
              key={t.key}
              data-testid={`profile-tab-${t.key}`}
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

      {/* Posts */}
      {posts.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center px-8">
          <p className="text-sm text-[#555555] dark:text-[#A0A0A0]">
            {tab === 'posts' ? 'No posts yet' : tab === 'replies' ? 'No replies yet' : 'No liked posts yet'}
          </p>
        </div>
      ) : (
        posts.map(p => (
          <PostCard key={p.id} post={p} onDelete={isMe ? handleDeletePost : undefined} />
        ))
      )}
    </Layout>
  );
};

export default Profile;
