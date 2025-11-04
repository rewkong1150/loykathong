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

  const [krathongImage, setKrathongImage] = useState<File | null>(null);
  const [teamImage, setTeamImage] = useState<File | null>(null);
  const [krathongImagePreview, setKrathongImagePreview] = useState<string>('');
  const [teamImagePreview, setTeamImagePreview] = useState<string>('');

  const krathongImageRef = useRef<HTMLInputElement>(null);
  const teamImageRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
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
    if (indexToRemove === 0 && currentUser && members[0].email === currentUser.email) {
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

  const canSubmit =
    !isRegistering &&
    teamName.trim() !== '' &&
    members.length >= 5 &&
    krathongImage &&
    teamImage;

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-lg mx-auto p-4 sm:p-6 space-y-6 overflow-y-auto"
    >
      {/* TEAM NAME */}
      <div>
        <label className="block text-sm font-medium text-slate-200 mb-2">
          ชื่อทีม / ชื่อกระทง *
        </label>
        <input
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          placeholder="เช่น ทีมดอกไม้บาน, กระทงรักษ์โลก"
          className="w-full px-4 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:ring-2 focus:ring-amber-400"
        />
        <p className="text-xs text-slate-400 mt-1">ไม่เกิน 50 ตัวอักษร</p>
      </div>

      {/* UPLOAD IMAGES */}
      <div className="space-y-6">
        {[
          { label: 'รูปกระทง (PNG, JPG) *', preview: krathongImagePreview, type: 'krathong' },
          { label: 'รูปทีมถ่ายกับกระทง (PNG, JPG) *', preview: teamImagePreview, type: 'team' },
        ].map(({ label, preview, type }) => (
          <div key={type}>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              {label}
            </label>
            {preview ? (
              <div className="relative">
                <img
                  src={preview}
                  className="w-full h-40 sm:h-48 object-cover rounded-lg border-2 border-amber-400"
                />
                <button
                  type="button"
                  onClick={() => removeImage(type as 'krathong' | 'team')}
                  className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-1 rounded-full"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div
                className="w-full p-6 rounded-lg bg-slate-700 border-2 border-dashed border-slate-600 text-center cursor-pointer hover:border-amber-400 transition"
                onClick={() =>
                  (type === 'krathong'
                    ? krathongImageRef.current
                    : teamImageRef.current
                  )?.click()
                }
              >
                <p className="text-sm text-slate-300">คลิกเพื่ออัปโหลด</p>
              </div>
            )}
            <input
              ref={type === 'krathong' ? krathongImageRef : teamImageRef}
              type="file"
              accept="image/*"
              onChange={(e) =>
                e.target.files && handleImageUpload(e.target.files[0], type as 'krathong' | 'team')
              }
              className="hidden"
            />
          </div>
        ))}
      </div>

      {/* TEAM MEMBERS */}
      <div className="border-t border-slate-600 pt-4">
        <div className="flex justify-between items-baseline mb-3">
          <h3 className="text-lg font-semibold text-slate-200">
            สมาชิกในทีม ({members.length}/5+)
          </h3>
          <p className="text-sm text-slate-400">ต้องมีอย่างน้อย 5 คน</p>
        </div>

        <div className="space-y-2 mb-4 max-h-40 overflow-y-auto pr-2">
          {members.map((member, index) => (
            <div
              key={index}
              className={`flex items-center justify-between p-3 rounded-lg ${
                index === 0 &&
                currentUser &&
                member.email === currentUser.email
                  ? 'bg-green-900/30 border border-green-500'
                  : 'bg-slate-700'
              }`}
            >
              <div>
                <p className="font-medium text-white">{member.name}</p>
                <p className="text-xs text-slate-300">{member.email}</p>
              </div>
              {index !== 0 && (
                <button
                  type="button"
                  onClick={() => handleRemoveMember(index)}
                  className="text-red-400 hover:text-red-600"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {members.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-2">
              ยังไม่มีสมาชิก
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch">
          <input
            type="text"
            placeholder="ชื่อสมาชิก"
            value={memberName}
            onChange={(e) => setMemberName(e.target.value)}
            className="flex-1 px-3 py-2 rounded-md bg-slate-600 text-white border border-slate-500 focus:ring-1 focus:ring-amber-400"
          />
          <input
            type="email"
            placeholder="อีเมล"
            value={memberEmail}
            onChange={(e) => setMemberEmail(e.target.value)}
            className="flex-1 px-3 py-2 rounded-md bg-slate-600 text-white border border-slate-500 focus:ring-1 focus:ring-amber-400"
          />
          <button
            type="button"
            onClick={handleAddMember}
            className="w-full sm:w-auto bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded-lg"
          >
            เพิ่ม
          </button>
        </div>
      </div>

      {/* SUBMIT */}
      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full mt-4 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-slate-900 font-bold py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isRegistering
          ? uploadingImages
            ? 'กำลังอัปโหลดรูปภาพ...'
            : 'กำลังลงทะเบียน...'
          : 'ยืนยันการลงทะเบียน'}
      </button>

      <p className="text-xs text-slate-400 mt-3 text-center">
        หลังจากลงทะเบียน กระทงของคุณจะปรากฏบนหน้าเว็บเพื่อรอรับคะแนนโหวต
      </p>
    </form>
  );
};

export default TeamRegistration;
