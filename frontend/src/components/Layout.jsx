import React from 'react';
import LeftSidebar from './LeftSidebar';
import RightSidebar from './RightSidebar';
import BottomNav from './BottomNav';

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen bg-[#FCFBF4] dark:bg-[#0F0F0F] transition-colors duration-200">
      <div className="max-w-7xl mx-auto md:grid md:grid-cols-12 md:gap-0">
        {/* Left Sidebar - hidden on mobile */}
        <aside className="hidden md:block md:col-span-3 xl:col-span-3">
          <LeftSidebar />
        </aside>

        {/* Main Feed */}
        <main className="col-span-12 md:col-span-9 lg:col-span-6 min-h-screen border-x border-[#111111]/10 dark:border-[#333333] pb-20 md:pb-0">
          {children}
        </main>

        {/* Right Sidebar - only on large screens */}
        <aside className="hidden lg:block lg:col-span-3">
          <RightSidebar />
        </aside>
      </div>

      {/* Mobile Bottom Nav */}
      <BottomNav />
    </div>
  );
};

export default Layout;
