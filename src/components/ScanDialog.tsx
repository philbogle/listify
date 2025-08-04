
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { User } from "firebase/auth";
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Camera, RefreshCw, AlertTriangle } from "lucide-react";

import type { List, Subitem } from "@/types/list";
import { extractListFromImage, type ExtractListFromImageInput } from "@/ai/flows/extractListFromImageFlow";

interface ScanDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  currentUser: User | null;
  addList: (
    listData: Omit<List, "id" | "completed" | "subitems" | "createdAt" | "userId" | "shareId">
  ) => Promise<List | undefined>;
  updateList: (listId: string, updates: Partial<List>) => Promise<void>;
  manageSubitems: (listId: string, newSubitems: Subitem[]) => Promise<void>;
  activeLists: List[];
  completedLists: List[];
  toast: (options: { title: string; description?: string; variant?: "default" | "destructive"; duration?: number }) => void;
  setListToFocusId: (id: string | null) => void;
  initialListId: string | null;
  initialListTitle: string | null;
}

const fileToDataUri = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

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


export default function ScanDialog({
  isOpen,
  onOpenChange,
  currentUser,
  addList,
  updateList,
  manageSubitems,
  activeLists,
  completedLists,
  toast,
  setListToFocusId,
  initialListId,
  initialListTitle,
}: ScanDialogProps) {
  const [capturedImageFile, setCapturedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const [cropAspect, setCropAspect] = useState<number | undefined>(undefined);

  const prevIsOpenRef = useRef(isOpen);

  const resetCropperState = () => {
    setCrop(undefined);
    setCompletedCrop(undefined);
  };

  const resetScanDataStates = useCallback(() => {
    setIsProcessingImage(false);
    setCapturedImageFile(null);
    setImagePreviewUrl(null);
    resetCropperState();
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

  const getCameraPermission = useCallback(async () => {
    if (imagePreviewUrl) {
      if (stream) stopCameraStream();
      return;
    }
    if (hasCameraPermission === false) return;

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
  }, [imagePreviewUrl, hasCameraPermission, stream, stopCameraStream, toast]);

  useEffect(() => {
    const wasOpen = prevIsOpenRef.current;

    if (isOpen && !wasOpen) { // Dialog just transitioned from closed to open
      resetScanDataStates();
      setHasCameraPermission(null); // Force re-evaluation of camera state/permission
    }

    if (isOpen) {
      if (hasCameraPermission === null) {
        getCameraPermission();
      } else if (hasCameraPermission === true && !stream && !imagePreviewUrl) {
        getCameraPermission();
      }
    } else { // isOpen is false (dialog is closing or closed)
      if (stream) {
        stopCameraStream();
      }
    }

    prevIsOpenRef.current = isOpen; // Update for the next render cycle
  }, [
    isOpen,
    hasCameraPermission,
    stream,
    imagePreviewUrl,
    resetScanDataStates,
    getCameraPermission,
    stopCameraStream,
  ]);


  const handleExtractList = async () => {
    if (!capturedImageFile && !imagePreviewUrl) {
      toast({ title: "No Image", description: "Please capture or select an image first.", variant: "destructive" });
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

      if (initialListId && initialListTitle) {
        const existingList = activeLists.find(l => l.id === initialListId) || completedLists.find(l => l.id === initialListId);
        if (!existingList) {
          toast({ title: "List Not Found", description: `Could not find list "${initialListTitle}" to add items to.`, variant: "destructive" });
        } else {
          if (result.extractedSubitems && result.extractedSubitems.length > 0) {
            const newSubitemsToAdd: Subitem[] = result.extractedSubitems
              .filter(si => si.title && si.title.trim() !== "")
              .map(si => ({
                id: crypto.randomUUID(),
                title: si.title.trim(),
                completed: false,
                isHeader: !!si.isHeader,
              }));

            if (newSubitemsToAdd.length > 0) {
              const combinedSubitems = [...existingList.subitems, ...newSubitemsToAdd];
              await manageSubitems(initialListId, combinedSubitems);
              toast({
                title: "Items Added",
                description: `${newSubitemsToAdd.length} item(s) added to "${existingList.title}".`,
                duration: 3000,
              });
            }
          }
        }
      } else {
        if (result && result.parentListTitle) {
          const parentTitle = result.parentListTitle.trim();
          const newParentList = await addList({ title: parentTitle });

          if (newParentList && newParentList.id) {
            setListToFocusId(newParentList.id);
            if (result.extractedSubitems && result.extractedSubitems.length > 0) {
              const subitemsToAdd: Subitem[] = result.extractedSubitems
                .filter(si => si.title && si.title.trim() !== "")
                .map(si => ({
                  id: crypto.randomUUID(),
                  title: si.title.trim(),
                  completed: false,
                  isHeader: !!si.isHeader,
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
      setIsProcessingImage(false); 
      onOpenChange(false); 
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
    stopCameraStream(); // Stop the live feed after capturing

    canvas.toBlob(async (blob) => {
      if (blob) {
        const capturedFile = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setCapturedImageFile(capturedFile);
        const previewUrl = URL.createObjectURL(capturedFile);
        setImagePreviewUrl(previewUrl);
        resetCropperState();
      }
      setIsCapturing(false);
    }, 'image/jpeg', 0.9);
  };

  const handleRetakePhoto = () => {
    setImagePreviewUrl(null);
    setCapturedImageFile(null);
    resetCropperState();

    if (stream) {
      stopCameraStream();
    }
    setHasCameraPermission(null);
  };

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


  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {initialListId && initialListTitle
              ? `Scan More Items for "${initialListTitle}"`
              : "Scan"}
          </DialogTitle>
          <DialogDescription>
            {initialListId
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
            <Button variant="outline" disabled={isProcessingImage || isCapturing}>Cancel</Button>
          </DialogClose>
          {(capturedImageFile || imagePreviewUrl) && !isCapturing && (
            <Button onClick={handleExtractList} disabled={isProcessingImage}>
              {isProcessingImage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Recognize List
            </Button>
          )}
        </DialogFooter>
        <canvas ref={canvasRef} className="hidden"></canvas>
      </DialogContent>
    </Dialog>
  );
}
