export class DevToolsUIManager {
  constructor(engine, mainUIManager) {
    this.engine = engine;
    this.ui = mainUIManager;

    this.ui.makeDraggable('dev-panel', '.dev-panel-header');
    this.ui.makeDraggable('builder-panel', '.dev-panel-header');
    this.ui.makeDraggable('npc-manager-panel', '.dev-panel-header');
    this.ui.makeDraggable('npc-edit-modal', '.dev-panel-header');

    this.setupDevTools();
    this.setupBuilderTools();
  }

  setupDevTools() {
    const eng = this.engine;
    const devPanel = document.getElementById('dev-panel');
    if (devPanel) {
      document.getElementById('btn-close-dev').onclick = () => devPanel.style.display = 'none';

      const setupDevBtn = (id, prop, color, labelText) => {
        let btn = document.getElementById(id);
        if (!btn && devPanel) {
           btn = document.createElement('button');
           btn.id = id;
           btn.className = 'btn-secondary';
           btn.innerText = labelText || id;
           btn.style.cssText = 'width: 100%; margin-top: 5px;';
           const referenceNode = document.getElementById('btn-dev-mouse');
           if (referenceNode && referenceNode.parentNode) {
               referenceNode.parentNode.insertBefore(btn, referenceNode.nextSibling);
           } else {
               devPanel.appendChild(btn);
           }
        }
        if (btn) {
          btn.style.borderColor = eng.devOptions[prop] ? color : '';
          btn.style.color = eng.devOptions[prop] ? color : '';
          btn.onclick = () => {
            eng.devOptions[prop] = !eng.devOptions[prop];
            btn.style.borderColor = eng.devOptions[prop] ? color : '';
            btn.style.color = eng.devOptions[prop] ? color : '';
            localStorage.setItem('b_dev_options', JSON.stringify(eng.devOptions));
          };
        }
      };

      setupDevBtn('btn-dev-player', 'showPlayerPos', '#ff4757', 'Toggle Player Pos');
      setupDevBtn('btn-dev-player-tile', 'showPlayerTile', '#ff4757', 'Toggle Player Tile');
      setupDevBtn('btn-dev-entity', 'showEntityPos', '#ff4757', 'Toggle Entity Pos');
      setupDevBtn('btn-dev-entity-tile', 'showEntityTile', '#ff4757', 'Toggle Entity Tile');
      setupDevBtn('btn-dev-mouse', 'showMousePos', '#ff4757', 'Toggle Mouse Pos');
      setupDevBtn('btn-dev-melee', 'showMelee', '#ff4757', 'Toggle Melee Range');
      setupDevBtn('btn-dev-hitbox', 'showHitboxes', '#ff4757', 'Toggle Hitboxes');
      setupDevBtn('btn-dev-tile', 'showTile', '#ff4757', 'Toggle Tile Grids');
      setupDevBtn('btn-dev-chunk', 'showChunk', '#ff4757', 'Toggle Chunk Grids');
      setupDevBtn('btn-dev-dist-npc', 'showDistToNPC', '#f1c40f', 'Dist: Player to NPC');
      setupDevBtn('btn-dev-dist-mouse', 'showDistNpcToMouse', '#f1c40f', 'Dist: NPC to Mouse');

      const btnEditTarget = document.getElementById('btn-dev-edit-target');
      if (btnEditTarget) {
        btnEditTarget.onclick = () => {
          if (eng.selectedTarget && eng.selectedTarget.type === 'npc') {
            const npc = eng.npcs.find(n => n.uuid === eng.selectedTarget.id);
            if (npc) {
              document.getElementById('edit-npc-uuid').value = npc.uuid;
              document.getElementById('edit-npc-name').value = npc.name;
              document.getElementById('edit-npc-hp').value = Math.floor(npc.hp);
              document.getElementById('edit-npc-maxhp').value = npc.maxHp;
              document.getElementById('edit-npc-energy').value = Math.floor(npc.energy || 1000);
              document.getElementById('edit-npc-x').value = Math.round(npc.x);
              document.getElementById('edit-npc-y').value = Math.round(npc.y);
              document.getElementById('edit-npc-z').value = Math.round(npc.z || 0);
              document.getElementById('edit-npc-type').value = npc.type || 'idle';
              document.getElementById('edit-npc-dir').value = npc.dir || 'down';
              
              document.getElementById('npc-edit-modal').style.display = 'flex';
            }
          }
        };
      }

      const btnNpcManager = document.getElementById('btn-dev-npc-manager');
      const npcPanel = document.getElementById('npc-manager-panel');
      if (btnNpcManager && npcPanel) {
        btnNpcManager.onclick = () => {
          npcPanel.style.display = 'flex';
          this.renderNpcManager();
        };
        document.getElementById('btn-close-npc-manager').onclick = () => npcPanel.style.display = 'none';

        document.getElementById('btn-close-npc-edit').onclick = () => document.getElementById('npc-edit-modal').style.display = 'none';
        
        document.getElementById('btn-edit-npc-tp-me').onclick = () => {
          document.getElementById('edit-npc-x').value = Math.round(eng.player.x);
          document.getElementById('edit-npc-y').value = Math.round(eng.player.y);
          document.getElementById('edit-npc-z').value = Math.round(eng.player.z || 0);
          emitNpcUpdate();
        };

        const emitNpcUpdate = () => {
          const uuid = document.getElementById('edit-npc-uuid').value;
          if (!uuid) return;
          const energyVal = parseFloat(document.getElementById('edit-npc-energy').value);
          const updates = {
            name: document.getElementById('edit-npc-name').value,
            hp: parseFloat(document.getElementById('edit-npc-hp').value),
            maxHp: parseFloat(document.getElementById('edit-npc-maxhp').value),
            energy: energyVal,
            maxEnergy: energyVal,
            x: parseFloat(document.getElementById('edit-npc-x').value),
            y: parseFloat(document.getElementById('edit-npc-y').value),
            z: parseFloat(document.getElementById('edit-npc-z').value),
            type: document.getElementById('edit-npc-type').value,
            dir: document.getElementById('edit-npc-dir').value
          };
          eng.socket.emit('edit_npc', { uuid, updates });
        };

        ['edit-npc-name', 'edit-npc-hp', 'edit-npc-maxhp', 'edit-npc-energy', 'edit-npc-x', 'edit-npc-y', 'edit-npc-z'].forEach(id => {
          document.getElementById(id).addEventListener('input', emitNpcUpdate);
        });
        ['edit-npc-type', 'edit-npc-dir'].forEach(id => {
          document.getElementById(id).addEventListener('change', emitNpcUpdate);
        });

        document.getElementById('btn-save-npc-edit').onclick = () => document.getElementById('npc-edit-modal').style.display = 'none';

        eng.socket.on('npc_deleted', (uuid) => {
          const idx = eng.npcs.findIndex(n => n.uuid === uuid);
          if (idx !== -1) eng.npcs.splice(idx, 1);
          if (npcPanel.style.display === 'flex') this.renderNpcManager();
        });
        eng.socket.on('npc_spawned', () => {
          if (npcPanel.style.display === 'flex') this.renderNpcManager();
        });
        eng.socket.on('npc_updated', (updatedNpc) => {
          const idx = eng.npcs.findIndex(n => n.uuid === updatedNpc.uuid);
          if (idx !== -1) {
            Object.assign(eng.npcs[idx], updatedNpc);
          }
          if (npcPanel.style.display === 'flex') this.renderNpcManager();
        });
      }
    }
  }

  renderNpcManager() {
    const list = document.getElementById('npc-manager-list');
    if (!list) return;
    list.innerHTML = '';

    if (this.engine.npcs.length === 0) {
      list.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 20px;">No NPCs found in the world.</div>`;
      return;
    }

    this.engine.npcs.forEach(npc => {
      const row = document.createElement('div');
      row.style.cssText = 'display: flex; align-items: center; gap: 15px; background: rgba(0,0,0,0.5); border: 1px solid var(--text-dim); padding: 10px; border-radius: 4px;';
      
      const type = npc.type || 'idle';
      const group = npc.group || 'Civilian';
      const notes = npc.notes || '';
      const z = npc.z || 0;

      row.innerHTML = `
        <button class="btn-edit btn-secondary" style="width: auto; height: auto; padding: 5px; border-color: #f39c12; color: #f39c12; font-weight: bold; margin-right: 5px; font-size: 0.9rem;" title="Edit NPC">✎</button>
        <div style="flex: 1.5; font-weight: bold; color: var(--accent-neon); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${npc.name}">${npc.name}</div>
        <div style="flex: 1.5; display: flex; align-items: center; gap: 10px; font-family: var(--font-mono); font-size: 0.85rem;">
          <span>X:${Math.round(npc.x)} Y:${Math.round(npc.y)} Z:${Math.round(z)}</span>
          <button class="btn-tp btn-secondary" style="padding: 2px 8px; font-size: 0.75rem; width: auto; height: auto;">TP</button>
        </div>
        <div style="flex: 1.5; font-family: var(--font-mono); font-size: 0.85rem; color: #aaa;">
          <div><span style="color:#fff;">Type:</span> ${type}</div>
          <div><span style="color:#fff;">Grp:</span> ${group}</div>
        </div>
        <div style="flex: 2; font-family: var(--font-mono); font-size: 0.8rem; color: #888; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${notes}">
          ${notes || '<em style="opacity: 0.5;">No notes</em>'}
        </div>
        <button class="btn-del btn-secondary" style="width: auto; height: auto; padding: 5px 10px; border-color: #ff4757; color: #ff4757; font-weight: bold;">X</button>
      `;

      row.querySelector('.btn-edit').onclick = () => {
        document.getElementById('edit-npc-uuid').value = npc.uuid;
        document.getElementById('edit-npc-name').value = npc.name;
        document.getElementById('edit-npc-hp').value = Math.floor(npc.hp);
        document.getElementById('edit-npc-maxhp').value = npc.maxHp;
        document.getElementById('edit-npc-energy').value = Math.floor(npc.energy || 1000);
        document.getElementById('edit-npc-x').value = Math.round(npc.x);
        document.getElementById('edit-npc-y').value = Math.round(npc.y);
        document.getElementById('edit-npc-z').value = Math.round(npc.z || 0);
        document.getElementById('edit-npc-type').value = npc.type || 'idle';
        document.getElementById('edit-npc-dir').value = npc.dir || 'down';
        
        document.getElementById('npc-edit-modal').style.display = 'flex';
      };

      row.querySelector('.btn-tp').onclick = () => {
        this.engine.player.x = npc.x;
        this.engine.player.y = npc.y;
        this.engine.camera.x = npc.x;
        this.engine.camera.y = npc.y;
        this.engine.chat.addMessage('system', 'System', `Teleported to ${npc.name}.`);
      };

      row.querySelector('.btn-del').onclick = () => {
        if (confirm(`Are you absolutely sure you want to delete NPC: ${npc.name}?`)) {
          this.engine.socket.emit('delete_npc', npc.uuid);
        }
      };

      list.appendChild(row);
    });
  }

  setupBuilderTools() {
    const eng = this.engine;
    const builderPanel = document.getElementById('builder-panel');
    if (builderPanel) {
      document.getElementById('btn-close-builder').onclick = () => builderPanel.style.display = 'none';
      const setupBuilderBtn = (id, prop) => {
        const btn = document.getElementById(id);
        if (btn) {
          btn.style.borderColor = eng.devOptions[prop] ? '#3498db' : '';
          btn.style.color = eng.devOptions[prop] ? '#3498db' : '';
          btn.onclick = () => {
            eng.devOptions[prop] = !eng.devOptions[prop];
            btn.style.borderColor = eng.devOptions[prop] ? '#3498db' : '';
            btn.style.color = eng.devOptions[prop] ? '#3498db' : '';
            localStorage.setItem('b_dev_options', JSON.stringify(eng.devOptions));
          };
        }
      };
      setupBuilderBtn('btn-build-tile', 'showTile');
      setupBuilderBtn('btn-build-chunk', 'showChunk');
      setupBuilderBtn('btn-build-coords', 'showMousePos');
    }

    const builderHotbar = document.getElementById('builder-hotbar');
    if (builderHotbar) {
      let selectedColor = '#ffffff';
      const colorPicker = document.getElementById('build-color-picker');
      if (colorPicker) colorPicker.addEventListener('input', (e) => selectedColor = e.target.value);

      builderHotbar.querySelectorAll('.hotbar-slot').forEach(slot => {
        slot.addEventListener('click', () => {
          builderHotbar.querySelectorAll('.hotbar-slot').forEach(s => s.classList.remove('active'));
          slot.classList.add('active');
          if (eng.selectedTiles.length > 0) {
            const updates = [];
            if (slot.dataset.tex === 'level') {
              const baseKey = `${eng.selectedTiles[0].x},${eng.selectedTiles[0].y}`;
              const baseTile = eng.mapData[baseKey];
              const targetZ = (baseTile && baseTile.z) ? baseTile.z : 0;
              
              eng.selectedTiles.forEach(tile => {
                const key = `${tile.x},${tile.y}`;
                const td = eng.mapData[key];
                if (!td && targetZ > 0) {
                  eng.mapData[key] = { tex: 'stone', color: selectedColor, z: targetZ };
                  updates.push({ x: tile.x, y: tile.y, tex: 'stone', color: selectedColor, z: targetZ });
                } else if (td) {
                  const newColor = typeof td === 'object' ? td.color : '#ffffff';
                  const newTex = typeof td === 'object' ? td.tex : td;
                  eng.mapData[key] = { tex: newTex, color: newColor, z: targetZ };
                  updates.push({ x: tile.x, y: tile.y, tex: newTex, color: newColor, z: targetZ });
                }
              });
            } else {
              eng.selectedTiles.forEach(tile => {
                const existingZ = (eng.mapData[`${tile.x},${tile.y}`] && eng.mapData[`${tile.x},${tile.y}`].z) ? eng.mapData[`${tile.x},${tile.y}`].z : 0;
                if (slot.dataset.tex === 'erase') {
                  delete eng.mapData[`${tile.x},${tile.y}`];
                  updates.push({ x: tile.x, y: tile.y, tex: null });
                } else {
                  eng.mapData[`${tile.x},${tile.y}`] = { tex: slot.dataset.tex, color: selectedColor, z: existingZ };
                  updates.push({ x: tile.x, y: tile.y, tex: slot.dataset.tex, color: selectedColor, z: existingZ });
                }
              });
            }
            eng.socket.emit('map_update', updates);
          }
        });
      });
    }
  }
}
