/**
 * Win95-style tooltip.
 *
 * Usage:
 *   <Tooltip text="Save (Ctrl+S)">
 *     <button ...>💾</button>
 *   </Tooltip>
 *
 * Renders its children unchanged. After hovering for `delay` ms a small
 * yellow tooltip box appears near the cursor, rendered via a portal so it
 * is never clipped by overflow:hidden ancestors.
 */
import { useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

const DELAY = 600; // ms before tooltip appears

export default function Tooltip({ text, children, delay = DELAY }) {
  const [pos, setPos] = useState(null); // null = hidden, { x, y } = visible
  const timerRef = useRef(null);

  const show = useCallback(e => {
    const { clientX, clientY } = e;
    timerRef.current = setTimeout(() => {
      setPos({ x: clientX + 14, y: clientY + 18 });
    }, delay);
  }, [delay]);

  const hide = useCallback(() => {
    clearTimeout(timerRef.current);
    setPos(null);
  }, []);

  const move = useCallback(e => {
    if (pos) setPos({ x: e.clientX + 14, y: e.clientY + 18 });
  }, [pos]);

  if (!text) return children;

  return (
    <span
      onMouseEnter={show}
      onMouseLeave={hide}
      onMouseMove={move}
      onMouseDown={hide}   // dismiss on click
      style={{ display: 'contents' }}
    >
      {children}
      {pos && createPortal(
        <div style={{
          position: 'fixed',
          left: pos.x,
          top: pos.y,
          background: '#ffffcc',
          border: '1px solid #000000',
          padding: '2px 5px',
          fontSize: 11,
          fontFamily: 'var(--font-pixel)',
          letterSpacing: '0.02em',
          color: '#000',
          pointerEvents: 'none',
          zIndex: 99999,
          whiteSpace: 'nowrap',
          lineHeight: 1.4,
        }}>
          {text}
        </div>,
        document.body
      )}
    </span>
  );
}
