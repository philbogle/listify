
"use client";

import { useState, useEffect, useCallback } from "react";
import type { List, Subitem } from "@/types/list";
import {
  addListToFirebase,
  getListsFromFirebase,
  updateListInFirebase,
  deleteListFromFirebase,
  updateSubitemsInFirebase,
  isFirebaseConfigured,
} from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

const LOCAL_STORAGE_KEY = "taskflow_lists";

export const useLists = () => {
  const [lists, setLists] = useState<List[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const loadLists = async () => {
      setIsLoading(true);
      let initialLists: List[] = [];
      
      try {
        const localLists = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (localLists) {
          initialLists = JSON.parse(localLists);
          setLists(initialLists); 
        }
      } catch (error) {
        console.error("Error loading lists from local storage:", error);
      }

      if (isFirebaseConfigured()) {
        try {
          const firebaseLists = await getListsFromFirebase();
          setLists(firebaseLists);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(firebaseLists));
        } catch (error) {
          console.error("Error loading lists from Firebase:", error);
          toast({
            title: "Firebase Load Error",
            description: "Could not load lists from cloud. Check console for details. Ensure Firebase security rules and indexes (createdAt desc) are correctly set up.",
            variant: "destructive",
            duration: 9000,
          });
        }
      } else {
        if (initialLists.length === 0) { 
            // Toast removed for Firebase not configured
        }
      }
      setIsLoading(false);
    };
    loadLists();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]); 

  useEffect(() => {
    if (!isFirebaseConfigured() && !isLoading) { 
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(lists));
        } catch (error) {
            console.error("Error saving lists to local storage:", error);
        }
    }
  }, [lists, isLoading]);


  const addList = async (listData: Omit<List, "id" | "completed" | "subitems" | "createdAt">): Promise<List | undefined> => {
    const newListBase: Omit<List, "id" | "createdAt"> = {
      ...listData,
      completed: false,
      subitems: [],
    };
    let createdList: List | undefined = undefined;

    if (isFirebaseConfigured()) {
      try {
        const addedListFromFirebase = await addListToFirebase(newListBase); 
        createdList = addedListFromFirebase;
        setLists(prevLists => {
          const newLists = [addedListFromFirebase, ...prevLists];
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newLists));
          return newLists;
        });
      } catch (error) {
        console.error("Error adding list to Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not add list to cloud. Check console.", variant: "destructive" });
        return undefined;
      }
    } else {
      const newListForLocal: List = { 
        ...newListBase, 
        id: crypto.randomUUID(), 
        createdAt: new Date().toISOString() 
      };
      createdList = newListForLocal;
      setLists(prevLists => [newListForLocal, ...prevLists]);
    }
    return createdList;
  };

  const updateList = async (listId: string, updates: Partial<List>) => {
    if (isFirebaseConfigured()) {
      try {
        await updateListInFirebase(listId, updates);
        setLists(prevLists => {
          const updatedLists = prevLists.map((list) =>
            list.id === listId ? { ...list, ...updates } : list
          );
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedLists));
          return updatedLists;
        });
      } catch (error) {
        console.error("Error updating list in Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not update list in cloud. Check console.", variant: "destructive" });
      }
    } else {
      setLists(prevLists => {
        const updatedLists = prevLists.map((list) =>
          list.id === listId ? { ...list, ...updates } : list
        );
        return updatedLists;
      });
    }
  };

  const deleteList = async (listId: string) => {
    if (isFirebaseConfigured()) {
      try {
        await deleteListFromFirebase(listId);
        setLists(prevLists => {
          const newLists = prevLists.filter((list) => list.id !== listId);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newLists));
          return newLists;
        });
      } catch (error) {
        console.error("Error deleting list from Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not delete list from cloud. Check console.", variant: "destructive" });
      }
    } else {
      setLists(prevLists => {
        const newLists = prevLists.filter((list) => list.id !== listId);
        return newLists;
      });
    }
  };

  const manageSubitems = async (listId: string, newSubitems: Subitem[]) => {
    // The find operation here was removed previously due to stale closure issues.
    // The functional update to setLists below correctly handles the latest state.
    if (isFirebaseConfigured()) {
      try {
        await updateSubitemsInFirebase(listId, newSubitems); 
        setLists(prevLists => {
          const updatedLists = prevLists.map(list => 
            list.id === listId ? { ...list, subitems: newSubitems } : list
          );
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedLists));
          return updatedLists;
        });
      } catch (error) {
        console.error("Error managing subitems in Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not update subitems in cloud. Check console.", variant: "destructive" });
      }
    } else {
      setLists(prevLists => {
        const updatedLists = prevLists.map(list => 
          list.id === listId ? { ...list, subitems: newSubitems } : list
        );
        return updatedLists;
      });
    }
  };

  return { lists, isLoading, addList, updateList, deleteList, manageSubitems };
};
