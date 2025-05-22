
"use client";

import { useState, useEffect, useCallback } from "react";
import type { Task, Subtask } from "@/types/task";
import {
  addTaskToFirebase,
  getTasksFromFirebase,
  updateTaskInFirebase,
  deleteTaskFromFirebase,
  updateSubtaskInFirebase,
  isFirebaseConfigured,
} from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

const LOCAL_STORAGE_KEY = "taskflow_tasks";

export const useTasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const loadTasks = async () => {
      setIsLoading(true);
      let initialTasks: Task[] = [];
      
      try {
        const localTasks = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (localTasks) {
          initialTasks = JSON.parse(localTasks);
          setTasks(initialTasks); 
        }
      } catch (error) {
        console.error("Error loading tasks from local storage:", error);
      }

      if (isFirebaseConfigured()) {
        try {
          const firebaseTasks = await getTasksFromFirebase();
          setTasks(firebaseTasks);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(firebaseTasks));
        } catch (error) {
          console.error("Error loading tasks from Firebase:", error);
          toast({
            title: "Firebase Load Error",
            description: "Could not load tasks from cloud. Check console for details. Ensure Firebase security rules and indexes (createdAt desc) are correctly set up.",
            variant: "destructive",
            duration: 9000,
          });
        }
      } else {
        // Only show this specific toast if no tasks were loaded from local storage either
        // And if firebase is not configured.
        if (initialTasks.length === 0) { 
            toast({
                title: "Firebase Not Configured",
                description: "Firebase is not configured. Tasks will be saved locally only. Please configure Firebase in src/lib/firebaseConfig.ts for cloud storage.",
                variant: "default",
                duration: 9000,
            });
        }
      }
      setIsLoading(false);
    };
    loadTasks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]); 

  useEffect(() => {
    // Only save to local storage if Firebase is not configured OR if still loading
    // (to capture initial local state before Firebase potentially overwrites it)
    if (!isFirebaseConfigured() && !isLoading) { 
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tasks));
        } catch (error) {
            console.error("Error saving tasks to local storage:", error);
            // Potentially add a toast here if saving to local storage fails critically
        }
    }
  }, [tasks, isLoading]);


  const addTask = async (taskData: Omit<Task, "id" | "completed" | "subtasks" | "createdAt">): Promise<Task | undefined> => {
    const newTaskBase: Omit<Task, "id" | "createdAt"> = {
      ...taskData,
      completed: false,
      subtasks: [],
    };
    let createdTask: Task | undefined = undefined;

    if (isFirebaseConfigured()) {
      try {
        const addedTaskFromFirebase = await addTaskToFirebase(newTaskBase); 
        createdTask = addedTaskFromFirebase;
        setTasks(prevTasks => {
          const newTasks = [addedTaskFromFirebase, ...prevTasks];
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newTasks)); // Also update local for consistency
          return newTasks;
        });
        toast({ title: "Success", description: "Task added to cloud." });
      } catch (error) {
        console.error("Error adding task to Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not add task to cloud. Check console.", variant: "destructive" });
        return undefined;
      }
    } else {
      const newTaskForLocal: Task = { 
        ...newTaskBase, 
        id: crypto.randomUUID(), 
        createdAt: new Date().toISOString() 
      };
      createdTask = newTaskForLocal;
      setTasks(prevTasks => [newTaskForLocal, ...prevTasks]);
      toast({ title: "Success", description: "Task added locally." });
    }
    return createdTask;
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    if (isFirebaseConfigured()) {
      try {
        await updateTaskInFirebase(taskId, updates);
        setTasks(prevTasks => {
          const updatedTasks = prevTasks.map((task) =>
            task.id === taskId ? { ...task, ...updates } : task
          );
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedTasks));
          return updatedTasks;
        });
        toast({ title: "Success", description: "Task updated in cloud." });
      } catch (error) {
        console.error("Error updating task in Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not update task in cloud. Check console.", variant: "destructive" });
      }
    } else {
      setTasks(prevTasks => {
        const updatedTasks = prevTasks.map((task) =>
          task.id === taskId ? { ...task, ...updates } : task
        );
        // localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedTasks)); // This is handled by the useEffect
        return updatedTasks;
      });
      toast({ title: "Success", description: "Task updated locally." });
    }
  };

  const deleteTask = async (taskId: string) => {
    if (isFirebaseConfigured()) {
      try {
        await deleteTaskFromFirebase(taskId);
        setTasks(prevTasks => {
          const newTasks = prevTasks.filter((task) => task.id !== taskId);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newTasks));
          return newTasks;
        });
        toast({ title: "Success", description: "Task deleted from cloud." });
      } catch (error) {
        console.error("Error deleting task from Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not delete task from cloud. Check console.", variant: "destructive" });
      }
    } else {
      setTasks(prevTasks => {
        const newTasks = prevTasks.filter((task) => task.id !== taskId);
        // localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newTasks)); // Handled by useEffect
        return newTasks;
      });
      toast({ title: "Success", description: "Task deleted locally." });
    }
  };

  const manageSubtasks = async (taskId: string, newSubtasks: Subtask[]) => {
    if (isFirebaseConfigured()) {
      try {
        await updateSubtaskInFirebase(taskId, newSubtasks);
        setTasks(prevTasks => {
          const updatedTasks = prevTasks.map(task => 
            task.id === taskId ? { ...task, subtasks: newSubtasks } : task
          );
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedTasks));
          return updatedTasks;
        });
        toast({ title: "Success", description: "Subtasks updated in cloud." });
      } catch (error) {
        console.error("Error managing subtasks in Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not update subtasks in cloud. Check console.", variant: "destructive" });
      }
    } else {
      setTasks(prevTasks => {
        const updatedTasks = prevTasks.map(task => 
          task.id === taskId ? { ...task, subtasks: newSubtasks } : task
        );
        // localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedTasks)); // Handled by useEffect
        return updatedTasks;
      });
      toast({ title: "Success", description: "Subtasks updated locally." });
    }
  };

  return { tasks, isLoading, addTask, updateTask, deleteTask, manageSubtasks };
};
