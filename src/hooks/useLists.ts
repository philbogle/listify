
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
  generateShareIdForList,
  removeShareIdFromList,
  getListByShareId,
} from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { User } from "firebase/auth";

const LOCAL_STORAGE_ACTIVE_LISTS_KEY_PREFIX = "listify_active_lists_";
const LOCAL_STORAGE_COMPLETED_LISTS_KEY_PREFIX = "listify_completed_lists_";

// Suffixes for different anonymous modes
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
      if (localActive) setActiveLists(JSON.parse(localActive).sort(sortLists));
      else setActiveLists([]);
      
      const localCompleted = localStorage.getItem(completedKey);
      if (localCompleted) setCompletedLists(JSON.parse(localCompleted).sort(sortLists));
      else setCompletedLists([]);

    } catch (error) {
      console.error("Error loading lists from local storage:", error);
      setActiveLists([]);
      setCompletedLists([]);
    }
  }, [getActiveLocalKey, getCompletedLocalKey]);

  const saveListsToLocalStorage = useCallback(() => {
    if (isLoading) return; // Don't save while initial loading from Firebase might be happening
    try {
      const activeKey = getActiveLocalKey();
      const completedKey = getCompletedLocalKey();
      console.log(`[useLists] Saving to local storage. Active key: ${activeKey}, Completed key: ${completedKey}`);
      localStorage.setItem(activeKey, JSON.stringify(activeLists));
      localStorage.setItem(completedKey, JSON.stringify(completedLists));
    } catch (error) {
      console.error("Error saving lists to local storage:", error);
    }
  }, [activeLists, completedLists, getActiveLocalKey, getCompletedLocalKey, isLoading]);


  // Effect for Firebase auth changes & initial load
  useEffect(() => {
    const unsubscribe = onAuthUserChanged(async (user) => {
      console.log("[useLists] Auth state changed. New user:", user?.uid || "null");
      setIsLoading(true);
      setActiveLists([]); // Reset lists on auth change
      setCompletedLists([]);
      setHasFetchedCompleted(false);
      const previousUser = currentUser;
      setCurrentUser(user);

      if (user) { // User is signed in
        // --- Migration Logic ---
        const pendingActiveKey = LOCAL_STORAGE_ACTIVE_LISTS_KEY_PREFIX + FIREBASE_PENDING_MIGRATION_SUFFIX;
        const pendingCompletedKey = LOCAL_STORAGE_COMPLETED_LISTS_KEY_PREFIX + FIREBASE_PENDING_MIGRATION_SUFFIX;

        const localPendingActiveListsRaw = localStorage.getItem(pendingActiveKey);
        const localPendingCompletedListsRaw = localStorage.getItem(pendingCompletedKey);
        let migratedCount = 0;

        if (localPendingActiveListsRaw || localPendingCompletedListsRaw) {
          toast({ title: "Syncing Local Lists...", description: "Attempting to sync lists created while offline." });
          const pendingActive: List[] = localPendingActiveListsRaw ? JSON.parse(localPendingActiveListsRaw) : [];
          const pendingCompleted: List[] = localPendingCompletedListsRaw ? JSON.parse(localPendingCompletedListsRaw) : [];
          
          const allPendingLists = [...pendingActive, ...pendingCompleted];

          for (const list of allPendingLists) {
            try {
              // Create a new list in Firebase. ScanImageUrls are not migrated for simplicity.
              const listDataForFirebase: Omit<List, "id" | "createdAt" | "userId" | "scanImageUrls" | "shareId"> = {
                title: list.title,
                completed: list.completed,
                subitems: list.subitems.map(si => ({ id: si.id, title: si.title, completed: si.completed })), // Ensure subitems are in correct format
              };
              // Add to Firebase, this will assign new ID, createdAt, userId, and empty scanImageUrls, null shareId
              await addListToFirebase(listDataForFirebase, user.uid); 
              migratedCount++;
            } catch (migrationError) {
              console.error("Error migrating list to Firebase:", migrationError, list);
              toast({ title: "Migration Error", description: `Could not sync list: "${list.title.substring(0,20)}...". It remains local for now.`, variant: "destructive" });
              // Keep problematic list in a temporary "failed migration" state or re-add to local? For now, it's just an error.
              // To prevent data loss, one might re-add it to a *new* local pending key, or simply leave the old pending keys.
              // For simplicity, we will clear the old pending keys. If migration fails, user has to recreate.
            }
          }
          if (migratedCount > 0) {
             toast({ title: "Local Lists Synced", description: `${migratedCount} list(s) have been synced to your account. Images from offline scans were not transferred.` });
          }
          // Clear pending migration storage regardless of individual errors to prevent re-migration attempts
          localStorage.removeItem(pendingActiveKey);
          localStorage.removeItem(pendingCompletedKey);
        }
        // --- End Migration Logic ---

        // Load lists from Firebase
        try {
          const firebaseLists = await getListsFromFirebase(user.uid);
          setActiveLists(firebaseLists.sort(sortLists));
        } catch (error) {
          console.error("Error loading active lists from Firebase:", error);
          toast({ title: "Firebase Load Error", description: "Could not load active lists.", variant: "destructive" });
        }
        setCompletedLists([]); // Reset completed, will be fetched by fetchCompletedListsIfNeeded
        setHasFetchedCompleted(false);

      } else { // User is not signed in (or signed out)
        if (isFirebaseConfigured()) {
          // User is anonymous, but Firebase is configured. Use FIREBASE_PENDING_MIGRATION_SUFFIX.
          console.log("[useLists] User signed out or anonymous with Firebase configured. Loading from pending local store.");
          loadListsFromLocalStorage(); // This will use FIREBASE_PENDING_MIGRATION_SUFFIX
        } else {
          // Firebase not configured. Use NO_FIREBASE_SUFFIX.
          console.log("[useLists] Firebase not configured. Loading from no_fb local store.");
          loadListsFromLocalStorage(); // This will use NO_FIREBASE_SUFFIX
        }
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Dependencies: currentUser managed internally, keys change based on currentUser.

  // Effect to save to local storage when lists change and user is anonymous, or to update Firebase's local cache
   useEffect(() => {
    if (!isLoading) { // Only save if not in initial load phase
        saveListsToLocalStorage();
    }
  }, [activeLists, completedLists, isLoading, saveListsToLocalStorage]);


  const fetchCompletedListsIfNeeded = useCallback(async () => {
    if (isLoadingCompleted) return;
    if (currentUser && isFirebaseConfigured()) {
      if (hasFetchedCompleted && completedLists.length > 0) return; 
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
    } else { // Not signed in or Firebase not configured
      // Completed lists are already loaded from local storage or empty if no local data
      setHasFetchedCompleted(true); 
      setIsLoadingCompleted(false);
    }
  }, [currentUser, hasFetchedCompleted, isLoadingCompleted, toast, completedLists.length]);


  const addList = async (
    listData: Omit<List, "id" | "completed" | "subitems" | "createdAt" | "userId" | "scanImageUrls" | "shareId">,
    capturedImageFile?: File | null
  ): Promise<List | undefined> => {
    const optimisticId = crypto.randomUUID();
    let optimisticList: List = {
      ...listData,
      completed: false,
      subitems: [],
      userId: currentUser?.uid, // Will be undefined for anonymous
      id: optimisticId,
      createdAt: new Date().toISOString(),
      scanImageUrls: [], // Images handled conditionally below
      shareId: null,
    };

    setActiveLists(prev => [optimisticList, ...prev].sort(sortLists));

    if (currentUser && isFirebaseConfigured()) {
      try {
        let initialScanUrl: string | undefined = undefined;
        if (capturedImageFile) {
          // Image upload only if user is signed in
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
        const finalFirebaseList = { ...addedListFromFirebase, subitems: [] }; 
        
        setActiveLists(prev => prev.map(l => l.id === optimisticId ? finalFirebaseList : l).sort(sortLists));
        return finalFirebaseList;
      } catch (error) {
        console.error("Error adding list to Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not add list.", variant: "destructive" });
        setActiveLists(prev => prev.filter(l => l.id !== optimisticId).sort(sortLists)); // Rollback optimistic
        return undefined;
      }
    } else { // Not signed in (either Firebase configured or not)
      // List is already optimistically added to activeLists.
      // Local storage will be updated by the useEffect watching activeLists.
      // No Firebase operation, no image upload here.
      console.log("[useLists] Adding list locally for anonymous user:", optimisticList.title);
      return optimisticList; // Return the optimistic list for UI focus
    }
  };

  const updateList = async (listId: string, updates: Partial<List>) => {
    let originalListState: List | undefined;
    let originalSourceArray: 'active' | 'completed' | null = null;
    
    const applyUpdatesAndSort = (lists: List[], id: string, newUpdates: Partial<List>, targetArray?: 'active' | 'completed') => {
        let listToUpdateIndex = lists.findIndex(l => l.id === id);
        if (listToUpdateIndex === -1) return lists; // Not found in this array

        if (!originalListState) { // Capture original state only once
            originalListState = JSON.parse(JSON.stringify(lists[listToUpdateIndex]));
            originalSourceArray = targetArray || null;
        }
        
        const updatedList = { ...lists[listToUpdateIndex], ...newUpdates };
        
        // If completion status changes, it moves between active/completed arrays
        if (newUpdates.completed === true && targetArray === 'active') {
            setCompletedLists(prev => [updatedList, ...prev.filter(c => c.id !== id)].sort(sortLists));
            return lists.filter(l => l.id !== id).sort(sortLists);
        }
        if (newUpdates.completed === false && targetArray === 'completed') {
            setActiveLists(prev => [updatedList, ...prev.filter(a => a.id !== id)].sort(sortLists));
            return lists.filter(l => l.id !== id).sort(sortLists);
        }
        
        // Standard update within the same array
        const newLists = [...lists];
        newLists[listToUpdateIndex] = updatedList;
        return newLists.sort(sortLists);
    };

    setActiveLists(prev => applyUpdatesAndSort(prev, listId, updates, 'active'));
    // If it wasn't in active, try completed
    if (!originalListState) {
        setCompletedLists(prev => applyUpdatesAndSort(prev, listId, updates, 'completed'));
    }


    if (currentUser && isFirebaseConfigured()) {
        try {
            const firebaseUpdates = { ...updates };
            // Remove fields that shouldn't be directly updated or are managed by Firebase
            delete (firebaseUpdates as any).id; 
            delete (firebaseUpdates as any).userId; 
            delete (firebaseUpdates as any).createdAt; 
            
            // Ensure subitems are in Firebase's 'subtasks' format if being updated
            if (updates.subitems !== undefined) {
              (firebaseUpdates as any).subtasks = updates.subitems.map(si => ({ id: si.id, title: si.title, completed: si.completed }));
              delete firebaseUpdates.subitems;
            }
            await updateListInFirebase(listId, firebaseUpdates);
        } catch (error) {
            console.error("Error updating list in Firebase:", error);
            toast({ title: "Firebase Error", description: "Could not update list. Reverting.", variant: "destructive" });
            // Rollback UI
            if (originalListState && originalSourceArray) {
                if (originalSourceArray === 'active') {
                    setActiveLists(prevActive => {
                        const otherActive = prevActive.filter(l => l.id !== listId && l.id !== originalListState!.id);
                        // If it was moved to completed, remove from there
                        setCompletedLists(prevComp => prevComp.filter(l => l.id !== listId));
                        return [originalListState, ...otherActive].sort(sortLists);
                    });
                } else if (originalSourceArray === 'completed') {
                     setCompletedLists(prevCompleted => {
                        const otherCompleted = prevCompleted.filter(l => l.id !== listId && l.id !== originalListState!.id);
                        // If it was moved to active, remove from there
                        setActiveLists(prevAct => prevAct.filter(l => l.id !== listId));
                        return [originalListState, ...otherCompleted].sort(sortLists);
                    });
                }
            }
        }
    } else {
        // For anonymous users, the optimistic update is already done.
        // Local storage will be updated by the useEffect.
        console.log("[useLists] Updated list locally for anonymous user:", listId);
    }
  };

  const deleteList = async (listId: string) => {
    const originalActiveLists = [...activeLists];
    const originalCompletedLists = [...completedLists];
    let wasActive = activeLists.some(l => l.id === listId);
    
    setActiveLists(prev => prev.filter(l => l.id !== listId));
    setCompletedLists(prev => prev.filter(l => l.id !== listId));

    if (currentUser && isFirebaseConfigured()) {
      try {
        await deleteListFromFirebase(listId);
      } catch (error) {
        console.error("Error deleting list from Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not delete list. Reverting.", variant: "destructive" });
        if (wasActive) setActiveLists(originalActiveLists.sort(sortLists));
        else setCompletedLists(originalCompletedLists.sort(sortLists));
      }
    } else {
      // Anonymous: optimistic delete is done. Local storage updated by useEffect.
       console.log("[useLists] Deleted list locally for anonymous user:", listId);
    }
  };

 const manageSubitems = async (listId: string, newSubitems: Subitem[]) => {
    let originalSubitems: Subitem[] | undefined;

    const updateSubitemsInState = (lists: List[]) => {
        return lists.map(l => {
            if (l.id === listId) {
                if (!originalSubitems) originalSubitems = JSON.parse(JSON.stringify(l.subitems));
                return { ...l, subitems: newSubitems };
            }
            return l;
        }).sort(sortLists);
    };

    setActiveLists(prev => updateSubitemsInState(prev));
    // If not found in active, try completed (it might have moved due to a concurrent update)
    if (!originalSubitems) {
        setCompletedLists(prev => updateSubitemsInState(prev));
    }
    
    if (currentUser && isFirebaseConfigured()) {
      try {
        await updateSubitemsInFirebase(listId, newSubitems);
      } catch (error) {
        console.error("Error managing subitems in Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not update subitems. Reverting.", variant: "destructive" });
        if (originalSubitems) {
            const revertSubitems = (lists: List[]) => lists.map(l => l.id === listId ? { ...l, subitems: originalSubitems! } : l).sort(sortLists);
            setActiveLists(prev => revertSubitems(prev));
            setCompletedLists(prev => revertSubitems(prev));
        }
      }
    } else {
        // Anonymous: optimistic update done. Local storage updated by useEffect.
        console.log("[useLists] Managed subitems locally for anonymous user on list:", listId);
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
        // Update local state optimistically. The updateList function will handle Firebase.
        // updateList handles moving between active/completed and Firebase updates.
        await updateList(listId, { shareId: newShareId });
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
      // Update local state optimistically. The updateList function will handle Firebase.
      await updateList(listId, { shareId: null });
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

