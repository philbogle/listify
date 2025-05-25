
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
      setIsLoading(true); 
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
      
      setCompletedLists([]); 
      setHasFetchedCompleted(false); 
      try {
        const localCompletedData = localStorage.getItem(localCompletedKey);
        if (localCompletedData) {
            setCompletedLists(JSON.parse(localCompletedData).sort(sortLists));
        }
      } catch(e) {
        console.error("Failed to load completed lists from local storage on auth change", e);
      }

    } else if (!currentUser && !isFirebaseConfigured()) {
      setIsLoading(false);
       try {
        const localActive = localStorage.getItem(getActiveLocalKey());
        if (localActive) setActiveLists(JSON.parse(localActive).sort(sortLists));
        const localCompleted = localStorage.getItem(getCompletedLocalKey());
        if (localCompleted) setCompletedLists(JSON.parse(localCompleted).sort(sortLists));
      } catch (error) {
        console.error("Error loading lists from local storage (no Firebase, no user) ineffect:", error);
      }
    } else if (!currentUser && isFirebaseConfigured()) {
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
      if (!isFirebaseConfigured() && !hasFetchedCompleted) setHasFetchedCompleted(true); 
      return;
    }
    if (hasFetchedCompleted && !isLoadingCompleted) return; 

    setIsLoadingCompleted(true);
    const localKey = getCompletedLocalKey(currentUser.uid);
    try {
      const firebaseCompletedLists = await getCompletedListsFromFirebase(currentUser.uid);
      setCompletedLists(firebaseCompletedLists.sort(sortLists));
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
        const newListBase: Omit<List, "id" | "createdAt" | "scanImageUrl"> = { 
            title: listData.title,
            completed: false,
            subitems: [], 
            userId: currentUser.uid,
        };
        const addedListFromFirebase = await addListToFirebase(newListBase, currentUser.uid);
        let finalFirebaseList = { ...addedListFromFirebase, subitems: [] }; 

        if (capturedImageFile) {
          try {
            const downloadURL = await uploadScanImageToFirebase(capturedImageFile, currentUser.uid, addedListFromFirebase.id);
            await updateListInFirebase(addedListFromFirebase.id, { scanImageUrl: downloadURL });
            finalFirebaseList = { ...finalFirebaseList, scanImageUrl: downloadURL };
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
    let originalListState: List | undefined;
    let originalSourceArray: 'active' | 'completed' | null = null;

    // Capture current state for rollback
    const currentActiveList = activeLists.find(l => l.id === listId);
    if (currentActiveList) {
        originalListState = JSON.parse(JSON.stringify(currentActiveList));
        originalSourceArray = 'active';
    } else {
        const currentCompletedList = completedLists.find(l => l.id === listId);
        if (currentCompletedList) {
            originalListState = JSON.parse(JSON.stringify(currentCompletedList));
            originalSourceArray = 'completed';
        }
    }
    
    const updatedList = { ...(originalListState || {id: listId, title:'', completed:false, subitems:[], createdAt: new Date().toISOString(), userId: currentUser?.uid}), ...updates };


    // Optimistic UI update
    if (updates.completed === true && originalSourceArray === 'active') { 
        setActiveLists(prev => prev.filter(l => l.id !== listId).sort(sortLists));
        setCompletedLists(prev => [updatedList, ...prev.filter(c => c.id !== listId)].sort(sortLists));
    } else if (updates.completed === false && originalSourceArray === 'completed') { 
        setCompletedLists(prev => prev.filter(l => l.id !== listId).sort(sortLists));
        setActiveLists(prev => [updatedList, ...prev.filter(a => a.id !== listId)].sort(sortLists));
    } else { 
        if (originalSourceArray === 'active') {
             setActiveLists(prev => prev.map(l => l.id === listId ? updatedList : l).sort(sortLists));
        } else if (originalSourceArray === 'completed') {
             setCompletedLists(prev => prev.map(l => l.id === listId ? updatedList : l).sort(sortLists));
        } else {
          // If original list wasn't found (e.g., state update race on new list),
          // try updating in active lists optimistically if it's an in-place update.
          if (updates.completed === undefined || updates.completed === false) {
            setActiveLists(prev => {
                const existing = prev.find(l => l.id === listId);
                if (existing) return prev.map(l => l.id === listId ? updatedList : l).sort(sortLists);
                // If not found, maybe it was meant for completed and we didn't find it yet
                return prev;
            });
          } else {
             setCompletedLists(prev => {
                const existing = prev.find(l => l.id === listId);
                if (existing) return prev.map(l => l.id === listId ? updatedList : l).sort(sortLists);
                return prev;
            });
          }
        }
    }


    if (isFirebaseConfigured() && currentUser) {
        try {
            const firebaseUpdates = { ...updates };
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
            // Rollback
            if (originalListState && originalSourceArray) {
                if (updates.completed === true && originalSourceArray === 'active') { 
                    setCompletedLists(prev => prev.filter(l => l.id !== listId).sort(sortLists));
                    setActiveLists(prev => [originalListState!, ...prev.filter(l => l.id !== listId && l.id !== originalListState!.id)].sort(sortLists));
                } else if (updates.completed === false && originalSourceArray === 'completed') { 
                    setActiveLists(prev => prev.filter(l => l.id !== listId).sort(sortLists));
                    setCompletedLists(prev => [originalListState!, ...prev.filter(l => l.id !== listId && l.id !== originalListState!.id)].sort(sortLists));
                } else { 
                    if (originalSourceArray === 'active') {
                        setActiveLists(prev => prev.map(l => l.id === listId ? originalListState! : l).sort(sortLists));
                    } else {
                        setCompletedLists(prev => prev.map(l => l.id === listId ? originalListState! : l).sort(sortLists));
                    }
                }
            } else {
                if (updates.completed === true) setCompletedLists(prev => prev.filter(l => l.id !== listId).sort(sortLists));
                if (updates.completed === false) setActiveLists(prev => prev.filter(l => l.id !== listId).sort(sortLists));
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
    let listWasActive: boolean | undefined = undefined;

    // Optimistically update active lists and capture original subitems if found
    setActiveLists(prevActiveLists => {
      const listIndex = prevActiveLists.findIndex(l => l.id === listId);
      if (listIndex > -1) {
        if (capturedOriginalSubitems === undefined) { // Capture only once
          capturedOriginalSubitems = [...prevActiveLists[listIndex].subitems];
          listWasActive = true;
        }
        const updatedList = { ...prevActiveLists[listIndex], subitems: newSubitems };
        const newActiveLists = [...prevActiveLists];
        newActiveLists[listIndex] = updatedList;
        return newActiveLists.sort(sortLists);
      }
      return prevActiveLists;
    });

    // Optimistically update completed lists if not found in active (and not already captured)
    if (listWasActive === undefined) {
      setCompletedLists(prevCompletedLists => {
        const listIndex = prevCompletedLists.findIndex(l => l.id === listId);
        if (listIndex > -1) {
          if (capturedOriginalSubitems === undefined) { // Capture only once
            capturedOriginalSubitems = [...prevCompletedLists[listIndex].subitems];
            listWasActive = false;
          }
          const updatedList = { ...prevCompletedLists[listIndex], subitems: newSubitems };
          const newCompletedLists = [...prevCompletedLists];
          newCompletedLists[listIndex] = updatedList;
          return newCompletedLists.sort(sortLists);
        }
        return prevCompletedLists;
      });
    }
    
    // If after attempting optimistic updates, we still haven't captured original subitems,
    // it implies the list was brand new (or state update is pending).
    // For a truly new list, original subitems would be [].
    if (capturedOriginalSubitems === undefined) {
        capturedOriginalSubitems = [];
        // We assume a new list would be active by default if its source is unknown
        // This typically happens when addList is called and manageSubitems immediately after.
        if (listWasActive === undefined) listWasActive = true; 
    }


    if (isFirebaseConfigured() && currentUser) {
      try {
        await updateSubitemsInFirebase(listId, newSubitems);
      } catch (error) {
        console.error("Error managing subitems in Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not update subitems. Reverting.", variant: "destructive" });
        
        if (listWasActive === true) {
          setActiveLists(prev => prev.map(l => l.id === listId ? { ...l, subitems: capturedOriginalSubitems! } : l).sort(sortLists));
        } else if (listWasActive === false) {
          setCompletedLists(prev => prev.map(l => l.id === listId ? { ...l, subitems: capturedOriginalSubitems! } : l).sort(sortLists));
        }
        // Fallback if listWasActive was still undefined (should be rare with new logic)
        // Rollback on active as new lists are added there.
        else {
             setActiveLists(prev => prev.map(l => l.id === listId ? { ...l, subitems: capturedOriginalSubitems! } : l).sort(sortLists));
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

    

    