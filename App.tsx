import React, { useState, useEffect, useRef } from 'react';
import { LayoutGroup } from 'framer-motion';
import { ModuleID } from './types';
import { CentralCommand } from './components/SolarNavigation';
import { SystemFrame } from './components/ui/Card';

// Modules
import { OverviewModule } from './components/Dashboard';
import { NetworkModule } from './components/DataGrid';
import { LogicModule } from './components/ProcessFlow';
import { AnalyticsModule } from './components/ControlPanel';

const App: React.FC = () => {
  const [activeModule, setActiveModule] = useState<ModuleID | null>(null);
  const [time, setTime] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => {
        setTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Topographic Datascape Background Simulation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let frame = 0;

    const resize = () => {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
    };
    window.addEventListener('resize', resize);
    resize();

    // 3D Projection Config
    const fov = 400;
    const gridRows = 60;
    const gridCols = 60;
    const spacing = 40;
    
    // Terrain offset
    const camY = -200; 

    const project = (x: number, y: number, z: number) => {
        const scale = fov / (fov + z);
        const x2d = (x * scale) + width / 2;
        const y2d = (y * scale) + height / 2;
        return { x: x2d, y: y2d, scale };
    };

    const animate = () => {
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, width, height);

        const time = frame * 0.01;
        const rotationAngle = frame * 0.001; // Very slow rotation

        ctx.lineWidth = 1;
        
        // Calculate Points
        const points = [];
        for (let r = 0; r < gridRows; r++) {
            const row = [];
            for (let c = 0; c < gridCols; c++) {
                // 1. Center the grid
                const xBase = (c - gridCols / 2) * spacing;
                const zBase = (r - gridRows / 2) * spacing;

                // 2. Undulation (Breathing effect)
                // We calculate Y before rotation so the waves travel naturally across the mesh
                const yBase = camY + 
                             Math.sin(c * 0.15 + time) * 30 + 
                             Math.cos(r * 0.15 + time) * 30;

                // 3. Apply Rotation around Y-axis
                const xRot = xBase * Math.cos(rotationAngle) - zBase * Math.sin(rotationAngle);
                const zRot = xBase * Math.sin(rotationAngle) + zBase * Math.cos(rotationAngle);

                // 4. Push away from camera (Z-offset)
                const zFinal = zRot + 1500; 
                const xFinal = xRot;

                const proj = project(xFinal, yBase, zFinal);
                
                // 5. Fog / Depth Dimming
                // Based on distance from center (radius) plus Z depth
                const dist = Math.sqrt(xRot*xRot + zRot*zRot);
                const alpha = Math.max(0, 0.8 - (dist / 1500));
                
                row.push({ ...proj, alpha, z: zFinal });
            }
            points.push(row);
        }

        // Draw Horizontal Lines
        for (let r = 0; r < points.length; r++) {
            const row = points[r];
            ctx.beginPath();
            let started = false;
            for (let c = 0; c < row.length; c++) {
                const p = row[c];
                if (p.z < 10) continue; 

                if (!started) {
                    ctx.moveTo(p.x, p.y);
                    started = true;
                } else {
                    ctx.lineTo(p.x, p.y);
                }
            }
            ctx.strokeStyle = `rgba(60, 60, 60, ${row[Math.floor(row.length/2)].alpha * 0.6})`;
            ctx.stroke();
        }

        // Draw Vertical Lines
        for (let c = 0; c < gridCols; c++) {
            ctx.beginPath();
            let started = false;
            for (let r = 0; r < points.length; r++) {
                const p = points[r][c];
                if (p.z < 10) continue;

                if (!started) {
                    ctx.moveTo(p.x, p.y);
                    started = true;
                } else {
                    ctx.lineTo(p.x, p.y);
                }
            }
            // Vertical lines slightly dimmer and accented
            const midAlpha = points[Math.floor(points.length/2)][c].alpha;
            ctx.strokeStyle = `rgba(255, 51, 0, ${midAlpha * 0.15})`; 
            ctx.stroke();
        }

        frame++;
        animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
        window.removeEventListener('resize', resize);
        cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="h-screen w-screen bg-sys-bg text-sys-text relative overflow-hidden selection:bg-sys-accent selection:text-black font-sans">
      {/* Background Layers */}
      <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none" />
      
      <div className="noise-overlay" />
      <div className="vignette" />
      <div className="scanline-overlay" />

      {/* 
        TACTICAL VISOR HUD 
        SVG overlay for the "screen" effect
      */}
      <svg className="fixed inset-0 z-50 pointer-events-none w-full h-full opacity-60">
        <defs>
            <pattern id="ruler" x="0" y="0" width="10" height="40" patternUnits="userSpaceOnUse">
                <rect x="0" y="0" width="10" height="1" fill="#444" />
                <rect x="0" y="10" width="5" height="1" fill="#333" />
                <rect x="0" y="20" width="5" height="1" fill="#333" />
                <rect x="0" y="30" width="5" height="1" fill="#333" />
            </pattern>
        </defs>
        
        {/* Corners Brackets */}
        <path d="M 40 80 V 40 H 80" fill="none" stroke="#FF3300" strokeWidth="2" />
        <path d="M 40 40 L 55 25" fill="none" stroke="#FF3300" strokeWidth="1" opacity="0.5" />
        
        <path d="M calc(100% - 80px) 40 H calc(100% - 40px) V 80" fill="none" stroke="#FF3300" strokeWidth="2" />
        <path d="M calc(100% - 40px) 40 L calc(100% - 55px) 25" fill="none" stroke="#FF3300" strokeWidth="1" opacity="0.5" />
        
        <path d="M 40 calc(100% - 80px) V calc(100% - 40px) H 80" fill="none" stroke="#FF3300" strokeWidth="2" />
        
        <path d="M calc(100% - 80px) calc(100% - 40px) H calc(100% - 40px) V calc(100% - 80px)" fill="none" stroke="#FF3300" strokeWidth="2" />

        {/* Side Rulers */}
        <rect x="20" y="150" width="10" height="calc(100% - 300px)" fill="url(#ruler)" opacity="0.5" />
        <rect x="calc(100% - 30px)" y="150" width="10" height="calc(100% - 300px)" fill="url(#ruler)" opacity="0.5" />
        
        {/* Center Crosshair (Subtle) */}
        <path d="M calc(50% - 20px) 50% H calc(50% - 5px)" stroke="#333" strokeWidth="1" />
        <path d="M calc(50% + 5px) 50% H calc(50% + 20px)" stroke="#333" strokeWidth="1" />
        <path d="M 50% calc(50% - 20px) V calc(50% - 5px)" stroke="#333" strokeWidth="1" />
        <path d="M 50% calc(50% + 5px) V calc(50% + 20px)" stroke="#333" strokeWidth="1" />

        {/* HUD Text Labels */}
        <text x="50" y="30" fill="#FF3300" fontSize="10" fontFamily="monospace" letterSpacing="2">SYS.ZERO // TACTICAL_CORE</text>
        <text x="calc(100% - 150px)" y="30" fill="#444" fontSize="10" fontFamily="monospace">NET: CONNECTED</text>
        <text x="50" y="calc(100% - 20px)" fill="#444" fontSize="10" fontFamily="monospace">COORDS: 34.0522° N, 118.2437° W</text>
      </svg>
      
      {/* Top Bar Background */}
      <div className="fixed top-0 left-0 w-full h-12 bg-gradient-to-b from-black/80 to-transparent z-40 pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-full h-12 bg-gradient-to-t from-black/80 to-transparent z-40 pointer-events-none" />

      {/* Main Grid Layout */}
      <LayoutGroup>
        <main className="relative z-30 w-full h-full flex flex-col items-center justify-center p-4 md:p-8">
            {/* 
              CENTRAL NAVIGATION 
              Handles the "Eclipse" transition and menu state
            */}
            <CentralCommand 
                activeModule={activeModule}
                onActivate={setActiveModule}
                onReset={() => setActiveModule(null)}
            />

            {/* 
              MODULES
              They only render when active to save resources, 
              but the SystemFrame handles the expansion animation.
            */}
            <div className={`
                fixed inset-8 md:inset-16 z-30 transition-all duration-500 pointer-events-none
                ${activeModule ? 'opacity-100' : 'opacity-0'}
            `}>
                <div className="w-full h-full pointer-events-auto">
                    {activeModule === ModuleID.OVERVIEW && (
                        <SystemFrame title="System Overview" isActive={true} onClose={() => setActiveModule(null)}>
                            <OverviewModule />
                        </SystemFrame>
                    )}
                    {activeModule === ModuleID.NETWORK && (
                        <SystemFrame title="Network Topology" isActive={true} onClose={() => setActiveModule(null)}>
                            <NetworkModule />
                        </SystemFrame>
                    )}
                    {activeModule === ModuleID.LOGIC && (
                        <SystemFrame title="Logic Gates" isActive={true} onClose={() => setActiveModule(null)}>
                            <LogicModule />
                        </SystemFrame>
                    )}
                    {activeModule === ModuleID.ANALYTICS && (
                        <SystemFrame title="Deep Analytics" isActive={true} onClose={() => setActiveModule(null)}>
                            <AnalyticsModule />
                        </SystemFrame>
                    )}
                </div>
            </div>
        </main>
      </LayoutGroup>
    </div>
  );
};

export default App;