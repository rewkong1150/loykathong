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
  deleteField
} from 'firebase/firestore';
import { Krathong } from '../types';

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

// Firestore functions
export const getKrathongs = async (): Promise<Krathong[]> => {
  try {
    const q = query(collection(db, 'krathongs'), orderBy('score', 'desc'));
    const querySnapshot = await getDocs(q);
    const krathongs: Krathong[] = [];
    
    querySnapshot.forEach((doc) => {
      krathongs.push({
        id: doc.id,
        ...doc.data()
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
    const docRef = await addDoc(collection(db, 'krathongs'), {
      ...krathong,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
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
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating score:', error);
    throw error;
  }
};

export const voteForKrathong = async (krathongId: string, userId: string): Promise<void> => {
  try {
    // ตรวจสอบก่อนว่าผู้ใช้โหวตไปแล้วหรือยัง
    const existingVote = await checkUserVote(userId);
    const votedKrathongIds = Object.keys(existingVote);
    
    if (votedKrathongIds.length > 0) {
      throw new Error('User has already voted');
    }

    // Record the vote in user's vote history (เก็บแค่ krathongId เดียว)
    const userVoteRef = doc(db, 'userVotes', userId);
    await setDoc(userVoteRef, {
      votedKrathongId: krathongId, // 👈 เปลี่ยนจาก array เป็น field เดียว
      votedAt: new Date().toISOString(),
      userEmail: auth.currentUser?.email // เก็บ email ด้วยสำหรับการตรวจสอบ
    });

    // Update krathong score
    await updateKrathongScore(krathongId, 10);
  } catch (error) {
    console.error('Error voting:', error);
    throw error;
  }
};

export const checkUserVote = async (userId: string): Promise<Record<string, boolean>> => {
  try {
    const userVoteRef = doc(db, 'userVotes', userId);
    const userVoteDoc = await getDoc(userVoteRef);
    
    if (userVoteDoc.exists()) {
      const data = userVoteDoc.data();
      // 👇 เปลี่ยนจากการอ่าน array มาเป็นอ่าน field เดียว
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

// 🔥 ฟังก์ชันใหม่: ยกเลิกการโหวต
export const cancelUserVote = async (userId: string, krathongId: string): Promise<void> => {
  try {
    const userVoteRef = doc(db, 'userVotes', userId);
    
    // ลบข้อมูลการโหวต
    await updateDoc(userVoteRef, {
      votedKrathongId: deleteField(),
      votedAt: deleteField()
    });
    
    // ลดคะแนนของ krathong
    await updateKrathongScore(krathongId, -10);
  } catch (error) {
    console.error('Error canceling vote:', error);
    throw error;
  }
};

export const checkUserInTeam = async (userEmail: string | null): Promise<Krathong | null> => {
  if (!userEmail) return null;
  
  try {
    const q = query(
      collection(db, 'krathongs'),
      where('members', 'array-contains', { email: userEmail.toLowerCase() }) // 👈 ใช้ lowercase
    );
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data()
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
    // นับจำนวน user ที่โหวตแล้ว
    const userVotesSnapshot = await getDocs(collection(db, 'userVotes'));
    const totalVotes = userVotesSnapshot.size;
    
    // นับจำนวนทีม
    const krathongsSnapshot = await getDocs(collection(db, 'krathongs'));
    const totalTeams = krathongsSnapshot.size;
    
    return {
      totalVotes,
      totalTeams,
      averageVotes: totalTeams > 0 ? (totalVotes / totalTeams).toFixed(1) : '0'
    };
  } catch (error) {
    console.error('Error getting voting stats:', error);
    return { totalVotes: 0, totalTeams: 0, averageVotes: '0' };
  }
};