
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { User } from "firebase/auth";
import Image from "next/image";
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
import { Input } from "@/components/ui/input";
import { Loader2, Upload, RefreshCw, AlertTriangle, ImageUp } from "lucide-react";

import type { List, Subitem } from "@/types/list";
import { extractListFromImage, type ExtractListFromImageInput } from "@/ai/flows/extractListFromImageFlow";
import { uploadScanImageToFirebase } from "@/lib/firebase";

interface UploadImageDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  currentUser: User | null;
  firebaseReady: boolean;
  addList: (
    listData: Omit<List, "id" | "completed" | "subitems" | "createdAt" | "userId" | "scanImageUrls" | "shareId">,
    uploadedImageFile?: File | null
  ) => Promise<List | undefined>;
  manageSubitems: (listId: string, newSubitems: Subitem[]) => Promise<void>;
  toast: (options: { title: string; description?: string; variant?: "default" | "destructive"; duration?: number }) => void;
  setListToFocusId: (id: string | null) => void;
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


export default function UploadImageDialog({
  isOpen,
  onOpenChange,
  currentUser,
  firebaseReady,
  addList,
  manageSubitems,
  toast,
  setListToFocusId,
}: UploadImageDialogProps) {
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const [cropAspect, setCropAspect] = useState<number | undefined>(undefined); // undefined for free aspect ratio

  const resetCropperState = () => {
    setCrop(undefined);
    setCompletedCrop(undefined);
  };

  const resetUploadDataStates = useCallback(() => {
    setIsProcessingImage(false);
    setSelectedImageFile(null);
    setImagePreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // Clear the file input
    }
    resetCropperState();
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetUploadDataStates();
    }
  }, [isOpen, resetUploadDataStates]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      setSelectedImageFile(file);
      resetCropperState();
      try {
        const dataUri = await fileToDataUri(file);
        setImagePreviewUrl(dataUri);
      } catch (error) {
        console.error("Error converting file to data URI:", error);
        toast({ title: "File Error", description: "Could not preview the selected image.", variant: "destructive" });
        resetUploadDataStates();
      }
    } else {
      resetUploadDataStates();
    }
  };

  const handleExtractList = async () => {
    if (!selectedImageFile) {
      toast({ title: "No Image Selected", description: "Please select an image file first.", variant: "destructive" });
      return;
    }

    setIsProcessingImage(true);
    let finalImageFileToProcess = selectedImageFile;

    if (completedCrop && imgRef.current) {
      const croppedFile = await getCroppedImageFile(imgRef.current, completedCrop, selectedImageFile.name);
      if (croppedFile) {
        finalImageFileToProcess = croppedFile;
      } else {
        toast({ title: "Cropping Failed", description: "Could not crop the image. Using original.", variant: "destructive" });
      }
    }

    try {
      const imageDataUri = await fileToDataUri(finalImageFileToProcess);
      const input: ExtractListFromImageInput = { imageDataUri };
      const result = await extractListFromImage(input);

      if (result && result.parentListTitle) {
        const parentTitle = result.parentListTitle.trim();
        // Pass the final (potentially cropped) image file to addList
        const newParentList = await addList({ title: parentTitle }, currentUser ? finalImageFileToProcess : null);

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
          if (!currentUser && firebaseReady && finalImageFileToProcess) {
            toast({ title: "Sign In to Save Image", description: "List created locally. Sign in to save the uploaded image with your list.", duration: 5000 });
          }
          toast({ title: "List Created!", description: `"${newParentList.title}" created from your image.` });
        } else {
          toast({ title: "List Creation Failed", description: "Could not save the new list.", variant: "destructive" });
        }
      } else {
         toast({ title: "AI Processing Failed", description: "Could not understand the image to create a list.", variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Error extracting list from uploaded image:", error);
      let errorMsg = "An unexpected error occurred while processing the image.";
       if (error.message && error.message.includes("GEMINI_API_KEY")) {
        errorMsg = "AI processing failed. Check API key configuration.";
      } else if (error.message) {
        errorMsg = `AI processing error: ${error.message.substring(0,100)}${error.message.length > 100 ? '...' : ''}`;
      }
      toast({ title: "Import Error", description: errorMsg, variant: "destructive" });
    } finally {
      setIsProcessingImage(false);
      onOpenChange(false); // Close dialog after processing
    }
  };

  const handleChooseDifferentFile = () => {
    resetUploadDataStates();
    fileInputRef.current?.click(); // Re-open file picker
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
        cropAspect || width / height, // Use aspect or derive from image if not set
        width,
        height
      ),
      width,
      height
    );
    setCrop(newCrop);
    setCompletedCrop(undefined); // Clear completed crop when new image loads or crop changes
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Upload Image for List</DialogTitle>
          <DialogDescription>
            Select an image file. The AI will try to create a list from its content.
            {!currentUser && firebaseReady && " Images uploaded while not signed in are not saved with the list."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {!imagePreviewUrl ? (
            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-muted rounded-md space-y-3">
              <ImageUp className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Drag & drop or click to select an image</p>
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden" 
              />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isProcessingImage}>
                <Upload className="mr-2 h-4 w-4" /> Select Image
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="border rounded-md overflow-hidden max-h-80 flex justify-center items-center bg-muted/20 aspect-[4/3] mx-auto">
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
                    alt="Upload preview"
                    src={imagePreviewUrl}
                    onLoad={onImageLoad}
                    style={{ maxHeight: '320px', objectFit: 'contain' }}
                    data-ai-hint="uploaded image"
                  />
                </ReactCrop>
              </div>
              <Button onClick={handleChooseDifferentFile} variant="outline" className="w-full" disabled={isProcessingImage}>
                <RefreshCw className="mr-2 h-4 w-4" /> Choose Different File
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isProcessingImage}>Cancel</Button>
          </DialogClose>
          {selectedImageFile && imagePreviewUrl && (
            <Button onClick={handleExtractList} disabled={isProcessingImage}>
              {isProcessingImage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Recognize List
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

