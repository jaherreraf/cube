import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Center, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { initSolver, solveCube } from './rubikSolver';

const FACE_COLORS = {
  right:  '#DC2626',  // Red
  left:   '#EA580C',  // Orange
  top:    '#F8FAFC',  // White
  bottom: '#EAB308',  // Yellow
  front:  '#16A34A',  // Green
  back:   '#2563EB',  // Blue
};

const generateCubies = () => {
  const cubies = [];
  let id = 0;
  for (let x = -1; x <= 1; x++)
    for (let y = -1; y <= 1; y++)
      for (let z = -1; z <= 1; z++) {
        if (x === 0 && y === 0 && z === 0) continue;
        const pos = [x * 0.53, y * 0.53, z * 0.53];
        cubies.push({ id: id++, position: pos, initialPosition: pos, quaternion: [0, 0, 0, 1] });
      }
  return cubies;
};

const INITIAL_CUBIES = generateCubies();

const xAxis = new THREE.Vector3(1, 0, 0);
const yAxis = new THREE.Vector3(0, 1, 0);
const zAxis = new THREE.Vector3(0, 0, 1);

const MOVE_DETAILS = {
  R:   { axis: xAxis, angle: -Math.PI / 2, filter: c => c.position[0] >  0.2 },
  "R'":{ axis: xAxis, angle:  Math.PI / 2, filter: c => c.position[0] >  0.2 },
  R2:  { axis: xAxis, angle: -Math.PI,     filter: c => c.position[0] >  0.2 },
  L:   { axis: xAxis, angle:  Math.PI / 2, filter: c => c.position[0] < -0.2 },
  "L'":{ axis: xAxis, angle: -Math.PI / 2, filter: c => c.position[0] < -0.2 },
  L2:  { axis: xAxis, angle:  Math.PI,     filter: c => c.position[0] < -0.2 },
  U:   { axis: yAxis, angle: -Math.PI / 2, filter: c => c.position[1] >  0.2 },
  "U'":{ axis: yAxis, angle:  Math.PI / 2, filter: c => c.position[1] >  0.2 },
  U2:  { axis: yAxis, angle: -Math.PI,     filter: c => c.position[1] >  0.2 },
  D:   { axis: yAxis, angle:  Math.PI / 2, filter: c => c.position[1] < -0.2 },
  "D'":{ axis: yAxis, angle: -Math.PI / 2, filter: c => c.position[1] < -0.2 },
  D2:  { axis: yAxis, angle:  Math.PI,     filter: c => c.position[1] < -0.2 },
  F:   { axis: zAxis, angle: -Math.PI / 2, filter: c => c.position[2] >  0.2 },
  "F'":{ axis: zAxis, angle:  Math.PI / 2, filter: c => c.position[2] >  0.2 },
  F2:  { axis: zAxis, angle: -Math.PI,     filter: c => c.position[2] >  0.2 },
  B:   { axis: zAxis, angle:  Math.PI / 2, filter: c => c.position[2] < -0.2 },
  "B'":{ axis: zAxis, angle: -Math.PI / 2, filter: c => c.position[2] < -0.2 },
  B2:  { axis: zAxis, angle:  Math.PI,     filter: c => c.position[2] < -0.2 },
};

const rotateCubieData = (cubie, axis, angle) => {
  const q = new THREE.Quaternion().setFromAxisAngle(axis, angle);
  const p = new THREE.Vector3(...cubie.position).applyQuaternion(q);
  const cq = new THREE.Quaternion(...cubie.quaternion).premultiply(q);
  return {
    ...cubie,
    position: [Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100, Math.round(p.z * 100) / 100],
    quaternion: [cq.x, cq.y, cq.z, cq.w],
  };
};

const applyMoveToCubies = (cubies, move) => {
  const detail = MOVE_DETAILS[move];
  if (!detail) return cubies;
  return cubies.map(c => detail.filter(c) ? rotateCubieData(c, detail.axis, detail.angle) : c);
};

const getMoveFromDrag = (face, dir) => ({
  right:  { up: 'R',  down: "R'", right: "R'", left: 'R'  },
  left:   { up: "L'", down: 'L',  right: 'L',  left: "L'" },
  top:    { up: "U'", down: 'U',  right: 'U',  left: "U'" },
  bottom: { up: 'D',  down: "D'", right: "D'", left: 'D'  },
  front:  { up: 'F',  down: "F'", right: "F'", left: 'F'  },
  back:   { up: "B'", down: 'B',  right: 'B',  left: "B'" },
}[face]?.[dir] || null);


const DraggableCube = ({ children, onMove, setControlsEnabled, animationRef, isAnimating }) => {
  const { gl } = useThree();
  const dragStart = useRef(null);
  const [hoveredFace, setHoveredFace] = useState(null);

  useEffect(() => {
    const canvas = gl.domElement;

    const handlePointerDown = (e) => {
      if (isAnimating) return;
      
      if (hoveredFace) {
        dragStart.current = { x: e.clientX, y: e.clientY };
        setControlsEnabled(false);
        canvas.style.cursor = 'grabbing';
      }
    };

    // 2. Renombramos la función a handlePointerMove para que no pise a tu prop 'onMove'
    const handlePointerMove = (e) => {
      if (!dragStart.current || isAnimating) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      
      if (Math.abs(dx) > 25 || Math.abs(dy) > 25) {
        const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        if (hoveredFace) {
          const move = getMoveFromDrag(hoveredFace, dir);
          // SOLUCIÓN: Ahora sí estamos llamando a la propiedad onMove original que anima el cubo
          if (move) onMove(move); 
        }
        dragStart.current = null;
        setControlsEnabled(true);
        canvas.style.cursor = 'grab';
      }
    };

    const handlePointerUp = () => {
      dragStart.current = null;
      setControlsEnabled(true);
      canvas.style.cursor = hoveredFace ? 'grab' : 'default';
    };

    // Usamos los nuevos nombres de las funciones
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    
    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [gl, isAnimating, hoveredFace, onMove, setControlsEnabled]);

  return (
    <group>
      {React.Children.map(children, child =>
        React.isValidElement(child)
          ? React.cloneElement(child, { hoveredFace, setHoveredFace, isDragging: !!dragStart.current })
          : child
      )}
    </group>
  );
};

const Cubie = ({ data, hoveredFace, onHoverFace, onUnhoverFace, isDragging, animationRef }) => {
  const meshRef = useRef();

  const materials = useMemo(() => {
    const [ix, iy, iz] = data.initialPosition;
    return [
      ix >  0.2 ? FACE_COLORS.right  : '#141416',
      ix < -0.2 ? FACE_COLORS.left   : '#141416',
      iy >  0.2 ? FACE_COLORS.top    : '#141416',
      iy < -0.2 ? FACE_COLORS.bottom : '#141416',
      iz >  0.2 ? FACE_COLORS.front  : '#141416',
      iz < -0.2 ? FACE_COLORS.back   : '#141416',
    ].map(color => new THREE.MeshPhysicalMaterial({
      color, roughness: 0.18, metalness: 0.85, clearcoat: 0.4, clearcoatRoughness: 0.1,
    }));
  }, [data.initialPosition]);

  const [cx, cy, cz] = data.position;
  const isHighlighted =
    (hoveredFace === 'right'  && cx >  0.2) || (hoveredFace === 'left'   && cx < -0.2) ||
    (hoveredFace === 'top'    && cy >  0.2) || (hoveredFace === 'bottom' && cy < -0.2) ||
    (hoveredFace === 'front'  && cz >  0.2) || (hoveredFace === 'back'   && cz < -0.2);

  useEffect(() => {
    materials.forEach(mat => {
      if (mat.color.getHexString() !== '141416') {
        mat.emissive = new THREE.Color(mat.color);
        mat.emissiveIntensity = isHighlighted ? 0.35 : 0;
      }
    });
  }, [isHighlighted, materials]);

  useFrame(() => {
    if (!meshRef.current) return;
    const { move, startTime, duration } = animationRef.current;
    const detail = move ? MOVE_DETAILS[move] : null;

    if (detail && detail.filter(data)) {
      const t = Math.min((performance.now() - startTime) / duration, 1);
      const ease = t * (2 - t); // ease-out quad
      const q = new THREE.Quaternion().setFromAxisAngle(detail.axis, detail.angle * ease);
      meshRef.current.position.copy(new THREE.Vector3(...data.position).applyQuaternion(q));
      meshRef.current.quaternion.copy(new THREE.Quaternion(...data.quaternion).premultiply(q));
    } else {
      meshRef.current.position.fromArray(data.position);
      meshRef.current.quaternion.fromArray(data.quaternion);
    }
  });

  const handlePointerMove = useCallback((e) => {
    e.stopPropagation();
    if (isDragging || !meshRef.current || animationRef.current.move) return;
    const n = e.face.normal.clone().transformDirection(meshRef.current.matrixWorld).round();
    const side =
      n.x ===  1 ? 'right'  : n.x === -1 ? 'left' :
      n.y ===  1 ? 'top'    : n.y === -1 ? 'bottom' :
      n.z ===  1 ? 'front'  : n.z === -1 ? 'back' : null;
    if (side && side !== hoveredFace) { onHoverFace(side); document.body.style.cursor = 'grab'; }
  }, [hoveredFace, onHoverFace, isDragging, animationRef]);

  return (
    <mesh
      ref={meshRef} castShadow receiveShadow
      onPointerMove={handlePointerMove}
      onPointerOut={() => { onUnhoverFace(); if (!isDragging) document.body.style.cursor = 'default'; }}
      material={materials}
    >
      <boxGeometry args={[0.5, 0.5, 0.5]} />
    </mesh>
  );
};

const RubikGroup = ({ cubies, hoveredFace, setHoveredFace, isDragging, animationRef }) => (
  <group>
    {cubies.map(cubie => (
      <Cubie
        key={cubie.id} data={cubie}
        hoveredFace={hoveredFace}
        onHoverFace={setHoveredFace}
        onUnhoverFace={() => setHoveredFace(null)}
        isDragging={isDragging}
        animationRef={animationRef}
      />
    ))}
  </group>
);

const Cube = () => {
  const [isMounted, setIsMounted]         = useState(false);
  const [hoveredFace, setHoveredFace]     = useState(null);
  const [controlsEnabled, setControlsEnabled] = useState(true);
  const [cubies, setCubies]               = useState(INITIAL_CUBIES);
  const [isAnimating, setIsAnimating]     = useState(false);

  const [isSolving, setIsSolving]         = useState(false);
  const [solveQueue, setSolveQueue]       = useState([]);
  const [totalMoves, setTotalMoves]       = useState(0);
  const [solveSpeed, setSolveSpeed]       = useState(250); // ms por movimiento
  const [solverStatus, setSolverStatus]   = useState('idle'); // 'idle' | 'thinking' | 'solving' | 'done' | 'error'
  const [statusMsg, setStatusMsg]         = useState('');

  const animationRef = useRef({ move: null, startTime: 0, duration: 250 });
  const cubiesRef    = useRef(cubies);
  const solveRef     = useRef({ active: false }); // para cancelar mid-solve

  useEffect(() => { cubiesRef.current = cubies; }, [cubies]);

  useEffect(() => {
    setIsMounted(true);
    initSolver().catch(console.error);
  }, []);

  const animateMove = useCallback((move, duration) => {
    return new Promise(resolve => {
      setIsAnimating(true);
      animationRef.current = { move, startTime: performance.now(), duration };
      setTimeout(() => {
        setCubies(prev => applyMoveToCubies(prev, move));
        animationRef.current.move = null;
        setIsAnimating(false);
        resolve();
      }, duration);
    });
  }, []);

  const runSolveQueue = useCallback(async (moves, speed) => {
    for (let i = 0; i < moves.length; i++) {
      if (!solveRef.current.active) break; 
      setSolveQueue(moves.slice(i + 1));
      await animateMove(moves[i], speed);
      await new Promise(r => setTimeout(r, 30));
    }
    if (solveRef.current.active) {
      setSolverStatus('done');
      setStatusMsg('¡Cubo resuelto! 🎉');
      setTimeout(() => setSolverStatus('idle'), 3000);
    }
    solveRef.current.active = false;
    setIsSolving(false);
    setSolveQueue([]);
  }, [animateMove]);

  const handleSolve = useCallback(async () => {
    if (isAnimating || isSolving) return;
    setSolverStatus('thinking');
    setStatusMsg('Calculando solución…');
    setSolveQueue([]);

    try {
      const moves = await solveCube(cubiesRef.current);
      if (moves.length === 0) {
        setSolverStatus('idle');
        setStatusMsg('El cubo ya está resuelto.');
        setTimeout(() => setStatusMsg(''), 3000);
        return;
      }
      setTotalMoves(moves.length);
      setSolveQueue(moves);
      setSolverStatus('solving');
      setStatusMsg('');
      setIsSolving(true);
      solveRef.current.active = true;
      await runSolveQueue(moves, solveSpeed);
    } catch (err) {
      console.error('Solve error:', err);
      setSolverStatus('error');
      setStatusMsg('Error al calcular. Intenta de nuevo.');
      setTimeout(() => { setSolverStatus('idle'); setStatusMsg(''); }, 4000);
    }
  }, [isAnimating, isSolving, solveSpeed, runSolveQueue]);

  const handleCancel = useCallback(() => {
    solveRef.current.active = false;
    setIsSolving(false);
    setSolveQueue([]);
    setSolverStatus('idle');
    setStatusMsg('');
    animationRef.current.move = null;
    setIsAnimating(false);
  }, []);

  const handleManualMove = useCallback((move) => {
    if (isAnimating || isSolving) return;
    animateMove(move, solveSpeed);
  }, [isAnimating, isSolving, solveSpeed, animateMove]);

  const handleReset = useCallback(() => {
    handleCancel();
    setCubies(INITIAL_CUBIES);
    setSolverStatus('idle');
    setStatusMsg('');
    setTotalMoves(0);
  }, [handleCancel]);

  if (!isMounted) return <div style={{ width: '100%', height: 600 }} />;

  const movesLeft   = solveQueue.length;
  const movesPlayed = totalMoves - movesLeft;
  const progress    = totalMoves > 0 ? movesPlayed / totalMoves : 0;

  return (
    <div style={{ width: '100%', height: 600, position: 'relative' }}>

      

      {/* ── Estado del solver (thinking / solving / done / error) ── */}
      {solverStatus !== 'idle' && (
        <div style={{
          position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, zIndex: 10,
        }}>
          <div style={{
            background: solverStatus === 'error' ? 'rgba(127,0,0,0.85)' : 'rgba(0,0,0,0.8)',
            color: solverStatus === 'done' ? '#4ade80' : '#fff',
            padding: '7px 22px', borderRadius: 999, fontSize: 13, fontWeight: 500,
            backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            {solverStatus === 'thinking' && (
              <span style={{ color: '#facc15', animation: 'pulse 1s infinite' }}>⏳</span>
            )}
            {solverStatus === 'solving' && (
              <span style={{ color: '#4ade80' }}>●</span>
            )}
            {solverStatus === 'solving'
              ? `Resolviendo… ${movesPlayed} / ${totalMoves} movimientos`
              : statusMsg}
          </div>

          {/* Barra de progreso */}
          {solverStatus === 'solving' && (
            <div style={{
              width: 200, height: 4, background: 'rgba(255,255,255,0.15)',
              borderRadius: 999, overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', background: '#4ade80', borderRadius: 999,
                width: `${progress * 100}%`, transition: 'width 0.3s',
              }} />
            </div>
          )}
        </div>
      )}

      {/* ── Controles inferiores ── */}
      <div style={{
        position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, zIndex: 10,
      }}>
        {/* Slider de velocidad */}
        {!isSolving && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(0,0,0,0.5)', padding: '6px 14px',
            borderRadius: 8, backdropFilter: 'blur(6px)',
          }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>Rápido</span>
            <input
              type="range" min={80} max={600} step={20} value={solveSpeed}
              onChange={e => setSolveSpeed(Number(e.target.value))}
              style={{ width: 100, accentColor: '#4ade80' }}
            />
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>Lento</span>
          </div>
        )}

        {/* Botones */}
        <div style={{ display: 'flex', gap: 10 }}>
          {!isSolving ? (
            <>
              <button
                onClick={handleSolve}
                disabled={isAnimating || solverStatus === 'thinking'}
                style={{
                  background: '#16a34a', color: '#fff', border: 'none',
                  padding: '10px 24px', borderRadius: 999, fontWeight: 700,
                  fontSize: 14, cursor: 'pointer', opacity: isAnimating ? 0.5 : 1,
                  transition: 'all 0.2s',
                }}
              >
                ✨ Resolver
              </button>
              <button
                onClick={handleReset}
                disabled={isAnimating}
                style={{
                  background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none',
                  padding: '10px 20px', borderRadius: 999, fontWeight: 700,
                  fontSize: 14, cursor: 'pointer', opacity: isAnimating ? 0.5 : 1,
                  transition: 'all 0.2s', backdropFilter: 'blur(6px)',
                }}
              >
                🔄 Reset
              </button>
            </>
          ) : (
            <button
              onClick={handleCancel}
              style={{
                background: '#dc2626', color: '#fff', border: 'none',
                padding: '10px 24px', borderRadius: 999, fontWeight: 700,
                fontSize: 14, cursor: 'pointer',
              }}
            >
              ✕ Cancelar
            </button>
          )}
        </div>
      </div>

      {/* ── Canvas Three.js ── */}
      <Canvas shadows camera={{ position: [3.5, 3.5, 3.5], fov: 45 }}>
        <Environment preset="studio" intensity={1} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 8, 5]} intensity={1.8} castShadow />

        <Center>
          <DraggableCube
            onMove={handleManualMove}
            setControlsEnabled={setControlsEnabled}
            animationRef={animationRef}
            isAnimating={isAnimating}
          >
            <RubikGroup
              cubies={cubies}
              hoveredFace={hoveredFace}
              setHoveredFace={setHoveredFace}
              animationRef={animationRef}
            />
          </DraggableCube>
        </Center>

        <OrbitControls
          enabled={controlsEnabled && !isSolving}
          enableZoom
          enablePan={false}
          zoomSpeed={0.6}
          rotateSpeed={0.6}
        />
      </Canvas>
    </div>
  );
};

export default Cube;