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
  db, 
  signInWithGoogle, 
  signOutUser,
  getKrathongs,
  addKrathong,
  updateKrathongScore,
  voteForKrathong,
  checkUserVote,
  checkUserInTeam
} from './config/firebase';

// List of admin emails
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

  // Fix scroll issue
  useEffect(() => {
    document.documentElement.style.height = '100%';
    document.documentElement.style.margin = '0';
    document.documentElement.style.padding = '0';
    document.body.style.height = '100%';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflowY = 'auto';

    return () => {
      document.documentElement.style.height = '';
      document.documentElement.style.margin = '';
      document.documentElement.style.padding = '';
      document.body.style.height = '';
      document.body.style.margin = '';
      document.body.style.padding = '';
      document.body.style.overflowY = '';
    };
  }, []);

  // Check if user is admin
  const checkAdminStatus = (email: string | null): boolean => {
    return email ? ADMIN_EMAILS.includes(email.toLowerCase()) : false;
  };

  // Auth state listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser as AppUser);
        
        // Check if user is admin
        const adminStatus = checkAdminStatus(firebaseUser.email);
        setIsUserAdmin(adminStatus);
        
        // If user is not admin, make sure admin view is disabled
        if (!adminStatus && isAdminView) {
          setIsAdminView(false);
        }

        // Load user's vote history
        const votes = await checkUserVote(firebaseUser.uid);
        setUserVotes(votes);

        // Check if user is in a team
        const team = await checkUserInTeam(firebaseUser.email);
        setUserTeam(team);
      } else {
        setUser(null);
        setIsUserAdmin(false);
        setUserVotes({});
        setUserTeam(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load krathongs
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
      alert('เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
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
      alert('กรุณาเข้าสู่ระบบเพื่อโหวต');
      return;
    }

    if (!votingEnabled) {
      alert('ระบบโหวตปิดชั่วคราว');
      return;
    }

    // 🔒 ป้องกันการโหวตทีมตัวเอง
    const krathongToVote = krathongs.find(k => k.id === id);
    if (krathongToVote && krathongToVote.members.some(member => 
      member.email.toLowerCase() === user.email?.toLowerCase()
    )) {
      alert('ไม่สามารถโหวตให้ทีมตัวเองได้! ❌');
      return;
    }

    if (userVotes[id]) {
      alert('คุณได้โหวตให้กระทงนี้ไปแล้ว!');
      return;
    }

    setVotingInProgress(id);
    
    try {
      await voteForKrathong(id, user.uid);
      
      // Update local state
      setKrathongs(prevKrathongs =>
        prevKrathongs.map(k =>
          k.id === id ? { ...k, score: k.score + 1 } : k
        ).sort((a, b) => b.score - a.score)
      );
      
      setUserVotes(prev => ({ ...prev, [id]: true }));
      
      const krathongName = krathongs.find(k => k.id === id)?.name;
      alert(`โหวตให้ "${krathongName}" สำเร็จ! 🎉`);
    } catch (error) {
      console.error('Vote error:', error);
      alert('เกิดข้อผิดพลาดในการโหวต');
    } finally {
      setVotingInProgress(null);
    }
  };

  const handleRegisterTeam = async (teamName: string, members: TeamMember[], krathongImageUrl: string, teamImageUrl: string) => {
    if (!user) {
      alert('กรุณาเข้าสู่ระบบก่อนลงทะเบียนทีม');
      return;
    }

    // Check if user is already in a team
    if (userTeam) {
      alert(`คุณเป็นสมาชิกของทีม "${userTeam.name}" อยู่แล้ว ไม่สามารถสร้างทีมใหม่ได้`);
      return;
    }

    try {
      const newKrathong: Omit<Krathong, 'id'> = {
        name: teamName,
        krathongImageUrl: krathongImageUrl,
        teamImageUrl: teamImageUrl,
        score: 0,
        members: members,
      };

      const krathongId = await addKrathong(newKrathong);
      
      // Add to local state
      const createdKrathong: Krathong = {
        ...newKrathong,
        id: krathongId
      };
      
      setKrathongs(prev => [createdKrathong, ...prev]);
      setUserTeam(createdKrathong);
      setIsRegistrationOpen(false);
      
      alert(`ทีม "${teamName}" ลงทะเบียนสำเร็จ! 🎉`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('Registration error:', error);
      alert('เกิดข้อผิดพลาดในการลงทะเบียนทีม');
    }
  };
  
  const handleAdjustScore = async (id: string, amount: number) => {
    if (!isUserAdmin) {
      alert('คุณไม่มีสิทธิ์ในการปรับคะแนน');
      return;
    }

    try {
      await updateKrathongScore(id, amount);
      
      // Update local state
      setKrathongs(prevKrathongs =>
        prevKrathongs.map(k =>
          k.id === id
            ? { ...k, score: Math.max(0, k.score + amount) }
            : k
        ).sort((a, b) => b.score - a.score)
      );
    } catch (error) {
      console.error('Score adjustment error:', error);
      alert('เกิดข้อผิดพลาดในการปรับคะแนน');
    }
  };
  
  const handleViewDetails = (krathong: Krathong) => {
    setSelectedKrathong(krathong);
  };
  
  const handleCloseDetails = () => {
    setSelectedKrathong(null);
  };

  const handleToggleAdminView = () => {
    if (!isUserAdmin) {
      alert('คุณไม่มีสิทธิ์ในการใช้งานมุมมองผู้ดูแลระบบ');
      return;
    }
    setIsAdminView(!isAdminView);
  };

  const handleToggleRegistration = () => {
    if (!isUserAdmin) {
      alert('คุณไม่มีสิทธิ์ในการปรับการตั้งค่าระบบ');
      return;
    }
    setRegistrationEnabled(!registrationEnabled);
  };

  const handleToggleVoting = () => {
    if (!isUserAdmin) {
      alert('คุณไม่มีสิทธิ์ในการปรับการตั้งค่าระบบ');
      return;
    }
    setVotingEnabled(!votingEnabled);
  };

  const isUserInTeam = (krathong: Krathong) => {
    return user && krathong.members.some(member => member.email === user.email);
  };

  const sortedKrathongs = [...krathongs].sort((a, b) => b.score - a.score);

  return (
    <div 
      className="min-h-screen text-white flex flex-col"
      style={{ 
        minHeight: '100vh',
        height: '100%'
      }}
    >
      <Header 
        user={user} 
        onLogin={handleLogin} 
        onLogout={handleLogout} 
        userTeam={userTeam}
        isAdmin={isUserAdmin}
      />
      
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        
        <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-400 mb-4">
                ร่วมเป็นส่วนหนึ่งของการประกวด
            </h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto mb-6">
                สร้างสรรค์กระทงของคุณและส่งเข้าประกวดเพื่อชิงรางวัล! ลงทะเบียนทีมของคุณได้เลย
            </p>
            
            {user && userTeam && (
              <div className="bg-green-900/30 border border-green-500 rounded-lg p-4 mb-6 max-w-2xl mx-auto">
                <p className="text-green-300 font-semibold">
                  🎉 คุณเป็นสมาชิกของทีม: <span className="text-amber-300">{userTeam.name}</span>
                </p>
                <p className="text-green-200 text-sm mt-1">
                  คะแนนปัจจุบัน: <span className="font-bold">{userTeam.score}</span> คะแนน
                </p>
              </div>
            )}

            {isUserAdmin && (
              <div className="bg-amber-900/30 border border-amber-500 rounded-lg p-4 mb-6 max-w-2xl mx-auto">
                <p className="text-amber-300 font-semibold">
                  👑 คุณเป็นผู้ดูแลระบบ
                </p>
                <p className="text-amber-200 text-sm mt-1">
                  คุณสามารถใช้งานฟังก์ชันผู้ดูแลระบบได้ทั้งหมด
                </p>
              </div>
            )}

            <button
                onClick={() => {
                  if (!user) {
                    handleLogin();
                    return;
                  }
                  if (userTeam) {
                    alert(`คุณเป็นสมาชิกของทีม "${userTeam.name}" อยู่แล้ว ไม่สามารถสร้างทีมใหม่ได้`);
                    return;
                  }
                  setIsRegistrationOpen(true);
                }}
                disabled={!registrationEnabled}
                className={`font-bold py-3 px-8 rounded-full transition duration-300 ease-in-out transform hover:scale-105 text-lg shadow-lg ${
                  registrationEnabled 
                  ? 'bg-gradient-to-r from-green-400 to-teal-500 hover:from-green-500 hover:to-teal-600 text-white' 
                  : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                }`}
            >
                {!user ? 'เข้าสู่ระบบเพื่อลงทะเบียน' : 
                 userTeam ? 'คุณได้ลงทะเบียนทีมแล้ว' :
                 registrationEnabled ? 'ลงทะเบียนทีมเข้าประกวด' : 'ปิดรับสมัครแล้ว'}
            </button>
        </div>

        {/* Admin Controls */}
        {isUserAdmin && (
          <div className="flex justify-center items-center gap-6 mb-8 flex-wrap">
            <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={isAdminView} 
                  onChange={handleToggleAdminView}
                  className="sr-only peer" 
                />
                <div className="w-14 h-8 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-amber-500"></div>
                <span className="ml-3 text-md font-medium text-slate-200">
                    {isAdminView ? 'มุมมองผู้ดูแลระบบ' : 'มุมมองผู้ใช้ทั่วไป'}
                </span>
            </label>
            {isAdminView && (
              <div className="flex justify-center items-center gap-6 flex-wrap animate-fade-in">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={registrationEnabled} 
                    onChange={handleToggleRegistration}
                    className="sr-only peer" 
                  />
                  <div className="w-14 h-8 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-500"></div>
                  <span className="ml-3 text-md font-medium text-slate-200">
                      {registrationEnabled ? 'เปิดรับสมัคร' : 'ปิดรับสมัคร'}
                  </span>
                </label>
                 <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={votingEnabled} 
                    onChange={handleToggleVoting}
                    className="sr-only peer" 
                  />
                  <div className="w-14 h-8 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-sky-300/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-sky-500"></div>
                  <span className="ml-3 text-md font-medium text-slate-200">
                      {votingEnabled ? 'เปิดโหวต' : 'ปิดโหวต'}
                  </span>
                </label>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Spinner />
          </div>
        ) : (
          <>
            {/* Mobile View - Horizontal Scroll */}
            <div className="md:hidden">
              <div className="flex overflow-x-auto space-x-4 pb-4 -mx-4 px-4 snap-x snap-mandatory">
                {sortedKrathongs.map((krathong) => (
                  <div key={krathong.id} className="w-80 flex-shrink-0 snap-start">
                    <KrathongCard
                      krathong={krathong}
                      onVote={handleVote}
                      canVote={!!user && votingEnabled}
                      isVotedFor={!!userVotes[krathong.id]}
                      isVoting={votingInProgress === krathong.id}
                      isAdmin={isAdminView && isUserAdmin}
                      onAdjustScore={handleAdjustScore}
                      onViewDetails={handleViewDetails}
                      currentUserEmail={user?.email || null}
                      votingEnabled={votingEnabled}
                      isUserInTeam={isUserInTeam(krathong)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop View - Grid */}
            <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedKrathongs.map((krathong) => (
                <div key={krathong.id}>
                  <KrathongCard
                    krathong={krathong}
                    onVote={handleVote}
                    canVote={!!user && votingEnabled}
                    isVotedFor={!!userVotes[krathong.id]}
                    isVoting={votingInProgress === krathong.id}
                    isAdmin={isAdminView && isUserAdmin}
                    onAdjustScore={handleAdjustScore}
                    onViewDetails={handleViewDetails}
                    currentUserEmail={user?.email || null}
                    votingEnabled={votingEnabled}
                    isUserInTeam={isUserInTeam(krathong)}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      <Modal
        isOpen={isRegistrationOpen}
        onClose={() => setIsRegistrationOpen(false)}
        title="ลงทะเบียนทีมประกวด"
      >
          <TeamRegistration 
            onRegister={handleRegisterTeam} 
            currentUser={user}
          />
      </Modal>

      <Modal
        isOpen={!!selectedKrathong}
        onClose={handleCloseDetails}
        title={selectedKrathong?.name ?? 'รายละเอียดกระทง'}
      >
        {selectedKrathong && (
          <KrathongDetail 
            krathong={selectedKrathong} 
            currentUserEmail={user?.email || null}
          />
        )}
      </Modal>

      <footer className="text-center py-6 text-slate-500 text-sm mt-auto">
        <p>Developed with ❤️ for Loy Krathong Festival</p>
      </footer>
    </div>
  );
};

export default App;