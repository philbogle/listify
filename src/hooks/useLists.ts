
"use client";

import { useState, useEffect, useCallback } from "react";
import type { List, Subitem } from "@/types/list";
import {
  addListToFirebase,
  getListsFromFirebase, // Will fetch active lists
  getCompletedListsFromFirebase, // New function to fetch completed lists
  updateListInFirebase,
  deleteListFromFirebase,
  updateSubitemsInFirebase,
  isFirebaseConfigured,
  onAuthUserChanged,
  uploadScanImageToFirebase,
} from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { User } from "firebase/auth";

const LOCAL_STORAGE_ACTIVE_LISTS_KEY_PREFIX = "listbot_active_lists_";
const LOCAL_STORAGE_COMPLETED_LISTS_KEY_PREFIX = "listbot_completed_lists_";

export const useLists = () => {
  const [activeLists, setActiveLists] = useState<List[]>([]);
  const [completedLists, setCompletedLists] = useState<List[]>([]);
  const [isLoading, setIsLoading] = useState(true); // For active lists
  const [isLoadingCompleted, setIsLoadingCompleted] = useState(false);
  const [hasFetchedCompleted, setHasFetchedCompleted] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const { toast } = useToast();

  const getActiveLocalKey = useCallback((uid?: string | null) => uid ? LOCAL_STORAGE_ACTIVE_LISTS_KEY_PREFIX + uid : LOCAL_STORAGE_ACTIVE_LISTS_KEY_PREFIX + "anonymous", []);
  const getCompletedLocalKey = useCallback((uid?: string | null) => uid ? LOCAL_STORAGE_COMPLETED_LISTS_KEY_PREFIX + uid : LOCAL_STORAGE_COMPLETED_LISTS_KEY_PREFIX + "anonymous", []);


  useEffect(() => {
    const unsubscribe = onAuthUserChanged((user) => {
      setCurrentUser(user);
      setActiveLists([]); // Clear lists on auth change
      setCompletedLists([]);
      setHasFetchedCompleted(false);
      if (!user) {
        setIsLoading(false);
        setIsLoadingCompleted(false);
        if (!isFirebaseConfigured()) {
          // Load from general anonymous local storage if Firebase isn't setup
          try {
            const localActive = localStorage.getItem(getActiveLocalKey());
            if (localActive) setActiveLists(JSON.parse(localActive));
            const localCompleted = localStorage.getItem(getCompletedLocalKey());
            if (localCompleted) setCompletedLists(JSON.parse(localCompleted));
          } catch (error) {
            console.error("Error loading lists from local storage (no Firebase, no user):", error);
          }
        }
      }
      // If user is present, isLoading is handled by data fetching effect
    });
    return () => unsubscribe();
  }, [toast, getActiveLocalKey, getCompletedLocalKey]);


  useEffect(() => {
    if (currentUser && isFirebaseConfigured()) {
      setIsLoading(true);
      const localKey = getActiveLocalKey(currentUser.uid);
      getListsFromFirebase(currentUser.uid)
        .then((firebaseLists) => {
          setActiveLists(firebaseLists);
          try {
            localStorage.setItem(localKey, JSON.stringify(firebaseLists));
          } catch (e) { console.error("Failed to save active lists to local storage after fetch", e); }
        })
        .catch((error) => {
          console.error("Error loading active lists from Firebase:", error);
          toast({
            title: "Firebase Load Error",
            description: "Could not load active lists. Check console.",
            variant: "destructive",
            duration: 9000,
          });
          try {
            const localListsData = localStorage.getItem(localKey);
            if (localListsData) setActiveLists(JSON.parse(localListsData));
            else setActiveLists([]);
          } catch (e) {
            console.error("Failed to load active lists from local storage fallback", e);
            setActiveLists([]);
          }
        })
        .finally(() => {
          setIsLoading(false);
        });
      // Reset completed lists as they need to be fetched on demand
      setCompletedLists([]);
      setHasFetchedCompleted(false);

    } else if (!currentUser && !isFirebaseConfigured()) {
      // Handled by onAuthUserChanged
      setIsLoading(false);
    } else if (!currentUser && isFirebaseConfigured()) {
      setActiveLists([]);
      setCompletedLists([]);
      setHasFetchedCompleted(false);
      setIsLoading(false);
    }
  }, [currentUser, toast, getActiveLocalKey]);

  useEffect(() => {
    if (!isLoading) { // Persist active lists
      if (currentUser && isFirebaseConfigured()) {
        localStorage.setItem(getActiveLocalKey(currentUser.uid), JSON.stringify(activeLists));
      } else if (!isFirebaseConfigured()) {
        localStorage.setItem(getActiveLocalKey(), JSON.stringify(activeLists));
      }
    }
  }, [activeLists, isLoading, currentUser, getActiveLocalKey]);

  useEffect(() => {
    if (hasFetchedCompleted && !isLoadingCompleted) { // Persist completed lists
      if (currentUser && isFirebaseConfigured()) {
        localStorage.setItem(getCompletedLocalKey(currentUser.uid), JSON.stringify(completedLists));
      } else if (!isFirebaseConfigured()) {
        localStorage.setItem(getCompletedLocalKey(), JSON.stringify(completedLists));
      }
    }
  }, [completedLists, hasFetchedCompleted, isLoadingCompleted, currentUser, getCompletedLocalKey]);


  const fetchCompletedListsIfNeeded = useCallback(async () => {
    if (!currentUser || hasFetchedCompleted || !isFirebaseConfigured()) {
      if (!currentUser && isFirebaseConfigured()) {
        toast({ title: "Please Sign In", description: "Sign in to view completed lists.", variant: "default" });
      }
      return;
    }

    setIsLoadingCompleted(true);
    const localKey = getCompletedLocalKey(currentUser.uid);
    try {
      const firebaseCompletedLists = await getCompletedListsFromFirebase(currentUser.uid);
      setCompletedLists(firebaseCompletedLists);
      localStorage.setItem(localKey, JSON.stringify(firebaseCompletedLists));
    } catch (error) {
      console.error("Error fetching completed lists from Firebase:", error);
      toast({
        title: "Firebase Load Error",
        description: "Could not load completed lists. Check console.",
        variant: "destructive",
      });
       try {
          const localListsData = localStorage.getItem(localKey);
          if (localListsData) setCompletedLists(JSON.parse(localListsData));
          else setCompletedLists([]);
        } catch (e) {
          console.error("Failed to load completed lists from local storage fallback", e);
          setCompletedLists([]);
        }
    } finally {
      setIsLoadingCompleted(false);
      setHasFetchedCompleted(true);
    }
  }, [currentUser, hasFetchedCompleted, toast, getCompletedLocalKey]);


  const addList = async (
    listData: Omit<List, "id" | "completed" | "subitems" | "createdAt" | "userId" | "scanImageUrl">,
    capturedImageFile?: File | null
  ): Promise<List | undefined> => {
    if (!currentUser && isFirebaseConfigured()) {
      toast({ title: "Not Signed In", description: "Please sign in to add lists.", variant: "destructive" });
      return undefined;
    }

    const newListBase: Omit<List, "id" | "createdAt" | "scanImageUrl"> = {
      title: listData.title,
      completed: false, // New lists are active
      subitems: [],
      userId: currentUser?.uid,
    };

    const optimisticId = crypto.randomUUID();
    const optimisticList: List = {
      ...newListBase,
      id: optimisticId,
      createdAt: new Date().toISOString(),
      userId: currentUser?.uid,
    };

    setActiveLists(prev => [optimisticList, ...prev].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));

    if (isFirebaseConfigured() && currentUser) {
      try {
        const addedListFromFirebase = await addListToFirebase(newListBase, currentUser.uid);
        let finalFirebaseList = addedListFromFirebase;

        if (capturedImageFile) {
          try {
            const downloadURL = await uploadScanImageToFirebase(capturedImageFile, currentUser.uid, addedListFromFirebase.id);
            await updateListInFirebase(addedListFromFirebase.id, { scanImageUrl: downloadURL });
            finalFirebaseList = { ...addedListFromFirebase, scanImageUrl: downloadURL };
          } catch (uploadError) {
            console.error("Error uploading scan image or updating list with URL:", uploadError);
            toast({ title: "Image Upload Failed", description: "List created, but image upload failed.", variant: "destructive" });
          }
        }
        
        setActiveLists(prev => prev.map(l => l.id === optimisticId ? finalFirebaseList : l).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        return finalFirebaseList;

      } catch (error) {
        console.error("Error adding list to Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not add list.", variant: "destructive" });
        setActiveLists(prev => prev.filter(l => l.id !== optimisticId));
        return undefined;
      }
    } else if (!isFirebaseConfigured()) {
      // Optimistic update already applied for non-Firebase
      return optimisticList;
    }
    return undefined;
  };

  const updateList = async (listId: string, updates: Partial<List>) => {
    let originalList: List | undefined;
    let sourceArray: 'active' | 'completed' | null = null;

    // Optimistic update
    setActiveLists(prev => {
        const index = prev.findIndex(l => l.id === listId);
        if (index !== -1) {
            originalList = { ...prev[index] };
            sourceArray = 'active';
            const newLists = [...prev];
            const updatedList = { ...newLists[index], ...updates };
            if (updates.completed === true) { // Moving to completed
                if (hasFetchedCompleted) {
                    setCompletedLists(comp => [updatedList, ...comp].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
                }
                return newLists.filter(l => l.id !== listId);
            }
            newLists[index] = updatedList;
            return newLists.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
        return prev;
    });

    if (!originalList) {
        setCompletedLists(prev => {
            const index = prev.findIndex(l => l.id === listId);
            if (index !== -1) {
                originalList = { ...prev[index] };
                sourceArray = 'completed';
                const newLists = [...prev];
                const updatedList = { ...newLists[index], ...updates };

                if (updates.completed === false) { // Moving to active
                    setActiveLists(act => [updatedList, ...act].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
                    return newLists.filter(l => l.id !== listId);
                }
                newLists[index] = updatedList;
                return newLists.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            }
            return prev;
        });
    }


    if (isFirebaseConfigured() && currentUser) {
      try {
        const firebaseUpdates = { ...updates };
        delete firebaseUpdates.userId;
        delete firebaseUpdates.createdAt;
        await updateListInFirebase(listId, firebaseUpdates);
      } catch (error) {
        console.error("Error updating list in Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not update list. Reverting.", variant: "destructive" });
        // Rollback
        if (originalList && sourceArray) {
            if (updates.completed === true && sourceArray === 'active') { // Was moved from active to completed
                setActiveLists(prev => [originalList!, ...prev].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
                if (hasFetchedCompleted) {
                    setCompletedLists(comp => comp.filter(l => l.id !== listId));
                }
            } else if (updates.completed === false && sourceArray === 'completed') { // Was moved from completed to active
                setCompletedLists(prev => [originalList!, ...prev].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
                setActiveLists(act => act.filter(l => l.id !== listId));
            } else if (sourceArray === 'active') {
                 setActiveLists(prev => prev.map(l => l.id === listId ? originalList! : l).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
            } else if (sourceArray === 'completed') {
                 setCompletedLists(prev => prev.map(l => l.id === listId ? originalList! : l).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
            }
        }
      }
    }
  };

  const deleteList = async (listId: string) => {
    const originalActiveLists = [...activeLists];
    const originalCompletedLists = [...completedLists];
    let listWasInActive = false;

    setActiveLists(prev => {
        if (prev.some(l => l.id === listId)) {
            listWasInActive = true;
            return prev.filter(l => l.id !== listId);
        }
        return prev;
    });
    if (!listWasInActive) {
        setCompletedLists(prev => prev.filter(l => l.id !== listId));
    }

    if (isFirebaseConfigured() && currentUser) {
      try {
        await deleteListFromFirebase(listId);
      } catch (error) {
        console.error("Error deleting list from Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not delete list. Reverting.", variant: "destructive" });
        setActiveLists(originalActiveLists);
        setCompletedLists(originalCompletedLists);
      }
    }
  };

  const manageSubitems = async (listId: string, newSubitems: Subitem[]) => {
    let originalList: List | undefined;
    let sourceArray: 'active' | 'completed' | null = null;

    // Optimistic update
    setActiveLists(prev => {
        const index = prev.findIndex(l => l.id === listId);
        if (index !== -1) {
            originalList = { ...prev[index] };
            sourceArray = 'active';
            const updatedLists = [...prev];
            updatedLists[index] = { ...updatedLists[index], subitems: newSubitems };
            return updatedLists;
        }
        return prev;
    });

    if (!originalList) {
        setCompletedLists(prev => {
            const index = prev.findIndex(l => l.id === listId);
            if (index !== -1) {
                originalList = { ...prev[index] };
                sourceArray = 'completed';
                const updatedLists = [...prev];
                updatedLists[index] = { ...updatedLists[index], subitems: newSubitems };
                return updatedLists;
            }
            return prev;
        });
    }

    if (isFirebaseConfigured() && currentUser) {
      try {
        await updateSubitemsInFirebase(listId, newSubitems);
      } catch (error) {
        console.error("Error managing subitems in Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not update subitems. Reverting.", variant: "destructive" });
        if (originalList && sourceArray === 'active') {
            setActiveLists(prev => prev.map(l => l.id === listId ? originalList! : l));
        } else if (originalList && sourceArray === 'completed') {
            setCompletedLists(prev => prev.map(l => l.id === listId ? originalList! : l));
        }
      }
    }
  };

  return {
    activeLists,
    completedLists,
    isLoading,
    isLoadingCompleted,
    hasFetchedCompleted,
    currentUser,
    fetchCompletedListsIfNeeded,
    addList,
    updateList,
    deleteList,
    manageSubitems,
  };
};
