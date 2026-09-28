"use client";

import { useEffect, useRef } from "react";

/*
  Het šahovnica-veld: een levend 3D-raster van tegels, rood en wit zoals het
  wapen, dat golft als de Adriatische zee. Waar de cursor komt, rijzen de
  tegels op en vangen ze het blauw van het accent; een klik of tik stuurt een
  rimpeling door het veld.

  Een groet aan Nove tendencije (Zagreb, 1961–1973): kinetische rasters en de
  eerste computerkunst van Europa. Hier dus letterlijk: computerkunst uit een
  raster, in beweging.

  Techniek, en waarom zo:
  - Ruwe WebGL2 met instancing: één kubus, 900 keer getekend in één draw call.
    Geen three.js — dat zou 150 kB toevoegen voor één kubus.
  - Tekent alleen als het veld in beeld is en het tabblad zichtbaar is.
  - Pixelverhouding begrensd op 1.75: scherp genoeg, zonder de GPU van een
    laptop te laten blazen.
  - Minder beweging: één stilstaand beeld, geen lus. Geen WebGL2: het vlak
    blijft gewoon leeg, de pagina werkt hetzelfde.
  - De kleuren komen uit de thematokens en worden opnieuw gelezen als het
    thema wisselt, zodat het veld in licht en donker bij de pagina hoort.
*/

const N = 30;

const VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNor;
uniform mat4 uViewProj;
uniform float uTime;
uniform vec3 uPointer;   // x, z in rastermaten, w = sterkte
uniform vec4 uRipple;    // x, z, starttijd, sterkte
uniform float uLit;      // hoeveel tegels vanuit het midden "verdiend" zijn
out vec3 vNor;
out vec3 vWorld;
flat out float vChecker;
out float vLift;
out float vEarned;

void main() {
  int i = gl_InstanceID % ${N};
  int j = gl_InstanceID / ${N};
  vec2 cell = vec2(float(i), float(j)) - float(${N - 1}) * 0.5;
  float d = length(cell);
  // Een rond eiland van tegels in een blauw vlak: de cirkel in het vierkant,
  // het oudste motief van de Zagrebse affiche. Tegels buiten de cirkel vallen
  // buiten beeld; een harde rand, geen vervaging.
  if (d > 10.5) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  // De zee: twee golven die elkaar kruisen, plus een trage deining.
  float wave = sin(d * 0.62 - uTime * 1.15) * 0.5
             + sin(cell.x * 0.45 + uTime * 0.7) * 0.25
             + cos(cell.y * 0.38 - uTime * 0.55) * 0.25;

  // De cursor tilt de tegels eromheen op.
  vec2 dp = cell - uPointer.xy;
  float lift = uPointer.z * exp(-dot(dp, dp) * 0.09);

  // De rimpeling van een klik: een ring die uitdijt en uitdooft.
  float age = uTime - uRipple.z;
  float rd = length(cell - uRipple.xy);
  float ring = uRipple.w * exp(-age * 1.4) * exp(-pow(rd - age * 7.0, 2.0) * 0.35);

  float h = 0.28 + (wave * 0.5 + 0.5) * 0.75 + lift * 2.2 + ring * 1.6;

  // Verdiende tegels (het dagdoel) staan iets hoger en gloeien.
  float earned = step(d, uLit);

  vec3 p = aPos;
  p.y = (p.y + 0.5) * (h + earned * 0.35);
  p.xz *= 0.86;
  vec3 world = vec3(cell.x + p.x, p.y, cell.y + p.z);

  vWorld = world;
  vNor = aNor;
  vChecker = mod(float(i + j), 2.0);
  vLift = clamp(lift + ring, 0.0, 1.0);
  vEarned = earned;
  gl_Position = uViewProj * vec4(world, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec3 vNor;
in vec3 vWorld;
flat in float vChecker;
in float vLift;
in float vEarned;
uniform vec3 uRed;
uniform vec3 uWhite;
uniform vec3 uAccent;
uniform vec3 uFog;
uniform vec3 uEye;
uniform float uDark;
uniform float uFogNear;
out vec4 outColor;

void main() {
  vec3 base = mix(uRed, uWhite, vChecker);
  // Affichebelichting: geen verloop, drie vlakke tinten per blok — boven vol,
  // de zijkanten in twee vaste stappen donkerder, zoals gezeefdrukte kubussen.
  float top = step(0.5, vNor.y);
  float side = abs(vNor.x) > 0.5 ? 0.68 : 0.5;
  float shade = top > 0.5 ? 1.0 : side;
  vec3 col = base * shade;

  // Opgetilde tegels vangen het accent — sterker in het donker, waar het
  // licht is in plaats van kleur.
  // Opgetilde tegels krijgen de derde kleur, hard omgeslagen in plaats van
  // geleidelijk: een tegel is geel of niet.
  float lifted = step(0.35, vLift);
  col = mix(col, uAccent * mix(side, 1.0, top), lifted);
  // Verdiende tegels (het dagdoel) staan hoger en zijn ook geel.
  col = mix(col, uAccent * mix(side, 1.0, top), vEarned);

  // Mist: het veld lost op in de kaart eromheen.
  float dist = length(vWorld - uEye);
  float fog = smoothstep(uFogNear + 4.0, uFogNear + 16.0, dist);
  float edge = 0.0;
  col = mix(col, uFog, clamp(max(fog, edge), 0.0, 1.0));
  outColor = vec4(col, 1.0);
}`;

/* Kubus: 6 kanten × 2 driehoeken, met normalen. */
function cube(): Float32Array {
  const faces: [number[], number[][]][] = [
    [[0, 1, 0], [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]]],
    [[0, -1, 0], [[-1, -1, 1], [1, -1, 1], [1, -1, -1], [-1, -1, -1]]],
    [[1, 0, 0], [[1, -1, -1], [1, -1, 1], [1, 1, 1], [1, 1, -1]]],
    [[-1, 0, 0], [[-1, -1, 1], [-1, -1, -1], [-1, 1, -1], [-1, 1, 1]]],
    [[0, 0, 1], [[-1, -1, 1], [-1, 1, 1], [1, 1, 1], [1, -1, 1]]],
    [[0, 0, -1], [[1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, -1]]],
  ];
  const out: number[] = [];
  for (const [n, q] of faces) {
    for (const k of [0, 1, 2, 0, 2, 3]) out.push(q[k][0] / 2, q[k][1] / 2, q[k][2] / 2, n[0], n[1], n[2]);
  }
  return new Float32Array(out);
}

type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Perspectief × kijkrichting, kolomgewijs zoals WebGL het wil. */
function viewProj(eye: V3, target: V3, fovY: number, aspect: number): Float32Array {
  const f = norm(sub(target, eye));
  const r = norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const t = 1 / Math.tan(fovY / 2);
  const near = 0.5;
  const far = 60;
  const view = [
    r[0], u[0], -f[0], 0,
    r[1], u[1], -f[1], 0,
    r[2], u[2], -f[2], 0,
    -(r[0] * eye[0] + r[1] * eye[1] + r[2] * eye[2]),
    -(u[0] * eye[0] + u[1] * eye[1] + u[2] * eye[2]),
    f[0] * eye[0] + f[1] * eye[1] + f[2] * eye[2],
    1,
  ];
  const proj = [
    t / aspect, 0, 0, 0,
    0, t, 0, 0,
    0, 0, (far + near) / (near - far), -1,
    0, 0, (2 * far * near) / (near - far), 0,
  ];
  const m = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let rr = 0; rr < 4; rr++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += proj[k * 4 + rr] * view[c * 4 + k];
      m[c * 4 + rr] = s;
    }
  return m;
}

function cssColor(name: string, fallback: V3): V3 {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const m = /^#([0-9a-f]{6})$/i.exec(v);
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn("šahovnica-veld:", gl.getShaderInfoLog(sh));
    return null;
  }
  return sh;
}

export function SahovnicaVeld({
  className = "",
  earned = 0,
  fog = "--color-surface",
  tileA = "--color-crvena",
  tileB = "--color-papir",
  lift = "--color-zuta",
}: {
  className?: string;
  /** Aandeel van het dagdoel dat gehaald is (0–1): zoveel tegels staan vanuit het midden hoger. */
  earned?: number;
  /** Het token waarin het veld oplost — de kleur van het vlak eromheen. */
  fog?: string;
  /** Tokens voor de twee tegelkleuren en de kleur van opgetilde tegels. */
  tileA?: string;
  tileB?: string;
  lift?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    const host = wrap.current;
    if (!el || !host) return;
    const gl = el.getContext("webgl2", { antialias: true, alpha: false, powerPreference: "low-power" });
    if (!gl) return;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, cube(), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    gl.enable(gl.DEPTH_TEST);

    const U = (n: string) => gl.getUniformLocation(prog, n);
    const uViewProj = U("uViewProj");
    const uTime = U("uTime");
    const uPointer = U("uPointer");
    const uRipple = U("uRipple");
    const uLit = U("uLit");
    const uRed = U("uRed");
    const uWhite = U("uWhite");
    const uAccent = U("uAccent");
    const uFog = U("uFog");
    const uEye = U("uEye");
    const uDark = U("uDark");
    const uFogNear = U("uFogNear");

    let fogColor: V3 = [1, 1, 1];
    const readColors = () => {
      const dark = document.documentElement.dataset.theme === "dark";
      fogColor = cssColor(fog, dark ? [0.08, 0.09, 0.11] : [0.99, 0.99, 0.98]);
      gl.uniform3fv(uRed, cssColor(tileA, [0.83, 0.1, 0.06]));
      gl.uniform3fv(uWhite, cssColor(tileB, dark ? [0.07, 0.07, 0.07] : [0.98, 0.98, 0.97]));
      gl.uniform3fv(uAccent, cssColor(lift, [1, 0.81, 0.1]));
      gl.uniform3fv(uFog, fogColor);
      gl.uniform1f(uDark, dark ? 1 : 0);
      gl.clearColor(fogColor[0], fogColor[1], fogColor[2], 1);
    };
    readColors();

    // Hoeveel tegels vanuit het midden "verdiend" zijn: de straal groeit met de
    // wortel, zodat de oppervlakte lineair met het dagdoel meeloopt.
    gl.uniform1f(uLit, earned > 0 ? 1 + Math.sqrt(Math.min(1, earned)) * 4.2 : -1);

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fovY = (34 * Math.PI) / 180;
    let aspect = 1;
    let eye: V3 = [0, 9.5, 13];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      const w = Math.max(1, Math.round(host.clientWidth * dpr));
      const h = Math.max(1, Math.round(host.clientHeight * dpr));
      if (el.width !== w || el.height !== h) {
        el.width = w;
        el.height = h;
      }
      aspect = w / h;
      gl.viewport(0, 0, w, h);
    };
    resize();

    // Cursor en camera worden gedempt nagestuurd: zonder demping voelt een
    // 3D-scène die aan de muis hangt kunstmatig.
    const pointer = { x: 0, z: 0, on: 0, tx: 0, tz: 0, ton: 0, px: 0, py: 0, cx: 0, cy: 0 };
    const ripple = { x: 0, z: 0, t: -100, s: 0 };

    const toGrid = (clientX: number, clientY: number) => {
      const rect = host.getBoundingClientRect();
      const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((clientY - rect.top) / rect.height) * 2 - 1);
      const f = norm(sub([0, 0, 0], eye));
      const r = norm(cross(f, [0, 1, 0]));
      const u = cross(r, f);
      const th = Math.tan(fovY / 2);
      const dir = norm([
        f[0] + nx * th * aspect * r[0] + ny * th * u[0],
        f[1] + nx * th * aspect * r[1] + ny * th * u[1],
        f[2] + nx * th * aspect * r[2] + ny * th * u[2],
      ]);
      const t = (0.8 - eye[1]) / dir[1];
      return { x: eye[0] + dir[0] * t, z: eye[2] + dir[2] * t, nx, ny };
    };

    const onMove = (e: PointerEvent) => {
      const g = toGrid(e.clientX, e.clientY);
      pointer.tx = g.x;
      pointer.tz = g.z;
      pointer.ton = 1;
      pointer.px = g.nx;
      pointer.py = g.ny;
      if (!running) draw(performance.now());
    };
    const onLeave = () => {
      pointer.ton = 0;
      pointer.px = 0;
      pointer.py = 0;
    };
    const start = performance.now();
    const onDown = (e: PointerEvent) => {
      const g = toGrid(e.clientX, e.clientY);
      ripple.x = g.x;
      ripple.z = g.z;
      ripple.t = (performance.now() - start) / 1000;
      ripple.s = 1;
    };
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    host.addEventListener("pointerdown", onDown);

    const draw = (now: number) => {
      const t = reduced ? 2.4 : (now - start) / 1000;
      const k = 0.08;
      pointer.x += (pointer.tx - pointer.x) * k * 2;
      pointer.z += (pointer.tz - pointer.z) * k * 2;
      pointer.on += (pointer.ton - pointer.on) * k;
      pointer.cx += (pointer.px - pointer.cx) * k * 0.6;
      pointer.cy += (pointer.py - pointer.cy) * k * 0.6;

      // Een trage omloop plus parallax van de cursor.
      const orbit = reduced ? 0 : Math.sin(t * 0.12) * 0.9;
      // Een smal, hoog vlak ziet horizontaal weinig: dan gaat de camera verder
      // weg, zodat er altijd een veld te zien is en niet een handvol blokken.
      const back = Math.min(1.9, Math.max(1, 1.35 / aspect));
      eye = [orbit + pointer.cx * 3, (21 - pointer.cy * 2.4) * back, 21 * back];
      gl.uniformMatrix4fv(uViewProj, false, viewProj(eye, [0, 0, 0], fovY, aspect));
      gl.uniform3fv(uEye, eye);
      gl.uniform1f(uFogNear, Math.hypot(eye[1], eye[2]) - 2);
      gl.uniform1f(uTime, t);
      gl.uniform3f(uPointer, pointer.x, pointer.z, reduced ? 0 : pointer.on);
      gl.uniform4f(uRipple, ripple.x, ripple.z, ripple.t, reduced ? 0 : ripple.s);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, N * N);
    };

    let raf = 0;
    let running = false;
    let visible = true;
    const loop = (now: number) => {
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    const sync = () => {
      const should = visible && !document.hidden && !reduced;
      if (should && !running) {
        running = true;
        raf = requestAnimationFrame(loop);
      } else if (!should && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    io.observe(host);
    const ro = new ResizeObserver(() => {
      resize();
      if (!running) draw(performance.now());
    });
    ro.observe(host);
    const mo = new MutationObserver(() => {
      readColors();
      if (!running) draw(performance.now());
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    document.addEventListener("visibilitychange", sync);

    draw(performance.now());
    requestAnimationFrame(() => el.classList.add("opacity-100"));
    sync();

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", sync);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      host.removeEventListener("pointerdown", onDown);
      gl.deleteBuffer(buf);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(prog);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [earned, fog, tileA, tileB, lift]);

  return (
    // Het canvas ligt absoluut in deze wrapper, dus die moet gepositioneerd zijn —
    // maar niet "relative" als de aanroeper hem zelf al absoluut neerlegt.
    <div
      ref={wrap}
      className={`touch-pan-y ${/\b(absolute|fixed)\b/.test(className) ? "" : "relative"} ${className}`}
      aria-hidden
    >
      <canvas
        ref={canvas}
        className="absolute inset-0 h-full w-full opacity-0 transition-opacity duration-700"
      />
    </div>
  );
}
