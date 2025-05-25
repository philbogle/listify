
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
  DialogTrigger, 
} from "@/components/ui/dialog";
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
  DropdownMenuTrigger as DropdownMenuTriggerComponent, 
} from "@/components/ui/dropdown-menu";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ListChecks, AlertTriangle, Plus, Camera, Loader2, RefreshCw, LogIn, LogOut, UserCircle, Menu as MenuIcon, Eye, HelpCircle, ChevronDown } from "lucide-react";
import { isFirebaseConfigured, signInWithGoogle, signOutUser } from "@/lib/firebase";
import { useEffect, useState, useRef, useCallback } from "react";
import type { List, Subitem } from "@/types/list";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { extractListFromImage, type ExtractListFromImageInput } from "@/ai/flows/extractListFromImageFlow";
import type { User } from "firebase/auth";

const fileToDataUri = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

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
  } = useLists();


  const [firebaseReady, setFirebaseReady] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [capturedImageFile, setCapturedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const { toast } = useToast();

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [listToFocusId, setListToFocusId] = useState<string | null>(null);

  const [isViewScanDialogOpen, setIsViewScanDialogOpen] = useState(false);
  const [viewingScanUrl, setViewingScanUrl] = useState<string | null>(null);
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);

  const [isConfirmDeleteCompletedOpen, setIsConfirmDeleteCompletedOpen] = useState(false);
  const [listToDeleteCompletedFrom, setListToDeleteCompletedFrom] = useState<List | null>(null);

  const [isConfirmDeleteListOpen, setIsConfirmDeleteListOpen] = useState(false);
  const [listToDeleteId, setListToDeleteId] = useState<string | null>(null);


  useEffect(() => {
    setFirebaseReady(isFirebaseConfigured());
  }, []);

  const stopCameraStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  }, [stream]);

  useEffect(() => {
    if (isImportDialogOpen && hasCameraPermission === null && currentUser && !imagePreviewUrl) {
      const getCameraPermission = async () => {
        try {
          const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
          setStream(mediaStream);
          setHasCameraPermission(true);
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
          }
        } catch (error) {
          console.error('Error accessing camera:', error);
          setHasCameraPermission(false);
          toast({
            variant: 'destructive',
            title: 'Camera Access Denied',
            description: 'Please enable camera permissions in your browser settings.',
          });
        }
      };
      getCameraPermission();
    } else if (!isImportDialogOpen && stream) {
      stopCameraStream();
    }

    return () => {
      if (stream && !isImportDialogOpen) { 
        stopCameraStream();
      }
    };
  }, [isImportDialogOpen, hasCameraPermission, stream, stopCameraStream, toast, currentUser, imagePreviewUrl]);

  const handleAddNewList = async () => {
    if (!currentUser && firebaseReady) {
      toast({ title: "Please Sign In", description: "You need to be signed in to add lists.", variant: "destructive"});
      return;
    }
    const newList = await addList({ title: "Untitled List" });
    if (newList && newList.id) {
      setListToFocusId(newList.id);
    }
  };

  const handleOpenScanDialog = () => {
    if (firebaseReady && !currentUser) {
      toast({ title: "Please Sign In", description: "You need to be signed in to scan lists.", variant: "destructive"});
      return;
    }
    setIsImportDialogOpen(true);
  };

  const handleInitialEditDone = (listId: string) => {
    if (listId === listToFocusId) {
      setListToFocusId(null);
    }
  };

  const resetImportDialog = useCallback(() => {
    setIsProcessingImage(false);
    setCapturedImageFile(null);
    setImagePreviewUrl(null);
    setHasCameraPermission(null);
    setIsImportDialogOpen(false);
    stopCameraStream();
  }, [stopCameraStream]);

  const handleExtractList = async () => {
    if (!capturedImageFile) {
        toast({ title: "No Image Captured", description: "Please capture an image first.", variant: "destructive" });
        return;
    }
    if (!currentUser && firebaseReady) {
      toast({ title: "Please Sign In", description: "You need to be signed in to import lists.", variant: "destructive"});
      return;
    }

    setIsProcessingImage(true);
    const currentImageFile = capturedImageFile; 

    try {
      const imageDataUri = await fileToDataUri(currentImageFile);
      const input: ExtractListFromImageInput = { imageDataUri };
      const result = await extractListFromImage(input);

      if (result && result.parentListTitle) {
        const parentTitle = result.parentListTitle.trim();
        const newParentList = await addList({ title: parentTitle }, currentImageFile);
        
        if (newParentList && newParentList.id) {
          setListToFocusId(newParentList.id); 
          if (result.extractedSubitems && result.extractedSubitems.length > 0) {
            const subitemsToAdd: Subitem[] = result.extractedSubitems
              .filter(si => si.title && si.title.trim() !== "")
              .map(si => ({
                id: crypto.randomUUID(),
                title: si.title.trim(),
                completed: false,
              }));

            if (subitemsToAdd.length > 0) {
              await manageSubitems(newParentList.id, subitemsToAdd);
            }
          }
        } else {
            toast({ title: "Import Partially Failed", description: "Could not create the parent list. Subitems not added.", variant: "destructive" });
        }
      } else {
         toast({ title: "Import Failed", description: "Could not extract any information from the image.", variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Error extracting list from image:", error);
      let errorMsg = "An unexpected error occurred while processing the image.";
      if (error.message && error.message.includes("GEMINI_API_KEY")) {
        errorMsg = "AI processing failed. Check API key configuration.";
      } else if (error.message) {
        errorMsg = `AI processing error: ${error.message.substring(0,100)}${error.message.length > 100 ? '...' : ''}`;
      }
      toast({ title: "Import Error", description: errorMsg, variant: "destructive" });
    } finally {
      resetImportDialog();
    }
  };

  const handleCaptureImage = async () => {
    if (!videoRef.current || !canvasRef.current || !stream) return;
    setIsCapturing(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');
    if (!context) {
      setIsCapturing(false);
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (blob) {
        const capturedFile = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setCapturedImageFile(capturedFile);
        const previewUrl = URL.createObjectURL(capturedFile);
        setImagePreviewUrl(previewUrl);
        setHasCameraPermission(true); 
      }
      setIsCapturing(false);
    }, 'image/jpeg', 0.9);
  };

  const handleRetakePhoto = () => {
    setImagePreviewUrl(null);
    setCapturedImageFile(null);
    setHasCameraPermission(null); 
  }

  const handleSignIn = async () => {
    await signInWithGoogle();
  };

  const handleSignOut = async () => {
    await signOutUser();
  };

  const handleViewScan = (imageUrl: string) => {
    setViewingScanUrl(imageUrl);
    setIsViewScanDialogOpen(true);
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
    if (activeLists.length === 0 && (!isLoading || (currentUser && !isLoading))) {
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
    if (!currentUser && firebaseReady) return null;

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


  return (
    <div className="min-h-screen flex flex-col items-center p-4 sm:p-8 relative">
      {!currentUser && !isLoading && firebaseReady && (
         <div className="w-full max-w-2xl mt-10 flex flex-col items-center">
          <UserCircle className="mx-auto h-16 w-16 text-muted-foreground mb-6" />
          <h1 className="text-2xl font-semibold mb-2">Welcome to ListBot</h1>
          <p className="text-muted-foreground mb-6 text-center">Sign in to manage and sync your lists across devices.</p>
           <Button onClick={handleSignIn} className="mt-4 px-8 py-6 text-lg">
            <LogIn className="mr-2 h-5 w-5" /> Sign in with Google
          </Button>
        </div>
      )}

      {!firebaseReady && !isLoading && (
        <div className="w-full max-w-2xl mb-6 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 rounded-md flex items-start" role="alert">
          <AlertTriangle className="h-5 w-5 mr-3 mt-0.5" />
          <div>
            <p className="font-bold">Firebase Not Configured</p>
            <p className="text-sm">
              Your lists are currently saved locally. For cloud storage, sync, and user-specific lists, please configure Firebase in
              <code className="text-xs bg-yellow-200 p-0.5 rounded ml-1">src/lib/firebaseConfig.ts</code>.
            </p>
          </div>
        </div>
      )}

      {(firebaseReady && currentUser || !firebaseReady) && (
        <main className="w-full max-w-2xl">
          {/* Sticky Header Section */}
          <div className="sticky top-0 z-10 bg-background py-4 flex justify-between items-center border-b">
            <h2 id="list-heading" className="text-2xl font-semibold text-center sm:text-left">Lists</h2>
            <div className="flex items-center space-x-2">
              <Button variant="outline" onClick={handleAddNewList} disabled={firebaseReady && !currentUser && !isLoading}>
                <Plus className="mr-2 h-4 w-4" /> Add
              </Button>
              <Dialog open={isImportDialogOpen} onOpenChange={(isOpen) => {
                setIsImportDialogOpen(isOpen);
                if (!isOpen) { 
                  if (stream && !capturedImageFile) { 
                      stopCameraStream();
                      setHasCameraPermission(null); 
                  }
                }
              }}>
                <DialogTrigger asChild>
                  <Button variant="outline" onClick={handleOpenScanDialog} disabled={firebaseReady && !currentUser && !isLoading}>
                    <Camera className="mr-2 h-4 w-4" />
                    Scan
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[480px]">
                  <DialogHeader>
                    <DialogTitle>Scan List</DialogTitle>
                    <DialogDescription>
                      Take a picture of handwriting, printed text, or physical items. The AI will create a new list based on the image content.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-4 py-4">
                    <div className="space-y-4">
                      {!imagePreviewUrl && (
                        <div className="w-full aspect-[3/4] rounded-md overflow-hidden bg-muted flex items-center justify-center">
                          <video
                            ref={videoRef}
                            className={`w-full h-full object-cover ${!stream || !hasCameraPermission || imagePreviewUrl ? 'hidden' : ''}`}
                            autoPlay
                            playsInline 
                            muted
                          />
                           {!stream && hasCameraPermission === null && !imagePreviewUrl && <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />}
                           {hasCameraPermission === false && !imagePreviewUrl && (
                            <Alert variant="destructive" className="m-4">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertTitle>Camera Access Denied</AlertTitle>
                              <AlertDescription>
                                Please allow camera access in your browser settings to use this feature. You might need to refresh the page after granting permission.
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      )}
                      
                      {!imagePreviewUrl && stream && hasCameraPermission && (
                        <Button onClick={handleCaptureImage} disabled={isCapturing || !stream || isProcessingImage} className="w-full">
                          {isCapturing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                          {isCapturing ? "Capturing..." : "Capture Photo"}
                        </Button>
                      )}
                       {imagePreviewUrl && (
                        <Button onClick={handleRetakePhoto} variant="outline" className="w-full" disabled={isProcessingImage || isCapturing}>
                          <RefreshCw className="mr-2 h-4 w-4" /> Retake Photo
                        </Button>
                      )}
                    </div>

                    {imagePreviewUrl && capturedImageFile && (
                      <div className="mt-4 border rounded-md overflow-hidden max-h-80 flex justify-center items-center bg-muted/20 aspect-[3/4] mx-auto">
                        <Image src={imagePreviewUrl} alt="Preview of scanned list" width={400} height={533} style={{ objectFit: 'contain', maxHeight: '320px', width: 'auto' }} data-ai-hint="handwritten list" />
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline" disabled={isProcessingImage || isCapturing} onClick={() => {
                          stopCameraStream(); 
                          setCapturedImageFile(null);
                          setImagePreviewUrl(null);
                          setHasCameraPermission(null);
                      }}>Cancel</Button>
                    </DialogClose>
                    {capturedImageFile && (
                      <Button onClick={handleExtractList} disabled={isProcessingImage || isCapturing || !capturedImageFile}>
                        {isProcessingImage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Convert list
                      </Button>
                    )}
                  </DialogFooter>
                  <canvas ref={canvasRef} className="hidden"></canvas>
                </DialogContent>
              </Dialog>
              
              {firebaseReady && currentUser && (
                <DropdownMenu>
                  <DropdownMenuTriggerComponent asChild>
                    <Button variant="ghost" size="icon">
                      <MenuIcon className="h-5 w-5" />
                      <span className="sr-only">Open user menu</span>
                    </Button>
                  </DropdownMenuTriggerComponent>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>{currentUser.displayName || currentUser.email}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                     <DropdownMenuItem onClick={handleAddNewList} disabled={!currentUser && firebaseReady}>
                      <Plus className="mr-2 h-4 w-4" /> Add List
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleOpenScanDialog} disabled={!currentUser && firebaseReady}>
                      <Camera className="mr-2 h-4 w-4" /> Scan List
                    </DropdownMenuItem>
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
          </div>
          
          {/* Active Lists Section */}
          <section aria-labelledby="list-heading" className="pt-6">
            <div className="space-y-4">
              {renderActiveLists()}
            </div>
          </section>

           { (firebaseReady && currentUser || !firebaseReady) && (
             <section aria-labelledby="completed-list-heading" className="mt-12 w-full">
                {renderCompletedListSection()}
            </section>
           )}
        </main>
      )}

      <Dialog open={isViewScanDialogOpen} onOpenChange={setIsViewScanDialogOpen}>
        <DialogContent className="sm:max-w-md md:max-w-lg lg:max-w-xl">
          <DialogHeader>
            <DialogTitle>Scanned Image</DialogTitle>
          </DialogHeader>
          {viewingScanUrl && (
            <div className="mt-4 flex justify-center items-center max-h-[80vh]">
              <Image
                src={viewingScanUrl}
                alt="Scanned list image"
                width={600}
                height={800}
                style={{ objectFit: 'contain', maxHeight: 'calc(80vh - 100px)', width: 'auto' }}
                data-ai-hint="document scan"
              />
            </div>
          )}
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen}>
        <DialogContent className="sm:max-w-md md:max-w-lg">
          <DialogHeader>
            <DialogTitle>ListBot Help</DialogTitle>
            <DialogDescription>
              Learn about ListBot&apos;s features and how to use them effectively.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-3 text-sm max-h-[60vh] overflow-y-auto pr-2">
            <div>
              <h4 className="font-semibold mb-0.5">Creating Lists</h4>
              <p>Click the &quot;Add&quot; button (or select from the menu) to create a new list. The title will be in edit mode, allowing you to name your list immediately.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-0.5">Adding Items</h4>
              <p>Once a list is created, click &quot;Add Item&quot; at the bottom of its card. The new item&apos;s title will start in edit mode.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-0.5">Scanning Lists/Items</h4>
              <p>Click &quot;Scan&quot; (or select from the menu). Use your camera to take a picture of handwriting, printed text, or physical items. The AI will create a list. Scanned images can be viewed via the list&apos;s menu (&quot;View Scan&quot; option).</p>
            </div>
            <div>
              <h4 className="font-semibold mb-0.5">Autogenerating Items</h4>
              <p>Use the &quot;Autogenerate&quot; button on a list card or the &quot;Autogenerate Items&quot; menu option. The AI suggests new items based on the list&apos;s title and existing content.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-0.5">Managing Lists & Items</h4>
              <ul className="list-disc pl-5 space-y-1 mt-1">
                <li><strong>Edit Titles:</strong> Click a list or item title to edit.</li>
                <li><strong>Complete:</strong> Use checkboxes to mark lists/items complete. Alternatively, use the menu option.</li>
                <li><strong>Delete:</strong> Use the three-dot menu for deletion. Options include deleting the entire list or just its completed items.</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-0.5">Completed Lists</h4>
              <p>Completed lists are moved to a collapsible &quot;Completed&quot; section. Expand this to view them.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-0.5">User Accounts</h4>
              <p>Sign in with Google to save and sync your lists. Use the top-right menu for account actions like signing out or accessing this help screen.</p>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    

    


    

    

    


    

    
