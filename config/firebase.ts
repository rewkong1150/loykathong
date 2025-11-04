import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  doc, 
  query, 
  where, 
  orderBy,
  arrayUnion,
  increment,
  getDoc,
  setDoc,
  deleteField,
  runTransaction
} from 'firebase/firestore';
import { Krathong, AppConfig } from '../types';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCiB-M3jQWIZA5AgxuSQPxrK_rY5OAbo5w",
  authDomain: "login-9835c.firebaseapp.com",
  databaseURL: "https://login-9835c-default-rtdb.firebaseio.com",
  projectId: "login-9835c",
  storageBucket: "login-9835c.firebasestorage.app",
  messagingSenderId: "684699802531",
  appId: "1:684699802531:web:12e0cb309687487748d816"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

// Helper function to convert Date to ISO string
const toISOString = (date: Date): string => date.toISOString();

// Default app configuration
const DEFAULT_APP_CONFIG: AppConfig = {
  registrationEnabled: true,
  votingEnabled: true,
  lastUpdated: toISOString(new Date()),
  updatedBy: 'system'
};

// Auth functions
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

// 🔥 App Configuration Functions
export const getAppConfig = async (): Promise<AppConfig> => {
  try {
    const configDoc = await getDoc(doc(db, 'app', 'config'));
    if (configDoc.exists()) {
      return configDoc.data() as AppConfig;
    } else {
      // Create default configuration if it doesn't exist
      await setDoc(doc(db, 'app', 'config'), DEFAULT_APP_CONFIG);
      return DEFAULT_APP_CONFIG;
    }
  } catch (error) {
    console.error('Error getting app config:', error);
    // Return default config if error
    return DEFAULT_APP_CONFIG;
  }
};

export const updateAppConfig = async (config: Partial<AppConfig>): Promise<void> => {
  try {
    const currentUser = auth.currentUser;
    const updatedConfig = {
      ...config,
      lastUpdated: toISOString(new Date()),
      updatedBy: currentUser?.email || 'unknown'
    };
    
    await setDoc(doc(db, 'app', 'config'), updatedConfig, { merge: true });
    console.log('App config updated successfully:', updatedConfig);
  } catch (error) {
    console.error('Error updating app config:', error);
    throw error;
  }
};

export const toggleRegistration = async (): Promise<boolean> => {
  try {
    const currentConfig = await getAppConfig();
    const newRegistrationStatus = !currentConfig.registrationEnabled;
    
    await updateAppConfig({ registrationEnabled: newRegistrationStatus });
    return newRegistrationStatus;
  } catch (error) {
    console.error('Error toggling registration:', error);
    throw error;
  }
};

export const toggleVoting = async (): Promise<boolean> => {
  try {
    const currentConfig = await getAppConfig();
    const newVotingStatus = !currentConfig.votingEnabled;
    
    await updateAppConfig({ votingEnabled: newVotingStatus });
    return newVotingStatus;
  } catch (error) {
    console.error('Error toggling voting:', error);
    throw error;
  }
};

// Firestore functions
export const getKrathongs = async (): Promise<Krathong[]> => {
  try {
    const q = query(collection(db, 'krathongs'), orderBy('score', 'desc'));
    const querySnapshot = await getDocs(q);
    const krathongs: Krathong[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      krathongs.push({
        id: doc.id,
        name: data.name,
        krathongImageUrl: data.krathongImageUrl,
        teamImageUrl: data.teamImageUrl,
        score: data.score || 0,
        members: data.members || [],
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        createdBy: data.createdBy,
        createdByEmail: data.createdByEmail,
        lastVotedAt: data.lastVotedAt
      } as Krathong);
    });
    
    return krathongs;
  } catch (error) {
    console.error('Error getting krathongs:', error);
    throw error;
  }
};

export const addKrathong = async (krathong: Omit<Krathong, 'id'>): Promise<string> => {
  try {
    // Check if registration is enabled
    const config = await getAppConfig();
    if (!config.registrationEnabled) {
      throw new Error('REGISTRATION_CLOSED');
    }

    const currentUser = auth.currentUser;
    const now = toISOString(new Date());
    
    const krathongData = {
      ...krathong,
      createdAt: now,
      updatedAt: now,
      createdBy: currentUser?.uid,
      createdByEmail: currentUser?.email,
      score: 0 // Ensure score starts at 0
    };

    const docRef = await addDoc(collection(db, 'krathongs'), krathongData);
    
    console.log('Krathong added successfully:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error adding krathong:', error);
    throw error;
  }
};

export const updateKrathongScore = async (krathongId: string, amount: number): Promise<void> => {
  try {
    const krathongRef = doc(db, 'krathongs', krathongId);
    await updateDoc(krathongRef, {
      score: increment(amount),
      updatedAt: toISOString(new Date())
    });
    
    console.log('Krathong score updated:', krathongId, 'amount:', amount);
  } catch (error) {
    console.error('Error updating score:', error);
    throw error;
  }
};

// 🔥 Enhanced vote function with app config check
export const voteForKrathong = async (krathongId: string, userId: string): Promise<boolean> => {
  try {
    // Check if voting is enabled
    const config = await getAppConfig();
    if (!config.votingEnabled) {
      throw new Error('VOTING_CLOSED');
    }

    // ตรวจสอบก่อนว่าผู้ใช้โหวตไปแล้วหรือยัง (นอก transaction)
    const existingVote = await checkUserVote(userId);
    const votedKrathongIds = Object.keys(existingVote);
    
    if (votedKrathongIds.length > 0) {
      console.log('User has already voted for:', votedKrathongIds[0]);
      return false; // โหวตซ้ำ
    }

    // ใช้ transaction เพื่อความปลอดภัย
    await runTransaction(db, async (transaction) => {
      // 🔥 อ่านทั้งหมดก่อน (ทั้ง userVote และ krathong)
      const userVoteRef = doc(db, 'userVotes', userId);
      const krathongRef = doc(db, 'krathongs', krathongId);
      
      const [userVoteDoc, krathongDoc] = await Promise.all([
        transaction.get(userVoteRef),
        transaction.get(krathongRef)
      ]);
      
      // ตรวจสอบว่าผู้ใช้ยังไม่โหวต
      if (userVoteDoc.exists() && userVoteDoc.data().votedKrathongId) {
        throw new Error('ALREADY_VOTED');
      }

      // ตรวจสอบว่า krathong มีอยู่
      if (!krathongDoc.exists()) {
        throw new Error('KRATHONG_NOT_FOUND');
      }

      // 🔥 หลังจากอ่านทั้งหมดแล้ว ค่อยเขียน
      // Record the vote
      transaction.set(userVoteRef, {
        votedKrathongId: krathongId,
        votedAt: toISOString(new Date()),
        userEmail: auth.currentUser?.email,
        userId: userId,
        krathongName: krathongDoc.data().name
      });

      // Update krathong score
      const currentScore = krathongDoc.data().score || 0;
      transaction.update(krathongRef, {
        score: currentScore + 10,
        updatedAt: toISOString(new Date()),
        lastVotedAt: toISOString(new Date())
      });
    });

    console.log('Vote successful for krathong:', krathongId);
    return true; // โหวตสำเร็จ

  } catch (error: any) {
    console.error('Error voting:', error);
    
    if (error.message === 'ALREADY_VOTED' || error.message.includes('already voted')) {
      return false; // โหวตซ้ำ
    }
    
    if (error.message === 'VOTING_CLOSED') {
      throw new Error('VOTING_CLOSED');
    }
    
    if (error.message === 'KRATHONG_NOT_FOUND') {
      throw new Error('Krathong not found');
    }
    
    throw error; // error อื่นๆ
  }
};

export const checkUserVote = async (userId: string): Promise<Record<string, boolean>> => {
  try {
    const userVoteRef = doc(db, 'userVotes', userId);
    const userVoteDoc = await getDoc(userVoteRef);
    
    if (userVoteDoc.exists()) {
      const data = userVoteDoc.data();
      if (data.votedKrathongId) {
        return { [data.votedKrathongId]: true };
      }
    }
    
    return {};
  } catch (error) {
    console.error('Error checking user vote:', error);
    return {};
  }
};

// 🔥 ฟังก์ชันใหม่: ดึงข้อมูลการโหวตของผู้ใช้ (สำหรับแสดงผล)
export const getUserVoteInfo = async (userId: string) => {
  try {
    const userVoteRef = doc(db, 'userVotes', userId);
    const userVoteDoc = await getDoc(userVoteRef);
    
    if (userVoteDoc.exists()) {
      const data = userVoteDoc.data();
      if (data.votedKrathongId) {
        // ดึงข้อมูล krathong ที่โหวต
        const krathongRef = doc(db, 'krathongs', data.votedKrathongId);
        const krathongDoc = await getDoc(krathongRef);
        
        if (krathongDoc.exists()) {
          return {
            votedKrathongId: data.votedKrathongId,
            votedAt: data.votedAt,
            krathongName: krathongDoc.data().name,
            krathongImage: krathongDoc.data().krathongImageUrl
          };
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting user vote info:', error);
    return null;
  }
};

// 🔥 ฟังก์ชันใหม่: ยกเลิกการโหวต (สำหรับ admin)
export const cancelUserVote = async (userId: string, krathongId: string): Promise<boolean> => {
  try {
    const userVoteRef = doc(db, 'userVotes', userId);
    const userVoteDoc = await getDoc(userVoteRef);
    
    if (!userVoteDoc.exists() || userVoteDoc.data().votedKrathongId !== krathongId) {
      return false; // ไม่พบการโหวต
    }

    // ลบข้อมูลการโหวต
    await updateDoc(userVoteRef, {
      votedKrathongId: deleteField(),
      votedAt: deleteField(),
      userEmail: deleteField(),
      krathongName: deleteField()
    });
    
    // ลดคะแนนของ krathong
    await updateKrathongScore(krathongId, -10);
    
    console.log('Vote canceled successfully for user:', userId);
    return true; // ยกเลิกสำเร็จ
  } catch (error) {
    console.error('Error canceling vote:', error);
    throw error;
  }
};

// 🔥 ฟังก์ชันใหม่: รีเซ็ตการโหวตทั้งหมด (สำหรับ admin)
export const resetAllVotes = async (): Promise<boolean> => {
  try {
    // ดึงข้อมูลการโหวตทั้งหมด
    const userVotesSnapshot = await getDocs(collection(db, 'userVotes'));
    
    // ลบการโหวตทั้งหมด
    const deletePromises = userVotesSnapshot.docs.map(doc => 
      updateDoc(doc.ref, {
        votedKrathongId: deleteField(),
        votedAt: deleteField(),
        userEmail: deleteField(),
        krathongName: deleteField()
      })
    );
    
    await Promise.all(deletePromises);
    
    // รีเซ็ตคะแนน krathongs ทั้งหมดเป็น 0
    const krathongsSnapshot = await getDocs(collection(db, 'krathongs'));
    const resetPromises = krathongsSnapshot.docs.map(doc =>
      updateDoc(doc.ref, {
        score: 0,
        updatedAt: toISOString(new Date())
      })
    );
    
    await Promise.all(resetPromises);
    
    console.log('All votes reset successfully');
    return true;
  } catch (error) {
    console.error('Error resetting all votes:', error);
    throw error;
  }
};

export const checkUserInTeam = async (userEmail: string | null): Promise<Krathong | null> => {
  if (!userEmail) return null;
  
  try {
    const q = query(
      collection(db, 'krathongs'),
      where('members', 'array-contains', { email: userEmail.toLowerCase() })
    );
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        krathongImageUrl: data.krathongImageUrl,
        teamImageUrl: data.teamImageUrl,
        score: data.score || 0,
        members: data.members || [],
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        createdBy: data.createdBy,
        createdByEmail: data.createdByEmail,
        lastVotedAt: data.lastVotedAt
      } as Krathong;
    }
    
    return null;
  } catch (error) {
    console.error('Error checking user team:', error);
    return null;
  }
};

export const uploadImage = async (file: File, path: string): Promise<string> => {
  try {
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
};

// 🔥 ฟังก์ชันใหม่: ดึงสถิติการโหวต
export const getVotingStats = async () => {
  try {
    const userVotesSnapshot = await getDocs(collection(db, 'userVotes'));
    const totalVotes = userVotesSnapshot.size;
    
    const krathongsSnapshot = await getDocs(collection(db, 'krathongs'));
    const totalTeams = krathongsSnapshot.size;
    
    // ดึงคะแนนรวมทั้งหมด
    let totalScore = 0;
    krathongsSnapshot.forEach(doc => {
      totalScore += doc.data().score || 0;
    });
    
    return {
      totalVotes,
      totalTeams,
      totalScore,
      averageVotes: totalTeams > 0 ? (totalVotes / totalTeams).toFixed(1) : '0',
      averageScore: totalTeams > 0 ? (totalScore / totalTeams).toFixed(1) : '0'
    };
  } catch (error) {
    console.error('Error getting voting stats:', error);
    return { 
      totalVotes: 0, 
      totalTeams: 0, 
      totalScore: 0,
      averageVotes: '0', 
      averageScore: '0' 
    };
  }
};

// 🔥 ฟังก์ชันใหม่: ตรวจสอบว่า user โหวต krathong นี้ไปแล้วหรือไม่
export const hasUserVotedForKrathong = async (userId: string, krathongId: string): Promise<boolean> => {
  try {
    const userVoteRef = doc(db, 'userVotes', userId);
    const userVoteDoc = await getDoc(userVoteRef);
    
    if (userVoteDoc.exists()) {
      const data = userVoteDoc.data();
      return data.votedKrathongId === krathongId;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking specific vote:', error);
    return false;
  }
};

// 🔥 ฟังก์ชันใหม่: ดึงประวัติการโหวตทั้งหมด (สำหรับ admin)
export const getAllVotes = async () => {
  try {
    const userVotesSnapshot = await getDocs(collection(db, 'userVotes'));
    const votes: any[] = [];
    
    userVotesSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.votedKrathongId) {
        votes.push({
          id: doc.id,
          ...data
        });
      }
    });
    
    return votes;
  } catch (error) {
    console.error('Error getting all votes:', error);
    return [];
  }
};

// 🔥 ฟังก์ชันใหม่: ตรวจสอบสถานะระบบ
export const getSystemStatus = async () => {
  try {
    const config = await getAppConfig();
    const stats = await getVotingStats();
    
    return {
      config,
      stats,
      serverTime: toISOString(new Date()),
      totalUsers: stats.totalVotes, // จำนวนผู้โหวต
      systemStatus: 'online'
    };
  } catch (error) {
    console.error('Error getting system status:', error);
    return {
      config: DEFAULT_APP_CONFIG,
      stats: { totalVotes: 0, totalTeams: 0, totalScore: 0, averageVotes: '0', averageScore: '0' },
      serverTime: toISOString(new Date()),
      totalUsers: 0,
      systemStatus: 'error'
    };
  }
};

// 🔥 ฟังก์ชันใหม่: บันทึกกิจกรรม (logging)
export const logAdminActivity = async (activity: string, details?: any) => {
  try {
    const currentUser = auth.currentUser;
    await addDoc(collection(db, 'adminLogs'), {
      activity,
      details,
      userEmail: currentUser?.email,
      userId: currentUser?.uid,
      timestamp: toISOString(new Date())
    });
  } catch (error) {
    console.error('Error logging admin activity:', error);
  }
};

// 🔥 ฟังก์ชันใหม่: ส่งการแจ้งเตือนเมื่อมีการเปลี่ยนแปลงการตั้งค่าระบบ
export const broadcastSystemUpdate = async (updateType: 'registration' | 'voting', newStatus: boolean) => {
  try {
    await addDoc(collection(db, 'systemNotifications'), {
      type: 'system_update',
      updateType,
      newStatus,
      timestamp: toISOString(new Date()),
      message: `${updateType === 'registration' ? 'Registration' : 'Voting'} has been ${newStatus ? 'enabled' : 'disabled'}`
    });
  } catch (error) {
    console.error('Error broadcasting system update:', error);
  }
};