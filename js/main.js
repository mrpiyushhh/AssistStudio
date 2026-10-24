(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const pad = (n) => String(n).padStart(2, '0');
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Always open on the hero ----------
     No scroll restoration and no jump to a #section on reload. In-page links
     still work; the #section is just not kept in the address bar. */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  const toTop = () => window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  toTop();
  let userScrolled = false;
  ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((type) =>
    window.addEventListener(type, () => { userScrolled = true; }, { once: true, passive: true }));
  // Some browsers restore or jump late (after fonts/images); undo that unless the visitor has already moved
  window.addEventListener('load', () => { if (!userScrolled) toTop(); });
  window.addEventListener('pageshow', (e) => { if (e.persisted && !userScrolled) toTop(); });

  // Tell scene.js the layout changed (fonts, fitted headlines, marquee)
  const layoutChanged = () => window.dispatchEvent(new Event('layoutchange'));

  /* ---------- Fit headlines ----------
     [data-fit]        keeps its designed size, shrinks only if a word is wider than its column
     [data-fit-width]  is scaled so its text spans the full width of its container */
  const measureCanvas = document.createElement('canvas');
  const fitHeadlines = () => {
    $$('[data-fit]').forEach((el) => {
      el.style.fontSize = '';
      const avail = el.clientWidth;
      const need = el.scrollWidth;
      if (avail && need > avail + 1) {
        const size = parseFloat(getComputedStyle(el).fontSize);
        el.style.fontSize = Math.max(32, Math.floor(size * (avail / need) * 0.98)) + 'px';
      }
    });
    // Size so the letters' visible outlines (not their spacing boxes) run exactly
    // from the left content edge to the right one, then nudge for the first letter's overhang
    $$('[data-fit-width]').forEach((el) => {
      el.style.fontSize = '100px';
      el.style.marginLeft = '0px';
      el.style.display = 'inline-block';
      const boxW = el.getBoundingClientRect().width;
      el.style.display = '';
      const cs = getComputedStyle(el);
      const pcs = getComputedStyle(el.parentElement);
      const avail = el.parentElement.clientWidth - parseFloat(pcs.paddingLeft) - parseFloat(pcs.paddingRight);
      if (!boxW || !avail) return;
      const text = el.textContent.trim();
      let ink = boxW;
      let overhang = 0;
      const ctx = measureCanvas.getContext('2d');
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} 100px ${cs.fontFamily}`;
      const first = ctx.measureText(text[0]);
      const last = ctx.measureText(text[text.length - 1]);
      if (typeof first.actualBoundingBoxLeft === 'number') {
        const spacing = parseFloat(cs.letterSpacing) || 0; // trailing letter-spacing is part of boxW
        overhang = first.actualBoundingBoxLeft;           // > 0 when the first letter pokes out to the left
        ink = boxW - last.width - spacing + last.actualBoundingBoxRight + overhang;
      }
      const k = avail / ink;
      el.style.fontSize = (100 * k * 0.999).toFixed(2) + 'px';
      el.style.marginLeft = (overhang * k).toFixed(2) + 'px';
    });
  };

  /* ---------- Logo marquee ----------
     Keep one list in the HTML. It is cloned until the strip is full, and the
     duration is set from its width so the speed is the same for any logo count. */
  const marquee = $('.marquee');
  const track = marquee && $('.marquee-track', marquee);
  const source = track && $('ul', track);
  let marqueeWidth = 0;
  const buildMarquee = () => {
    if (!source) return;
    const boxWidth = marquee.clientWidth;
    $$('ul', track).slice(1).forEach((u) => u.remove());
    const w = source.getBoundingClientRect().width;
    if (!w || !boxWidth) return;
    const copies = Math.max(2, Math.ceil(boxWidth / w) + 1);
    for (let i = 1; i < copies; i++) {
      const clone = source.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    }
    track.style.setProperty('--shift', w + 'px');
    track.style.setProperty('--dur', (w / 45).toFixed(1) + 's'); // 45px per second
    marqueeWidth = boxWidth;
  };

  /* ---------- Section geometry used on scroll ---------- */
  const nav = $('.nav');
  const themed = $$('[data-theme]').filter((el) => el !== nav);
  const projects = $$('.project');
  projects.forEach((p, i) => p.style.setProperty('--i', i));

  const relayout = () => {
    fitHeadlines();
    if (marquee && marquee.clientWidth !== marqueeWidth) buildMarquee();
    onScroll();
    layoutChanged();
  };

  /* ---------- Scroll: nav state and theme, stacked project cards ---------- */
  let menuOpen = false;
  function onScroll() {
    const y = window.scrollY;
    nav.classList.toggle('is-scrolled', y > 12);

    // The nav takes the theme of whatever section is under it
    if (!menuOpen) {
      const probe = nav.offsetHeight / 2;
      const under = themed.find((el) => {
        const r = el.getBoundingClientRect();
        return r.top <= probe && r.bottom > probe;
      });
      if (under) nav.dataset.theme = under.dataset.theme;
    }

    // A deck: each card shrinks, slides back and dims for every card stacked on top of it,
    // so the earlier cards' top edges peek out above the current one
    const covers = [];
    for (let i = 0; i < projects.length; i++) {
      const card = projects[i];
      const next = projects[i + 1];
      if (!next || getComputedStyle(card).position !== 'sticky') { covers[i] = 0; continue; }
      const top = parseFloat(getComputedStyle(card).top) || 0;
      const nextTop = parseFloat(getComputedStyle(next).top) || 0;
      const h = card.offsetHeight;
      const start = top + h;               // next card touches this one's bottom
      const end = nextTop;                  // next card is fully stacked
      const at = next.getBoundingClientRect().top;
      covers[i] = clamp01((start - at) / Math.max(1, start - end));
    }
    let depth = 0;
    for (let i = projects.length - 1; i >= 0; i--) {
      depth += covers[i] || 0;
      projects[i].style.setProperty('--depth', depth.toFixed(3));
    }
  }
  let scrollRaf = 0;
  window.addEventListener('scroll', () => {
    cancelAnimationFrame(scrollRaf);
    scrollRaf = requestAnimationFrame(onScroll);
  }, { passive: true });

  relayout();
  if (document.fonts) document.fonts.ready.then(() => { marqueeWidth = 0; relayout(); });
  window.addEventListener('load', () => { marqueeWidth = 0; relayout(); });
  let resizeRaf = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(relayout);
  });

  /* ---------- Mobile menu ---------- */
  const mobileBar = $('.mobile-cta');
  let contactVisible = false;
  const toggle = $('.menu-toggle');
  const menu = $('#mobile-menu');
  const setMenu = (open) => {
    menuOpen = open;
    toggle.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
    document.body.classList.toggle('menu-open', open);
    if (open) nav.dataset.theme = 'dark';
    else onScroll();
    mobileBar?.classList.toggle('is-hidden', open || contactVisible);
  };
  toggle.addEventListener('click', () => setMenu(!menuOpen));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) setMenu(false); });
  window.matchMedia('(min-width: 961px)').addEventListener('change', (e) => e.matches && setMenu(false));

  /* ---------- Fade sections up once ---------- */
  const revealer = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in');
      revealer.unobserve(en.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  $$('.reveal, .project').forEach((el) => revealer.observe(el));

  /* ---------- How we Work: scroll-driven stages ---------- */
  const processTrack = $('[data-process]');
  if (processTrack) {
    const steps = $$('.process-step', processTrack);
    const panels = $$('.process-panel', processTrack);
    const stepsList = $('.process-steps', processTrack);
    const total = steps.length;
    let active = 0;
    let syncingStrip = false;
    const isMobileProcess = () => window.matchMedia('(max-width: 960px)').matches;

    const applyActive = (index) => {
      if (index < 0 || index >= total) return;
      if (index === active) return;
      active = index;
      steps.forEach((step, i) => {
        step.classList.toggle('is-active', i === index);
        step.classList.toggle('is-done', i < index);
      });
      panels.forEach((panel, i) => {
        panel.classList.toggle('is-active', i === index);
      });
    };

    const centerStepInStrip = (index) => {
      const step = steps[index];
      if (!step || !stepsList) return;
      const listRect = stepsList.getBoundingClientRect();
      const stepRect = step.getBoundingClientRect();
      const offset = stepRect.left - listRect.left - (listRect.width / 2) + (stepRect.width / 2);
      if (Math.abs(offset) < 2) return;
      syncingStrip = true;
      stepsList.scrollBy({ left: offset, behavior: 'smooth' });
      window.setTimeout(() => { syncingStrip = false; }, 420);
    };

    const setActive = (index, { scrollStrip = false } = {}) => {
      applyActive(index);
      if (scrollStrip && isMobileProcess()) centerStepInStrip(index);
    };

    /* Desktop: vertical track progress drives the active stage */
    const updateFromVerticalScroll = () => {
      if (isMobileProcess()) return;
      const rect = processTrack.getBoundingClientRect();
      const trackH = processTrack.offsetHeight;
      const viewH = window.innerHeight;
      const scrolled = -rect.top;
      const range = Math.max(1, trackH - viewH);
      const progress = clamp01(scrolled / range);
      const idx = Math.min(total - 1, Math.floor(progress * total));
      setActive(idx);
    };

    /* Mobile: map scrollLeft 0→max across stages 0→8 so first & last are reachable */
    const updateFromHorizontalScroll = () => {
      if (!isMobileProcess() || !stepsList || syncingStrip) return;
      const maxScroll = Math.max(0, stepsList.scrollWidth - stepsList.clientWidth);
      let idx = 0;
      if (maxScroll > 1) {
        const progress = clamp01(stepsList.scrollLeft / maxScroll);
        idx = Math.min(total - 1, Math.round(progress * (total - 1)));
      }
      applyActive(idx);
    };

    const scrollStripToIndex = (index) => {
      if (!stepsList || !isMobileProcess()) return;
      const maxScroll = Math.max(0, stepsList.scrollWidth - stepsList.clientWidth);
      const target = total <= 1 ? 0 : (index / (total - 1)) * maxScroll;
      syncingStrip = true;
      stepsList.scrollTo({ left: target, behavior: 'smooth' });
      window.setTimeout(() => { syncingStrip = false; }, 450);
    };

    steps.forEach((step, i) => {
      step.addEventListener('click', () => {
        if (isMobileProcess()) {
          applyActive(i);
          scrollStripToIndex(i);
          return;
        }
        const trackH = processTrack.offsetHeight;
        const viewH = window.innerHeight;
        const range = Math.max(1, trackH - viewH);
        const targetProgress = (i + 0.5) / total;
        const top = processTrack.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: top + targetProgress * range, behavior: 'smooth' });
      });
    });

    let processRaf = 0;
    window.addEventListener('scroll', () => {
      cancelAnimationFrame(processRaf);
      processRaf = requestAnimationFrame(updateFromVerticalScroll);
    }, { passive: true });

    if (stepsList) {
      let stripRaf = 0;
      stepsList.addEventListener('scroll', () => {
        cancelAnimationFrame(stripRaf);
        stripRaf = requestAnimationFrame(updateFromHorizontalScroll);
      }, { passive: true });
    }

    window.addEventListener('resize', () => {
      cancelAnimationFrame(processRaf);
      processRaf = requestAnimationFrame(() => {
        if (isMobileProcess()) updateFromHorizontalScroll();
        else updateFromVerticalScroll();
      });
    });

    // Always start on Discovery Call (stage 1)
    active = -1;
    applyActive(0);
    if (isMobileProcess() && stepsList) {
      stepsList.scrollLeft = 0;
    } else {
      updateFromVerticalScroll();
    }
  }

  /* ---------- Highlight the current section in the nav (built from the links) ---------- */
  const links = $$('.nav-links a');
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) links.forEach((l) => l.classList.toggle('is-active', l.hash === '#' + en.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  links.map((l) => l.hash && document.getElementById(l.hash.slice(1))).filter(Boolean).forEach((sec) => spy.observe(sec));
  // Clear the highlight when back in the hero
  new IntersectionObserver(([en]) => {
    if (en.isIntersecting) links.forEach((l) => l.classList.remove('is-active'));
  }, { rootMargin: '-45% 0px -50% 0px' }).observe($('#top'));

  /* ---------- Custom cursor over project + industry cards ---------- */
  const cursor = $('.cursor-view');
  if (cursor && finePointer && !reduceMotion) {
    const pos = { x: -200, y: -200, tx: -200, ty: -200, s: 0, ts: 0 };
    let running = false;
    const loop = () => {
      pos.x += (pos.tx - pos.x) * 0.2;
      pos.y += (pos.ty - pos.y) * 0.2;
      pos.s += (pos.ts - pos.s) * 0.18;
      cursor.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) scale(${pos.s.toFixed(3)})`;
      if (Math.abs(pos.ts - pos.s) > 0.002 || Math.abs(pos.tx - pos.x) > 0.3 || Math.abs(pos.ty - pos.y) > 0.3) {
        requestAnimationFrame(loop);
      } else {
        running = false;
      }
    };
    const kick = () => { if (!running) { running = true; requestAnimationFrame(loop); } };
    window.addEventListener('pointermove', (e) => { pos.tx = e.clientX; pos.ty = e.clientY; kick(); }, { passive: true });

    const bindCursor = (els, label) => {
      els.forEach((el) => {
        el.addEventListener('pointerenter', () => {
          cursor.textContent = label;
          pos.ts = 1;
          kick();
        });
        el.addEventListener('pointerleave', () => {
          pos.ts = 0;
          kick();
        });
      });
    };

    bindCursor($$('.project-card'), 'Discuss');
    bindCursor($$('.industry-card'), 'Explore');
  }

  /* Prefill contact "What are you building?" from a service card click */
  $$('.project-card[data-service]').forEach((card) => {
    card.addEventListener('click', () => {
      const name = card.getAttribute('data-service');
      if (!name) return;
      try { sessionStorage.setItem('prefill-service', name); } catch (err) {}
    });
  });

  const prefillService = () => {
    let name = '';
    try { name = sessionStorage.getItem('prefill-service') || ''; } catch (err) {}
    if (!name) return;
    const project = $('#f-project');
    if (project) {
      project.value = `I want to discuss ${name}`;
    }
    try { sessionStorage.removeItem('prefill-service'); } catch (err) {}
  };
  if (location.hash === '#contact') prefillService();
  window.addEventListener('hashchange', () => {
    if (location.hash === '#contact') prefillService();
  });
  setTimeout(prefillService, 0);

  /* ---------- Hero depth: the headline drifts slightly against the 3D model ---------- */
  const rootStyle = document.documentElement.style;
  if (finePointer && !reduceMotion) {
    const light = { x: 0.35, y: 0.6, tx: 0.35, ty: 0.6, hx: 0, hy: 0, thx: 0, thy: 0 };
    let lightRaf = 0;
    const stepLight = () => {
      light.x += (light.tx - light.x) * 0.12;
      light.y += (light.ty - light.y) * 0.12;
      light.hx += (light.thx - light.hx) * 0.08;
      light.hy += (light.thy - light.hy) * 0.08;
      rootStyle.setProperty('--hx', light.hx.toFixed(3));
      rootStyle.setProperty('--hy', light.hy.toFixed(3));
      const moving = Math.abs(light.tx - light.x) + Math.abs(light.ty - light.y) + Math.abs(light.thx - light.hx) + Math.abs(light.thy - light.hy);
      lightRaf = moving > 0.002 ? requestAnimationFrame(stepLight) : 0;
    };
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const nx = (e.clientX / innerWidth) * 2 - 1;
      const ny = (e.clientY / innerHeight) * 2 - 1;
      light.tx = Math.max(-1, Math.min(1, -nx));        // edges fall away from the cursor
      light.ty = Math.max(-0.4, Math.min(1, -ny * 0.8 + 0.3));
      light.thx = nx;
      light.thy = ny;
      if (!lightRaf) lightRaf = requestAnimationFrame(stepLight);
    }, { passive: true });

  }

  // The hero lines rise out of clipped boxes; once they're up, let the 3D type edges show
  const heroTitle = $('.hero-title');
  if (heroTitle) setTimeout(() => heroTitle.classList.add('is-risen'), reduceMotion ? 0 : 1500);

  /* ---------- Our Thoughts (any number) ---------- */
  const quotes = $$('.quote');
  const current = $('[data-current]');
  const total = $('[data-total]');
  const progress = $('[data-progress]');
  const controls = $('.controls');
  let index = 0;

  quotes.forEach((q) => {
    const len = ($('blockquote', q)?.textContent || '').trim().length;
    q.classList.toggle('is-long', len > 180 && len <= 300);
    q.classList.toggle('is-xlong', len > 300);
  });
  if (total) total.textContent = pad(quotes.length);
  if (progress) progress.innerHTML = quotes.map(() => '<i></i>').join('');
  const bars = progress ? $$('i', progress) : [];
  if (controls && quotes.length < 2) controls.hidden = true;

  const show = (n) => {
    if (!quotes.length) return;
    index = (n + quotes.length) % quotes.length;
    quotes.forEach((q, k) => {
      q.classList.toggle('is-active', k === index);
      q.setAttribute('aria-hidden', String(k !== index));
    });
    bars.forEach((b, k) => b.classList.toggle('on', k === index));
    if (current) current.textContent = pad(index + 1);
    window.dispatchEvent(new CustomEvent('testimonial', { detail: { index, count: quotes.length } }));
  };
  show(0);
  $('[data-prev]')?.addEventListener('click', () => show(index - 1));
  $('[data-next]')?.addEventListener('click', () => show(index + 1));

  // Arrow keys while focus is in the section, and swipe on touch screens
  $('#thoughts')?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(index - 1);
    if (e.key === 'ArrowRight') show(index + 1);
  });
  const quoteBox = $('.quotes');
  let swipeX = null;
  quoteBox?.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') swipeX = e.clientX; });
  quoteBox?.addEventListener('pointerup', (e) => {
    if (swipeX === null) return;
    const dx = e.clientX - swipeX;
    swipeX = null;
    if (Math.abs(dx) > 40) show(index + (dx < 0 ? 1 : -1));
  });

  /* ---------- Date and time picker ----------
     Two fields. Date opens a calendar; Time opens a short list of times for that
     date (picking a date hands straight over to the time list).
     Availability is set once, in the studio's timezone (data-studio-tz, hours and
     weekdays on [data-picker]). Each visitor sees it converted to their own
     timezone and regional style (12/24-hour clock, first day of the week). The
     booking carries the time in the studio's timezone, the visitor's, and UTC. */
  function createPicker(root) {
    const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
    const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const monthStart = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
    const toDate = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };

    const cfg = {
      studioTz: root.dataset.studioTz || 'Asia/Kolkata',
      start: toMin(root.dataset.start || '09:00'),
      end: toMin(root.dataset.end || '18:00'),
      step: Number(root.dataset.step) || 30,
      days: (root.dataset.days || '1,2,3,4,5').split(',').map(Number),
      maxDays: Number(root.dataset.maxDays) || 60,
      leadHours: Number(root.dataset.leadHours) || 0,
    };

    /* Visitor's region: English words, their own date order, clock and week start */
    const langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en-GB'];
    const locale = langs.find((l) => /^en(-|$)/i.test(l)) || 'en-GB';
    let visitorTz = cfg.studioTz;
    try { visitorTz = Intl.DateTimeFormat().resolvedOptions().timeZone || cfg.studioTz; } catch (err) { /* keep the studio's */ }
    const weekStart = (() => {
      try {
        const loc = new Intl.Locale(langs[0]);
        const info = loc.getWeekInfo ? loc.getWeekInfo() : loc.weekInfo;
        if (info && info.firstDay) return info.firstDay % 7; // 1 Mon … 7 Sun → 0 Sun
        const region = loc.maximize().region;
        return ['US', 'CA', 'MX', 'BR', 'JP', 'KR', 'TW', 'HK', 'PH', 'IN', 'IL', 'ZA'].includes(region) ? 0 : 1;
      } catch (err) { return 1; }
    })();

    const fmt = (opts, tz = visitorTz, loc = locale) => new Intl.DateTimeFormat(loc, { timeZone: tz, ...opts });
    const fMonth = fmt({ month: 'long', year: 'numeric' });
    const fLong = fmt({ weekday: 'long', day: 'numeric', month: 'long' });
    const fShort = fmt({ weekday: 'short', day: 'numeric', month: 'short' });
    const fTime = fmt({ hour: 'numeric', minute: '2-digit' });
    const fStudio = fmt({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }, cfg.studioTz, 'en-GB');
    const tzName = (tz, d, style) => (fmt({ timeZoneName: style }, tz).formatToParts(d).find((x) => x.type === 'timeZoneName') || {}).value || '';
    const tzLong = tzName(visitorTz, new Date(), 'long') || visitorTz.split('/').pop().replace(/_/g, ' ');

    $('[data-tz]', root).textContent = `Times are shown in ${tzLong}.`;
    const fWeekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
    $('[data-cal-week]', root).innerHTML = Array.from({ length: 7 }, (_, i) =>
      `<span>${fWeekday.format(new Date(Date.UTC(2023, 0, 1 + ((weekStart + i) % 7))))}</span>`).join(''); // 1 Jan 2023 was a Sunday

    /* Studio wall-clock time → exact moment, using the browser's timezone data */
    const partsIn = (tz, ms) => {
      const p = {};
      new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
      }).formatToParts(new Date(ms)).forEach((x) => { p[x.type] = Number(x.value); });
      return p;
    };
    const offsetIn = (tz, ms) => {
      const p = partsIn(tz, ms);
      return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - ms;
    };
    const studioMoment = (y, m, d, minutes) => {
      const wall = Date.UTC(y, m, d, Math.floor(minutes / 60), minutes % 60);
      const first = wall - offsetIn(cfg.studioTz, wall);
      return wall - offsetIn(cfg.studioTz, first); // second pass settles daylight-saving edges
    };

    /* Every bookable moment, grouped by the visitor's local date */
    const slotsByDay = new Map();
    const now = Date.now();
    const earliest = now + cfg.leadHours * 3600e3;
    const latest = now + cfg.maxDays * 86400e3;
    const studioToday = partsIn(cfg.studioTz, now);
    for (let k = -1; k <= cfg.maxDays + 1; k++) {
      const day = new Date(Date.UTC(studioToday.year, studioToday.month - 1, studioToday.day + k));
      if (!cfg.days.includes(day.getUTCDay())) continue;
      for (let m = cfg.start; m < cfg.end; m += cfg.step) {
        const t = studioMoment(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), m);
        if (t < earliest || t > latest) continue;
        const key = iso(new Date(t));
        if (!slotsByDay.has(key)) slotsByDay.set(key, []);
        slotsByDay.get(key).push(t);
      }
    }
    const keys = [...slotsByDay.keys()].sort();
    const firstMonth = monthStart(keys.length ? toDate(keys[0]) : new Date());
    const lastMonth = monthStart(keys.length ? toDate(keys[keys.length - 1]) : new Date());

    const dateTrigger = $('[data-date-trigger]', root);
    const timeTrigger = $('[data-time-trigger]', root);
    const dateValue = $('[data-date-value]', root);
    const timeValue = $('[data-time-value]', root);
    const datePop = $('[data-date-pop]', root);
    const timePop = $('[data-time-pop]', root);
    const monthEl = $('.cal-month', root);
    const prevBtn = $('[data-cal-prev]', root);
    const nextBtn = $('[data-cal-next]', root);
    const daysEl = $('[data-cal-days]', root);
    const slotsEl = $('[data-slots]', root);
    const slotsTitle = $('[data-slots-title]', root);
    const errorText = $('.error-msg span', root);
    const out = (name) => $(`[data-out="${name}"]`, root);

    let view = firstMonth;
    let selKey = null;
    let selMoment = null;

    function renderCalendar(focusKey) {
      monthEl.textContent = fMonth.format(view);
      prevBtn.disabled = view <= firstMonth;
      nextBtn.disabled = view >= lastMonth;
      const lead = (view.getDay() - weekStart + 7) % 7;
      const count = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
      const todayKey = iso(new Date());
      let html = '<span></span>'.repeat(lead);
      for (let n = 1; n <= count; n++) {
        const d = new Date(view.getFullYear(), view.getMonth(), n);
        const key = iso(d);
        const ok = slotsByDay.has(key);
        html += `<button type="button" class="cal-day${key === todayKey ? ' is-today' : ''}" data-day="${key}"`
          + ` aria-label="${fLong.format(d)}${ok ? '' : ', unavailable'}" aria-pressed="${key === selKey}" tabindex="-1"${ok ? '' : ' disabled'}>${n}</button>`;
      }
      daysEl.innerHTML = html;
      // One tab stop in the grid: the picked day, else the first bookable one
      const days = $$('.cal-day', daysEl);
      const stop = days.find((b) => b.dataset.day === focusKey)
        || days.find((b) => b.getAttribute('aria-pressed') === 'true')
        || days.find((b) => !b.disabled);
      if (stop) {
        stop.tabIndex = 0;
        if (focusKey) stop.focus();
      }
    }

    function renderSlots() {
      if (!keys.length) {
        slotsTitle.textContent = 'No times available right now';
        slotsEl.innerHTML = '<p class="slots-empty">Email us and we’ll find a time.</p>';
        return;
      }
      if (!selKey) {
        slotsTitle.textContent = 'Pick a date first';
        slotsEl.innerHTML = '';
        return;
      }
      slotsTitle.textContent = fLong.format(toDate(selKey));
      slotsEl.innerHTML = slotsByDay.get(selKey).map((t) =>
        `<button type="button" class="slot" data-t="${t}" aria-pressed="${t === selMoment}">${fTime.format(new Date(t))}</button>`).join('');
    }

    function details() {
      if (!selMoment) return null;
      const d = new Date(selMoment);
      return {
        studio: `${fStudio.format(d)} ${tzName(cfg.studioTz, d, 'short')} (${cfg.studioTz})`,
        visitor: `${fShort.format(d)}, ${fTime.format(d)} ${tzName(visitorTz, d, 'short')} (${visitorTz})`,
        tz: visitorTz,
        utc: d.toISOString(),
      };
    }

    function sync() {
      const info = details();
      ['studio', 'visitor', 'tz', 'utc'].forEach((k) => { out(k).value = info ? info[k] : ''; });
      dateValue.textContent = selKey ? fShort.format(toDate(selKey)) : 'Pick a date';
      timeValue.textContent = selMoment ? fTime.format(new Date(selMoment)) : 'Pick a time';
      dateTrigger.classList.toggle('is-empty', !selKey);
      timeTrigger.classList.toggle('is-empty', !selMoment);
      if (selKey) dateTrigger.classList.remove('is-invalid');
      if (selMoment) timeTrigger.classList.remove('is-invalid');
      if (info) root.classList.remove('has-error');
    }

    /* Pop-ups */
    const pops = [[dateTrigger, datePop], [timeTrigger, timePop]];
    const openPop = () => pops.find(([, p]) => !p.hidden);

    // Open upward if there is more room above; keep the calendar inside the screen
    function place(trigger, pop) {
      pop.classList.remove('is-up', 'is-right');
      const r = trigger.getBoundingClientRect();
      const navH = ($('.nav') || { offsetHeight: 0 }).offsetHeight;
      const below = innerHeight - r.bottom - 16;
      const above = r.top - navH - 16;
      if (pop.offsetHeight > below && above > below) pop.classList.add('is-up');
      if (pop === datePop && r.left + pop.offsetWidth > innerWidth - 16) pop.classList.add('is-right');
    }

    function close(returnFocus) {
      const open = openPop();
      if (!open) return;
      const [trigger, pop] = open;
      pop.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      if (returnFocus) trigger.focus();
    }

    function openDate() {
      close(false);
      if (selKey) view = monthStart(toDate(selKey));
      datePop.hidden = false;
      dateTrigger.setAttribute('aria-expanded', 'true');
      renderCalendar('open'); // focuses the picked day, or the first bookable one
      place(dateTrigger, datePop);
    }

    function openTime() {
      if (!selKey) { openDate(); return; } // no date yet: choose one first
      close(false);
      renderSlots();
      timePop.hidden = false;
      timeTrigger.setAttribute('aria-expanded', 'true');
      place(timeTrigger, timePop);
      const target = $('.slot[aria-pressed="true"]', slotsEl) || $('.slot', slotsEl);
      if (target) {
        // Centre the chosen (or first) time in the list without scrolling the page
        slotsEl.scrollTop = target.offsetTop - slotsEl.offsetTop - (slotsEl.clientHeight - target.offsetHeight) / 2;
        target.focus({ preventScroll: true });
      }
    }

    dateTrigger.addEventListener('click', () => (datePop.hidden ? openDate() : close(false)));
    timeTrigger.addEventListener('click', () => (timePop.hidden ? openTime() : close(false)));
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && openPop()) { e.stopPropagation(); close(true); }
    });
    document.addEventListener('pointerdown', (e) => { if (openPop() && !root.contains(e.target)) close(false); });
    root.addEventListener('focusout', () => {
      setTimeout(() => { if (openPop() && !root.contains(document.activeElement)) close(false); }, 0);
    });
    addEventListener('resize', () => { const o = openPop(); if (o) place(o[0], o[1]); });

    // Picking a date hands over to the time list
    daysEl.addEventListener('click', (e) => {
      const b = e.target.closest('.cal-day');
      if (!b || b.disabled) return;
      selKey = b.dataset.day;
      if (selMoment && !slotsByDay.get(selKey).includes(selMoment)) selMoment = null;
      sync();
      openTime();
    });

    // Arrow keys move between bookable days
    daysEl.addEventListener('keydown', (e) => {
      const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
      if (!(e.key in moves)) return;
      e.preventDefault();
      const days = $$('.cal-day', daysEl);
      let i = days.indexOf(document.activeElement);
      if (i < 0) return;
      do { i += moves[e.key]; } while (i >= 0 && i < days.length && days[i].disabled);
      if (i < 0 || i >= days.length) return;
      days.forEach((b) => { b.tabIndex = -1; });
      days[i].tabIndex = 0;
      days[i].focus();
    });

    // Arrow keys move through the time list
    slotsEl.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const list = $$('.slot', slotsEl);
      const i = list.indexOf(document.activeElement);
      const next = list[Math.max(0, Math.min(list.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))];
      if (next) next.focus();
    });

    slotsEl.addEventListener('click', (e) => {
      const b = e.target.closest('.slot');
      if (!b) return;
      selMoment = Number(b.dataset.t);
      sync();
      close(true);
    });

    prevBtn.addEventListener('click', () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); renderCalendar(); });
    nextBtn.addEventListener('click', () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); renderCalendar(); });

    renderCalendar();
    renderSlots();
    sync();

    return {
      validate() {
        const ok = !!selMoment;
        root.classList.toggle('has-error', !ok);
        dateTrigger.classList.toggle('is-invalid', !selKey);
        timeTrigger.classList.toggle('is-invalid', !selMoment);
        errorText.textContent = ok ? '' : selKey ? 'Pick a time for the call.' : 'Pick a date and a time for the call.';
        return ok;
      },
      focusFirst() {
        if (selKey) { timeTrigger.focus(); openTime(); } else { dateTrigger.focus(); openDate(); }
      },
      label() {
        return selMoment ? `${fShort.format(new Date(selMoment))} at ${fTime.format(new Date(selMoment))}` : '';
      },
      details,
    };
  }

  /* ---------- Booking form ---------- */
  const form = $('#book-form');
  const success = $('#book-success');
  const pickerEl = $('[data-picker]', form);
  const picker = pickerEl ? createPicker(pickerEl) : null;
  const rules = {
    name: (v) => v.trim().length > 1 || 'Tell us your name.',
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || 'Enter a valid work email, like jane@company.com.',
  };
  const fields = $$('.input', form).filter((f) => rules[f.name]);

  const check = (input) => {
    const result = rules[input.name](input.value);
    const ok = result === true;
    input.closest('.field').classList.toggle('has-error', !ok);
    input.setAttribute('aria-invalid', String(!ok));
    $('.error-msg span', input.closest('.field')).textContent = ok ? '' : result;
    return ok;
  };

  fields.forEach((input) => {
    input.addEventListener('blur', () => { if (input.value) check(input); });
    input.addEventListener('input', () => { if (input.closest('.field').classList.contains('has-error')) check(input); });
  });

  /* Phone: optional, but if filled must match selected country digit length */
  const phoneField = $('[data-phone-field]', form);
  const phoneCc = phoneField ? $('#f-cc', phoneField) : null;
  const phoneNum = phoneField ? $('#f-phone', phoneField) : null;

  const checkPhone = () => {
    if (!phoneField || !phoneCc || !phoneNum) return true;
    const raw = phoneNum.value.replace(/\D/g, '');
    phoneNum.value = raw; // keep digits only
    if (!raw) {
      phoneField.classList.remove('has-error');
      phoneNum.setAttribute('aria-invalid', 'false');
      $('.error-msg span', phoneField).textContent = '';
      return true;
    }
    const opt = phoneCc.selectedOptions[0];
    const allowed = (opt?.dataset.digits || '10').split(',').map(Number);
    const ok = allowed.includes(raw.length);
    phoneField.classList.toggle('has-error', !ok);
    phoneNum.setAttribute('aria-invalid', String(!ok));
    const range = allowed.length === 1
      ? `${allowed[0]} digits`
      : `${allowed[0]}–${allowed[allowed.length - 1]} digits`;
    $('.error-msg span', phoneField).textContent = ok
      ? ''
      : `Enter a valid number for ${phoneCc.value} (${range}).`;
    return ok;
  };

  if (phoneNum) {
    phoneNum.addEventListener('input', () => {
      phoneNum.value = phoneNum.value.replace(/\D/g, '');
      if (phoneField.classList.contains('has-error') || phoneNum.value) checkPhone();
    });
    phoneNum.addEventListener('blur', () => { if (phoneNum.value) checkPhone(); });
  }
  if (phoneCc) {
    phoneCc.addEventListener('change', () => {
      if (phoneNum && phoneNum.value) checkPhone();
    });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const firstInvalid = fields.map((f) => [f, check(f)]).find(([, ok]) => !ok);
    if (firstInvalid) { firstInvalid[0].focus(); return; }
    if (!checkPhone()) { phoneNum?.focus(); return; }

    const btn = $('[type="submit"]', form);
    const btnText = $('.btn-text', btn);
    const formError = $('.form-error', form);
    if (formError) formError.hidden = true;
    btn.disabled = true;
    btnText.textContent = 'Sending…';

    // What you receive. Each key becomes a labelled line in the email.
    const name = $('#f-name').value.trim();
    const email = $('#f-email').value.trim();
    const phoneDigits = (phoneNum && phoneNum.value.replace(/\D/g, '')) || '';
    const phoneFull = phoneDigits ? `${phoneCc?.value || ''} ${phoneDigits}`.trim() : '';
    const when = picker ? picker.details() : null;
    const payload = {
      _subject: `Call booked: ${name}${when ? ` \u2014 ${when.studio}` : ''}`,
      _replyto: email,
      Name: name,
      Email: email,
      Phone: phoneFull,
      'Call time (your timezone)': when ? when.studio : '',
      'Call time (their timezone)': when ? when.visitor : '',
      'What they are building': $('#f-project').value.trim(),
      'Call start (UTC)': when ? when.utc : '',
      visitor_timezone: when && when.tz ? when.tz : '',
    };

    // data-endpoint = Google Apps Script web app URL (see backend/google-apps-script/SETUP.md).
    // text/plain avoids a CORS preflight; Apps Script still receives JSON in postData.contents.
    const endpoint = (form.dataset.endpoint || '').trim();
    const send = endpoint
      ? fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow',
      }).then(async (r) => {
        const text = await r.text();
        let data = null;
        try { data = JSON.parse(text); } catch (err) { /* non-JSON still OK if HTTP ok */ }
        if (!r.ok || (data && data.ok === false)) {
          throw new Error((data && data.error) || `HTTP ${r.status}`);
        }
      })
      : new Promise((resolve) => setTimeout(resolve, 700));

    send.then(() => {
      $('[data-name]', success).textContent = name.split(/\s+/)[0];
      $('[data-email]', success).textContent = email;
      const whenLabel = picker ? picker.label() : '';
      const whenEl = $('[data-when]', success);
      const whenWrap = $('[data-when-wrap]', success);
      if (whenEl && whenLabel) whenEl.textContent = whenLabel;
      if (whenWrap) whenWrap.hidden = !whenLabel;
      form.hidden = true;
      success.hidden = false;
      success.focus();
      layoutChanged();
    }).catch(() => {
      btn.disabled = false;
      btnText.textContent = 'Book a Discovery Call';
      if (formError) formError.hidden = false;
    });
  });

  /* ---------- Mobile "Book a call" bar hides once the contact section is on screen ---------- */
  new IntersectionObserver(([en]) => {
    contactVisible = en.isIntersecting;
    mobileBar.classList.toggle('is-hidden', contactVisible || menuOpen);
  }, { threshold: 0.1 }).observe($('#contact'));

  /* ---------- AI Across Industries modal ---------- */
  const industryData = {
    manufacturing: {
      eyebrow: 'Industry 01',
      title: 'Manufacturing & Industry',
      desc: 'AI for factories, production lines, equipment, and quality control.',
      items: [
        'Computer vision for defect detection, unit counting, vision monitoring and quality inspection.',
        'Predictive maintenance and equipment anomaly detection.',
        'Production monitoring and process optimization.',
        'AI assistants for technical manuals and operational knowledge.',
        'AI/Vision based robotics and industrial automation integrations.',
      ],
    },
    logistics: {
      eyebrow: 'Industry 02',
      title: 'Logistics & Supply Chain',
      desc: 'AI for moving, tracking, storing, and delivering goods.',
      items: [
        'Inventory monitoring and stock forecasting.',
        'Document extraction from invoices, purchase orders, and shipping records.',
        'Warehouse computer vision and package identification.',
        'Warehouse automation with vision-based tracking.',
        'AI assistants for shipment status and operational queries.',
      ],
    },
    agriculture: {
      eyebrow: 'Industry 03',
      title: 'Agriculture & AgriTech',
      desc: 'AI for farms, crops, agricultural equipment, and resource management.',
      items: [
        'Crop disease and pest detection using computer vision.',
        'Crop health monitoring from images and sensor data.',
        'Agricultural knowledge assistants and farm-management automation.',
        'Smart irrigation and IoT-based monitoring.',
      ],
    },
    it: {
      eyebrow: 'Industry 04',
      title: 'IT & Software',
      desc: 'AI for software teams, technical operations, and existing digital products.',
      items: [
        'AI copilots and internal knowledge assistants.',
        'Intelligent search across technical documentation.',
        'Resume screening and candidate matching.',
        'Employee support assistants and policy Q&A.',
        'AI features integrated into existing applications and APIs.',
        'Codebase assistance, testing support, and developer workflows.',
        'IT service-desk automation and log anomaly detection.',
        'Customized Agentic AI workflows.',
      ],
    },
    business: {
      eyebrow: 'Industry 05',
      title: 'Business & Enterprise Operations',
      desc: 'AI for everyday business processes across departments.',
      items: [
        'Customer-support chatbots and AI agents.',
        'Invoice, form, and document processing.',
        'Sales and customer relationship management assistance.',
        'Multi-agent workflows connecting multiple tools and processes.',
      ],
    },
    retail: {
      eyebrow: 'Industry 06',
      title: 'Retail & E-commerce',
      desc: 'AI for customer experience, product discovery, and retail operations.',
      items: [
        'AI shopping assistants and product recommendations.',
        'Visual product search and image-based categorization.',
        'Customer feedback analysis and support automation.',
        'Sales insights and personalized digital experiences.',
      ],
    },
    healthcare: {
      eyebrow: 'Industry 07',
      title: 'Healthcare & Life Sciences',
      desc: 'AI for healthcare workflows, medical information, and research support.',
      items: [
        'Appointment scheduling, patient triage chatbots, and automated medical record summaries.',
        'Medical document processing and information extraction.',
        'Clinical knowledge retrieval and document search.',
        'Healthcare operations and workflow automation.',
      ],
    },
    finance: {
      eyebrow: 'Industry 08',
      title: 'Banking, Finance & Insurance',
      desc: 'AI for financial services, risk analysis, and operational efficiency.',
      items: [
        'Intelligent document processing for financial records and insurance claims.',
        'AI-powered customer-support assistants.',
        'Insurance claims processing and workflow automation.',
        'AI knowledge assistants for financial products and compliance documentation.',
        'Multi-agent workflows for banking and insurance operations.',
      ],
    },
    custom: {
      eyebrow: 'Industry 09',
      title: 'Custom Solutions',
      desc: "Didn't find your sector? Let's talk about your requirement.",
      items: [
        'Customized AI solutions and integrations tailored to your business needs.',
        'End-to-end chatbots, agentic workflows, and voice agents to automate complex processes.',
        'Tailored software, computer vision, and intelligent system development for specialized use cases.',
      ],
      cta: true,
    },
  };

  const industryModal = $('#industry-modal');
  if (industryModal) {
    const mEyebrow = $('[data-industry-eyebrow]', industryModal);
    const mTitle = $('[data-industry-title]', industryModal);
    const mDesc = $('[data-industry-desc]', industryModal);
    const mList = $('[data-industry-list]', industryModal);
    const mFooter = $('[data-industry-footer]', industryModal);
    let lastFocus = null;

    const openIndustry = (key) => {
      const data = industryData[key];
      if (!data) return;
      lastFocus = document.activeElement;
      mEyebrow.textContent = data.eyebrow;
      mTitle.textContent = data.title;
      mDesc.textContent = data.desc;
      mList.innerHTML = data.items.map((t) => `<li>${t}</li>`).join('');
      mFooter.hidden = !data.cta;
      industryModal.hidden = false;
      document.body.classList.add('industry-modal-open');
      $('[data-industry-close]', industryModal)?.focus?.();
      const closeBtn = $('.industry-modal-close', industryModal);
      closeBtn?.focus();
    };

    const closeIndustry = () => {
      industryModal.hidden = true;
      document.body.classList.remove('industry-modal-open');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    };

    $$('[data-industry]').forEach((card) => {
      card.addEventListener('click', () => openIndustry(card.dataset.industry));
    });

    industryModal.querySelectorAll('[data-industry-close]').forEach((el) => {
      el.addEventListener('click', closeIndustry);
    });

    const cta = $('[data-industry-cta]', industryModal);
    cta?.addEventListener('click', () => closeIndustry());

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !industryModal.hidden) closeIndustry();
    });
  }

  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  /* ---------- Chatbot widget (UI + mock replies) ---------- */
  const chatbotRoot = $('[data-chatbot]');
  const chatbotPanel = $('#chatbot-panel');
  const chatbotToggle = $('[data-chatbot-toggle]');
  const chatbotClose = $('[data-chatbot-close]');
  const chatbotForm = $('[data-chatbot-form]');
  const chatbotMessages = $('[data-chatbot-messages]');
  const chatbotInput = $('#chatbot-input');

  if (chatbotRoot && chatbotPanel && chatbotToggle) {
    const setOpen = (open) => {
      chatbotRoot.classList.toggle('is-open', open);
      chatbotPanel.hidden = !open;
      chatbotToggle.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('chatbot-open', open);
      if (open) {
        setTimeout(() => chatbotInput?.focus(), 50);
      } else {
        chatbotToggle.focus();
      }
    };

    chatbotToggle.addEventListener('click', () => {
      setOpen(chatbotPanel.hidden);
    });
    chatbotClose?.addEventListener('click', () => setOpen(false));

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !chatbotPanel.hidden) setOpen(false);
    });

    const appendMsg = (text, role) => {
      const el = document.createElement('div');
      el.className = `chatbot-msg chatbot-msg--${role}`;
      const p = document.createElement('p');
      p.textContent = text;
      el.appendChild(p);
      chatbotMessages.appendChild(el);
      chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
      return el;
    };

    chatbotForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = (chatbotInput?.value || '').trim();
      if (!text) return;
      chatbotInput.value = '';
      appendMsg(text, 'user');

      const typing = appendMsg('…', 'bot');
      typing.classList.add('chatbot-msg--typing');

      setTimeout(() => {
        typing.remove();
        // Placeholder until real chatbot server is wired
        appendMsg('response from bot', 'bot');
      }, 450 + Math.random() * 350);
    });
  }
})();
