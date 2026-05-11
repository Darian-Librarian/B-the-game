export class MapOverlayManager {
  constructor(engine) {
    this.engine = engine;
    this.active = false;
    this.zoom = 4;
    this.setupUI();
  }

  setupUI() {
    // Dynamically inject the M button beneath the I button
    const sideHud = document.querySelector('.game-side-hud');
    if (sideHud && !document.getElementById('btn-fullscreen-map')) {
      const btn = document.createElement('button');
      btn.id = 'btn-fullscreen-map';
      btn.className = 'btn-secondary';
      btn.style.cssText = 'width: 45px; height: 45px; font-weight: bold; background: rgba(0,0,0,0.8); border-color: #f39c12; color: #f39c12; border-radius: 4px; font-size: 1.2rem; cursor: pointer; transition: background 0.2s;';
      btn.innerText = 'M';
      btn.onclick = () => {
        this.active = !this.active;
        const chatInput = document.getElementById('chat-input');
        if (chatInput) chatInput.blur();
      };
      btn.onmouseenter = () => btn.style.background = 'rgba(243, 156, 18, 0.2)';
      btn.onmouseleave = () => btn.style.background = 'rgba(0,0,0,0.8)';
      sideHud.appendChild(btn);
    }

    // Map Hotkey
    this.keydownListener = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.repeat) return; // Prevent rapid flickering if key is held!
      if (e.key.toLowerCase() === 'm') {
        this.active = !this.active;
      }
    };
    window.addEventListener('keydown', this.keydownListener);

    // Map Scroll Zoom
    this.wheelListener = (e) => {
      if (!this.active) return;
      if (e.deltaY < 0) {
        this.zoom = Math.min(this.zoom + 1, 16);
      } else {
        this.zoom = Math.max(this.zoom - 1, 1);
      }
    };
    window.addEventListener('wheel', this.wheelListener);
  }

  disconnect() {
    window.removeEventListener('keydown', this.keydownListener);
    window.removeEventListener('wheel', this.wheelListener);
    const btn = document.getElementById('btn-fullscreen-map');
    if (btn) btn.remove();
  }

  draw(ctx) {
    if (!this.active) return;
    
    const eng = this.engine;
    const canvasW = eng.canvas.width;
    const canvasH = eng.canvas.height;
    const mmTileSize = this.zoom; // Dynamically scales via mouse-wheel

    ctx.save();

    // Black out the map area
    ctx.fillStyle = 'rgba(5, 7, 10, 0.95)';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Set up Top-Down projection
    ctx.translate(canvasW / 2, canvasH / 2);
    ctx.rotate(45 * Math.PI / 180);

    const pFracX = eng.player.x / 32;
    const pFracY = eng.player.y / 32;
    const pGx = Math.floor(pFracX);
    const pGy = Math.floor(pFracY);
    const offsetX = (pFracX - pGx) * mmTileSize;
    const offsetY = (pFracY - pGy) * mmTileSize;

    // 1. Draw Solid Base Grass Color (Fixes black screen rendering bug!)
    ctx.fillStyle = '#447525';
    const maxD = Math.max(canvasW, canvasH) * 2;
    ctx.fillRect(-maxD, -maxD, maxD * 2, maxD * 2);

    // 1.5. Draw Endless Grass Pattern seamlessly across the map!
    if (!this.grassPattern && eng.grassVariations && eng.grassVariations.length > 0) {
      this.grassPattern = ctx.createPattern(eng.grassVariations[0], 'repeat');
    }
    if (this.grassPattern) {
      ctx.save();
      const shiftX = (pFracX * mmTileSize);
      const shiftY = (pFracY * mmTileSize);
      ctx.translate(-shiftX, -shiftY);
      const scale = mmTileSize / 64; // Scale pattern exactly to Zoom level
      ctx.scale(scale, scale);
      ctx.fillStyle = this.grassPattern;
      const fillMax = maxD / scale;
      ctx.fillRect(-fillMax, -fillMax, fillMax * 2, fillMax * 2);
      ctx.restore();
    }

    // 2. Enable Image Smoothing (Fixes the dither-y/static look on tiny textures!)
    ctx.imageSmoothingEnabled = true;

    // 3. Draw Custom Placed Tiles
    for (let key in eng.mapData) {
      const coords = key.split(',');
      const gx = parseInt(coords[0], 10);
      const gy = parseInt(coords[1], 10);

      const drawX = (gx - pGx) * mmTileSize - offsetX - (mmTileSize / 2);
      const drawY = (gy - pGy) * mmTileSize - offsetY - (mmTileSize / 2);
      
      // Safe Culling
      if (drawX < -canvasW || drawX > canvasW || drawY < -canvasH || drawY > canvasH) continue;

      const tileData = eng.mapData[key];
      const color = typeof tileData === 'object' ? tileData.color : '#ffffff';
      let sourceImg = null;
      let finalSy = 0;
      let sw = 64, sh = 64;

      if (tileData) {
        const texId = typeof tileData === 'object' ? tileData.tex : tileData;
        if (texId && eng.customTiles && eng.customTiles[texId] && eng.customTiles[texId].complete) {
          const img = eng.customTiles[texId];
          sw = img.width;
          sh = img.height;
          if (img.animated) {
             sh = sw;
             const frameCount = Math.max(1, img.height / sh);
             finalSy = (Math.floor(performance.now() / 100) % frameCount) * sh;
          }
          
          const cacheKey = `${texId}_${color}_${finalSy}`;
          if (eng.tintCache && eng.tintCache[cacheKey]) {
            sourceImg = eng.tintCache[cacheKey];
            finalSy = 0;
          } else {
            sourceImg = img;
          }
        }
      }

      if (sourceImg && (sourceImg.naturalWidth > 0 || sourceImg.width > 0)) {
        ctx.drawImage(sourceImg, 0, finalSy, sw, sh, drawX, drawY, mmTileSize + 0.5, mmTileSize + 0.5);
        
        if (tileData && color !== '#ffffff' && (!eng.tintCache || !eng.tintCache[`${tileData.tex}_${color}_${finalSy}`])) {
           ctx.fillStyle = color;
           ctx.globalCompositeOperation = 'multiply';
           ctx.fillRect(drawX, drawY, mmTileSize + 0.5, mmTileSize + 0.5);
           ctx.globalCompositeOperation = 'source-over';
        }
      }
    }

    // 3. Draw Avatars and HUDs for Entities
    const drawMapAvatar = (entity, isPlayer = false) => {
      const drawX = (entity.x / 32 - pFracX) * mmTileSize;
      const drawY = (entity.y / 32 - pFracY) * mmTileSize;
      
      if (drawX < -canvasW || drawX > canvasW || drawY < -canvasH || drawY > canvasH) return;

      ctx.save();
      ctx.translate(drawX, drawY);
      ctx.rotate(-45 * Math.PI / 180);

      let state = entity.state;
      if (state === 'dead') state = 'death';
      else if (entity.hurtTimer > 0) state = 'hurt';

      const spriteKey = `${state}_${entity.dir}`;
      const img = eng.sprites[spriteKey];

      if (img && img.complete && img.naturalWidth > 0) {
        const fw = 96; const fh = 90;
        const scale = Math.max(0.3, mmTileSize / 24); // Scale avatar dynamically but keep a minimum size
        ctx.scale(scale, scale);
        ctx.drawImage(img, (entity.frame || 0) * fw, 0, fw, fh, -fw / 2, -fh + 35, fw, fh);
      } else {
        ctx.fillStyle = isPlayer ? '#2ecc71' : (entity.uuid ? '#ff4757' : '#3498db');
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore(); // Drop scale context for text
      
      ctx.save();
      ctx.translate(drawX, drawY);
      ctx.rotate(-45 * Math.PI / 180); // Reverse rotation for readable text!
      
      const name = isPlayer ? eng.playerData.name : entity.name;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 3;
      const textOffset = Math.max(10, mmTileSize * 1.5);
      ctx.strokeText(name, 0, textOffset);
      ctx.fillText(name, 0, textOffset);

      const hpPercent = Math.max(0, entity.hp / entity.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillRect(-15, textOffset + 6, 30, 4);
      ctx.fillStyle = isPlayer ? '#2ecc71' : (entity.uuid ? '#ff4757' : '#3498db');
      ctx.fillRect(-15, textOffset + 6, 30 * hpPercent, 4);
      
      if (entity.energy !== undefined && entity.maxEnergy) {
         const epPercent = Math.max(0, entity.energy / entity.maxEnergy);
         ctx.fillStyle = '#0984e3';
         ctx.fillRect(-15, textOffset + 10, 30 * epPercent, 4);
      }

      ctx.restore();
    };

    eng.npcs.forEach(npc => { if (npc.state !== 'dead') drawMapAvatar(npc); });
    Object.values(eng.otherPlayers).forEach(op => { if (op.state !== 'death') drawMapAvatar(op); });
    drawMapAvatar(eng.player, true);

    ctx.restore();
  }

  drawBorder(ctx) {
    if (!this.active) return;
    const canvasW = this.engine.canvas.width;
    const mmSize = 250;
    const pipX = canvasW - mmSize / 2 - 20;
    const pipY = 70 + mmSize / 2;
    const pipRadius = mmSize / 2;

    ctx.beginPath();
    ctx.arc(pipX, pipY, pipRadius, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(243, 156, 18, 0.8)';
    ctx.stroke();
  }
}
