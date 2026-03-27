import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  House, Compass, Bell, User, BookmarkSimple, Gear, Sun, Moon, SignOut, PencilSimple
} from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import PostComposerModal from './PostComposerModal';

const NavItem = ({ icon: Icon, label, path, active, onClick, badge }) => {
  const navigate = useNavigate();
  const handleClick = () => {
    if (onClick) onClick();
    else navigate(path);
  };
  return (
    <button
      data-testid={`nav-${label.toLowerCase()}`}
      onClick={handleClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl w-full transition-all duration-150 font-['Outfit',sans-serif] font-medium text-base relative
        ${active
          ? 'bg-[#A3E6D0] dark:bg-[#85D4B9] text-[#111111] neo-shadow-sm'
          : 'text-[#555555] dark:text-[#A0A0A0] hover:bg-[#111111]/5 dark:hover:bg-[#F5F5F5]/5 hover:text-[#111111] dark:hover:text-[#F5F5F5]'
        }`}
    >
      <Icon size={22} weight={active ? 'fill' : 'regular'} />
      <span className="hidden xl:block">{label}</span>
      {badge > 0 && (
        <span className="absolute left-6 top-1.5 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold xl:static xl:ml-auto">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
};

const LeftSidebar = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [showComposer, setShowComposer] = useState(false);
  const [unreadCount] = useState(0);

  const path = location.pathname;

  return (
    <div className="sticky top-0 h-screen flex flex-col justify-between px-3 py-6 border-r border-[#111111]/10 dark:border-[#333333]">
      {/* Logo */}
      <div>
        <button
          data-testid="logo-btn"
          onClick={() => navigate('/home')}
          className="flex items-center gap-2 px-4 mb-6 group"
        >
          <div className="w-9 h-9 bg-[#A3E6D0] dark:bg-[#85D4B9] rounded-xl border border-[#111111] dark:border-[#333333] neo-shadow-sm flex items-center justify-center font-['Outfit'] font-black text-[#111111] text-lg">
            A
          </div>
          <span className="hidden xl:block font-['Outfit',sans-serif] font-bold text-xl text-[#111111] dark:text-[#F5F5F5]">
            Agora
          </span>
        </button>

        {/* Navigation */}
        <nav className="flex flex-col gap-1">
          <NavItem icon={House} label="Home" path="/home" active={path === '/home'} />
          <NavItem icon={Compass} label="Explore" path="/explore" active={path === '/explore'} />
          <NavItem icon={Bell} label="Notifications" path="/notifications" active={path === '/notifications'} badge={unreadCount} />
          <NavItem icon={BookmarkSimple} label="Bookmarks" path="/bookmarks" active={path === '/bookmarks'} />
          {user && (
            <NavItem icon={User} label="Profile" path={`/profile/${user.username}`} active={path.startsWith('/profile')} />
          )}
        </nav>

        {/* New Post Button */}
        <button
          data-testid="new-post-btn"
          onClick={() => setShowComposer(true)}
          className="mt-4 w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#A3E6D0] hover:bg-[#8DD4BE] dark:bg-[#85D4B9] dark:hover:bg-[#A3E6D0] text-[#111111] font-['Outfit',sans-serif] font-semibold rounded-xl border border-[#111111] dark:border-transparent neo-shadow transition-all duration-150 active:translate-y-0.5 active:shadow-none"
        >
          <PencilSimple size={18} weight="bold" />
          <span className="hidden xl:block">New Post</span>
        </button>
      </div>

      {/* Bottom section */}
      <div className="flex flex-col gap-1">
        <button
          data-testid="theme-toggle"
          onClick={toggleTheme}
          className="flex items-center gap-3 px-4 py-3 rounded-xl w-full text-[#555555] dark:text-[#A0A0A0] hover:bg-[#111111]/5 dark:hover:bg-[#F5F5F5]/5 hover:text-[#111111] dark:hover:text-[#F5F5F5] transition-all duration-150"
        >
          {theme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
          <span className="hidden xl:block font-medium">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>

        {user && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-[#111111]/10 dark:border-[#333333] mt-1">
            <div className="w-8 h-8 rounded-xl bg-[#E1D4F9] dark:bg-[#B8A3E6] border border-[#111111]/20 dark:border-[#333333] flex items-center justify-center text-xs font-bold text-[#111111] dark:text-[#0F0F0F] overflow-hidden flex-shrink-0">
              {user.avatar_url
                ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                : user.display_name?.slice(0, 2).toUpperCase()
              }
            </div>
            <div className="hidden xl:block flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#111111] dark:text-[#F5F5F5] truncate">{user.display_name}</p>
              <p className="text-xs text-[#555555] dark:text-[#A0A0A0] truncate">@{user.username}</p>
            </div>
            <button
              data-testid="logout-btn"
              onClick={logout}
              className="hidden xl:block text-[#555555] dark:text-[#A0A0A0] hover:text-red-500 transition-colors"
            >
              <SignOut size={18} />
            </button>
          </div>
        )}
      </div>

      {showComposer && <PostComposerModal onClose={() => setShowComposer(false)} />}
    </div>
  );
};

export default LeftSidebar;
