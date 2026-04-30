# Contributing to B

**B** is a collaborative project powered by custom **DenizenScript** accessories and community-driven docs. We welcome contributions that fit our technical standards and gritty digital aesthetic.

---

## Areas of Contribution

* **Documentation**: Expand stubs and refine gameplay guides for new operators.
* **Technical Scripts**: Develop **JavaScript** core systems, **DenizenScript** accessories, or **AHK 2.0** efficiency macros.
* **Asset & Art Creation**: Provide 3D models or gritty 90s-style illustrations for project skits.
  - **Icon Generation**: Use the template at `assets/icons/powers/power-template.xcf` with **GIMP**.
  - **Color Logic**: Tint icons based on the powerset position on the **Integrity Axis**.

---

## The AI & Automation Boundary

We value efficiency, but we have no room for "AI slop." This project is about human intent and technical precision. If you use tools to speed up your workflow, stay transparent about where the logic ends and the automation begins.

### What to Avoid
We are building a specific vision; don't let a model hallucinate it for you.
* **Content Dumping**: Prompts like "scan the wiki and add more lore" result in generic filler that dilutes our real ideas for a fun place to be.
* **Blind Refactoring**: Using AI to hunt for manual code refactors. If the code needs a change, it needs a human who understands the context of what we're doing.
* **Generative Concepts**: Do not use AI to invent new ideas, facts, or lore archetypes. Those must come from the team.

### High-Efficiency Automation
We encourage "Force Multipliers" - tools that handle the mind-numbing repetitive work so you can focus on the core build.
* **Structure & QA**: Using an LLM to apply tags over terms or to review a page for consistency against our style guide. This is a maintenance check, not a creative shortcut. **Never blindly accept every suggestion.**
* **Procedural Scripting**: Writing a **Python** or **Bash** script to procedurally generate file structures or batch-rename assets. This is manual automation, not generative AI.
* **Logical Flow**: Complex **DenizenScript** utilizing `if`/`else`, `choose`/`case`, or `determine` is just good scripting.
* **Batch Processing**: Speeding up image exports by using **GIMP** filters and **AHK** macros to handle hue/saturation shifts for the powerset icons. This is the equivalent of a mechanical assembly line.
* **Validation Tools**: Writing a custom tool to scan the repository for broken links, missing **NLAEOF** lines, or indentation errors. This ensures the page stays clean without a bot guessing at the content.

---

## Getting Started

To contribute, review our technical requirements and project trajectory:

* **[Contributing on GitHub](contributing/contributing-on-github)**
  - Workflow for forking, cloning, and submitting pull requests to the **b-Universe** org.
* **[Technical Standards](contributing/technical-standards)**
  - Monospaced fonts, 2-space indentation, and clean code.
* **[Artistic Standards](contributing/artistic-standards)**
  - Guidelines for the bright rainbow and dark space theme.
* **[2026 Roadmap](contributing/2026-roadmap)**
  - High-priority goals for archive expansion and network upgrades.

---

<div class="nav-tray" style="flex-wrap: wrap;">
  <strong>B</strong><span>|</span>
  <a href="#/wiki/play-info">Play</a><span>|</span>
  <a href="#/wiki/discord-community">Discord</a>
</div>

<div class="nav-tray" style="margin-top: 10px; flex-wrap: wrap;">
  <strong>Categories:</strong>
  <a href="#/contributing/contributing"><strong>Contributing</strong></a><span>|</span>
  <a href="#/contributing/contributing-on-github">GitHub Guide</a><span>|</span>
  <a href="#/contributing/technical-standards">Technical Standards</a><span>|</span>
  <a href="#/contributing/artistic-standards">Artistic Standards</a><span>|</span>
  <a href="#/contributing/2026-roadmap">2026 Roadmap</a><span>|</span>
  <a href="#/contributing/stubs">Stubs</a>
</div>
