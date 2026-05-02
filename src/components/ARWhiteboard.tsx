import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Backdrop, Float, Text } from '@react-three/drei';
import * as THREE from 'three';
import { whiteboardService, WhiteboardStroke } from '../services/whiteboardService';
import { useAuth } from '../context/AuthContext';
import { X, Eraser, Palette, MousePointer2, Move, Box } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ARWhiteboardProps {
  chatId: string;
  onClose: () => void;
}

const Stroke = ({ stroke }: { stroke: WhiteboardStroke }) => {
  const points = useMemo(() => {
    const pts = [];
    for (let i = 0; i < stroke.points.length; i += 3) {
      pts.push(new THREE.Vector3(stroke.points[i], stroke.points[i + 1], stroke.points[i + 2]));
    }
    return pts;
  }, [stroke.points]);

  if (points.length < 2) return null;

  const curve = new THREE.CatmullRomCurve3(points);
  
  return (
    <mesh>
      <tubeGeometry args={[curve, points.length * 2, stroke.width / 100, 8, false]} />
      <meshStandardMaterial color={stroke.color} />
    </mesh>
  );
};

const DrawingCanvas = ({ chatId, senderId, color, width }: { chatId: string, senderId: string, color: string, width: number }) => {
  const { camera, mouse, raycaster } = useThree();
  const [currentStroke, setCurrentStroke] = useState<number[]>([]);
  const isDrawing = useRef(false);

  // Plane at z=0 for drawing if not using real AR
  const drawingPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);
  const intersectPoint = new THREE.Vector3();

  useEffect(() => {
    const handleMouseDown = () => {
      isDrawing.current = true;
      setCurrentStroke([]);
    };

    const handleMouseUp = async () => {
      if (isDrawing.current && currentStroke.length > 6) {
        await whiteboardService.addStroke(chatId, senderId, currentStroke, color, width);
      }
      isDrawing.current = false;
      setCurrentStroke([]);
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [currentStroke, chatId, senderId, color, width]);

  useFrame(() => {
    if (isDrawing.current) {
      raycaster.setFromCamera(mouse, camera);
      raycaster.ray.intersectPlane(drawingPlane, intersectPoint);
      
      // Only add point if it's far enough from the last point
      const lastX = currentStroke[currentStroke.length - 3];
      const lastY = currentStroke[currentStroke.length - 2];
      const lastZ = currentStroke[currentStroke.length - 1];
      
      const dist = lastX !== undefined ? Math.sqrt((intersectPoint.x - lastX)**2 + (intersectPoint.y - lastY)**2) : Infinity;
      
      if (dist > 0.05) {
        setCurrentStroke(prev => [...prev, intersectPoint.x, intersectPoint.y, intersectPoint.z]);
      }
    }
  });

  return (
    <>
      {currentStroke.length > 3 && (
        <Stroke stroke={{ strokeId: 'preview', chatId, senderId, points: currentStroke, color, width, timestamp: null }} />
      )}
    </>
  );
};

export const ARWhiteboard: React.FC<ARWhiteboardProps> = ({ chatId, onClose }) => {
  const { user } = useAuth();
  const [strokes, setStrokes] = useState<WhiteboardStroke[]>([]);
  const [color, setColor] = useState('#00a884');
  const [lineWidth, setLineWidth] = useState(2);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    const unsubscribe = whiteboardService.subscribeToStrokes(chatId, (newStrokes) => {
      setStrokes(newStrokes);
    });
    return () => unsubscribe();
  }, [chatId]);

  const handleClear = async () => {
    setIsClearing(true);
    await whiteboardService.clearWhiteboard(chatId);
    setIsClearing(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col bg-[#111b21]"
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between px-6 bg-[#202c33] text-white">
        <div className="flex items-center space-x-3">
          <div className="bg-[#00a884] p-2 rounded-lg">
            <Box className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-bold">AR Spatial Whiteboard</h2>
            <p className="text-xs text-[#8696a0]">Syncing in real-time</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-[#3b4a54] rounded-full transition-colors"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Main Area */}
      <div className="relative flex-1 bg-gradient-to-b from-[#0b141a] to-[#111b21]">
        <Canvas shadows>
          <PerspectiveCamera makeDefault position={[0, 0, 5]} />
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1} castShadow />
          <gridHelper args={[20, 20, 0x00a884, 0x3b4a54]} rotation={[Math.PI / 2, 0, 0]} />
          
          <OrbitControls makeDefault enablePan={true} enableRotate={true} />
          
          <DrawingCanvas 
            chatId={chatId} 
            senderId={user?.uid || ''} 
            color={color} 
            width={lineWidth} 
          />
          
          {strokes.map(stroke => (
            <Stroke key={stroke.strokeId} stroke={stroke} />
          ))}

          <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
             <Text
               position={[0, 3, 0]}
               fontSize={0.5}
               color="#00a884"
             >
               SPATIAL SPACE
             </Text>
          </Float>
        </Canvas>

        {/* Toolbar Overlay */}
        <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col space-y-4 bg-[#233138] p-3 rounded-2xl border border-[#3b4a54] shadow-2xl z-10">
          <div className="flex flex-col space-y-4">
            <button 
              className={`p-3 rounded-xl transition-all ${color === '#00a884' ? 'bg-[#00a884] text-white shadow-lg' : 'hover:bg-[#3b4a54] text-[#8696a0]'}`}
              onClick={() => setColor('#00a884')}
            >
              <Palette className="h-6 w-6" />
            </button>
            <button 
              className={`p-3 rounded-xl transition-all ${color === '#e542a3' ? 'bg-[#e542a3] text-white shadow-lg' : 'hover:bg-[#3b4a54] text-[#8696a0]'}`}
              onClick={() => setColor('#e542a3')}
            >
              <Palette className="h-6 w-6" />
            </button>
            <button 
              className={`p-3 rounded-xl transition-all ${color === '#3d7eff' ? 'bg-[#3d7eff] text-white shadow-lg' : 'hover:bg-[#3b4a54] text-[#8696a0]'}`}
              onClick={() => setColor('#3d7eff')}
            >
              <Palette className="h-6 w-6" />
            </button>
            <div className="w-full h-px bg-[#3b4a54] my-2" />
            <button 
              onClick={handleClear}
              disabled={isClearing}
              className="p-3 hover:bg-[#3b4a54] text-[#8696a0] rounded-xl transition-all disabled:opacity-50"
            >
              <Eraser className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Instructions Overlay */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 text-white/80 text-sm flex items-center space-x-4 pointer-events-none">
          <div className="flex items-center space-x-2">
            <MousePointer2 className="h-4 w-4" />
            <span>Click & Drag to Draw</span>
          </div>
          <div className="w-px h-4 bg-white/20" />
          <div className="flex items-center space-x-2">
            <Move className="h-4 w-4" />
            <span>Right Click or 2-Finger to Move</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
