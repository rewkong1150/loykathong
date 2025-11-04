import React, { useState, useEffect } from 'react';
import { Krathong, TeamMember, AppUser } from './types';
import Header from './components/Header';
import KrathongCard from './components/KrathongCard';
import Spinner from './components/Spinner';
import Modal from './components/Modal';
import TeamRegistration from './components/TeamRegistration';
import KrathongDetail from './components/KrathongDetail';
import { 
  auth, 
  signInWithGoogle, 
  signOutUser,
  getKrathongs,
  addKrathong,
  updateKrathongScore,
  voteForKrathong,
  checkUserVote,
  checkUserInTeam,
  cancelUserVote
} from './config/firebase';

const ADMIN_EMAILS = [
  'pp.dejpreecha@villacartegroup.com',
  'patomporn.k@villacartegroup.com'
];

const App: React.FC = () => {
  const [krathongs, setKrathongs] = useState<Krathong[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [isAdminView, setIsAdminView] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [votingEnabled, setVotingEnabled] = useState(true);
  const [selectedKrathong, setSelectedKrathong] = useState<Krathong | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [userVotes, setUserVotes] = useState<Record<string, boolean>>({});
  const [votingInProgress, setVotingInProgress] = useState<string | null>(null);
  const [userTeam, setUserTeam] = useState<Krathong | null>(null);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [votedKrathongId, setVotedKrathongId] = useState<string | null>(null);
  const [lastVoteTime, setLastVoteTime] = useState(0);
  const [showVoteSuccess, setShowVoteSuccess] = useState(false);
  const [votedKrathongName, setVotedKrathongName] = useState('');

  // Fix scroll issue
  useEffect(() => {
    document.documentElement.style.height = '100%';
    document.body.style.height = '100%';
    document.body.style.overflowY = 'auto';
    return () => {
      document.documentElement.style.height = '';
      document.body.style.height = '';
      document.body.style.overflowY = '';
    };
  }, []);

  const checkAdminStatus = (email: string | null): boolean => {
    return email ? ADMIN_EMAILS.includes(email.toLowerCase()) : false;
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser as AppUser);
        const adminStatus = checkAdminStatus(firebaseUser.email);
        setIsUserAdmin(adminStatus);
        if (!adminStatus && isAdminView) setIsAdminView(false);

        const votes = await checkUserVote(firebaseUser.uid);
        setUserVotes(votes);

        // ✅ ถ้า user เคยโหวตแล้ว ให้จำ id ของ krathong นั้น
        const votedIds = Object.keys(votes);
        if (votedIds.length > 0) {
          setVotedKrathongId(votedIds[0]);
        }

        const team = await checkUserInTeam(firebaseUser.email);
        setUserTeam(team);
      } else {
        setUser(null);
        setIsUserAdmin(false);
        setUserVotes({});
        setUserTeam(null);
        setVotedKrathongId(null);
        setShowVoteSuccess(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const loadKrathongs = async () => {
      setLoading(true);
      try {
        const krathongsData = await getKrathongs();
        setKrathongs(krathongsData);
      } catch (error) {
        console.error('Error loading krathongs:', error);
      } finally {
        setLoading(false);
      }
    };
    loadKrathongs();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Login error:', error);
      alert('An error occurred while logging in');
    }
  };
  
  const handleLogout = async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleVote = async (id: string) => {
    if (!user) {
      alert('Please log in to vote');
      return;
    }
    if (!votingEnabled) {
      alert('Voting system is temporarily closed');
      return;
    }

    // ⏰ ป้องกันการกดโหวตเร็วเกินไป
    const now = Date.now();
    if (now - lastVoteTime < 1000) {
      alert('Please wait a moment before voting again');
      return;
    }
    setLastVoteTime(now);

    // ❌ ถ้าเคยโหวตให้ Krathong อื่นแล้ว
    if (votedKrathongId && votedKrathongId !== id) {
      alert('You have already voted for another krathong! You can only vote once.');
      return;
    }

    // 🔒 ป้องกันโหวตให้ทีมตัวเอง
    const krathongToVote = krathongs.find(k => k.id === id);
    if (krathongToVote && krathongToVote.members.some(m => 
      m.email.toLowerCase() === user.email?.toLowerCase()
    )) {
      alert('You cannot vote for your own team! ❌');
      return;
    }

    if (userVotes[id]) {
      alert('You have already voted for this krathong!');
      return;
    }

    setVotingInProgress(id);
    try {
      await voteForKrathong(id, user.uid);
      setKrathongs(prev =>
        prev.map(k => k.id === id ? { ...k, score: k.score + 10 } : k)
          .sort((a, b) => b.score - a.score)
      );
      setUserVotes(prev => ({ ...prev, [id]: true }));
      setVotedKrathongId(id);

      const krathongName = krathongs.find(k => k.id === id)?.name || 'Unknown Team';
      setVotedKrathongName(krathongName);
      setShowVoteSuccess(true);
      
      // อัตโนมัติหายหลังจาก 3 วินาที
      setTimeout(() => {
        setShowVoteSuccess(false);
      }, 3000);
      
    } catch (error) {
      console.error('Vote error:', error);
      alert('An error occurred while voting');
    } finally {
      setVotingInProgress(null);
    }
  };

  // ฟังก์ชันยกเลิกการโหวต (สำหรับ Admin หรือในกรณีพิเศษ)
  const handleCancelVote = async (userId: string, krathongId: string) => {
    if (!isUserAdmin) {
      alert('You do not have permission to cancel votes');
      return;
    }

    try {
      await cancelUserVote(userId, krathongId);
      setKrathongs(prev =>
        prev.map(k => 
          k.id === krathongId ? { ...k, score: Math.max(0, k.score - 10) } : k
        ).sort((a, b) => b.score - a.score)
      );
      
      // รีเฟรชข้อมูลการโหวต
      if (user) {
        const votes = await checkUserVote(user.uid);
        setUserVotes(votes);
        const votedIds = Object.keys(votes);
        setVotedKrathongId(votedIds.length > 0 ? votedIds[0] : null);
      }
      
      alert('Vote cancelled successfully');
    } catch (error) {
      console.error('Cancel vote error:', error);
      alert('Error cancelling vote');
    }
  };

  const handleRegisterTeam = async (teamName: string, members: TeamMember[], krathongImageUrl: string, teamImageUrl: string) => {
    if (!user) {
      alert('Please log in before registering your team');
      return;
    }
    if (userTeam) {
      alert(`You are already a member of team "${userTeam.name}" and cannot create a new team`);
      return;
    }
    if (!registrationEnabled) {
      alert('Team registration is currently closed');
      return;
    }

    try {
      const newKrathong: Omit<Krathong, 'id'> = {
        name: teamName,
        krathongImageUrl,
        teamImageUrl,
        score: 0,
        members,
      };

      const krathongId = await addKrathong(newKrathong);
      const createdKrathong: Krathong = { ...newKrathong, id: krathongId };
      setKrathongs(prev => [createdKrathong, ...prev]);
      setUserTeam(createdKrathong);
      setIsRegistrationOpen(false);
      alert(`Team "${teamName}" registered successfully! 🎉`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('Registration error:', error);
      alert('An error occurred during team registration');
    }
  };
  
  const handleAdjustScore = async (id: string, amount: number) => {
    if (!isUserAdmin) {
      alert('You do not have permission to adjust the score');
      return;
    }
    try {
      await updateKrathongScore(id, amount);
      setKrathongs(prev =>
        prev.map(k => 
          k.id === id ? { ...k, score: Math.max(0, k.score + amount) } : k
        ).sort((a, b) => b.score - a.score)
      );
    } catch (error) {
      console.error('Score adjustment error:', error);
      alert('An error occurred while adjusting the score');
    }
  };
  
  const handleViewDetails = (krathong: Krathong) => setSelectedKrathong(krathong);
  const handleCloseDetails = () => setSelectedKrathong(null);

  const handleToggleAdminView = () => {
    if (!isUserAdmin) {
      alert('You do not have permission to use the admin view');
      return;
    }
    setIsAdminView(!isAdminView);
  };

  const handleToggleRegistration = () => {
    if (!isUserAdmin) {
      alert('You do not have permission to modify system settings');
      return;
    }
    setRegistrationEnabled(!registrationEnabled);
    alert(`Team registration ${!registrationEnabled ? 'enabled' : 'disabled'}`);
  };

  const handleToggleVoting = () => {
    if (!isUserAdmin) {
      alert('You do not have permission to modify system settings');
      return;
    }
    setVotingEnabled(!votingEnabled);
    alert(`Voting system ${!votingEnabled ? 'enabled' : 'disabled'}`);
  };

  const isUserInTeam = (krathong: Krathong) => {
    return user && krathong.members.some(m => m.email === user.email);
  };

  const getVotingStats = () => {
    const totalVotes = Object.keys(userVotes).length;
    const totalTeams = krathongs.length;
    const averageVotes = totalTeams > 0 ? (totalVotes / totalTeams).toFixed(1) : '0';
    
    return { totalVotes, totalTeams, averageVotes };
  };

  const sortedKrathongs = [...krathongs].sort((a, b) => b.score - a.score);
  const votingStats = getVotingStats();

  return (
    <div className="min-h-screen text-white flex flex-col">
      <Header 
        user={user} 
        onLogin={handleLogin} 
        onLogout={handleLogout} 
        userTeam={userTeam}
        isAdmin={isUserAdmin}
        onToggleAdminView={handleToggleAdminView}
        onToggleRegistration={handleToggleRegistration}
        onToggleVoting={handleToggleVoting}
        isAdminView={isAdminView}
        registrationEnabled={registrationEnabled}
        votingEnabled={votingEnabled}
        onOpenRegistration={() => setIsRegistrationOpen(true)}
      />
      
      {/* Vote Success Notification */}
      {showVoteSuccess && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-bounce">
          <div className="flex items-center space-x-2">
            <span className="text-xl">🎉</span>
            <span>Voted for "{votedKrathongName}" successfully!</span>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* Admin Stats */}
        {isUserAdmin && isAdminView && (
          <div className="bg-blue-900/50 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold mb-2">📊 Voting Statistics</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold">{votingStats.totalVotes}</div>
                <div className="text-blue-300">Total Votes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{votingStats.totalTeams}</div>
                <div className="text-blue-300">Total Teams</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{votingStats.averageVotes}</div>
                <div className="text-blue-300">Avg Votes/Team</div>
              </div>
            </div>
          </div>
        )}

        {/* Voting Status Banner */}
        {user && votedKrathongId && (
          <div className="bg-yellow-600/50 rounded-lg p-4 mb-6 text-center">
            <div className="flex items-center justify-center space-x-2">
              <span className="text-xl">✅</span>
              <span>
                You have already voted for{" "}
                <strong>{krathongs.find(k => k.id === votedKrathongId)?.name || 'a team'}</strong>
              </span>
            </div>
          </div>
        )}

        {/* System Status */}
        {isUserAdmin && (
          <div className="bg-gray-800/50 rounded-lg p-3 mb-6 text-sm">
            <div className="flex flex-wrap gap-4 justify-center">
              <div className={`px-3 py-1 rounded-full ${registrationEnabled ? 'bg-green-600' : 'bg-red-600'}`}>
                Registration: {registrationEnabled ? 'OPEN' : 'CLOSED'}
              </div>
              <div className={`px-3 py-1 rounded-full ${votingEnabled ? 'bg-green-600' : 'bg-red-600'}`}>
                Voting: {votingEnabled ? 'OPEN' : 'CLOSED'}
              </div>
              <div className={`px-3 py-1 rounded-full ${isAdminView ? 'bg-purple-600' : 'bg-gray-600'}`}>
                Admin View: {isAdminView ? 'ON' : 'OFF'}
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Spinner />
          </div>
        ) : (
          <>
            {/* Mobile View */}
            <div className="md:hidden">
              <div className="flex overflow-x-auto space-x-4 pb-4 -mx-4 px-4 snap-x snap-mandatory">
                {sortedKrathongs.map((krathong) => (
                  <div key={krathong.id} className="w-80 flex-shrink-0 snap-start">
                    <KrathongCard
                      krathong={krathong}
                      onVote={handleVote}
                      canVote={!!user && votingEnabled && !votedKrathongId}
                      isVotedFor={votedKrathongId === krathong.id}
                      isVoting={votingInProgress === krathong.id}
                      isAdmin={isAdminView && isUserAdmin}
                      onAdjustScore={handleAdjustScore}
                      onViewDetails={handleViewDetails}
                      currentUserEmail={user?.email || null}
                      votingEnabled={votingEnabled}
                      isUserInTeam={isUserInTeam(krathong)}
                      onCancelVote={(userId) => handleCancelVote(userId, krathong.id)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop View */}
            <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedKrathongs.map((krathong) => (
                <div key={krathong.id}>
                  <KrathongCard
                    krathong={krathong}
                    onVote={handleVote}
                    canVote={!!user && votingEnabled && !votedKrathongId}
                    isVotedFor={votedKrathongId === krathong.id}
                    isVoting={votingInProgress === krathong.id}
                    isAdmin={isAdminView && isUserAdmin}
                    onAdjustScore={handleAdjustScore}
                    onViewDetails={handleViewDetails}
                    currentUserEmail={user?.email || null}
                    votingEnabled={votingEnabled}
                    isUserInTeam={isUserInTeam(krathong)}
                    onCancelVote={(userId) => handleCancelVote(userId, krathong.id)}
                  />
                </div>
              ))}
            </div>
          </>
        )}

        {/* Empty State */}
        {!loading && krathongs.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🏮</div>
            <h3 className="text-2xl font-semibold mb-2">No Teams Registered Yet</h3>
            <p className="text-gray-400 mb-6">Be the first to register your team!</p>
            {user && registrationEnabled && (
              <button
                onClick={() => setIsRegistrationOpen(true)}
                className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all"
              >
                Register Your Team
              </button>
            )}
          </div>
        )}
      </main>

      <Modal
        isOpen={isRegistrationOpen}
        onClose={() => setIsRegistrationOpen(false)}
        title="Team Registration"
      >
        <TeamRegistration 
          onRegister={handleRegisterTeam} 
          currentUser={user}
          registrationEnabled={registrationEnabled}
        />
      </Modal>

      <Modal
        isOpen={!!selectedKrathong}
        onClose={handleCloseDetails}
        title={selectedKrathong?.name ?? 'Krathong Details'}
        size="lg"
      >
        {selectedKrathong && (
          <KrathongDetail 
            krathong={selectedKrathong} 
            currentUserEmail={user?.email || null}
            isAdmin={isUserAdmin}
            onCancelVote={handleCancelVote}
          />
        )}
      </Modal>

      <footer className="text-center py-6 text-slate-500 text-sm mt-auto">
        <p>Developed with ❤️ for Loy Krathong Festival 2024</p>
        <p className="mt-1">Total Teams: {krathongs.length} | Total Votes: {votingStats.totalVotes}</p>
      </footer>
    </div>
  );
};

export default App;