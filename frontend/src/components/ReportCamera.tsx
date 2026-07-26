import { useRef } from 'react';
import { CameraComponent, type CameraComponentHandles } from 'react-camera-component';

export default function ReportCamera({ onClose }: { onClose: () => void }) {
  const cameraRef = useRef<CameraComponentHandles>(null);

  const handleCapture = () => {
    cameraRef.current?.captureImage();
  };

  const handleSwitch = () => {
    cameraRef.current?.switchCamera();
  };

  const handleError = (error: Error) => {
    console.error(error);
  };

  return (
    <div className="relative w-full h-full bg-black">
      <CameraComponent
        ref={cameraRef}
        onCapture={(media) => {
          console.log('Captured!', media);
          // Optionally close after capture
          // onClose();
        }}
        onError={handleError}
        facingMode="environment"
        imageFormat="image/jpeg"
        imageQuality={0.95}
      />
      
      {/* Close button - Top Left */}
      <button
        onClick={onClose}
        className="absolute top-5 left-5 w-12 h-12 rounded-full bg-white/30 backdrop-blur-md text-white text-2xl flex items-center justify-center hover:bg-white/40 transition-all"
      >
        ✕
      </button>

      {/* Flip Button - Top Right */}
      <button
        onClick={handleSwitch}
        className="absolute top-5 right-5 w-12 h-12 rounded-full bg-white/30 backdrop-blur-md text-white text-2xl flex items-center justify-center hover:bg-white/40 transition-all"
      >
        🔄
      </button>

      {/* Capture Button - Bottom Center */}
      <button
        onClick={handleCapture}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[72px] h-[72px] rounded-full bg-white border-4 border-white/50 cursor-pointer flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform"
      >
        <div className="w-[60px] h-[60px] rounded-full bg-white border-2 border-gray-700" />
      </button>
    </div>
  );
}