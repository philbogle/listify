
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
  deleteField, // Import deleteField
} from "firebase/firestore";
import type { List, Subitem } from "@/types/list"; 
import { firebaseConfig } from "./firebaseConfig";

let app: FirebaseApp;
let db: Firestore;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (error) {
  console.error("Error initializing Firebase:", error);
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY") {
    console.warn(
      "Firebase is not configured. Please update src/lib/firebaseConfig.ts. Using mock data."
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
       console.error("Critical Firebase initialization error:", e);
       throw new Error("Firebase could not be initialized. Check your firebaseConfig.ts.");
    }
  }
  return db;
}

export const addListToFirebase = async (listData: Omit<List, "id" | "createdAt">): Promise<List> => {
  const currentDb = getDb();
  const docRef = await addDoc(collection(currentDb, LISTS_COLLECTION), {
    title: listData.title,
    // description field removed
    completed: listData.completed,
    subtasks: listData.subitems.map(si => ({ id: si.id, title: si.title, completed: si.completed })), 
    createdAt: serverTimestamp(),
  });
  return { ...listData, id: docRef.id, createdAt: new Date() }; 
};

export const getListsFromFirebase = async (): Promise<List[]> => {
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY") {
    console.warn("Firebase not configured, returning empty array for lists.");
    return []; 
  }
  const currentDb = getDb();
  try {
    const q = query(collection(currentDb, LISTS_COLLECTION), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        // description: data.description, // Removed from mapping as it's removed from List type
        completed: data.completed,
        createdAt: data.createdAt,
        subitems: (data.subtasks || []).map((st: any) => ({ 
            id: st.id || crypto.randomUUID(), 
            title: st.title,
            completed: st.completed
        })),
      } as List;
    });
  } catch (error) {
    console.error("Error fetching lists from Firebase:", error);
    console.error("This could be due to Firestore security rules or missing indexes. Please check your Firebase console.");
    console.error("Specifically, ensure you have an index on the 'tasks' collection for 'createdAt' in descending order.");
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

  // If description is explicitly being removed (e.g. set to undefined from a form),
  // ensure it's handled by sending deleteField() to Firestore.
  // However, since it's removed from the List type, 'updates' should not contain 'description'.
  // This is more of a defensive measure if old data structures were at play.
  if (firebaseUpdates.hasOwnProperty('description') && firebaseUpdates.description === undefined) {
    firebaseUpdates.description = deleteField();
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
  if (!configured) {
    console.warn("Firebase configuration is missing or using placeholder values in src/lib/firebaseConfig.ts. Features requiring Firebase will not work correctly.");
  }
  return configured;
};
