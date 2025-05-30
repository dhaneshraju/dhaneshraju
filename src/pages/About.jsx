import React, { useState, useEffect, useRef, Suspense, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Sphere, Text } from '@react-three/drei';
import { Github, Linkedin, Twitter, Mail, ExternalLink, Code, Book, Brain, PanelTop, Server, Cpu } from 'lucide-react';
import { gsap } from 'gsap';
import DynamicMusicPlayer from '../components/DynamicMusicPlayer';
import './AboutPage.css';
import defaultProfileImage from '../assets/dhanesh.jpg'; // Update path to your default image
import * as THREE from 'three';
import { useNavigate } from 'react-router-dom';
// import emailjs from 'emailjs-com';


// AI Engineer Profile Image URL
const profileImage = '/profile-image.jpg' || defaultProfileImage;
 // Place your image in public folder
// Add this before the AboutPage component


// const handleFormSubmit = async (e) => {
//   e.preventDefault();

//   try {
//     await emailjs.sendForm(
//       'service_voqs9y6',     // from EmailJS dashboard
//       'template_8tfhxnm',    // template with name, email, message
//       e.target,
//       'DAMpbWwvA2N3hI9Kg'         // public key
//     );

//     console.log('Form submitted');
//     setContactFormOpen(true); // show confirmation popup/modal
//   } catch (error) {
//     console.error('EmailJS error:', error);
//   }
// };
// Skill Data
const skillsData = [
  // 🔹 AI Core
  { name: "Deep Learning", level: 0.9, category: "AI Core", color: "#00FFFF" },
  { name: "NLP", level: 0.85, category: "AI Core", color: "#00FFFF" },
  { name: "Computer Vision", level: 0.8, category: "AI Core", color: "#00FFFF" },
  { name: "Explainable AI", level: 0.75, category: "AI Core", color: "#00FFFF" },
  { name: "Signal Processing", level: 0.7, category: "AI Core", color: "#00FFFF" },

  // 🔸 AI Frameworks
  { name: "PyTorch", level: 0.85, category: "AI Framework", color: "#FF4500" },
  { name: "TensorFlow", level: 0.9, category: "AI Framework", color: "#FF4500" },
  { name: "Scikit-learn", level: 0.85, category: "AI Framework", color: "#FF4500" },
  { name: "Keras", level: 0.85, category: "AI Framework", color: "#FF4500" },

  // 🧠 LLM Tools
  { name: "Langchain", level: 0.8, category: "LLM Tools", color: "#ADFF2F" },
  { name: "RAG", level: 0.75, category: "LLM Tools", color: "#ADFF2F" },
  { name: "spaCy", level: 0.75, category: "LLM Tools", color: "#ADFF2F" },
  { name: "NLTK", level: 0.7, category: "LLM Tools", color: "#ADFF2F" },

  // 🎨 Frontend / Visualization
  { name: "React", level: 0.85, category: "Frontend", color: "#1E90FF" },
  { name: "Three.js", level: 0.75, category: "Frontend", color: "#1E90FF" },

  // 💻 Programming Languages
  { name: "Python", level: 0.95, category: "Languages", color: "#FFD700" },
  { name: "JavaScript", level: 0.85, category: "Languages", color: "#FFD700" },
  { name: "C++", level: 0.75, category: "Languages", color: "#FFD700" },
  { name: "SQL", level: 0.7, category: "Languages", color: "#FFD700" },

  // ⚙️ DevOps / Workflow
  { name: "MLOps", level: 0.8, category: "DevOps", color: "#9932CC" },
  { name: "Docker", level: 0.75, category: "DevOps", color: "#9932CC" },
  { name: "MLflow", level: 0.7, category: "DevOps", color: "#9932CC" },
  { name: "Git", level: 0.85, category: "DevOps", color: "#9932CC" },

  // 🧩 Hardware & Performance
  { name: "CUDA", level: 0.7, category: "Hardware", color: "#32CD32" },
  { name: "GPU Acceleration", level: 0.8, category: "Hardware", color: "#32CD32" },
  { name: "HPC Clusters", level: 0.65, category: "Hardware", color: "#32CD32" },
  { name: "Parallel Computing", level: 0.6, category: "Hardware", color: "#32CD32" },

  { name: "Diffusion Models", level: 0.4, category: "Exploring", color: "#FF69B4" },
  { name: "TensorRT", level: 0.5, category: "Exploring", color: "#FF69B4" },
  { name: "ONNX Runtime", level: 0.55, category: "Exploring", color: "#FF69B4" }
];
function getContrastText(bgColor) {
  // Convert hex to RGB
  const r = parseInt(bgColor.slice(1, 3), 16);
  const g = parseInt(bgColor.slice(3, 5), 16);
  const b = parseInt(bgColor.slice(5, 7), 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.6 ? "#000" : "#fff"; // light bg = dark text
}
// Project Data
const projectsData = [
  {
    id: 1,
    title: "TurtleBot3 Control Architecture",
    description: "Designed a hybrid control system using PID, fuzzy logic, and obstacle avoidance with ROS, deployed on TurtleBot3.",
    technologies: ["ROS", "Python", "Fuzzy Logic", "PID"],
    category: "Robotics",
    categoryColor: "#00FFFF",
    demoUrl: "#",
    repoUrl: "https://github.com/dhaneshraju/turtlebot3-control", // Update if private
    image: "/projects/turtlebot.jpg",
    metrics: { stability: 0.9, adaptability: 0.88, innovation: 0.92 }
  },
  {
    id: 2,
    title: "Abusive Content Detection System",
    description: "Built an NLP pipeline to detect and classify abusive or harmful language across social media platforms.",
    technologies: ["Python", "NLP", "spaCy", "Scikit-learn"],
    category: "Ethical AI",
    categoryColor: "#ADFF2F",
    demoUrl: "#",
    repoUrl: "https://github.com/dhaneshraju/abuse-detector",
    image: "/projects/abuse-nlp.jpg",
    metrics: { accuracy: 0.87, recall: 0.82, ethics: 0.95 }
  },
  {
    id: 3,
    title: "Prostate Cancer & Epilepsy Classifier",
    description: "Developed CNN and LSTM models for MRI and EEG-based diagnosis, with SHAP explainability for clinical insights.",
    technologies: ["TensorFlow", "Keras", "CNN", "LSTM", "SHAP"],
    category: "Medical AI",
    categoryColor: "#FF4500",
    demoUrl: "#",
    repoUrl: "https://github.com/dhaneshraju/med-ai-diagnostics",
    image: "/projects/medical-ai.jpg",
    metrics: { accuracy: 0.91, interpretability: 0.86, impact: 0.9 }
  },
  {
    id: 4,
    title: "Sleep Stage Classifier",
    description: "Used deep learning and signal processing techniques to classify sleep stages from PSG data on GPU-based systems.",
    technologies: ["Python", "Signal Processing", "Deep Learning", "GPU"],
    category: "Time-Series AI",
    categoryColor: "#1E90FF",
    demoUrl: "#",
    repoUrl: "https://github.com/dhaneshraju/sleep-stage-classifier",
    image: "/projects/sleep-ai.jpg",
    metrics: { accuracy: 0.88, efficiency: 0.83, innovation: 0.87 }
  },
  {
    id: 5,
    title: "Predictive Maintenance in Industry",
    description: "Built a fault prediction system for water pumps using deep learning, fuzzy logic, and real-time dashboards.",
    technologies: ["TensorFlow", "Fuzzy Logic", "Docker", "Dashboard UI"],
    category: "Industrial AI",
    categoryColor: "#9932CC",
    demoUrl: "#",
    repoUrl: "https://github.com/dhaneshraju/industrial-predictive-maintenance",
    image: "/projects/maintenance.jpg",
    metrics: { accuracy: 0.9, explainability: 0.8, deployment: 0.85 }
  }
];

// Timeline Data
const timelineData = [
  {
    year: "2024",
    title: "Data Engineer / LLM Developer @ Fluck",
    description: "Engineered data pipelines and integrated RAG for LLMs in healthcare-style environments.",
    technologies: ["Langchain", "RAG", "NLP", "Python", "MLflow"]
  },
  {
    year: "2024",
    title: "Predictive Maintenance Engineer @ Stuart Turner / AGM",
    description: "Built real-time deep learning systems for fault detection in industrial water pumps.",
    technologies: ["TensorFlow", "Python", "Fuzzy Logic", "Docker"]
  },
  {
    year: "2024",
    title: "MSc Artificial Intelligence, University of Essex",
    description: "Specialized in neural networks, biomedical AI, robotics, and explainable systems.",
    technologies: ["XAI", "Deep Learning", "ROS", "Scikit-learn"]
  },
  {
    year: "2023",
    title: "Robotics & Research Projects",
    description: "Built control architecture for TurtleBot3 and ML pipelines for rocket landing and EEG analysis.",
    technologies: ["ROS", "MLP", "EEG", "LSTM", "Signal Processing"]
  },
  {
    year: "2022",
    title: "B.E. Electronics & Communication, KPR Institute",
    description: "Explored IoT, signal processing, robotics, and cloud computing fundamentals.",
    technologies: ["C/C++", "Python", "IoT", "Cloud Services"]
  }
];

// Neural Node Component for Timeline
function TimelineNode({ data, index, totalNodes }) {
  const nodeRef = useRef();
  const textRef = useRef();
  
  useEffect(() => {
    if (nodeRef.current) {
      gsap.fromTo(
        nodeRef.current,
        { scale: 0, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.8, delay: index * 0.2 }
      );
    }
    
    if (textRef.current) {
      gsap.fromTo(
        textRef.current,
        { x: -50, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.8, delay: index * 0.2 + 0.2 }
      );
    }
  }, [index]);
  
  return (
    <div className="timeline-node-container" style={{ top: `${(index / (totalNodes - 1)) * 80 + 10}%` }}>
      <div ref={nodeRef} className="timeline-node">
        <div className="node-year">{data.year}</div>
      </div>
      <div ref={textRef} className="timeline-content">
        <h3>{data.title}</h3>
        <p>{data.description}</p>
        <div className="tech-tags">
          {data.technologies.map((tech, i) => (
            <span key={i} className="tech-tag">{tech}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// 3D Skill Node Component
// Update the SkillNode component
// Replace the existing SkillNode and SkillsGraph components with these:

// function ConnectionLines({ nodes, centralPosition }) {
//   const lineRef = useRef();

//   useFrame(({ clock }) => {
//     if (lineRef.current) {
//       const t = clock.getElapsedTime();
//       lineRef.current.children.forEach((line, i) => {
//         // Pulsing animation for lines
//         const pulse = (Math.sin(t * 0.5 + i * 0.2) + 1) * 0.3;
//         if (line.material) {
//           line.material.opacity = pulse;
//         }
//       });
//     }
//   });

//   return (
//     <group ref={lineRef}>
//       {nodes.map((node, i) => (
//         node?.position && (
//           <line key={i}>
//             <bufferGeometry>
//               <bufferAttribute
//                 attach="attributes-position"
//                 count={2}
//                 array={new Float32Array([
//                   0, 0, 0, // Center point
//                   node.position.x, node.position.y, node.position.z // Node position
//                 ])}
//                 itemSize={3}
//               />
//             </bufferGeometry>
//             <lineBasicMaterial
//               color="#00ffff"
//               transparent
//               opacity={0.3}
//               linewidth={1}
//             />
//           </line>
//         )
//       ))}
//     </group>
//   );
// }

// function SkillNode({ skill, index, total, centralNode }) {
//   const ref = useRef();
//   const [hovered, setHovered] = useState(false);
  
//   const position = useMemo(() => {
//     const radius = 5;
//     const phi = Math.acos(-1 + (2 * index) / total);
//     const theta = Math.sqrt(total * Math.PI) * phi;
    
//     return new THREE.Vector3(
//       radius * Math.sin(phi) * Math.cos(theta),
//       radius * Math.sin(phi) * Math.sin(theta),
//       radius * Math.cos(phi)
//     );
//   }, [index, total]);

//   useFrame(({ clock }) => {
//     if (!ref.current) return;
//     const time = clock.getElapsedTime();
    
//     ref.current.position.x = position.x + Math.sin(time * 0.3 + index) * 0.2;
//     ref.current.position.y = position.y + Math.cos(time * 0.2 + index) * 0.2;
//     ref.current.position.z = position.z + Math.sin(time * 0.4 + index) * 0.2;
//   });

//   return (
//     <group ref={ref} position={position}>
//       {/* Connection line to central node with depth test disabled */}
//       <lineSegments>
//         <bufferGeometry>
//           <bufferAttribute
//             attach="attributes-position"
//             count={2}
//             array={new Float32Array([
//               0, 0, 0,
//               -position.x, -position.y, -position.z
//             ])}
//             itemSize={3}
//           />
//         </bufferGeometry>
//         <lineBasicMaterial
//           color={skill.color}
//           transparent
//           opacity={0.2}
//           depthTest={false}
//           linewidth={1}
//         />
//       </lineSegments>

//       {/* Diamond shape using OctahedronGeometry */}
//       <mesh
//         onPointerOver={() => setHovered(true)}
//         onPointerOut={() => setHovered(false)}
//         rotation={[Math.PI / 4, 0, Math.PI / 4]}
//       >
//         <octahedronGeometry args={[0.4, 0]} /> {/* Use octahedron for diamond shape */}
//         <meshPhongMaterial
//           color={skill.color}
//           emissive={skill.color}
//           emissiveIntensity={hovered ? 0.8 : 0.4}
//           transparent
//           opacity={0.9}
//           shininess={100}
//         />
//       </mesh>

//       {/* Glow effect for diamond */}
//       <mesh scale={[1.2, 1.2, 1.2]} rotation={[Math.PI / 4, 0, Math.PI / 4]}>
//         <octahedronGeometry args={[0.4, 0]} />
//         <meshPhongMaterial
//           color={skill.color}
//           transparent
//           opacity={0.1}
//           side={THREE.BackSide}
//         />
//       </mesh>

//       <Html
//         center
//         distanceFactor={10}
//         position={[0, 0.8, 0]}
//         style={{
//           opacity: hovered ? 1 : 0.8,
//           transition: 'all 0.2s',
//           transform: `scale(${hovered ? 1.2 : 1})`,
//           pointerEvents: 'none'
//         }}
//       >
//         <div className="skill-label">
//           <span className="skill-name">{skill.name}</span>
//           <span className="skill-category">{skill.category}</span>
//         </div>
//       </Html>
//     </group>
//   );
// }

// // Update the SkillsGraph component to fix the central object
// function SkillsGraph() {
//   return (
//     <Canvas camera={{ position: [0, 0, 15], fov: 60 }}>
//       <color attach="background" args={['#000000']} />
//       <fog attach="fog" args={['#000000', 15, 25]} />
      
//       <Suspense fallback={null}>
//         {/* Lighting */}
//         <ambientLight intensity={0.4} />
//         <pointLight position={[10, 10, 10]} intensity={0.8} color="#00ffff" />
//         <pointLight position={[-10, -10, -10]} intensity={0.4} color="#00ffff" />
        
//         {/* Skill nodes - Render these first */}
//         <group position={[0, 0, -2]}>  {/* Move nodes behind */}
//           {skillsData.map((skill, i) => (
//             <SkillNode
//               key={skill.name}
//               skill={skill}
//               index={i}
//               total={skillsData.length}
//               centralNode={new THREE.Vector3(0, 0, 0)}
//             />
//           ))}
//         </group>

//         {/* Central brain structure - Render this last */}
//         <group position={[0, 0, 2]}>  {/* Move sphere forward */}
//           <mesh>
//             {/* Core sphere */}
//             <sphereGeometry args={[1.5, 32, 32]} />
//             <meshPhongMaterial
//               color="#00ffff"
//               emissive="#00ffff"
//               emissiveIntensity={0.5}
//               transparent
//               opacity={0.2}
//               depthWrite={true}  // Enable depth writing
//               depthTest={true}   // Enable depth testing
//             />
//           </mesh>

//           {/* Multiple wireframe layers */}
//           {[1.3, 1.4, 1.5].map((radius, i) => (
//             <mesh key={i} position={[0, 0, 0.1 * i]}>  {/* Slight z-offset for each layer */}
//               <sphereGeometry args={[radius, 16, 16]} />
//               <meshBasicMaterial
//                 color="#00ffff"
//                 wireframe
//                 transparent
//                 opacity={0.1 - i * 0.02}
//                 depthWrite={true}
//                 renderOrder={1}  // Ensure wireframes render after solid sphere
//               />
//             </mesh>
//           ))}
//         </group>

//         <OrbitControls
//           enableZoom={true}
//           enablePan={false}
//           autoRotate
//           autoRotateSpeed={0.5}
//           minPolarAngle={Math.PI / 4}
//           maxPolarAngle={Math.PI * 3/4}
//           minDistance={8}
//           maxDistance={20}
//         />
//       </Suspense>
//     </Canvas>
//   );
// }


// SkillNode component with proper connections
function SkillNode({ skill, index, total }) {
  const nodeRef = useRef();
  const lineRef = useRef();
  const [hovered, setHovered] = useState(false);

  const radius = 5;
  const angleOffset = useMemo(() => Math.random() * Math.PI * 2, []);
  const inclination = useMemo(() => Math.acos(-1 + (2 * index) / total), [index, total]);
  const azimuth = useMemo(() => Math.sqrt(total * Math.PI) * inclination, [index, total]);
  const speed = useMemo(() => 0.15 + Math.random() * 0.05, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * speed + angleOffset;
    const x = radius * Math.cos(t) * Math.sin(inclination);
    const y = radius * Math.sin(t) * Math.sin(inclination);
    const z = radius * Math.cos(inclination);

    if (nodeRef.current) {
      nodeRef.current.position.set(x, y, z);
    }

    if (lineRef.current) {
      const pos = lineRef.current.geometry.attributes.position.array;
      pos[3] = -x;
      pos[4] = -y;
      pos[5] = -z;
      lineRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group ref={nodeRef}>
      {/* Connection line with animated gradient */}
      <lineSegments ref={lineRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([0, 0, 0, 0, 0, 0])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color="#ffffff"
          transparent
          opacity={5}
          depthTest={false}
          linewidth={2}
        />
      </lineSegments>

      {/* Outer glow */}
      <mesh scale={hovered ? 1.8 : 1.4}>
        <sphereGeometry args={[0.2, 32, 32]} />
        <meshBasicMaterial
          color={skill.color}
          transparent
          opacity={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Main node - hexagonal crystal design */}
      <mesh
        scale={hovered ? 1.2 : 1}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <dodecahedronGeometry args={[0.2, 0]} />
        <meshPhysicalMaterial
          color={skill.color}
          metalness={0.8}
          roughness={0.1}
          envMapIntensity={1}
          clearcoat={1}
          clearcoatRoughness={0.1}
          transparent
          opacity={0.9}
          emissive={skill.color}
          emissiveIntensity={hovered ? 0.5 : 0.2}
        />
      </mesh>

      {/* Skill label */}
      <Html center distanceFactor={8}>
        <div
          style={{
            padding: '8px 12px',
            background: `rgba(0,0,0,0.85)`,
            backdropFilter: 'blur(4px)',
            borderRadius: '8px',
            border: `1px solid ${skill.color}`,
            color: skill.color,
            fontSize: '14px',
            fontWeight: '500',
            letterSpacing: '0.5px',
            transform: `scale(${hovered ? 1.1 : 1})`,
            transition: 'all 0.3s ease',
            boxShadow: hovered 
              ? `0 0 20px ${skill.color}40`
              : 'none',
          }}
        >
          {skill.name}
        </div>
      </Html>
    </group>
  );
}

// CenterSphere component
function CenterSphere() {
  const sphereRef = useRef();
  const wireframeRef = useRef();

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    if (sphereRef.current) {
      sphereRef.current.rotation.y = time * 0.2;
      sphereRef.current.rotation.z = time * 0.1;
    }
    if (wireframeRef.current) {
      wireframeRef.current.rotation.y = -time * 0.1;
      wireframeRef.current.rotation.z = time * 0.15;
    }
  });

  return (
    <group>
      {/* Core sphere */}
      <mesh ref={sphereRef}>
        <sphereGeometry args={[1.2, 32, 32]} />
        <meshPhongMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={0.5}
          transparent
          opacity={0.3}
          shininess={100}
        />
      </mesh>

      {/* Wireframe layers */}
      <group ref={wireframeRef}>
        {[1.3, 1.4, 1.5].map((radius, i) => (
          <mesh key={i}>
            <sphereGeometry args={[radius, 16, 16]} />
            <meshBasicMaterial color="#00ffff" wireframe transparent opacity={0.1 - i * 0.02} />
          </mesh>
        ))}
      </group>

      {/* Glow effect */}
      <mesh>
        <sphereGeometry args={[1.6, 32, 32]} />
        <meshBasicMaterial color="#00ffff" transparent opacity={0.05} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

// Starfield (background)
function Starfield() {
  return (
    <points>
      <sphereGeometry args={[40, 64, 64]} />
      <pointsMaterial color="#ffffff" size={0.05} sizeAttenuation />
    </points>
  );
}

function SkillsGraph() {
  return (
    <div style={{ width: '100%', height: '600px', position: 'relative' }}>
      <Canvas 
        camera={{ 
          position: [0, 0, 15], 
          fov: 60,
          near: 0.1,
          far: 1000
        }}
      >
        <color attach="background" args={['#000000']} />
        <fog attach="fog" args={['#000000', 15, 25]} />
        
        <Suspense fallback={null}>
          <ambientLight intensity={0.4} />
          <pointLight position={[10, 10, 10]} intensity={0.8} color="#00ffff" />
          <pointLight position={[-10, -10, -10]} intensity={0.4} color="#00ffff" />

          {/* Centered group with proper rotation */}
          <group 
            position={[0, 0, 0]} 
            rotation={[0, 0, 0]}
          >
            {/* Center sphere */}
            <CenterSphere />

            {/* Skill nodes */}
            {skillsData.map((skill, i) => (
              <SkillNode
                key={skill.name}
                skill={skill}
                index={i}
                total={skillsData.length}
              />
            ))}
          </group>

          {/* Camera controls with fixed target */}
          <OrbitControls
            enableZoom={true}
            enablePan={false}
            autoRotate
            autoRotateSpeed={0.5}
            minDistance={8}
            maxDistance={20}
            target={[0, 0, 0]}
            enableDamping={true}
            dampingFactor={0.05}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}



// Add a new RotatingGroup component
function RotatingGroup({ children }) {
  const groupRef = useRef();
  
  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.getElapsedTime() * 0.05;
    }
  });
  
  return <group ref={groupRef}>{children}</group>;
}

// // 3D Skills Graph Component
// function SkillsGraph() {
//   const groupRef = useRef();
  
//   useFrame(({ clock }) => {
//     if (groupRef.current) {
//       groupRef.current.rotation.y = clock.getElapsedTime() * 0.05;
//     }
//   });
  
//   return (
//     <Canvas camera={{ position: [0, 0, 8], fov: 60 }}>
//       <ambientLight intensity={0.4} />
//       <pointLight position={[10, 10, 10]} intensity={0.6} />
//       <pointLight position={[-10, -10, -10]} intensity={0.4} color="#00ffff" />
//       <Suspense fallback={null}>
//         <group ref={groupRef}>
//           {skillsData.map((skill, i) => (
//             <SkillNode key={skill.name} skill={skill} index={i} total={skillsData.length} />
//           ))}
//         </group>
//         <OrbitControls enablePan={false} autoRotate autoRotateSpeed={0.5} />
//       </Suspense>
//     </Canvas>
//   );
// }

// Project Card Component
function ProjectCard({ project, index }) {
  const [hovered, setHovered] = useState(false);
  
  return (
    <motion.div
      className="project-card"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 + 0.2 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
    >
      <div 
        className="project-image" 
        style={{ backgroundImage: `url(${project.image})` }}
      >
        <div 
          className="project-category" 
          style={{ 
            backgroundColor: project.categoryColor,
            color: getContrastText(project.categoryColor) // 👈 Dynamic text color
          }}
        >
          {project.category}
        </div>
      </div>
      
      <div className="project-content">
        <h3 className="project-title">{project.title}</h3>
        <p className="project-description">{project.description}</p>
        
        <div className="project-tech-tags">
          {project.technologies.map((tech, i) => (
            <span key={i} className="tech-tag">{tech}</span>
          ))}
        </div>
        
        <AnimatePresence>
          {hovered && (
            <motion.div 
              className="project-metrics"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
             {project.metrics && Object.entries(project.metrics).map(([label, value], i) => (
              <div className="metrics-bar" key={i}>
                <span>{label.charAt(0).toUpperCase() + label.slice(1)}</span>
                <div className="metric-bg">
                  <motion.div 
                    className="metric-fill" 
                    style={{ backgroundColor: project.categoryColor }}
                    initial={{ width: 0 }}
                    animate={{ width: `${value * 100}%` }}
                  />
                </div>
              </div>
            ))}
              
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* <div className="project-links">
          <a href={project.demoUrl} className="project-link">
            <ExternalLink size={16} /> Demo
          </a>
          <a href={project.repoUrl} className="project-link">
            <Code size={16} /> Code
          </a>
        </div> */}
      </div>
    </motion.div>
  );
}

export default function AboutPage() {
  const [activeSection, setActiveSection] = useState('hero');
  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const navigate = useNavigate();
  
  const handleMultipleDownloads = async (e) => {
    e.preventDefault();
    if (isDownloading) return;
    
    setIsDownloading(true);
    
    const files = [
      { name: `${process.env.PUBLIC_URL || ''}/Dhanesh_Raju_CV.pdf`, displayName: 'Dhanesh_Raju_CV.pdf' },
      { name: `${process.env.PUBLIC_URL || ''}/Dhanesh_Raju_Personal_Statement.pdf`, displayName: 'Dhanesh_Raju_Personal_Statement.pdf' }
    ];
    
    // Helper function to trigger download
    const downloadFile = (file) => {
      return new Promise((resolve) => {
        const link = document.createElement('a');
        link.href = `/${file.name}`;
        link.download = file.displayName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        resolve();
      });
    };
    
    try {
      // Download files one by one with a small delay
      for (const file of files) {
        await downloadFile(file);
        await new Promise(resolve => setTimeout(resolve, 300)); // Small delay between downloads
      }
    } catch (error) {
      console.error('Error downloading files:', error);
    } finally {
      setIsDownloading(false);
    }
  };
  
  // Audio for the page
useEffect(() => {
  const cleanup = () => {
    // Cancel any running animations
    if (window.gsap) {
      window.gsap.killTweensOf("*");
    }
  };

  return cleanup;
}, []);


useEffect(() => {
  const options = {
    root: null,
    rootMargin: '-50% 0px',
    threshold: 0
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        setActiveSection(entry.target.id);
      }
    });
  }, options);

  // Observe all sections
  document.querySelectorAll('.section').forEach((section) => {
    observer.observe(section);
  });

  return () => {
    document.querySelectorAll('.section').forEach((section) => {
      observer.unobserve(section);
    });
  };
}, []);
  
  // Scroll spy effect
    useEffect(() => {
    const sections = ['hero', 'about', 'skills', 'timeline', 'projects', 'contact'];
    
    const handleScroll = () => {
      const scrollPosition = window.scrollY + window.innerHeight / 3;
      
      for (const section of sections) {
        const element = document.getElementById(section);
        if (!element) continue;
        
        const { offsetTop, offsetHeight } = element;
        if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
          setActiveSection(section);
          break;
        }
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
      // Update active section
      setActiveSection(sectionId);
    }
  };

  
  return (
    <div className="main-container bg-black text-white">
    {/* Return to Core Button - Fixed in top right */}
    <button
      onClick={() => navigate('/')}
      className="fixed top-[clamp(1rem,2vh,2rem)] right-[clamp(1rem,3vw,3rem)] z-50 px-[clamp(0.5rem,2vw,1.5rem)] py-[clamp(0.25rem,1.5vh,1rem)] text-[clamp(0.875rem,1.5vw,1rem)] text-cyan-400 font-mono font-bold bg-transparent rounded-full hover:bg-cyan-300 shadow-md transition duration-300 hover:scale-105"
    >
      ⬅️ Return to Core
    </button>
      {/* Background music player */}
      
      <DynamicMusicPlayer mute={false} page="aboutpage" volume={0.01} />
      
      {/* Fixed Navbar - Neural Network Inspired */}
      <nav className="fixed top-1/2 right-8 transform -translate-y-1/2 z-50 mix-blend-difference">
        <div className="flex flex-col items-center gap-6">
          {['hero', 'about', 'skills', 'timeline', 'projects', 'contact'].map((section, index) => (
            <div key={section} className="relative">
              <motion.button
                className="w-3 h-3 rounded-full bg-gray-600 relative focus:outline-none"
                onClick={() => scrollToSection(section)}
                whileHover={{ scale: 1.2 }}
                animate={{
                  scale: activeSection === section ? 1.2 : 1,
                  backgroundColor: activeSection === section ? '#00ffff' : '#4b5563'
                }}
              >
                <motion.div
                  className="absolute -inset-2 rounded-full"
                  animate={{
                    boxShadow: activeSection === section 
                      ? '0 0 12px 4px rgba(0, 255, 255, 0.4)' 
                      : 'none'
                  }}
                />
              </motion.button>
              
              {index < 5 && (
                <motion.div 
                  className="w-px h-6 bg-gray-600 mx-auto mt-1"
                  animate={{
                    backgroundColor: activeSection === section || 
                      activeSection === ['hero', 'about', 'skills', 'timeline', 'projects', 'contact'][index + 1]
                      ? '#00ffff'
                      : '#4b5563',
                    opacity: activeSection === section || 
                      activeSection === ['hero', 'about', 'skills', 'timeline', 'projects', 'contact'][index + 1]
                      ? 0.8
                      : 0.3
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </nav>
      
      {/* HERO SECTION */}
      <section id="hero" className="section hero-section">
        <motion.div
          className="profile-image-container"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          
        >
          <img
            src={profileImage}
            alt="Dhanesh Raju"
            className="profile-image"
            onError={(e) => {
              e.target.src = defaultProfileImage;
              e.target.onerror = null;
            }}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="hero-content"
        >
          <h1 className="hero-title">Dhanesh Raju</h1>
          <div className="hero-subtitle">AI Engineer & Neural Architect</div>
          <motion.div 
            className="hero-tagline"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 1 }}
          >
            Bridging <span className="highlight">human cognition</span> and <span className="highlight">machine intelligence</span>
          </motion.div>
          
          <div className="social-links">
            <motion.a 
              href="https://github.com/dhaneshraju"
              target="_blank" 
              rel="noopener noreferrer"
              whileHover={{ scale: 1.2, color: '#00FFFF' }}
            >
              <Github size={24} />
            </motion.a>
            <motion.a 
              href="https://linkedin.com/in/dhaneshraju"
              target="_blank" 
              rel="noopener noreferrer"
              whileHover={{ scale: 1.2, color: '#00FFFF' }}
            >
              <Linkedin size={24} />
            </motion.a>
            {/* <motion.a 
              href="https://twitter.com/dhanesh"
              target="_blank" 
              rel="noopener noreferrer"
              whileHover={{ scale: 1.2, color: '#00FFFF' }}
            > */}
              {/* <Twitter size={24} />
            </motion.a> */}
            <motion.a 
              href="mailto:dhanesh8880@gmail.com"
              whileHover={{ scale: 1.2, color: '#00FFFF' }}
            >
              <Mail size={24} />
            </motion.a>
          </div>
        </motion.div>

        <motion.div
          className="scroll-indicator"
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          onClick={() => {
            document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          <div className="mouse">
            <div className="wheel"></div>
          </div>
          <div>Scroll</div>
        </motion.div>
      </section>
            
      {/* ABOUT SECTION */}
      <section id="about" className="section about-section">
        <div className="section-grid">
          <motion.div 
            className="section-content"
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            <h2 className="section-title">About Me</h2>
            <div className="section-text">
              <p>
                I’m an AI Engineer & Neural Architect driven by the intersection of human cognition and machine intelligence.
                With a Master’s in Artificial Intelligence from the University of Essex and a background in Electronics and Communication Engineering, 
                my journey spans across intelligent control systems, NLP, biomedical AI, and real-time automation.
              </p>
              <p>
                I specialize in building intelligent solutions that are not only technically robust but human-aware—systems that think with us, not for us.
                From developing advanced robotics control for TurtleBot3 to creating machine learning models that detect harmful content on the internet, 
                my work blends ethical AI, real-time processing, and explainability.
              </p>
              <p>
                Over the years, I’ve worked with a range of tools and frameworks: from TensorFlow, Keras, and Scikit-learn, to ROS, OpenCV, and RAG-based LLM pipelines. 
                My professional experience includes engineering robust NLP workflows and predictive models in healthcare and industrial systems. 
                I’ve deployed ML pipelines on real-world edge systems, and optimized large-scale LLM backends for secure environments.
              </p>
              <p>
                Whether it’s decoding EEG signals for epilepsy detection, forecasting energy surpluses for smart grids, 
                or developing deep learning models for sleep stage classification, I constantly push the boundaries between 
                what machines can interpret and how humans interact with those interpretations.
              </p>
              <p>
                Beyond the code, I value collaboration, transparency, and clear technical communication. 
                I believe in AI that enhances clarity not confusion and am passionate about making the 
                inner workings of algorithms understandable, justifiable, and impactful in the real world.
              </p>
            </div>
            
            <div className="expertise-grid">
              <div className="expertise-card">
                <PanelTop className="expertise-icon" />
                <h3>Neural Architecture & Robotics</h3>
                <p>Built a control system for TurtleBot3 using PID, fuzzy logic, and obstacle avoidance, showcasing real-time integration with ROS. Designed MLPs to simulate rocket landing environments with dynamic feedback systems.</p>
              </div>
              
              <div className="expertise-card">
                <Brain className="expertise-icon" />
                <h3>Biomedical & Cognitive AI</h3>
                <p>Created supervised models to classify prostate cancer stages and detect epilepsy from EEG using CNNs & LSTMs. Applied SHAP and Grad-CAM for explainable medical AI.</p>
              </div>
              
              <div className="expertise-card">
                <Cpu className="expertise-icon" />
                <h3>Language & Ethics in AI</h3>
                <p>Developed systems to detect abusive content using NLP, ML, and ethical filtering pipelines. Built LLM training data pipelines and integrated Retrieval-Augmented Generation (RAG) for secure environments.</p>
              </div>
              
              <div className="expertise-card">
                <Server className="expertise-icon" />
                <h3>Predictive & Industrial Intelligence</h3>
                <p>Built fault detection models for water pumps using deep learning + fuzzy logic. Delivered real-time dashboards and explainable insights to industrial stakeholders.</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
      
      {/* SKILLS SECTION */}
      <section id="skills" className="section skills-section">
        <motion.div 
          className="section-header"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <h2 className="section-title">Skills & Expertise</h2>
          <p className="section-subtitle">An interconnected neural network of my technical capabilities</p>
        </motion.div>
        
        <div className="skills-container">
          <div className="skills-graph">
            <SkillsGraph />
          </div>
          
          <motion.div 
            className="skills-legend"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            viewport={{ once: true }}
          >
            {[...new Set(skillsData.map(skill => skill.category))].map((category, i) => (
              <div key={category} className="skill-category">
                <div 
                  className="category-color" 
                  style={{ backgroundColor: skillsData.find(s => s.category === category)?.color }}
                />
                <span>{category}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>
      
      {/* TIMELINE SECTION */}
      <section id="timeline" className="section timeline-section">
        <motion.div 
          className="section-header"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <h2 className="section-title">My Journey</h2>
          <p className="section-subtitle">The evolution of my work in AI and machine learning</p>
        </motion.div>
        
        <div className="timeline-container">
          <div className="timeline-line"></div>
          {timelineData.map((data, i) => (
            <TimelineNode key={i} data={data} index={i} totalNodes={timelineData.length} />
          ))}
        </div>
      </section>
      
      {/* PROJECTS SECTION */}
      <section id="projects" className="section projects-section">
        <motion.div 
          className="section-header"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <h2 className="section-title">Projects</h2>
          <p className="section-subtitle">A showcase of my work in AI and beyond</p>
        </motion.div>
        
        <div className="projects-grid">
          {projectsData.map((project, i) => (
            <ProjectCard key={project.id} project={project} index={i} />
          ))}
        </div>
      </section>
      
      {/* CONTACT SECTION */}
      <section id="contact" className="section contact-section">
        <motion.div 
          className="contact-content"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <h2 className="section-title">Let's Create Together</h2>
          <p className="section-subtitle">Have a project in mind or interested in collaboration?</p>
          
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={handleMultipleDownloads}
              disabled={isDownloading}
              className={`inline-flex items-center justify-center px-6 py-3 text-base font-medium text-cyan-300 bg-transparent border-2 ${isDownloading ? 'border-cyan-700' : 'border-cyan-400 hover:border-cyan-300 hover:bg-cyan-900/30'} rounded-full shadow-lg transition-all duration-300 group`}
            >
              {isDownloading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-cyan-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Downloading...
                </>
              ) : (
                <>
                  <svg 
                    className="w-5 h-5 mr-2 text-cyan-300 group-hover:animate-bounce" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24" 
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" 
                    />
                  </svg>
                  Download CV & Personal Statement
                </>
              )}
            </button>
            <motion.button
              className="contact-button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setContactFormOpen(true)}
            >
              <span className="button-text">Initialize Neural Handshake</span>
              <span className="button-icon">
                <motion.div
                  animate={{ x: [0, 10, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  →
                </motion.div>
              </span>
            </motion.button>
          </div>
          <motion.div className="floating-contact-info">
          <motion.div 
            className="floating-item"
            animate={{ 
              y: [0, -10, 0],
              rotate: [-2, 2, -2]
            }}
            transition={{ 
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <Mail className="contact-icon" />
            <motion.a 
              href="mailto:dhanesh8880@gmail.com"
              whileHover={{ 
                scale: 1.05, 
                color: "#00ffff",
                textShadow: "0 0 8px rgba(0, 255, 255, 0.5)"
              }}
            >
              dhanesh8880@gmail.com
            </motion.a>
          </motion.div>

          <motion.div 
            className="floating-item"
            animate={{ 
              y: [0, -10, 0],
              rotate: [2, -2, 2]
            }}
            transition={{ 
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.5
            }}
          >
            <Linkedin className="contact-icon" />
            <motion.a 
              href="https://linkedin.com/in/dhaneshraju"
              target="_blank" 
              rel="noopener noreferrer"
              whileHover={{ 
                scale: 1.05, 
                color: "#00ffff",
                textShadow: "0 0 8px rgba(0, 255, 255, 0.5)"
              }}
            >
              linkedin.com/in/dhaneshraju
            </motion.a>
          </motion.div>
        </motion.div>
        </motion.div>
        
        {/* Neural animation in background */}
        <div className="contact-bg">
          <div className="neural-nodes">
            {Array.from({ length: 20 }).map((_, i) => (
              <motion.div 
                key={i}
                className="neural-node"
                animate={{ 
                  x: [Math.random() * 100 - 50, Math.random() * 100 - 50],
                  y: [Math.random() * 100 - 50, Math.random() * 100 - 50],
                  opacity: [0.3, 0.8, 0.3]
                }}
                transition={{ 
                  repeat: Infinity,
                  repeatType: "reverse",
                  duration: Math.random() * 10 + 10
                }}
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
              />
            ))}
          </div>
        </div>
      </section>
      
      {/* Contact Form Modal
      <AnimatePresence>
        {contactFormOpen && (
          <motion.div 
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="modal-container"
              initial={{ scale: 0.8, y: 50, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.8, y: 50, opacity: 0 }}
              transition={{ type: 'spring', damping: 25 }}
            >
              <button className="modal-close" onClick={() => setContactFormOpen(false)}>&times;</button>
              <h3 className="modal-title">Neural Handshake Protocol</h3>
              

              
              <form className="contact-form" onSubmit={handleFormSubmit}>
                <div className="form-group">
                  <label htmlFor="name">Name</label>
                  <input type="text" id="name" name="name" placeholder="Your name" required />
                </div>
                <div className="form-group">
                  <label htmlFor="email">Email</label>
                  <input type="email" id="email" name="email" placeholder="your@email.com" required />
                </div>
                <div className="form-group">
                  <label htmlFor="projectType">Project Type</label>
                  <select id="projectType" name="projectType" required>
                    <option value="">Select project type</option>
                    <option value="ai">AI Development</option>
                    <option value="ml">Machine Learning</option>
                    <option value="research">Research Collaboration</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="message">Message</label>
                  <textarea 
                    id="message" 
                    name="message" 
                    placeholder="Describe your project or idea"
                    required
                  ></textarea>
                </div>
                <button type="submit" className="form-submit">Initialize Connection</button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence> */}
    </div>
  );
}
