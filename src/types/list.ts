
export interface Subitem {
  id: string;
  title: string;
  completed: boolean;
}

export interface List {
  id:string;
  title: string;
  completed: boolean;
  subitems: Subitem[];
  createdAt?: any; // Firestore Timestamp or server timestamp
  userId?: string; // Added for user-specific data
  scanImageUrls?: string[]; // URL of the scanned image in Firebase Storage
  shareId?: string | null; // Unique ID for public sharing
}

