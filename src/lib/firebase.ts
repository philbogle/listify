
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
  // deleteField, // No longer used
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
import {
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  type FirebaseStorage,
} from "firebase/storage";
import type { List, Subitem } from "@/types/list";
import { firebaseConfig } from "./firebaseConfig";

let app: FirebaseApp;
let db: Firestore;
let auth: ReturnType<typeof getAuth>;
let storage: FirebaseStorage; // Added Firebase Storage

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  storage = getStorage(app); // Initialize Firebase Storage
} catch (error) {
  console.error("Error initializing Firebase:", error);
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY") {
    console.warn(
      "Firebase is not configured. Please update src/lib/firebaseConfig.ts. Auth, Firestore, and Storage features will not work."
    );
  }
}

const LISTS_COLLECTION = "tasks";

const getDb = () => {
  if (!db) {
    try {
      const currentApp = initializeApp(firebaseConfig); 
      db = getFirestore(currentApp);
    } catch (e) {
      console.error("Critical Firebase initialization error (Firestore):", e);
      throw new Error("Firebase Firestore could not be initialized. Check your firebaseConfig.ts.");
    }
  }
  return db;
};

const getFirebaseAuth = () => {
  if (!auth) {
    try {
      auth = getAuth(app); 
    } catch (e) {
      console.error("Critical Firebase Auth initialization error:", e);
      throw new Error("Firebase Auth could not be initialized.");
    }
  }
  return auth;
}

const getFirebaseStorage = () => {
  if (!storage) {
    try {
      storage = getStorage(app);
    } catch (e) {
      console.error("Critical Firebase Storage initialization error:", e);
      throw new Error("Firebase Storage could not be initialized.");
    }
  }
  return storage;
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
    callback(null); 
    return () => {}; 
  }
  const firebaseAuth = getFirebaseAuth();
  return onAuthStateChanged(firebaseAuth, callback);
};


// List Functions
export const addListToFirebase = async (listData: Omit<List, "id" | "createdAt" | "scanImageUrl">, userId: string): Promise<List> => {
  const currentDb = getDb();
  const docData: any = {
    title: listData.title,
    completed: listData.completed,
    subtasks: listData.subitems.map(si => ({ id: si.id, title: si.title, completed: si.completed })),
    createdAt: serverTimestamp(),
    userId: userId,
  };
  // scanImageUrl will be added in a subsequent update after image upload
  const docRef = await addDoc(collection(currentDb, LISTS_COLLECTION), docData);
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
        where("userId", "==", userId), 
        orderBy("createdAt", "desc")
    );
    const querySnapshot: QuerySnapshot<DocumentData> = await getDocs(q);
    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        completed: data.completed,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
        subitems: (data.subtasks || []).map((st: any) => ({
          id: st.id || crypto.randomUUID(),
          title: st.title,
          completed: st.completed
        })),
        userId: data.userId,
        scanImageUrl: data.scanImageUrl, // Include scanImageUrl
      } as List;
    });
  } catch (error: any) { 
    console.error("Error fetching lists from Firebase:", error);
    if (error.code === 'permission-denied') {
      console.error("FIREBASE PERMISSION DENIED: Please check your Firestore security rules in the Firebase console. Ensure that authenticated users are allowed to read documents from the 'tasks' collection where their userId matches the document's userId field.");
    } else if (error.code === 'failed-precondition') {
      console.error("FIREBASE FAILED PRECONDITION: This often means a required Firestore index is missing. Please check the 'Indexes' tab in your Firestore database in the Firebase console. You likely need a composite index for the 'tasks' collection on 'userId' (ascending) AND 'createdAt' (descending). The Firebase console might also show a direct link to create this missing index in its error logs.");
    } else {
      console.error("This could be due to Firestore security rules or missing indexes. Please check your Firebase console.");
    }
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
  if (updates.userId === undefined && firebaseUpdates.userId !== undefined) { 
    delete firebaseUpdates.userId;
  }
  // scanImageUrl can be directly in updates

  await updateDoc(listRef, firebaseUpdates);
};

export const deleteListFromFirebase = async (listId: string): Promise<void> => {
  const currentDb = getDb();
  await deleteDoc(doc(currentDb, LISTS_COLLECTION, listId));
  // Note: Deleting the associated image from Firebase Storage is not handled here.
  // That would require additional logic and knowledge of the image path.
};

export const updateSubitemsInFirebase = async (listId: string, subitems: Subitem[]): Promise<void> => {
  const currentDb = getDb();
  const listRef = doc(currentDb, LISTS_COLLECTION, listId);
  const subtasksForFirebase = subitems.map(si => ({ id: si.id, title: si.title, completed: si.completed }));
  await updateDoc(listRef, { subtasks: subtasksForFirebase });
};

// Firebase Storage Function
export const uploadScanImageToFirebase = async (file: File, userId: string, listId: string): Promise<string> => {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase not configured. Image upload unavailable.");
  }
  const currentStorage = getFirebaseStorage();
  const filePath = `scans/${userId}/${listId}/${file.name}`;
  const imageRef = storageRef(currentStorage, filePath);

  const uploadTask = uploadBytesResumable(imageRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        // Optional: handle progress (snapshot.bytesTransferred / snapshot.totalBytes) * 100
      },
      (error) => {
        console.error("Error uploading image to Firebase Storage:", error);
        reject(error);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        } catch (error) {
          console.error("Error getting download URL:", error);
          reject(error);
        }
      }
    );
  });
};


export const isFirebaseConfigured = (): boolean => {
  const configured = !!firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY" && firebaseConfig.projectId !== "YOUR_PROJECT_ID";
  return configured;
};
