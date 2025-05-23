
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
  onAuthUserChanged, // Import auth listener
} from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { User } from "firebase/auth"; // Import User type

const LOCAL_STORAGE_KEY_PREFIX = "taskflow_lists_"; // Prefix for user-specific local storage

export const useLists = () => {
  const [lists, setLists] = useState<List[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const { toast } = useToast();

  // Listen for auth state changes
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setIsLoading(false); // If Firebase isn't set up, don't wait for auth
      // Try to load from local storage if any (though it won't be user-specific)
      const localKey = LOCAL_STORAGE_KEY_PREFIX + "anonymous";
      try {
        const localLists = localStorage.getItem(localKey);
        if (localLists) {
          setLists(JSON.parse(localLists));
        }
      } catch (error) {
        console.error("Error loading lists from local storage (no Firebase):", error);
      }
      return;
    }

    const unsubscribe = onAuthUserChanged((user) => {
      setCurrentUser(user);
      if (!user) {
        setLists([]); // Clear lists on logout
        setIsLoading(false);
      }
      // List loading will be triggered by currentUser change in the next useEffect
    });
    return () => unsubscribe(); // Cleanup subscription
  }, [toast]);


  // Load or clear lists based on currentUser
  useEffect(() => {
    const localKey = currentUser ? LOCAL_STORAGE_KEY_PREFIX + currentUser.uid : LOCAL_STORAGE_KEY_PREFIX + "anonymous_temp";

    if (currentUser && isFirebaseConfigured()) {
      setIsLoading(true);
      getListsFromFirebase(currentUser.uid)
        .then((firebaseLists) => {
          setLists(firebaseLists);
          try {
            localStorage.setItem(localKey, JSON.stringify(firebaseLists));
          } catch (e) { console.error("Failed to save lists to local storage", e); }
        })
        .catch((error) => {
          console.error("Error loading lists from Firebase:", error);
          toast({
            title: "Firebase Load Error",
            description: "Could not load lists. Check console. Ensure Firebase rules and indexes are set up.",
            variant: "destructive",
            duration: 9000,
          });
          // Attempt to load from local storage as a fallback
          try {
            const localListsData = localStorage.getItem(localKey);
            if (localListsData) {
              setLists(JSON.parse(localListsData));
            }
          } catch (e) { console.error("Failed to load lists from local storage fallback", e); }
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else if (!currentUser) {
      setLists([]);
      setIsLoading(false);
      // Clear user-specific local storage on logout
      if (isFirebaseConfigured()) { // Only if Firebase was used
        try {
            // This key might not exist if user never logged in, which is fine
            localStorage.removeItem(localKey); // Or find the previous user's key if needed
        } catch (e) { console.error("Failed to clear local storage on logout", e); }
      }
    } else if (!isFirebaseConfigured() && !currentUser) {
        // Non-firebase, anonymous user case (already handled by initial auth listener)
        // No need to load again, but ensure isLoading is false
        setIsLoading(false);
    }
  }, [currentUser, toast]);


  // Save to local storage when lists change (and user is known)
  useEffect(() => {
    if (!isLoading && currentUser && isFirebaseConfigured()) {
      const localKey = LOCAL_STORAGE_KEY_PREFIX + currentUser.uid;
      try {
        localStorage.setItem(localKey, JSON.stringify(lists));
      } catch (error) {
        console.error("Error saving lists to local storage:", error);
      }
    } else if (!isLoading && !isFirebaseConfigured()){ // Save for anonymous user if Firebase is not configured
        const localKey = LOCAL_STORAGE_KEY_PREFIX + "anonymous";
        try {
            localStorage.setItem(localKey, JSON.stringify(lists));
        } catch (error) {
            console.error("Error saving lists to local storage (no Firebase):", error);
        }
    }
  }, [lists, isLoading, currentUser]);

  const addList = async (listData: Omit<List, "id" | "completed" | "subitems" | "createdAt" | "userId">): Promise<List | undefined> => {
    if (!currentUser && isFirebaseConfigured()) {
      toast({ title: "Not Signed In", description: "Please sign in to add lists.", variant: "destructive" });
      return undefined;
    }

    const newListBase: Omit<List, "id" | "createdAt"> = {
      title: listData.title,
      completed: false,
      subitems: [],
      userId: currentUser?.uid, // Add userId here
    };
    let createdList: List | undefined = undefined;

    if (isFirebaseConfigured() && currentUser) {
      try {
        const addedListFromFirebase = await addListToFirebase(newListBase, currentUser.uid);
        createdList = addedListFromFirebase;
        setLists(prevLists => [addedListFromFirebase, ...prevLists]);
      } catch (error) {
        console.error("Error adding list to Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not add list. Check console.", variant: "destructive" });
        return undefined;
      }
    } else if (!isFirebaseConfigured()) { // Handle non-Firebase case
      const newListForLocal: List = {
        ...newListBase,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        userId: undefined // No user ID if not using Firebase auth
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

    if (isFirebaseConfigured() && currentUser) { // Ensure user is logged in for Firebase ops
      try {
        const firebaseUpdates = { ...updates };
        delete firebaseUpdates.userId; // Prevent changing userId
        await updateListInFirebase(listId, firebaseUpdates);
      } catch (error) {
        console.error("Error updating list in Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not update list. Reverting.", variant: "destructive" });
        if (originalList) {
          setLists(prevLists =>
            prevLists.map(list => (list.id === listId ? originalList! : list))
          );
        }
      }
    } else if (!isFirebaseConfigured()) {
        // Local update already applied optimistically
    }
  };

  const deleteList = async (listId: string) => {
    const originalLists = [...lists];
    setLists(prevLists => prevLists.filter((list) => list.id !== listId));

    if (isFirebaseConfigured() && currentUser) {
      try {
        await deleteListFromFirebase(listId);
      } catch (error) {
        console.error("Error deleting list from Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not delete list. Reverting.", variant: "destructive" });
        setLists(originalLists);
      }
    } else if (!isFirebaseConfigured()) {
        // Local delete already applied
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

    if (isFirebaseConfigured() && currentUser) {
      try {
        await updateSubitemsInFirebase(listId, newSubitems);
      } catch (error) {
        console.error("Error managing subitems in Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not update subitems. Reverting.", variant: "destructive" });
        if (originalSubitems !== undefined) {
          setLists(prevLists => {
             const listIndex = prevLists.findIndex(l => l.id === listId);
             if (listIndex === -1) return prevLists;
             const rolledBackLists = [...prevLists];
             rolledBackLists[listIndex] = { ...rolledBackLists[listIndex], subitems: originalSubitems! };
             return rolledBackLists;
          });
        }
      }
    } else if (!isFirebaseConfigured()) {
        // Local update applied
    }
  };

  return { lists, isLoading, currentUser, addList, updateList, deleteList, manageSubitems };
};
