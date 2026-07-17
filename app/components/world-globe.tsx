"use client";

import { geoDistance, geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import countriesAtlas from "world-atlas/countries-110m.json";
import { useEffect, useRef } from "react";

type GlobePost = { id: number; latitude: number | null; longitude: number | null; hearts: number };

const atlas = countriesAtlas as unknown as Topology<{ countries: GeometryCollection }>;
const countries = feature(atlas, atlas.objects.countries);
const borders = mesh(atlas, atlas.objects.countries, (a, b) => a !== b);

export default function WorldGlobe({ posts, language = "en", onSelect }: { posts: GlobePost[]; language?: "en" | "zh"; onSelect?: (id: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    let width = 0;
    let rotation = -105;
    let tilt = -12;
    let roll = 0;
    let pointer: { x: number; y: number; rotation: number; tilt: number; roll: number } | null = null;
    let lastTime = performance.now();
    let moved = false;
    let hitTargets: Array<{ id: number; x: number; y: number; radius: number }> = [];
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      width = Math.max(280, canvas.clientWidth);
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(width * ratio);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const draw = (time: number) => {
      const elapsed = Math.min(40, time - lastTime);
      lastTime = time;
      if (!pointer && !reducedMotion) rotation += elapsed * .0028;
      const ratio = canvas.width / width;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, width);

      const projection = geoOrthographic().translate([width / 2, width / 2]).scale(width * .41).clipAngle(90).precision(.25).rotate([rotation, tilt, roll]);
      const path = geoPath(projection, context);

      const halo = context.createRadialGradient(width / 2, width / 2, width * .22, width / 2, width / 2, width * .52);
      halo.addColorStop(0, "rgba(55, 224, 255, .08)"); halo.addColorStop(.72, "rgba(83, 105, 255, .13)"); halo.addColorStop(1, "rgba(83, 105, 255, 0)");
      context.fillStyle = halo; context.fillRect(0, 0, width, width);
      for (let i = 0; i < 42; i += 1) {
        const x = (i * 83 + 17) % width; const y = (i * 47 + 31) % width;
        const pulse = reducedMotion ? .34 : .22 + .35 * (1 + Math.sin(time * .0015 + i)) / 2;
        context.beginPath(); context.arc(x, y, i % 7 === 0 ? 1.35 : .7, 0, Math.PI * 2); context.fillStyle = `rgba(191,231,255,${pulse})`; context.fill();
      }
      context.save(); context.translate(width / 2, width / 2); context.rotate(reducedMotion ? 0 : time * .00004);
      context.beginPath(); context.ellipse(0, 0, width * .49, width * .15, -.22, 0, Math.PI * 2);
      context.lineWidth = 1; context.strokeStyle = "rgba(119, 232, 255, .35)"; context.stroke(); context.restore();

      context.beginPath(); path({ type: "Sphere" });
      const ocean = context.createRadialGradient(width * .36, width * .30, width * .04, width / 2, width / 2, width * .46);
      ocean.addColorStop(0, "#2b94bd"); ocean.addColorStop(.58, "#123f68"); ocean.addColorStop(1, "#071a3a");
      context.shadowBlur = 28; context.shadowColor = "rgba(90,226,255,.72)"; context.fillStyle = ocean; context.fill();
      context.shadowBlur = 0; context.lineWidth = 1.6; context.strokeStyle = "rgba(151,241,255,.92)"; context.stroke();

      context.beginPath(); path(geoGraticule10());
      context.lineWidth = .58; context.strokeStyle = "rgba(115, 221, 247, .28)"; context.stroke();

      context.beginPath(); path(countries);
      context.fillStyle = "rgba(47, 86, 116, .96)"; context.fill();
      context.lineWidth = .9; context.strokeStyle = "rgba(139, 235, 255, .76)"; context.stroke();

      context.beginPath(); path(borders);
      context.lineWidth = .62; context.strokeStyle = "rgba(120, 214, 239, .48)"; context.stroke();

      const centre = projection.invert?.([width / 2, width / 2]) || [0, 0];
      hitTargets = [];
      for (const post of posts.filter((item) => item.latitude != null && item.longitude != null).slice(0, 80)) {
        const point: [number, number] = [post.longitude as number, post.latitude as number];
        if (geoDistance(point, centre as [number, number]) > Math.PI / 2) continue;
        const projected = projection(point);
        if (!projected) continue;
        const radius = Math.min(9, 4 + Math.log2((post.hearts || 0) + 1) * .7);
        hitTargets.push({ id: post.id, x: projected[0], y: projected[1], radius: Math.max(14, radius * 2.2) });
        context.beginPath(); context.arc(projected[0], projected[1], radius * 2.2, 0, Math.PI * 2);
        context.fillStyle = "rgba(255, 119, 161, .18)"; context.fill();
        context.beginPath(); context.arc(projected[0], projected[1], radius, 0, Math.PI * 2);
        context.shadowBlur = 12; context.shadowColor = "#ff75bc"; context.fillStyle = "#ff8dc7"; context.fill(); context.shadowBlur = 0;
        context.lineWidth = 1.5; context.strokeStyle = "rgba(255,255,255,.95)"; context.stroke();
      }
      frame = requestAnimationFrame(draw);
    };

    const down = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY, rotation, tilt, roll };
      moved = false;
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = "grabbing";
    };
    const move = (event: PointerEvent) => {
      if (!pointer) return;
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      if (Math.abs(dx) + Math.abs(dy) > 7) moved = true;
      rotation = pointer.rotation + dx * .34;
      tilt = pointer.tilt - dy * .34;
      roll = pointer.roll + dx * dy * .00022;
    };
    const up = (event: PointerEvent) => {
      if (pointer && !moved && onSelect) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const hit = hitTargets.find((target) => Math.hypot(target.x - x, target.y - y) <= target.radius);
        if (hit) onSelect(hit.id);
      }
      pointer = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      canvas.style.cursor = "grab";
    };

    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
    };
  }, [onSelect, posts]);

  return <div className="world-globe"><canvas ref={canvasRef} aria-label={language === "zh" ? "可以向任意方向拖动的地球；小星星代表审核通过的匿名留言。" : "A freely rotatable globe. Small stars represent approved anonymous community messages."} /><span>{language === "zh" ? "✦ 向任意方向拖动地球 ✦" : "✦ Drag in any direction to explore ✦"}</span></div>;
}
