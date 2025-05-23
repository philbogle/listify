
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
} from "firebase/firestore";
import type { List, Subitem } from "@/types/list"; // Renamed import
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

const LISTS_COLLECTION = "tasks"; // Firestore collection name remains "tasks" for compatibility

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
    description: listData.description || "",
    completed: listData.completed,
    subtasks: listData.subitems.map(si => ({ id: si.id, title: si.title, completed: si.completed })), // Map app's 'subitems' to Firestore's 'subtasks' field
    createdAt: serverTimestamp(),
  });
  // Return as List type, mapping Firestore's subtasks back to subitems for the app
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
        description: data.description,
        completed: data.completed,
        createdAt: data.createdAt,
        subitems: (data.subtasks || []).map((st: any) => ({ // Map Firestore's 'subtasks' to app's 'subitems'
            id: st.id || crypto.randomUUID(), // Ensure subitem has an id
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
  
  // Map app's 'subitems' to Firestore's 'subtasks' field if present in updates
  const firebaseUpdates: any = { ...updates };
  if (updates.subitems !== undefined) {
    firebaseUpdates.subtasks = updates.subitems.map(si => ({ id: si.id, title: si.title, completed: si.completed }));
    delete firebaseUpdates.subitems; 
  }
  if (updates.createdAt === undefined && firebaseUpdates.createdAt !== undefined) { // Prevent client-side timestamp from overwriting serverTimestamp on initial add
    delete firebaseUpdates.createdAt;
  }


  await updateDoc(listRef, firebaseUpdates);
};

export const deleteListFromFirebase = async (listId: string): Promise<void> => {
  const currentDb = getDb();
  await deleteDoc(doc(currentDb, LISTS_COLLECTION, listId));
};

// This function updates the entire subitems array for a list
export const updateSubitemsInFirebase = async (listId: string, subitems: Subitem[]): Promise<void> => {
  const currentDb = getDb();
  const listRef = doc(currentDb, LISTS_COLLECTION, listId);
  // Map app's 'subitems' to Firestore's 'subtasks' field
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
