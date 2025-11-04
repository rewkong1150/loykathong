import React from 'react';
import { Krathong } from '../types';

interface KrathongDetailProps {
  krathong: Krathong;
  currentUserEmail?: string | null;
  isAdmin?: boolean; // ✅ เพิ่มเพื่อเช็คว่าเป็น admin หรือไม่
}

const KrathongDetail: React.FC<KrathongDetailProps> = ({ krathong, currentUserEmail, isAdmin }) => {
  const isCurrentUserInTeam =
    currentUserEmail &&
    krathong.members.some(member => member.email === currentUserEmail);

  return (
    <div className="space-y-8 max-h-[80vh] overflow-y-auto pr-4">
      {/* Header with Score */}
      <div className="text-center">
        <h3 className="text-3xl font-bold text-amber-300 mb-2">{krathong.name}</h3>

        <div className="flex items-center justify-center space-x-4">
          {/* ✅ แสดงคะแนนเฉพาะ admin */}
          {isAdmin && (
            <div className="bg-slate-700/50 px-4 py-2 rounded-full border border-amber-400/30">
              <span className="text-amber-300 font-bold text-xl">{krathong.score}</span>
              <span className="text-slate-300 ml-2">votes</span>
            </div>
          )}

          {isCurrentUserInTeam && (
            <span className="bg-green-500 text-white text-sm px-3 py-1 rounded-full font-medium">
              Your Team
            </span>
          )}
        </div>
      </div>

      {/* Images Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h4 className="text-xl font-bold text-slate-300 mb-3 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
            </svg>
            Krathong Image
          </h4>
          <img
            src={krathong.krathongImageUrl}
            alt={`Krathong image of ${krathong.name}`}
            className="w-full h-auto rounded-xl object-cover aspect-square shadow-lg border-2 border-amber-400/30 hover:border-amber-400 transition-colors duration-300"
          />
        </div>
        <div className="space-y-3">
          <h4 className="text-xl font-bold text-slate-300 mb-3 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
            Team with Krathong
          </h4>
          <img
            src={krathong.teamImageUrl}
            alt={`Team photo of ${krathong.name}`}
            className="w-full h-auto rounded-xl object-cover aspect-square shadow-lg border-2 border-amber-400/30 hover:border-amber-400 transition-colors duration-300"
          />
        </div>
      </div>

      {/* Team Members */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <h4 className="text-xl font-bold text-slate-300 mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
          </svg>
          Team Members ({krathong.members.length})
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {krathong.members.map((member, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border transition-all duration-200 ${
                currentUserEmail === member.email
                  ? 'bg-green-900/30 border-green-500 transform scale-105 shadow-lg'
                  : 'bg-slate-700/50 border-slate-600 hover:bg-slate-700/70'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-medium text-white flex items-center">
                    {member.name}
                    {currentUserEmail === member.email && (
                      <span className="ml-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                        You
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-slate-400 mt-1">{member.email}</p>
                </div>
                <div className="text-2xl text-amber-300/70">{index + 1}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Additional Info */}
      {isAdmin && (
        <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center justify-center space-x-6 text-sm text-slate-400">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              Registered
            </div>
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
              </svg>
              {krathong.score} votes
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KrathongDetail;
