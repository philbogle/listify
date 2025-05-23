
export interface Subitem {
  id: string;
  title: string;
  completed: boolean;
}

export interface List {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  subitems: Subitem[];
  createdAt?: any; // Firestore Timestamp or server timestamp
}
