
"use client";

import { useState, useEffect, useCallback } from "react";
import type { Task, Subtask } from "@/types/task";
import {
  addTaskToFirebase,
  getTasksFromFirebase,
  updateTaskInFirebase,
  deleteTaskFromFirebase,
  updateSubtaskInFirebase, // Combined function for add, update, delete subtasks by passing the whole array
  isFirebaseConfigured,
} from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

const LOCAL_STORAGE_KEY = "taskflow_tasks";

export const useTasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Load initial tasks
  useEffect(() => {
    const loadTasks = async () => {
      setIsLoading(true);
      let initialTasks: Task[] = [];
      
      // Try local storage first as a quick cache
      try {
        const localTasks = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (localTasks) {
          initialTasks = JSON.parse(localTasks);
          setTasks(initialTasks); // Show local tasks immediately
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
            title: "Error",
            description: "Could not load tasks from cloud. Displaying local data if available.",
            variant: "destructive",
          });
          // If Firebase fails, we've already set tasks from localStorage if available
        }
      } else {
         // If Firebase is not configured, rely on local storage only
        if (initialTasks.length === 0) { // If local storage was also empty
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
  }, [toast]); // toast is stable

  // Save tasks to local storage whenever they change (if Firebase is not configured)
  useEffect(() => {
    if (!isFirebaseConfigured() && !isLoading) { // only save to LS if firebase not configured and initial load done
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tasks));
        } catch (error) {
            console.error("Error saving tasks to local storage:", error);
        }
    }
  }, [tasks, isLoading]);


  const addTask = async (taskData: Omit<Task, "id" | "completed" | "subtasks" | "createdAt">) => {
    const newTaskBase: Omit<Task, "id" | "createdAt"> = {
      ...taskData,
      completed: false,
      subtasks: [],
    };

    if (isFirebaseConfigured()) {
      try {
        const addedTask = await addTaskToFirebase(newTaskBase);
        const newTasks = [addedTask, ...tasks];
        setTasks(newTasks);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newTasks));
        toast({ title: "Success", description: "Task added." });
      } catch (error) {
        console.error("Error adding task to Firebase:", error);
        toast({ title: "Error", description: "Could not add task.", variant: "destructive" });
      }
    } else {
      // Local storage only
      const newTask: Task = { ...newTaskBase, id: Date.now().toString(), createdAt: new Date().toISOString() };
      const newTasks = [newTask, ...tasks];
      setTasks(newTasks);
      // Local storage will be updated by the useEffect watching tasks
      toast({ title: "Success", description: "Task added locally." });
    }
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    if (isFirebaseConfigured()) {
      try {
        await updateTaskInFirebase(taskId, updates);
        const updatedTasks = tasks.map((task) =>
          task.id === taskId ? { ...task, ...updates } : task
        );
        setTasks(updatedTasks);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedTasks));
        toast({ title: "Success", description: "Task updated." });
      } catch (error) {
        console.error("Error updating task in Firebase:", error);
        toast({ title: "Error", description: "Could not update task.", variant: "destructive" });
      }
    } else {
      // Local storage only
      const updatedTasks = tasks.map((task) =>
        task.id === taskId ? { ...task, ...updates } : task
      );
      setTasks(updatedTasks);
      toast({ title: "Success", description: "Task updated locally." });
    }
  };

  const deleteTask = async (taskId: string) => {
    if (isFirebaseConfigured()) {
      try {
        await deleteTaskFromFirebase(taskId);
        const newTasks = tasks.filter((task) => task.id !== taskId);
        setTasks(newTasks);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newTasks));
        toast({ title: "Success", description: "Task deleted." });
      } catch (error) {
        console.error("Error deleting task from Firebase:", error);
        toast({ title: "Error", description: "Could not delete task.", variant: "destructive" });
      }
    } else {
      // Local storage only
      const newTasks = tasks.filter((task) => task.id !== taskId);
      setTasks(newTasks);
      toast({ title: "Success", description: "Task deleted locally." });
    }
  };

  const manageSubtasks = async (taskId: string, newSubtasks: Subtask[]) => {
    const taskToUpdate = tasks.find(task => task.id === taskId);
    if (!taskToUpdate) return;

    if (isFirebaseConfigured()) {
      try {
        await updateSubtaskInFirebase(taskId, newSubtasks);
        const updatedTasks = tasks.map(task => 
          task.id === taskId ? { ...task, subtasks: newSubtasks } : task
        );
        setTasks(updatedTasks);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedTasks));
        toast({ title: "Success", description: "Subtasks updated." });
      } catch (error) {
        console.error("Error managing subtasks in Firebase:", error);
        toast({ title: "Error", description: "Could not update subtasks.", variant: "destructive" });
      }
    } else {
       // Local storage only
      const updatedTasks = tasks.map(task => 
        task.id === taskId ? { ...task, subtasks: newSubtasks } : task
      );
      setTasks(updatedTasks);
      toast({ title: "Success", description: "Subtasks updated locally." });
    }
  };

  return { tasks, isLoading, addTask, updateTask, deleteTask, manageSubtasks };
};
