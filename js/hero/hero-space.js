/* ==========================================================================
   AssitStudio — Cosmic Space Background Effect
   Full-hero atmospheric starfield, celestial nebulae, and interactive parallax.
   ========================================================================== */

(function () {
  function initHeroSpace() {
    const canvas = document.getElementById('hero-space-canvas');
    const hero = document.getElementById('top') || document.querySelector('.hero');
    if (!canvas || !hero) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let dpr = 1;

    // Star layers
    const STARS_COUNT = 240;
    const stars = [];

    // Cosmic Dust / Nebula clouds
    const NEBULA_COUNT = 3;
    const nebulae = [];

    // Shooting stars
    const shootingStars = [];
    let nextShootingStarTime = Date.now() + 2000 + Math.random() * 4000;

    // Mouse Parallax
    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;

    function resize() {
      const rect = hero.getBoundingClientRect();
      width = rect.width || window.innerWidth;
      height = rect.height || window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      initElements();
    }

    function initElements() {
      stars.length = 0;
      for (let i = 0; i < STARS_COUNT; i++) {
        const depth = Math.random(); // 0 (far) to 1 (near)
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: depth < 0.7 ? Math.random() * 1.2 + 0.4 : Math.random() * 1.8 + 1.2,
          baseAlpha: Math.random() * 0.6 + 0.2,
          twinkleSpeed: Math.random() * 0.03 + 0.008,
          twinklePhase: Math.random() * Math.PI * 2,
          depth: depth * 0.8 + 0.2,
          color: Math.random() > 0.85 ? '#C6F432' : (Math.random() > 0.6 ? '#8AB4F8' : '#F3F1EC'),
        });
      }

      nebulae.length = 0;
      // Precompute soft nebula clusters
      nebulae.push({
        x: width * 0.7,
        y: height * 0.35,
        radius: Math.min(width, height) * 0.55,
        color: 'rgba(198, 244, 50, 0.035)',
      });
      nebulae.push({
        x: width * 0.2,
        y: height * 0.6,
        radius: Math.min(width, height) * 0.65,
        color: 'rgba(74, 144, 226, 0.04)',
      });
      nebulae.push({
        x: width * 0.85,
        y: height * 0.75,
        radius: Math.min(width, height) * 0.5,
        color: 'rgba(120, 80, 240, 0.03)',
      });
    }

    function createShootingStar() {
      const startX = Math.random() * width * 0.9;
      const startY = Math.random() * height * 0.4;
      const angle = (Math.PI / 4) + (Math.random() - 0.5) * 0.3; // ~45 degrees diagonal
      const speed = Math.random() * 8 + 12;
      const length = Math.random() * 120 + 80;

      shootingStars.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        length: length,
        life: 1.0,
        decay: Math.random() * 0.025 + 0.018,
        color: Math.random() > 0.5 ? '#C6F432' : '#FFFFFF',
      });
    }

    // Parallax tracking
    window.addEventListener('mousemove', (e) => {
      const rect = hero.getBoundingClientRect();
      if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
        targetMouseX = ((e.clientX - rect.left) / width - 0.5) * 40;
        targetMouseY = ((e.clientY - rect.top) / height - 0.5) * 40;
      }
    }, { passive: true });

    // Visibility Observer
    let isVisible = true;
    const observer = new IntersectionObserver((entries) => {
      isVisible = entries[0].isIntersecting;
    }, { threshold: 0.05 });
    observer.observe(hero);

    // Animation Loop
    let lastTime = performance.now();

    function render(now) {
      requestAnimationFrame(render);
      if (!isVisible) return;

      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      // Smooth mouse easing
      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;

      ctx.clearRect(0, 0, width, height);

      // 1. Draw Nebulae
      nebulae.forEach((neb) => {
        const grad = ctx.createRadialGradient(
          neb.x + mouseX * 0.3,
          neb.y + mouseY * 0.3,
          0,
          neb.x + mouseX * 0.3,
          neb.y + mouseY * 0.3,
          neb.radius
        );
        grad.addColorStop(0, neb.color);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(neb.x + mouseX * 0.3, neb.y + mouseY * 0.3, neb.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // 2. Draw Stars
      stars.forEach((star) => {
        if (!reduceMotion) {
          star.twinklePhase += star.twinkleSpeed;
        }
        const alpha = star.baseAlpha + Math.sin(star.twinklePhase) * 0.25;
        const finalAlpha = Math.max(0.1, Math.min(1.0, alpha));

        const px = star.x - mouseX * star.depth;
        const py = star.y - mouseY * star.depth;

        // Wrap around edges smoothly
        const wrappedX = ((px % width) + width) % width;
        const wrappedY = ((py % height) + height) % height;

        ctx.fillStyle = star.color;
        ctx.globalAlpha = finalAlpha;
        ctx.beginPath();
        ctx.arc(wrappedX, wrappedY, star.size, 0, Math.PI * 2);
        ctx.fill();

        // Subtle soft glow around larger stars
        if (star.size > 1.4) {
          ctx.globalAlpha = finalAlpha * 0.3;
          ctx.beginPath();
          ctx.arc(wrappedX, wrappedY, star.size * 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.globalAlpha = 1.0;

      // 3. Update & Draw Shooting Stars
      if (!reduceMotion) {
        if (now > nextShootingStarTime) {
          createShootingStar();
          nextShootingStarTime = now + 4000 + Math.random() * 6000;
        }

        for (let i = shootingStars.length - 1; i >= 0; i--) {
          const s = shootingStars[i];
          s.x += s.vx;
          s.y += s.vy;
          s.life -= s.decay;

          if (s.life <= 0 || s.x > width + 100 || s.y > height + 100) {
            shootingStars.splice(i, 1);
            continue;
          }

          const tailX = s.x - (s.vx / Math.hypot(s.vx, s.vy)) * (s.length * s.life);
          const tailY = s.y - (s.vy / Math.hypot(s.vx, s.vy)) * (s.length * s.life);

          const grad = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
          grad.addColorStop(0, s.color);
          grad.addColorStop(1, 'transparent');

          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.6 * s.life;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(tailX, tailY);
          ctx.stroke();
        }
      }
    }

    window.addEventListener('resize', resize, { passive: true });
    resize();
    requestAnimationFrame(render);
  }

  window.initHeroSpace = initHeroSpace;
})();
