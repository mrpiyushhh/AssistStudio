/* ==========================================================================
   AssitStudio — 3D particles

   One particle system that lives behind the dark sections.

     hero     The particles build a web app: browser window, page content,
              a cursor clicking a button. The drawing is split into layers
              (frame, content, accent) that float apart in depth, so it reads
              as an exploded UI. It assembles top to bottom like a page
              rendering, and a lime scan line passes over it every few seconds.
     clients  A twisted knot of particles that slowly turns, spins faster
              while scrolling and takes a small breath when the testimonial
              changes.

   Between the two sections the particles scatter into dust.

   Nothing is positioned by hand. Each shape is fitted to the bounds of its
   own drawing and placed inside an empty [data-stage] element, then follows
   it as the page scrolls. Light sections are opaque and scroll over it.

   Loaded as a classic script so the site also works when opened from disk.
   index.html imports Three.js from the CDN and calls window.initScene().
   ========================================================================== */

window.initScene = function initScene(THREE) {
  const root = document.documentElement;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* ---------- Tuning ---------- */

  const CFG = {
    fov: 35,
    camZ: 10,
    count: innerWidth < 768 ? 5000 : 9000,
    fill: 0.84,        // share of its stage a flat drawing fills
    fillSolid: 0.78,   // share of its stage the knot fills
    pointSize: 2.5,    // base particle size in CSS px
    unit: 1.5,         // half-size of a drawing in world units
    layerDepth: 0.62,  // gap between the drawing's layers: an exploded view
    build: 1.7,        // seconds to rebuild into a new shape
    heroExpand: 0.6,   // scroll (in viewport heights) over which the hero shape fully expands
    scatter: {         // cursor scatter
      push: 36,        // px particles move away from the cursor
      pushFast: 30,    // extra px when the mouse moves fast
      radius: 70,      // px around the cursor that is affected
      radiusFast: 25,  // extra px when the mouse moves fast
      heal: 2.6,       // how quickly the trail fades (higher = particles settle back sooner)
      reach: 30,       // px outside the shape's box where the cursor starts to have an effect
    },
    scanEvery: 6,      // seconds between scan passes over the finished shape
  };

  const COLOR = {
    lime: new THREE.Color('#C6F432'),
    paper: new THREE.Color('#F3F1EC'),
    grey: new THREE.Color('#8A8A8F'),
    orange: new THREE.Color('#FF6A3D'),
  };

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const clamp01 = (v) => clamp(v, 0, 1);
  const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const pickWeighted = (list) => {
    let r = rand();
    for (const [c, w] of list) { r -= w; if (r <= 0) return c; }
    return list[0][0];
  };

  /* ---------- Renderer ---------- */

  const canvas = document.createElement('canvas');
  canvas.className = 'scene-canvas';
  canvas.setAttribute('aria-hidden', 'true');

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
  } catch (err) {
    return; // No WebGL: the static drawing in the hero stays
  }
  renderer.setClearColor(0x000000, 0);
  document.body.prepend(canvas);
  root.classList.add('is-3d');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CFG.fov, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 0, CFG.camZ);

  /* ---------- Drawings ----------
     Each shape is a list of layers drawn on a 400×400 canvas. Filled pixels
     become particle positions; the layer's z sets its depth. */

  const SIZE = 400;
  const pad = document.createElement('canvas');
  pad.width = pad.height = SIZE;
  const c = pad.getContext('2d', { willReadFrequently: true });

  const rr = (x, y, w, h, r) => {
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, w, h, r);
    else c.rect(x, y, w, h);
  };
  const strokeRR = (x, y, w, h, r, lw) => { c.lineWidth = lw; rr(x, y, w, h, r); c.stroke(); };
  const fillRR = (x, y, w, h, r) => { rr(x, y, w, h, r); c.fill(); };
  const dot = (x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
  const ring = (x, y, r, lw) => { c.lineWidth = lw; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke(); };
  const line = (pts, lw) => { c.lineWidth = lw; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); };
  const carve = (fn) => { c.globalCompositeOperation = 'destination-out'; fn(); c.globalCompositeOperation = 'source-over'; };
  const sparkle = (x, y, r) => {
    c.beginPath();
    c.moveTo(x, y - r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.quadraticCurveTo(x, y, x, y + r);
    c.quadraticCurveTo(x, y, x - r, y);
    c.quadraticCurveTo(x, y, x, y - r);
    c.fill();
  };

  const FRAME = [[COLOR.paper, 0.78], [COLOR.grey, 0.22]];
  const CONTENT = [[COLOR.grey, 0.55], [COLOR.paper, 0.45]];
  const ACCENT = [[COLOR.lime, 0.9], [COLOR.orange, 0.1]];

  const DRAWINGS = {
    // Web platform: browser window, page content, a button being clicked
    web: [
      {
        z: 0, share: 0.34, colors: FRAME, draw() {
          strokeRR(40, 64, 320, 272, 20, 6);
          line([[40, 108], [360, 108]], 4);
          dot(68, 86, 7); dot(90, 86, 7); dot(112, 86, 7);
          strokeRR(150, 76, 170, 20, 10, 3);
        }
      },
      {
        z: 1, share: 0.42, colors: CONTENT, draw() {
          fillRR(68, 130, 170, 16, 8);
          fillRR(68, 156, 118, 10, 5);
          strokeRR(258, 126, 76, 76, 10, 4);
          line([[266, 190], [288, 166], [304, 182], [314, 172], [328, 190]], 3);
          dot(314, 146, 6);
          [68, 160, 252].forEach((x) => { strokeRR(x, 226, 82, 88, 12, 4); fillRR(x + 12, 292, 44, 8, 4); });
        }
      },
      {
        z: 2, share: 0.24, colors: ACCENT, draw() {
          fillRR(68, 180, 86, 28, 14);
          c.beginPath();
          c.moveTo(196, 184); c.lineTo(196, 238); c.lineTo(209, 226); c.lineTo(219, 248);
          c.lineTo(229, 243); c.lineTo(219, 222); c.lineTo(237, 221); c.closePath(); c.fill();
        }
      },
    ],

  };

  // Where the hero's callout lines point: [x, y] on the 400×400 drawing, and the layer.
  // Order matches data-anchor in index.html: 0 frame, 1 content, 2 interaction.
  DRAWINGS.web.anchors = [[68, 86, 0], [334, 150, 1], [111, 194, 2]];

  /* ---------- Turn a drawing into N particle targets ---------- */

  const N = CFG.count;

  function samplePixels(draw) {
    c.clearRect(0, 0, SIZE, SIZE);
    c.fillStyle = '#fff';
    c.strokeStyle = '#fff';
    c.lineCap = 'round';
    c.lineJoin = 'round';
    draw();
    const data = c.getImageData(0, 0, SIZE, SIZE).data;
    const pts = [];
    for (let y = 0; y < SIZE; y += 2) {
      for (let x = 0; x < SIZE; x += 2) {
        if (data[(y * SIZE + x) * 4 + 3] > 110) pts.push(x, y);
      }
    }
    return pts;
  }

  function buildShape(layers) {
    seed = 19;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const delay = new Float32Array(N);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let i = 0;
    layers.forEach((layer, li) => {
      const pts = samplePixels(layer.draw);
      const count = li === layers.length - 1 ? N - i : Math.round(N * layer.share);
      for (let k = 0; k < count && i < N; k++, i++) {
        let x = 0;
        let y = 0;
        if (pts.length) {
          const j = Math.floor(rand() * (pts.length / 2)) * 2;
          x = ((pts[j] + rand() * 2 - 1 - SIZE / 2) / (SIZE / 2)) * CFG.unit;
          y = (-(pts[j + 1] + rand() * 2 - 1 - SIZE / 2) / (SIZE / 2)) * CFG.unit;
        }
        pos.set([x, y, layer.z + (rand() - 0.5) * 0.3], i * 3);
        const colr = pickWeighted(layer.colors);
        col.set([colr.r, colr.g, colr.b], i * 3);
        if (pts.length) {
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
      }
    });
    if (!isFinite(minX)) { minX = minY = -1; maxX = maxY = 1; }
    // Build order: top first, like a page rendering
    const span = Math.max(0.001, maxY - minY);
    for (let k = 0; k < N; k++) {
      delay[k] = clamp01(((maxY - pos[k * 3 + 1]) / span) * 0.75 + rand() * 0.25);
    }
    // Centre the drawing on its own bounds so fitting is exact
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    for (let k = 0; k < N; k++) { pos[k * 3] -= cx; pos[k * 3 + 1] -= cy; }
    const anchors = (layers.anchors || []).map(([px, py, z]) => ({
      x: ((px - SIZE / 2) / (SIZE / 2)) * CFG.unit - cx,
      y: (-(py - SIZE / 2) / (SIZE / 2)) * CFG.unit - cy,
      z,
    }));
    return { pos, col, delay, anchors, w: maxX - minX, h: maxY - minY, top: maxY - cy, bottom: minY - cy, flat: true, spin: false, scan: true };
  }

  /* ---------- Testimonials: a torus knot (p=2, q=3) made of particles ---------- */

  /* ---------- Hero: a rolling dot landscape, a lime path of light, a floating gem ----------
     The ground is a grid of points (y = GROUND); the shader rolls it gently and turns
     the gem about its own centre (GEM). Far rows fade into the dark. */
  const GROUND = -1.3;
  const GEM = { x: 2.8, y: 0.25, z: -2.6, size: 0.72 };
  function buildTerrain() {
    seed = 31;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const delay = new Float32Array(N);
    const groundCount = Math.floor(N * 0.8);
    const cols = Math.round(Math.sqrt(groundCount * 3.6));
    const rows = Math.floor(groundCount / cols);
    const dim = new THREE.Color('#5A5A60');
    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < cols; k++, i++) {
        const x = -9.5 + (19 * (k + 0.5)) / cols + (rand() - 0.5) * 0.02;
        const z = -8 + (9.8 * (r + 0.5)) / rows;
        pos.set([x, GROUND, z], i * 3);
        // A lime path runs diagonally from the near edge up to the gem, and stops there
        const t = (z - 1.8) / (GEM.z - 1.8);                    // 0 at the near edge, 1 under the gem
        const pathX = 0.4 + (GEM.x - 0.4) * t;
        const path = t <= 1.05 && Math.abs(x - pathX) < 0.2 + (1 - t) * 0.12;
        const c = path ? COLOR.lime : rand() < 0.12 ? COLOR.paper : dim;
        col.set([c.r, c.g, c.b], i * 3);
      }
    }
    // Gem: an elongated octahedron, mostly edges for a crisp outline
    const s = GEM.size;
    const V = [[s, 0, 0], [-s, 0, 0], [0, s * 1.5, 0], [0, -s * 1.5, 0], [0, 0, s], [0, 0, -s]];
    const faces = [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [0, 3, 4], [4, 3, 1], [1, 3, 5], [5, 3, 0]];
    const edges = [[0, 2], [1, 2], [4, 2], [5, 2], [0, 3], [1, 3], [4, 3], [5, 3], [0, 4], [4, 1], [1, 5], [5, 0]];
    for (; i < N; i++) {
      let x;
      let y;
      let z;
      if (rand() < 0.45) {
        const [a, b] = edges[Math.floor(rand() * edges.length)];
        const t = rand();
        x = V[a][0] + (V[b][0] - V[a][0]) * t;
        y = V[a][1] + (V[b][1] - V[a][1]) * t;
        z = V[a][2] + (V[b][2] - V[a][2]) * t;
      } else {
        const [a, b, c] = faces[Math.floor(rand() * faces.length)];
        let u = rand();
        let v = rand();
        if (u + v > 1) { u = 1 - u; v = 1 - v; }
        x = V[a][0] + (V[b][0] - V[a][0]) * u + (V[c][0] - V[a][0]) * v;
        y = V[a][1] + (V[b][1] - V[a][1]) * u + (V[c][1] - V[a][1]) * v;
        z = V[a][2] + (V[b][2] - V[a][2]) * u + (V[c][2] - V[a][2]) * v;
      }
      pos.set([GEM.x + x, GEM.y + y, GEM.z + z], i * 3);
      const c = rand() < 0.72 ? COLOR.lime : COLOR.paper;
      col.set([c.r, c.g, c.b], i * 3);
    }
    for (let k = 0; k < N; k++) delay[k] = rand();
    // Sized so the ground runs off both edges of the screen
    return { pos, col, delay, w: 8.4, h: 3.6, top: 2, bottom: -2, flat: false, spin: false, scan: false, wave: true };
  }

  function buildKnot() {
    seed = 23;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const delay = new Float32Array(N);
    const palette = [[COLOR.lime, 0.30], [COLOR.paper, 0.45], [COLOR.grey, 0.17], [COLOR.orange, 0.08]];
    const at = (t, out) => {
      const r = 1 + 0.42 * Math.cos(3 * t);
      return out.set(r * Math.cos(2 * t), r * Math.sin(2 * t), 0.42 * Math.sin(3 * t));
    };
    const c0 = new THREE.Vector3();
    const c1 = new THREE.Vector3();
    const T = new THREE.Vector3();
    const Nn = new THREE.Vector3();
    const B = new THREE.Vector3();
    const Z = new THREE.Vector3(0, 0, 1);
    const p = new THREE.Vector3();
    let maxR = 0;
    for (let i = 0; i < N; i++) {
      // A point on the surface of a tube wrapped around the knot's centre line
      const t = rand() * Math.PI * 2;
      const v = rand() * Math.PI * 2;
      at(t, c0);
      at(t + 0.001, c1);
      T.subVectors(c1, c0).normalize();
      Nn.crossVectors(T, Z).normalize();
      B.crossVectors(T, Nn);
      const tube = 0.26 * (0.85 + 0.15 * rand());
      p.copy(c0).addScaledVector(Nn, Math.cos(v) * tube).addScaledVector(B, Math.sin(v) * tube).multiplyScalar(1.05);
      pos.set([p.x, p.y, p.z], i * 3);
      const colr = pickWeighted(palette);
      col.set([colr.r, colr.g, colr.b], i * 3);
      delay[i] = rand();
      maxR = Math.max(maxR, p.length());
    }
    // It turns, so fit it by its full radius
    return { pos, col, delay, w: maxR * 2, h: maxR * 2, top: maxR, bottom: -maxR, flat: false, spin: true, scan: false };
  }

  const shapes = new Map();
  function getShape(key) {
    if (shapes.has(key)) return shapes.get(key);
    const id = key.split(':')[1];
    const shape = id === 'knot' ? buildKnot() : id === 'terrain' ? buildTerrain() : buildShape(DRAWINGS[id] || DRAWINGS.web);
    shapes.set(key, shape);
    return shape;
  }

  /* ---------- Particle buffers ---------- */

  const geo = new THREE.BufferGeometry();
  const dynamic = (size) => {
    const attr = new THREE.BufferAttribute(new Float32Array(N * size), size);
    attr.setUsage(THREE.DynamicDrawUsage);
    return attr;
  };
  const aFrom = dynamic(3);
  const aTo = dynamic(3);
  const aColFrom = dynamic(3);
  const aColTo = dynamic(3);
  const aDelay = dynamic(1);
  geo.setAttribute('position', aFrom);
  geo.setAttribute('aTo', aTo);
  geo.setAttribute('aColFrom', aColFrom);
  geo.setAttribute('aColTo', aColTo);
  geo.setAttribute('aDelay', aDelay);

  {
    const dust = new Float32Array(N * 3);
    const rnd = new Float32Array(N * 4);
    const kind = new Float32Array(N);
    const size = new Float32Array(N);
    const v = new THREE.Vector3();
    seed = 3;
    for (let i = 0; i < N; i++) {
      v.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize().multiplyScalar(3 + rand() * 5);
      dust.set([v.x, v.y, v.z], i * 3);
      rnd.set([rand(), rand(), rand(), rand()], i * 4);
      const tri = rand() < 0.04;
      kind[i] = tri ? 1 : 0;
      size[i] = tri ? 2.2 + rand() * 0.8 : 0.8 + rand() * 0.5;
    }
    geo.setAttribute('aDust', new THREE.BufferAttribute(dust, 3));
    geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 4));
    geo.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  }
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10);

  const TRAIL = 8;
  const uniforms = {
    uTime: { value: 0 },
    uMorph: { value: 1 },       // 0 → 1 while rebuilding
    uForm: { value: 0 },        // 0 dust → 1 formed
    uDepth: { value: CFG.layerDepth },
    uDepthFade: { value: 0 },
    uWave: { value: 0 },
    uScan: { value: 99 },       // y of the scan line, in shape space
    uScanAmt: { value: 0 },
    uPulse: { value: 0 },
    uSize: { value: CFG.pointSize },
    uPixelRatio: { value: 1 },
    uTrail: { value: Array.from({ length: 8 }, () => new THREE.Vector3(9, 9, 0)) }, // xy screen space, z strength
    uViewport: { value: new THREE.Vector2(1, 1) },  // CSS px
    uTanHalfFov: { value: Math.tan(THREE.MathUtils.degToRad(CFG.fov / 2)) },
    uMouseRadius: { value: 120 },                   // px
    uMousePush: { value: 60 },                      // px
    uMouseAmt: { value: 0 },
    uLime: { value: COLOR.lime },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */`
      attribute vec3 aTo;
      attribute vec3 aColFrom;
      attribute vec3 aColTo;
      attribute float aDelay;
      attribute vec3 aDust;
      attribute vec4 aRand;
      attribute float aKind;
      attribute float aSize;
      uniform float uWave;
      uniform float uTime, uMorph, uForm, uDepth, uDepthFade, uScan, uScanAmt, uPulse, uSize, uPixelRatio, uMouseAmt;
      uniform vec3 uTrail[8];
      uniform vec2 uViewport;
      uniform float uTanHalfFov, uMouseRadius, uMousePush;
      uniform vec3 uLime;
      varying vec3 vColor;
      varying float vKind;
      varying float vAlpha;
      varying float vRot;

      void main() {
        // Rebuild: each particle leaves at its own moment (top of the drawing first)
        float m = smoothstep(aDelay * 0.5, aDelay * 0.5 + 0.5, uMorph);
        vec3 a = position; a.z *= uDepth;
        vec3 b = aTo;      b.z *= uDepth;
        vec3 target = mix(a, b, m);
        // ...and swoops toward the viewer on the way, so the rebuild has an arc
        float arc = sin(m * 3.14159);
        target.z += arc * (0.5 + 0.8 * aRand.x);
        target.x += arc * (aRand.y - 0.5) * 0.7;

        // Hero landscape: the ground rolls gently; the gem turns about its own centre
        float waveFade = 1.0;
        if (uWave > 0.0) {
          float ground = step(target.y, -0.9);
          waveFade = mix(1.0, mix(0.1, 1.0, smoothstep(-8.0, -0.5, target.z)), ground); // far rows fade into the dark
          target.y += ground * (sin(target.x * 1.1 + uTime * 0.9) * 0.1 + cos(target.z * 1.4 - uTime * 0.7) * 0.08);
          vec3 gc = vec3(2.8, 0.25, -2.6);
          vec3 q = target - gc;
          float an = uTime * 0.45;
          vec3 turned = gc + vec3(q.x * cos(an) + q.z * sin(an), q.y + sin(uTime * 1.2) * 0.06, -q.x * sin(an) + q.z * cos(an));
          target = mix(target, turned, 1.0 - ground);
        }

        float f = smoothstep(aRand.y * 0.45, aRand.y * 0.45 + 0.55, uForm);
        // Scattered, each particle is flung outward from where it sits in the shape
        // (plus a little randomness), so the shape visibly expands rather than dissolves
        vec3 outward = target * (2.6 + aRand.x * 3.0) + aDust * 0.35;
        vec3 p = mix(outward, target, f);

        // Very slight drift so it never looks frozen
        float t = uTime * 0.6;
        p += 0.01 * vec3(
          sin(t + aRand.z * 6.2831 + p.y * 1.7),
          cos(t * 0.9 + aRand.w * 6.2831 + p.x * 1.7),
          sin(t * 1.1 + aRand.x * 6.2831 + p.z * 1.7)
        );

        // A short breath on user actions
        p += normalize(p + 1e-4) * uPulse * 0.12 * aRand.y;

        // Scan line: particles it passes light up lime for a moment
        float band = exp(-pow((target.y - uScan) / 0.09, 2.0)) * uScanAmt;

        vec4 mv = modelViewMatrix * vec4(p, 1.0);

        // Cursor scatter. Measured on screen, so every particle under the pointer
        // reacts whatever its depth. The cursor and its recent path each blow nearby
        // particles away, every particle in its own direction; as the path fades
        // they drift back into place.
        vec4 clip = projectionMatrix * mv;
        vec2 ndc = clip.xy / clip.w;
        vec2 away = vec2(0.0);
        float heat = 0.0;
        for (int k = 0; k < 8; k++) {
          vec3 tp = uTrail[k];
          vec2 d = (ndc - tp.xy) * uViewport * 0.5;   // px from this trail point
          float dist = length(d);
          float w = exp(-(dist * dist) / (uMouseRadius * uMouseRadius)) * tp.z;
          away += (dist > 0.001 ? d / dist : vec2(0.0)) * w;
          heat += w;
        }
        heat = clamp(heat, 0.0, 1.0) * uMouseAmt;
        vec2 own = normalize(vec2(aRand.z - 0.5, aRand.w - 0.5) + 1e-4);
        vec2 dir = normalize(away + own * 0.9 + 1e-4);
        float pxToWorld = (-mv.z) * 2.0 * uTanHalfFov / uViewport.y;
        mv.xy += dir * heat * uMousePush * (0.5 + aRand.x * 0.7) * pxToWorld;

        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uSize * uPixelRatio * (1.0 + band * 0.8) * (10.0 / -mv.z);

        vColor = mix(mix(aColFrom, aColTo, m), uLime, band * 0.85);
        vKind = aKind;
        vRot = aRand.w * 6.2831 + uTime * 0.4 * (aRand.z - 0.5);
        // For solid shapes the far side is dimmer, which reads as depth
        vec4 centre = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float front = clamp((mv.z - centre.z) / 3.2 + 0.5, 0.0, 1.0);
        vAlpha = mix(0.3, 1.0, f) * mix(1.0, 0.75, arc) * mix(mix(1.0, mix(0.22, 1.0, front), uDepthFade), waveFade, uWave);
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vColor;
      varying float vKind;
      varying float vAlpha;
      varying float vRot;
      float sdTriangle(vec2 p, float r) {
        const float k = 1.7320508;
        p.x = abs(p.x) - r;
        p.y = p.y + r / k;
        if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
        p.x -= clamp(p.x, -2.0 * r, 0.0);
        return -length(p) * sign(p.y);
      }
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float a;
        if (vKind < 0.5) {
          a = 1.0 - smoothstep(0.3, 0.5, length(uv));
        } else {
          float c = cos(vRot);
          float s = sin(vRot);
          uv = mat2(c, -s, s, c) * uv;
          a = 1.0 - smoothstep(0.025, 0.06, abs(sdTriangle(uv, 0.26)));
        }
        a *= vAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vColor, a);
        #include <colorspace_fragment>
      }`,
  });

  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  scene.add(points);

  /* ---------- Switching shapes ---------- */

  let currentKey = null;
  let current = null;
  let morph = 1;

  // Freeze what is on screen into "from", so a new build can start mid-way through another
  function snapshot() {
    const M = easeInOut(clamp01(morph));
    const f = aFrom.array;
    const t = aTo.array;
    const cf = aColFrom.array;
    const ct = aColTo.array;
    const d = aDelay.array;
    for (let i = 0; i < N; i++) {
      const lo = d[i] * 0.5;
      const k = smooth(lo, lo + 0.5, M);
      for (let j = i * 3; j < i * 3 + 3; j++) {
        f[j] += (t[j] - f[j]) * k;
        cf[j] += (ct[j] - cf[j]) * k;
      }
    }
  }

  function goTo(key, instant) {
    const shape = getShape(key);
    if (instant) {
      aFrom.array.set(shape.pos);
      aColFrom.array.set(shape.col);
      morph = 1;
    } else {
      snapshot();
      morph = 0;
    }
    aTo.array.set(shape.pos);
    aColTo.array.set(shape.col);
    aDelay.array.set(shape.delay);
    [aFrom, aTo, aColFrom, aColTo, aDelay].forEach((a) => { a.needsUpdate = true; });
    currentKey = key;
    current = shape;
    sinceBuilt = 0;
  }

  /* ---------- Stages ---------- */

  const stages = [
    { el: document.querySelector('[data-stage="hero"]'), kind: 'hero' },
    { el: document.querySelector('[data-stage="clients"]'), kind: 'quote' },
  ].filter((s) => s.el);

  let pulse = 0;
  let sinceBuilt = 0;

  let quoteIndex = 0;
  window.addEventListener('testimonial', (e) => {
    const i = e.detail?.index ?? 0;
    if (i !== quoteIndex) pulse = 1;
    quoteIndex = i;
  });

  /* ---------- Size ---------- */

  let dprCap = innerWidth < 768 ? 1.5 : 2;
  let vw = innerWidth;
  let vh = innerHeight;
  function resize() {
    vw = innerWidth;
    vh = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, dprCap);
    renderer.setPixelRatio(dpr);
    renderer.setSize(vw, vh);
    uniforms.uPixelRatio.value = dpr;
    uniforms.uViewport.value.set(vw, vh);
    camera.aspect = vw / vh;
    camera.updateProjectionMatrix();
  }
  resize();
  let resizeRaf = 0;
  window.addEventListener('resize', () => { cancelAnimationFrame(resizeRaf); resizeRaf = requestAnimationFrame(resize); });

  /* ---------- Input ---------- */

  const mouseNdc = new THREE.Vector2();
  const mouse = { x: 0, y: 0, cx: -1, cy: -1 };
  const eased = { x: 0, y: 0 };
  let pointerIn = false;
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    mouse.cx = e.clientX;
    mouse.cy = e.clientY;
    mouse.x = (e.clientX / vw) * 2 - 1;
    mouse.y = (e.clientY / vh) * 2 - 1;
    mouseNdc.set(mouse.x, -mouse.y);
    pointerIn = true;
  }, { passive: true });
  document.addEventListener('mouseleave', () => { pointerIn = false; });

  /* ---------- If the GPU drops the context, fall back to the static drawing ---------- */

  let stopped = false;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    stopped = true;
    root.classList.remove('is-3d');
    canvas.remove();
  });

  /* ---------- Loop ---------- */


  let form = 0;
  let scale = 1;
  let depth = CFG.layerDepth;
  let mouseAmt = 0;
  let mouseSpeed = 0;
  const prevMouse = { x: -1, y: -1 };
  const lastDrop = { x: -999, y: -999 };
  let cursorAmt = 0;
  let velocity = 0;
  let lastScroll = scrollY;
  let spin = 0;
  let time = 0;
  let intro = 0;
  let last = performance.now();
  let cleared = false;
  let frames = 0;
  let slow = 0;

  /* ---------- Hero callouts: leader lines from labels to the layers of the model ---------- */

  const calloutRoot = document.querySelector('.callouts');
  const calloutSvg = document.querySelector('.callout-lines');
  const callouts = calloutRoot ? [...calloutRoot.querySelectorAll('.callout')] : [];
  const SVG = 'http://www.w3.org/2000/svg';
  const leaders = callouts.map(() => {
    const line = document.createElementNS(SVG, 'polyline');
    const dotEl = document.createElementNS(SVG, 'circle');
    dotEl.setAttribute('r', '4');
    calloutSvg.append(line, dotEl);
    return { line, dot: dotEl };
  });
  const anchorV = new THREE.Vector3();
  let calloutsOn = false;

  function updateCallouts(active) {
    if (!calloutRoot) return;
    const show = !!active && active.kind === 'hero' && !!current && !!current.anchors && current.anchors.length > 0
      && morph >= 1 && form > 0.85 && vw > 960;
    if (show !== calloutsOn) {
      calloutsOn = show;
      calloutRoot.classList.toggle('is-on', show);
    }
    if (!show) return;
    points.updateMatrixWorld();
    const box = calloutRoot.getBoundingClientRect();
    const placed = { left: [], right: [] };
    callouts.forEach((el, i) => {
      const a = current.anchors[Number(el.dataset.anchor)];
      if (!a) return;
      // Anchor on the model → screen → position inside the plate
      anchorV.set(a.x, a.y, a.z * uniforms.uDepth.value);
      points.localToWorld(anchorV);
      anchorV.project(camera);
      const ax = ((anchorV.x + 1) / 2) * vw - box.left;
      const ay = ((1 - anchorV.y) / 2) * vh - box.top;
      // Label follows its anchor vertically, without overlapping others on the same side
      const side = el.dataset.side === 'right' ? 'right' : 'left';
      let ly = clamp(ay, 40, box.height - 40);
      placed[side].forEach((y) => { if (Math.abs(ly - y) < 90) ly = y + (ly >= y ? 90 : -90); });
      placed[side].push(ly);
      el.style.setProperty('--y', `${ly.toFixed(1)}px`);
      const lx = side === 'left' ? el.offsetLeft + el.offsetWidth + 16 : el.offsetLeft - 16;
      const elbow = side === 'left' ? lx + 28 : lx - 28;
      leaders[i].line.setAttribute('points', `${lx.toFixed(1)},${ly.toFixed(1)} ${elbow.toFixed(1)},${ly.toFixed(1)} ${ax.toFixed(1)},${ay.toFixed(1)}`);
      leaders[i].dot.setAttribute('cx', ax.toFixed(1));
      leaders[i].dot.setAttribute('cy', ay.toFixed(1));
    });
  }

  const glowEl = document.querySelector('.hero-glow');
  const gemV = new THREE.Vector3();

  function tick(now) {
    if (stopped) return;
    requestAnimationFrame(tick);
    const raw = now - last;
    const dt = Math.min(raw / 1000, 0.05);
    last = now;
    time += dt;

    // Lower resolution once if the device is struggling
    frames++;
    if (raw > 26) slow++;
    if (frames === 150) {
      if (slow > 75 && dprCap > 1) { dprCap = 1; resize(); }
      frames = 0;
      slow = 0;
    }

    // Which stage is most on screen?
    let best = null;
    for (const s of stages) {
      if (!s.el.offsetWidth) { s.vis = 0; continue; }
      const r = s.el.getBoundingClientRect();
      const visible = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      s.vis = clamp01(visible / Math.max(1, Math.min(r.height, vh)));
      s.rect = r;
      if (s.vis > 0 && (!best || s.vis > best.vis)) best = s;
    }

    // Pick the shape for the active stage.
    // Within a section (next testimonial) the particles rebuild in place.
    // Between sections they always scatter first and re-form as the new shape,
    // so one section's shape never turns into another's.
    let scatterFirst = false;
    if (best) {
      const key = best.kind === 'hero' ? 'hero:terrain' : 'quote:knot';
      if (!currentKey) {
        goTo(key, true);
      } else if (key !== currentKey) {
        const sameSection = key.split(':')[0] === currentKey.split(':')[0];
        if (sameSection) goTo(key, false);
        else if (form < 0.05) goTo(key, true);
        else scatterFirst = true;
      }
    }

    // Formation is scrubbed by the scroll position: it follows how much of the stage
    // is on screen, with only enough smoothing to hide mouse-wheel steps. The slow
    // fade-in applies on first load only.
    intro = Math.min(1, intro + dt / 1.6);
    let formTarget = best && !scatterFirst ? smooth(0.1, 0.8, best.vis) * smooth(0, 1, intro) : 0;
    // Hero: the web interface starts expanding with the very first scroll.
    // Ease-out, so even a small scroll shows; scrolling back up re-forms it.
    if (best && best.kind === 'hero' && !scatterFirst) {
      const t = clamp01(scrollY / (vh * CFG.heroExpand));
      formTarget = Math.min(formTarget, (1 - t) * (1 - t));
    }
    form += (formTarget - form) * damp(scatterFirst ? 6 : 18, dt);
    if (Math.abs(formTarget - form) < 0.001) form = formTarget;

    // Nothing on screen and fully dispersed: skip drawing
    if (!best && form < 0.005) {
      if (!cleared) { renderer.clear(); cleared = true; }
      updateCallouts(null);
      return;
    }
    cleared = false;

    // Build progress, then a scan pass once it has assembled, repeating every few seconds
    morph = Math.min(1, morph + dt / CFG.build);
    if (morph >= 1) sinceBuilt += dt;
    const scanT = sinceBuilt > 0.25 ? ((sinceBuilt - 0.25) % CFG.scanEvery) / 1.3 : 0;
    const scanOn = !!current && current.scan && morph >= 1 && scanT > 0 && scanT < 1;
    uniforms.uScan.value = current ? current.top + 0.15 - (current.top - current.bottom + 0.3) * clamp01(scanT) : 99;
    uniforms.uScanAmt.value = scanOn ? Math.sin(scanT * Math.PI) : 0;

    // Fit the shape to the active stage and keep it glued there while scrolling
    const reach = CFG.scatter.reach;
    const hovering = !!best && pointerIn &&
      mouse.cx >= best.rect.left - reach && mouse.cx <= best.rect.right + reach &&
      mouse.cy >= best.rect.top - reach && mouse.cy <= best.rect.bottom + reach;
    if (best && current) {
      const r = best.rect;
      const halfH = Math.tan(THREE.MathUtils.degToRad(CFG.fov / 2)) * CFG.camZ;
      const halfW = halfH * camera.aspect;
      const wpp = (2 * halfH) / vh;
      points.position.set(
        ((r.left + r.width / 2) / vw * 2 - 1) * halfW,
        -((r.top + r.height / 2) / vh * 2 - 1) * halfH,
        0
      );
      // Leave room for the sway and the layers spreading on hover
      const w = current.flat ? current.w + 0.5 : current.w;
      const h = current.flat ? current.h + 0.3 : current.h;
      const fill = current.wave ? 1 : current.flat ? CFG.fill : CFG.fillSolid;
      const target = Math.min((r.width * fill) / w, (r.height * fill) / h) * wpp;
      scale = form < 0.05 ? target : scale + (target - scale) * damp(6, dt);
    }
    points.scale.setScalar(Math.max(scale, 0.01));

    // Gentle sway, leaning slightly toward the cursor
    eased.x += (mouse.x - eased.x) * damp(3, dt);
    eased.y += (mouse.y - eased.y) * damp(3, dt);
    const sy = scrollY;
    velocity += (Math.abs(sy - lastScroll) / Math.max(dt, 0.001) - velocity) * damp(6, dt);
    lastScroll = sy;
    if (current && current.wave) {
      points.rotation.set(0.3 + eased.y * 0.05, Math.sin(time * 0.2) * 0.04 + eased.x * 0.1, 0);
    } else if (current && current.spin) {
      spin += dt * (0.12 + Math.min(velocity / 2500, 0.6));
      points.rotation.set(0.2 + eased.y * 0.25, spin + eased.x * 0.4, 0);
    } else {
      // Exploded view: turned and seen slightly from above, so the layers read as a stack
      points.rotation.set(
        0.34 + Math.sin(time * 0.27) * 0.05 + eased.y * 0.16,
        -0.58 + Math.sin(time * 0.35) * 0.12 + eased.x * 0.3,
        0
      );
    }
    depth += (CFG.layerDepth - depth) * damp(4, dt);

    // Cursor scatter: the cursor plus a short trail of where it has been.
    // Trail points fade over about a second, so scattered particles drift back.
    // Moving fast scatters them further.
    const step = Math.hypot(mouse.cx - prevMouse.x, mouse.cy - prevMouse.y);
    prevMouse.x = mouse.cx;
    prevMouse.y = mouse.cy;
    mouseSpeed += (step / Math.max(dt, 0.001) - mouseSpeed) * damp(8, dt);
    const stir = clamp01(mouseSpeed / 2500);
    const trail = uniforms.uTrail.value;
    const fade = Math.exp(-dt * CFG.scatter.heal);
    for (let k = 1; k < TRAIL; k++) trail[k].z *= fade;
    if (hovering && Math.hypot(mouse.cx - lastDrop.x, mouse.cy - lastDrop.y) > 24) {
      for (let k = TRAIL - 1; k > 1; k--) trail[k].copy(trail[k - 1]);
      trail[1].set(mouseNdc.x, mouseNdc.y, 0.6);
      lastDrop.x = mouse.cx;
      lastDrop.y = mouse.cy;
    }
    cursorAmt += ((hovering ? 1 : 0) - cursorAmt) * damp(8, dt);
    trail[0].set(mouseNdc.x, mouseNdc.y, cursorAmt);
    mouseAmt += ((form > 0.3 ? 1 : 0) - mouseAmt) * damp(8, dt);
    uniforms.uMouseRadius.value = CFG.scatter.radius + stir * CFG.scatter.radiusFast;
    uniforms.uMousePush.value = CFG.scatter.push + stir * CFG.scatter.pushFast;
    pulse *= Math.exp(-dt * 3);

    uniforms.uTime.value = time;
    uniforms.uMorph.value = easeInOut(morph);
    uniforms.uForm.value = form;
    const flat = !current || current.flat;
    uniforms.uDepth.value = flat ? depth : 1;
    uniforms.uDepthFade.value = flat ? 0 : 1;
    uniforms.uWave.value = current && current.wave ? 1 : 0;
    uniforms.uPulse.value = pulse;
    uniforms.uMouseAmt.value = mouseAmt;
    uniforms.uSize.value = CFG.pointSize * clamp(scale * 1.1, 0.75, 1.4);

    updateCallouts(best);
    if (glowEl) {
      const on = !!best && best.kind === 'hero' && current && current.wave;
      if (on) {
        points.updateMatrixWorld();
        gemV.set(GEM.x, GEM.y, GEM.z);
        points.localToWorld(gemV);
        gemV.project(camera);
        const hr = glowEl.parentElement.getBoundingClientRect();
        glowEl.style.left = `${((gemV.x + 1) / 2) * vw - hr.left}px`;
        glowEl.style.top = `${((1 - gemV.y) / 2) * vh - hr.top}px`;
      }
      glowEl.style.opacity = on ? (form * form).toFixed(3) : '0';
    }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(tick);
};
