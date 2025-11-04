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
    votingEnabled 
}) => {
  const isTeamMember = currentUserEmail ? krathong.members.some(member => member.email === currentUserEmail) : false;
  const voteButtonDisabled = !canVote || isVotedFor || isVoting || isTeamMember || !votingEnabled;

  const getButtonContent = () => {
    if (isVoting) {
        return (
            <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                กำลังโหวต...
            </>
        )
    }
    if (!votingEnabled && canVote) return 'close vote';
    if (isTeamMember) return 'Can not vote yourteam';
    if (isVotedFor) return 'voted';
    if (!canVote) return 'Login for vote';
    return 'Vote';
  };

  const creatorName = krathong.members && krathong.members.length > 0 ? krathong.members[0].name : 'ไม่ระบุ';
  const teamText = krathong.members.length > 1 ? ` และอีก ${krathong.members.length - 1} คน` : '';

  return (
    <div className="bg-slate-800/50 rounded-xl overflow-hidden shadow-lg transform transition duration-500 hover:scale-105 hover:shadow-amber-500/20 border border-slate-700/50 flex flex-col">
      <div onClick={() => onViewDetails(krathong)} className="cursor-pointer">
        <img className="w-full h-56 object-cover" src={krathong.krathongImageUrl} alt={krathong.name} />
      </div>
      <div className="p-6 flex flex-col flex-grow">
        <h3 onClick={() => onViewDetails(krathong)} className="font-bold text-xl mb-2 text-amber-300 cursor-pointer hover:text-amber-200 transition">{krathong.name}</h3>
        <div className="flex items-center justify-between mb-4 min-h-[56px] flex-grow">
            <p className="text-gray-300 text-base">
                สร้างโดย: <span className="font-semibold">{creatorName}</span><span className="text-sm text-slate-400">{teamText}</span>
            </p>
            {isAdmin && (
              <div className="text-right animate-fade-in flex items-center gap-2">
                  <div className="flex flex-col items-center">
                    <p className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-400">{krathong.score}</p>
                    <p className="text-sm text-gray-400">คะแนน</p>
                  </div>
                  <div className="flex flex-col gap-1">
                      <button 
                        onClick={() => onAdjustScore(krathong.id, 5)}
                        className="w-8 h-8 flex items-center justify-center bg-green-500/80 hover:bg-green-600 rounded-full text-white font-bold text-xl transition-transform transform hover:scale-110"
                        aria-label="เพิ่มคะแนน"
                      >
                        +
                      </button>
                      <button 
                        onClick={() => onAdjustScore(krathong.id, -5)}
                        disabled={krathong.score === 0}
                        className="w-8 h-8 flex items-center justify-center bg-red-500/80 hover:bg-red-600 rounded-full text-white font-bold text-xl transition-transform transform hover:scale-110 disabled:bg-slate-600 disabled:cursor-not-allowed disabled:transform-none"
                        aria-label="ลดคะแนน"
                      >
                        -
                      </button>
                  </div>
              </div>
            )}
        </div>
        <button
          onClick={() => onVote(krathong.id)}
          disabled={voteButtonDisabled}
          className={`w-full font-bold py-3 px-4 rounded-lg transition duration-300 flex items-center justify-center mt-auto ${
            isVotedFor || isTeamMember
                ? 'bg-gray-600 cursor-not-allowed' 
                : voteButtonDisabled
                ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                : 'bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-slate-900'
          }`}
        >
          {getButtonContent()}
        </button>
      </div>
    </div>
  );
};

export default KrathongCard;
