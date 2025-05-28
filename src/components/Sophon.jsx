
import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Edges,
  Stars,
  OrbitControls,
  Float,
} from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { Vector3 } from "three";

// 📷 Zoom tracker for UI fading
function ZoomTracker({ onZoomChange }) {
  const { camera } = useThree();
  const lastZoom = useRef(camera.position.length());

  useFrame(() => {
    const currentZoom = camera.position.length();
    if (Math.abs(currentZoom - lastZoom.current) > 1) {
      lastZoom.current = currentZoom;
      onZoomChange(currentZoom);
    }
  });

  return null;
}

// 🧠 Neural Network Component
function NeuralNetwork({ speaking, volume, visible = true }) {
  const neuronsRef = useRef();
  const connectionsRef = useRef();
  const originalPositions = useRef(null);
  const [activeLayer, setActiveLayer] = useState(-1);
  const animationTimeRef = useRef(0);
  const groupRef = useRef();
  
  // Update visibility using opacity
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.visible = visible;
    }
  }, [visible]);

  const layerColors = {
    0: "#00ffff",
    1: "#00ffff",
    2: "#00ffff"
  };

  const neurons = useMemo(() => {
    const points = [];
    const layerCount = 3;
    const neuronsPerLayer = 175;
    const baseRadius = 23;
    const goldenRatio = (1 + Math.sqrt(5)) / 2;

    for (let layer = 0; layer < layerCount; layer++) {
      const layerRadius = baseRadius * (0.4 + layer * 0.2);
      for (let i = 0; i < neuronsPerLayer; i++) {
        const t = i / neuronsPerLayer;
        const inclination = Math.acos(1 - 2 * t);
        const azimuth = 2 * Math.PI * goldenRatio * i;
        const point = new Vector3(
          layerRadius * Math.sin(inclination) * Math.cos(azimuth),
          layerRadius * Math.sin(inclination) * Math.sin(azimuth),
          layerRadius * Math.cos(inclination)
        );
        points.push({ point, layer });
      }
    }

    originalPositions.current = points.map(({ point }) => point.clone());
    return points;
  }, []);

  const connections = useMemo(() => {
    const lines = [];
    for (let i = 0; i < neurons.length; i++) {
      for (let j = i + 1; j < neurons.length; j++) {
        if (
          Math.abs(neurons[i].layer - neurons[j].layer) <= 1 &&
          neurons[i].point.distanceTo(neurons[j].point) < 15
        ) {
          lines.push({
            points: [neurons[i].point, neurons[j].point],
            layer: neurons[i].layer,
          });
        }
      }
    }
    return lines;
  }, [neurons]);

  useFrame(({ clock }) => {
    if (speaking) {
      animationTimeRef.current = (animationTimeRef.current + 10) % 300;
      const currentLayer = Math.floor(animationTimeRef.current / 100);
      setActiveLayer(currentLayer);
    }

    const amplitude = speaking ? volume * 0.3 : 0.02;

    neurons.forEach(({ point, layer }, i) => {
      const original = originalPositions.current[i];
      const t = clock.elapsedTime + i * 100;

      point.copy(original);

      if (speaking && layer === activeLayer) {
        const layerOffset = layer * 0.2;
        point.x += Math.sin(t * 0.002 + layerOffset) * amplitude;
        point.y += Math.cos(t * 0.002 + layerOffset) * amplitude;
        point.z += Math.sin(t * 0.003 + layerOffset) * amplitude;
      }

      const distance = point.length();
      if (distance > 25) {
        point.normalize().multiplyScalar(25);
      }
    });

    if (neuronsRef.current) {
      neuronsRef.current.geometry.attributes.position.needsUpdate = true;
    }
    if (connectionsRef.current) {
      connectionsRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  useEffect(() => {
    if (!speaking) {
      animationTimeRef.current = 0;
      setActiveLayer(-1);
    }
  }, [speaking]);

  return (
    <group ref={groupRef}>
      {[0, 1, 2].map(layer => (
        <points key={`layer-${layer}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={neurons.filter(n => n.layer === layer).length}
              array={new Float32Array(
                neurons
                  .filter(n => n.layer === layer)
                  .flatMap(({ point }) => [point.x, point.y, point.z])
              )}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial
            size={0.3}
            color={speaking && activeLayer === layer ? layerColors[layer] : "#ffffff"}
            transparent
            opacity={speaking && activeLayer === layer ? 0.8 : 0.4}
            sizeAttenuation
            emissive={speaking && activeLayer === layer ? layerColors[layer] : "#ffffff"}
            emissiveIntensity={1}
          />
        </points>
      ))}

      <lineSegments ref={connectionsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={connections.length * 2}
            array={new Float32Array(connections.flatMap(({ points: [a, b] }) => [
              a.x, a.y, a.z, b.x, b.y, b.z
            ]))}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.1}
          emissive="#ffffff"
          emissiveIntensity={0.5}
        />
      </lineSegments>
    </group>
  );
}

// 🔊 Microphone Listener Component
function MicrophoneListener({ onVolumeChange, onSpeakingChange }) {
  useEffect(() => {
    let audioContext, analyser, microphone, dataArray, rafId;
    let speaking = false;

    async function initMic() {
      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        microphone = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        microphone.connect(analyser);
        dataArray = new Uint8Array(analyser.frequencyBinCount);

        const update = () => {
          analyser.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          const volume = Math.min(1, (avg / 128) ** 1.5);
          onVolumeChange(volume);

          const nowSpeaking = volume > 0.05;
          if (nowSpeaking !== speaking) {
            speaking = nowSpeaking;
            onSpeakingChange(speaking);
          }

          rafId = requestAnimationFrame(update);
        };

        update();
      } catch (err) {
        console.warn("Microphone error:", err);
      }
    }

    initMic();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (audioContext) audioContext.close();
    };
  }, [onVolumeChange, onSpeakingChange]);

  return null;
}

// 🧊 Core Mesh Component
function SophonCore({ volume, speaking }) {
  const meshRef = useRef();
  const edgesRef = useRef();
  const { camera } = useThree();
  const [isClose, setIsClose] = useState(false);
  const lastUpdate = useRef(0);

  useFrame(({ clock }) => {
    // Update visibility based on camera distance (throttled)
    const now = Date.now();
    if (camera && now - lastUpdate.current > 100) {
      const distance = camera.position.length();
      setIsClose(distance < 500);
      lastUpdate.current = now;
    }

    if (meshRef.current) {
      const scale = 1 + (speaking ? volume * 0.2 : 0);
      meshRef.current.scale.setScalar(scale);
    }

    if (edgesRef.current) {
      edgesRef.current.material.linewidth = 1 + volume * 5;
      if (speaking) {
        const hue = (clock.elapsedTime * 50) % 360;
        edgesRef.current.material.color.setHSL(hue / 360, 1, 0.6);
      } else {
        edgesRef.current.material.color.set("#00ffff");
      }
    }
  });

  return (
    <group>
      {/* Skull (opaque outer shell) */}
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[60, 0]} />
        <meshPhysicalMaterial
          color="#1a1f2e"
          metalness={0.8}
          roughness={0.3}
          clearcoat={0.5}
          clearcoatRoughness={0.3}
          transparent={false}
          opacity={1}
          transmission={0}
          ior={1.5}
          thickness={0}
          emissive="#0a0f1a"
          emissiveIntensity={0.2}
        />
        <Edges ref={edgesRef} scale={1.02} color="#00ffff" lineWidth={1.5} />
      </mesh>
      
      {/* Brain (neural network) - Only visible when zoomed in */}
      <group scale={0.8} position={[0, 0, 0]}>
        <NeuralNetwork speaking={speaking} volume={volume} visible={isClose} />
      </group>
    </group>
  );
}

// 🌌 Stars Controller Component
function StarsController({ cursor }) {
  const group = useRef();
  useFrame(() => {
    if (group.current) {
      group.current.rotation.x = cursor.y * 0.1;
      group.current.rotation.y = cursor.x * 0.1;
    }
  });

  return <group ref={group} />;
}

// 🌟 Main Sophon Component
export default function Sophon({ active, onZoomChange, isAISpeaking }) {
  const [volume, setVolume] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [showZoomHint, setShowZoomHint] = useState(true);
  
  useEffect(() => {
    // Hide the hint after 3 seconds
    const timer = setTimeout(() => {
      setShowZoomHint(false);
    }, 3000);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Combine user speaking and AI speaking states
  const isSpeaking = speaking || isAISpeaking;

  useEffect(() => {
    const handleMouseMove = (e) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;
      setCursor({ x, y });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const handleVolumeChange = useCallback((vol) => setVolume(vol), []);
  const handleSpeakingChange = useCallback((isSpeaking) => setSpeaking(isSpeaking), []);

  return (
    <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0 }}>
      <Canvas
        gl={{ alpha: true }}
        style={{ width: "100%", height: "100%", background: "transparent" }}
        camera={{ position: [0, 0, 1100], fov: 75 }}
      >
        <ambientLight intensity={0.4} />
        <pointLight position={[0, 200, 200]} intensity={2} color="#ffffff" />

        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <StarsController cursor={cursor} />

        <Float speed={1.5} rotationIntensity={0.5} floatIntensity={3}>
          <SophonCore volume={isAISpeaking ? 0.3 : volume} speaking={isSpeaking} />
        </Float>

        <ZoomTracker onZoomChange={onZoomChange} />

        <OrbitControls
          enablePan={true}
          enableRotate={true}
          enableZoom={true}
          autoRotate
          autoRotateSpeed={1.5}
          minDistance={2}
          maxDistance={800}
        />

        <EffectComposer>
          <Bloom luminanceThreshold={0.3} intensity={0.9} />
        </EffectComposer>
      </Canvas>

      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 z-10 w-[60vw] h-[70vh] pointer-events-none">
        <div className="w-full h-full bg-gradient-to-b from-white/20 via-cyan-300/10 to-transparent blur-3xl rounded-full opacity-50" />
      </div>

      {active && (
        <MicrophoneListener
          onVolumeChange={handleVolumeChange}
          onSpeakingChange={handleSpeakingChange}
        />
      )}
      
      {showZoomHint && (
        <div className="absolute top-[15%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
          <div className="relative group">
            {/* Main container with gradient border */}
            <div className="relative bg-gradient-to-r from-cyan-500/10 to-blue-500/10 backdrop-blur-lg p-0.5 rounded-full overflow-hidden">
              {/* Animated gradient border */}
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/40 via-blue-500/40 to-purple-500/40 animate-hue-rotate opacity-70 rounded-full"></div>
              
              {/* Content */}
              <div className="relative bg-gray-900/90 px-6 py-3 rounded-full flex items-center justify-center space-x-2">
                {/* Animated scanning line */}
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-cyan-400/0 via-cyan-400 to-cyan-400/0 animate-scan"></div>
                
                {/* Text with gradient */}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-300 font-medium text-sm tracking-wide">
                  ZOOM TO EXPLORE CORE
                </span>
                
                {/* Animated chevrons */}
                <div className="flex flex-col -space-y-1.5">
                  <svg className="w-3 h-3 text-cyan-300 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  <svg className="w-3 h-3 text-blue-300 animate-bounce animation-delay-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
            
            {/* Glow effect */}
            <div className="absolute -inset-1 bg-cyan-400/20 rounded-full blur opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </div>
        </div>
      )}
    </div>
  );
}
