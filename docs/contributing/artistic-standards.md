# Artistic Standards

The visual identity of **B** is built on a specific intersection of gritty 90s comic book art and high-intensity digital neon aesthetics. Every asset from 32x32 icons to full-page illustrations should embody these pillars, ensuring a cohesive atmosphere throughout the archive.

---

## Visual Pillars

- **90s Indie Comic Aesthetic**: We draw heavy inspiration from artists like **Greg Capullo** and **Todd McFarlane**. Assets should feature bold shadows, gritty textures, and assertive line work.
- **Dark Space & Neon Rainbows**: The primary UI is dark-themed, but accents must uses vibrant, high-intensity neon rainbow palettes. This creates a smooth, responsive transition between the void-like background and the vibrant active elements.
- **Pixel Art & Low-Bit Precision**: Digital art assets, especially icons, should value a low-bit or 16/32-bit style. Render these with pixel-perfect scaling to keep them sharp on high-resolution displays.

---

## Icon Color Theory

Powerset icons are color-coded based on their position on the **Integrity Axis**. This allows players to identify the nature of a power at a glance.

| Category | Primary Color | Examples | Association |
| :--- | :--- | :--- | :--- |
| **Primal / Arcane** | Indigo / Violet | <span class="icon-row"><i class="b-icon primal affects-target-only extreme-ranged"></i><i class="b-icon primal location teleport-caster"></i><i class="b-icon primal location summon-undead"></i></span> | Ethereal stability and ancient heritage. |
| **Human / Baseline** | White | <span class="icon-row"><i class="b-icon human affects-target-only light-minor-ranged"></i><i class="b-icon human run-speed-and-jump-height"></i><i class="b-icon human affects-target-only light-minor-melee"></i></span> | Standard adaptability and soul architecture. |
| **Mutation** | Acid Green | <span class="icon-row"><i class="b-icon mutation cone moderate-ranged"></i><i class="b-icon mutation heal"></i><i class="b-icon mutation recovery"></i></span> | Biological instability and viral pathogens. |
| **Synthetic** | Neon Cyan | <span class="icon-row"><i class="b-icon synthetic summon summon-minor"></i><i class="b-icon synthetic pbaoe slow"></i><i class="b-icon synthetic pbaoe-allies resistance-defense-1"></i></span> | Hardware integration and network efficiency. |
| **Robotic** | Gold | <span class="icon-row"><i class="b-icon robotic targeted-aoe snipe"></i><i class="b-icon robotic large-defense-bonus"></i><i class="b-icon robotic summon summon-shitload"></i></span> | Absolute technological replacement. |

---

### Integrity Scaling

For powersets that fall between these primary nodes, use the `color-mix()` logic within your CSS or GIMP layers to blend the tints. 

* **The Mutation Leak**: As a powerset drifts from **Human** to **Mutated**, the Gold/White base should gradually transition into Acid Green.
* **The Synthetic Leak**: As a powerset drifts from **Human** to **Synthetic**, the Gold/White base should gradually transition into Neon Cyan.
* **Visual Density**: Maintain the sharp 16/32-bit pixelated scaling for all icons to ensure they keep that pixel grid qwispy against the dark space background.

---

## 3D Modeling & Blockbench Standards

For models like Furniture and environmental assets, follow these strict configuration rules in Blockbench:

- **Format & UV**: Select the `generic` model type and use `Box UV` mapping. 
- **Base Resolution**: Use `32x32` for your grid resolution.
- **Dynamic Texturing & Zero-UV Workflow**: All furniture models automatically tile textures from the builder's hotbar based on their physical 3D dimensions. 
  - *The Rule*: You **do not** need to map UVs in Blockbench. 
  - *The Math*: The engine's shader calculates seamless UVs procedurally in 3D space. For every 16 units of length in Blockbench (which equals 32 units or 1 Block in the engine), the texture will seamlessly loop 1 full time. This allows you to build a 44-unit long bench, and the wood grain will flawlessly tile across the entire object without stretching!

---

## Tools & Templates

To maintain consistency in power icon creation, use the master template:

- **GIMP Template**: `assets/icons/powers/power-template.xcf`.
- **Grid Settings**: Use a 32x32 canvas with 1px grid snapping for all power and archetype icons.
- **Export Settings**: Export as .png with no compression or interlacing to ensure the pixel grid remains qwispy.

<div align="left">
  <a href="#/contributing/contributing"><b>←  Back to Contributing</b></a>
</div>

---

<div class="nav-tray" style="flex-wrap: wrap;">
  <strong>B</strong><span>|</span>
  <a href="#/wiki/play-info">Play</a><span>|</span>
  <a href="#/wiki/discord-community">Discord</a>
</div>

<div class="nav-tray" style="margin-top: 10px; flex-wrap: wrap;">
  <strong>Categories:</strong>
  <a href="#/contributing/contributing">Contributing</a><span>|</span>
  <a href="#/contributing/contributing-on-github">GitHub Guide</a><span>|</span>
  <a href="#/contributing/technical-standards">Technical Standards</a><span>|</span>
  <a href="#/contributing/artistic-standards"><strong>Artistic Standards</strong></a><span>|</span>
  <a href="#/contributing/2026-roadmap">2026 Roadmap</a><span>|</span>
  <a href="#/contributing/stubs">Stubs</a>
</div>
