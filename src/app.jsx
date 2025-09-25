import React, { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

function useResizeCanvas(canvasRef) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handle = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      const ctx = canvas.getContext('2d');
      ctx.scale(ratio, ratio);
    };
    handle();
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, [canvasRef]);
}

export default function App() {
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const drawingRef = useRef(false);
  const [color, setColor] = useState('#000');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [users, setUsers] = useState([]);

  useResizeCanvas(canvasRef);

  useEffect(() => {
    const s = io(SERVER_URL);
    socketRef.current = s;

    s.on('init', (payload) => {
      setColor(payload.color);
    });

    s.on('user_joined', (u) => setUsers(prev => [...prev, u]));
    s.on('user_left', (u) => setUsers(prev => prev.filter(x => x.id !== u.id)));

    s.on('draw', (data) => {
      drawPath(data.path, data.color, data.strokeWidth);
    });

    s.on('clear', () => {
      clearLocalCanvas();
    });

    s.on('room_full', () => {
      alert('La sala está llena (máx 4 usuarios).');
    });

    return () => s.disconnect();
  }, []);

  const getCtx = () => canvasRef.current.getContext('2d');

  const drawPoint = (pt, c, w) => {
    const ctx = getCtx();
    if (!ctx) return;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(pt[0].x, pt[0].y);
    for (let i = 1; i < pt.length; i++) ctx.lineTo(pt[i].x, pt[i].y);
    ctx.stroke();
  }

  const drawPath = (path, c, w) => {
    drawPoint(path, c, w);
  }

  const clearLocalCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    ctx.clearRect(0,0,canvas.width,canvas.height);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = () => canvas.getBoundingClientRect();
    let currentPath = [];

    const toLocal = (e) => {
      const r = rect();
      const clientX = e.clientX ?? (e.touches && e.touches[0].clientX);
      const clientY = e.clientY ?? (e.touches && e.touches[0].clientY);
      return { x: (clientX - r.left), y: (clientY - r.top) };
    }

    const down = (e) => {
      drawingRef.current = true;
      currentPath = [toLocal(e)];
    }
    const move = (e) => {
      if (!drawingRef.current) return;
      const p = toLocal(e);
      currentPath.push(p);
      drawPath(currentPath.slice(-2), color, strokeWidth);
      e.preventDefault();
    }
    const up = () => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      if (socketRef.current) {
        socketRef.current.emit('draw', { path: currentPath, color, strokeWidth });
      }
      currentPath = [];
    }

    canvas.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move, { passive:false });
    window.addEventListener('pointerup', up);

    canvas.addEventListener('touchstart', down, { passive:false });
    window.addEventListener('touchmove', move, { passive:false });
    window.addEventListener('touchend', up);

    return () => {
      canvas.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      canvas.removeEventListener('touchstart', down);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
    }
  }, [color, strokeWidth]);

  const handleClear = () => {
    clearLocalCanvas();
    if (socketRef.current) socketRef.current.emit('clear');
  }

  return (
    <div className="app">
      <div className="sidebar">
        <h3>Pizarra</h3>
        <div>Tu color:</div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <div className="color-dot" style={{background: color}}></div>
          <div>{color}</div>
        </div>

        <div>Grosor</div>
        <input type="range" min={1} max={12} value={strokeWidth} onChange={e=>setStrokeWidth(Number(e.target.value))} />

        <button className="button" onClick={handleClear}>Borrar</button>

        <div>Usuarios conectados: {users.length + 1}</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {[...users, {id: 'yo', color}].map(u => (
            <div key={u.id} style={{display:'flex',alignItems:'center',gap:6}}>
              <div className="color-dot" style={{background: u.color}}></div>
              <div style={{fontSize:12}}>{u.id === 'yo' ? 'Tú' : u.id.slice(0,5)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="canvas-wrap">
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}
