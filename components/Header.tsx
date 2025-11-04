import React from 'react';
import { AppUser } from '../types';

interface HeaderProps {
  user: AppUser | null;
  onLogin: () => void;
  onLogout: () => void;
  userTeam?: any; // Optional prop for user's team
  isAdmin?: boolean; // New prop for admin status
}

const Header: React.FC<HeaderProps> = ({ user, onLogin, onLogout, userTeam, isAdmin }) => {
  return (
    <header className="bg-slate-900/80 backdrop-blur-md shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex-shrink-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-400">
              ประกวดกระทงออนไลน์
            </h1>
            <p className="text-sm text-amber-100/70">Loy Krathong Festival 2025</p>
          </div>
          <div className="flex items-center">
            {user ? (
              <div className="flex items-center space-x-3">
                {/* Admin Badge */}
                {isAdmin && (
                  <span className="bg-amber-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                    👑 Admin
                  </span>
                )}
                
                {/* User Team Info */}
                {userTeam && (
                  <div className="hidden sm:flex flex-col items-end">
                    <span className="text-green-300 text-sm font-medium">
                      ทีม: {userTeam.name}
                    </span>
                    <span className="text-amber-300 text-xs">
                      {userTeam.score} คะแนน
                    </span>
                  </div>
                )}
                
                {/* User Avatar and Info */}
                <div className="flex items-center space-x-2">
                  <img
                    src={user.photoURL || `https://i.pravatar.cc/150?u=${user.uid}`}
                    alt={user.displayName || 'User'}
                    className="h-10 w-10 rounded-full border-2 border-amber-400"
                  />
                  <div className="hidden sm:flex flex-col">
                    <span className="text-white font-medium text-sm">
                      {user.displayName}
                    </span>
                    <span className="text-slate-300 text-xs">
                      {user.email}
                    </span>
                  </div>
                </div>
                
                {/* Logout Button */}
                <button
                  onClick={onLogout}
                  className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-full transition duration-300 ease-in-out transform hover:scale-105"
                >
                  ออกจากระบบ
                </button>
              </div>
            ) : (
              <button
                onClick={onLogin}
                className="bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-slate-900 font-bold py-2 px-5 rounded-full transition duration-300 ease-in-out transform hover:scale-105 flex items-center space-x-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                <span>เข้าสู่ระบบเพื่อโหวต</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;