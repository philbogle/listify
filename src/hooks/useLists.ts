
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
          // localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(firebaseLists)); // Let the other useEffect handle this
        } catch (error) {
          console.error("Error loading lists from Firebase:", error);
          toast({
            title: "Firebase Load Error",
            description: "Could not load lists from cloud. Check console for details. Ensure Firebase security rules and indexes (createdAt desc) are correctly set up.",
            variant: "destructive",
            duration: 9000,
          });
        }
      }
      setIsLoading(false);
    };
    loadLists();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  useEffect(() => {
    if (!isLoading) { 
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(lists));
        } catch (error) {
            console.error("Error saving lists to local storage:", error);
        }
    }
  }, [lists, isLoading]);


  const addList = async (listData: Omit<List, "id" | "completed" | "subitems" | "createdAt">): Promise<List | undefined> => {
    const newListBase: Omit<List, "id" | "createdAt"> = {
      title: listData.title, // description removed
      completed: false,
      subitems: [],
    };
    let createdList: List | undefined = undefined;

    if (isFirebaseConfigured()) {
      try {
        const addedListFromFirebase = await addListToFirebase(newListBase); 
        createdList = addedListFromFirebase;
        setLists(prevLists => [addedListFromFirebase, ...prevLists]);
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
    let originalList: List | undefined;

    setLists(prevLists => {
      const listIndex = prevLists.findIndex(list => list.id === listId);
      if (listIndex === -1) return prevLists;
      
      originalList = { ...prevLists[listIndex] }; 

      const updatedLists = [...prevLists];
      updatedLists[listIndex] = { ...updatedLists[listIndex], ...updates };
      return updatedLists;
    });

    if (isFirebaseConfigured()) {
      try {
        // Make sure not to send 'description: undefined' if it was removed from updates
        const firebaseUpdates = { ...updates };
        if ('description' in firebaseUpdates && firebaseUpdates.description === undefined) {
          // If description is explicitly set to undefined, it might try to remove it.
          // However, since it's removed from the type, this branch might not be hit.
          // For safety, we can ensure it's not part of the payload if not intended.
          // delete firebaseUpdates.description; // Or let Firebase handle undefined as "no change" or "remove"
        }
        await updateListInFirebase(listId, firebaseUpdates);
      } catch (error) {
        console.error("Error updating list in Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not update list in cloud. Reverting.", variant: "destructive" });
        if (originalList) {
          setLists(prevLists => 
            prevLists.map(list => (list.id === listId ? originalList! : list))
          );
        }
      }
    }
  };

  const deleteList = async (listId: string) => {
    const originalLists = [...lists]; 
    setLists(prevLists => prevLists.filter((list) => list.id !== listId));

    if (isFirebaseConfigured()) {
      try {
        await deleteListFromFirebase(listId);
      } catch (error) {
        console.error("Error deleting list from Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not delete list from cloud. Reverting.", variant: "destructive" });
        setLists(originalLists); 
      }
    }
  };

  const manageSubitems = async (listId: string, newSubitems: Subitem[]) => {
    let originalSubitems: Subitem[] | undefined;

    setLists(prevLists => {
      const listIndex = prevLists.findIndex(list => list.id === listId);
      if (listIndex === -1) return prevLists;
      
      originalSubitems = [...prevLists[listIndex].subitems]; 

      const updatedLists = [...prevLists];
      updatedLists[listIndex] = { ...updatedLists[listIndex], subitems: newSubitems };
      return updatedLists;
    });

    if (isFirebaseConfigured()) {
      try {
        await updateSubitemsInFirebase(listId, newSubitems);
      } catch (error) {
        console.error("Error managing subitems in Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not update subitems in cloud. Reverting.", variant: "destructive" });
        if (originalSubitems !== undefined) {
          setLists(prevLists => {
             const listIndex = prevLists.findIndex(list => list.id === listId);
             if (listIndex === -1) return prevLists; 
             const rolledBackLists = [...prevLists];
             rolledBackLists[listIndex] = { ...rolledBackLists[listIndex], subitems: originalSubitems! };
             return rolledBackLists;
          });
        }
      }
    }
  };

  return { lists, isLoading, addList, updateList, deleteList, manageSubitems };
};
