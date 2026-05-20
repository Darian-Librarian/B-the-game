import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class InputManager {
  constructor(engine) {
    this.engine = engine;
    this.keys = {};
    this.mousePos = { x: 0, y: 0 };
    this.isDraggingCamera = false;
    this.lastMouseX = 0;

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
      
      const kbs = eng.clientSettings.keybinds || { undo: 'z', redo: 'y', picker: '' };

      if (e.ctrlKey) {
        if (key === kbs.undo) {
          e.preventDefault();
          if (eng.editMode && eng.undo) eng.undo();
          return;
        }
        if (key === kbs.redo) {
          e.preventDefault();
          if (eng.editMode && eng.redo) eng.redo();
          return;
        }
      }

      if (!e.ctrlKey && !e.altKey && !e.shiftKey && kbs.picker && key === kbs.picker) {
        e.preventDefault();
        if (eng.editMode) {
          const pickerSlot = document.querySelector('#builder-hotbar .hotbar-slot[data-tex="picker"]');
          if (pickerSlot) pickerSlot.click();
        }
        return;
      }

      this.keys[key] = true;
      
      
      const powerKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
      if (powerKeys.includes(key)) {
        e.preventDefault();
        if (eng.editMode) {
          const slotIndex = key === '0' ? 9 : parseInt(key) - 1;
          const slots = document.querySelectorAll('#builder-hotbar .hotbar-slot');
          if (slots[slotIndex]) {
            slots[slotIndex].click();
          }
        } else {
          const slotIndex = powerKeys.indexOf(key);
          const powers = eng.playerData.powers || [];
          const powerName = powers[slotIndex];
          if (powerName) {
             if (powerName === 'Brawl') eng.combat?.triggerAttack();
             else if (powerName === 'Throw Airplane') eng.combat?.triggerThrowAirplane();
          }
        }
      }

      if (key === 'p') {
        e.preventDefault();
        const pPanel = document.getElementById('powers-panel');
        if (pPanel) {
          pPanel.style.display = pPanel.style.display === 'none' ? 'flex' : 'none';
          if (pPanel.style.display === 'flex') eng.ui.renderPowersUI();
        }
      }

      if (key === 'r') {
        if (eng.editMode) {
          e.preventDefault();
          const shapeBtn = document.getElementById('build-shape-btn');
          if (shapeBtn) shapeBtn.click();
        }
      }

      if (['alt', 'control', 'shift', ' '].includes(key) || e.ctrlKey || e.altKey) {
        e.preventDefault();
      }
    };

    this.handleKeyUp = (e) => {
      this.keys[e.key.toLowerCase()] = false;
    };

    this.handleContextMenu = (e) => e.preventDefault();

    this.handleBeforeUnload = (e) => {
          };

    this.handleWheel = (e) => {
      if (!eng.renderer || !eng.renderer.camera) return;
      const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
      const camera = eng.renderer.camera;
      camera.zoom = Math.max(1.0, Math.min(camera.zoom + zoomDelta, 3.0));
      camera.updateProjectionMatrix();
    };

    this.handleMouseDown = (e) => {
      this.mousePos.x = e.clientX;
      this.mousePos.y = e.clientY;

      const chatInput = document.getElementById('chat-input');
      if (chatInput) chatInput.blur(); 
      
      const ctxMenu = document.getElementById('player-context-menu');
      if (ctxMenu) ctxMenu.style.display = 'none';

      if (!eng.renderer || !eng.renderer.camera) return;

      const mouse = new THREE.Vector2();
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, eng.renderer.camera);

      let clickedTarget = null;
      
      if (eng.renderer.entityMeshes) {
        const groups = Array.from(eng.renderer.entityMeshes.values());
        const entityHits = raycaster.intersectObjects(groups, true);
        
        for (const hit of entityHits) {
          let hitId = null;
          for (const [id, group] of eng.renderer.entityMeshes.entries()) {
            if (group === hit.object || group.children.includes(hit.object)) {
              hitId = id; break;
            }
          }
          if (hitId && hitId !== 'player_self' && !hitId.startsWith('proj_')) {
            if (hitId.startsWith('npc_')) clickedTarget = { type: 'npc', id: hitId.substring(4) };
            else if (hitId.startsWith('player_')) clickedTarget = { type: 'player', id: hitId.substring(7) };
            break;
          }
        }
      }

      if (e.button === 0) {
        eng.selectedTarget = clickedTarget;
        eng.ui.update();

        if (eng.editMode && e.ctrlKey && eng.cursorGridPos) {
          eng.isDraggingSelection = true;
          eng.selectionStart = { ...eng.cursorGridPos };
          eng.selectionEnd = { ...eng.cursorGridPos };
          eng.updateSelectionArea();
          return;
        }

        const buildMeshes = [eng.renderer.voxelMesh, eng.renderer.slabMesh, eng.renderer.rampMesh].filter(Boolean);

        if (!clickedTarget && eng.editMode) {
          const blockHits = buildMeshes.length > 0 ? raycaster.intersectObjects(buildMeshes) : [];
          let position = new THREE.Vector3();
          let normal = new THREE.Vector3(0, 0, 1);
          let didHit = false;
          let hitExistingBlock = false;
          
          if (blockHits.length > 0) {
            const hit = blockHits[0];
            const matrix = new THREE.Matrix4();
            hit.object.getMatrixAt(hit.instanceId, matrix);
            position.setFromMatrixPosition(matrix);
            const rawNormal = hit.face ? hit.face.normal.clone() : new THREE.Vector3(0, 0, 1);
            const absX = Math.abs(rawNormal.x); const absY = Math.abs(rawNormal.y); const absZ = Math.abs(rawNormal.z);
            if (absZ >= absX && absZ >= absY) normal.set(0, 0, Math.sign(rawNormal.z));
            else if (absX > absY) normal.set(Math.sign(rawNormal.x), 0, 0);
            else normal.set(0, Math.sign(rawNormal.y), 0);
            didHit = true;
            hitExistingBlock = true;
          } else {
            const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -(eng.player.z || 0));
            if (raycaster.ray.intersectPlane(plane, position)) {
              didHit = true;
              normal.set(0, 0, 1);
            }
          }
          
          if (didHit) {
            
            const activeSlot = document.querySelector('.hotbar-slot.active');
            const tex = activeSlot ? activeSlot.dataset.tex : 'stone';
            const isDeleting = this.keys['shift'] || tex === 'erase';
            const isPicker = tex === 'picker';
            
            let targetX = Math.round(position.x / 32) * 32;
            let targetY = Math.round(position.y / 32) * 32;
            let targetZ = Math.round(position.z / 32) * 32;

            if (isPicker) {
              const clickedVoxel = eng.mapManager.getVoxelAt(targetX, targetY, targetZ);
              if (clickedVoxel) {
                let matchTex = clickedVoxel.tex;
                if (matchTex === 'water_flow') {
                   matchTex = 'water';
                   eng.editFluid = 'flow';
                   const fBtn = document.getElementById('build-fluid-btn');
                   if (fBtn) fBtn.innerText = 'Fluid State: FLOW';
                } else if (matchTex === 'water') {
                   eng.editFluid = 'still';
                   const fBtn = document.getElementById('build-fluid-btn');
                   if (fBtn) fBtn.innerText = 'Fluid State: STILL';
                }
                const slots = document.querySelectorAll('#builder-hotbar .hotbar-slot');
                slots.forEach(s => {
                  if (s.dataset.tex === matchTex) {
                    slots.forEach(ss => ss.classList.remove('active'));
                    s.classList.add('active');
                    document.getElementById('build-fluid-btn').style.display = ['water', 'lava', 'acid'].includes(matchTex) ? 'block' : 'none';
                    const tabs = document.querySelectorAll('#builder-tabs-container button');
                    tabs.forEach(t => { if (t.innerText === s.dataset.cat) t.click(); });
                  }
                });
                const colorPicker = document.getElementById('build-color-picker');
                if (colorPicker && clickedVoxel.color) {
                  colorPicker.value = clickedVoxel.color;
                  colorPicker.dispatchEvent(new Event('input'));
                }
                eng.chat.addMessage('system', 'System', `Sampled block: ${clickedVoxel.tex}`);
              }
            } else if (isDeleting) {
              const clickedVoxelOld = eng.mapManager.getVoxelAt(targetX, targetY, targetZ);
              if (clickedVoxelOld) {
                eng.history = eng.history || [];
                eng.history.push([{ worldX: targetX, worldY: targetY, worldZ: targetZ, voxelData: { ...clickedVoxelOld } }]);
                if (eng.history.length > 30) eng.history.shift();
                eng.redoHistory = [];
              }
              const pTex = clickedVoxelOld ? clickedVoxelOld.tex : 'stone';
              const pCol = clickedVoxelOld ? (clickedVoxelOld.color || '#ffffff') : '#ffffff';
              eng.mapManager.setVoxelAt(targetX, targetY, targetZ, null);
              // Deletion particle effect
              for (let i = 0; i < 25; i++) {
                eng.particles.push({
                  x: targetX + (Math.random() - 0.5) * 16, y: targetY + (Math.random() - 0.5) * 16, z: targetZ + (Math.random() - 0.5) * 16,
                  vx: (Math.random() - 0.5) * 200,
                  vy: (Math.random() - 0.5) * 200,
                  vz: 50 + Math.random() * 150, 
                  vr: (Math.random() - 0.5) * 15,
                  rot: Math.random() * Math.PI * 2,
                  life: 0.2 + Math.random() * 0.2, 
                  maxLife: 0.4,
                  tex: pTex,
                  color: pCol,
                  size: 2 + Math.random() * 4,
                  uvOffsetX: Math.random() * 0.75, // Random 25% quadrant
                  uvOffsetY: Math.random() * 0.75,
                  uvScale: 0.25
                });
              }
            } else {
              const clickedVoxel = eng.mapManager.getVoxelAt(targetX, targetY, targetZ);
              let placeShape = eng.editShape || 'cube';
              if (placeShape === 'ramp_player') {
                const pDir = eng.player.dir;
                if (pDir.includes('up')) placeShape = 'ramp_n';
                else if (pDir.includes('down')) placeShape = 'ramp_s';
                else if (pDir.includes('right')) placeShape = 'ramp_e';
                else if (pDir.includes('left')) placeShape = 'ramp_w';
                else placeShape = 'ramp_s';
              }
              
              if (hitExistingBlock) {
                if (clickedVoxel && clickedVoxel.shape === 'slab' && normal.z === 1) {
                  placeShape = 'cube';
                } else {
                  targetX += normal.x * 32;
                  targetY += normal.y * 32;
                  targetZ += normal.z * 32;
                }
              }
              
              const colorPicker = document.getElementById('build-color-picker');
              const color = colorPicker ? colorPicker.value : '#ffffff';

              const clickedVoxelOld = eng.mapManager.getVoxelAt(targetX, targetY, targetZ);
              eng.history = eng.history || [];
              eng.history.push([{ worldX: targetX, worldY: targetY, worldZ: targetZ, voxelData: clickedVoxelOld ? { ...clickedVoxelOld } : null }]);
              if (eng.history.length > 30) eng.history.shift();
              eng.redoHistory = [];

              let finalTex = tex;
              if (finalTex === 'water' && eng.editFluid === 'flow') finalTex = 'water_flow';

              eng.mapManager.setVoxelAt(targetX, targetY, targetZ, { tex: finalTex, color, shape: placeShape });
              // Todo: Creation particle effect
              for (let i = 0; i < 15; i++) {
                eng.particles.push({
                  x: targetX + (Math.random() - 0.5) * 32,
                  y: targetY + (Math.random() - 0.5) * 32,
                  z: targetZ + (Math.random() - 0.5) * 32,
                  vx: (Math.random() - 0.5) * 50,
                  vy: (Math.random() - 0.5) * 50,
                  vz: (Math.random() - 0.5) * 50,
                  life: 0.15 + Math.random() * 0.15,
                  maxLife: 0.3,
                  tex: tex,
                  color: color,
                  size: 2 + Math.random() * 3,
                  uvOffsetX: Math.random() * 0.75,
                  uvOffsetY: Math.random() * 0.75,
                  uvScale: 0.25
                });
              }
            }
          }
        } else if (!eng.mapOverlay || !eng.mapOverlay.active) {
          if (this.keys['v'] || (eng.clientSettings.clickToMove && !clickedTarget && !eng.editMode)) {
            const blockHits = raycaster.intersectObjects(buildMeshes);
            if (blockHits.length > 0) {
              eng.player.moveTarget = { x: blockHits[0].point.x, y: blockHits[0].point.y, sprint: !!this.keys['shift'], timer: 15 };
            }
          }
        }
      } else if (e.button === 2) {
        e.preventDefault();
        
        if (clickedTarget) {
          eng.contextTarget = clickedTarget;
          
          let menuX = e.clientX;
          let menuY = e.clientY;
          if (menuX + 150 > window.innerWidth) menuX = window.innerWidth - 150;
          if (menuY + 60 > window.innerHeight) menuY = window.innerHeight - 60;
          
          if (ctxMenu) {
            const btnTrade = document.getElementById('ctx-btn-trade');
            const btnTalk = document.getElementById('ctx-btn-talk');
            
            if (btnTrade) btnTrade.style.display = clickedTarget.type === 'player' ? 'block' : 'none';
            if (btnTalk) btnTalk.style.display = clickedTarget.type === 'npc' ? 'block' : 'none';
  
            ctxMenu.style.left = `${menuX}px`;
            ctxMenu.style.top = `${menuY}px`;
            ctxMenu.style.display = 'flex';
          }
        }
      } else if (e.button === 1 && eng.clientSettings.middleMouseRotation !== false) {
        e.preventDefault();
        this.isDraggingCamera = true;
        this.lastMouseX = e.clientX;
        document.body.style.cursor = 'grabbing';
        eng.canvas.style.cursor = 'grabbing';
      }
    };

    this.handleMouseMove = (e) => {
      this.mousePos.x = e.clientX;
      this.mousePos.y = e.clientY;
      
      if (eng.isDraggingSelection && eng.cursorGridPos) {
        if (!eng.selectionEnd || eng.selectionEnd.x !== eng.cursorGridPos.x || eng.selectionEnd.y !== eng.cursorGridPos.y || eng.selectionEnd.z !== eng.cursorGridPos.z) {
          eng.selectionEnd = { ...eng.cursorGridPos };
          eng.updateSelectionArea();
        }
      }

      if (this.isDraggingCamera && eng.renderer && eng.renderer.rotateCamera) {
        const deltaX = e.clientX - this.lastMouseX;
        const invertCam = eng.clientSettings.invertCameraRotation ? -1 : 1;
        const sensitivity = eng.clientSettings.dragRotationSensitivity !== undefined ? eng.clientSettings.dragRotationSensitivity : 0.25;
        eng.renderer.rotateCamera(deltaX * sensitivity * invertCam);
        this.lastMouseX = e.clientX;
      }
    };

    this.handleMouseUp = (e) => {
      if (e.button === 0 && eng.isDraggingSelection) {
        eng.isDraggingSelection = false;
        if (eng.selectedTiles && eng.selectedTiles.length > 0) {
          const activeSlot = document.querySelector('#builder-hotbar .hotbar-slot.active');
          if (activeSlot) activeSlot.click();
        }
      }
      if (e.button === 1) {
        this.isDraggingCamera = false;
        document.body.style.cursor = '';
        eng.canvas.style.cursor = '';
      }
    };

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    document.addEventListener('contextmenu', this.handleContextMenu);
    eng.canvas.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('beforeunload', this.handleBeforeUnload);
    window.addEventListener('wheel', this.handleWheel, { passive: false });
  }

  disconnect() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    document.removeEventListener('contextmenu', this.handleContextMenu);
    this.engine.canvas.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    window.removeEventListener('wheel', this.handleWheel);
  }
}
