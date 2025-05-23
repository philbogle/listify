
"use client";

import { useState, useEffect, useCallback } from "react";
import type { List, Subitem } from "@/types/list";
import {
  addListToFirebase,
  getListsFromFirebase,
  updateListInFirebase,
  deleteListFromFirebase,
  updateSubitemsInFirebase,
  isFirebaseConfigured,
  onAuthUserChanged, 
  uploadScanImageToFirebase, // Import the new upload function
} from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { User } from "firebase/auth"; 

const LOCAL_STORAGE_KEY_PREFIX = "taskflow_lists_"; 

export const useLists = () => {
  const [lists, setLists] = useState<List[]>([]);
  const [isLoading, setIsLoading] = useState(true); 
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setIsLoading(false); 
      const localKey = LOCAL_STORAGE_KEY_PREFIX + "anonymous";
      try {
        const localLists = localStorage.getItem(localKey);
        if (localLists) {
          setLists(JSON.parse(localLists));
        }
      } catch (error) {
        console.error("Error loading lists from local storage (no Firebase):", error);
      }
      return; 
    }

    const unsubscribe = onAuthUserChanged((user) => {
      setCurrentUser(user);
      if (!user) {
        setLists([]);
        setIsLoading(false); 
      }
      // If user is present, isLoading is handled by data fetching effect.
    });
    return () => unsubscribe(); 
  }, [toast]);

  useEffect(() => {
    if (currentUser && isFirebaseConfigured()) {
      setIsLoading(true); 
      const localKey = LOCAL_STORAGE_KEY_PREFIX + currentUser.uid;
      getListsFromFirebase(currentUser.uid)
        .then((firebaseLists) => {
          setLists(firebaseLists);
          try {
            localStorage.setItem(localKey, JSON.stringify(firebaseLists));
          } catch (e) { console.error("Failed to save lists to local storage after fetch", e); }
        })
        .catch((error) => {
          console.error("Error loading lists from Firebase:", error);
          toast({
            title: "Firebase Load Error",
            description: "Could not load lists. Check console. Ensure Firebase rules and indexes are set up.",
            variant: "destructive",
            duration: 9000,
          });
          try {
            const localListsData = localStorage.getItem(localKey);
            if (localListsData) {
              setLists(JSON.parse(localListsData));
            } else {
              setLists([]); 
            }
          } catch (e) { 
            console.error("Failed to load lists from local storage fallback", e); 
            setLists([]); 
          }
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else if (!currentUser && isFirebaseConfigured()) {
        setLists([]); // Clear lists if logged out
        setIsLoading(false); // Not loading if no user
    }
  }, [currentUser, toast]); 

  useEffect(() => {
    if (!isLoading) { 
      if (currentUser && isFirebaseConfigured()) {
        const localKey = LOCAL_STORAGE_KEY_PREFIX + currentUser.uid;
        try {
          localStorage.setItem(localKey, JSON.stringify(lists));
        } catch (error) {
          console.error("Error saving lists to local storage (authed user):", error);
        }
      } else if (!isFirebaseConfigured()) { 
        const localKey = LOCAL_STORAGE_KEY_PREFIX + "anonymous";
        try {
          localStorage.setItem(localKey, JSON.stringify(lists));
        } catch (error) {
          console.error("Error saving lists to local storage (anonymous):", error);
        }
      }
    }
  }, [lists, isLoading, currentUser]); 

  const addList = async (
    listData: Omit<List, "id" | "completed" | "subitems" | "createdAt" | "userId" | "scanImageUrl">,
    capturedImageFile?: File | null // New parameter for the image file
  ): Promise<List | undefined> => {
    if (!currentUser && isFirebaseConfigured()) {
      toast({ title: "Not Signed In", description: "Please sign in to add lists.", variant: "destructive" });
      return undefined;
    }

    const newListBase: Omit<List, "id" | "createdAt" | "scanImageUrl"> = {
      title: listData.title,
      completed: false,
      subitems: [],
      userId: currentUser?.uid, 
    };
    
    let optimisticList: List | undefined;
    const optimisticId = crypto.randomUUID(); 

    if (isFirebaseConfigured() && currentUser) {
      optimisticList = {
        ...newListBase,
        id: optimisticId,
        createdAt: new Date().toISOString(), 
        userId: currentUser.uid,
      };
      setLists(prevLists => [optimisticList!, ...prevLists].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));

      try {
        // Create the list document first (without scanImageUrl)
        const addedListFromFirebase = await addListToFirebase(newListBase, currentUser.uid);
        let finalFirebaseList = addedListFromFirebase; // This is the list with correct ID and server timestamp

        if (capturedImageFile) {
          try {
            const downloadURL = await uploadScanImageToFirebase(capturedImageFile, currentUser.uid, addedListFromFirebase.id);
            // Update the list document in Firestore with the scanImageUrl
            await updateListInFirebase(addedListFromFirebase.id, { scanImageUrl: downloadURL });
            finalFirebaseList = { ...addedListFromFirebase, scanImageUrl: downloadURL }; // Update the list object

            // Update local state for the specific list with the scanImageUrl
            setLists(prevLists =>
              prevLists.map(l =>
                l.id === optimisticId ? finalFirebaseList : l
              ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            );
          } catch (uploadError) {
            console.error("Error uploading scan image or updating list with URL:", uploadError);
            toast({ title: "Image Upload Failed", description: "List created, but image upload failed. Check console.", variant: "destructive" });
            // If upload fails, still update local state with the list from Firebase (without image URL)
            setLists(prevLists =>
              prevLists.map(l =>
                l.id === optimisticId ? addedListFromFirebase : l
              ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            );
            return addedListFromFirebase; // Return the list as created, but without image
          }
        } else {
          // No image, just update the optimistic list with the final Firebase list
           setLists(prevLists =>
            prevLists.map(l =>
              l.id === optimisticId ? addedListFromFirebase : l
            ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          );
        }
        return finalFirebaseList; // Return the potentially updated list

      } catch (error) {
        console.error("Error adding list to Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not add list. Check console.", variant: "destructive" });
        if (optimisticList) { 
          setLists(prevLists => prevLists.filter(l => l.id !== optimisticId)); 
        }
        return undefined;
      }
    } else if (!isFirebaseConfigured()) { 
      const newListForLocal: List = {
        ...newListBase,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        userId: undefined 
      };
      setLists(prevLists => [newListForLocal, ...prevLists].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      return newListForLocal;
    }
    return undefined;
  };

  const updateList = async (listId: string, updates: Partial<List>) => {
    let originalList: List | undefined;

    setLists(prevLists => {
      const listIndex = prevLists.findIndex(list => list.id === listId);
      if (listIndex === -1) return prevLists;
      
      originalList = { ...prevLists[listIndex] }; 

      const updatedLists = [...prevLists];
      updatedLists[listIndex] = { ...updatedLists[listIndex], ...updates };
      return updatedLists;
    });

    if (isFirebaseConfigured() && currentUser) { 
      try {
        const firebaseUpdates = { ...updates };
        delete firebaseUpdates.userId; 
        delete firebaseUpdates.createdAt; 
        await updateListInFirebase(listId, firebaseUpdates);
      } catch (error) {
        console.error("Error updating list in Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not update list. Reverting.", variant: "destructive" });
        if (originalList) {
          setLists(prevLists =>
            prevLists.map(list => (list.id === listId ? originalList! : list))
          );
        }
      }
    } else if (!isFirebaseConfigured()) {
        // Local update already applied optimistically
    }
  };

  const deleteList = async (listId: string) => {
    // Note: This does not delete the associated image from Firebase Storage.
    // Implementing that would require knowing the image path or URL and using Firebase Storage SDK.
    const originalLists = [...lists];
    setLists(prevLists => prevLists.filter((list) => list.id !== listId));

    if (isFirebaseConfigured() && currentUser) {
      try {
        await deleteListFromFirebase(listId);
      } catch (error) {
        console.error("Error deleting list from Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not delete list. Reverting.", variant: "destructive" });
        setLists(originalLists);
      }
    } else if (!isFirebaseConfigured()) {
        // Local delete already applied
    }
  };

  const manageSubitems = async (listId: string, newSubitems: Subitem[]) => {
    let originalSubitems: Subitem[] | undefined;

    setLists(prevLists => {
      const listIndex = prevLists.findIndex(list => list.id === listId);
      if (listIndex === -1) return prevLists;
      
      originalSubitems = [...prevLists[listIndex].subitems];

      const updatedLists = [...prevLists];
      updatedLists[listIndex] = { ...updatedLists[listIndex], subitems: newSubitems };
      return updatedLists;
    });

    if (isFirebaseConfigured() && currentUser) {
      try {
        await updateSubitemsInFirebase(listId, newSubitems);
      } catch (error) {
        console.error("Error managing subitems in Firebase:", error);
        toast({ title: "Firebase Error", description: "Could not update subitems. Reverting.", variant: "destructive" });
        if (originalSubitems !== undefined) {
          setLists(prevLists => {
             const listIndex = prevLists.findIndex(l => l.id === listId);
             if (listIndex === -1) return prevLists; 
             const rolledBackLists = [...prevLists];
             rolledBackLists[listIndex] = { ...rolledBackLists[listIndex], subitems: originalSubitems! };
             return rolledBackLists;
          });
        }
      }
    } else if (!isFirebaseConfigured()) {
        // Local update applied
    }
  };

  return { lists, isLoading, currentUser, addList, updateList, deleteList, manageSubitems };
};
