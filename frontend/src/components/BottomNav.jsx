import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { House, Compass, Bell, User } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const path = location.pathname;

  const items = [
    { icon: House, label: 'Home', path: '/home' },
    { icon: Compass, label: 'Explore', path: '/explore' },
    { icon: Bell, label: 'Alerts', path: '/notifications' },
    { icon: User, label: 'Profile', path: user ? `/profile/${user.username}` : '/profile' },
  ];

  return (
    <nav
      data-testid="bottom-nav"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FCFBF4] dark:bg-[#0F0F0F] border-t border-[#111111]/10 dark:border-[#333333] flex items-center justify-around px-2 py-2"
    >
      {items.map(({ icon: Icon, label, path: itemPath }) => {
        const active = path === itemPath || (label === 'Profile' && path.startsWith('/profile'));
        return (
          <button
            key={label}
            data-testid={`bottom-nav-${label.toLowerCase()}`}
            onClick={() => navigate(itemPath)}
            className={`flex flex-col items-center gap-0.5 p-3 rounded-xl transition-all duration-150 ${
              active
                ? 'text-[#111111] dark:text-[#F5F5F5]'
                : 'text-[#555555] dark:text-[#A0A0A0]'
            }`}
          >
            <Icon size={22} weight={active ? 'fill' : 'regular'} />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
