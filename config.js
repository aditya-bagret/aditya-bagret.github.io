// ─────────────────────────────────────────────────────────────
//  EDIT THIS FILE to change what shows up on your board.
//  Everything else (index.html / style.css / app.js) can stay as is.
// ─────────────────────────────────────────────────────────────

window.BOARD = {
  owner: "Aditya Sharma",
  terminal: "A",                      // shown as "TERMINAL A" in the header
  github: "aditya-bagret",            // your GitHub username (used in footer)
  ticker: "Welcome aboard · Press 1 for the portfolio, 2 for projects · All gates open",

  // Each gate number (1, 2 …) is its keyboard shortcut.
  entries: [
    {
      name: "Portfolio",
      status: "ON TIME",
      url: "https://aditya-os-gamma.vercel.app",
      note: "Who I am, what I've built, how to reach me.",
    },
    {
      name: "Projects",
      status: "BOARDING",
      url: "https://github.com/aditya-bagret?tab=repositories",
      note: "Every repo on GitHub, from drones to dashboards.",
    },
  ],
};
