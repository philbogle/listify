
import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  type Firestore,
  deleteField,
  where, 
  type DocumentData,
  type QuerySnapshot,
} from "firebase/firestore";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut, // Renamed to avoid conflict
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import type { List, Subitem } from "@/types/list";
import { firebaseConfig } from "./firebaseConfig";

let app: FirebaseApp;
let db: Firestore;
let auth: ReturnType<typeof getAuth>;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
} catch (error) {
  console.error("Error initializing Firebase:", error);
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY") {
    console.warn(
      "Firebase is not configured. Please update src/lib/firebaseConfig.ts. Auth and Firestore features will not work."
    );
  }
}

const LISTS_COLLECTION = "tasks";

const getDb = () => {
  if (!db) {
    try {
      const currentApp = initializeApp(firebaseConfig); // Should reuse 'app' if already initialized
      db = getFirestore(currentApp);
    } catch (e) {
      console.error("Critical Firebase initialization error:", e);
      throw new Error("Firebase could not be initialized. Check your firebaseConfig.ts.");
    }
  }
  return db;
};

const getFirebaseAuth = () => {
  if (!auth) {
    try {
      auth = getAuth(app); // app should be initialized at module scope
    } catch (e) {
      console.error("Critical Firebase Auth initialization error:", e);
      throw new Error("Firebase Auth could not be initialized.");
    }
  }
  return auth;
}

// Authentication Functions
export const signInWithGoogle = async (): Promise<User | null> => {
  if (!isFirebaseConfigured()) {
    console.warn("Firebase not configured. Google Sign-In unavailable.");
    return null;
  }
  const provider = new GoogleAuthProvider();
  const firebaseAuth = getFirebaseAuth();
  try {
    const result = await signInWithPopup(firebaseAuth, provider);
    return result.user;
  } catch (error) {
    console.error("Error during Google Sign-In:", error);
    // Handle specific errors (e.g., popup closed by user) if needed
    return null;
  }
};

export const signOutUser = async (): Promise<void> => {
  if (!isFirebaseConfigured()) {
    console.warn("Firebase not configured. Sign out unavailable.");
    return;
  }
  const firebaseAuth = getFirebaseAuth();
  try {
    await firebaseSignOut(firebaseAuth);
  } catch (error) {
    console.error("Error signing out:", error);
  }
};

export const onAuthUserChanged = (callback: (user: User | null) => void): (() => void) => {
  if (!isFirebaseConfigured()) {
    console.warn("Firebase not configured. Auth state changes won't be monitored.");
    callback(null); // Immediately call back with null user
    return () => {}; // Return a no-op unsubscribe function
  }
  const firebaseAuth = getFirebaseAuth();
  return onAuthStateChanged(firebaseAuth, callback);
};


// List Functions
export const addListToFirebase = async (listData: Omit<List, "id" | "createdAt">, userId: string): Promise<List> => {
  const currentDb = getDb();
  const docRef = await addDoc(collection(currentDb, LISTS_COLLECTION), {
    title: listData.title,
    completed: listData.completed,
    subtasks: listData.subitems.map(si => ({ id: si.id, title: si.title, completed: si.completed })),
    createdAt: serverTimestamp(),
    userId: userId, // Add userId
  });
  return { ...listData, id: docRef.id, userId, createdAt: new Date().toISOString() };
};

export const getListsFromFirebase = async (userId: string): Promise<List[]> => {
  if (!isFirebaseConfigured()) {
    console.warn("Firebase not configured, returning empty array for lists.");
    return [];
  }
  if (!userId) {
    console.warn("No user ID provided for fetching lists, returning empty array.");
    return [];
  }
  const currentDb = getDb();
  try {
    const q = query(
        collection(currentDb, LISTS_COLLECTION),
        where("userId", "==", userId), // Filter by userId
        orderBy("createdAt", "desc")
    );
    const querySnapshot: QuerySnapshot<DocumentData> = await getDocs(q);
    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        completed: data.completed,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(), // Handle Timestamp
        subitems: (data.subtasks || []).map((st: any) => ({
          id: st.id || crypto.randomUUID(),
          title: st.title,
          completed: st.completed
        })),
        userId: data.userId,
      } as List;
    });
  } catch (error) {
    console.error("Error fetching lists from Firebase:", error);
    console.error("This could be due to Firestore security rules or missing indexes. Please check your Firebase console.");
    console.error("Specifically, ensure you have an index on the 'tasks' collection for 'userId' (ascending) and 'createdAt' (descending).");
    throw error;
  }
};

export const updateListInFirebase = async (listId: string, updates: Partial<List>): Promise<void> => {
  const currentDb = getDb();
  const listRef = doc(currentDb, LISTS_COLLECTION, listId);

  const firebaseUpdates: any = { ...updates };
  if (updates.subitems !== undefined) {
    firebaseUpdates.subtasks = updates.subitems.map(si => ({ id: si.id, title: si.title, completed: si.completed }));
    delete firebaseUpdates.subitems;
  }
  if (updates.createdAt === undefined && firebaseUpdates.createdAt !== undefined) {
    delete firebaseUpdates.createdAt;
  }
  if (updates.userId === undefined && firebaseUpdates.userId !== undefined) { // Don't allow changing userId via this function
    delete firebaseUpdates.userId;
  }


  await updateDoc(listRef, firebaseUpdates);
};

export const deleteListFromFirebase = async (listId: string): Promise<void> => {
  const currentDb = getDb();
  await deleteDoc(doc(currentDb, LISTS_COLLECTION, listId));
};

export const updateSubitemsInFirebase = async (listId: string, subitems: Subitem[]): Promise<void> => {
  const currentDb = getDb();
  const listRef = doc(currentDb, LISTS_COLLECTION, listId);
  const subtasksForFirebase = subitems.map(si => ({ id: si.id, title: si.title, completed: si.completed }));
  await updateDoc(listRef, { subtasks: subtasksForFirebase });
};


export const isFirebaseConfigured = (): boolean => {
  const configured = !!firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY" && firebaseConfig.projectId !== "YOUR_PROJECT_ID";
  if (!configured && (typeof window !== 'undefined')) { // Check for window to avoid SSR console warnings
    console.warn("Firebase configuration is missing or using placeholder values in src/lib/firebaseConfig.ts. Features requiring Firebase will not work correctly.");
  }
  return configured;
};
