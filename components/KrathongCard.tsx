import React from 'react';
import { Krathong } from '../types';

interface KrathongCardProps {
  krathong: Krathong;
  onVote: (id: string) => void;
  canVote: boolean;
  isVotedFor: boolean;
  isVoting: boolean;
  isAdmin: boolean;
  onAdjustScore: (id: string, amount: number) => void;
  onViewDetails: (krathong: Krathong) => void;
  currentUserEmail: string | null;
  votingEnabled: boolean;
  isUserInTeam: boolean;
  onCancelVote?: (userId: string) => void;
}

const KrathongCard: React.FC<KrathongCardProps> = ({ 
    krathong, 
    onVote, 
    canVote, 
    isVotedFor, 
    isVoting, 
    isAdmin, 
    onAdjustScore, 
    onViewDetails,
    currentUserEmail,
    votingEnabled,
    isUserInTeam,
    onCancelVote
}) => {
  const voteButtonDisabled = !canVote || isVotedFor || isVoting || isUserInTeam || !votingEnabled;

  const getButtonContent = () => {
    if (isVoting) {
        return (
            <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Voting...
            </>
        )
    }
    if (!votingEnabled) return '❌ Voting Closed';
    if (isUserInTeam) return '❌ Cannot Vote Your Team';
    if (isVotedFor) return '✅ Voted';
    if (!canVote && !currentUserEmail) return '🔐 Login to Vote';
    if (!canVote && currentUserEmail) return '❌ One Vote Only';
    return '🎉 Vote for This Team';
  };

  const getButtonStyles = () => {
    if (isVotedFor) {
      return 'bg-green-600 hover:bg-green-700 text-white cursor-default';
    }
    if (isUserInTeam) {
      return 'bg-purple-600 text-white cursor-not-allowed';
    }
    if (!votingEnabled || !canVote) {
      return 'bg-gray-600 text-gray-300 cursor-not-allowed';
    }
    return 'bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-slate-900 font-semibold';
  };

  const creatorName = krathong.members && krathong.members.length > 0 ? krathong.members[0].name : 'Unknown';
  const teamText = krathong.members.length > 1 ? ` and ${krathong.members.length - 1} others` : '';

  return (
    <div className={`bg-slate-800/50 rounded-xl overflow-hidden shadow-lg transform transition duration-500 hover:scale-105 hover:shadow-amber-500/20 border flex flex-col ${
      isVotedFor ? 'border-green-500/50' : isUserInTeam ? 'border-purple-500/50' : 'border-slate-700/50'
    }`}>
      {/* Badges */}
      <div className="absolute top-2 left-2 flex flex-col gap-1">
        {isVotedFor && (
          <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
            ✅ Voted
          </span>
        )}
        {isUserInTeam && (
          <span className="bg-purple-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
            👥 Your Team
          </span>
        )}
        {isAdmin && (
          <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
            🔧 Admin
          </span>
        )}
      </div>

      <div onClick={() => onViewDetails(krathong)} className="cursor-pointer relative">
        <img 
          className="w-full h-56 object-cover" 
          src={krathong.krathongImageUrl} 
          alt={krathong.name}
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300x200/1e293b/64748b?text=Krathong+Image';
          }}
        />
        <div className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-sm">
          🏆 #{krathong.score}
        </div>
      </div>
      
      <div className="p-6 flex flex-col flex-grow">
        <h3 
          onClick={() => onViewDetails(krathong)} 
          className="font-bold text-xl mb-2 text-amber-300 cursor-pointer hover:text-amber-200 transition text-center"
        >
          {krathong.name}
        </h3>
        
        <div className="flex items-center justify-between mb-4 min-h-[56px] flex-grow">
            <p className="text-gray-300 text-sm">
                Created by: <span className="font-semibold text-amber-200">{creatorName}</span>
                {teamText && <span className="text-slate-400 block text-xs">{teamText}</span>}
            </p>
            
            {isAdmin && (
              <div className="text-right animate-fade-in flex items-center gap-2">
                  <div className="flex flex-col items-center">
                    <p className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-400">
                      {krathong.score}
                    </p>
                    <p className="text-xs text-gray-400">Points</p>
                  </div>
                  <div className="flex flex-col gap-1">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onAdjustScore(krathong.id, 5);
                        }}
                        className="w-8 h-8 flex items-center justify-center bg-green-500/80 hover:bg-green-600 rounded-full text-white font-bold text-xl transition-transform transform hover:scale-110 active:scale-95"
                        aria-label="Increase score"
                        title="Add 5 points"
                      >
                        +
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onAdjustScore(krathong.id, -5);
                        }}
                        disabled={krathong.score === 0}
                        className="w-8 h-8 flex items-center justify-center bg-red-500/80 hover:bg-red-600 rounded-full text-white font-bold text-xl transition-transform transform hover:scale-110 active:scale-95 disabled:bg-slate-600 disabled:cursor-not-allowed disabled:transform-none"
                        aria-label="Decrease score"
                        title="Remove 5 points"
                      >
                        -
                      </button>
                  </div>
              </div>
            )}
        </div>

        {/* Status Info */}
        {(!votingEnabled || isUserInTeam || isVotedFor) && (
          <div className="mb-3 text-xs text-center text-gray-400">
            {!votingEnabled && '⚠️ Voting is temporarily closed'}
            {isUserInTeam && '⭐ This is your team'}
            {isVotedFor && '🎯 You voted for this team'}
          </div>
        )}

        <button
          onClick={() => onVote(krathong.id)}
          disabled={voteButtonDisabled}
          className={`w-full py-3 px-4 rounded-lg transition duration-300 flex items-center justify-center mt-auto ${getButtonStyles()}`}
        >
          {getButtonContent()}
        </button>

        {/* View Details Button */}
        <button
          onClick={() => onViewDetails(krathong)}
          className="w-full mt-2 py-2 px-4 bg-slate-700/50 hover:bg-slate-600/50 text-gray-300 rounded-lg transition duration-300 text-sm"
        >
          👁️ View Details
        </button>
      </div>
    </div>
  );
};

export default KrathongCard;