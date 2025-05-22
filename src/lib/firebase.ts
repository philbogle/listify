
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
import type { Task, Subtask } from "@/types/task";
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

const TASKS_COLLECTION = "tasks";

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

export const addTaskToFirebase = async (taskData: Omit<Task, "id" | "createdAt">): Promise<Task> => {
  const currentDb = getDb();
  const docRef = await addDoc(collection(currentDb, TASKS_COLLECTION), {
    ...taskData,
    createdAt: serverTimestamp(),
  });
  return { ...taskData, id: docRef.id, createdAt: new Date() }; 
};

export const getTasksFromFirebase = async (): Promise<Task[]> => {
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY") {
    console.warn("Firebase not configured, returning empty array for tasks.");
    return []; 
  }
  const currentDb = getDb();
  try {
    const q = query(collection(currentDb, TASKS_COLLECTION), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      subtasks: doc.data().subtasks || [],
    } as Task));
  } catch (error) {
    console.error("Error fetching tasks from Firebase:", error);
    console.error("This could be due to Firestore security rules or missing indexes. Please check your Firebase console.");
    console.error("Specifically, ensure you have an index on the 'tasks' collection for 'createdAt' in descending order.");
    throw error; // Re-throw the error to be caught by the calling function
  }
};

export const updateTaskInFirebase = async (taskId: string, updates: Partial<Task>): Promise<void> => {
  const currentDb = getDb();
  const taskRef = doc(currentDb, TASKS_COLLECTION, taskId);
  await updateDoc(taskRef, updates);
};

export const deleteTaskFromFirebase = async (taskId: string): Promise<void> => {
  const currentDb = getDb();
  await deleteDoc(doc(currentDb, TASKS_COLLECTION, taskId));
};

export const addSubtaskToFirebase = async (taskId: string, existingSubtasks: Subtask[], newSubtask: Subtask): Promise<void> => {
  const currentDb = getDb();
  const taskRef = doc(currentDb, TASKS_COLLECTION, taskId);
  const updatedSubtasks = [...existingSubtasks, newSubtask];
  await updateDoc(taskRef, { subtasks: updatedSubtasks });
};

export const updateSubtaskInFirebase = async (taskId: string, subtasks: Subtask[]): Promise<void> => {
  const currentDb = getDb();
  const taskRef = doc(currentDb, TASKS_COLLECTION, taskId);
  await updateDoc(taskRef, { subtasks });
};

export const deleteSubtaskFromFirebase = async (taskId: string, subtasks: Subtask[]): Promise<void> => {
  await updateSubtaskInFirebase(taskId, subtasks);
};

export const isFirebaseConfigured = (): boolean => {
  const configured = !!firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY" && firebaseConfig.projectId !== "YOUR_PROJECT_ID";
  if (!configured) {
    console.warn("Firebase configuration is missing or using placeholder values in src/lib/firebaseConfig.ts. Features requiring Firebase will not work correctly.");
  }
  return configured;
};
