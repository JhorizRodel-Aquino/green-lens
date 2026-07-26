import { useRef, useEffect, useState } from 'react';
import { X, Repeat, CameraOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CameraComponent, type CameraComponentHandles } from 'react-camera-component';

export default function ReportCamera({ onClose }: { onClose: () => void }) {
  const cameraRef = useRef<CameraComponentHandles>(null);
  const [error, setError] = useState<string | null>(null);

  // Cleanup function to stop the camera stream
  const stopCamera = () => {
    cameraRef.current?.stopStream();
  };

  // Start the stream ourselves (autoPlayOnStart disabled below), deferred by
  // one tick. React StrictMode's dev-only double effect invoke (effect ->
  // cleanup -> effect) runs synchronously in the same tick, so the throwaway
  // first pass's timer gets cleared before it ever calls getUserMedia —
  // only the real, surviving mount actually requests the camera, exactly
  // once. Without this, two concurrent getUserMedia calls to the same
  // device either collide with a hardware error or leave one of the two
  // streams orphaned with its LED stuck on.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) cameraRef.current?.startStream();
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      stopCamera();
    };
  }, []);

  const handleCapture = () => {
    cameraRef.current?.captureImage();
  };

  const handleSwitch = () => {
    cameraRef.current?.switchCamera();
  };

  const handleError = (err: Error) => {
    console.error(err);
    setError(
      err.name === 'NotAllowedError'
        ? "Camera access is blocked. Enable it in your browser's site settings, then reopen this."
        : `Couldn't access the camera: ${err.message}`
    );
  };

  const handleClose = () => {
    stopCamera(); // Stop camera first
    onClose(); // Then close the modal
  };

  return (
    <div className="relative w-full h-full bg-black">
      <CameraComponent
        ref={cameraRef}
        autoPlayOnStart={false}
        onCapture={(media) => {
          console.log('Captured!', media);
        }}
        onError={handleError}
        facingMode="environment"
        imageFormat="image/jpeg"
        imageQuality={0.95}
      />
      
      {/* Close Button - Top Left */}
      <Button
        icon={X}
        size="icon"
        variant="ghost"
        onClick={handleClose} // Use handleClose instead of onClose directly
        className="absolute top-5 left-5 bg-white/30 backdrop-blur-md hover:bg-white/40 transition-all text-white"
      />

      {error ? (
        /* Error state - camera couldn't start (blocked permission, no device, etc.) */
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center bg-black/80">
          <CameraOff className="w-10 h-10 text-white/70" />
          <p className="text-white text-sm max-w-xs">{error}</p>
          <Button variant="ghost" onClick={handleClose} className="text-white border border-white/30 hover:bg-white/10">
            Close
          </Button>
        </div>
      ) : (
        <>
          {/* Flip Button - Top Right */}
          <Button
            icon={Repeat}
            size="icon"
            variant="ghost"
            onClick={handleSwitch}
            className="absolute top-5 right-5 bg-white/30 backdrop-blur-md hover:bg-white/40 transition-all text-white"
          />

          {/* Capture Button - Bottom Center */}
          <button
            onClick={handleCapture}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[72px] h-[72px] rounded-full bg-white border-4 border-white/50 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
          >
            <div className="w-[60px] h-[60px] rounded-full bg-white border-2 border-gray-700" />
          </button>
        </>
      )}
    </div>
  );
}