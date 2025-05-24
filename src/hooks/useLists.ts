
"use client";

import { useState, useEffect, useCallback } from "react";
import type { List, Subitem } from "@/types/list";
import {
  addListToFirebase,
  getListsFromFirebase,
  getCompletedListsFromFirebase,
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
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCompleted, setIsLoadingCompleted] = useState(false);
  const [hasFetchedCompleted, setHasFetchedCompleted] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const { toast } = useToast();

  const getActiveLocalKey = useCallback((uid?: string | null) => uid ? LOCAL_STORAGE_ACTIVE_LISTS_KEY_PREFIX + uid : LOCAL_STORAGE_ACTIVE_LISTS_KEY_PREFIX + "anonymous", []);
  const getCompletedLocalKey = useCallback((uid?: string | null) => uid ? LOCAL_STORAGE_COMPLETED_LISTS_KEY_PREFIX + uid : LOCAL_STORAGE_COMPLETED_LISTS_KEY_PREFIX + "anonymous", []);

  const sortLists = (a: List, b: List) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();

  useEffect(() => {
    const unsubscribe = onAuthUserChanged((user) => {
      setCurrentUser(user);
      setActiveLists([]);
      setCompletedLists([]);
      setHasFetchedCompleted(false);
      setIsLoading(true); // Reset loading state for active lists
      if (!user) {
        setIsLoading(false); // No user, so not loading active lists from Firebase
        setIsLoadingCompleted(false); // Also not loading completed lists
        if (!isFirebaseConfigured()) {
          try {
            const localActive = localStorage.getItem(getActiveLocalKey());
            if (localActive) setActiveLists(JSON.parse(localActive).sort(sortLists));
            const localCompleted = localStorage.getItem(getCompletedLocalKey());
            if (localCompleted) setCompletedLists(JSON.parse(localCompleted).sort(sortLists));
          } catch (error) {
            console.error("Error loading lists from local storage (no Firebase, no user):", error);
          }
        }
      }
    });
    return () => unsubscribe();
  }, [toast, getActiveLocalKey, getCompletedLocalKey]);


  useEffect(() => {
    if (currentUser && isFirebaseConfigured()) {
      setIsLoading(true);
      const localActiveKey = getActiveLocalKey(currentUser.uid);
      const localCompletedKey = getCompletedLocalKey(currentUser.uid);

      getListsFromFirebase(currentUser.uid)
        .then((firebaseLists) => {
          setActiveLists(firebaseLists.sort(sortLists));
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
            const localListsData = localStorage.getItem(localActiveKey);
            if (localListsData) setActiveLists(JSON.parse(localListsData).sort(sortLists));
            else setActiveLists([]);
          } catch (e) {
            console.error("Failed to load active lists from local storage fallback", e);
            setActiveLists([]);
          }
        })
        .finally(() => {
          setIsLoading(false);
        });
      
      // Pre-load completed lists from local storage on auth change, but don't mark as fetched from Firebase yet
      setCompletedLists([]); // Clear previous user's completed lists
      setHasFetchedCompleted(false); // Reset fetch status for new user
      try {
        const localCompletedData = localStorage.getItem(localCompletedKey);
        if (localCompletedData) {
            setCompletedLists(JSON.parse(localCompletedData).sort(sortLists));
        }
      } catch(e) {
        console.error("Failed to load completed lists from local storage on auth change", e);
      }

    } else if (!currentUser && !isFirebaseConfigured()) {
      // Handled by onAuthUserChanged for initial load from general local storage
      setIsLoading(false);
    } else if (!currentUser && isFirebaseConfigured()) {
      // User logged out, Firebase is configured, clear lists and stop loading
      setActiveLists([]);
      setCompletedLists([]);
      setHasFetchedCompleted(false);
      setIsLoading(false);
    }
  }, [currentUser, toast, getActiveLocalKey, getCompletedLocalKey]);

  useEffect(() => {
    if (!isLoading) { 
      if (currentUser && isFirebaseConfigured()) {
        localStorage.setItem(getActiveLocalKey(currentUser.uid), JSON.stringify(activeLists));
      } else if (!isFirebaseConfigured()) {
        localStorage.setItem(getActiveLocalKey(), JSON.stringify(activeLists));
      }
    }
  }, [activeLists, isLoading, currentUser, getActiveLocalKey]);

  useEffect(() => {
    // Only save to local storage if we are not currently loading completed lists AND we have actually fetched them (or completed an attempt)
    if (hasFetchedCompleted && !isLoadingCompleted) { 
      if (currentUser && isFirebaseConfigured()) {
        localStorage.setItem(getCompletedLocalKey(currentUser.uid), JSON.stringify(completedLists));
      } else if (!isFirebaseConfigured()) {
        localStorage.setItem(getCompletedLocalKey(), JSON.stringify(completedLists));
      }
    }
  }, [completedLists, hasFetchedCompleted, isLoadingCompleted, currentUser, getCompletedLocalKey]);


  const fetchCompletedListsIfNeeded = useCallback(async () => {
    if (!currentUser || !isFirebaseConfigured()) {
      if (!currentUser && isFirebaseConfigured()) {
        toast({ title: "Please Sign In", description: "Sign in to view completed lists.", variant: "default" });
      }
      // If Firebase isn't configured, mark as "fetched" to avoid repeated attempts / show "no items"
      if(!isFirebaseConfigured() && !hasFetchedCompleted) setHasFetchedCompleted(true); 
      return;
    }
    if (hasFetchedCompleted && !isLoadingCompleted) return; 

    setIsLoadingCompleted(true);
    const localKey = getCompletedLocalKey(currentUser.uid);
    try {
      const firebaseCompletedLists = await getCompletedListsFromFirebase(currentUser.uid);
      setCompletedLists(firebaseCompletedLists.sort(sortLists));
      // localStorage.setItem(localKey, JSON.stringify(firebaseCompletedLists)); // Moved to useEffect
    } catch (error) {
      console.error("Error fetching completed lists from Firebase:", error);
      toast({
        title: "Firebase Load Error",
        description: "Could not load completed lists. Check console.",
        variant: "destructive",
      });
       try { // Fallback to local storage if Firebase fetch fails
          const localListsData = localStorage.getItem(localKey);
          if (localListsData) setCompletedLists(JSON.parse(localListsData).sort(sortLists));
          else setCompletedLists([]);
        } catch (e) {
          console.error("Failed to load completed lists from local storage fallback", e);
          setCompletedLists([]);
        }
    } finally {
      setIsLoadingCompleted(false);
      setHasFetchedCompleted(true);
    }
  }, [currentUser, hasFetchedCompleted, isLoadingCompleted, toast, getCompletedLocalKey]);


  const addList = async (
    listData: Omit<List, "id" | "completed" | "subitems" | "createdAt" | "userId" | "scanImageUrl">,
    capturedImageFile?: File | null
  ): Promise<List | undefined> => {
    if (!currentUser && isFirebaseConfigured()) {
      toast({ title: "Not Signed In", description: "Please sign in to add lists.", variant: "destructive" });
      return undefined;
    }

    const optimisticId = crypto.randomUUID();
    const optimisticList: List = {
      title: listData.title,
      completed: false,
      subitems: [],
      userId: currentUser?.uid,
      id: optimisticId,
      createdAt: new Date().toISOString(),
      // scanImageUrl will be added later if upload succeeds
    };

    // Optimistically add to activeLists
    setActiveLists(prev => [optimisticList, ...prev].sort(sortLists));

    if (isFirebaseConfigured() && currentUser) {
      try {
        // Prepare data for Firebase (excluding id, createdAt which are server-generated or handled)
        const newListBase: Omit<List, "id" | "createdAt" | "scanImageUrl"> = { 
            title: listData.title,
            completed: false,
            subitems: [], // Subitems are managed separately or via updates for simplicity here
            userId: currentUser.uid,
        };
        const addedListFromFirebase = await addListToFirebase(newListBase, currentUser.uid);
        let finalFirebaseList = addedListFromFirebase; // This will have the server timestamp for createdAt

        if (capturedImageFile) {
          try {
            const downloadURL = await uploadScanImageToFirebase(capturedImageFile, currentUser.uid, addedListFromFirebase.id);
            // Update the list in Firebase with the scanImageUrl
            await updateListInFirebase(addedListFromFirebase.id, { scanImageUrl: downloadURL });
            finalFirebaseList = { ...addedListFromFirebase, scanImageUrl: downloadURL };
          } catch (uploadError) {
            console.error("Error uploading scan image or updating list with URL:", uploadError);
            toast({ title: "Image Upload Failed", description: "List created, but image upload failed.", variant: "destructive" });
            // No need to remove the list, it was already created. User can retry scan or delete manually.
          }
        }
        
        // Replace optimistic list with the final one from Firebase
        setActiveLists(prev => prev.map(l => l.id === optimisticId ? finalFirebaseList : l).sort(sortLists));
        return finalFirebaseList;

      } catch (error) {
        console.error("Error adding list to Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not add list.", variant: "destructive" });
        // Rollback optimistic update
        setActiveLists(prev => prev.filter(l => l.id !== optimisticId).sort(sortLists));
        return undefined;
      }
    } else if (!isFirebaseConfigured()) {
      // Non-Firebase mode, optimisticList is the final list
      return optimisticList;
    }
    return undefined; // Should not happen if logic is correct
  };

  const updateList = async (listId: string, updates: Partial<List>) => {
    let originalList: List | undefined;
    let originalSourceArray: 'active' | 'completed' | null = null;
    
    // Find the original list and its source
    const activeMatch = activeLists.find(l => l.id === listId);
    if (activeMatch) {
        originalList = JSON.parse(JSON.stringify(activeMatch)); // Deep copy for rollback
        originalSourceArray = 'active';
    } else {
        const completedMatch = completedLists.find(l => l.id === listId);
        if (completedMatch) {
            originalList = JSON.parse(JSON.stringify(completedMatch)); // Deep copy
            originalSourceArray = 'completed';
        }
    }

    if (!originalList) {
        console.error("List not found for update:", listId);
        toast({ title: "Error", description: "List to update not found.", variant: "destructive" });
        return;
    }

    const updatedList = { ...originalList, ...updates };

    // Optimistic UI update
    if (originalSourceArray === 'active') {
        if (updates.completed === true) { // Moving from active to completed
            setActiveLists(prev => prev.filter(l => l.id !== listId).sort(sortLists));
            setCompletedLists(prev => [updatedList, ...prev.filter(c => c.id !== listId)].sort(sortLists));
        } else { // Updating an active list
            setActiveLists(prev => prev.map(l => l.id === listId ? updatedList : l).sort(sortLists));
        }
    } else if (originalSourceArray === 'completed') {
        if (updates.completed === false) { // Moving from completed to active
            setCompletedLists(prev => prev.filter(l => l.id !== listId).sort(sortLists));
            setActiveLists(prev => [updatedList, ...prev.filter(a => a.id !== listId)].sort(sortLists));
        } else { // Updating a completed list
            setCompletedLists(prev => prev.map(l => l.id === listId ? updatedList : l).sort(sortLists));
        }
    }

    if (isFirebaseConfigured() && currentUser) {
        try {
            const firebaseUpdates = { ...updates };
            // Remove fields that shouldn't be directly updated or are managed by Firebase
            delete (firebaseUpdates as any).userId; 
            delete (firebaseUpdates as any).createdAt; 
            // Subitems are handled by updateSubitemsInFirebase if it's just subitem changes
            // If updateList is called for subitem changes, it needs to be mapped correctly
            if (updates.subitems !== undefined) {
              (firebaseUpdates as any).subtasks = updates.subitems.map(si => ({ id: si.id, title: si.title, completed: si.completed }));
              delete firebaseUpdates.subitems;
            }

            await updateListInFirebase(listId, firebaseUpdates);
        } catch (error) {
            console.error("Error updating list in Firebase:", error);
            toast({ title: "Firebase Error", description: "Could not update list. Reverting.", variant: "destructive" });
            // Rollback optimistic update
            if (originalSourceArray === 'active') {
                setActiveLists(prevActive => {
                    const stillActive = prevActive.filter(l => l.id !== listId);
                    if (updates.completed === true) { // Was moved to completed, move back
                        setCompletedLists(prevCompleted => prevCompleted.filter(l => l.id !== listId).sort(sortLists));
                        return [originalList!, ...stillActive].sort(sortLists);
                    }
                    return prevActive.map(l => l.id === listId ? originalList! : l).sort(sortLists);
                });
            } else if (originalSourceArray === 'completed') {
                 setCompletedLists(prevCompleted => {
                    const stillCompleted = prevCompleted.filter(l => l.id !== listId);
                     if (updates.completed === false) { // Was moved to active, move back
                        setActiveLists(prevActive => prevActive.filter(l => l.id !== listId).sort(sortLists));
                        return [originalList!, ...stillCompleted].sort(sortLists);
                    }
                    return prevCompleted.map(l => l.id === listId ? originalList! : l).sort(sortLists);
                 });
            }
        }
    }
  };

  const deleteList = async (listId: string) => {
    const originalActiveLists = [...activeLists];
    const originalCompletedLists = [...completedLists];
    let wasActive = activeLists.some(l => l.id === listId);
    
    setActiveLists(prev => prev.filter(l => l.id !== listId));
    setCompletedLists(prev => prev.filter(l => l.id !== listId));

    if (isFirebaseConfigured() && currentUser) {
      try {
        await deleteListFromFirebase(listId);
      } catch (error) {
        console.error("Error deleting list from Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not delete list. Reverting.", variant: "destructive" });
        if (wasActive) {
            setActiveLists(originalActiveLists.sort(sortLists));
        } else {
            setCompletedLists(originalCompletedLists.sort(sortLists));
        }
      }
    }
  };

  const manageSubitems = async (listId: string, newSubitems: Subitem[]) => {
    let originalList: List | undefined;
    let sourceArray: 'active' | 'completed' | null = null;

    const activeMatch = activeLists.find(l => l.id === listId);
    if (activeMatch) {
        originalList = JSON.parse(JSON.stringify(activeMatch)); // Deep copy for rollback
        sourceArray = 'active';
        setActiveLists(prev => prev.map(l => l.id === listId ? { ...l, subitems: newSubitems } : l).sort(sortLists));
    } else {
        const completedMatch = completedLists.find(l => l.id === listId);
        if (completedMatch) {
            originalList = JSON.parse(JSON.stringify(completedMatch)); // Deep copy
            sourceArray = 'completed';
            setCompletedLists(prev => prev.map(l => l.id === listId ? { ...l, subitems: newSubitems } : l).sort(sortLists));
        }
    }
    
    if (!originalList) {
      console.error("List not found for managing subitems:", listId);
      toast({ title: "Error", description: "Parent list not found for subitems.", variant: "destructive" });
      return;
    }

    if (isFirebaseConfigured() && currentUser) {
      try {
        await updateSubitemsInFirebase(listId, newSubitems);
      } catch (error) {
        console.error("Error managing subitems in Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not update subitems. Reverting.", variant: "destructive" });
        if (sourceArray === 'active') {
            setActiveLists(prev => prev.map(l => l.id === listId ? originalList! : l).sort(sortLists));
        } else if (sourceArray === 'completed') {
            setCompletedLists(prev => prev.map(l => l.id === listId ? originalList! : l).sort(sortLists));
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

