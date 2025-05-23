
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ListChecks, AlertTriangle, Plus, Camera, Loader2, RefreshCw, LogIn, LogOut, UserCircle, Menu as MenuIcon, Eye } from "lucide-react";
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
  const { lists, isLoading, addList, updateList, deleteList, manageSubitems, currentUser } = useLists();
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

  // State for View Scan Dialog
  const [isViewScanDialogOpen, setIsViewScanDialogOpen] = useState(false);
  const [viewingScanUrl, setViewingScanUrl] = useState<string | null>(null);


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
    const newList = await addList({ title: "Untitled List" }); // Pass undefined for image file
    if (newList && newList.id) {
      setListToFocusId(newList.id);
    }
  };

  const handleInitialEditDone = (listId: string) => {
    if (listId === listToFocusId) {
      setListToFocusId(null);
    }
  };

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

        if (parentTitle.toLowerCase().includes("no list found") || parentTitle.toLowerCase().includes("not a list")) {
          toast({ title: "Import Note", description: "No list found in the image, or the content was not recognized as a list.", variant: "default" });
          setCapturedImageFile(null);
          setImagePreviewUrl(null);
          setHasCameraPermission(null);
          setIsProcessingImage(false);
          setIsImportDialogOpen(false);
          return;
        }
        
        const newParentList = await addList({ title: parentTitle }, currentImageFile);

        if (newParentList && newParentList.id) {
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
    } catch (error) {
      console.error("Error extracting list from image:", error);
      toast({ title: "Import Error", description: "An unexpected error occurred while processing the image.", variant: "destructive" });
    } finally {
      setIsProcessingImage(false);
      setCapturedImageFile(null);
      setImagePreviewUrl(null);
      setHasCameraPermission(null);
      setIsImportDialogOpen(false);
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
      }
      setIsCapturing(false);
      // Automatic extraction after capture
      if (blob) { // ensure blob is not null before proceeding
        handleExtractList();
      }
    }, 'image/jpeg', 0.9);
  };


  const resetImportDialogOnlyUI = useCallback(() => {
    setCapturedImageFile(null);
    setImagePreviewUrl(null);
    setHasCameraPermission(null);
    setIsImportDialogOpen(false);
  }, []);


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

  const renderLists = () => {
    if (isLoading) {
      return Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="mb-4 p-4 border rounded-lg shadow-md bg-card">
          <div className="flex items-center space-x-3 mb-3">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-6 w-4/5" />
          </div>
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4" />
          <div className="mt-4 space-y-2">
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      ));
    }
    
    if (!currentUser && firebaseReady) {
      return (
        <div className="text-center py-10">
          {/* This block is effectively handled by the main conditional rendering below */}
        </div>
      );
    }
    
    if (lists.length === 0 && (!isLoading || (currentUser && !isLoading))) {
      return (
        <div className="text-center py-10">
          <ListChecks className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No lists yet. Add one or scan a list to get started!</p>
        </div>
      );
    }

    return lists.map((list) => (
      <ListCard
        key={list.id}
        list={list}
        onUpdateList={updateList}
        onDeleteList={deleteList}
        onManageSubitems={manageSubitems}
        startInEditMode={list.id === listToFocusId}
        onInitialEditDone={handleInitialEditDone}
        toast={toast}
        onViewScan={handleViewScan}
      />
    ));
  };

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
        <main className="w-full max-w-2xl mt-4">
          <section aria-labelledby="list-heading">
            <div className="flex justify-between items-center mb-6">
              <h2 id="list-heading" className="text-2xl font-semibold text-center sm:text-left">Lists</h2>
              <div className="flex items-center space-x-2">
                <Button variant="outline" onClick={handleAddNewList} disabled={firebaseReady && !currentUser && !isLoading}>
                  <Plus className="mr-2 h-4 w-4" /> Add
                </Button>
                <Dialog open={isImportDialogOpen} onOpenChange={(isOpen) => {
                  if (firebaseReady && !currentUser && isOpen) {
                    toast({ title: "Please Sign In", description: "You need to be signed in to scan lists.", variant: "destructive"});
                    setIsImportDialogOpen(false);
                    return;
                  }
                  setIsImportDialogOpen(isOpen);
                  if (!isOpen) {
                    if (stream && !capturedImageFile) {
                        stopCameraStream();
                        setHasCameraPermission(null);
                    }
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button variant="outline" disabled={firebaseReady && !currentUser && !isLoading}>
                      <Camera className="mr-2 h-4 w-4" />
                      Scan
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                      <DialogTitle>Scan Handwritten List</DialogTitle>
                      <DialogDescription>
                        Take a picture of your handwritten list. The AI will create a new list with these items.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                      <div className="space-y-4">
                        {!imagePreviewUrl && (
                          <div className="w-full aspect-[3/4] rounded-md overflow-hidden bg-muted flex items-center justify-center">
                            <video
                              ref={videoRef}
                              className={`w-full h-full object-cover ${!stream ? 'hidden' : ''}`}
                              autoPlay
                              playsInline
                              muted
                            />
                            {hasCameraPermission === false && (
                              <Alert variant="destructive" className="m-4">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Camera Access Denied</AlertTitle>
                                <AlertDescription>
                                  Please allow camera access in your browser settings to use this feature. You might need to refresh the page after granting permission.
                                </AlertDescription>
                              </Alert>
                            )}
                            {hasCameraPermission === null && !stream && <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />}
                          </div>
                        )}
                        
                        {!imagePreviewUrl && stream && hasCameraPermission && (
                          <Button onClick={handleCaptureImage} disabled={isCapturing || !stream || isProcessingImage} className="w-full">
                            {isCapturing || isProcessingImage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
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
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MenuIcon className="h-5 w-5" />
                        <span className="sr-only">Open user menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>{currentUser.displayName || currentUser.email}</DropdownMenuLabel>
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

            <div className="space-y-4">
              {renderLists()}
            </div>
          </section>
        </main>
      )}

      {/* Dialog for Viewing Scan */}
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

    </div>
  );
}
