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

  // Gates are numbered by position in config.js and never change, so the
  // keyboard shortcut for an entry stays the same while filtering.
  const entries = cfg.entries.map((e, i) => ({ ...e, gate: i + 1 }));
  let activeKind = "all";
  let query = "";

  // ── header / footer ──
  $("terminal").textContent = "Terminal " + cfg.terminal;
  $("ticker").textContent = cfg.ticker + "   ·   " + cfg.ticker;
  $("owner").innerHTML = "";
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

  // ── tabs ──
  const tabs = [{ id: "all", label: "All" }, ...cfg.kinds];
  tabs.forEach((t) => {
    const b = document.createElement("button");
    b.className = "tab";
    b.type = "button";
    b.setAttribute("role", "tab");
    b.dataset.kind = t.id;
    const count = t.id === "all" ? entries.length : entries.filter((e) => e.kind === t.id).length;
    b.innerHTML = `${t.label}<span class="n">${count}</span>`;
    b.addEventListener("click", () => { activeKind = t.id; render(); });
    $("tabs").append(b);
  });

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
      let flips = 4 + i * 2 + Math.floor(Math.random() * 4);
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

  // ── board ──
  function matches(e) {
    if (activeKind !== "all" && e.kind !== activeKind) return false;
    if (!query) return true;
    const hay = (e.name + " " + e.tag + " " + e.note + " " + e.status).toLowerCase();
    return hay.includes(query);
  }

  function row(e) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.className = "row";
    const live = e.url && e.url !== "#";
    if (live) {
      a.href = e.url;
      a.target = "_blank";
      a.rel = "noopener";
    } else {
      a.setAttribute("aria-disabled", "true");
      a.tabIndex = 0;
    }
    a.setAttribute("aria-label", `${e.name}, ${e.tag}, ${e.status}${live ? "" : ", link coming soon"}`);

    const gate = document.createElement("span");
    gate.className = "gate";
    gate.innerHTML = `<small>G</small>${String(e.gate).padStart(2, "0")}`;

    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = e.tag;

    const year = document.createElement("span");
    year.className = "year";
    year.textContent = e.year;

    const status = document.createElement("span");
    status.className = "status " + (STATUS[e.status] || "s-landed");
    status.innerHTML = '<i class="dot"></i>';
    status.append(e.status);

    const note = document.createElement("span");
    note.className = "note";
    note.textContent = "→ " + e.note;

    a.append(gate, flap(e.name), tag, year, status, note);
    li.append(a);
    return li;
  }

  function render() {
    document.querySelectorAll(".tab").forEach((b) =>
      b.setAttribute("aria-selected", String(b.dataset.kind === activeKind)));
    const list = entries.filter(matches);
    $("rows").replaceChildren(...list.map(row));
    $("empty").hidden = list.length > 0;
  }

  // ── search + shortcuts ──
  $("q").addEventListener("input", (ev) => {
    query = ev.target.value.trim().toLowerCase();
    render();
  });

  document.addEventListener("keydown", (ev) => {
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const typing = document.activeElement === $("q");
    if (ev.key === "Escape") {
      $("q").value = ""; query = ""; $("q").blur(); render();
      return;
    }
    if (typing) return;
    if (/^[1-9]$/.test(ev.key)) {
      const e = entries.find((x) => x.gate === Number(ev.key));
      if (e && e.url && e.url !== "#") window.open(e.url, "_blank", "noopener");
      return;
    }
    if (ev.key === "/" || /^[a-z]$/i.test(ev.key)) {
      $("q").focus();
      if (ev.key === "/") ev.preventDefault();
    }
  });

  render();
})();
