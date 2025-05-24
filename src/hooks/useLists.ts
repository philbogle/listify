
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
      if (!currentUser && isFirebaseConfigured()) {
        // toast({ title: "Please Sign In", description: "Sign in to view completed lists.", variant: "default" });
      }
      if(!isFirebaseConfigured() && !hasFetchedCompleted) setHasFetchedCompleted(true); 
      return;
    }
    if (hasFetchedCompleted && !isLoadingCompleted) return; 

    setIsLoadingCompleted(true);
    const localKey = getCompletedLocalKey(currentUser.uid);
    try {
      const firebaseCompletedLists = await getCompletedListsFromFirebase(currentUser.uid);
      // console.log("[useLists] Fetched completed lists from Firebase:", firebaseCompletedLists);
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
        let finalFirebaseList = { ...addedListFromFirebase, subitems: [] }; // Ensure subitems is initialized

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

    // Find original list and source
    const findList = (lists: List[]): List | undefined => lists.find(l => l.id === listId);
    
    let listToUpdate = findList(activeLists);
    if (listToUpdate) {
        originalListState = JSON.parse(JSON.stringify(listToUpdate));
        originalSourceArray = 'active';
    } else {
        listToUpdate = findList(completedLists);
        if (listToUpdate) {
            originalListState = JSON.parse(JSON.stringify(listToUpdate));
            originalSourceArray = 'completed';
        }
    }

    if (!originalListState) {
        console.warn(`[updateList] List with id ${listId} not found for update.`);
        // Don't toast here, might be an optimistic update race condition, let it proceed
        // toast({ title: "Error", description: "List to update not found.", variant: "destructive" });
        // return; 
    }
    
    const updatedList = { ...(originalListState || {id: listId, title:'', completed:false, subitems:[]}), ...updates };


    // Optimistic UI update
    if (updates.completed === true) { // Moving from active to completed
        setActiveLists(prev => prev.filter(l => l.id !== listId).sort(sortLists));
        setCompletedLists(prev => [updatedList, ...prev.filter(c => c.id !== listId)].sort(sortLists));
    } else if (updates.completed === false) { // Moving from completed to active
        setCompletedLists(prev => prev.filter(l => l.id !== listId).sort(sortLists));
        setActiveLists(prev => [updatedList, ...prev.filter(a => a.id !== listId)].sort(sortLists));
    } else { // Updating an active or completed list without changing its completion status
        if (originalSourceArray === 'active' || (!originalSourceArray && findList(activeLists))) { // Default to active if unsure but present
             setActiveLists(prev => prev.map(l => l.id === listId ? updatedList : l).sort(sortLists));
        } else if (originalSourceArray === 'completed' || (!originalSourceArray && findList(completedLists))) {
             setCompletedLists(prev => prev.map(l => l.id === listId ? updatedList : l).sort(sortLists));
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
                if (updates.completed === true) { // Was moved to completed, move back to active
                    setCompletedLists(prev => prev.filter(l => l.id !== listId).sort(sortLists));
                    setActiveLists(prev => [originalListState!, ...prev.filter(l => l.id !== listId)].sort(sortLists));
                } else if (updates.completed === false) { // Was moved to active, move back to completed
                    setActiveLists(prev => prev.filter(l => l.id !== listId).sort(sortLists));
                    setCompletedLists(prev => [originalListState!, ...prev.filter(l => l.id !== listId)].sort(sortLists));
                } else { // Was updated in place
                    if (originalSourceArray === 'active') {
                        setActiveLists(prev => prev.map(l => l.id === listId ? originalListState! : l).sort(sortLists));
                    } else {
                        setCompletedLists(prev => prev.map(l => l.id === listId ? originalListState! : l).sort(sortLists));
                    }
                }
            } else {
                 // If originalListState wasn't found, try to remove from both if it was a completion change
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
    let subitemsToRollbackTo: Subitem[] | undefined;
    let listSourceForRollback: 'active' | 'completed' | null = null;

    const applyUpdateAndCaptureOriginals = (lists: List[], type: 'active' | 'completed'): List[] => {
        return lists.map(list => {
            if (list.id === listId) {
                if (subitemsToRollbackTo === undefined) { // Capture only once
                    subitemsToRollbackTo = list.subitems; 
                    listSourceForRollback = type;
                }
                return { ...list, subitems: newSubitems };
            }
            return list;
        }).sort(sortLists);
    };
    
    setActiveLists(prevActiveLists => applyUpdateAndCaptureOriginals(prevActiveLists, 'active'));
    
    // Only try completed if not found in active
    if (listSourceForRollback === null) {
        setCompletedLists(prevCompletedLists => applyUpdateAndCaptureOriginals(prevCompletedLists, 'completed'));
    }


    // If the list was brand new (e.g., from import), it might not be found by the capture logic above
    // because the state update from addList might not be fully processed yet.
    // In this specific case (newly added list), original subitems are [].
    if (subitemsToRollbackTo === undefined) {
        subitemsToRollbackTo = [];
        // We don't know the source for sure, but new lists are added to 'active'
        if (listSourceForRollback === null) listSourceForRollback = 'active';
    }

    if (isFirebaseConfigured() && currentUser) {
      try {
        await updateSubitemsInFirebase(listId, newSubitems);
      } catch (error) {
        console.error("Error managing subitems in Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not update subitems. Reverting.", variant: "destructive" });
        
        // Rollback
        if (listSourceForRollback === 'active') {
          setActiveLists(prev => prev.map(l => l.id === listId ? { ...l, subitems: subitemsToRollbackTo! } : l).sort(sortLists));
        } else if (listSourceForRollback === 'completed') {
          setCompletedLists(prev => prev.map(l => l.id === listId ? { ...l, subitems: subitemsToRollbackTo! } : l).sort(sortLists));
        } else {
          // If source is still null (e.g. brand new list that wasn't caught by activeLists optimistic update yet)
          // attempt rollback on active lists as new lists are added there.
          setActiveLists(prev => prev.map(l => l.id === listId ? { ...l, subitems: subitemsToRollbackTo! } : l).sort(sortLists));
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

    