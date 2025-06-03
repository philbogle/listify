
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
const FIREBASE_PENDING_MIGRATION_SUFFIX = "anonymous_fb_pending";


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
    return isFirebaseConfigured() ? FIREBASE_PENDING_MIGRATION_SUFFIX : NO_FIREBASE_SUFFIX;
  }, [currentUser]);

  const getActiveLocalKey = useCallback(() => LOCAL_STORAGE_ACTIVE_LISTS_KEY_PREFIX + getStorageKeySuffix(), [getStorageKeySuffix]);
  const getCompletedLocalKey = useCallback(() => LOCAL_STORAGE_COMPLETED_LISTS_KEY_PREFIX + getStorageKeySuffix(), [getStorageKeySuffix]);

  const sortLists = (a: List, b: List) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();

  const loadListsFromLocalStorage = useCallback(() => {
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
  }, [getActiveLocalKey, getCompletedLocalKey]);

  const saveListsToLocalStorage = useCallback(() => {
    if (isLoading || (isFirebaseConfigured() && currentUser)) return; // Only save if anonymous or Firebase not configured
    try {
      const activeKey = getActiveLocalKey();
      const completedKey = getCompletedLocalKey();
      // This console log was: "Saving to local storage for anonymous user." which is correct.
      console.log(`[useLists] Saving to local storage. Active key: ${activeKey}, Completed key: ${completedKey}`);
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

      // Always unsubscribe from any existing active lists listener
      if (activeListenerUnsubscribeRef.current) {
        console.log("[useLists] Unsubscribing from previous active lists listener (ref).");
        activeListenerUnsubscribeRef.current();
        activeListenerUnsubscribeRef.current = null;
      }

      setIsLoading(true);
      setActiveLists([]); 
      setCompletedLists([]); 
      setHasFetchedCompleted(false);


      if (user) {
        setCurrentUser(user); 

        const pendingActiveKey = LOCAL_STORAGE_ACTIVE_LISTS_KEY_PREFIX + FIREBASE_PENDING_MIGRATION_SUFFIX;
        const pendingCompletedKey = LOCAL_STORAGE_COMPLETED_LISTS_KEY_PREFIX + FIREBASE_PENDING_MIGRATION_SUFFIX;
        console.log("[useLists] User signed in. Clearing local pending migration data before setting up Firebase listener.");
        localStorage.removeItem(pendingActiveKey);
        localStorage.removeItem(pendingCompletedKey);
        
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
      } else { 
        setCurrentUser(null);
        console.log("[useLists] User signed out or anonymous. Loading from local storage.");
        loadListsFromLocalStorage(); 
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadListsFromLocalStorage, toast]); 

   useEffect(() => {
    if (!isLoading && (!isFirebaseConfigured() || !currentUser)) {
        saveListsToLocalStorage();
    }
  }, [activeLists, completedLists, isLoading, saveListsToLocalStorage, currentUser]);


  const fetchCompletedListsIfNeeded = useCallback(async () => {
    if (isLoadingCompleted) return;
    if (currentUser && isFirebaseConfigured()) {
      if (hasFetchedCompleted && completedLists.length > 0 && !isLoading) return; // ensure active lists are loaded first
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
      // For anonymous users, completed lists are already loaded from local storage by loadListsFromLocalStorage
      setHasFetchedCompleted(true); 
      setIsLoadingCompleted(false);
    }
  }, [currentUser, hasFetchedCompleted, isLoadingCompleted, toast, completedLists.length, isLoading]);


  const addList = async (
    listData: Omit<List, "id" | "completed" | "subitems" | "createdAt" | "userId" | "scanImageUrls" | "shareId">,
    capturedImageFile?: File | null
  ): Promise<List | undefined> => {
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
        // The listener will handle updating the UI with the server-confirmed list.
        return addedListFromFirebase;
      } catch (error) {
        console.error("Error adding list to Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not add list.", variant: "destructive" });
        setActiveLists(prev => prev.filter(l => l.id !== optimisticId).sort(sortLists));
        return undefined;
      }
    } else {
      console.log("[useLists] Adding list locally for anonymous user:", optimisticList.title);
      // For anonymous user, saveListsToLocalStorage will be triggered by useEffect due to activeLists change
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
        console.log("[useLists] Updated list locally for anonymous user:", listId);
        // For anonymous user, saveListsToLocalStorage will be triggered by useEffect
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
       console.log("[useLists] Deleted list locally for anonymous user:", listId);
       // For anonymous user, saveListsToLocalStorage will be triggered by useEffect
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
        console.log("[useLists] Managed subitems locally for anonymous user on list:", listId);
        // For anonymous user, saveListsToLocalStorage will be triggered by useEffect
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
        // Optimistically update local state. Firebase listener will confirm.
        setActiveLists(prev => prev.map(l => l.id === listId ? {...l, shareId: newShareId} : l).sort(sortLists));
        setCompletedLists(prev => prev.map(l => l.id === listId ? {...l, shareId: newShareId} : l).sort(sortLists));
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
      // Optimistically update local state. Firebase listener will confirm.
      setActiveLists(prev => prev.map(l => l.id === listId ? {...l, shareId: null} : l).sort(sortLists));
      setCompletedLists(prev => prev.map(l => l.id === listId ? {...l, shareId: null} : l).sort(sortLists));
      toast({ title: "Sharing Stopped", description: "The list is no longer publicly shared." });
    } catch (error) {
      console.error("Error unsharing list:", error);
      toast({ title: "Unsharing Error", description: "An error occurred.", variant: "destructive" });
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
    getListByShareId,
  };
};


    