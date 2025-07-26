
export interface Subitem {
  id: string;
  title: string;
  completed: boolean;
  isHeader?: boolean; // Added to distinguish section headers
}

export interface List {
  id:string;
  title: string;
  completed: boolean;
  subitems: Subitem[];
  createdAt?: any; // Firestore Timestamp or server timestamp
  userId?: string; // Added for user-specific data
  shareId?: string | null; // Unique ID for public sharing
}
