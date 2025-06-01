
"use client";

import ListCard from "@/components/ListCard";
import { useLists } from "@/hooks/useLists";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import HelpDialog from "@/components/HelpDialog";
import ScanDialog from "@/components/ScanDialog"; 

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger, 
} from "@/components/ui/dropdown-menu";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ListChecks, AlertTriangle, Plus, Camera, Loader2, LogOut, Menu as MenuIcon, HelpCircle, Trash2, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react";
import { isFirebaseConfigured, signInWithGoogle, signOutUser } from "@/lib/firebase"; 
import { useEffect, useState, useCallback } from "react";
import type { List } from "@/types/list";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { TooltipProvider } from "@/components/ui/tooltip";


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
  const [currentScanIndex, setCurrentScanIndex] = useState(0);
  const [scanZoomLevel, setScanZoomLevel] = useState(1);
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
      setCurrentScanIndex(0);
      setScanZoomLevel(1);
      setIsViewScanDialogOpen(true);
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

  const renderListCards = (listsToRender: List[]) => {
    return listsToRender.map((list) => (
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
      />
    ));
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
    return renderListCards(activeLists);
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
                            <div className="space-y-4 pt-4">
                                {renderListCards(completedLists)}
                            </div>
                        )}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        );
    }
    return null;
  }

  const handleZoomIn = () => setScanZoomLevel(prev => Math.min(prev + 0.2, 3));
  const handleZoomOut = () => setScanZoomLevel(prev => Math.max(prev - 0.2, 0.5));

  const handleNextScan = () => {
    if (viewingScanUrls && currentScanIndex < viewingScanUrls.length - 1) {
      setCurrentScanIndex(prev => prev + 1);
      setScanZoomLevel(1);
    }
  };
  const handlePrevScan = () => {
    if (currentScanIndex > 0) {
      setCurrentScanIndex(prev => prev - 1);
      setScanZoomLevel(1);
    }
  };


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
          <div className="sticky top-0 z-10 bg-background py-4 flex justify-between items-center border-b">
            <h2 id="list-heading" className="text-2xl font-semibold text-center sm:text-left">Lists</h2>
            <TooltipProvider delayDuration={100}>
              <div className="flex items-center space-x-1 sm:space-x-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="default">
                      <Plus className="mr-2 h-4 w-4" /> Add
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleAddNewList} className="py-3">
                      <Plus className="mr-2 h-4 w-4" /> Enter Manually
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleOpenScanDialogForNewList} className="py-3">
                      <Camera className="mr-2 h-4 w-4" /> Scan List
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                {firebaseReady && currentUser && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MenuIcon className="h-5 w-5" />
                        <span className="sr-only">Open user menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>{currentUser.displayName || currentUser.email}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setIsHelpDialogOpen(true)}>
                        <HelpCircle className="mr-2 h-4 w-4" />
                        <span>Help</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleSignOut}>
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Sign Out</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </TooltipProvider>
          </div>

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
                Sign in with Google to sync your lists and enable cloud features like sharing and AI item generation.
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

      <Dialog open={isViewScanDialogOpen} onOpenChange={(isOpen) => {
        setIsViewScanDialogOpen(isOpen);
        if (!isOpen) {
          setViewingScanUrls(null);
          setCurrentScanIndex(0);
        }
      }}>
        <DialogContent className="sm:max-w-md md:max-w-lg lg:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              Scanned Image
              {viewingScanUrls && viewingScanUrls.length > 1 && (
                <span className="text-sm text-muted-foreground ml-2">
                  ({currentScanIndex + 1} of {viewingScanUrls.length})
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {viewingScanUrls && viewingScanUrls[currentScanIndex] && (
            <div className="mt-4 flex justify-center items-center max-h-[70vh] overflow-auto bg-muted/10 p-2 rounded-md">
              <Image
                key={viewingScanUrls[currentScanIndex]}
                src={viewingScanUrls[currentScanIndex]}
                alt={`Scanned list image ${currentScanIndex + 1}`}
                width={600}
                height={800}
                style={{
                  objectFit: 'contain',
                  maxHeight: 'calc(70vh - 120px)',
                  width: 'auto',
                  transform: `scale(${scanZoomLevel})`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.2s ease-out'
                }}
                data-ai-hint="document scan"
              />
            </div>
          )}
          <DialogFooter className="mt-4 sm:justify-between items-center">
            <div className="flex items-center space-x-2">
               <Button onClick={handleZoomOut} variant="outline" size="icon" disabled={scanZoomLevel <= 0.5} aria-label="Zoom out">
                <ZoomOut />
              </Button>
              <Button onClick={handleZoomIn} variant="outline" size="icon" disabled={scanZoomLevel >= 3} aria-label="Zoom in">
                <ZoomIn />
              </Button>
               {scanZoomLevel > 1 && (
                <p className="text-xs text-muted-foreground">(Use two fingers to scroll)</p>
              )}
            </div>
            {viewingScanUrls && viewingScanUrls.length > 1 && (
              <div className="flex items-center space-x-2">
                <Button onClick={handlePrevScan} variant="outline" size="icon" disabled={currentScanIndex === 0} aria-label="Previous scan">
                  <ChevronLeft />
                </Button>
                <Button onClick={handleNextScan} variant="outline" size="icon" disabled={currentScanIndex === viewingScanUrls.length - 1} aria-label="Next scan">
                  <ChevronRight />
                </Button>
              </div>
            )}
            <DialogClose asChild>
              <Button type="button" variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
