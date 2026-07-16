"use client";

import createGlobe from "cobe";
import { useEffect, useRef } from "react";

type GlobePost = { id: number; latitude: number | null; longitude: number | null; hearts: number };

export default function WorldGlobe({ posts }: { posts: GlobePost[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointer = useRef<number | null>(null);
  const drag = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let width = 0; let phi = 0; let dragStart = 0;
    const resize = () => { width = canvas.offsetWidth; };
    window.addEventListener("resize", resize); resize();
    const markers = posts.filter((post) => post.latitude != null && post.longitude != null).slice(0, 60).map((post) => ({ location: [post.latitude as number, post.longitude as number] as [number, number], size: Math.min(.11, .035 + Math.log2((post.hearts || 0) + 1) * .008), color: [1, .54, .68] as [number, number, number] }));
    const globe = createGlobe(canvas, {
      devicePixelRatio: Math.min(2, window.devicePixelRatio), width: width * 2, height: width * 2,
      phi: 0, theta: .12, dark: 0, diffuse: 1.35, scale: 1.06, mapSamples: 16000,
      mapBrightness: 5.5, baseColor: [.56, .72, .78], markerColor: [1, .48, .65], glowColor: [.96, .9, 1], markers,
      onRender: (state) => { if (pointer.current == null) phi += .0022; state.phi = phi + drag.current; state.width = width * 2; state.height = width * 2; },
    });
    const move = (clientX: number) => { if (pointer.current != null) drag.current = dragStart + (clientX - pointer.current) / 160; };
    const down = (clientX: number) => { pointer.current = clientX; dragStart = drag.current; canvas.style.cursor = "grabbing"; };
    const up = () => { pointer.current = null; canvas.style.cursor = "grab"; };
    const onPointerDown = (event: PointerEvent) => down(event.clientX);
    const onPointerMove = (event: PointerEvent) => move(event.clientX);
    const onTouchMove = (event: TouchEvent) => { if (event.touches[0]) move(event.touches[0].clientX); };
    canvas.addEventListener("pointerdown", onPointerDown); window.addEventListener("pointermove", onPointerMove); window.addEventListener("pointerup", up); canvas.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => { globe.destroy(); window.removeEventListener("resize", resize); canvas.removeEventListener("pointerdown", onPointerDown); window.removeEventListener("pointermove", onPointerMove); window.removeEventListener("pointerup", up); canvas.removeEventListener("touchmove", onTouchMove); };
  }, [posts]);

  return <div className="world-globe"><canvas ref={canvasRef} aria-label="可拖动的世界互助地图。粉色星点代表审核通过的匿名留言。" /><span>✦ drag to turn · 拖动地球 ✦</span></div>;
}
