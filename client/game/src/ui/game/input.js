export class InputManager {
  constructor(engine) {
    this.engine = engine;
    this.keys = {};
    this.mousePos = { x: 0, y: 0 };

    this.setupListeners();
  }

  setupListeners() {
    const eng = this.engine;

    this.handleKeyDown = (e) => {
      const chatInput = document.getElementById('chat-input');
      if (e.key === 'Enter') {
        if (chatInput && document.activeElement !== chatInput) {
          chatInput.focus();
          e.preventDefault();
        }
        return;
      }
      
      if (e.key === '/') {
        if (chatInput && document.activeElement !== chatInput) {
          chatInput.focus();
          chatInput.value = '/';
          e.preventDefault();
        }
      }
      if (chatInput && document.activeElement === chatInput) return;

      const key = e.key.toLowerCase();
      this.keys[key] = true;
      
      if (key === 'control') eng.combat?.triggerAttack();
      
      if (['alt', 'control', 'shift', ' '].includes(key) || e.ctrlKey || e.altKey) {
        e.preventDefault();
      }
    };

    this.handleKeyUp = (e) => {
      this.keys[e.key.toLowerCase()] = false;
    };

    this.handleContextMenu = (e) => e.preventDefault();

    this.handleBeforeUnload = (e) => {
      // e.preventDefault();
    };

    this.handleMouseDown = (e) => {
      this.mousePos.x = e.clientX;
      this.mousePos.y = e.clientY;

      const chatInput = document.getElementById('chat-input');
      if (chatInput) chatInput.blur(); 
      
      const ctxMenu = document.getElementById('player-context-menu');
      if (ctxMenu) ctxMenu.style.display = 'none';

      if (e.button === 0) { // Left Click

        if (eng.editMode) {
          if (this.keys['shift'] && eng.selectedTiles.length > 0) {
            eng.isDraggingElevation = true;
            eng.elevationStartY = e.clientY;
            eng.elevationOriginalZ = {};
            
            eng.selectedTiles.forEach(t => {
              const key = `${t.x},${t.y}`;
              const td = eng.mapData[key];
              eng.elevationOriginalZ[key] = (td && td.z) ? td.z : 0;
            });
            return; 
          }

          const ray = eng.getIsoRaycast(this.mousePos.x, this.mousePos.y);
          const gx = ray.gx;
          const gy = ray.gy;
          
          if (eng.selectedTiles.length === 1 && eng.selectedTiles[0].x === gx && eng.selectedTiles[0].y === gy) {
            eng.selectedTiles = [];
          } else {
            eng.isDraggingSelection = true;
            eng.selectionStart = { x: gx, y: gy };
            eng.selectionEnd = { x: gx, y: gy };
            eng.updateSelectionArea();
          }
        }

        let clickedTarget = null;
        const checkHitbox = (entity) => {
          const pos = eng.getScreenPos(entity.x, entity.y, entity.z || 0);
          return this.mousePos.x >= pos.x - 30 && this.mousePos.x <= pos.x + 30 && this.mousePos.y >= pos.y - 145 && this.mousePos.y <= pos.y + 35;
        };

        for (let npc of eng.npcs) { if (npc.state !== 'dead' && checkHitbox(npc)) { clickedTarget = { type: 'npc', id: npc.uuid }; break; } }
        if (!clickedTarget) {
          for (let id in eng.otherPlayers) { if (eng.otherPlayers[id].state !== 'death' && checkHitbox(eng.otherPlayers[id])) { clickedTarget = { type: 'player', id: id }; break; } }
        }
        if (!clickedTarget && eng.player.state !== 'death' && checkHitbox(eng.player)) clickedTarget = { type: 'self' };

        eng.selectedTarget = clickedTarget;
        eng.ui.update();

        if (!eng.mapOverlay || !eng.mapOverlay.active) {
          if (this.keys['v'] || (eng.clientSettings.clickToMove && !clickedTarget && !eng.editMode)) {
            const ray = eng.getIsoRaycast(this.mousePos.x, this.mousePos.y);
            eng.player.moveTarget = { x: ray.exactX, y: ray.exactY, sprint: !!this.keys['shift'], timer: 15 };
            return;
          }
        }
      } else if (e.button === 2) {
        e.preventDefault();
        
        let clickedTarget = null;
        const checkHitbox = (entity) => {
          const pos = eng.getScreenPos(entity.x, entity.y, entity.z || 0);
          return this.mousePos.x >= pos.x - 30 && this.mousePos.x <= pos.x + 30 && this.mousePos.y >= pos.y - 145 && this.mousePos.y <= pos.y + 35;
        };
        
        for (let id in eng.otherPlayers) { 
          if (eng.otherPlayers[id].state !== 'death' && checkHitbox(eng.otherPlayers[id])) { clickedTarget = { type: 'player', id: id }; break; } 
        }
        
        if (clickedTarget && clickedTarget.type === 'player') {
          eng.contextTarget = clickedTarget.id;
          
          let menuX = e.clientX;
          let menuY = e.clientY;
          if (menuX + 150 > window.innerWidth) menuX = window.innerWidth - 150;
          if (menuY + 60 > window.innerHeight) menuY = window.innerHeight - 60;
          
          ctxMenu.style.left = `${menuX}px`;
          ctxMenu.style.top = `${menuY}px`;
          ctxMenu.style.display = 'flex';
        }
      } 
    };

    this.handleMouseMove = (e) => {
      this.mousePos.x = e.clientX;
      this.mousePos.y = e.clientY;
      
      if (eng.editMode && eng.isDraggingElevation) {
        const deltaZ = Math.round((eng.elevationStartY - e.clientY) / 32);
        eng.selectedTiles.forEach(tile => {
          const key = `${tile.x},${tile.y}`;
          const td = eng.mapData[key];
          const newZ = Math.max(0, (eng.elevationOriginalZ[key] || 0) + deltaZ);
          if (!td) {
            const activeSlot = document.querySelector('.hotbar-slot.active');
            const tex = activeSlot ? activeSlot.dataset.tex : 'stone';
            if (tex !== 'erase') eng.mapData[key] = { tex, color: '#ffffff', z: newZ };
          } else {
            if (typeof td === 'object') td.z = newZ;
            else eng.mapData[key] = { tex: td, color: '#ffffff', z: newZ };
          }
        });
        return;
      }

      if (eng.editMode && eng.isDraggingSelection) {
        const ray = eng.getIsoRaycast(this.mousePos.x, this.mousePos.y);
        const gx = ray.gx;
        const gy = ray.gy;
        
        if (!eng.selectionEnd || eng.selectionEnd.x !== gx || eng.selectionEnd.y !== gy) {
          eng.selectionEnd = { x: gx, y: gy };
          eng.updateSelectionArea();
        }
      }
    };

    this.handleMouseUp = (e) => {
      if (e.button === 0 && eng.isDraggingSelection) eng.isDraggingSelection = false;
      if (e.button === 0 && eng.isDraggingElevation) {
        eng.isDraggingElevation = false;
        const updates = [];
        eng.selectedTiles.forEach(t => {
          const td = eng.mapData[`${t.x},${t.y}`];
          if (td) updates.push({ x: t.x, y: t.y, tex: td.tex, color: td.color, z: td.z });
        });
        if (updates.length > 0) eng.socket.emit('map_update', updates);
      }
    };

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    document.addEventListener('contextmenu', this.handleContextMenu);
    eng.canvas.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('beforeunload', this.handleBeforeUnload);
  }

  disconnect() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    document.removeEventListener('contextmenu', this.handleContextMenu);
    this.engine.canvas.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
  }
}
