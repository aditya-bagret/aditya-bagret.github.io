(function () {
  const cfg = window.BOARD;
  const $ = (id) => document.getElementById(id);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  const STATUS = {
    "ON TIME":  "s-on",
    "BOARDING": "s-board",
    "DELAYED":  "s-delay",
    "LANDED":   "s-landed",
  };

  const entries = cfg.entries.map((e, i) => ({ ...e, gate: i + 1 }));

  // ── header / footer ──
  $("terminal").textContent = "Terminal " + cfg.terminal;
  $("ticker").textContent = cfg.ticker + "   ·   " + cfg.ticker;
  const owner = document.createElement("span");
  owner.textContent = "© " + new Date().getFullYear() + " " + cfg.owner + " · ";
  const gh = document.createElement("a");
  gh.href = "https://github.com/" + cfg.github;
  gh.textContent = "@" + cfg.github;
  $("owner").append(owner, gh);

  // ── clock ──
  function tick() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    $("clock-time").innerHTML = hh + '<span class="colon">:</span>' + mm;
    $("clock-date").textContent = d.toLocaleDateString(undefined, {
      weekday: "short", day: "2-digit", month: "short", year: "numeric",
    });
  }
  tick();
  setInterval(tick, 1000 * 15);

  // ── split-flap ──
  function flap(text) {
    const wrap = document.createElement("span");
    wrap.className = "flap";
    wrap.setAttribute("aria-hidden", "true");
    const cells = [];
    // One nowrap group per word so names only break between words.
    text.toUpperCase().split(/\s+/).forEach((word) => {
      const w = document.createElement("span");
      w.className = "w";
      [...word].forEach((ch) => {
        const c = document.createElement("span");
        c.className = "c";
        c.dataset.final = ch;
        c.textContent = reduceMotion ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        w.append(c);
        cells.push(c);
      });
      wrap.append(w);
    });
    if (!reduceMotion) spin(cells);
    return wrap;
  }

  function spin(cells) {
    cells.forEach((c, i) => {
      let flips = 6 + i * 3 + Math.floor(Math.random() * 4);
      c.classList.add("spin");
      const t = setInterval(() => {
        if (--flips <= 0) {
          clearInterval(t);
          c.textContent = c.dataset.final;
          c.classList.remove("spin");
          return;
        }
        c.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }, 45);
    });
  }

  // ── gates ──
  function gate(e) {
    const a = document.createElement("a");
    a.className = "gate-card";
    a.href = e.url;
    a.target = "_blank";
    a.rel = "noopener";
    a.setAttribute("aria-label", `Gate ${e.gate}: ${e.name}`);

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML = `<span class="num"><small>Gate</small>${String(e.gate).padStart(2, "0")}</span>`;
    const status = document.createElement("span");
    status.className = "status " + (STATUS[e.status] || "s-landed");
    status.innerHTML = '<i class="dot"></i>';
    status.append(e.status);
    meta.append(status);

    const note = document.createElement("p");
    note.className = "note";
    note.textContent = e.note;

    const go = document.createElement("span");
    go.className = "go";
    go.innerHTML = 'Board <span aria-hidden="true">→</span>';

    const foot = document.createElement("div");
    foot.className = "card-foot";
    foot.append(note, go);

    a.append(meta, flap(e.name), foot);
    return a;
  }

  $("gates").replaceChildren(...entries.map(gate));

  // ── shortcuts ──
  document.addEventListener("keydown", (ev) => {
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const e = entries.find((x) => String(x.gate) === ev.key);
    if (e) window.open(e.url, "_blank", "noopener");
  });
})();
