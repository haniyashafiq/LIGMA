import React, { useEffect, useState } from "react";
import "../styles/canvas.css";

export default function CursorLayer({ appRef }) {
  const [cursors, setCursors] = useState([]);

  useEffect(() => {
    let mounted = true;
    function onPointerMove(e) {
      if (!appRef || !appRef.current) return;
      const app = appRef.current;
      const point = app.viewportClientToWorld([e.clientX, e.clientY]);
      if (!mounted) return;
      setCursors([
        { id: "you", x: point[0], y: point[1], name: "You", color: "#4f46e5" },
      ]);
    }

    window.addEventListener("pointermove", onPointerMove);
    return () => {
      mounted = false;
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, [appRef]);

  return (
    <div className="cursor-layer">
      {cursors.map((c) => (
        <div
          key={c.id}
          className="cursor"
          style={{ transform: `translate(${c.x}px, ${c.y}px)` }}
        >
          <span className="cursor-dot" style={{ background: c.color }} />
          <span className="cursor-label">{c.name}</span>
        </div>
      ))}
    </div>
  );
}
