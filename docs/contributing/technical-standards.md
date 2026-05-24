# Technical Standards

To keep the **B** ecosystem fast, efficient, and readable, we strictly enforce these technical standards across our codebase.

---

## JavaScript Coding Practices

JavaScript is our heaviest language, powering the core game engine, networking, and UI systems. All contributions to the client must adhere to the following practices:

* **ES6 Modules & Classes**: Use modern `import`/`export` syntax and encapsulate logic inside `class` structures (e.g., `GameEngine`, `UIManager`).
* **Indentation**: We use a strict **2-space** indentation rule. Do not use tabs.
* **Variable Declarations**: Use `const` by default. Use `let` only when mutability is required. Never use `var`.
* **Performance & Caching**: **B** is a high-performance simulation. Avoid heavy calculations and DOM lookups inside animation or render loops (`update()`, `draw()`). Cache elements in your constructors (e.g., `this.els = { ... }`).
* **Avoid "AI Slop" Refactoring**: Do not blindly pass files through an AI to "clean them up" or "refactor" them. Automated restructuring often strips the human intent and logic from our code.

## File Structure & Formatting

* **NLAEOF (New Line At End Of File)**: Always leave an empty line at the bottom of your scripts. On the Live Server, this provides "parking space" for our cursors so we don't collide when hot-loading scripts.

---

<div align="left">
  <a href="#/contributing/contributing"><b>←  Back to Contributing</b></a>
</div>

<div class="nav-tray" style="flex-wrap: wrap; margin-top: 40px;">
  <strong>B</strong><span>|</span>
  <a href="#/wiki/play-info">Play</a><span>|</span>
  <a href="#/wiki/discord-community">Discord</a>
</div>

<div class="nav-tray" style="margin-top: 10px; flex-wrap: wrap;">
  <strong>Categories:</strong>
  <a href="#/contributing/contributing">Contributing</a><span>|</span>
  <a href="#/contributing/contributing-on-github">GitHub Guide</a><span>|</span>
  <a href="#/contributing/technical-standards"><strong>Technical Standards</strong></a><span>|</span>
  <a href="#/contributing/artistic-standards">Artistic Standards</a><span>|</span>
  <a href="#/contributing/2026-roadmap">2026 Roadmap</a><span>|</span>
  <a href="#/contributing/stubs">Stubs</a>
</div>