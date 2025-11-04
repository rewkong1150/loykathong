import { User as FirebaseUser } from "firebase/auth";

export interface TeamMember {
  name: string;
  email: string;
}

export interface Krathong {
  id: string;
  name: string;
  krathongImageUrl: string;
  teamImageUrl: string;
  score: number;
  members: TeamMember[];
}

export interface AppUser extends FirebaseUser {}