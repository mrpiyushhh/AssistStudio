/* ==========================================================================
   AssitStudio — Interactive 3D Software Architecture Core
   Sophisticated, minimal, luxury-tech WebGL sculpture for the Hero section.
   ========================================================================== */

(function () {
  function initHero3D(THREE) {
    const canvas = document.getElementById('hero-3d-canvas');
    const stage = document.getElementById('hero-3d-stage');
    const interactBadge = document.getElementById('hero-interact-badge');
    if (!canvas || !stage || !THREE) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Renderer
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch (e) {
      console.warn('WebGL not available for 3D Hero', e);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;

    // Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 8.2);

    // Main 3D Model Root Group
    const modelGroup = new THREE.Group();
    scene.add(modelGroup);

    // ---------- PALETTE & MATERIALS ----------
    const LIME_HEX = 0xC6F432;
    const INK_HEX = 0x0E0F12;
    const TITANIUM_HEX = 0x1A1B20;
    const CHROME_HEX = 0x2A2C34;

    // Dark Titanium Chassis Material
    const chassisMaterial = new THREE.MeshStandardMaterial({
      color: TITANIUM_HEX,
      metalness: 0.92,
      roughness: 0.24,
      flatShading: false,
    });

    // Dark Obsidian Secondary Material
    const obsidianMaterial = new THREE.MeshStandardMaterial({
      color: INK_HEX,
      metalness: 0.85,
      roughness: 0.18,
    });

    // Neon Lime Emissive Core Material
    const neonLimeMaterial = new THREE.MeshStandardMaterial({
      color: 0x90C818,
      emissive: LIME_HEX,
      emissiveIntensity: 2.8,
      roughness: 0.1,
      metalness: 0.2,
    });

    // Glassy Translucent Shroud Material
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x223322,
      emissive: 0x112211,
      emissiveIntensity: 0.4,
      metalness: 0.1,
      roughness: 0.08,
      transmission: 0.75,
      thickness: 0.5,
      transparent: true,
      opacity: 0.85,
    });

    // Wireframe Core Material
    const wireMaterial = new THREE.MeshBasicMaterial({
      color: LIME_HEX,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
    });

    // ---------- GEOMETRY CREATION ----------

    // 1. Outer Torus Ring Chassis
    const torusGeo = new THREE.TorusGeometry(2.3, 0.48, 36, 100);
    const mainRing = new THREE.Mesh(torusGeo, chassisMaterial);
    modelGroup.add(mainRing);

    // 2. Inner Glowing Neon Lime Light Conduit
    const innerLightGeo = new THREE.TorusGeometry(2.28, 0.16, 24, 80);
    const innerLightRing = new THREE.Mesh(innerLightGeo, neonLimeMaterial);
    modelGroup.add(innerLightRing);

    // 3. Precision Segmented Clamps / Brackets (Architectural Hardware Accents)
    const bracketGroup = new THREE.Group();
    const bracketGeo = new THREE.BoxGeometry(0.35, 1.35, 1.35);
    const bracketDetailGeo = new THREE.BoxGeometry(0.38, 0.4, 1.4);

    const numBrackets = 4;
    for (let i = 0; i < numBrackets; i++) {
      const angle = (i * Math.PI * 2) / numBrackets;
      const bGroup = new THREE.Group();
      bGroup.position.x = Math.cos(angle) * 2.3;
      bGroup.position.y = Math.sin(angle) * 2.3;
      bGroup.rotation.z = angle;

      const bracketMesh = new THREE.Mesh(bracketGeo, obsidianMaterial);
      const detailMesh = new THREE.Mesh(bracketDetailGeo, chassisMaterial);

      // Small glowing indicator dot on each clamp
      const dotGeo = new THREE.SphereGeometry(0.06, 12, 12);
      const dotMesh = new THREE.Mesh(dotGeo, neonLimeMaterial);
      dotMesh.position.set(0, 0, 0.72);

      bGroup.add(bracketMesh);
      bGroup.add(detailMesh);
      bGroup.add(dotMesh);
      bracketGroup.add(bGroup);
    }
    modelGroup.add(bracketGroup);

    // 4. Secondary Floating Bevel Rings (Gimbal Layers)
    const subRingGeo = new THREE.TorusGeometry(1.65, 0.08, 16, 80);
    const subRing1 = new THREE.Mesh(subRingGeo, chassisMaterial);
    subRing1.rotation.x = Math.PI * 0.25;
    modelGroup.add(subRing1);

    const subRingGeo2 = new THREE.TorusGeometry(1.25, 0.05, 16, 64);
    const subRing2 = new THREE.Mesh(subRingGeo2, neonLimeMaterial);
    subRing2.rotation.y = Math.PI * 0.35;
    modelGroup.add(subRing2);

    // 5. Central Kinetic Software Architecture Core (Nested Polyhedron)
    const coreGroup = new THREE.Group();

    // Outer wireframe crystalline shell
    const outerIcosaGeo = new THREE.IcosahedronGeometry(0.72, 1);
    const outerCoreWire = new THREE.Mesh(outerIcosaGeo, wireMaterial);
    coreGroup.add(outerCoreWire);

    // Inner glowing solid octahedron
    const innerOctaGeo = new THREE.OctahedronGeometry(0.48, 0);
    const innerCoreSolid = new THREE.Mesh(innerOctaGeo, neonLimeMaterial);
    coreGroup.add(innerCoreSolid);

    // Ambient Core Glass Sphere
    const coreGlassGeo = new THREE.SphereGeometry(0.62, 32, 32);
    const coreGlass = new THREE.Mesh(coreGlassGeo, glassMaterial);
    coreGroup.add(coreGlass);

    modelGroup.add(coreGroup);

    // 6. Atmospheric Floating Data Motess / Ambient Particles
    const particleCount = 140;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    const particleScales = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const radius = 2.2 + Math.random() * 3.2;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;

      particlePos[i * 3] = radius * Math.cos(theta) * Math.cos(phi);
      particlePos[i * 3 + 1] = radius * Math.sin(phi);
      particlePos[i * 3 + 2] = radius * Math.sin(theta) * Math.cos(phi);
      particleScales[i] = Math.random() * 0.6 + 0.4;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));

    const particleMat = new THREE.PointsMaterial({
      color: LIME_HEX,
      size: 0.045,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // ---------- LIGHTING ----------

    // 1. Key Directional Light (Crisp Specular Edge)
    const keyLight = new THREE.DirectionalLight(0xFFFFFF, 3.2);
    keyLight.position.set(4, 5, 5);
    scene.add(keyLight);

    // 2. Neon Lime Core Point Lights (Volumetric Internal Glow)
    const corePointLight = new THREE.PointLight(LIME_HEX, 4.5, 9);
    corePointLight.position.set(0, 0, 0);
    scene.add(corePointLight);

    const sidePointLight = new THREE.PointLight(LIME_HEX, 2.8, 6);
    sidePointLight.position.set(1.8, 1.8, 1.2);
    scene.add(sidePointLight);

    // 3. Cool Ambient Fill & Subtle Rim Light
    const rimLight = new THREE.DirectionalLight(0x5588FF, 1.6);
    rimLight.position.set(-5, -4, -3);
    scene.add(rimLight);

    const ambientLight = new THREE.AmbientLight(0x181920, 1.2);
    scene.add(ambientLight);

    // Initial base tilt for dynamic perspective
    modelGroup.rotation.x = 0.42;
    modelGroup.rotation.y = -0.45;
    modelGroup.rotation.z = 0.15;

    // ---------- INTERACTION & PHYSICS ----------

    let isHovered = false;
    let isDragging = false;
    let previousPointerPos = { x: 0, y: 0 };

    let targetRotX = 0.38;
    let targetRotY = -0.42;
    let currentRotX = targetRotX;
    let currentRotY = targetRotY;

    let velocityX = 0;
    let velocityY = 0;

    let mouseNormX = 0;
    let mouseNormY = 0;

    function hideBadge() {
      if (interactBadge) {
        interactBadge.style.opacity = '0';
        setTimeout(() => { interactBadge.style.display = 'none'; }, 300);
      }
    }

    stage.addEventListener('pointerenter', () => {
      isHovered = true;
    });

    stage.addEventListener('pointerleave', () => {
      isHovered = false;
      mouseNormX = 0;
      mouseNormY = 0;
    });

    window.addEventListener('pointermove', (e) => {
      const rect = stage.getBoundingClientRect();
      const inX = e.clientX >= rect.left && e.clientX <= rect.right;
      const inY = e.clientY >= rect.top && e.clientY <= rect.bottom;

      if (inX && inY) {
        mouseNormX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        mouseNormY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      }

      if (isDragging) {
        const deltaX = e.clientX - previousPointerPos.x;
        const deltaY = e.clientY - previousPointerPos.y;

        velocityX = deltaX * 0.007;
        velocityY = deltaY * 0.007;

        targetRotY += velocityX;
        targetRotX += velocityY;

        previousPointerPos = { x: e.clientX, y: e.clientY };
        hideBadge();
      }
    });

    stage.addEventListener('pointerdown', (e) => {
      isDragging = true;
      previousPointerPos = { x: e.clientX, y: e.clientY };
      velocityX = 0;
      velocityY = 0;
      stage.setPointerCapture(e.pointerId);
      hideBadge();
    });

    stage.addEventListener('pointerup', (e) => {
      isDragging = false;
      try { stage.releasePointerCapture(e.pointerId); } catch (_) { }
    });

    stage.addEventListener('pointercancel', (e) => {
      isDragging = false;
      try { stage.releasePointerCapture(e.pointerId); } catch (_) { }
    });

    // Touch support
    stage.addEventListener('touchstart', hideBadge, { passive: true });

    // ---------- RESIZING ----------

    function handleResize() {
      const width = stage.clientWidth || 400;
      const height = stage.clientHeight || 400;
      if (width === 0 || height === 0) return;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      renderer.setSize(width, height, false);
    }

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(stage);
    handleResize();

    // ---------- VISIBILITY OPTIMIZATION ----------

    let isVisible = true;
    const visibilityObserver = new IntersectionObserver((entries) => {
      isVisible = entries[0].isIntersecting;
    }, { threshold: 0.05 });
    visibilityObserver.observe(stage);

    // ---------- ANIMATION LOOP ----------

    let clock = new THREE.Clock();

    function animate() {
      requestAnimationFrame(animate);

      if (!isVisible) return;

      const dt = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      // Continuous autonomous idle rotation & kinetic motion
      if (!isDragging && !reduceMotion) {
        // Idle gentle spinning
        targetRotY += 0.004;

        // Apply inertia drag damping
        targetRotX += velocityY;
        targetRotY += velocityX;
        velocityX *= 0.92;
        velocityY *= 0.92;

        // Mouse Parallax Influence
        const targetHoverX = targetRotX + mouseNormY * 0.4;
        const targetHoverY = targetRotY + mouseNormX * 0.45;

        currentRotX += (targetHoverX - currentRotX) * 0.08;
        currentRotY += (targetHoverY - currentRotY) * 0.08;
      } else {
        currentRotX += (targetRotX - currentRotX) * 0.15;
        currentRotY += (targetRotY - currentRotY) * 0.15;
      }

      modelGroup.rotation.x = currentRotX;
      modelGroup.rotation.y = currentRotY;

      // Harmonic levitation floating motion
      if (!reduceMotion) {
        modelGroup.position.y = Math.sin(elapsed * 1.4) * 0.14;
        modelGroup.position.x = Math.cos(elapsed * 0.9) * 0.06;

        // Internal Gimbal Rings counter-rotation
        subRing1.rotation.z = elapsed * 0.6;
        subRing2.rotation.x = -elapsed * 0.75;

        // Inner Core rotation & breathing pulse
        coreGroup.rotation.y = elapsed * 0.9;
        coreGroup.rotation.x = elapsed * 0.45;

        const pulseScale = 1 + Math.sin(elapsed * 2.5) * 0.08;
        innerCoreSolid.scale.set(pulseScale, pulseScale, pulseScale);

        // Emissive breathing
        const glowPulse = 2.4 + Math.sin(elapsed * 2.5) * 0.8;
        neonLimeMaterial.emissiveIntensity = glowPulse;
        corePointLight.intensity = glowPulse * 1.4;

        // Floating particles drift
        particles.rotation.y = -elapsed * 0.04;
        particles.rotation.x = Math.sin(elapsed * 0.2) * 0.08;
      }

      renderer.render(scene, camera);
    }

    animate();
  }

  // Export on window
  window.initHero3D = initHero3D;
})();
