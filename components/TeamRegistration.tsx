import React, { useState, useRef, useEffect } from 'react';
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
  onClose: () => void;
  registrationEnabled?: boolean;
}

const TeamRegistration: React.FC<TeamRegistrationProps> = ({
  onRegister,
  currentUser,
  onClose,
  registrationEnabled = true
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

  useEffect(() => {
    if (currentUser && members.length === 0) {
      setMembers([
        {
          name: currentUser.displayName || 'User',
          email: currentUser.email || '',
        },
      ]);
    }
  }, [currentUser]);

  const handleAddMember = () => {
    if (!memberName.trim() || !memberEmail.trim()) {
      alert('Please enter member name and email');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(memberEmail)) {
      alert('Invalid email format');
      return;
    }
    if (members.some((member) => member.email === memberEmail)) {
      alert('This email is already in the team');
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
      alert('You cannot remove yourself from the team');
      return;
    }
    setMembers(members.filter((_, index) => index !== indexToRemove));
  };

  const handleImageUpload = (file: File, type: 'krathong' | 'team') => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file only (PNG, JPG, JPEG)');
      return;
    }
    // ✅ เอาข้อจำกัดขนาดไฟล์ออก - อัพโหลดได้ไม่จำกัดขนาด
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

    if (!registrationEnabled) {
      alert('Team registration is currently closed');
      return;
    }

    if (!currentUser) {
      alert('Please log in before registering a team');
      return;
    }
    if (!teamName.trim()) {
      alert('Please enter a team name');
      return;
    }
    if (members.length < 5) {
      alert('The team must have at least 5 members');
      return;
    }
    if (!krathongImage || !teamImage) {
      alert('Please upload both images');
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
      await onRegister(teamName, members, krathongImageUrl, teamImageUrl);

      onClose();
    } catch (error) {
      console.error('Registration error:', error);
      alert('An error occurred while registering the team');
    } finally {
      setIsRegistering(false);
      setUploadingImages(false);
    }
  };

  const handleClose = () => {
    if (isRegistering || uploadingImages) {
      const confirmClose = window.confirm(
        'Registration is in progress. Are you sure you want to close?'
      );
      if (!confirmClose) return;
    }
    onClose();
  };

  if (!registrationEnabled) {
    return (
      <div className="max-w-md mx-auto p-6 text-center">
        <div className="bg-red-600/20 border border-red-600 rounded-lg p-6">
          <div className="text-4xl mb-4">🚫</div>
          <h2 className="text-xl font-bold text-red-400 mb-2">Registration Closed</h2>
          <p className="text-gray-300 mb-4">
            Team registration is currently unavailable. Please check back later.
          </p>
          <button
            onClick={onClose}
            className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-slate-800 p-4 flex items-center justify-between border-b border-slate-700">
        <button
          onClick={handleClose}
          className="text-slate-300 hover:text-white transition flex items-center gap-2 px-3 py-1 rounded-lg hover:bg-slate-700"
          disabled={isRegistering || uploadingImages}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Close
        </button>
        <h1 className="font-bold text-lg text-white">Team Registration</h1>
        <div className="w-10"></div>
      </div>

      {/* Registration Form */}
      <div className="p-6 space-y-6">
        {/* Registration Status */}
        <div className="bg-green-600/20 border border-green-600 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🎉</div>
            <div>
              <h3 className="font-semibold text-green-400">Registration Open</h3>
              <p className="text-sm text-green-300">Team registration is currently available</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Team Name */}
          <div>
            <label className="block font-semibold mb-2 text-white">
              Team Name *
            </label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Enter your team name"
              className="w-full rounded-lg bg-slate-800 border border-slate-600 px-4 py-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              disabled={isRegistering}
            />
          </div>

          {/* Team Members */}
          <div>
            <label className="block font-semibold mb-2 text-white">
              Team Members * ({members.length}/5+)
            </label>
            <p className="text-sm text-gray-400 mb-3">
              Minimum 5 members required. You are automatically added as the first member.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <input
                type="text"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="Full Name"
                className="flex-1 rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-white placeholder-gray-400"
                disabled={isRegistering}
              />
              <input
                type="email"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                placeholder="Email Address"
                className="flex-1 rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-white placeholder-gray-400"
                disabled={isRegistering}
              />
              <button
                type="button"
                onClick={handleAddMember}
                disabled={isRegistering}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg px-4 py-2 text-white font-medium transition"
              >
                + Add
              </button>
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto">
              {members.map((member, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center bg-slate-800 px-4 py-3 rounded-lg border border-slate-700"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-400 w-6">{index + 1}.</span>
                    <div>
                      <div className="text-white font-medium">{member.name}</div>
                      <div className="text-sm text-gray-400">{member.email}</div>
                    </div>
                    {index === 0 && (
                      <span className="bg-blue-600 text-xs px-2 py-1 rounded">You</span>
                    )}
                  </div>
                  {index !== 0 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(index)}
                      disabled={isRegistering}
                      className="text-red-400 hover:text-red-300 disabled:text-gray-500 text-sm px-2 py-1 rounded hover:bg-red-600/20 transition"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Images */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Krathong Image */}
            <div>
              <label className="block font-semibold mb-2 text-white">
                Krathong Photo *
              </label>
              {krathongImagePreview ? (
                <div className="relative group">
                  <img
                    src={krathongImagePreview}
                    alt="Krathong preview"
                    className="rounded-lg w-full h-48 object-cover border-2 border-green-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setKrathongImage(null);
                      setKrathongImagePreview('');
                      if (krathongImageRef.current)
                        krathongImageRef.current.value = '';
                    }}
                    disabled={isRegistering}
                    className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white p-2 rounded-full transition opacity-0 group-hover:opacity-100"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center hover:border-slate-500 transition">
                  <input
                    ref={krathongImageRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      e.target.files &&
                      handleImageUpload(e.target.files[0], 'krathong')
                    }
                    disabled={isRegistering}
                    className="hidden"
                    id="krathong-image"
                  />
                  <label
                    htmlFor="krathong-image"
                    className="cursor-pointer disabled:cursor-not-allowed block"
                  >
                    <div className="text-4xl mb-2">🏮</div>
                    <div className="text-white font-medium">Upload Krathong Photo</div>
                    <div className="text-sm text-gray-400 mt-1">PNG, JPG, JPEG (Any size)</div> {/* ✅ เปลี่ยนข้อความ */}
                  </label>
                </div>
              )}
            </div>

            {/* Team Image */}
            <div>
              <label className="block font-semibold mb-2 text-white">
                Team Selfie with Krathong *
              </label>
              {teamImagePreview ? (
                <div className="relative group">
                  <img
                    src={teamImagePreview}
                    alt="Team preview"
                    className="rounded-lg w-full h-48 object-cover border-2 border-green-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setTeamImage(null);
                      setTeamImagePreview('');
                      if (teamImageRef.current)
                        teamImageRef.current.value = '';
                    }}
                    disabled={isRegistering}
                    className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white p-2 rounded-full transition opacity-0 group-hover:opacity-100"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center hover:border-slate-500 transition">
                  <input
                    ref={teamImageRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      e.target.files &&
                      handleImageUpload(e.target.files[0], 'team')
                    }
                    disabled={isRegistering}
                    className="hidden"
                    id="team-image"
                  />
                  <label
                    htmlFor="team-image"
                    className="cursor-pointer disabled:cursor-not-allowed block"
                  >
                    <div className="text-4xl mb-2">👥</div>
                    <div className="text-white font-medium">Upload Team Selfie</div>
                    <div className="text-sm text-gray-400 mt-1">PNG, JPG, JPEG (Any size)</div> {/* ✅ เปลี่ยนข้อความ */}
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={!teamName || members.length < 5 || !krathongImage || !teamImage || isRegistering}
              className={`w-full py-4 rounded-lg font-semibold text-lg transition ${
                !teamName || members.length < 5 || !krathongImage || !teamImage
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg'
              }`}
            >
              {uploadingImages ? (
                <div className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Uploading Images...
                </div>
              ) : isRegistering ? (
                <div className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Registering Team...
                </div>
              ) : (
                `Register Team (${members.length} members)`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TeamRegistration;