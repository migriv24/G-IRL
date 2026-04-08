/**
 * LossChart — canvas-based loss curve drawn without any chart library.
 * Renders training loss over iterations with a Win95 inset-well aesthetic.
 */
import { useEffect, useRef } from 'react';

export default function LossChart({ lossCurve = [], isTraining = false }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width  = canvas.offsetWidth  * window.devicePixelRatio;
    const H = canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, w, h);

    if (lossCurve.length < 2) {
      ctx.fillStyle = '#444';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('No loss data yet', w / 2, h / 2);
      return;
    }

    const pad = { top: 12, right: 12, bottom: 20, left: 42 };
    const pw = w - pad.left - pad.right;
    const ph = h - pad.top  - pad.bottom;

    const minV = Math.min(...lossCurve);
    const maxV = Math.max(...lossCurve);
    const range = maxV - minV || 1;

    const toX = (i) => pad.left + (i / (lossCurve.length - 1)) * pw;
    const toY = (v) => pad.top  + ph - ((v - minV) / range) * ph;

    // Grid lines
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (ph / 4) * i;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + pw, y); ctx.stroke();
    }

    // Axis labels
    ctx.fillStyle = '#555';
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const v = maxV - (range / 4) * i;
      const y = pad.top + (ph / 4) * i;
      ctx.fillText(v.toFixed(3), pad.left - 4, y + 3);
    }
    ctx.textAlign = 'center';
    ctx.fillText('iter', pad.left + pw / 2, h - 4);
    ctx.fillText(lossCurve.length, pad.left + pw, h - 4);
    ctx.fillText('0', pad.left, h - 4);

    // Area under curve (glow fill)
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ph);
    grad.addColorStop(0, 'rgba(100,50,255,0.25)');
    grad.addColorStop(1, 'rgba(100,50,255,0.0)');
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(lossCurve[0]));
    lossCurve.forEach((v, i) => ctx.lineTo(toX(i), toY(v)));
    ctx.lineTo(toX(lossCurve.length - 1), pad.top + ph);
    ctx.lineTo(pad.left, pad.top + ph);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Main line
    ctx.beginPath();
    ctx.strokeStyle = isTraining ? '#ff8844' : '#8844ff';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    lossCurve.forEach((v, i) => {
      i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v));
    });
    ctx.stroke();

    // End dot
    const lastX = toX(lossCurve.length - 1);
    const lastY = toY(lossCurve[lossCurve.length - 1]);
    ctx.beginPath();
    ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
    ctx.fillStyle = isTraining ? '#ff8844' : '#cc88ff';
    ctx.fill();

  }, [lossCurve, isTraining]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}
