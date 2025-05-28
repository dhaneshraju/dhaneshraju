import React, { useEffect, useRef } from "react";

export default function MicrophoneListener({ onVolumeChange, onSpeakingChange }) {
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const sourceRef = useRef(null);
  const rafIdRef = useRef(null);

  useEffect(() => {
    async function setupMic() {
      try {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        const bufferLength = analyserRef.current.frequencyBinCount;
        dataArrayRef.current = new Uint8Array(bufferLength);

        sourceRef.current.connect(analyserRef.current);

        const detectVolume = () => {
          analyserRef.current.getByteFrequencyData(dataArrayRef.current);
          let sum = 0;
          for (let i = 0; i < dataArrayRef.current.length; i++) {
            sum += dataArrayRef.current[i];
          }
          const average = sum / dataArrayRef.current.length;
          onVolumeChange(average);

          // Heuristic speaking detection threshold
          onSpeakingChange(average > 20);

          rafIdRef.current = requestAnimationFrame(detectVolume);
        };

        detectVolume();
      } catch (err) {
        console.error("Error accessing microphone:", err);
      }
    }

    setupMic();

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, [onVolumeChange, onSpeakingChange]);

  return null; // No visible UI
}
