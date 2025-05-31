
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
  generateShareIdForList, // New import
  removeShareIdFromList, // New import
  getListByShareId, // New import for potentially fetching shared list data directly if needed elsewhere
} from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { User } from "firebase/auth";

const LOCAL_STORAGE_ACTIVE_LISTS_KEY_PREFIX = "listify_active_lists_";
const LOCAL_STORAGE_COMPLETED_LISTS_KEY_PREFIX = "listify_completed_lists_";

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
      setIsLoading(true);
      if (!user && !isFirebaseConfigured()) {
        try {
          const localActive = localStorage.getItem(getActiveLocalKey());
          if (localActive) setActiveLists(JSON.parse(localActive).sort(sortLists));
          const localCompleted = localStorage.getItem(getCompletedLocalKey());
          if (localCompleted) setCompletedLists(JSON.parse(localCompleted).sort(sortLists));
        } catch (error) {
          console.error("Error loading lists from local storage (no Firebase, no user):", error);
        }
        setIsLoading(false);
      } else if (!user && isFirebaseConfigured()){
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, [toast, getActiveLocalKey, getCompletedLocalKey]);


  useEffect(() => {
    if (currentUser && isFirebaseConfigured()) {
      setIsLoading(true);
      getListsFromFirebase(currentUser.uid)
        .then((firebaseLists) => {
          setActiveLists(firebaseLists.sort(sortLists));
        })
        .catch((error) => {
          console.error("Error loading active lists from Firebase:", error);
          toast({
            title: "Firebase Load Error",
            description: "Could not load active lists. Using local cache if available.",
            variant: "destructive",
            duration: 9000,
          });
          try {
            const localListsData = localStorage.getItem(getActiveLocalKey(currentUser.uid));
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
      
      setCompletedLists([]); 
      setHasFetchedCompleted(false);
      try {
        const localCompletedData = localStorage.getItem(getCompletedLocalKey(currentUser.uid));
        if (localCompletedData) {
            setCompletedLists(JSON.parse(localCompletedData).sort(sortLists));
        }
      } catch(e) {
        console.error("Failed to load completed lists from local storage on auth change", e);
      }
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
      if (!isFirebaseConfigured() && !hasFetchedCompleted) {
        setHasFetchedCompleted(true);
        setIsLoadingCompleted(false);
      }
      return;
    }
    if (hasFetchedCompleted && !isLoadingCompleted && completedLists.length > 0) return; 
    if (isLoadingCompleted) return;


    setIsLoadingCompleted(true);
    try {
      console.log("[useLists] Fetching completed lists from Firebase...");
      const firebaseCompletedLists = await getCompletedListsFromFirebase(currentUser.uid);
      console.log("[useLists] Fetched completed lists from Firebase:", firebaseCompletedLists);
      setCompletedLists(firebaseCompletedLists.sort(sortLists));
      setHasFetchedCompleted(true);
    } catch (error) {
      console.error("Error fetching completed lists from Firebase:", error);
      toast({
        title: "Firebase Load Error",
        description: "Could not load completed lists. Using local cache if available.",
        variant: "destructive",
      });
       try { 
          const localListsData = localStorage.getItem(getCompletedLocalKey(currentUser.uid));
          if (localListsData) setCompletedLists(JSON.parse(localListsData).sort(sortLists));
          else setCompletedLists([]);
        } catch (e) {
          console.error("Failed to load completed lists from local storage fallback", e);
          setCompletedLists([]);
        }
        setHasFetchedCompleted(true); 
    } finally {
      setIsLoadingCompleted(false);
    }
  }, [currentUser, hasFetchedCompleted, isLoadingCompleted, toast, getCompletedLocalKey, completedLists.length]);


  const addList = async (
    listData: Omit<List, "id" | "completed" | "subitems" | "createdAt" | "userId" | "scanImageUrls" | "shareId">,
    capturedImageFile?: File | null
  ): Promise<List | undefined> => {
    if (!currentUser && isFirebaseConfigured()) {
      toast({ title: "Not Signed In", description: "Please sign in to add lists.", variant: "destructive" });
      return undefined;
    }

    const optimisticId = crypto.randomUUID();
    let optimisticList: List = {
      ...listData,
      completed: false,
      subitems: [],
      userId: currentUser?.uid,
      id: optimisticId,
      createdAt: new Date().toISOString(),
      scanImageUrls: [],
      shareId: null,
    };

    setActiveLists(prev => [optimisticList, ...prev].sort(sortLists));

    if (isFirebaseConfigured() && currentUser) {
      try {
        let initialScanUrl: string | undefined = undefined;
        if (capturedImageFile) {
          initialScanUrl = await uploadScanImageToFirebase(capturedImageFile, currentUser.uid, optimisticId);
        }

        const newListBase: Omit<List, "id" | "createdAt"> = { 
            ...listData,
            completed: false,
            subitems: [], 
            userId: currentUser.uid,
            scanImageUrls: initialScanUrl ? [initialScanUrl] : [],
            shareId: null,
        };
        
        const addedListFromFirebase = await addListToFirebase(newListBase, currentUser.uid);
        
        const finalFirebaseList = { ...addedListFromFirebase, subitems: [] }; 
        
        setActiveLists(prev => prev.map(l => l.id === optimisticId ? finalFirebaseList : l).sort(sortLists));
        return finalFirebaseList;

      } catch (error) {
        console.error("Error adding list to Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not add list.", variant: "destructive" });
        setActiveLists(prev => prev.filter(l => l.id !== optimisticId).sort(sortLists));
        return undefined;
      }
    } else if (!isFirebaseConfigured()) {
      return { ...optimisticList, scanImageUrls: [], shareId: null };
    }
    return undefined; 
  };

  const updateList = async (listId: string, updates: Partial<List>) => {
    let originalListState: List | undefined;
    let originalSourceArray: 'active' | 'completed' | null = null;
    let listFound = false;

    const applyUpdates = (list: List) => ({ ...list, ...updates });

    setActiveLists(prev => {
      const listIndex = prev.findIndex(l => l.id === listId);
      if (listIndex > -1) {
        originalListState = JSON.parse(JSON.stringify(prev[listIndex]));
        originalSourceArray = 'active';
        listFound = true;
        if (updates.completed === true) { 
          return prev.filter(l => l.id !== listId).sort(sortLists);
        }
        return prev.map(l => l.id === listId ? applyUpdates(l) : l).sort(sortLists);
      }
      return prev;
    });

    if (!listFound) {
      setCompletedLists(prev => {
        const listIndex = prev.findIndex(l => l.id === listId);
        if (listIndex > -1) {
          originalListState = JSON.parse(JSON.stringify(prev[listIndex]));
          originalSourceArray = 'completed';
          listFound = true;
          if (updates.completed === false) { 
            return prev.filter(l => l.id !== listId).sort(sortLists);
          }
          return prev.map(l => l.id === listId ? applyUpdates(l) : l).sort(sortLists);
        }
        return prev;
      });
    }
    
    if (!originalListState && listFound) {
         console.warn(`[useLists] updateList: List ${listId} was found for UI update but original state capture failed.`);
    }
    
    const updatedListForTargetArray = applyUpdates(originalListState || {id: listId, title:'', completed:false, subitems:[], createdAt: new Date().toISOString(), userId: currentUser?.uid, scanImageUrls: [], shareId: null});

    if (updates.completed === true && originalSourceArray === 'active') {
      setCompletedLists(prev => [updatedListForTargetArray, ...prev.filter(c => c.id !== listId)].sort(sortLists));
    } else if (updates.completed === false && originalSourceArray === 'completed') {
      setActiveLists(prev => [updatedListForTargetArray, ...prev.filter(a => a.id !== listId)].sort(sortLists));
    }

    if (isFirebaseConfigured() && currentUser) {
        try {
            const firebaseUpdates = { ...updates };
            delete (firebaseUpdates as any).id; 
            delete (firebaseUpdates as any).userId; 
            delete (firebaseUpdates as any).createdAt; 
            
            if (updates.subitems !== undefined) {
              (firebaseUpdates as any).subtasks = updates.subitems.map(si => ({ id: si.id, title: si.title, completed: si.completed }));
              delete firebaseUpdates.subitems;
            }
            await updateListInFirebase(listId, firebaseUpdates);
        } catch (error) {
            console.error("Error updating list in Firebase:", error);
            toast({ title: "Firebase Error", description: "Could not update list. Reverting.", variant: "destructive" });
            if (originalListState && originalSourceArray) {
                setActiveLists(prevActive => {
                    const currentActive = prevActive.filter(l => l.id !== listId);
                    return (originalSourceArray === 'active' ? [originalListState, ...currentActive] : currentActive).sort(sortLists);
                });
                setCompletedLists(prevCompleted => {
                    const currentCompleted = prevCompleted.filter(l => l.id !== listId);
                    return (originalSourceArray === 'completed' ? [originalListState, ...currentCompleted] : currentCompleted).sort(sortLists);
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
    let capturedOriginalSubitems: Subitem[] | undefined = undefined;
    let listSourceForRollback: 'active' | 'completed' | 'unknown' = 'unknown';

    setActiveLists(prevActiveLists => {
      const listIndex = prevActiveLists.findIndex(l => l.id === listId);
      if (listIndex > -1) {
        if (capturedOriginalSubitems === undefined) {
          capturedOriginalSubitems = JSON.parse(JSON.stringify(prevActiveLists[listIndex].subitems));
          listSourceForRollback = 'active';
        }
        const updatedList = { ...prevActiveLists[listIndex], subitems: newSubitems };
        const newActiveLists = [...prevActiveLists];
        newActiveLists[listIndex] = updatedList;
        return newActiveLists.sort(sortLists);
      }
      return prevActiveLists;
    });

    if (listSourceForRollback === 'unknown') {
      setCompletedLists(prevCompletedLists => {
        const listIndex = prevCompletedLists.findIndex(l => l.id === listId);
        if (listIndex > -1) {
          if (capturedOriginalSubitems === undefined) {
            capturedOriginalSubitems = JSON.parse(JSON.stringify(prevCompletedLists[listIndex].subitems));
            listSourceForRollback = 'completed';
          }
          const updatedList = { ...prevCompletedLists[listIndex], subitems: newSubitems };
          const newCompletedLists = [...prevCompletedLists];
          newCompletedLists[listIndex] = updatedList;
          return newCompletedLists.sort(sortLists);
        }
        return prevCompletedLists;
      });
    }
    
    if (capturedOriginalSubitems === undefined) {
      capturedOriginalSubitems = [];
      if (listSourceForRollback === 'unknown') listSourceForRollback = 'active'; 
    }

    if (isFirebaseConfigured() && currentUser) {
      try {
        await updateSubitemsInFirebase(listId, newSubitems);
      } catch (error) {
        console.error("Error managing subitems in Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not update subitems. Reverting.", variant: "destructive" });
        
        if (listSourceForRollback === 'active') {
          setActiveLists(prev => prev.map(l => l.id === listId ? { ...l, subitems: capturedOriginalSubitems! } : l).sort(sortLists));
        } else if (listSourceForRollback === 'completed') {
          setCompletedLists(prev => prev.map(l => l.id === listId ? { ...l, subitems: capturedOriginalSubitems! } : l).sort(sortLists));
        }
      }
    }
  };

  const shareList = async (listId: string): Promise<string | null> => {
    if (!currentUser || !isFirebaseConfigured()) {
      toast({ title: "Error", description: "You must be signed in to share lists.", variant: "destructive" });
      return null;
    }
    try {
      const newShareId = await generateShareIdForList(listId, currentUser.uid);
      if (newShareId) {
        await updateList(listId, { shareId: newShareId }); // This will update local state
        toast({ title: "List Shared!", description: "A public share link has been created." });
        return newShareId;
      } else {
        toast({ title: "Sharing Failed", description: "Could not generate a share link.", variant: "destructive" });
        return null;
      }
    } catch (error) {
      console.error("Error sharing list:", error);
      toast({ title: "Sharing Error", description: "An error occurred while trying to share the list.", variant: "destructive" });
      return null;
    }
  };

  const unshareList = async (listId: string): Promise<void> => {
    if (!currentUser || !isFirebaseConfigured()) {
      toast({ title: "Error", description: "You must be signed in to manage sharing.", variant: "destructive" });
      return;
    }
    try {
      await removeShareIdFromList(listId, currentUser.uid);
      await updateList(listId, { shareId: null }); // This will update local state
      toast({ title: "Sharing Stopped", description: "The list is no longer publicly shared." });
    } catch (error) {
      console.error("Error unsharing list:", error);
      toast({ title: "Unsharing Error", description: "An error occurred while trying to stop sharing.", variant: "destructive" });
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
    shareList, // Expose new method
    unshareList, // Expose new method
    getListByShareId, // Potentially useful for the shared page later
  };
};

