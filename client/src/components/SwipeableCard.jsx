import { useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';

const REVEAL = 80;       // px die aufgedeckt werden
const AUTO_DELETE = 200; // px für automatisches Löschen

export default function SwipeableCard({ onDelete, children }) {
  const startX = useRef(null);
  const [offset, setOffset] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const movedRef = useRef(false);

  function onTouchStart(e) {
    startX.current = e.touches[0].clientX;
    movedRef.current = false;
    setDragging(true);
  }

  function onTouchMove(e) {
    if (startX.current === null) return;
    const delta = e.touches[0].clientX - startX.current;
    if (Math.abs(delta) > 4) movedRef.current = true;
    const base = revealed ? -REVEAL : 0;
    // Nur nach links swipebar, leichter Widerstand nach rechts wenn nicht revealed
    const raw = base + delta;
    setOffset(Math.min(raw > 0 ? raw * 0.15 : raw, 0));
  }

  function onTouchEnd(e) {
    if (startX.current === null) return;
    const delta = e.changedTouches[0].clientX - startX.current;
    const base = revealed ? -REVEAL : 0;
    const total = base + delta;
    startX.current = null;
    setDragging(false);

    if (total <= -AUTO_DELETE) {
      triggerDelete();
    } else if (total <= -(REVEAL / 2)) {
      setOffset(-REVEAL);
      setRevealed(true);
    } else {
      setOffset(0);
      setRevealed(false);
    }
  }

  function triggerDelete() {
    setDeleting(true);
    setOffset(-window.innerWidth);
    setTimeout(onDelete, 280);
  }

  function onCardTap() {
    // Tap auf die Karte schließt die Delete-Zone wieder
    if (revealed && !movedRef.current) {
      setOffset(0);
      setRevealed(false);
    }
  }

  const transition = dragging
    ? 'none'
    : `transform ${deleting ? '0.28s' : '0.22s'} cubic-bezier(0.4,0,0.2,1), opacity 0.28s ease`;

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Delete-Hintergrund */}
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-center gap-1.5 bg-red-500 rounded-xl select-none cursor-pointer"
        style={{ width: REVEAL + 20 }}
        onClick={triggerDelete}
      >
        <Trash2 size={15} className="text-white" strokeWidth={2} />
        <span className="text-white text-xs font-semibold">Löschen</span>
      </div>

      {/* Karte */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={onCardTap}
        style={{
          transform: `translateX(${offset}px)`,
          transition,
          opacity: deleting ? 0 : 1,
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </div>
  );
}
