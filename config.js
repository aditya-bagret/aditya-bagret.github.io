// ─────────────────────────────────────────────────────────────
//  EDIT THIS FILE to change what shows up on your board.
//  Everything else (index.html / style.css / app.js) can stay as is.
// ─────────────────────────────────────────────────────────────

window.BOARD = {
  owner: "Aditya Sharma",
  terminal: "A",                      // shown as "TERMINAL A" in the header
  github: "aditya-bagret",            // your GitHub username (used in footer)
  ticker: "Currently building things on the web · Open to collaborations · Press 1–9 to jump straight to a gate · Type to search the board",

  // Filter tabs shown above the board. `id` must match an entry's `kind`.
  kinds: [
    { id: "project", label: "Projects" },
    { id: "profile", label: "Profiles" },
    { id: "doc",     label: "Docs" },
  ],

  // status: "ON TIME" (live) · "BOARDING" (in progress) · "DELAYED" (paused) · "LANDED" (archived)
  // Each row's gate number (1, 2, 3 …) is its keyboard shortcut.
  entries: [
    {
      name: "Portfolio",
      kind: "profile",
      tag: "WEB",
      year: "2026",
      status: "ON TIME",
      url: "https://aditya-bagret.github.io/portfolio",
      note: "Who I am, what I've built, how to reach me.",
    },
    {
      name: "GitHub",
      kind: "profile",
      tag: "CODE",
      year: "—",
      status: "ON TIME",
      url: "https://github.com/aditya-bagret",
      note: "Every repo, including the half-finished ones.",
    },
    {
      name: "LinkedIn",
      kind: "profile",
      tag: "SOCIAL",
      year: "—",
      status: "ON TIME",
      url: "https://www.linkedin.com/in/your-handle",
      note: "Work history and the professional version of me.",
    },
    {
      name: "Harassment Saver",
      kind: "project",
      tag: "APP",
      year: "2025",
      status: "LANDED",
      url: "#",
      note: "Safety app that alerts trusted contacts in one tap.",
    },
    {
      name: "Company Intel DB",
      kind: "project",
      tag: "DATA",
      year: "2026",
      status: "BOARDING",
      url: "#",
      note: "Searchable database of company intelligence.",
    },
    {
      name: "Research Project",
      kind: "doc",
      tag: "PAPER",
      year: "2025",
      status: "LANDED",
      url: "#",
      note: "B.Tech minor research project write-up.",
    },
    {
      name: "Resume",
      kind: "doc",
      tag: "PDF",
      year: "2026",
      status: "ON TIME",
      url: "#",
      note: "One page. Updated regularly.",
    },
  ],
};
