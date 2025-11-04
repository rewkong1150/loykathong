export interface TeamMember {
  name: string;
  email: string;
  department: string;
}

export interface Krathong {
  id: string;
  name: string;
  krathongImageUrl: string;
  teamImageUrl: string;
  score: number;
  members: TeamMember[];
  createdAt?: string;  // ใช้ string แทน Date
  updatedAt?: string;  // ใช้ string แทน Date
  createdBy?: string;
  createdByEmail?: string;
  lastVotedAt?: string;  // ใช้ string แทน Date
}

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface AppConfig {
  registrationEnabled: boolean;
  votingEnabled: boolean;
  lastUpdated: string;  // ใช้ string แทน Date
  updatedBy: string;
}

export interface VotingStats {
  totalVotes: number;
  totalTeams: number;
  totalScore: number;
  averageVotes: string;
  averageScore: string;
}

export interface SystemStatus {
  config: AppConfig;
  stats: VotingStats;
  serverTime: string;  // ใช้ string แทน Date
  totalUsers: number;
  systemStatus: 'online' | 'offline' | 'error';
}