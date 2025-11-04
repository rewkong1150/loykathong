import React, { useState, useRef, useEffect } from 'react';
import { TeamMember, AppUser } from '../types';
import { uploadImage } from '../config/firebase';
import { useNavigate } from 'react-router-dom';

interface TeamRegistrationProps {
  onRegister: (
    teamName: string,
    members: TeamMember[],
    krathongImageUrl: string,
    teamImageUrl: string
  ) => void;
  currentUser: AppUser | null;
}

const TeamRegistration: React.FC<TeamRegistrationProps> = ({
  onRegister,
  currentUser,
}) => {
  const navigate = useNavigate();
  const [teamName, setTeamName] = useState('');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);

  const [krathongImage, setKrathongImage] = useState<File | null>(null);
  const [teamImage, setTeamImage] = useState<File | null>(null);
  const [krathongImagePreview, setKrathongImagePreview] = useState<string>('');
  const [teamImagePreview, setTeamImagePreview] = useState<string>('');

  const krathongImageRef = useRef<HTMLInputElement>(null);
  const teamImageRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentUser && members.length === 0) {
      setMembers([
        {
          name: currentUser.displayName || 'ผู้ใช้',
          email: currentUser.email || '',
        },
      ]);
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
    if (members.some((member) => member.email === memberEmail)) {
      alert('มีอีเมลนี้ในทีมแล้ว');
      return;
    }
    setMembers([...members, { name: memberName, email: memberEmail }]);
    setMemberName('');
    setMemberEmail('');
  };

  const handleRemoveMember = (indexToRemove: number) => {
    if (
      indexToRemove === 0 &&
      currentUser &&
      members[0].email === currentUser.email
    ) {
      alert('ไม่สามารถลบตัวเองออกจากทีมได้');
      return;
    }
    setMembers(members.filter((_, index) => index !== indexToRemove));
  };

  const handleImageUpload = (file: File, type: 'krathong' | 'team') => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('กรุณาเลือกไฟล์รูปภาพเท่านั้น (PNG, JPG, JPEG)');
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    if (type === 'krathong') {
      setKrathongImage(file);
      setKrathongImagePreview(previewUrl);
    } else {
      setTeamImage(file);
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
      const krathongImageUrl = await uploadImage(
        krathongImage,
        `krathongs/${Date.now()}_${krathongImage.name}`
      );
      const teamImageUrl = await uploadImage(
        teamImage,
        `teams/${Date.now()}_${teamImage.name}`
      );

      setUploadingImages(false);
      onRegister(teamName, members, krathongImageUrl, teamImageUrl);

      // Reset
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

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="p-4 bg-slate-800 flex items-center justify-between shadow-md">
        <button
          onClick={() => navigate(-1)}
          className="text-slate-300 hover:text-white transition text-sm"
        >
          ← ย้อนกลับ
        </button>
        <h1 className="font-bold text-lg text-center flex-1">
          ลงทะเบียนทีมกระทง
        </h1>
        <div className="w-10"></div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <form
          onSubmit={handleSubmit}
          className="max-w-2xl mx-auto p-6 space-y-6"
        >
          {/* ชื่อทีม */}
          <div>
            <label className="block font-semibold mb-2 text-slate-200">
              ชื่อทีม
            </label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="เช่น ทีมแสงจันทร์ลอยน้ำ"
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-2 focus:ring focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>

          {/* สมาชิกทีม */}
          <div>
            <label className="block font-semibold mb-2 text-slate-200">
              รายชื่อสมาชิก
            </label>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="ชื่อ-นามสกุล"
                className="flex-1 rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
              />
              <input
                type="email"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                placeholder="อีเมล"
                className="flex-1 rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
              />
              <button
                type="button"
                onClick={handleAddMember}
                className="bg-indigo-600 hover:bg-indigo-700 rounded-lg px-4 py-2 text-white font-medium"
              >
                + เพิ่ม
              </button>
            </div>

            <ul className="mt-4 space-y-2">
              {members.map((m, i) => (
                <li
                  key={i}
                  className="flex justify-between items-center bg-slate-800 px-4 py-2 rounded-md"
                >
                  <span>
                    {i + 1}. {m.name} ({m.email})
                  </span>
                  {i !== 0 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(i)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      ลบ
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* รูปภาพ */}
          <div className="grid sm:grid-cols-2 gap-6">
            {/* Krathong Image */}
            <div>
              <label className="block font-semibold mb-2 text-slate-200">
                รูปภาพกระทง
              </label>
              {krathongImagePreview ? (
                <div className="relative">
                  <img
                    src={krathongImagePreview}
                    alt="Krathong"
                    className="rounded-lg w-full object-cover border border-slate-700"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setKrathongImage(null);
                      setKrathongImagePreview('');
                      if (krathongImageRef.current)
                        krathongImageRef.current.value = '';
                    }}
                    className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs"
                  >
                    ลบรูป
                  </button>
                </div>
              ) : (
                <input
                  ref={krathongImageRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    e.target.files &&
                    handleImageUpload(e.target.files[0], 'krathong')
                  }
                  className="w-full text-sm text-slate-300"
                />
              )}
            </div>

            {/* Team Image */}
            <div>
              <label className="block font-semibold mb-2 text-slate-200">
                รูปทีม
              </label>
              {teamImagePreview ? (
                <div className="relative">
                  <img
                    src={teamImagePreview}
                    alt="Team"
                    className="rounded-lg w-full object-cover border border-slate-700"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setTeamImage(null);
                      setTeamImagePreview('');
                      if (teamImageRef.current)
                        teamImageRef.current.value = '';
                    }}
                    className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs"
                  >
                    ลบรูป
                  </button>
                </div>
              ) : (
                <input
                  ref={teamImageRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    e.target.files &&
                    handleImageUpload(e.target.files[0], 'team')
                  }
                  className="w-full text-sm text-slate-300"
                />
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="text-center">
            <button
              type="submit"
              disabled={!teamName || members.length < 5 || isRegistering}
              className={`px-6 py-3 rounded-lg font-semibold ${
                !teamName || members.length < 5
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {uploadingImages
                ? 'กำลังอัปโหลดรูป...'
                : isRegistering
                ? 'กำลังลงทะเบียน...'
                : 'ลงทะเบียนทีม'}
            </button>
          </div>
        </form>
      </main>

      {/* Footer */}
      <footer className="p-3 text-center text-slate-500 text-sm border-t border-slate-700">
        © Loy Krathong Contest 2025
      </footer>
    </div>
  );
};

export default TeamRegistration;
