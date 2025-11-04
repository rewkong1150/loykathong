import React, { useState, useRef } from 'react';
import { TeamMember, AppUser } from '../types';
import { uploadImage } from '../config/firebase';

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

  const canSubmit =
    !isRegistering &&
    teamName.trim() !== '' &&
    members.length >= 5 &&
    krathongImage &&
    teamImage;

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="p-4 bg-slate-800 text-center font-bold text-lg">
        ลงทะเบียนทีมกระทง
      </header>

      {/* Scrollable content */}
      <main className="flex-1 overflow-y-auto">
        <form
          onSubmit={handleSubmit}
          className="max-w-lg mx-auto p-4 sm:p-6 space-y-6 pb-24"
        >
          {/* ... เนื้อหาทั้งหมดของฟอร์ม (เหมือนเดิม) ... */}
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
