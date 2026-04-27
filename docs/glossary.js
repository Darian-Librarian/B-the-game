const dictionary = {
  "Total Level": "The aggregate sum of all player levels on your roster.",
  "Integrity Axis": "The shifting spectrum between Primal and Robotic origins, measuring a manifest's stability.",
  "Manifestation": "The process of a soul or code-construct entering the physical landscape of B.",
  "Standard Heritage": "An adaptive, human-coded baseline with no affinity penalties.",
  "Primal Origin": "Entities derived from ancient, dimensional, or arcane energy sources.",
  "Synthetic Origin": "Entities utilizing a mixture of biological parts and hardware integration.",
  "Robotic Origin": "Total technological replacement; entities that have abandoned biological architecture.",
  "Biological Instability": "A measurement of mutation intensity caused by environmental corruption.",
  "The Lifecycle": "The fundamental progression system governing manifest existence and rebirth.",
  "Acquisition": "The different ways for obtaining new power signatures and tactical assets.",
  "Effeciency Scaling": "The mathematical relationship between Total Level and manifest power output."
};

// --- Power Icon Engine ---
window.renderBicons = function(container = document) {
  const borders = [
    'location', 'summon', 'cone', 'pbaoe', 'pbaoe-allies', 
    'targeted-aoe', 'targeted-aoe-allies', 'affects-target-only'
  ];
  
  const registry = {
    'affects-target-only': 'border/affects-target-only.png',
    'cone': 'border/cone.png',
    'location': 'border/location.png',
    'pbaoe-allies': 'border/pbaoe-allies.png',
    'pbaoe': 'border/pbaoe.png',
    'summon': 'border/summon.png',
    'targeted-aoe-allies': 'border/targeted-aoe-allies.png',
    'targeted-aoe': 'border/targeted-aoe.png',
    'accuracy-tohit': 'buffs/accuracy-tohit.png',
    'damage-1': 'buffs/damage-1.png',
    'intangible': 'buffs/intangible.png',
    'large-defense-bonus': 'buffs/large-defense-bonus.png',
    'large-offense-and-defense-bonus': 'buffs/large-offense-and-defense-bonus.png',
    'major-stealth-invisibility': 'buffs/major-stealth-invisibility.png',
    'mez-protection-other': 'buffs/mez-protection-other.png',
    'mez-protection-self': 'buffs/mez-protection-self.png',
    'minor-stealth': 'buffs/minor-stealth.png',
    'range': 'buffs/range.png',
    'reduce-recharge': 'buffs/reduce-recharge.png',
    'resurrect': 'buffs/resurrect.png',
    'secondary-effects': 'buffs/secondary-effects.png',
    'shapeshift': 'buffs/shapeshift.png',
    'endurance': 'buffs/health-endurance/endurance.png',
    'heal': 'buffs/health-endurance/heal.png',
    'maximum-hp': 'buffs/health-endurance/maximum-hp.png',
    'recovery': 'buffs/health-endurance/recovery.png',
    'regeneration': 'buffs/health-endurance/regeneration.png',
    'defense-all': 'buffs/resistance-defense/defense-all.png',
    'defense-and-tohit': 'buffs/resistance-defense/defense-and-tohit.png',
    'defense-aoe': 'buffs/resistance-defense/defense-aoe.png',
    'defense-melee': 'buffs/resistance-defense/defense-melee.png',
    'defense-ranged': 'buffs/resistance-defense/defense-ranged.png',
    'resistance-defense-energy-and-negative': 'buffs/resistance-defense/resistance-defense-energy-and-negative.png',
    'resistance-defense-energy': 'buffs/resistance-defense/resistance-defense-energy.png',
    'resistance-defense-fire-and-cold-1': 'buffs/resistance-defense/resistance-defense-fire-and-cold-1.png',
    'resistance-defense-fire-and-cold': 'buffs/resistance-defense/resistance-defense-fire-and-cold.png',
    'resistance-defense-negative': 'buffs/resistance-defense/resistance-defense-negative.png',
    'resistance-defense-psionic': 'buffs/resistance-defense/resistance-defense-psionic.png',
    'resistance-defense-smashing-and-lethal': 'buffs/resistance-defense/resistance-defense-smashing-and-lethal.png',
    'resistance-smashing-and-lethal': 'buffs/resistance-defense/resistance-smashing-and-lethal.png',
    'resistance': 'buffs/resistance-defense/resistance.png',
    'flight-flight-speed': 'buffs/travel/flight-flight-speed.png',
    'jump-height-super-jump': 'buffs/travel/jump-height-super-jump.png',
    'jump-height': 'buffs/travel/jump-height.png',
    'run-speed-and-jump-height': 'buffs/travel/run-speed-and-jump-height.png',
    'run-speed': 'buffs/travel/run-speed.png',
    'teleport-ally': 'buffs/travel/teleport-ally.png',
    'teleport-caster': 'buffs/travel/teleport-caster.png',
    'teleport-enemy': 'buffs/travel/teleport-enemy.png',
    'damage-generic-dot': 'damage/damage-generic-dot.png',
    'damage-generic': 'damage/damage-generic.png',
    'assassins-strike': 'damage/melee-damage/assassins-strike.png',
    'energy-transfer': 'damage/melee-damage/energy-transfer.png',
    'heavy-high-melee': 'damage/melee-damage/heavy-high-melee.png',
    'high-melee-weapon': 'damage/melee-damage/high-melee-weapon.png',
    'light-minor-melee': 'damage/melee-damage/light-minor-melee.png',
    'moderate-melee-weapon': 'damage/melee-damage/moderate-melee-weapon.png',
    'moderate-melee': 'damage/melee-damage/moderate-melee.png',
    'mult-hit-melee': 'damage/melee-damage/mult-hit-melee.png',
    'extreme-ranged': 'damage/ranged-damage/extreme-ranged.png',
    'fast-light-minor-ranged': 'damage/ranged-damage/fast-light-minor-ranged.png',
    'heavy-high-ranged': 'damage/ranged-damage/heavy-high-ranged.png',
    'light-minor-ranged': 'damage/ranged-damage/light-minor-ranged.png',
    'moderate-ranged': 'damage/ranged-damage/moderate-ranged.png',
    'short-ranged': 'damage/ranged-damage/short-ranged.png',
    'snipe': 'damage/ranged-damage/snipe.png',
    'chain': 'damage/special-damage/chain.png',
    'undead-bomb': 'damage/special-damage/undead-bomb.png',
    'accuracy-tohit-1': 'debuffs/accuracy-tohit-1.png',
    'damage-2': 'debuffs/damage-2.png',
    'endurance-1': 'debuffs/endurance-1.png',
    'heal-decay': 'debuffs/heal-decay.png',
    'health-regen': 'debuffs/health-regen.png',
    'offense-and-defense': 'debuffs/offense-and-defense.png',
    'perception': 'debuffs/perception.png',
    'recovery-1': 'debuffs/recovery-1.png',
    'resistance-defense-1': 'debuffs/resistance-defense-1.png',
    'confuse': 'mez-effects/confuse.png',
    'fear': 'mez-effects/fear.png',
    'hold': 'mez-effects/hold.png',
    'immobilize': 'mez-effects/immobilize.png',
    'increase-recharge': 'mez-effects/increase-recharge.png',
    'knockback': 'mez-effects/knockback.png',
    'knockdown': 'mez-effects/knockdown.png',
    'knockup': 'mez-effects/knockup.png',
    'placate': 'mez-effects/placate.png',
    'repel': 'mez-effects/repel.png',
    'sleep': 'mez-effects/sleep.png',
    'slow-and-increase-recharge': 'mez-effects/slow-and-increase-recharge.png',
    'slow': 'mez-effects/slow.png',
    'stun': 'mez-effects/stun.png',
    'taunt': 'mez-effects/taunt.png',
    'color-layer': 'overlay/color-layer.png',
    'example-gradient-bronze-metallic': 'overlay/example-gradient-bronze-metallic.png',
    'ironman': 'overlay/ironman.png',
    'neural': 'overlay/neural.png',
    'standard': 'overlay/standard.png',
    'summon-2': 'pets/summon-2.png',
    'summon-3': 'pets/summon-3.png',
    'summon-fear': 'pets/summon-fear.png',
    'summon-major': 'pets/summon-major.png',
    'summon-minor': 'pets/summon-minor.png',
    'summon-shitload': 'pets/summon-shitload.png',
    'summon-tank': 'pets/summon-tank.png',
    'summon-undead': 'pets/summon-undead.png',
    'upgrade-pet-major': 'pets/upgrade-pet-major.png',
    'upgrade-pet-minor': 'pets/upgrade-pet-minor.png'
  };

  container.querySelectorAll('.b-icon').forEach(icon => {
    const classes = Array.from(icon.classList);

    const origin = classes.find(c =>
      ['primal', 'mutation', 'synthetic', 'robotic', 'human'].includes(c)
    ) || 'human';

    const borderType = classes.find(c => borders.includes(c));
    const effectType = classes.find(c =>
      !borders.includes(c) && c !== 'b-icon' && c !== origin
    );

    const basePath = 'assets/icons/powers/templates/';
    const borderUrl = borderType ? `${basePath}border/${borderType}.png` : null;
    const effectUrl = registry[effectType]
      ? `${basePath}${registry[effectType]}`
      : `${basePath}${effectType}.png`;

    const wrapper = document.createElement('span');
    wrapper.className = 'icon-stack';

    wrapper.innerHTML = `
  <span class="base"></span>

  ${borderUrl ? `<img class="border" src="${borderUrl}" />` : ''}

  <span class="inner ${origin}"
    style="background-image: url('${effectUrl}');
           -webkit-mask-image: url('${effectUrl}');
           mask-image: url('${effectUrl}');">
  </span>
`;

    icon.replaceWith(wrapper);
  });
};


// --- tooltips ---
window.initWikiTooltips = function() {
  const content = document.querySelector('.content');
  if (!content) return;

  const targets = content.querySelectorAll('p, li, td, .stub-text');

  Object.keys(dictionary).forEach(term => {
    const regex = new RegExp(`(?<!<a[^>]*>)\\b(${term})\\b(?![^<]*</a>)`, 'gi');

    targets.forEach(el => {
      if (!el.closest('h1, h2, h3, h4, h5, h6, a')) {
        el.innerHTML = el.innerHTML.replace(
          regex, 
          `<span class="term-definition" data-tippy-content="${dictionary[term]}">$1</span>`
        );
      }
    });
  });

  tippy('.term-definition', { theme: 'b-space' });

  tippy('a[href]:not(.anchor)', {
    theme: 'b-preview',
    allowHTML: true,
    delay: [500, 0],
    onShow(instance) {
      let href = instance.reference.getAttribute('href');
      if (href.startsWith('#/')) {
        href = href.replace('#/', '') + '.md';
      } else return false;

      fetch(href)
        .then(res => res.ok ? res.text() : Promise.reject())
        .then(text => {
          const headerMatch = text.match(/^# (.*)\n?/);
          const pageHeader = headerMatch ? headerMatch[1].trim() : 'Preview';

          const body = text
            .replace(/^# .*\n?/, '')
            .replace(/^#+ .*\n?/gm, '')
            .replace(/\[(.*?)\]\(.*?\)/g, '$1')
            .replace(/[#*`>]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

          const clean = body.substring(0, 250) + '...';

          instance.setContent(
            `<div style="padding:2px"><strong>${pageHeader}</strong><hr>${clean}</div>`
          );

          renderBicons(instance.popper);
        })
        .catch(() => instance.destroy());
    }
  });
};


// --- Docsify hook ---
window.$docsify = window.$docsify || {};
window.$docsify.plugins = [
  function(hook) {
    hook.doneEach(function() {
      initWikiTooltips();

      requestAnimationFrame(() => {
        renderBicons();
      });
    });
  }
].concat(window.$docsify.plugins || []);
