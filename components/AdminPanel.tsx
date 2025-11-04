
import React, { useState } from 'react';

interface AdminPanelProps {
  onAddKrathong: (name: string) => Promise<void>;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onAddKrathong }) => {
  const [krathongName, setKrathongName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!krathongName.trim()) {
      alert('กรุณาใส่ชื่อกระทง');
      return;
    }
    setIsAdding(true);
    try {
      await onAddKrathong(krathongName);
      setKrathongName('');
    } catch (error) {
      console.error("Error adding krathong:", error);
      alert('เกิดข้อผิดพลาดในการเพิ่มกระทง');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="bg-slate-800/50 p-6 rounded-xl shadow-lg my-8 max-w-2xl mx-auto backdrop-blur-sm border border-amber-300/20">
      <h2 className="text-2xl font-bold text-amber-300 mb-4 text-center">แผงควบคุมสำหรับแอดมิน</h2>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-4">
        <input
          type="text"
          value={krathongName}
          onChange={(e) => setKrathongName(e.target.value)}
          placeholder="ชื่อกระทง"
          className="w-full px-4 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
        />
        <button
          type="submit"
          disabled={isAdding}
          className="w-full sm:w-auto bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-6 rounded-lg transition duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isAdding ? (
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : 'เพิ่มกระทง'}
        </button>
      </form>
      <p className="text-xs text-slate-400 mt-3 text-center">รูปภาพกระทงจะถูกสร้างขึ้นแบบสุ่ม</p>
    </div>
  );
};

export default AdminPanel;
