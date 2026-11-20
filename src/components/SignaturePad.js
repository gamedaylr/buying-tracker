import React, { useEffect, useRef } from 'react';

export default function SignaturePad({ onChange, tall }) {
  const canvasRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const drawing = { active: false, dirty: false };
    const ctx = canvas.getContext('2d');

    function paintStyle() {
      const ratio = window.devicePixelRatio || 1;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1a1718';
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const ratio = window.devicePixelRatio || 1;
      const nextW = Math.max(1, Math.round(rect.width * ratio));
      const nextH = Math.max(1, Math.round(rect.height * ratio));
      if (canvas.width === nextW && canvas.height === nextH) {
        paintStyle();
        return;
      }
      const snapshot = drawing.dirty ? canvas.toDataURL() : '';
      canvas.width = nextW;
      canvas.height = nextH;
      paintStyle();
      if (snapshot) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, rect.width, rect.height);
        };
        img.src = snapshot;
      }
    }

    function point(event) {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    function start(event) {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      drawing.active = true;
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch (ignore) {
        // The pointer can end before capture on some browsers.
      }
      const p = point(event);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    }

    function move(event) {
      if (!drawing.active) return;
      event.preventDefault();
      const p = point(event);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      drawing.dirty = true;
    }

    function end() {
      if (!drawing.active) return;
      drawing.active = false;
      if (!drawing.dirty) return;
      canvas.toBlob((blob) => onChangeRef.current(blob), 'image/png');
    }

    resize();
    const observer = new ResizeObserver(() => resize());
    observer.observe(canvas);
    canvas.addEventListener('pointerdown', start, { passive: false });
    canvas.addEventListener('pointermove', move, { passive: false });
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    return () => {
      observer.disconnect();
      canvas.removeEventListener('pointerdown', start);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', end);
      canvas.removeEventListener('pointercancel', end);
    };
  }, []);

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1a1718';
    onChangeRef.current(null);
  }

  return (
    <div className="signature-wrap">
      <canvas ref={canvasRef} className={tall ? 'signature signature-tall' : 'signature'} />
      <p className="hint">Sign with a finger or a stylus.</p>
      <button type="button" className="btn btn-ghost" onClick={clear}>Clear signature</button>
    </div>
  );
}
