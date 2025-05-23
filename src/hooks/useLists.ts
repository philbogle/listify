
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
  const [isLoading, setIsLoading] = useState(true); // Start true to wait for auth resolution
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const { toast } = useToast();

  // Listen for auth state changes and handle initial load for non-Firebase
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setIsLoading(false); // If Firebase isn't set up, don't wait for auth
      const localKey = LOCAL_STORAGE_KEY_PREFIX + "anonymous";
      try {
        const localLists = localStorage.getItem(localKey);
        if (localLists) {
          setLists(JSON.parse(localLists));
        }
      } catch (error) {
        console.error("Error loading lists from local storage (no Firebase):", error);
      }
      return; // Early exit if Firebase is not configured
    }

    // Firebase is configured, set up auth listener
    const unsubscribe = onAuthUserChanged((user) => {
      setCurrentUser(user);
      if (!user) {
        // User is null (logged out or initial state before login confirmed)
        setLists([]);
        setIsLoading(false); // Correctly set loading to false
      }
      // If user IS present, isLoading will be managed by the data fetching effect.
      // Initial isLoading state (true) will cover the period until data fetching effect runs.
    });
    return () => unsubscribe(); // Cleanup subscription
  }, [toast]); // toast is stable, so this runs once for setup/cleanup

  // Load lists from Firebase when currentUser changes (and is authenticated)
  useEffect(() => {
    if (currentUser && isFirebaseConfigured()) {
      setIsLoading(true); // Set loading true when we start fetching for an authenticated user
      const localKey = LOCAL_STORAGE_KEY_PREFIX + currentUser.uid;
      getListsFromFirebase(currentUser.uid)
        .then((firebaseLists) => {
          setLists(firebaseLists);
          try {
            localStorage.setItem(localKey, JSON.stringify(firebaseLists));
          } catch (e) { console.error("Failed to save lists to local storage after fetch", e); }
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
            } else {
              setLists([]); // Clear lists if Firebase and fallback fail
            }
          } catch (e) { 
            console.error("Failed to load lists from local storage fallback", e); 
            setLists([]); // Clear lists on error
          }
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
    // If currentUser is null and Firebase is configured, the auth effect handles setting isLoading to false.
    // If Firebase is not configured, the auth effect handles initial load and isLoading.
  }, [currentUser, toast]); // Effect runs when currentUser or toast changes

  // Save to local storage when lists change (and user is known or Firebase not configured)
  useEffect(() => {
    if (!isLoading) { // Only save when not in a loading transition
      if (currentUser && isFirebaseConfigured()) {
        const localKey = LOCAL_STORAGE_KEY_PREFIX + currentUser.uid;
        try {
          localStorage.setItem(localKey, JSON.stringify(lists));
        } catch (error) {
          console.error("Error saving lists to local storage (authed user):", error);
        }
      } else if (!isFirebaseConfigured()) { // Firebase not configured, save for anonymous
        const localKey = LOCAL_STORAGE_KEY_PREFIX + "anonymous";
        try {
          localStorage.setItem(localKey, JSON.stringify(lists));
        } catch (error) {
          console.error("Error saving lists to local storage (anonymous):", error);
        }
      }
    }
  }, [lists, isLoading, currentUser]); // Rerun if lists, isLoading, or currentUser changes

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
        // Optimistically add to local state first
        const optimisticId = crypto.randomUUID(); // Temporary ID for optimistic update
        const optimisticList: List = {
          ...newListBase,
          id: optimisticId,
          createdAt: new Date().toISOString(), // Placeholder, Firebase will set serverTimestamp
          userId: currentUser.uid,
        };
        setLists(prevLists => [optimisticList, ...prevLists]);

        const addedListFromFirebase = await addListToFirebase(newListBase, currentUser.uid);
        createdList = addedListFromFirebase;
        // Replace optimistic list with Firebase one (with correct ID and server timestamp)
        setLists(prevLists => prevLists.map(l => l.id === optimisticId ? addedListFromFirebase : l).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      } catch (error) {
        console.error("Error adding list to Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not add list. Check console.", variant: "destructive" });
        setLists(prevLists => prevLists.filter(l => l.id !== createdList?.id)); // Rollback optimistic add
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
      setLists(prevLists => [newListForLocal, ...prevLists].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
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

    if (isFirebaseConfigured() && currentUser) { 
      try {
        const firebaseUpdates = { ...updates };
        delete firebaseUpdates.userId; 
        delete firebaseUpdates.createdAt; // Don't send client-side createdAt to Firebase
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
             if (listIndex === -1) return prevLists; // Should not happen if optimistic update worked
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

