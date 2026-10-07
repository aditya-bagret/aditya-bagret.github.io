(function () {
  const site = window.SITE;
  const $ = (id) => document.getElementById(id);
  const world = $("world");
  const playerEl = $("player");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

  // ── pixel sprites ────────────────────────────────────────────
  // Each sprite is a list of rows; each character is one pixel looked up in
  // the palette ("." is transparent). Rows become one SVG data URI.
  function sprite(rows, pal) {
    const w = rows[0].length, h = rows.length;
    let rects = "";
    rows.forEach((row, y) => {
      for (let x = 0; x < w; ) {
        const ch = row[x];
        let run = 1;
        while (x + run < w && row[x + run] === ch) run++;
        if (pal[ch]) rects += `<rect x="${x}" y="${y}" width="${run}" height="1" fill="${pal[ch]}"/>`;
        x += run;
      }
    });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${rects}</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }

  // Build a sprite from a function (x, y) -> palette key.
  function paint(w, h, fn) {
    const rows = [];
    for (let y = 0; y < h; y++) {
      let row = "";
      for (let x = 0; x < w; x++) row += fn(x, y) || ".";
      rows.push(row);
    }
    return rows;
  }

  const HERO = {
    C: "#1a8f6e", H: "#4a2a14", S: "#f6c08a", E: "#1a1033",
    O: "#f08a24", o: "#c0601a", J: "#2d4a9a", K: "#3a2010",
  };
  const heroTop = [
    "....CCCCC...",
    "...CCCCCCCCC",
    "...HHHSSES..",
    "..HSHSSSESS.",
    "..HSHHSSSSSS",
    "..HHSSSSSSS.",
    "....SSSSS...",
  ];
  const FRAMES = {
    stand: sprite([...heroTop,
      "...ooOOOoo..",
      "..oOOOOOOOo.",
      ".SoOOOOOOOoS",
      ".SSOOOOOOOSS",
      "...OOOOOOO..",
      "...JJJ.JJJ..",
      "...JJJ.JJJ..",
      "..KKKK.KKKK.",
      "..KKKK.KKKK.",
    ], HERO),
    walk: sprite([...heroTop,
      "...ooOOOoo..",
      "..oOOOOOOOo.",
      ".SoOOOOOOOoS",
      ".SSOOOOOOOSS",
      "...OOOOOOO..",
      "..JJJ..JJJ..",
      ".JJJ....JJJ.",
      ".KKK.....KKK",
      ".KK......KK.",
    ], HERO),
    jump: sprite([...heroTop,
      "S..ooOOoo..S",
      "SoOOOOOOOOoS",
      "..oOOOOOOOo.",
      "..OOOOOOOO..",
      "...OOOOOOO..",
      "...JJJ.JJJ..",
      "..JJJ...JJJ.",
      "..KKK....KKK",
      "............",
    ], HERO),
  };

  const BLOCK_PAL = { O: "#5a2800", Y: "#f8a830", d: "#9a4a00", W: "#fff6d8" };
  const BLOCK = sprite([
    ".OOOOOOOOOOOOOO.",
    "OYYYYYYYYYYYYYYd",
    "OYdYYYYYYYYYYdYd",
    "OYYYYWWWWWYYYYYd",
    "OYYYWWddddWWYYYd",
    "OYYYWWdYYYWWdYYd",
    "OYYYYddYYWWWdYYd",
    "OYYYYYYYWWWddYYd",
    "OYYYYYYWWddYYYYd",
    "OYYYYYYWWdYYYYYd",
    "OYYYYYYYddYYYYYd",
    "OYYYYYYWWYYYYYYd",
    "OYYYYYYWWdYYYYYd",
    "OYdYYYYYddYYYdYd",
    "OYYYYYYYYYYYYYYd",
    "dddddddddddddddd",
  ], BLOCK_PAL);
  const USED = sprite(paint(16, 16, (x, y) => {
    if (x === 0 || y === 0) return "O";
    if (x === 15 || y === 15) return "d";
    if ((x === 2 || x === 13) && (y === 2 || y === 13)) return "O";
    return "u";
  }), { O: "#3a1a00", d: "#2a1000", u: "#8a5a2a" });

  const COIN = sprite([
    "..OOOO..",
    ".OYYYYO.",
    "OYYWWYYO",
    "OYWYYYYO",
    "OYWYYYYO",
    "OYWYYYYO",
    "OYWYYYYO",
    "OYWYYYYO",
    "OYWYYYYO",
    "OYWYYYYO",
    "OYWYYYYO",
    "OYYYYYdO",
    ".OYYYdO.",
    "..OOOO..",
  ], { O: "#6a3a00", Y: "#ffd84a", W: "#fffbe0", d: "#d89a10" });

  const specks = new Set(["2,7", "9,5", "13,10", "5,12", "11,14", "1,14", "7,9", "14,3"]);
  const GRASS = sprite(paint(16, 16, (x, y) => {
    if (y === 0) return "L";
    if (y < 4) return (x * 7 + y) % 5 === 0 ? "L" : "G";
    if (y === 4) return x % 4 === 1 ? "B" : "D";
    if (y === 5) return x % 4 === 3 ? "D" : "B";
    return specks.has(`${x},${y}`) ? "b" : "B";
  }), { L: "#9be86a", G: "#4cb43a", D: "#2e7a28", B: "#c8742c", b: "#8a4a1c" });
  const DIRT = sprite(paint(16, 16, (x, y) =>
    specks.has(`${x},${(y + 6) % 16}`) ? "b" : "B"
  ), { B: "#c8742c", b: "#8a4a1c" });

  function sceneryColors() {
    const cs = getComputedStyle(document.documentElement);
    const v = (n) => cs.getPropertyValue(n).trim();
    return { cloud: v("--cloud"), shade: v("--cloud-shade"), hill: v("--hill"), dark: v("--hill-dark") };
  }

  function paintScenery() {
    const c = sceneryColors();
    const blobs = [[6, 7, 5], [12, 5, 5.5], [18, 7, 5]];
    const cloud = sprite(paint(24, 12, (x, y) => {
      const inside = blobs.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r) || (y >= 7 && y <= 10 && x >= 2 && x <= 21);
      if (!inside || y > 11) return ".";
      return y >= 9 ? "s" : "w";
    }), { w: c.cloud, s: c.shade });
    const hill = sprite(paint(24, 12, (x, y) => {
      const half = 2 + y * 0.85;
      if (Math.abs(x - 11.5) > half) return ".";
      if ((x + y * 3) % 9 === 0 && y > 3) return "d";
      return "g";
    }), { g: c.hill, d: c.dark });
    document.querySelectorAll(".cloud").forEach((el) => (el.style.backgroundImage = cloud));
    document.querySelectorAll(".hill").forEach((el) => (el.style.backgroundImage = hill));
  }
  paintScenery();
  darkQuery.addEventListener("change", paintScenery);

  document.querySelector(".ground").style.backgroundImage = `${GRASS}, ${DIRT}`;
  document.querySelector(".coin-icon").style.backgroundImage = COIN;
  playerEl.style.backgroundImage = FRAMES.stand;

  // ── text ─────────────────────────────────────────────────────
  $("name").textContent = site.name;
  $("tagline").textContent = site.tagline;
  $("hud-name").textContent = site.name.split(" ")[0].toUpperCase();

  // ── blocks ───────────────────────────────────────────────────
  const blocks = site.blocks.map((b, i) => {
    const a = document.createElement("a");
    a.className = "block";
    a.href = b.url;
    a.style.backgroundImage = BLOCK;
    a.setAttribute("aria-label", b.label);
    a.innerHTML = `<span class="label"></span><span class="key">[${i + 1}]</span>`;
    a.querySelector(".label").textContent = b.label;
    a.addEventListener("click", (ev) => {
      // Let cmd/ctrl/shift-click open a new tab as usual.
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) return;
      ev.preventDefault();
      goTo(i);
    });
    $("blocks").append(a);
    return { ...b, el: a, cx: 0 };
  });

  // ── layout ───────────────────────────────────────────────────
  let T = 40, W = 0, PW = 30, PH = 40, BLOCK_Y = 0, G = 0, JUMP_V = 0, SPEED = 0;

  function layout() {
    W = world.clientWidth;
    const H = world.clientHeight;
    T = Math.round(Math.min(52, Math.max(28, Math.min(W / (W < 600 ? 10 : 18), H / 13))));
    document.documentElement.style.setProperty("--t", T + "px");
    PW = T * 0.75;
    PH = T;
    BLOCK_Y = T * 2.75;                 // block underside, measured from the ground
    G = T * 55;
    JUMP_V = Math.sqrt(2 * G * T * 2.3);
    SPEED = T * 5;
    const spread = blocks.length === 1 ? [0.5] : blocks.map((_, i) => 0.3 + (0.4 * i) / (blocks.length - 1));
    blocks.forEach((b, i) => {
      b.cx = Math.round(W * spread[i]);
      b.el.style.left = b.cx - T / 2 + "px";
      b.el.style.bottom = T * 2 + BLOCK_Y + "px";
    });
    p.x = Math.min(Math.max(p.x, 0), W - PW);
  }

  // ── player ───────────────────────────────────────────────────
  const p = { x: 0, y: 0, vx: 0, vy: 0, ground: true, face: 1, anim: 0 };
  const keys = { left: false, right: false };
  let auto = null;      // index of the block the player is running to
  let busy = false;     // a block was hit and we're about to leave

  function jump() {
    if (p.ground && !busy) { p.vy = JUMP_V; p.ground = false; }
  }

  function goTo(i) {
    if (busy) return;
    if (reduceMotion) return hit(i);
    auto = i;
  }

  function hit(i) {
    if (busy) return;
    busy = true;
    auto = null;
    const b = blocks[i];
    b.el.classList.remove("bump");
    void b.el.offsetWidth;
    b.el.classList.add("bump");

    const coin = document.createElement("div");
    coin.className = "coin-pop";
    coin.style.backgroundImage = COIN;
    coin.style.left = b.cx - T * 0.25 + "px";
    coin.style.bottom = T * 2 + BLOCK_Y + T * 0.1 + "px";
    world.append(coin);

    const pts = document.createElement("div");
    pts.className = "points";
    pts.textContent = "+100";
    pts.style.left = b.cx + "px";
    pts.style.bottom = T * 2 + BLOCK_Y + T * 1.4 + "px";
    world.append(pts);

    score += 100; coins += 1; drawHud();
    setTimeout(() => (b.el.style.backgroundImage = USED), 220);
    setTimeout(() => world.classList.add("leaving"), reduceMotion ? 0 : 650);
    setTimeout(() => (window.location.href = b.url), reduceMotion ? 150 : 1000);
  }

  function step(dt) {
    // horizontal intent
    let dir = 0;
    if (auto !== null) {
      const tx = blocks[auto].cx - PW / 2;
      const dx = tx - p.x;
      if (Math.abs(dx) > SPEED * dt) dir = Math.sign(dx);
      else { p.x = tx; if (p.ground) jump(); }
    } else if (!busy) {
      dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    }
    p.vx = dir * SPEED;
    if (dir) p.face = dir;

    const prevX = p.x, prevTop = p.y + PH;
    p.x = Math.min(Math.max(p.x + p.vx * dt, 0), W - PW);

    p.vy -= G * dt;
    p.y += p.vy * dt;
    if (p.y <= 0) { p.y = 0; p.vy = 0; p.ground = true; }

    blocks.forEach((b, i) => {
      const left = b.cx - T / 2, right = b.cx + T / 2;
      const overlapX = p.x + PW > left + 2 && p.x < right - 2;
      const overlapY = p.y + PH > BLOCK_Y && p.y < BLOCK_Y + T;
      if (!overlapX || !overlapY) return;
      if (p.vy > 0 && prevTop <= BLOCK_Y + 1) {
        // head-butt from below
        p.y = BLOCK_Y - PH;
        p.vy = 0;
        hit(i);
      } else {
        p.x = prevX;   // bumped into the side
      }
    });

    p.anim += dt;
    const frame = !p.ground ? "jump" : p.vx && Math.floor(p.anim / 0.1) % 2 ? "walk" : "stand";
    if (playerEl.dataset.frame !== frame) {
      playerEl.dataset.frame = frame;
      playerEl.style.backgroundImage = FRAMES[frame];
    }
    playerEl.style.transform = `translate(${p.x}px, ${-p.y}px) scaleX(${p.face})`;
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    step(dt);
    requestAnimationFrame(loop);
  }

  // ── HUD ──────────────────────────────────────────────────────
  let score = 0, coins = 0, time = 400;
  function drawHud() {
    $("score").textContent = String(score).padStart(6, "0");
    $("coins").textContent = String(coins).padStart(2, "0");
    $("time").textContent = String(time).padStart(3, "0");
  }
  setInterval(() => { if (time > 0) { time--; drawHud(); } }, 400);

  // ── input ────────────────────────────────────────────────────
  document.addEventListener("keydown", (ev) => {
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const k = ev.key;
    if (k === "ArrowLeft" || k === "a" || k === "A") { keys.left = true; auto = null; ev.preventDefault(); }
    else if (k === "ArrowRight" || k === "d" || k === "D") { keys.right = true; auto = null; ev.preventDefault(); }
    else if (k === " " || k === "ArrowUp" || k === "w" || k === "W") { jump(); ev.preventDefault(); }
    else if (/^[1-9]$/.test(k) && blocks[Number(k) - 1]) goTo(Number(k) - 1);
  });
  document.addEventListener("keyup", (ev) => {
    const k = ev.key;
    if (k === "ArrowLeft" || k === "a" || k === "A") keys.left = false;
    if (k === "ArrowRight" || k === "d" || k === "D") keys.right = false;
  });
  world.addEventListener("pointerdown", (ev) => {
    if (!ev.target.closest(".block")) jump();
  });

  // Coming back with the browser's Back button restores the page from cache.
  window.addEventListener("pageshow", (ev) => {
    if (!ev.persisted) return;
    busy = false;
    world.classList.remove("leaving");
    blocks.forEach((b) => (b.el.style.backgroundImage = BLOCK));
    document.querySelectorAll(".coin-pop, .points").forEach((el) => el.remove());
  });

  window.addEventListener("resize", layout);
  p.x = 0;
  layout();
  p.x = Math.round(W * 0.08);
  drawHud();
  requestAnimationFrame(loop);
})();
