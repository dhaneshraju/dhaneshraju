import React, { useEffect, useRef } from 'react';

export default function MicSpectralAnalyzer({ micActive }) {
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const sourceRef = useRef(null);
  const animationIdRef = useRef(null);
  const ACTIVE_COLOR = '#22d3ee';

  useEffect(() => {
    if (!micActive) {
      // Clear canvas or draw flat line
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // ctx.fillStyle = '#333';
      ctx.fillStyle = ACTIVE_COLOR;
      ctx.fillRect(0, canvas.height / 2, canvas.width, 2); // flat line
      return;
    }

    // Start audio context and analyser when mic is active
    const startAnalyzing = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContextRef.current = new AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        const bufferLength = analyserRef.current.frequencyBinCount;
        dataArrayRef.current = new Uint8Array(bufferLength);

        sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
        sourceRef.current.connect(analyserRef.current);

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        const draw = () => {
          animationIdRef.current = requestAnimationFrame(draw);
          analyserRef.current.getByteFrequencyData(dataArrayRef.current);

          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          const barWidth = (canvas.width / bufferLength) * 2.5;
          let barHeight;
          let x = 0;

          for (let i = 0; i < bufferLength; i++) {
            barHeight = dataArrayRef.current[i] / 2;

            ctx.fillStyle = ACTIVE_COLOR;
            // ctx.fillStyle = `rgb(${barHeight + 100},50,150)`;
            ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

            x += barWidth + 1;
          }
        };

        draw();
      } catch (err) {
        console.error('Error accessing microphone:', err);
      }
    };

    startAnalyzing();

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [micActive]);

  return (
    <div className="spectral-analyzer-container mb-4">
      <canvas
        ref={canvasRef}
        width={128}
        height={32}
        className="w-32 h-8"
        style={{
          backgroundColor: 'transparent',
        }}
      />
    </div>
  );
}