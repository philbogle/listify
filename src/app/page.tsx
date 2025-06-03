
"use client";

import ListCard from "@/components/ListCard";
import { useLists } from "@/hooks/useLists";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import HelpDialog from "@/components/HelpDialog";
import ScanDialog from "@/components/ScanDialog"; 
import ImportListDialog from "@/components/ImportListDialog"; 
import AppHeader from "@/components/AppHeader"; 
import ViewScanDialog from "@/components/ViewScanDialog";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ListChecks, AlertTriangle, Loader2, Trash2 } from "lucide-react"; 
import { isFirebaseConfigured, signInWithGoogle, signOutUser } from "@/lib/firebase"; 
import React, { useEffect, useState, useCallback } from "react";
import type { List } from "@/types/list";
import { useToast } from "@/hooks/use-toast";


export default function Home() {
  const {
    activeLists,
    completedLists,
    isLoading,
    isLoadingCompleted,
    currentUser,
    fetchCompletedListsIfNeeded,
    hasFetchedCompleted,
    addList,
    updateList,
    deleteList,
    manageSubitems,
    shareList,
    unshareList,
  } = useLists();


  const [firebaseReady, setFirebaseReady] = useState(false);
  const { toast } = useToast();

  const [listToFocusId, setListToFocusId] = useState<string | null>(null);

  const [isViewScanDialogOpen, setIsViewScanDialogOpen] = useState(false);
  const [viewingScanUrls, setViewingScanUrls] = useState<string[] | null>(null);
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);

  const [isConfirmDeleteCompletedOpen, setIsConfirmDeleteCompletedOpen] = useState(false);
  const [listToDeleteCompletedFrom, setListToDeleteCompletedFrom] = useState<List | null>(null);

  const [isConfirmDeleteListOpen, setIsConfirmDeleteListOpen] = useState(false);
  const [listToDeleteId, setListToDeleteId] = useState<string | null>(null);

  const [scanDialogProps, setScanDialogProps] = useState<{
    open: boolean;
    initialListId: string | null;
    initialListTitle: string | null;
  }>({ open: false, initialListId: null, initialListTitle: null });

  const [isImportListDialogOpen, setIsImportListDialogOpen] = useState(false); 


  useEffect(() => {
    setFirebaseReady(isFirebaseConfigured());
  }, []);


  const handleAddNewList = async () => {
    const newList = await addList({ title: "Untitled List" });
    if (newList && newList.id) {
      setListToFocusId(newList.id);
    }
  };

  const handleOpenScanDialogForNewList = () => {
    setScanDialogProps({ open: true, initialListId: null, initialListTitle: null });
  };

  const handleOpenScanDialogForExistingList = (listId: string, listTitle: string) => {
    setScanDialogProps({ open: true, initialListId: listId, initialListTitle: listTitle });
  };

  const handleOpenImportListDialog = () => {
    setIsImportListDialogOpen(true);
  };


  const handleInitialEditDone = (listId: string) => {
    if (listId === listToFocusId) {
      setListToFocusId(null);
    }
  };

  const handleSignIn = async () => {
    await signInWithGoogle();
  };

  const handleSignOut = async () => {
    await signOutUser();
  };

  const handleViewScan = (imageUrls: string[]) => {
    if (imageUrls && imageUrls.length > 0) {
      setViewingScanUrls(imageUrls);
      setIsViewScanDialogOpen(true);
    }
  };
  
  const handleViewScanDialogChange = (isOpen: boolean) => {
    setIsViewScanDialogOpen(isOpen);
    if (!isOpen) {
      setViewingScanUrls(null); 
    }
  };

  const handleDeleteCompletedItemsRequested = (listId: string) => {
    const list = activeLists.find(l => l.id === listId) || completedLists.find(l => l.id === listId);
    if (list) {
      setListToDeleteCompletedFrom(list);
      setIsConfirmDeleteCompletedOpen(true);
    } else {
      toast({title: "Error", description: "Could not find the list to delete completed items from.", variant: "destructive"});
    }
  };

  const handleConfirmDeleteCompletedItems = async () => {
    if (!listToDeleteCompletedFrom) return;

    const remainingSubitems = listToDeleteCompletedFrom.subitems.filter(si => !si.completed);
    await manageSubitems(listToDeleteCompletedFrom.id, remainingSubitems);

    setIsConfirmDeleteCompletedOpen(false);
    setListToDeleteCompletedFrom(null);
  };

  const handleDeleteListRequested = (listId: string) => {
    setListToDeleteId(listId);
    setIsConfirmDeleteListOpen(true);
  };

  const handleConfirmDeleteList = async () => {
    if (listToDeleteId) {
      await deleteList(listToDeleteId);
    }
    setIsConfirmDeleteListOpen(false);
    setListToDeleteId(null);
  };

  const getListTitleForDialog = (listId: string | null): string => {
    if (!listId) return "this list";
    const list = activeLists.find(l => l.id === listId) || completedLists.find(l => l.id === listId);
    return list?.title || "this list";
  };

  const renderListCards = (listsToRender: List[], listType: "active" | "completed") => {
    return (
      <div className="space-y-4">
        {listsToRender.map((list) => (
          <ListCard
            key={list.id}
            list={list}
            onUpdateList={updateList}
            onDeleteListRequested={handleDeleteListRequested}
            onManageSubitems={manageSubitems}
            startInEditMode={list.id === listToFocusId}
            onInitialEditDone={handleInitialEditDone}
            toast={toast}
            onViewScan={handleViewScan}
            onDeleteCompletedItemsRequested={handleDeleteCompletedItemsRequested}
            onScanMoreItemsRequested={handleOpenScanDialogForExistingList} 
            shareList={shareList}
            unshareList={unshareList}
            isUserAuthenticated={!!currentUser}
            currentUserId={currentUser?.uid || null}
          />
        ))}
      </div>
    );
  };

  const renderActiveLists = () => {
    if (isLoading) {
      return Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className="mb-4 p-4 border rounded-lg shadow-md bg-card">
          <Skeleton className="h-6 w-6 rounded-full inline-block mr-2" />
          <Skeleton className="h-6 w-4/5 inline-block" />
          <div className="mt-4 space-y-2">
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      ));
    }
    if (activeLists.length === 0 && !isLoading) {
      return (
        <div className="text-center py-10">
          <ListChecks className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No active lists. Add one or scan a list to get started!</p>
        </div>
      );
    }
    return renderListCards(activeLists, "active");
  };

  const renderCompletedListSection = () => {
    if (!isFirebaseConfigured() || (isFirebaseConfigured() && (currentUser || activeLists.length > 0 || completedLists.length > 0))) {
        return (
            <Accordion type="single" collapsible className="w-full" onValueChange={(value) => {
                if (value === "completed-lists") {
                    fetchCompletedListsIfNeeded();
                }
            }}>
                <AccordionItem value="completed-lists">
                    <AccordionTrigger className="text-lg font-semibold text-muted-foreground hover:text-foreground transition-colors">
                        Completed ({completedLists.length > 0 ? completedLists.length : (hasFetchedCompleted ? '0' : '...')})
                    </AccordionTrigger>
                    <AccordionContent>
                        {isLoadingCompleted ? (
                            <div className="flex justify-center items-center py-10">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : completedLists.length === 0 && hasFetchedCompleted ? (
                            <p className="text-muted-foreground text-center py-6">No completed lists yet.</p>
                        ) : (
                            <div className="pt-4">
                                {renderListCards(completedLists, "completed")}
                            </div>
                        )}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        );
    }
    return null;
  }


  return (
    <div className="min-h-screen flex flex-col items-center p-4 sm:p-8">
      {!firebaseReady && !isLoading && (
        <div className="w-full max-w-2xl mb-6 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 rounded-md flex items-start" role="alert">
          <AlertTriangle className="h-5 w-5 mr-3 mt-0.5" />
          <div>
            <p className="font-bold">Firebase Not Configured</p>
            <p className="text-sm">
              Your lists are currently saved locally. For cloud storage, sync, and sharing, please configure Firebase in
              <code className="text-xs bg-yellow-200 p-0.5 rounded ml-1">src/lib/firebaseConfig.ts</code>.
            </p>
          </div>
        </div>
      )}

      {(isLoading || !firebaseReady || (firebaseReady && currentUser) || (firebaseReady && !currentUser)) && (
        <main className="w-full max-w-2xl">
          <AppHeader
            currentUser={currentUser}
            firebaseReady={firebaseReady}
            onAddNewList={handleAddNewList}
            onOpenScanDialogForNewList={handleOpenScanDialogForNewList}
            onOpenImportListDialog={handleOpenImportListDialog}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
            onOpenHelpDialog={() => setIsHelpDialogOpen(true)}
          />

          <section aria-labelledby="list-heading" className="pt-6">
            {isLoading ? (
                Array.from({ length: 2 }).map((_, index) => (
                    <div key={index} className="mb-4 p-4 border rounded-lg shadow-md bg-card">
                    <Skeleton className="h-6 w-6 rounded-full inline-block mr-2" />
                    <Skeleton className="h-6 w-4/5 inline-block" />
                    <div className="mt-4 space-y-2">
                        <Skeleton className="h-8 w-full" />
                    </div>
                    </div>
                ))
            ) : (
                <div className="space-y-4">
                    {renderActiveLists()}
                </div>
            )}
          </section>

          <section aria-labelledby="completed-list-heading" className="mt-12 w-full">
              {renderCompletedListSection()}
          </section>

          {!currentUser && firebaseReady && !isLoading && (
            <div className="w-full max-w-2xl mt-12 bg-card border rounded-lg shadow-md p-4 sm:p-6 flex flex-col items-center">
              <h1 className="text-xl font-semibold mb-2">Welcome to Listify!</h1>
              <p className="text-muted-foreground mb-1 text-center text-sm">
                You&apos;re currently using Listify locally.
              </p>
              <p className="text-muted-foreground mb-4 text-center text-sm">
                Sign in with Google to sync your lists and enable cloud features like sharing. AI features like scanning and item generation are available without sign-in.
              </p>
              <Button onClick={handleSignIn} className="px-6 py-3 text-base">
                Sign in with Google
              </Button>
            </div>
          )}
        </main>
      )}

      <ScanDialog
        isOpen={scanDialogProps.open}
        onOpenChange={(open) => setScanDialogProps(prev => ({ ...prev, open }))}
        currentUser={currentUser}
        firebaseReady={firebaseReady}
        addList={addList}
        updateList={updateList}
        manageSubitems={manageSubitems}
        activeLists={activeLists}
        completedLists={completedLists}
        toast={toast}
        setListToFocusId={setListToFocusId}
        initialListId={scanDialogProps.initialListId}
        initialListTitle={scanDialogProps.initialListTitle}
      />

      <ImportListDialog
        isOpen={isImportListDialogOpen}
        onOpenChange={setIsImportListDialogOpen}
        addList={addList}
        manageSubitems={manageSubitems}
        toast={toast}
        setListToFocusId={setListToFocusId}
      />

      <ViewScanDialog
        isOpen={isViewScanDialogOpen}
        onOpenChange={handleViewScanDialogChange}
        imageUrls={viewingScanUrls}
      />

      <HelpDialog isOpen={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen} />

       <AlertDialog open={isConfirmDeleteCompletedOpen} onOpenChange={setIsConfirmDeleteCompletedOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Completed Items?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all completed items from the list
              &quot;{listToDeleteCompletedFrom?.title || "this list"}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setListToDeleteCompletedFrom(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteCompletedItems}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isConfirmDeleteListOpen} onOpenChange={setIsConfirmDeleteListOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete List?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the list &quot;{getListTitleForDialog(listToDeleteId)}&quot;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setListToDeleteId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteList}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

