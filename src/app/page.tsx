
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
import HelpDialog from "@/components/HelpDialog";
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
import { ListChecks, AlertTriangle, Plus, Camera, Loader2, RefreshCw, LogIn, LogOut, UserCircle, Menu as MenuIcon, Eye, HelpCircle, Sparkles, Trash2, ZoomIn, ZoomOut, ChevronDown, Smartphone, ScanLine, ChevronLeft, ChevronRight } from "lucide-react";
import { isFirebaseConfigured, signInWithGoogle, signOutUser, uploadScanImageToFirebase } from "@/lib/firebase";
import { useEffect, useState, useRef, useCallback } from "react";
import type { List, Subitem } from "@/types/list";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { extractListFromImage, type ExtractListFromImageInput } from "@/ai/flows/extractListFromImageFlow";
import type { User } from "firebase/auth";

import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

const fileToDataUri = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// Helper function to generate a cropped image file
async function getCroppedImageFile(
  image: HTMLImageElement,
  crop: PixelCrop,
  fileName: string
): Promise<File | null> {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  canvas.width = Math.floor(crop.width * scaleX);
  canvas.height = Math.floor(crop.height * scaleY);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('Failed to get 2d context for cropping.');
    return null;
  }

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        console.error('Canvas to Blob conversion failed.');
        resolve(null);
        return;
      }
      resolve(new File([blob], fileName, { type: 'image/jpeg', lastModified: Date.now() }));
    }, 'image/jpeg', 0.9);
  });
}


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
  const [viewingScanUrls, setViewingScanUrls] = useState<string[] | null>(null);
  const [currentScanIndex, setCurrentScanIndex] = useState(0);
  const [scanZoomLevel, setScanZoomLevel] = useState(1);
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);

  const [isConfirmDeleteCompletedOpen, setIsConfirmDeleteCompletedOpen] = useState(false);
  const [listToDeleteCompletedFrom, setListToDeleteCompletedFrom] = useState<List | null>(null);

  const [isConfirmDeleteListOpen, setIsConfirmDeleteListOpen] = useState(false);
  const [listToDeleteId, setListToDeleteId] = useState<string | null>(null);

  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null); 
  const [cropAspect, setCropAspect] = useState<number | undefined>(undefined); 

  const [scanningForListId, setScanningForListId] = useState<string | null>(null);
  const [scanningListTitle, setScanningListTitle] = useState<string | null>(null);


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

  const resetCropperState = () => {
    setCrop(undefined);
    setCompletedCrop(undefined);
  };

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
      if (stream && isImportDialogOpen) {
        stopCameraStream();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isImportDialogOpen, currentUser, hasCameraPermission, imagePreviewUrl]);

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
  
  const handleOpenNewScanDialog = () => {
    if (firebaseReady && !currentUser) {
      toast({ title: "Please Sign In", description: "You need to be signed in to scan lists.", variant: "destructive"});
      return;
    }
    setScanningForListId(null);
    setScanningListTitle(null);
  
    setImagePreviewUrl(null);
    setCapturedImageFile(null);
    setHasCameraPermission(null); 
    resetCropperState();
  
    setIsImportDialogOpen(true);
  };
  
  const handleScanMoreItemsRequested = (listId: string, listTitle: string) => {
    if (firebaseReady && !currentUser) { 
      toast({ title: "Please Sign In", description: "You need to be signed in to scan more items.", variant: "destructive"});
      return;
    }
    setScanningForListId(listId);
    setScanningListTitle(listTitle);
  
    setImagePreviewUrl(null);
    setCapturedImageFile(null);
    setHasCameraPermission(null);
    resetCropperState();
  
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
    resetCropperState();
    setIsImportDialogOpen(false); 
    stopCameraStream();
  }, [stopCameraStream]);

  const handleExtractList = async () => {
    if (!capturedImageFile && !imagePreviewUrl) {
        toast({ title: "No Image", description: "Please capture or select an image first.", variant: "destructive" });
        return;
    }
    if (!currentUser && firebaseReady) {
      toast({ title: "Please Sign In", description: "You need to be signed in to import lists.", variant: "destructive"});
      return;
    }

    setIsProcessingImage(true);
    let finalImageFileToProcess = capturedImageFile;

    if (completedCrop && imgRef.current && (capturedImageFile || imagePreviewUrl)) {
        const fileName = capturedImageFile ? capturedImageFile.name : `cropped-image-${Date.now()}.jpg`;
        const croppedFile = await getCroppedImageFile(imgRef.current, completedCrop, fileName);
        if (croppedFile) {
            finalImageFileToProcess = croppedFile;
        } else {
            toast({ title: "Cropping Failed", description: "Could not crop the image. Using original.", variant: "destructive" });
            if (!capturedImageFile) {
                 toast({ title: "Processing Error", description: "Original image not available for fallback.", variant: "destructive" });
                 setIsProcessingImage(false);
                 return;
            }
        }
    } else if (!capturedImageFile) {
        toast({ title: "No Image File", description: "No image file available to process.", variant: "destructive" });
        setIsProcessingImage(false);
        return;
    }

    if (!finalImageFileToProcess) {
      toast({ title: "Image Error", description: "No image available for conversion.", variant: "destructive" });
      setIsProcessingImage(false);
      return;
    }

    try {
      const imageDataUri = await fileToDataUri(finalImageFileToProcess);
      const input: ExtractListFromImageInput = { imageDataUri };
      const result = await extractListFromImage(input);

      if (scanningForListId && scanningListTitle && currentUser) { 
        const existingList = activeLists.find(l => l.id === scanningForListId) || completedLists.find(l => l.id === scanningForListId);
        if (!existingList) {
            toast({ title: "List Not Found", description: `Could not find list "${scanningListTitle}" to add items to.`, variant: "destructive" });
        } else {
          let newScanUrl: string | undefined = undefined;
          try {
            newScanUrl = await uploadScanImageToFirebase(finalImageFileToProcess, currentUser.uid, scanningForListId);
            const updatedScanImageUrls = [...(existingList.scanImageUrls || []), newScanUrl];
            await updateList(scanningForListId, { scanImageUrls: updatedScanImageUrls });
          } catch (uploadError) {
             console.error("Error uploading additional scan image:", uploadError);
             toast({ title: "Image Upload Failed", description: "Items might be added, but new scan image upload failed.", variant: "destructive" });
          }

          if (result.extractedSubitems && result.extractedSubitems.length > 0) {
            const newSubitemsToAdd: Subitem[] = result.extractedSubitems
              .filter(si => si.title && si.title.trim() !== "")
              .map(si => ({
                id: crypto.randomUUID(),
                title: si.title.trim(),
                completed: false,
              }));
            
            if (newSubitemsToAdd.length > 0) {
              const combinedSubitems = [...existingList.subitems, ...newSubitemsToAdd];
              await manageSubitems(scanningForListId, combinedSubitems);
              toast({
                title: "Items Added",
                description: `${newSubitemsToAdd.length} item(s) added to "${existingList.title}".`,
                duration: 3000,
              });
            }
          }
        }
      } else { // Mode: Create new list
        if (result && result.parentListTitle) {
          const parentTitle = result.parentListTitle.trim();
          // Pass the file to addList, it will handle the upload
          const newParentList = await addList({ title: parentTitle }, finalImageFileToProcess); 
          
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
          }
        }
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
    stopCameraStream(); 

    canvas.toBlob(async (blob) => {
      if (blob) {
        const capturedFile = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setCapturedImageFile(capturedFile);
        const previewUrl = URL.createObjectURL(capturedFile);
        setImagePreviewUrl(previewUrl); 
        setHasCameraPermission(true); 
        resetCropperState();
      }
      setIsCapturing(false);
    }, 'image/jpeg', 0.9);
  };

  const handleRetakePhoto = () => {
    setImagePreviewUrl(null); 
    setCapturedImageFile(null);
    resetCropperState();
    setHasCameraPermission(null); 
  }

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    imgRef.current = e.currentTarget;
    const { naturalWidth: width, naturalHeight: height } = e.currentTarget;
    const newCrop = centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 90,
        },
        cropAspect || width / height, 
        width,
        height
      ),
      width,
      height
    );
    setCrop(newCrop);
    setCompletedCrop(undefined); 
  }


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
        onScanMoreItemsRequested={handleScanMoreItemsRequested}
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
    <div className="min-h-screen flex flex-col items-center p-4 sm:p-8 relative">
      {!currentUser && !isLoading && firebaseReady && (
         <div className="w-full max-w-2xl mt-10 flex flex-col items-center">
          <UserCircle className="mx-auto h-16 w-16 text-muted-foreground mb-6" />
          <h1 className="text-2xl font-semibold mb-2">Welcome to Listify</h1>
          <p className="text-muted-foreground mb-2 text-center">An experimental, AI-powered app for scanning, organizing, and completing lists.</p>
           <div className="flex items-center justify-center space-x-6 text-muted-foreground my-4">
            <Camera className="h-10 w-10" />
            <ListChecks className="h-10 w-10" />
            <Sparkles className="h-10 w-10" />
          </div>
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
          <div className="sticky top-0 z-10 bg-background py-4 flex justify-between items-center border-b">
            <h2 id="list-heading" className="text-2xl font-semibold text-center sm:text-left">Lists</h2>
            <div className="flex items-center space-x-2">
              <Button variant="outline" onClick={handleAddNewList} disabled={firebaseReady && !currentUser && !isLoading}>
                <Plus className="mr-2 h-4 w-4" /> Add
              </Button>
              <Dialog open={isImportDialogOpen} onOpenChange={(isOpen) => {
                setIsImportDialogOpen(isOpen);
                if (!isOpen) {
                  stopCameraStream();
                  setHasCameraPermission(null);
                  setImagePreviewUrl(null);
                  setCapturedImageFile(null);
                  resetCropperState();
                  setScanningForListId(null); 
                  setScanningListTitle(null);
                }
              }}>
                <DialogTrigger asChild>
                  <Button variant="outline" onClick={handleOpenNewScanDialog} disabled={firebaseReady && !currentUser && !isLoading}>
                    <Camera className="mr-2 h-4 w-4" />
                    Scan
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[480px]">
                  <DialogHeader>
                    <DialogTitle>
                      {scanningForListId && scanningListTitle 
                        ? `Scan More Items for "${scanningListTitle}"` 
                        : "Scan List"}
                    </DialogTitle>
                    <DialogDescription>
                      {scanningForListId
                        ? "Take a picture to add more items to this list."
                        : "Take a picture of handwriting, printed text, or physical items. The AI will create a new list based on the image content."}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-4 py-4">
                    {!imagePreviewUrl && (
                      <div className="space-y-4">
                        <div className="w-full aspect-[3/4] rounded-md overflow-hidden bg-muted flex items-center justify-center">
                          <video
                            ref={videoRef}
                            className={`w-full h-full object-cover ${!stream || !hasCameraPermission ? 'hidden' : ''}`}
                            autoPlay
                            playsInline 
                            muted
                          />
                           {!stream && hasCameraPermission === null && <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />}
                           {hasCameraPermission === false && (
                            <Alert variant="destructive" className="m-4">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertTitle>Camera Access Denied</AlertTitle>
                              <AlertDescription>
                                Please allow camera access in your browser settings to use this feature. You might need to refresh the page after granting permission.
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                        {stream && hasCameraPermission && (
                          <Button onClick={handleCaptureImage} disabled={isCapturing || !stream || isProcessingImage} className="w-full">
                            {isCapturing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                            {isCapturing ? "Capturing..." : "Capture Photo"}
                          </Button>
                        )}
                      </div>
                    )}

                    {imagePreviewUrl && !isCapturing && (
                      <div className="space-y-2">
                        <div className="border rounded-md overflow-hidden max-h-80 flex justify-center items-center bg-muted/20 aspect-[3/4] mx-auto">
                          <ReactCrop
                            crop={crop}
                            onChange={(_, percentCrop) => setCrop(percentCrop)}
                            onComplete={(c) => setCompletedCrop(c)}
                            aspect={cropAspect}
                            minHeight={50}
                            minWidth={50}
                          >
                            <img
                              ref={imgRef}
                              alt="Scan preview"
                              src={imagePreviewUrl}
                              onLoad={onImageLoad}
                              style={{ maxHeight: '320px', objectFit: 'contain' }}
                              data-ai-hint="handwritten list"
                            />
                          </ReactCrop>
                        </div>
                        <Button onClick={handleRetakePhoto} variant="outline" className="w-full" disabled={isProcessingImage || isCapturing}>
                          <RefreshCw className="mr-2 h-4 w-4" /> Retake Photo
                        </Button>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline" disabled={isProcessingImage || isCapturing} onClick={() => {
                          stopCameraStream(); 
                      }}>Cancel</Button>
                    </DialogClose>
                    { (capturedImageFile || imagePreviewUrl) && !isCapturing && (
                      <Button onClick={handleExtractList} disabled={isProcessingImage}>
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
                    <DropdownMenuItem onClick={handleOpenNewScanDialog} disabled={!currentUser && firebaseReady}>
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
                key={viewingScanUrls[currentScanIndex]} // Force re-render on image change
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
