export class PowerbarUIManager {
  constructor(engine, mainUIManager) {
    this.engine = engine;
    this.ui = mainUIManager;
    this.powerSlots = [];

    this.ui.makeDraggable('powers-panel', '.dev-panel-header');

    this.setupPowerbar();
    this.setupPowersUI();
  }

  setupPowerbar() {
    let container = document.getElementById('powerbar-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'powerbar-container';
        
        const gameScreen = document.getElementById('game-screen');
        if (gameScreen) {
            const scaler = gameScreen.querySelector('.screen-scaler');
            if (scaler) scaler.appendChild(container);
            else gameScreen.appendChild(container);
        } else {
            document.body.appendChild(container);
        }
    }
    container.style.cssText = 'position: absolute; bottom: 75px; left: 50%; transform: translateX(-50%); display: flex; gap: 6px; z-index: 999999; padding: 10px; background: rgba(5, 7, 10, 0.85); border: 2px solid #333; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.8); pointer-events: auto;';

    container.innerHTML = '';
    this.powerSlots = [];
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
    
    for (let i = 0; i < 10; i++) {
        const slot = document.createElement('div');
        slot.className = 'powerbar-slot';
        slot.style.cssText = 'width: 44px; height: 44px; background: rgba(0, 0, 0, 0.7); border: 2px solid #444; border-radius: 4px; position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; box-shadow: inset 0 0 10px rgba(0,0,0,0.8);';
        
        const keyLabel = document.createElement('span');
        keyLabel.innerText = keys[i];
        keyLabel.style.cssText = 'position: absolute; top: 2px; left: 4px; font-size: 0.75rem; font-weight: bold; color: #888; font-family: var(--font-mono, monospace); text-shadow: 1px 1px 0 #000;';
        
        const iconOrName = document.createElement('div');
        iconOrName.style.cssText = 'color: #fff; font-size: 0.7rem; font-family: var(--font-header, sans-serif); text-align: center; line-height: 1.1; pointer-events: none; padding: 0 2px; word-wrap: break-word; overflow: hidden; max-height: 30px; text-shadow: 1px 1px 0 #000;';
        
        slot.appendChild(keyLabel);
        slot.appendChild(iconOrName);
        container.appendChild(slot);
        
        slot.onmouseenter = () => {
            const powers = this.engine.playerData.powers || [];
            const powerName = powers[i];
            if (powerName) slot.style.background = 'rgba(52, 152, 219, 0.4)';
        };
        slot.onmouseleave = () => slot.style.background = 'rgba(0, 0, 0, 0.7)';
        
        slot.onclick = () => {
            const powers = this.engine.playerData.powers || [];
            const powerName = powers[i];
            if (powerName) {
                if (powerName === 'Brawl') this.engine.combat?.triggerAttack();
            }
        };

        this.powerSlots.push({ element: slot, iconEl: iconOrName });
    }
    this.updatePowerbar();
  }

  updatePowerbar() {
      if (!this.powerSlots) return;
      const powers = this.engine.playerData.powers || [];
      
      for (let i = 0; i < 10; i++) {
          const slotData = this.powerSlots[i];
          const powerName = powers[i];
          if (powerName) {
              const words = powerName.split(' ');
              let displayTxt = powerName;
              if (displayTxt.length > 8) {
                  displayTxt = words.map(w => w[0]).join('').toUpperCase();
                  if (words.length === 1) displayTxt = displayTxt.substring(0, 6) + '..';
              }
              slotData.iconEl.innerText = displayTxt;
              slotData.element.style.borderColor = 'var(--accent-neon, #3498db)';
              slotData.element.title = powerName;
          } else {
              slotData.iconEl.innerText = '';
              slotData.element.style.borderColor = '#444';
              slotData.element.title = 'Empty Slot';
          }
      }
  }

  setupPowersUI() {
    const btnPowers = document.getElementById('btn-powers');
    const powersPanel = document.getElementById('powers-panel');
    if (btnPowers && powersPanel) {
      btnPowers.onclick = (e) => {
        e.stopPropagation();
        powersPanel.style.display = powersPanel.style.display === 'none' ? 'flex' : 'none';
        if (powersPanel.style.display === 'flex') this.renderPowersUI();
      };
      const btnClose = document.getElementById('btn-close-powers');
      if (btnClose) btnClose.onclick = () => powersPanel.style.display = 'none';
    }
  }

  renderPowersUI() {
    const pd = this.engine.playerData;
    const level = pd.level || 1;
    
    const elLevel = document.getElementById('powers-level-text');
    const elLearned = document.getElementById('powersets-learned-text');
    const elPicks = document.getElementById('powers-picks-text');
    const elSets = document.getElementById('powersets-picks-text');
    const elSlots = document.getElementById('powers-slots-text');
    const listContainer = document.getElementById('powers-list-container');
    
    if (!listContainer) return;

    const totalPowerPicks = pd.unspentPowerPicks !== undefined ? pd.unspentPowerPicks : 0;
    const totalPowersetPicks = pd.unspentPowersetPicks !== undefined ? pd.unspentPowersetPicks : 0;
    const learnedSetsCount = pd.powersets ? pd.powersets.length : 0;
    const totalEnhancementSlots = Math.ceil(level / 2) * 2;
    
    if (elLevel) elLevel.innerText = level;
    if (elPicks) elPicks.innerText = totalPowerPicks;
    if (elSets) elSets.innerText = totalPowersetPicks;
    if (elSlots) elSlots.innerText = totalEnhancementSlots;
    if (elLearned) elLearned.innerText = learnedSetsCount;
    
    listContainer.innerHTML = '';
    const powers = pd.powers || [];
    
    if (powers.length === 0) {
      listContainer.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 20px; font-family: var(--font-mono); font-size: 0.9rem;">No powers selected.</div>`;
    } else {
      powers.forEach(pName => {
        const pDiv = document.createElement('div');
        pDiv.style.cssText = 'background: rgba(0,0,0,0.4); border: 1px solid var(--text-dim); padding: 10px; border-radius: 4px; display: flex; align-items: center; justify-content: space-between; font-family: var(--font-mono);';
        pDiv.innerHTML = `
          <span style="color: var(--accent-neon); font-weight: bold; font-size: 0.95rem;">${pName}</span>
          <div style="display: flex; gap: 5px;">
            <div style="width: 14px; height: 14px; background: rgba(52, 152, 219, 0.1); border: 1px solid #3498db; border-radius: 50%;" title="Enhancement Slot (Empty)"></div>
            <div style="width: 14px; height: 14px; background: rgba(52, 152, 219, 0.1); border: 1px solid #3498db; border-radius: 50%;" title="Enhancement Slot (Empty)"></div>
          </div>
        `;
        listContainer.appendChild(pDiv);
      });
    }
  }
}
