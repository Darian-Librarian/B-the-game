import { DevToolsUIManager } from './dev-tools-ui.js?v=new-engine-01';
import { InventoryUIManager } from './inventory-ui.js?v=new-engine-01';
import { PowerbarUIManager } from './powerbar-ui.js?v=new-engine-01';
import { TrainerUIManager } from './trainer-ui.js?v=new-engine-01';
import { PlayerListUIManager } from './player-list-ui.js?v=new-engine-01';

export class UIManager {
  constructor(engine) {
    this.engine = engine;

    this.devTools = new DevToolsUIManager(engine, this);
    this.inventory = new InventoryUIManager(engine, this);
    this.powerbar = new PowerbarUIManager(engine, this);
    this.trainer = new TrainerUIManager(engine, this);
    this.playerList = new PlayerListUIManager(engine, this);

    this.setupContextMenu();
  }

  makeDraggable(panelId, headerSelector) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    const header = panel.querySelector(headerSelector);
    if (!header) return;

    header.style.cursor = 'move';
    header.style.userSelect = 'none';

    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    header.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return; 
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;

      const rect = panel.getBoundingClientRect();
      
      if (panel.style.transform) {
        panel.style.transform = 'none';
        panel.style.left = rect.left + 'px';
        panel.style.top = rect.top + 'px';
      }
      
      initialLeft = panel.offsetLeft;
      initialTop = panel.offsetTop;

      const onMouseMove = (moveEvent) => {
        if (!isDragging) return;
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        panel.style.left = `${initialLeft + dx}px`;
        panel.style.top = `${initialTop + dy}px`;
        panel.style.right = 'auto'; 
        panel.style.bottom = 'auto';
      };

      const onMouseUp = () => {
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  setupContextMenu() {
    const btnTrade = document.getElementById('ctx-btn-trade');
    if (btnTrade) {
      btnTrade.onclick = () => {
        if (this.engine.contextTarget && this.engine.contextTarget.type === 'player') {
          this.engine.socket.emit('trade_request', this.engine.contextTarget.id);
          this.engine.chat.addMessage('system', 'System', `Trade request sent to ${this.engine.otherPlayers[this.engine.contextTarget.id]?.name || 'Player'}.`);
        }
        document.getElementById('player-context-menu').style.display = 'none';
      };
    }
    const btnTalk = document.getElementById('ctx-btn-talk');
    if (btnTalk) {
      btnTalk.onclick = () => {
        if (this.engine.contextTarget && this.engine.contextTarget.type === 'npc') {
          const npc = this.engine.npcs.find(n => n.uuid === this.engine.contextTarget.id);
          if (npc) {
            if (npc.type === 'trainer') {
              this.trainer.openTrainerUI(npc);
            } else {
              this.engine.chat.addMessage('system', 'System', 'This NPC has nothing to say.');
            }
          }
        }
        document.getElementById('player-context-menu').style.display = 'none';
      };
    }
  }

  update() {
    const eng = this.engine;
    const hpFill = document.getElementById('health-bar-fill');
    const hpText = document.getElementById('health-bar-text');
    const epFill = document.getElementById('energy-bar-fill');
    const epText = document.getElementById('energy-bar-text');

    if (hpFill) hpFill.style.width = `${(eng.player.hp / eng.player.maxHp) * 100}%`;
    if (hpText) hpText.innerText = `${Math.floor(eng.player.hp)} / ${eng.player.maxHp}`;
    
    if (epFill) epFill.style.width = `${(eng.player.energy / eng.player.maxEnergy) * 100}%`;
    if (epText) epText.innerText = `${Math.floor(eng.player.energy)} / ${eng.player.maxEnergy}`;

    const btnEditTarget = document.getElementById('btn-dev-edit-target');
    if (btnEditTarget) {
      if (eng.selectedTarget && eng.selectedTarget.type === 'npc') {
        btnEditTarget.disabled = false;
        btnEditTarget.style.opacity = '1';
        btnEditTarget.style.cursor = 'pointer';
      } else {
        btnEditTarget.disabled = true;
        btnEditTarget.style.opacity = '0.5';
        btnEditTarget.style.cursor = 'not-allowed';
      }
    }

    
    const npcEditModal = document.getElementById('npc-edit-modal');
    if (npcEditModal && npcEditModal.style.display !== 'none' && eng.selectedTarget && eng.selectedTarget.type === 'npc') {
      const uuidField = document.getElementById('edit-npc-uuid');
      if (uuidField && uuidField.value !== eng.selectedTarget.id) {
        const npc = eng.npcs.find(n => n.uuid === eng.selectedTarget.id);
        if (npc) {
          uuidField.value = npc.uuid;
          document.getElementById('edit-npc-name').value = npc.name;
          document.getElementById('edit-npc-hp').value = Math.floor(npc.hp);
          document.getElementById('edit-npc-maxhp').value = npc.maxHp;
          document.getElementById('edit-npc-energy').value = Math.floor(npc.energy || 1000);
          document.getElementById('edit-npc-x').value = Math.round(npc.x);
          document.getElementById('edit-npc-y').value = Math.round(npc.y);
          document.getElementById('edit-npc-z').value = Math.round(npc.z || 0);
          document.getElementById('edit-npc-type').value = npc.type || 'idle';
          document.getElementById('edit-npc-dir').value = npc.dir || 'down';
        }
      }
    }

    const targetWindow = document.getElementById('target-window');
    if (eng.selectedTarget && targetWindow) {
      let targetObj = null;
      let tName = '';
      if (eng.selectedTarget.type === 'npc') {
        targetObj = eng.npcs.find(n => n.uuid === eng.selectedTarget.id);
        if (targetObj) tName = targetObj.name;
      } else if (eng.selectedTarget.type === 'player') {
        targetObj = eng.otherPlayers[eng.selectedTarget.id];
        if (targetObj) tName = targetObj.name;
      } else if (eng.selectedTarget.type === 'self') {
        targetObj = eng.player;
        tName = eng.playerData.name;
      }

      if (targetObj && targetObj.state !== 'dead' && targetObj.state !== 'death') {
        targetWindow.style.display = 'flex';
        document.getElementById('target-name').innerText = tName;
        
        const hpPercent = Math.max(0, targetObj.hp / targetObj.maxHp);
        document.getElementById('target-health-fill').style.width = `${hpPercent * 100}%`;
        const hpTextEl = document.getElementById('target-health-text');
        if (hpTextEl) hpTextEl.innerText = `${Math.floor(targetObj.hp)} / ${targetObj.maxHp}`;

        const maxEp = targetObj.maxEnergy || 1000;
        const epPercent = Math.max(0, (targetObj.energy || maxEp) / maxEp);
        document.getElementById('target-energy-fill').style.width = `${epPercent * 100}%`;
        const epTextEl = document.getElementById('target-energy-text');
        if (epTextEl) epTextEl.innerText = `${Math.floor(targetObj.energy || maxEp)} / ${maxEp}`;

        const targetActions = document.getElementById('target-actions');
        if (targetObj.type === 'trainer' && targetActions) {
            targetActions.style.display = 'block';
            document.getElementById('btn-target-talk').onclick = () => this.trainer.openTrainerUI(targetObj);
        } else if (targetActions) {
            targetActions.style.display = 'none';
        }
      } else {
        targetWindow.style.display = 'none';
        eng.selectedTarget = null;
      }
    } else if (targetWindow) {
      targetWindow.style.display = 'none';
    }

    if (eng.activeTrainer) {
      const dist = Math.hypot(eng.player.x - eng.activeTrainer.x, eng.player.y - eng.activeTrainer.y);
      if (dist > 150) {
        eng.activeTrainer = null;
        const tModal = document.getElementById('trainer-dialog-modal');
        if (tModal) tModal.style.display = 'none';
      }
    }
  }
}
