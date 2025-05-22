
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
  // Provide dummy functions or throw if Firebase is essential and config is missing
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY") {
    console.warn(
      "Firebase is not configured. Please update src/lib/firebaseConfig.ts. Using mock data."
    );
  }
}

const TASKS_COLLECTION = "tasks";

// Ensure db is initialized before using it
const getDb = () => {
  if (!db) {
    // This case should ideally not be hit if init is successful or an error is thrown.
    // However, as a fallback for environments where init might be delayed or conditional:
    try {
      const currentApp = initializeApp(firebaseConfig);
      db = getFirestore(currentApp);
    } catch (e) {
       console.error("Critical Firebase initialization error:", e);
       // Depending on app requirements, throw error or return a dummy/mock implementation
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
  return { ...taskData, id: docRef.id, createdAt: new Date() }; // Approximate createdAt for immediate use
};

export const getTasksFromFirebase = async (): Promise<Task[]> => {
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY") {
    return []; // Return empty if Firebase is not configured
  }
  const currentDb = getDb();
  const q = query(collection(currentDb, TASKS_COLLECTION), orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    // Ensure subtasks is always an array
    subtasks: doc.data().subtasks || [],
  } as Task));
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

// Subtask specific functions (modify the subtasks array within the task document)
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
  // Firestore update is the same as updateSubtask, just with the specific subtask removed from the array
  await updateSubtaskInFirebase(taskId, subtasks);
};

// Helper to check if Firebase is configured
export const isFirebaseConfigured = (): boolean => {
  return !!firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY";
};

