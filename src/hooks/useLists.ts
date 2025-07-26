
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
  generateShareIdForList,
  removeShareIdFromList,
  getListByShareId,
} from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { User } from "firebase/auth";
import type { Unsubscribe } from "firebase/firestore";
import { autosortAndGroupListItems, type AutosortAndGroupListItemsInput } from "@/ai/flows/autosortAndGroupListItemsFlow";

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
    // If Firebase is NOT configured, use NO_FIREBASE_SUFFIX for anonymous local storage.
    if (!isFirebaseConfigured()) {
      return NO_FIREBASE_SUFFIX;
    }
    // If Firebase IS configured, use user's UID if signed in.
    // If signed out with Firebase configured, they don't have their "own" local lists.
    return currentUser ? currentUser.uid : "ANONYMOUS_WITH_FIREBASE_NO_LOCAL_LISTS";
  }, [currentUser]);


  const getActiveLocalKey = useCallback(() => LOCAL_STORAGE_ACTIVE_LISTS_KEY_PREFIX + getStorageKeySuffix(), [getStorageKeySuffix]);
  const getCompletedLocalKey = useCallback(() => LOCAL_STORAGE_COMPLETED_LISTS_KEY_PREFIX + getStorageKeySuffix(), [getStorageKeySuffix]);

  const sortLists = (a: List, b: List) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();

  const loadListsFromLocalStorage = useCallback(() => {
    const currentKeySuffix = getStorageKeySuffix();
    if (currentKeySuffix === "ANONYMOUS_WITH_FIREBASE_NO_LOCAL_LISTS") {
      setActiveLists([]);
      setCompletedLists([]);
      console.log("[useLists] Anonymous user with Firebase configured: local lists N/A.");
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
  }, [getActiveLocalKey, getCompletedLocalKey, getStorageKeySuffix]);

  const saveListsToLocalStorage = useCallback(() => {
    const currentKeySuffix = getStorageKeySuffix();
    if (currentKeySuffix === "ANONYMOUS_WITH_FIREBASE_NO_LOCAL_LISTS" || (isFirebaseConfigured() && currentUser)) {
      // Don't save locally if Firebase is configured AND user is signed in (Firebase is source)
      // OR if user is anonymous with Firebase configured (they can't create lists to save locally)
      return;
    }

    try {
      const activeKey = getActiveLocalKey();
      const completedKey = getCompletedLocalKey();
      console.log(`[useLists] Saving to local storage. Active key: ${activeKey}, Completed key: ${completedKey}, Active: ${activeLists.length}, Completed: ${completedLists.length}`);
      localStorage.setItem(activeKey, JSON.stringify(activeLists));
      localStorage.setItem(completedKey, JSON.stringify(completedLists));
    } catch (error) {
      console.error("Error saving lists to local storage:", error);
    }
  }, [activeLists, completedLists, getActiveLocalKey, getCompletedLocalKey, getStorageKeySuffix, currentUser]);


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
      setCurrentUser(user); // Set current user first

      if (user) { // User signed IN
        // Clear local storage for NO_FIREBASE_SUFFIX if it exists, as Firebase is now the source of truth.
        if (isFirebaseConfigured()) {
            const oldLocalActiveKey = LOCAL_STORAGE_ACTIVE_LISTS_KEY_PREFIX + NO_FIREBASE_SUFFIX;
            const oldLocalCompletedKey = LOCAL_STORAGE_COMPLETED_LISTS_KEY_PREFIX + NO_FIREBASE_SUFFIX;
            if (localStorage.getItem(oldLocalActiveKey) || localStorage.getItem(oldLocalCompletedKey)) {
                console.log("[useLists] User signed in with Firebase. Clearing old non-Firebase local storage:", oldLocalActiveKey, oldLocalCompletedKey);
                localStorage.removeItem(oldLocalActiveKey);
                localStorage.removeItem(oldLocalCompletedKey);
            }
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
      } else { // User signed OUT
        setActiveLists([]); 
        setCompletedLists([]); 
        setHasFetchedCompleted(false); 

        if (!isFirebaseConfigured()) {
            // Firebase NOT configured, so load from local (NO_FIREBASE_SUFFIX)
            console.log("[useLists] User signed out, Firebase NOT configured. Loading from local storage for anonymous_no_fb.");
            loadListsFromLocalStorage(); 
        } else {
            // Firebase IS configured, user signed out. They cannot create lists.
            // Ensure local storage for "ANONYMOUS_WITH_FIREBASE_NO_LOCAL_LISTS" is empty.
            const activeKey = getActiveLocalKey(); // Will use ANONYMOUS_WITH_FIREBASE_NO_LOCAL_LISTS
            const completedKey = getCompletedLocalKey();
            try {
                localStorage.setItem(activeKey, JSON.stringify([]));
                localStorage.setItem(completedKey, JSON.stringify([]));
                console.log(`[useLists] User signed out, Firebase IS configured. Ensured local lists are empty for: ${activeKey}, ${completedKey}.`);
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
      setCompletedLists(prev => (isFirebaseConfigured() && !currentUser) ? [] : prev);
      setHasFetchedCompleted(true); 
      setIsLoadingCompleted(false);
    }
  }, [currentUser, hasFetchedCompleted, isLoadingCompleted, toast, completedLists.length, isLoading]);


  const addList = async (
    listData: Omit<List, "id" | "completed" | "subitems" | "createdAt" | "userId" | "shareId">
  ): Promise<List | undefined> => {
    if (!currentUser && isFirebaseConfigured()) {
      // This should ideally be prevented by UI disabling the add button
      toast({ title: "Sign In Required", description: "Please sign in to create lists.", variant: "destructive" });
      return undefined;
    }

    const optimisticId = crypto.randomUUID();
    const optimisticList: List = {
      ...listData,
      completed: false,
      subitems: [],
      userId: currentUser?.uid, // Will be undefined if !isFirebaseConfigured()
      id: optimisticId,
      createdAt: new Date().toISOString(),
      shareId: null,
    };

    setActiveLists(prev => [optimisticList, ...prev].sort(sortLists));

    if (currentUser && isFirebaseConfigured()) {
      try {
        const newListBase: Omit<List, "id" | "createdAt"> = {
            ...listData,
            completed: false,
            subitems: [],
            userId: currentUser.uid,
            shareId: null,
        };

        const addedListFromFirebase = await addListToFirebase(newListBase, currentUser.uid);
        return addedListFromFirebase; 
      } catch (error) {
        console.error("Error adding list to Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not add list.", variant: "destructive" });
        setActiveLists(prev => prev.filter(l => l.id !== optimisticId).sort(sortLists)); 
        return undefined;
      }
    } else if (!isFirebaseConfigured()) {
      console.log("[useLists] Adding list locally (no Firebase):", optimisticList.title);
      return optimisticList;
    }
    return undefined; // Should not be reached if logic is correct
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
    } else if (!isFirebaseConfigured()) {
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
    } else if (!isFirebaseConfigured()) {
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
    } else if (!isFirebaseConfigured()) {
        console.log("[useLists] Managed subitems locally (no Firebase) on list:", listId);
    }
  };

  const autosortListItems = async (listId: string): Promise<void> => {
    const listToSort = activeLists.find(l => l.id === listId) || completedLists.find(l => l.id === listId);
    if (!listToSort) {
      toast({ title: "List not found", description: "Could not find the list to autosort.", variant: "destructive" });
      return;
    }
    const itemsOnly = listToSort.subitems.filter(si => !si.isHeader);
    if (itemsOnly.length < 2) {
      toast({ title: "Not enough items", description: "Need at least two items (not including headers) to autosort.", variant: "default" });
      return;
    }
  
    const originalSubitems = [...listToSort.subitems];
  
    try {
      const input: AutosortAndGroupListItemsInput = {
        listTitle: listToSort.title,
        subitems: itemsOnly.map(si => ({ id: si.id, title: si.title, completed: si.completed, isHeader: false })),
      };
      
      const result = await autosortAndGroupListItems(input);
  
      if (result && result.sortedSubitems) {
        const newSortedSubitems: Subitem[] = result.sortedSubitems.map(si => ({
          id: si.id,
          title: si.title,
          completed: si.completed,
          isHeader: si.isHeader,
        }));
        await manageSubitems(listId, newSortedSubitems);
        toast({ title: "List Autosorted!", description: `Items in "${listToSort.title}" have been grouped and reordered.` });
      } else {
        toast({ title: "Autosort Failed", description: "AI could not reorder the items.", variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Error autosorting list items:", error);
      let errorMsg = "An error occurred while autosorting items.";
      if (error.message && error.message.includes("GEMINI_API_KEY")) {
        errorMsg = "AI processing failed. Check API key configuration.";
      } else if (error.message) {
        errorMsg = `AI processing error: ${error.message.substring(0,100)}${error.message.length > 100 ? '...' : ''}`;
      }
      toast({ title: "AI Error", description: errorMsg, variant: "destructive" });
      await manageSubitems(listId, originalSubitems);
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
      toast({ title: "Sharing Stopped", description: "The list is no longer publicly shared." });
    } catch (error) {
      console.error("Error unsharing list:", error);
      toast({ title: "Unsharing Error", description: "An error occurred.", variant: "destructive" });
    }
  };

  const deleteAllLists = async (): Promise<void> => {
    if (!currentUser && isFirebaseConfigured()) {
      // This case implies Firebase is set up, but user is not signed in.
      // They shouldn't have lists to delete in this context.
      // If !isFirebaseConfigured(), then currentUser will be null, and that's handled below.
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
      }
    } else if (!isFirebaseConfigured()) { 
      try {
        const activeKey = getActiveLocalKey(); 
        const completedKey = getCompletedLocalKey();
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
    autosortListItems,
    shareList,
    unshareList,
    deleteAllLists,
    getListByShareId, 
  };
};
