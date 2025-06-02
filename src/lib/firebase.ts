
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
  where,
  type DocumentData,
  type QuerySnapshot,
  limit,
  getDoc,
  onSnapshot, 
  type Unsubscribe, 
} from "firebase/firestore";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
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
let storage: FirebaseStorage;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  storage = getStorage(app);
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

export const addListToFirebase = async (listData: Omit<List, "id" | "createdAt">, userId: string): Promise<List> => {
  const currentDb = getDb();
  const docData: any = {
    title: listData.title,
    completed: listData.completed,
    subtasks: listData.subitems.map(si => ({ id: si.id, title: si.title, completed: si.completed })),
    createdAt: serverTimestamp(),
    userId: userId,
    scanImageUrls: listData.scanImageUrls || [],
    shareId: null,
  };
  const docRef = await addDoc(collection(currentDb, LISTS_COLLECTION), docData);
  // For serverTimestamp, we can't know the exact value client-side immediately.
  // We'll use the client's current time as an optimistic value. Firestore listener will provide the true server time.
  return { 
    ...listData, 
    id: docRef.id, 
    userId, 
    createdAt: new Date().toISOString(), // Optimistic createdAt
    scanImageUrls: docData.scanImageUrls, 
    shareId: null 
  };
};

const mapDocToList = (docSnap: DocumentData): List => {
  const data = docSnap.data();
  if (!data) {
    throw new Error(`Document data is undefined for doc.id: ${docSnap.id}`);
  }

  let scanUrls: string[] = [];
  if (data.scanImageUrls && Array.isArray(data.scanImageUrls)) {
    scanUrls = data.scanImageUrls;
  } else if (data.scanImageUrl && typeof data.scanImageUrl === 'string') {
    scanUrls = [data.scanImageUrl];
  }

  return {
    id: docSnap.id,
    title: data.title,
    completed: data.completed,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
    subitems: (data.subtasks || []).map((st: any) => ({
      id: st.id || crypto.randomUUID(),
      title: st.title,
      completed: st.completed
    })),
    userId: data.userId,
    scanImageUrls: scanUrls,
    shareId: data.shareId || null,
  } as List;
};

export const listenToActiveLists = (
  userId: string,
  callback: (lists: List[]) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  if (!isFirebaseConfigured()) {
    onError(new Error("Firebase not configured. Cannot listen to active lists."));
    return () => {};
  }
  if (!userId) {
    onError(new Error("No user ID provided for listening to active lists."));
    return () => {};
  }
  const currentDb = getDb();
  const q = query(
    collection(currentDb, LISTS_COLLECTION),
    where("userId", "==", userId),
    where("completed", "==", false),
    orderBy("createdAt", "desc")
  );

  const unsubscribe = onSnapshot(q, (querySnapshot: QuerySnapshot<DocumentData>) => {
    const lists = querySnapshot.docs.map(mapDocToList);
    callback(lists);
  }, (error: any) => {
    console.error("Error listening to active lists from Firebase:", error);
    if (error.code === 'permission-denied') {
      onError(new Error("Permission denied while listening to active lists. Check Firestore security rules."));
    } else if (error.code === 'failed-precondition') {
      onError(new Error("Missing Firestore index for listening to active lists. Check Firebase console for index creation link."));
    } else {
      onError(new Error("Unexpected error listening to active lists."));
    }
  });

  return unsubscribe;
};


export const getCompletedListsFromFirebase = async (userId: string): Promise<List[]> => {
  if (!isFirebaseConfigured()) {
    console.warn("Firebase not configured, returning empty array for completed lists.");
    return [];
  }
  if (!userId) {
    console.warn("No user ID provided for fetching completed lists, returning empty array.");
    return [];
  }
  const currentDb = getDb();
  try {
    const q = query(
        collection(currentDb, LISTS_COLLECTION),
        where("userId", "==", userId),
        where("completed", "==", true),
        orderBy("createdAt", "desc")
    );
    const querySnapshot: QuerySnapshot<DocumentData> = await getDocs(q);
    return querySnapshot.docs.map(mapDocToList);
  } catch (error: any) {
    console.error("Error fetching completed lists from Firebase:", error);
     if (error.code === 'permission-denied') {
      console.error("FIREBASE PERMISSION DENIED (Completed Lists): Please check your Firestore security rules.");
    } else if (error.code === 'failed-precondition') {
      console.error("FIREBASE FAILED PRECONDITION (Completed Lists): This often means a required Firestore index is missing. You likely need a composite index for the 'tasks' collection on 'userId' (ascending), 'completed' (ascending), AND 'createdAt' (descending). Check the Firebase console for a link to create it.");
    } else {
      console.error("An unexpected error occurred while fetching completed lists. This could be due to Firestore security rules or missing indexes. Please check your Firebase console.");
    }
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

  // Prevent client from trying to update server-managed fields directly if they are part of Partial<List>
  if (firebaseUpdates.createdAt !== undefined && !(firebaseUpdates.createdAt instanceof Date) && typeof firebaseUpdates.createdAt !== 'object') {
     // if createdAt is being set by serverTimestamp, it's an object, otherwise it might be an ISO string from client state.
     // We generally don't want clients to overwrite createdAt unless it's a migration.
     // For simplicity here, if it's not a serverTimestamp marker, don't send it.
     // This could be refined if client-settable createdAt is needed.
    delete firebaseUpdates.createdAt;
  }
  if (firebaseUpdates.id !== undefined) delete firebaseUpdates.id;
  // userId is typically not updated after creation, but if it were, it needs careful handling.

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

export const uploadScanImageToFirebase = async (file: File, userId: string, listId: string): Promise<string> => {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase not configured. Image upload unavailable.");
  }
  const currentStorage = getFirebaseStorage();
  const fileName = `${Date.now()}-${file.name}`;
  const filePath = `scans/${userId}/${listId}/${fileName}`;
  const imageRef = storageRef(currentStorage, filePath);

  const uploadTask = uploadBytesResumable(imageRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {},
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


export const getListByShareId = async (shareId: string): Promise<List | null> => {
  if (!isFirebaseConfigured()) {
    console.warn("Firebase not configured, cannot get list by shareId.");
    return null;
  }
  const currentDb = getDb();
  try {
    const q = query(collection(currentDb, LISTS_COLLECTION), where("shareId", "==", shareId), limit(1));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return null;
    }
    return mapDocToList(querySnapshot.docs[0]);
  } catch (error) {
    console.error("Error fetching list by shareId:", error);
    throw error;
  }
};

export const listenToListByShareId = (
  shareId: string,
  onUpdate: (list: List | null) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  if (!isFirebaseConfigured()) {
    onError(new Error("Firebase not configured. Cannot listen to shared list."));
    return () => {}; 
  }
  const currentDb = getDb();
  let unsubscribeDocListener: Unsubscribe = () => {};

  const q = query(collection(currentDb, LISTS_COLLECTION), where("shareId", "==", shareId), limit(1));
  
  const unsubscribeQueryListener = onSnapshot(q, (querySnapshot) => {
    if (unsubscribeDocListener) { 
      unsubscribeDocListener();
    }

    if (querySnapshot.empty) {
      onUpdate(null); 
      return;
    }
    
    const listDoc = querySnapshot.docs[0];
    const listDocumentId = listDoc.id;

    unsubscribeDocListener = onSnapshot(doc(currentDb, LISTS_COLLECTION, listDocumentId), (docSnapshot) => {
      if (docSnapshot.exists()) {
        const listData = mapDocToList(docSnapshot);
        if (listData.shareId === shareId) {
          onUpdate(listData);
        } else {
          onUpdate(null); 
        }
      } else {
        onUpdate(null); 
      }
    }, (error) => {
      console.error(`Error listening to shared list document (ID: ${listDocumentId}):`, error);
      onError(error);
    });

  }, (error) => {
    console.error(`Error querying for shareId (${shareId}):`, error);
    onError(error);
  });

  return () => {
    unsubscribeQueryListener();
    if (unsubscribeDocListener) {
      unsubscribeDocListener();
    }
  };
};


export const generateShareIdForList = async (listId: string, userId: string): Promise<string | null> => {
  if (!isFirebaseConfigured()) return null;
  const currentDb = getDb();
  const listRef = doc(currentDb, LISTS_COLLECTION, listId);
  
  const listDoc = await getDoc(listRef);
  if (!listDoc.exists() || listDoc.data()?.userId !== userId) {
    console.error("User does not own this list or list does not exist.");
    return null;
  }

  const newShareId = crypto.randomUUID();
  await updateDoc(listRef, { shareId: newShareId });
  return newShareId;
};

export const removeShareIdFromList = async (listId: string, userId: string): Promise<void> => {
  if (!isFirebaseConfigured()) return;
  const currentDb = getDb();
  const listRef = doc(currentDb, LISTS_COLLECTION, listId);

  const listDoc = await getDoc(listRef);
  if (!listDoc.exists() || listDoc.data()?.userId !== userId) {
    console.error("User does not own this list or list does not exist.");
    throw new Error("Permission denied or list not found.");
  }

  await updateDoc(listRef, { shareId: null });
};
