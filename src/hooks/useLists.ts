
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

  const sortLists = (a: List, b: List) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

  useEffect(() => {
    const unsubscribe = onAuthUserChanged((user) => {
      setCurrentUser(user);
      setActiveLists([]); 
      setCompletedLists([]);
      setHasFetchedCompleted(false);
      setIsLoading(true); // Set loading true initially on auth change
      if (!user) {
        setIsLoading(false); 
        setIsLoadingCompleted(false);
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
          try {
            localStorage.setItem(localActiveKey, JSON.stringify(firebaseLists));
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
      
      // Reset completed lists as they need to be fetched on demand, but load from local if available
      setCompletedLists([]);
      setHasFetchedCompleted(false);
      try {
        const localCompletedData = localStorage.getItem(localCompletedKey);
        if (localCompletedData) {
            // If we have local completed data, we can consider it "fetched" locally
            // and display it. fetchCompletedListsIfNeeded will still refresh from Firebase if called.
            setCompletedLists(JSON.parse(localCompletedData).sort(sortLists));
            // setHasFetchedCompleted(true); // Or manage this more carefully if accordion always fetches
        }
      } catch(e) {
        console.error("Failed to load completed lists from local storage on auth change", e);
      }

    } else if (!currentUser && !isFirebaseConfigured()) {
      setIsLoading(false);
    } else if (!currentUser && isFirebaseConfigured()) {
      setActiveLists([]);
      setCompletedLists([]);
      setHasFetchedCompleted(false);
      setIsLoading(false);
    }
  }, [currentUser, toast, getActiveLocalKey, getCompletedLocalKey]);

  useEffect(() => {
    if (!isLoading && activeLists.length > 0) { 
      if (currentUser && isFirebaseConfigured()) {
        localStorage.setItem(getActiveLocalKey(currentUser.uid), JSON.stringify(activeLists));
      } else if (!isFirebaseConfigured()) {
        localStorage.setItem(getActiveLocalKey(), JSON.stringify(activeLists));
      }
    } else if (!isLoading && activeLists.length === 0) { // Also save empty state
        if (currentUser && isFirebaseConfigured()) {
            localStorage.setItem(getActiveLocalKey(currentUser.uid), JSON.stringify([]));
        } else if (!isFirebaseConfigured()) {
            localStorage.setItem(getActiveLocalKey(), JSON.stringify([]));
        }
    }
  }, [activeLists, isLoading, currentUser, getActiveLocalKey]);

  useEffect(() => {
    if (hasFetchedCompleted && !isLoadingCompleted && completedLists.length > 0) { 
      if (currentUser && isFirebaseConfigured()) {
        localStorage.setItem(getCompletedLocalKey(currentUser.uid), JSON.stringify(completedLists));
      } else if (!isFirebaseConfigured()) {
        localStorage.setItem(getCompletedLocalKey(), JSON.stringify(completedLists));
      }
    } else if (hasFetchedCompleted && !isLoadingCompleted && completedLists.length === 0) { // Also save empty state
        if (currentUser && isFirebaseConfigured()) {
            localStorage.setItem(getCompletedLocalKey(currentUser.uid), JSON.stringify([]));
        } else if (!isFirebaseConfigured()) {
            localStorage.setItem(getCompletedLocalKey(), JSON.stringify([]));
        }
    }
  }, [completedLists, hasFetchedCompleted, isLoadingCompleted, currentUser, getCompletedLocalKey]);


  const fetchCompletedListsIfNeeded = useCallback(async () => {
    if (!currentUser || !isFirebaseConfigured()) {
      if (!currentUser && isFirebaseConfigured()) {
        toast({ title: "Please Sign In", description: "Sign in to view completed lists.", variant: "default" });
      }
      // If not firebase, completed lists are loaded from local storage initially
      if(!isFirebaseConfigured() && !hasFetchedCompleted) setHasFetchedCompleted(true);
      return;
    }
    if (hasFetchedCompleted && !isLoadingCompleted) return; // Already fetched or currently fetching

    setIsLoadingCompleted(true);
    const localKey = getCompletedLocalKey(currentUser.uid);
    try {
      const firebaseCompletedLists = await getCompletedListsFromFirebase(currentUser.uid);
      setCompletedLists(firebaseCompletedLists.sort(sortLists));
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
    };

    setActiveLists(prev => [optimisticList, ...prev].sort(sortLists));

    if (isFirebaseConfigured() && currentUser) {
      try {
        const newListBase: Omit<List, "id" | "createdAt" | "scanImageUrl"> = { // For Firebase
            title: listData.title,
            completed: false,
            subitems: [],
            userId: currentUser.uid,
        };
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
        
        setActiveLists(prev => prev.map(l => l.id === optimisticId ? finalFirebaseList : l).sort(sortLists));
        return finalFirebaseList;

      } catch (error) {
        console.error("Error adding list to Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not add list.", variant: "destructive" });
        setActiveLists(prev => prev.filter(l => l.id !== optimisticId).sort(sortLists));
        return undefined;
      }
    } else if (!isFirebaseConfigured()) {
      return optimisticList;
    }
    return undefined;
  };

  const updateList = async (listId: string, updates: Partial<List>) => {
    let capturedOriginalList: List | undefined;
    let capturedSourceArray: 'active' | 'completed' | null = null;

    // Determine original state before optimistic updates
    const activeMatch = activeLists.find(l => l.id === listId);
    if (activeMatch) {
        capturedOriginalList = { ...activeMatch };
        capturedSourceArray = 'active';
    } else {
        const completedMatch = completedLists.find(l => l.id === listId);
        if (completedMatch) {
            capturedOriginalList = { ...completedMatch };
            capturedSourceArray = 'completed';
        }
    }

    if (!capturedOriginalList) {
        console.error("List not found for update:", listId, { activeLists, completedLists });
        toast({ title: "Error", description: "List to update not found.", variant: "destructive" });
        return;
    }

    const updatedList = { ...capturedOriginalList, ...updates };

    // Perform optimistic updates
    if (capturedSourceArray === 'active') {
        if (updates.completed === true) { // Moving active -> completed
            setActiveLists(prev => prev.filter(l => l.id !== listId).sort(sortLists));
            setCompletedLists(prev => [updatedList, ...prev.filter(c => c.id !== listId)].sort(sortLists));
        } else { // Update within active
            setActiveLists(prev => prev.map(l => l.id === listId ? updatedList : l).sort(sortLists));
        }
    } else if (capturedSourceArray === 'completed') {
        if (updates.completed === false) { // Moving completed -> active
            setCompletedLists(prev => prev.filter(l => l.id !== listId).sort(sortLists));
            setActiveLists(prev => [updatedList, ...prev.filter(a => a.id !== listId)].sort(sortLists));
        } else { // Update within completed
            setCompletedLists(prev => prev.map(l => l.id === listId ? updatedList : l).sort(sortLists));
        }
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
            if (capturedOriginalList && capturedSourceArray) {
                if (capturedSourceArray === 'active') {
                    if (updates.completed === true) { // Was active, tried to move to completed
                        // Add back to active, remove from completed
                        setActiveLists(prev => [capturedOriginalList!, ...prev.filter(l => l.id !== capturedOriginalList!.id)].sort(sortLists));
                        setCompletedLists(prev => prev.filter(l => l.id !== capturedOriginalList!.id).sort(sortLists));
                    } else { // Was active, in-place update failed
                        setActiveLists(prev => prev.map(l => l.id === capturedOriginalList!.id ? capturedOriginalList! : l).sort(sortLists));
                    }
                } else if (capturedSourceArray === 'completed') {
                    if (updates.completed === false) { // Was completed, tried to move to active
                        // Add back to completed, remove from active
                        setCompletedLists(prev => [capturedOriginalList!, ...prev.filter(l => l.id !== capturedOriginalList!.id)].sort(sortLists));
                        setActiveLists(prev => prev.filter(l => l.id !== capturedOriginalList!.id).sort(sortLists));
                    } else { // Was completed, in-place update failed
                        setCompletedLists(prev => prev.map(l => l.id === capturedOriginalList!.id ? capturedOriginalList! : l).sort(sortLists));
                    }
                }
            }
        }
    }
  };

  const deleteList = async (listId: string) => {
    const originalActiveLists = [...activeLists];
    const originalCompletedLists = [...completedLists];
    
    setActiveLists(prev => prev.filter(l => l.id !== listId));
    setCompletedLists(prev => prev.filter(l => l.id !== listId));

    if (isFirebaseConfigured() && currentUser) {
      try {
        await deleteListFromFirebase(listId);
      } catch (error) {
        console.error("Error deleting list from Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not delete list. Reverting.", variant: "destructive" });
        // Basic rollback, assumes lists were in original arrays
        setActiveLists(originalActiveLists.sort(sortLists));
        setCompletedLists(originalCompletedLists.sort(sortLists));
      }
    }
  };

  const manageSubitems = async (listId: string, newSubitems: Subitem[]) => {
    let originalList: List | undefined;
    let sourceArray: 'active' | 'completed' | null = null;

    // Find the list and its source array
    const activeMatch = activeLists.find(l => l.id === listId);
    if (activeMatch) {
        originalList = { ...activeMatch };
        sourceArray = 'active';
        setActiveLists(prev => prev.map(l => l.id === listId ? { ...l, subitems: newSubitems } : l).sort(sortLists));
    } else {
        const completedMatch = completedLists.find(l => l.id === listId);
        if (completedMatch) {
            originalList = { ...completedMatch };
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
        if (originalList && sourceArray === 'active') {
            setActiveLists(prev => prev.map(l => l.id === listId ? originalList! : l).sort(sortLists));
        } else if (originalList && sourceArray === 'completed') {
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
