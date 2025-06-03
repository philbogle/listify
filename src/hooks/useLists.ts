
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { List, Subitem } from "@/types/list";
import {
  addListToFirebase,
  listenToActiveLists,
  getCompletedListsFromFirebase,
  updateListInFirebase,
  deleteListFromFirebase,
  updateSubitemsInFirebase,
  isFirebaseConfigured,
  onAuthUserChanged,
  uploadScanImageToFirebase,
  generateShareIdForList,
  removeShareIdFromList,
  getListByShareId,
} from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { User } from "firebase/auth";
import type { Unsubscribe } from "firebase/firestore";

const LOCAL_STORAGE_ACTIVE_LISTS_KEY_PREFIX = "listify_active_lists_";
const LOCAL_STORAGE_COMPLETED_LISTS_KEY_PREFIX = "listify_completed_lists_";

const NO_FIREBASE_SUFFIX = "anonymous_no_fb";


export const useLists = () => {
  const [activeLists, setActiveLists] = useState<List[]>([]);
  const [completedLists, setCompletedLists] = useState<List[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCompleted, setIsLoadingCompleted] = useState(false);
  const [hasFetchedCompleted, setHasFetchedCompleted] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const { toast } = useToast();
  const activeListenerUnsubscribeRef = useRef<Unsubscribe | null>(null);


  const getStorageKeySuffix = useCallback(() => {
    if (currentUser) {
      return currentUser.uid;
    }
    // Only use NO_FIREBASE_SUFFIX if Firebase is NOT configured.
    // If Firebase IS configured but user is signed out, they can't create lists,
    // so local storage for their "own" lists isn't used in that context.
    return isFirebaseConfigured() ? "ANONYMOUS_WITH_FIREBASE_NO_LOCAL_LISTS" : NO_FIREBASE_SUFFIX;
  }, [currentUser]);

  const getActiveLocalKey = useCallback(() => LOCAL_STORAGE_ACTIVE_LISTS_KEY_PREFIX + getStorageKeySuffix(), [getStorageKeySuffix]);
  const getCompletedLocalKey = useCallback(() => LOCAL_STORAGE_COMPLETED_LISTS_KEY_PREFIX + getStorageKeySuffix(), [getStorageKeySuffix]);

  const sortLists = (a: List, b: List) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();

  const loadListsFromLocalStorage = useCallback(() => {
    // If Firebase is configured and user is signed out, they don't have local lists.
    if (!currentUser && isFirebaseConfigured()) {
      setActiveLists([]);
      setCompletedLists([]);
      console.log("[useLists] Anonymous user with Firebase configured: setting in-memory lists to empty.");
      return;
    }

    try {
      const activeKey = getActiveLocalKey();
      const completedKey = getCompletedLocalKey();
      console.log(`[useLists] Loading from local storage. Active key: ${activeKey}, Completed key: ${completedKey}`);

      const localActive = localStorage.getItem(activeKey);
      setActiveLists(localActive ? JSON.parse(localActive).sort(sortLists) : []);

      const localCompleted = localStorage.getItem(completedKey);
      setCompletedLists(localCompleted ? JSON.parse(localCompleted).sort(sortLists) : []);

    } catch (error) {
      console.error("Error loading lists from local storage:", error);
      setActiveLists([]);
      setCompletedLists([]);
    }
  }, [getActiveLocalKey, getCompletedLocalKey, currentUser]);

  const saveListsToLocalStorage = useCallback(() => {
    // If Firebase is configured and user is signed out, do not save lists locally.
    // Also, don't save if signed in (Firebase is source of truth) or if still loading.
    if (isLoading || (isFirebaseConfigured() && (currentUser || !currentUser))) {
        if (!currentUser && isFirebaseConfigured()) {
            // This case means signed out with Firebase - no local lists for them
            return;
        }
        if(currentUser && isFirebaseConfigured()){
            // Signed in with Firebase - no local lists for them either
            return;
        }
    }


    try {
      const activeKey = getActiveLocalKey();
      const completedKey = getCompletedLocalKey();
      console.log(`[useLists] Saving to local storage. Active key: ${activeKey}, Completed key: ${completedKey}, Active Lists Count: ${activeLists.length}, Completed Lists Count: ${completedLists.length}`);
      localStorage.setItem(activeKey, JSON.stringify(activeLists));
      localStorage.setItem(completedKey, JSON.stringify(completedLists));
    } catch (error) {
      console.error("Error saving lists to local storage:", error);
    }
  }, [activeLists, completedLists, getActiveLocalKey, getCompletedLocalKey, isLoading, currentUser]);


  useEffect(() => {
    let unsubscribeAuth: Unsubscribe | undefined;

    unsubscribeAuth = onAuthUserChanged(async (user) => {
      console.log("[useLists] Auth state changed. New user:", user?.uid || "null");

      if (activeListenerUnsubscribeRef.current) {
        console.log("[useLists] Unsubscribing from previous active lists listener (ref).");
        activeListenerUnsubscribeRef.current();
        activeListenerUnsubscribeRef.current = null;
      }

      setIsLoading(true);

      if (user) { // User signed IN
        setCurrentUser(user);
        
        // If Firebase is configured, clear any old lists stored under "NO_FIREBASE_SUFFIX"
        // This handles the case where a user used the app locally, then configured Firebase and signed in.
        if (isFirebaseConfigured()) {
            const oldLocalActiveKey = LOCAL_STORAGE_ACTIVE_LISTS_KEY_PREFIX + NO_FIREBASE_SUFFIX;
            const oldLocalCompletedKey = LOCAL_STORAGE_COMPLETED_LISTS_KEY_PREFIX + NO_FIREBASE_SUFFIX;
            console.log("[useLists] User signed in with Firebase. Clearing old non-Firebase local storage:", oldLocalActiveKey, oldLocalCompletedKey);
            localStorage.removeItem(oldLocalActiveKey);
            localStorage.removeItem(oldLocalCompletedKey);
        }
        
        setActiveLists([]);
        setCompletedLists([]);
        setHasFetchedCompleted(false);

        console.log(`[useLists] Setting up real-time listener for active lists for user ${user.uid}`);
        activeListenerUnsubscribeRef.current = listenToActiveLists(
          user.uid,
          (firebaseLists) => {
            console.log("[useLists] Received update for active lists from Firebase:", firebaseLists.length, "lists");
            setActiveLists(firebaseLists.sort(sortLists));
            if (isLoading) setIsLoading(false); 
          },
          (error) => {
            console.error("Error in active lists listener:", error);
            toast({ title: "Real-time Sync Error", description: "Could not sync active lists live.", variant: "destructive" });
            if (isLoading) setIsLoading(false);
          }
        );
      } else { // User signed OUT or anonymous
        setCurrentUser(null);
        setActiveLists([]); 
        setCompletedLists([]); 
        setHasFetchedCompleted(false); 

        if (!isFirebaseConfigured()) {
            // Firebase NOT configured, so load from local (NO_FIREBASE_SUFFIX)
            console.log("[useLists] User signed out, Firebase NOT configured. Loading from local storage for anonymous_no_fb.");
            loadListsFromLocalStorage(); 
        } else {
            // Firebase IS configured, user signed out. They cannot create lists.
            // Explicitly clear local storage for the "ANONYMOUS_WITH_FIREBASE_NO_LOCAL_LISTS" context to be safe,
            // although save/load functions should also prevent operations for this context.
            const activeKey = getActiveLocalKey(); 
            const completedKey = getCompletedLocalKey();
            try {
                localStorage.setItem(activeKey, JSON.stringify([]));
                localStorage.setItem(completedKey, JSON.stringify([]));
                console.log(`[useLists] User signed out, Firebase IS configured. Explicitly saved empty lists to local keys: ${activeKey}, ${completedKey}.`);
            } catch (error) {
                console.error("Error explicitly saving empty lists to local storage on sign-out (Firebase configured):", error);
            }
        }
        setIsLoading(false);
      }
    });

    return () => {
      console.log("[useLists] Cleaning up auth listener and active lists listener (if active) on component unmount.");
      if (unsubscribeAuth) unsubscribeAuth();
      if (activeListenerUnsubscribeRef.current) {
        activeListenerUnsubscribeRef.current();
        activeListenerUnsubscribeRef.current = null;
      }
    };
  }, [loadListsFromLocalStorage, toast, getActiveLocalKey, getCompletedLocalKey]); 

   useEffect(() => {
    // This effect saves to local storage when lists change,
    // respecting the conditions in saveListsToLocalStorage (e.g., not for signed-in users or anonymous with Firebase)
    if (!isLoading) {
        saveListsToLocalStorage();
    }
  }, [activeLists, completedLists, isLoading, saveListsToLocalStorage]);


  const fetchCompletedListsIfNeeded = useCallback(async () => {
    if (isLoadingCompleted) return;
    if (currentUser && isFirebaseConfigured()) {
      if (hasFetchedCompleted && completedLists.length > 0 && !isLoading) return; 
      setIsLoadingCompleted(true);
      try {
        const firebaseCompletedLists = await getCompletedListsFromFirebase(currentUser.uid);
        setCompletedLists(firebaseCompletedLists.sort(sortLists));
        setHasFetchedCompleted(true);
      } catch (error) {
        console.error("Error fetching completed lists from Firebase:", error);
        toast({ title: "Firebase Load Error", description: "Could not load completed lists.", variant: "destructive" });
      } finally {
        setIsLoadingCompleted(false);
      }
    } else {
      // If not signed in or Firebase not configured, completed lists are handled by general local storage load.
      // If Firebase IS configured and user is not signed in, completedLists should be empty.
      setCompletedLists(prev => isFirebaseConfigured() && !currentUser ? [] : prev);
      setHasFetchedCompleted(true); 
      setIsLoadingCompleted(false);
    }
  }, [currentUser, hasFetchedCompleted, isLoadingCompleted, toast, completedLists.length, isLoading]);


  const addList = async (
    listData: Omit<List, "id" | "completed" | "subitems" | "createdAt" | "userId" | "scanImageUrls" | "shareId">,
    capturedImageFile?: File | null
  ): Promise<List | undefined> => {
    if (!currentUser && isFirebaseConfigured()) {
      toast({ title: "Sign In Required", description: "Please sign in to create lists.", variant: "destructive" });
      return undefined;
    }

    const optimisticId = crypto.randomUUID();
    const optimisticList: List = {
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

    if (currentUser && isFirebaseConfigured()) {
      try {
        let initialScanUrl: string | undefined = undefined;
        if (capturedImageFile) {
          initialScanUrl = await uploadScanImageToFirebase(capturedImageFile, currentUser.uid, optimisticId);
          optimisticList.scanImageUrls = initialScanUrl ? [initialScanUrl] : [];
        }

        const newListBase: Omit<List, "id" | "createdAt"> = {
            ...listData,
            completed: false,
            subitems: [],
            userId: currentUser.uid,
            scanImageUrls: optimisticList.scanImageUrls,
            shareId: null,
        };

        const addedListFromFirebase = await addListToFirebase(newListBase, currentUser.uid);
        // Firebase listener will update the list state, so no need to return optimistic here for Firebase path.
        return addedListFromFirebase; // Return the actual list from Firebase
      } catch (error) {
        console.error("Error adding list to Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not add list.", variant: "destructive" });
        setActiveLists(prev => prev.filter(l => l.id !== optimisticId).sort(sortLists)); 
        return undefined;
      }
    } else {
      // This case is for !isFirebaseConfigured() (local-only mode)
      console.log("[useLists] Adding list locally (no Firebase):", optimisticList.title);
      return optimisticList;
    }
  };

  const updateList = async (listId: string, updates: Partial<List>) => {
    let originalListState: List | undefined;
    let originalSourceArray: 'active' | 'completed' | null = null;

    const applyUpdatesAndSetOriginals = (currentLists: List[], source: 'active' | 'completed') => {
        return currentLists.map(l => {
            if (l.id === listId) {
                if (!originalListState) {
                    originalListState = JSON.parse(JSON.stringify(l)); 
                    originalSourceArray = source;
                }
                return { ...l, ...updates };
            }
            return l;
        });
    };

    let listMoved = false;
    const currentActiveList = activeLists.find(l => l.id === listId);
    const currentCompletedList = completedLists.find(l => l.id === listId);

    if (updates.completed === true && currentActiveList) { 
        if (!originalListState) {
            originalListState = JSON.parse(JSON.stringify(currentActiveList));
            originalSourceArray = 'active';
        }
        const listToMove = { ...currentActiveList, ...updates };
        setActiveLists(prev => prev.filter(l => l.id !== listId).sort(sortLists));
        setCompletedLists(prev => [listToMove, ...prev.filter(l => l.id !== listId)].sort(sortLists));
        listMoved = true;
    } else if (updates.completed === false && currentCompletedList) { 
         if (!originalListState) {
            originalListState = JSON.parse(JSON.stringify(currentCompletedList));
            originalSourceArray = 'completed';
        }
        const listToMove = { ...currentCompletedList, ...updates };
        setCompletedLists(prev => prev.filter(l => l.id !== listId).sort(sortLists));
        setActiveLists(prev => [listToMove, ...prev.filter(l => l.id !== listId)].sort(sortLists));
        listMoved = true;
    }

    if (!listMoved) {
        if (currentActiveList) {
            setActiveLists(prev => applyUpdatesAndSetOriginals(prev, 'active').sort(sortLists));
        } else if (currentCompletedList) {
            setCompletedLists(prev => applyUpdatesAndSetOriginals(prev, 'completed').sort(sortLists));
        }
    }


    if (currentUser && isFirebaseConfigured()) {
        try {
            await updateListInFirebase(listId, updates);
        } catch (error) {
            console.error("Error updating list in Firebase:", error);
            toast({ title: "Firebase Error", description: "Could not update list. Reverting.", variant: "destructive" });
            if (originalListState && originalSourceArray) {
                if (originalSourceArray === 'active') {
                    if (listMoved && updates.completed === true) { 
                        setCompletedLists(prev => prev.filter(l => l.id !== listId).sort(sortLists)); 
                        setActiveLists(prev => [originalListState!, ...prev.filter(l=> l.id !== listId)].sort(sortLists)); 
                    } else { 
                         setActiveLists(prev => prev.map(l => l.id === listId ? originalListState! : l).sort(sortLists));
                    }
                } else if (originalSourceArray === 'completed') {
                     if (listMoved && updates.completed === false) { 
                        setActiveLists(prev => prev.filter(l => l.id !== listId).sort(sortLists)); 
                        setCompletedLists(prev => [originalListState!, ...prev.filter(l=> l.id !== listId)].sort(sortLists)); 
                    } else { 
                        setCompletedLists(prev => prev.map(l => l.id === listId ? originalListState! : l).sort(sortLists));
                    }
                }
            }
        }
    } else {
        // This case is for !isFirebaseConfigured() (local-only mode)
        console.log("[useLists] Updated list locally (no Firebase):", listId);
    }
  };

  const deleteList = async (listId: string) => {
    const originalActiveLists = [...activeLists];
    const originalCompletedLists = [...completedLists];

    setActiveLists(prev => prev.filter(l => l.id !== listId));
    setCompletedLists(prev => prev.filter(l => l.id !== listId));

    if (currentUser && isFirebaseConfigured()) {
      try {
        await deleteListFromFirebase(listId);
      } catch (error) {
        console.error("Error deleting list from Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not delete list. Reverting.", variant: "destructive" });
        setActiveLists(originalActiveLists.sort(sortLists));
        setCompletedLists(originalCompletedLists.sort(sortLists));
      }
    } else {
       // This case is for !isFirebaseConfigured() (local-only mode)
       console.log("[useLists] Deleted list locally (no Firebase):", listId);
    }
  };

 const manageSubitems = async (listId: string, newSubitems: Subitem[]) => {
    let originalSubitems: Subitem[] | undefined;
    let listSource: 'active' | 'completed' | null = null;

    const updateAndCaptureOriginal = (lists: List[], source: 'active' | 'completed'): List[] => {
        return lists.map(l => {
            if (l.id === listId) {
                if (!originalSubitems) {
                    originalSubitems = JSON.parse(JSON.stringify(l.subitems)); 
                    listSource = source;
                }
                return { ...l, subitems: newSubitems };
            }
            return l;
        });
    };

    const listInActive = activeLists.find(l => l.id === listId);
    if (listInActive) {
      setActiveLists(prev => updateAndCaptureOriginal(prev, 'active').sort(sortLists));
    } else {
      const listInCompleted = completedLists.find(l => l.id === listId);
      if (listInCompleted) {
        setCompletedLists(prev => updateAndCaptureOriginal(prev, 'completed').sort(sortLists));
      }
    }
    

    if (currentUser && isFirebaseConfigured()) {
      try {
        await updateSubitemsInFirebase(listId, newSubitems);
      } catch (error) {
        console.error("Error managing subitems in Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not update subitems. Reverting.", variant: "destructive" });
        if (originalSubitems && listSource) {
            const revertSubitems = (lists: List[]) => lists.map(l => l.id === listId ? { ...l, subitems: originalSubitems! } : l).sort(sortLists);
            if (listSource === 'active') setActiveLists(prev => revertSubitems(prev));
            if (listSource === 'completed') setCompletedLists(prev => revertSubitems(prev));
        }
      }
    } else {
        // This case is for !isFirebaseConfigured() (local-only mode)
        console.log("[useLists] Managed subitems locally (no Firebase) on list:", listId);
    }
  };

  const shareList = async (listId: string): Promise<string | null> => {
    if (!currentUser || !isFirebaseConfigured()) {
      toast({ title: "Sign In Required", description: "You must be signed in to share lists.", variant: "destructive" });
      return null;
    }
    try {
      const newShareId = await generateShareIdForList(listId, currentUser.uid);
      if (newShareId) {
        // Firebase listener will update the list state
        toast({ title: "List Shared!", description: "A public share link has been created." });
        return newShareId;
      } else {
         toast({ title: "Sharing Failed", description: "Could not generate a share link.", variant: "destructive" });
        return null;
      }
    } catch (error) {
      console.error("Error sharing list:", error);
      toast({ title: "Sharing Error", description: "An error occurred.", variant: "destructive" });
      return null;
    }
  };

  const unshareList = async (listId: string): Promise<void> => {
    if (!currentUser || !isFirebaseConfigured()) {
      toast({ title: "Sign In Required", description: "You must be signed in to manage sharing.", variant: "destructive" });
      return;
    }
    try {
      await removeShareIdFromList(listId, currentUser.uid);
      // Firebase listener will update the list state
      toast({ title: "Sharing Stopped", description: "The list is no longer publicly shared." });
    } catch (error) {
      console.error("Error unsharing list:", error);
      toast({ title: "Unsharing Error", description: "An error occurred.", variant: "destructive" });
    }
  };

  const deleteAllLists = async (): Promise<void> => {
    if (!currentUser && isFirebaseConfigured()) {
      toast({ title: "Sign In Required", description: "Please sign in to manage your lists.", variant: "destructive" });
      return;
    }

    const allListIdsToDelete = [...activeLists, ...completedLists].map(l => l.id);

    setActiveLists([]);
    setCompletedLists([]);
    setHasFetchedCompleted(true); 

    if (currentUser && isFirebaseConfigured()) {
      toast({ title: "Deleting All Lists...", description: "This may take a moment." });
      try {
        const deletePromises = allListIdsToDelete.map(id => deleteListFromFirebase(id));
        await Promise.all(deletePromises);
        toast({ title: "All Lists Deleted", description: "Your lists have been removed from the cloud." });
      } catch (error) {
        console.error("Error deleting all lists from Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not delete all lists from cloud. Some may remain. Please refresh.", variant: "destructive" });
        // Re-fetch might be an option here, or rely on listeners to eventually correct state if partial delete.
        // For now, we assume listeners will reflect the new empty state if deletes were partially successful.
      }
    } else { // Case: !currentUser && !isFirebaseConfigured()
      try {
        const activeKey = getActiveLocalKey(); // Will be _no_fb key
        const completedKey = getCompletedLocalKey(); // Will be _no_fb key
        console.log(`[useLists - deleteAll] Removing local keys: ${activeKey}, ${completedKey}`);
        localStorage.removeItem(activeKey);
        localStorage.removeItem(completedKey);
        toast({ title: "All Lists Deleted", description: "Your local lists have been removed." });
      } catch (error) {
        console.error("Error deleting all lists from local storage:", error);
        toast({ title: "Local Storage Error", description: "Could not remove all local lists.", variant: "destructive" });
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
    shareList,
    unshareList,
    deleteAllLists,
    getListByShareId, 
  };
};

    
