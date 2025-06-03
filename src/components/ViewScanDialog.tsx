
"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react";

interface ViewScanDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  imageUrls: string[] | null;
}

const ViewScanDialog: React.FC<ViewScanDialogProps> = ({
  isOpen,
  onOpenChange,
  imageUrls,
}) => {
  const [currentScanIndex, setCurrentScanIndex] = useState(0);
  const [scanZoomLevel, setScanZoomLevel] = useState(1);

  useEffect(() => {
    if (!isOpen) {
      // Reset internal state when dialog closes or is about to close
      setCurrentScanIndex(0);
      setScanZoomLevel(1);
    } else if (isOpen && imageUrls && imageUrls.length > 0) {
      // Reset when dialog opens (or re-opens with new images)
      setCurrentScanIndex(0);
      setScanZoomLevel(1);
    }
  }, [isOpen, imageUrls]);


  const handleZoomIn = () => setScanZoomLevel(prev => Math.min(prev + 0.2, 3));
  const handleZoomOut = () => setScanZoomLevel(prev => Math.max(prev - 0.2, 0.5));

  const handleNextScan = () => {
    if (imageUrls && currentScanIndex < imageUrls.length - 1) {
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
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md md:max-w-lg lg:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Scanned Image
            {imageUrls && imageUrls.length > 1 && (
              <span className="text-sm text-muted-foreground ml-2">
                ({currentScanIndex + 1} of {imageUrls.length})
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        {imageUrls && imageUrls[currentScanIndex] && (
          <div className="mt-4 flex justify-center items-center max-h-[70vh] overflow-auto bg-muted/10 p-2 rounded-md">
            <Image
              key={imageUrls[currentScanIndex]} 
              src={imageUrls[currentScanIndex]}
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
          {imageUrls && imageUrls.length > 1 && (
            <div className="flex items-center space-x-2">
              <Button onClick={handlePrevScan} variant="outline" size="icon" disabled={currentScanIndex === 0} aria-label="Previous scan">
                <ChevronLeft />
              </Button>
              <Button onClick={handleNextScan} variant="outline" size="icon" disabled={currentScanIndex === imageUrls.length - 1} aria-label="Next scan">
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
  );
};

export default ViewScanDialog;

