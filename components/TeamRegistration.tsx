import React, { useState, useRef } from 'react';
import { TeamMember, AppUser } from '../types';
import { storage, uploadImage } from '../config/firebase';

interface TeamRegistrationProps {
  onRegister: (teamName: string, members: TeamMember[], krathongImageUrl: string, teamImageUrl: string) => void;
  currentUser: AppUser | null;
}

const TeamRegistration: React.FC<TeamRegistrationProps> = ({ onRegister, currentUser }) => {
  const [teamName, setTeamName] = useState('');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  
  // State for image uploads
  const [krathongImage, setKrathongImage] = useState<File | null>(null);
  const [teamImage, setTeamImage] = useState<File | null>(null);
  const [krathongImagePreview, setKrathongImagePreview] = useState<string>('');
  const [teamImagePreview, setTeamImagePreview] = useState<string>('');
  
  const krathongImageRef = useRef<HTMLInputElement>(null);
  const teamImageRef = useRef<HTMLInputElement>(null);

  // Add current user as first member automatically
  React.useEffect(() => {
    if (currentUser && members.length === 0) {
      setMembers([{
        name: currentUser.displayName || 'ผู้ใช้',
        email: currentUser.email || ''
      }]);
    }
  }, [currentUser]);

  const handleAddMember = () => {
    if (!memberName.trim() || !memberEmail.trim()) {
      alert('กรุณากรอกชื่อและอีเมลของสมาชิก');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(memberEmail)) {
      alert('รูปแบบอีเมลไม่ถูกต้อง');
      return;
    }
    if (members.some(member => member.email === memberEmail)) {
      alert('มีอีเมลนี้ในทีมแล้ว');
      return;
    }
    setMembers([...members, { name: memberName, email: memberEmail }]);
    setMemberName('');
    setMemberEmail('');
  };

  const handleRemoveMember = (indexToRemove: number) => {
    // Don't allow removing the current user (first member)
    if (indexToRemove === 0 && currentUser && members[0].email === currentUser.email) {
      alert('ไม่สามารถลบตัวเองออกจากทีมได้');
      return;
    }
    setMembers(members.filter((_, index) => index !== indexToRemove));
  };

  const handleImageUpload = (file: File, type: 'krathong' | 'team') => {
    if (!file) return;

    // Validate file type only
    if (!file.type.startsWith('image/')) {
      alert('กรุณาเลือกไฟล์รูปภาพเท่านั้น (PNG, JPG, JPEG)');
      return;
    }

    if (type === 'krathong') {
      setKrathongImage(file);
      const previewUrl = URL.createObjectURL(file);
      setKrathongImagePreview(previewUrl);
    } else {
      setTeamImage(file);
      const previewUrl = URL.createObjectURL(file);
      setTeamImagePreview(previewUrl);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) {
      alert('กรุณาเข้าสู่ระบบก่อนลงทะเบียนทีม');
      return;
    }
    
    if (!teamName.trim()) {
      alert('กรุณาใส่ชื่อทีม');
      return;
    }
    
    if (members.length < 5) {
      alert('ทีมต้องมีสมาชิกอย่างน้อย 5 คน');
      return;
    }
    
    if (!krathongImage || !teamImage) {
      alert('กรุณาอัปโหลดรูปภาพทั้งสองรูป');
      return;
    }

    setIsRegistering(true);
    setUploadingImages(true);

    try {
      // Upload images to Firebase Storage
      const krathongImageUrl = await uploadImage(krathongImage, `krathongs/${Date.now()}_${krathongImage.name}`);
      const teamImageUrl = await uploadImage(teamImage, `teams/${Date.now()}_${teamImage.name}`);

      setUploadingImages(false);
      
      // Call the register function with image URLs
      onRegister(teamName, members, krathongImageUrl, teamImageUrl);
      
      // Reset form
      setTeamName('');
      setMembers([]);
      setKrathongImage(null);
      setTeamImage(null);
      setKrathongImagePreview('');
      setTeamImagePreview('');
      
      if (krathongImageRef.current) krathongImageRef.current.value = '';
      if (teamImageRef.current) teamImageRef.current.value = '';
      
    } catch (error) {
      console.error('Registration error:', error);
      alert('เกิดข้อผิดพลาดในการลงทะเบียนทีม');
    } finally {
      setIsRegistering(false);
      setUploadingImages(false);
    }
  };

  const removeImage = (type: 'krathong' | 'team') => {
    if (type === 'krathong') {
      setKrathongImage(null);
      setKrathongImagePreview('');
      if (krathongImageRef.current) krathongImageRef.current.value = '';
    } else {
      setTeamImage(null);
      setTeamImagePreview('');
      if (teamImageRef.current) teamImageRef.current.value = '';
    }
  };

  const canSubmit = !isRegistering && 
    teamName.trim() !== '' && 
    members.length >= 5 && 
    krathongImage && 
    teamImage;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="teamName" className="block text-sm font-medium text-slate-300 mb-2">
          ชื่อทีม / ชื่อกระทง *
        </label>
        <input
          id="teamName"
          type="text"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          placeholder="เช่น ทีมดอกไม้บาน, กระทงรักษ์โลก"
          className="w-full px-4 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
          required
          maxLength={50}
        />
        <p className="text-xs text-slate-400 mt-1">ไม่เกิน 50 ตัวอักษร</p>
      </div>

      <div className="space-y-4">
        {/* Krathong Image Upload */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            รูปกระทง (PNG, JPG) *
          </label>
          {krathongImagePreview ? (
            <div className="relative">
              <img 
                src={krathongImagePreview} 
                alt="Krathong preview" 
                className="w-full h-48 object-cover rounded-lg border-2 border-amber-400"
              />
              <button
                type="button"
                onClick={() => removeImage('krathong')}
                className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-1 rounded-full"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ) : (
            <div 
              className="w-full p-8 rounded-lg bg-slate-700 border-2 border-dashed border-slate-600 text-center cursor-pointer hover:border-amber-400 transition-colors"
              onClick={() => krathongImageRef.current?.click()}
            >
              <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="mt-2 text-sm text-slate-400">คลิกเพื่ออัปโหลดรูปกระทง</p>
              <p className="text-xs text-slate-500 mt-1">PNG, JPG</p>
            </div>
          )}
          <input
            ref={krathongImageRef}
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files && handleImageUpload(e.target.files[0], 'krathong')}
            className="hidden"
          />
        </div>

        {/* Team Image Upload */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            รูปทีมถ่ายกับกระทง (PNG, JPG) *
          </label>
          {teamImagePreview ? (
            <div className="relative">
              <img 
                src={teamImagePreview} 
                alt="Team preview" 
                className="w-full h-48 object-cover rounded-lg border-2 border-amber-400"
              />
              <button
                type="button"
                onClick={() => removeImage('team')}
                className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-1 rounded-full"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ) : (
            <div 
              className="w-full p-8 rounded-lg bg-slate-700 border-2 border-dashed border-slate-600 text-center cursor-pointer hover:border-amber-400 transition-colors"
              onClick={() => teamImageRef.current?.click()}
            >
              <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="mt-2 text-sm text-slate-400">คลิกเพื่ออัปโหลดรูปทีม</p>
              <p className="text-xs text-slate-500 mt-1">PNG, JPG</p>
            </div>
          )}
          <input
            ref={teamImageRef}
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files && handleImageUpload(e.target.files[0], 'team')}
            className="hidden"
          />
        </div>
      </div>

      <div className="border-t border-slate-600 pt-4">
        <div className="flex justify-between items-baseline mb-3">
          <h3 className="text-lg font-semibold text-slate-200">สมาชิกในทีม ({members.length}/5+)</h3>
          <p className="text-sm text-slate-400">ต้องมีสมาชิกอย่างน้อย 5 คน</p>
        </div>
        
        <div className="space-y-2 mb-4 max-h-40 overflow-y-auto pr-2">
          {members.map((member, index) => (
            <div key={index} className={`flex items-center justify-between p-3 rounded-lg animate-fade-in ${
              index === 0 && currentUser && member.email === currentUser.email 
                ? 'bg-green-900/30 border border-green-500' 
                : 'bg-slate-700'
            }`}>
              <div className="flex items-center space-x-3">
                <div>
                  <p className="font-medium text-white">{member.name}</p>
                  <p className="text-xs text-slate-400">{member.email}</p>
                </div>
                {index === 0 && currentUser && member.email === currentUser.email && (
                  <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">คุณ</span>
                )}
              </div>
              {index !== 0 || (currentUser && member.email !== currentUser.email) ? (
                <button 
                  type="button" 
                  onClick={() => handleRemoveMember(index)} 
                  className="text-red-400 hover:text-red-600 p-1 rounded-full transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </button>
              ) : (
                <div className="w-5 h-5"></div> // Spacer for alignment
              )}
            </div>
          ))}
          {members.length === 0 && <p className="text-sm text-slate-500 text-center py-2">ยังไม่มีสมาชิก</p>}
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 items-end">
          <div className="flex-grow">
            <label htmlFor="memberName" className="sr-only">ชื่อสมาชิก</label>
            <input
              id="memberName"
              type="text"
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              placeholder="ชื่อสมาชิก"
              className="w-full px-3 py-2 rounded-md bg-slate-600 text-white border border-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>
          <div className="flex-grow">
            <label htmlFor="memberEmail" className="sr-only">อีเมล</label>
            <input
              id="memberEmail"
              type="email"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              placeholder="อีเมล"
              className="w-full px-3 py-2 rounded-md bg-slate-600 text-white border border-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>
          <button
            type="button"
            onClick={handleAddMember}
            className="w-full sm:w-auto bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300 flex-shrink-0"
          >
            เพิ่ม
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-slate-900 font-bold py-3 px-6 rounded-lg transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
      >
        {isRegistering ? (
          <>
            {uploadingImages ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                กำลังอัปโหลดรูปภาพ...
              </>
            ) : (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                กำลังลงทะเบียน...
              </>
            )}
          </>
        ) : 'ยืนยันการลงทะเบียน'}
      </button>
      <p className="text-xs text-slate-400 mt-3 text-center">หลังจากลงทะเบียน กระทงของคุณจะปรากฏบนหน้าเว็บเพื่อรอรับคะแนนโหวต</p>
    </form>
  );
};

export default TeamRegistration;