export class Renderer {
  constructor(engine) {
    this.engine = engine;
    this.engine.sprites = {};
    this.engine.grassVariations = [];
    this.engine.customTiles = {};
    this.engine.tintCache = {};
    
    this.loadSprites();
    this.loadTiles();
  }

  loadSprites() {
    const dirs = ['up', 'down', 'left', 'right'];
    const states = ['idle', 'walk', 'run', 'dash', 'jump', 'attack1', 'attack2', 'hurt', 'death'];
    const path = 'assets/sprites/characters/standard';
    
    dirs.forEach(d => {
      states.forEach(s => {
        const img = new Image();
        img.src = `${path}/${s}_${d}.png`;
        this.engine.sprites[`${s}_${d}`] = img;
      });
    });
  }

  loadTiles() {
    const eng = this.engine;
    const img = new Image();
    img.src = 'assets/tiles/base/floor/grass_block_top.png';
    img.onerror = () => {
      img.src = 'assets/tiles/base/grass_block_top.png'; 
      img.onerror = null;
    };

    img.onload = () => {
      const shades = ['#51852E', '#589132', '#4A7C2A', '#5C9636', '#447525'];
      shades.forEach(color => {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = img.naturalWidth;
        offCanvas.height = img.naturalHeight;
        const oCtx = offCanvas.getContext('2d');

        oCtx.drawImage(img, 0, 0);
        oCtx.globalCompositeOperation = 'multiply';
        oCtx.fillStyle = color;
        oCtx.fillRect(0, 0, offCanvas.width, offCanvas.height);

        eng.grassVariations.push(offCanvas);
      });
    };

    const customFiles = [
      { id: 'grass', src: 'assets/tiles/base/floor/grass_block_top.png', fallback: 'assets/tiles/base/grass_block_top.png' },
      { id: 'dirt', src: 'assets/tiles/base/all-facing/dirt.png' },
      { id: 'stone', src: 'assets/tiles/base/all-facing/stone.png' },
      { id: 'water', src: 'assets/tiles/base/fluid/water_still.png', animated: true, tintable: true, alpha: 0.85 },
      { id: 'paint', src: 'assets/tiles/base/side/rough-paint.png', tintable: true },
      { id: 'carpet', src: 'assets/tiles/base/all-facing/carpet.png', tintable: true }
    ];
    customFiles.forEach(t => {
      const tImg = new Image();
      tImg.src = t.src;
      tImg.onerror = () => { if (t.fallback) tImg.src = t.fallback; };
      tImg.animated = t.animated;
      tImg.tintable = t.tintable;
      tImg.alpha = t.alpha || 1.0;

      if (t.animated) {
        fetch(`${t.src}.mcmeta`).then(r => r.json()).then(data => tImg.mcmeta = data).catch(() => {});
      }
      eng.customTiles[t.id] = tImg;
    });
  }

  draw() {
    const eng = this.engine;
    const ctx = eng.ctx;

    ctx.save();
    if (eng.mapOverlay && eng.mapOverlay.active) {
      const mmSize = 250;
      const pipX = eng.canvas.width - mmSize / 2 - 20;
      const pipY = 70 + mmSize / 2;
      const pipRadius = mmSize / 2;

      ctx.beginPath();
      ctx.arc(pipX, pipY, pipRadius, 0, Math.PI * 2);
      ctx.clip();
      
      ctx.fillStyle = '#0b0e14';
      ctx.fillRect(pipX - pipRadius, pipY - pipRadius, mmSize, mmSize);
    } else {
      ctx.fillStyle = '#0b0e14';
      ctx.fillRect(0, 0, eng.canvas.width, eng.canvas.height);
    }

    const drawIsoCircle = (wx, wy, wz, radius, color, fillAlpha) => {
      const pos = eng.getScreenPos(wx, wy, wz);
      ctx.save();
      ctx.transform(1, eng.tilt, -1, eng.tilt, pos.x, pos.y);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      if (fillAlpha > 0) {
        ctx.globalAlpha = fillAlpha;
        ctx.fillStyle = color;
        ctx.fill();
      }
      ctx.restore();
    };
    
    const drawTileHighlight = (wx, wy, fill, stroke, textColor, zOffset = 0, isBase = false) => {
      const blockSize = 32; 
      const tileW = 64;
      const gx = Math.round(wx / blockSize);
      const gy = Math.round(wy / blockSize);
      const pos = eng.getScreenPos(gx * blockSize, gy * blockSize);
      
      ctx.save();
      ctx.translate(pos.x, pos.y - zOffset);
      ctx.scale(1, eng.tilt);
      ctx.rotate(45 * Math.PI / 180);
      const size = tileW / Math.SQRT2;
      ctx.fillStyle = fill;
      ctx.fillRect(-size / 2, -size / 2, size, size);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.strokeRect(-size / 2, -size / 2, size, size);
      ctx.restore();
      
      if (textColor) {
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        const dispZ = isBase ? 0 : Math.round(zOffset / 32);
        
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.lineWidth = 4;
        ctx.strokeText(`Tile X:${gx} Y:${gy} Z:${dispZ}`, pos.x, pos.y - 10);
        
        ctx.fillStyle = textColor;
        ctx.fillText(`Tile X:${gx} Y:${gy} Z:${dispZ}`, pos.x, pos.y - 10);
      }
    };

    const getEntitySortVal = (entity) => {
      const x = entity.x || 0;
      const y = entity.y || 0;
      const gx = Math.round(x / 32);
      const gy = Math.round(y / 32);
      const offsetX = x - (gx * 32);
      const offsetY = y - (gy * 32);
      const subCell = (((offsetX + 16) / 32) + ((offsetY + 16) / 32)) * 0.4;
      return (gx * 32) + (gy * 32) + 0.1 + subCell; 
    };

    const getBlockSortVal = (gx, gy) => {
      return (gx * 32) + (gy * 32);
    };

    const entitiesToDraw = [];

    if (eng.grassVariations && eng.grassVariations.length > 0) {
      ctx.imageSmoothingEnabled = false;

      const tileW = 64; 
      const blockSize = 32; 
      const camGridX = Math.floor(eng.camera.x / blockSize);
      const camGridY = Math.floor(eng.camera.y / blockSize);
      const radius = Math.ceil(Math.max(eng.canvas.width, eng.canvas.height / eng.tilt) / blockSize / 2) + 2;
      const tallBlockBuffer = 20; 

      const getHash = (gx, gy) => {
        let val = Math.sin(gx * 12.9898 + gy * 78.233) * 43758.5453;
        return val - Math.floor(val);
      };
      
      for (let gy = camGridY - radius; gy <= camGridY + radius + tallBlockBuffer; gy++) {
        for (let gx = camGridX - radius; gx <= camGridX + radius; gx++) {
          const worldX = gx * blockSize;
          const worldY = gy * blockSize;
          
          const pos = eng.getScreenPos(worldX, worldY);
          
          const tileKey = `${gx},${gy}`;
          let img = null;
          
          const tileData = eng.mapData[tileKey];
          const texId = typeof tileData === 'object' ? tileData.tex : tileData;
          const color = typeof tileData === 'object' ? tileData.color : '#ffffff';
          const z = typeof tileData === 'object' && tileData.z ? tileData.z : 0;
          const zOffset = z * 32; 

          if (
            pos.x < -tileW || 
            pos.x > eng.canvas.width + tileW || 
            pos.y < -tileW || 
            (pos.y - zOffset) > eng.canvas.height + tileW
          ) continue;

          let sourceImg = null;
          let finalSy = 0;
          let sw = 0;
          let sh = 0;

          if (texId && eng.customTiles[texId] && eng.customTiles[texId].complete && eng.customTiles[texId].naturalWidth > 0) {
            img = eng.customTiles[texId];
            sw = img.width;
            sh = img.height;

            if (img.animated) {
              sh = sw;
              const frameCount = Math.max(1, img.height / sh);
              let frameIndex = 0;
              if (img.mcmeta && img.mcmeta.animation) {
                 const anim = img.mcmeta.animation;
                 const frametime = anim.frametime || 2; 
                 const frames = anim.frames || Array.from({length: frameCount}, (_,i)=>i);
                 const ticks = Math.floor(performance.now() / 50); 
                 frameIndex = frames[Math.floor(ticks / frametime) % frames.length];
              } else {
                 frameIndex = Math.floor(performance.now() / 100) % frameCount; 
              }
              finalSy = frameIndex * sh;
            }

            sourceImg = img;

            if (color && color !== '#ffffff' && img.tintable) {
              const cacheKey = `${texId}_${color}_${finalSy}`;
              if (!eng.tintCache) eng.tintCache = {};
              
              if (!eng.tintCache[cacheKey]) {
                const tCanvas = document.createElement('canvas');
                tCanvas.width = sw;
                tCanvas.height = sh;
                const tCtx = tCanvas.getContext('2d');
                tCtx.globalCompositeOperation = 'source-over';
                tCtx.drawImage(img, 0, finalSy, sw, sh, 0, 0, sw, sh);
                
                tCtx.globalCompositeOperation = 'multiply';
                tCtx.fillStyle = color;
                tCtx.fillRect(0, 0, sw, sh);
                
                tCtx.globalCompositeOperation = 'destination-in';
                tCtx.drawImage(img, 0, finalSy, sw, sh, 0, 0, sw, sh);
                
                eng.tintCache[cacheKey] = tCanvas;
              }
              sourceImg = eng.tintCache[cacheKey];
              finalSy = 0; 
            }
          } else {
            const patchX = Math.floor(gx / 6);
            const patchY = Math.floor(gy / 6);
            const patchHash = getHash(patchX, patchY);
            
            const baseIndex = Math.floor(patchHash * eng.grassVariations.length);
  
            const localHash = getHash(gx, gy);
            let variation = 0;
            if (localHash > 0.85) variation = 1;
            else if (localHash < 0.15) variation = -1;
  
            let finalIndex = baseIndex + variation;
            finalIndex = Math.max(0, Math.min(eng.grassVariations.length - 1, finalIndex));
            sourceImg = eng.grassVariations[finalIndex];
            sw = sourceImg.width || 64; 
            sh = sourceImg.height || 64;
            finalSy = 0;
          }
          
          if (sourceImg && (sourceImg.naturalWidth > 0 || sourceImg.width > 0)) {
            if (z > 0) {
              entitiesToDraw.push({
                sortVal: getBlockSortVal(gx, gy),
                isBlock: true,
                draw: () => {
                  ctx.save();
                  ctx.translate(pos.x - 32, pos.y - zOffset);
                  ctx.transform(32 / sw, 16 / sw, 0, 32 / sh, 0, 0);
                  for (let i = 0; i < z; i++) {
                    ctx.drawImage(sourceImg, 0, finalSy, sw, sh, 0, i * sh, sw, sh);
                  }
                  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; 
                  ctx.fillRect(0, 0, sw, z * sh);
                  ctx.restore();

                  ctx.save();
                  ctx.translate(pos.x, pos.y - zOffset + 16);
                  ctx.transform(32 / sw, -16 / sw, 0, 32 / sh, 0, 0);
                  for (let i = 0; i < z; i++) {
                    ctx.drawImage(sourceImg, 0, finalSy, sw, sh, 0, i * sh, sw, sh);
                  }
                  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'; 
                  ctx.fillRect(0, 0, sw, z * sh);
                  ctx.restore();

                  ctx.save();
                  ctx.translate(pos.x, pos.y - zOffset);
                  ctx.scale(1, eng.tilt);
                  ctx.rotate(45 * Math.PI / 180);
                  const size = tileW / Math.SQRT2;
                  if (img && img.alpha < 1.0) ctx.globalAlpha = img.alpha; 
                  ctx.drawImage(sourceImg, 0, finalSy, sw, sh, -size / 2, -size / 2, size + 0.5, size + 0.5);
                  ctx.restore();
                }
              });
            } else {
              ctx.save();
              ctx.translate(pos.x, pos.y);
              ctx.scale(1, eng.tilt);
              ctx.rotate(45 * Math.PI / 180);
              const size = tileW / Math.SQRT2;
              if (img && img.alpha < 1.0) ctx.globalAlpha = img.alpha; 
              ctx.drawImage(sourceImg, 0, finalSy, sw, sh, -size / 2, -size / 2, size + 0.5, size + 0.5);
              ctx.restore();
            }
          }
        }
      }
    } else {
      ctx.strokeStyle = '#1a2332';
      ctx.lineWidth = 2;
      const tileW = 64;
      const blockSize = 32;
      
      const camGridX = Math.floor(eng.camera.x / blockSize);
      const camGridY = Math.floor(eng.camera.y / blockSize);
      const radius = Math.ceil(Math.max(eng.canvas.width, eng.canvas.height / eng.tilt) / blockSize / 2) + 2;

      for (let gy = camGridY - radius; gy <= camGridY + radius; gy++) {
        for (let gx = camGridX - radius; gx <= camGridX + radius; gx++) {
          const pos = eng.getScreenPos(gx * blockSize, gy * blockSize);
          if (pos.x < -tileW || pos.x > eng.canvas.width + tileW || pos.y < -tileW || pos.y > eng.canvas.height + tileW) continue;

          ctx.beginPath();
          ctx.moveTo(pos.x, pos.y - (tileW * eng.tilt) / 2);
          ctx.lineTo(pos.x + tileW / 2, pos.y);
          ctx.lineTo(pos.x, pos.y + (tileW * eng.tilt) / 2);
          ctx.lineTo(pos.x - tileW / 2, pos.y);
          ctx.closePath();
          ctx.stroke();
        }
      }
    }

    if (eng.editMode && eng.selectedTiles.length > 0) {
      eng.selectedTiles.forEach(tile => {
        const key = `${tile.x},${tile.y}`;
        const td = eng.mapData[key];
        const z = td && td.z ? td.z : 0;
        const zOff = z * 32;
        entitiesToDraw.push({
          sortVal: getBlockSortVal(tile.x, tile.y) + 0.05,
          isBlock: false,
          draw: () => {
            if (z > 0) {
              drawTileHighlight(tile.x * 32, tile.y * 32, 'rgba(52, 152, 219, 0.05)', 'rgba(52, 152, 219, 0.4)', null, 0, true);
            }
            drawTileHighlight(tile.x * 32, tile.y * 32, 'rgba(52, 152, 219, 0.4)', '#3498db', null, zOff);
          }
        });
      });
    }

    if (eng.selectedTarget) {
      let tx, ty, tz;
      if (eng.selectedTarget.type === 'npc') {
        const npc = eng.npcs.find(n => n.uuid === eng.selectedTarget.id);
        if (npc && npc.state !== 'dead') { tx = npc.x; ty = npc.y; tz = npc.z; }
      } else if (eng.selectedTarget.type === 'player') {
        const op = eng.otherPlayers[eng.selectedTarget.id];
        if (op && op.state !== 'death') { tx = op.x; ty = op.y; tz = op.z; }
      } else if (eng.selectedTarget.type === 'self' && eng.player.state !== 'death') {
        tx = eng.player.x; ty = eng.player.y; tz = eng.player.z;
      }
      if (tx !== undefined) {
        entitiesToDraw.push({
          sortVal: getEntitySortVal({ x: tx, y: ty }) - 0.05,
          isBlock: false,
          draw: () => {
            drawIsoCircle(tx, ty, tz || 0, 30, '#ffffff', 0.15);
          }
        });
      }
    }

    if (eng.player.moveTarget) {
      const tx = eng.player.moveTarget.x;
      const ty = eng.player.moveTarget.y;
      const tz = eng.getTerrainZ(tx, ty);
      entitiesToDraw.push({
        sortVal: getEntitySortVal({ x: tx, y: ty }) - 0.05,
        isBlock: false,
        draw: () => {
          const pos = eng.getScreenPos(tx, ty, tz);
          const t = performance.now() / 400; // Continuous rotation
          
          ctx.save();
          ctx.translate(pos.x, pos.y);
          ctx.scale(1, eng.tilt);
          ctx.rotate(t);
          
          ctx.strokeStyle = '#00d2ff';
          ctx.lineWidth = 2;
          
          // Outer Rotating Dashed Circle
          ctx.setLineDash([8, 8]);
          ctx.beginPath();
          ctx.arc(0, 0, 16, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          
          // Inner Converging Pulse Lines
          const pulse = (performance.now() % 800) / 800; // Loops from 0.0 to 1.0
          const dist = 24 - (pulse * 12);
          ctx.globalAlpha = 1 - pulse; // Fades out as it collapses inward
          for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(Math.cos(i * Math.PI / 2) * dist, Math.sin(i * Math.PI / 2) * dist);
            ctx.lineTo(Math.cos(i * Math.PI / 2) * (dist - 6), Math.sin(i * Math.PI / 2) * (dist - 6));
            ctx.stroke();
          }
          ctx.restore();
        }
      });
    }

    entitiesToDraw.push({
      sortVal: getEntitySortVal(eng.player),
      isBlock: false,
      draw: () => {
        let playerState = eng.player.state;
        if (playerState === 'death') playerState = 'death';
        else if (eng.player.hurtTimer > 0) playerState = 'hurt';
        
        const spriteKey = `${playerState}_${eng.player.dir}`;
        const img = eng.sprites[spriteKey];
        if (img && img.complete && img.naturalWidth > 0) {
          const fw = 96; const fh = 90;
          const yOffset = 35;
          const pos = eng.getScreenPos(eng.player.x, eng.player.y, eng.player.z || 0);
          ctx.save();
          ctx.translate(pos.x, pos.y);
          ctx.scale(4, 4);
          ctx.drawImage(img, eng.player.frame * fw, 0, fw, fh, -fw / 2, -fh + yOffset, fw, fh);
          ctx.restore();

          if (eng.player.state !== 'death') {
            const barW = 80; const barH = 8;
            const hpPercent = Math.max(0, eng.player.hp / eng.player.maxHp);
            if (eng.clientSettings.showPlayerHealth) {
              ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
              ctx.fillRect(pos.x - barW / 2, pos.y - 156, barW, barH);
              ctx.fillStyle = '#2ecc71';
              ctx.fillRect(pos.x - barW / 2, pos.y - 156, barW * hpPercent, barH);
              ctx.strokeStyle = '#111';
              ctx.strokeRect(pos.x - barW / 2, pos.y - 156, barW, barH);
            }
  
            if (eng.clientSettings.showPlayerNames) {
              ctx.fillStyle = (eng.playerData.name && eng.playerData.name.toLowerCase() === 'tim') ? '#00d2ff' : '#fff';
              ctx.font = 'bold 14px monospace';
              ctx.textAlign = 'center';
              ctx.lineJoin = 'round';
              ctx.strokeStyle = '#000';
              ctx.lineWidth = 3;
              ctx.strokeText(`[${eng.playerData.name}]`, pos.x, pos.y - 171);
              ctx.fillText(`[${eng.playerData.name}]`, pos.x, pos.y - 171);
            }
          }

          if (eng.player.chatBubbles && eng.player.chatBubbles.length > 0) {
            eng.chat.drawBubbles(ctx, pos.x, pos.y - 206, eng.player.chatBubbles);
          }
        }
      }
    });

    Object.values(eng.otherPlayers).forEach(op => {
      entitiesToDraw.push({
        sortVal: getEntitySortVal(op),
        isBlock: false,
        draw: () => {
          const pos = eng.getScreenPos(op.x, op.y, op.z || 0);
          
          let opState = op.state;
          if (opState === 'death') opState = 'death';
          else if (op.hurtTimer > 0) opState = 'hurt';

          const spriteKey = `${opState}_${op.dir}`;
          const img = eng.sprites[spriteKey];
          if (img && img.complete && img.naturalWidth > 0) {
            const fw = 96; const fh = 90;
            const yOffset = 35;
            ctx.save();
            ctx.translate(pos.x, pos.y);
            ctx.scale(4, 4);
            ctx.drawImage(img, (op.frame || 0) * fw, 0, fw, fh, -fw / 2, -fh + yOffset, fw, fh);
            ctx.restore();
          }
          
          if (op.state !== 'death') {
            const barW = 80; const barH = 8;
            const maxHp = op.maxHp || 1000;
            const currentHp = op.hp !== undefined ? op.hp : 1000;
            const hpPercent = Math.max(0, currentHp / maxHp);
          if (eng.clientSettings.showPlayerHealth) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(pos.x - barW / 2, pos.y - 156, barW, barH);
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(pos.x - barW / 2, pos.y - 156, barW * hpPercent, barH);
            ctx.strokeStyle = '#111';
            ctx.strokeRect(pos.x - barW / 2, pos.y - 156, barW, barH);
          }
  
          if (eng.clientSettings.showPlayerNames) {
            ctx.fillStyle = (op.name.toLowerCase() === 'tim') ? '#00d2ff' : '#fff';
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.strokeText(`[${op.name}]`, pos.x, pos.y - 171);
            ctx.fillText(`[${op.name}]`, pos.x, pos.y - 171);
          }
          }
          
          if (op.chatBubbles && op.chatBubbles.length > 0) {
            eng.chat.drawBubbles(ctx, pos.x, pos.y - 206, op.chatBubbles);
          }
        }
      });
    });

    eng.npcs.forEach(npc => {
      entitiesToDraw.push({
        sortVal: getEntitySortVal(npc),
        isBlock: false,
        draw: () => {
          const pos = eng.getScreenPos(npc.x, npc.y, npc.z || 0);
          
          let npcState = 'idle';
          if (npc.state === 'dead') npcState = 'death';
          else if (npc.hurtTimer > 0) npcState = 'hurt';

          const img = eng.sprites[`${npcState}_${npc.dir || 'down'}`];
          if (img && img.complete && img.naturalWidth > 0) {
            const fw = 96; const fh = 90;
            const yOffset = 35;
            ctx.save();
            ctx.translate(pos.x, pos.y);
            ctx.scale(4, 4);
            ctx.drawImage(img, npc.frame * fw, 0, fw, fh, -fw / 2, -fh + yOffset, fw, fh);
            ctx.restore();
          }

          if (npc.state !== 'dead') {
            const barW = 80; const barH = 8;
            const hpPercent = Math.max(0, npc.hp / npc.maxHp);
            if (eng.clientSettings.showEntityHealth) {
              ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
              ctx.fillRect(pos.x - barW / 2, pos.y - 156, barW, barH);
              ctx.fillStyle = '#ff4757';
              ctx.fillRect(pos.x - barW / 2, pos.y - 156, barW * hpPercent, barH);
              ctx.strokeStyle = '#111';
              ctx.strokeRect(pos.x - barW / 2, pos.y - 156, barW, barH);
            }

            if (eng.clientSettings.showEntityNames) {
              ctx.fillStyle = '#fff';
              ctx.font = 'bold 14px monospace';
              ctx.textAlign = 'center';
              ctx.lineJoin = 'round';
              ctx.strokeStyle = '#000';
              ctx.lineWidth = 3;
              ctx.strokeText(npc.name, pos.x, pos.y - 171);
              ctx.fillText(npc.name, pos.x, pos.y - 171);
            }
          }
        }
      });
    });

    if (eng.clientSettings.showBaseplates) {
      const addBaseplate = (entity, color) => {
        entitiesToDraw.push({
          sortVal: getEntitySortVal(entity) - 0.08, // Draw baseplate strictly behind the entity!
          isBlock: false,
          draw: () => drawIsoCircle(entity.x, entity.y, entity.z || 0, 27.5, color, 0.2)
        });
      };
      addBaseplate(eng.player, '#2ecc71');
      Object.values(eng.otherPlayers).forEach(op => { if (op.state !== 'death') addBaseplate(op, '#3498db'); });
      eng.npcs.forEach(npc => { if (npc.state !== 'dead') addBaseplate(npc, '#ff4757'); });
    }

    entitiesToDraw.sort((a, b) => {
      if (a.sortVal === b.sortVal) return a.isBlock ? -1 : 1;
      return a.sortVal - b.sortVal;
    });
    entitiesToDraw.forEach(ent => ent.draw());

    if (eng.screenFade > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${eng.screenFade})`;
      ctx.fillRect(0, 0, eng.canvas.width, eng.canvas.height);
    }

    eng.floatingTexts.forEach(ft => {
      const pos = eng.getScreenPos(ft.x, ft.y);
      
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.life);
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      ctx.strokeText(ft.text, pos.x, pos.y - ft.offsetY);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, pos.x, pos.y - ft.offsetY);
      ctx.restore();
    });

    if (eng.devOptions.showChunk) {
      const chunkSize = 1024;
      const cx = Math.floor(eng.player.x / chunkSize);
      const cy = Math.floor(eng.player.y / chunkSize);
      
      const minX = cx * chunkSize;
      const minY = cy * chunkSize;
      const maxX = minX + chunkSize;
      const maxY = minY + chunkSize;

      const pNW = eng.getScreenPos(minX, minY);
      const pNE = eng.getScreenPos(maxX, minY);
      const pSE = eng.getScreenPos(maxX, maxY);
      const pSW = eng.getScreenPos(minX, maxY);

      ctx.save();
      ctx.strokeStyle = 'rgba(155, 89, 182, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(pNW.x, pNW.y);
      ctx.lineTo(pNE.x, pNE.y);
      ctx.lineTo(pSE.x, pSE.y);
      ctx.lineTo(pSW.x, pSW.y);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = 'rgba(155, 89, 182, 0.05)';
      ctx.fill();

      ctx.strokeStyle = '#2ecc71';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(pNW.x, pNW.y);
      ctx.lineTo(pNW.x, pNW.y - 300);
      ctx.stroke();
      
      ctx.fillStyle = '#2ecc71';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(0,0,0,0.9)';
      ctx.lineWidth = 4;
      ctx.strokeText(`Chunk [${cx}, ${cy}] NW`, pNW.x, pNW.y - 315);
      ctx.fillText(`Chunk [${cx}, ${cy}] NW`, pNW.x, pNW.y - 315);
      ctx.restore();
    }

    if (eng.devOptions.showMelee) {
      drawIsoCircle(eng.player.x, eng.player.y, eng.player.z || 0, 200, '#f39c12', 0.1);
    }

    if (eng.devOptions.showHitboxes) {
      ctx.lineWidth = 2;
      const drawRect = (entity, color) => {
        const pos = eng.getScreenPos(entity.x, entity.y, entity.z || 0);
        ctx.strokeStyle = color;
        ctx.strokeRect(pos.x - 30, pos.y - 145, 60, 180);
      };

      drawRect(eng.player, '#2ecc71');
      Object.values(eng.otherPlayers).forEach(op => { if (op.state !== 'death') drawRect(op, '#3498db'); });
      eng.npcs.forEach(npc => { if (npc.state !== 'dead') drawRect(npc, '#ff4757'); });
    }

    if (eng.devOptions.showPlayerTile) {
      if ((eng.player.z || 0) > 0) {
        drawTileHighlight(eng.player.x, eng.player.y, 'rgba(46, 204, 113, 0.05)', 'rgba(46, 204, 113, 0.4)', 'rgba(46, 204, 113, 0.8)', 0, true); 
      }
      drawTileHighlight(eng.player.x, eng.player.y, 'rgba(46, 204, 113, 0.2)', '#2ecc71', '#2ecc71', eng.player.z || 0, false);
    }

    if (eng.devOptions.showPlayerPos) {
      const drawPosDot = (z, isBase) => {
        const pPos = eng.getScreenPos(eng.player.x, eng.player.y, z);
        ctx.fillStyle = isBase ? 'rgba(255, 71, 87, 0.4)' : '#ff4757';
        ctx.fillRect(pPos.x - 2, pPos.y - 2, 4, 4);
        
        ctx.fillStyle = isBase ? 'rgba(255, 255, 255, 0.5)' : '#fff';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'left';
        ctx.lineJoin = 'round';
        const dispZ = isBase ? 0 : Math.round(z);
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.lineWidth = 3;
        ctx.strokeText(`X:${Math.round(eng.player.x)} Y:${Math.round(eng.player.y)} Z:${dispZ}`, pPos.x + 10, pPos.y);
        ctx.fillText(`X:${Math.round(eng.player.x)} Y:${Math.round(eng.player.y)} Z:${dispZ}`, pPos.x + 10, pPos.y);
      };

      if ((eng.player.z || 0) > 0) drawPosDot(0, true);
      drawPosDot(eng.player.z || 0, false);
    }

    if (eng.devOptions.showMousePos || eng.devOptions.showTile) {
      const ray = eng.getIsoRaycast(eng.input.mousePos.x, eng.input.mousePos.y);
      const worldX = ray.gx * 32;
      const worldY = ray.gy * 32;
      const zOff = ray.z * 32;

      if (eng.devOptions.showTile) {
        if (ray.z > 0) {
          drawTileHighlight(worldX, worldY, 'rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.4)', 'rgba(255, 255, 255, 0.8)', 0, true);
        }
        drawTileHighlight(worldX, worldY, 'rgba(255, 255, 255, 0.2)', '#fff', '#f1c40f', zOff, false);
      }
      
      if (eng.devOptions.showMousePos) {
        const drawMouseDot = (z, isBase) => {
          const mPos = eng.getScreenPos(ray.exactX, ray.exactY, z);
          ctx.fillStyle = isBase ? 'rgba(255, 71, 87, 0.4)' : '#ff4757';
          ctx.fillRect(mPos.x - 2, mPos.y - 2, 4, 4);
          
          ctx.fillStyle = isBase ? 'rgba(255, 255, 255, 0.5)' : '#fff';
          ctx.font = 'bold 14px monospace';
          ctx.textAlign = 'left';
          ctx.lineJoin = 'round';
          const dispZ = isBase ? 0 : Math.round(z / 32);
          ctx.strokeStyle = isBase ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.9)';
          ctx.lineWidth = 4;
          ctx.strokeText(`X:${Math.round(ray.exactX)} Y:${Math.round(ray.exactY)} Z:${dispZ}`, mPos.x + 10, mPos.y);
          ctx.fillText(`X:${Math.round(ray.exactX)} Y:${Math.round(ray.exactY)} Z:${dispZ}`, mPos.x + 10, mPos.y);
        };
        
        if (ray.z > 0) drawMouseDot(0, true);
        drawMouseDot(ray.z * 32, false);
      }
    }

    ctx.restore();
    if (eng.clientSettings.showMinimap && (!eng.mapOverlay || !eng.mapOverlay.active)) {
      eng.minimap.draw(ctx);
    }

    let overlayText = [];
    if (eng.clientSettings.showCoords) overlayText.push(`X: ${Math.round(eng.player.x)} | Y: ${Math.round(eng.player.y)} | Z: ${Math.round(eng.player.z || 0)}`);
    if (eng.clientSettings.showFPS) overlayText.push(`FPS: ${eng.fps}`);
    if (eng.clientSettings.showPing) overlayText.push(`Ping: ${eng.ping}ms`);

    if (overlayText.length > 0) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(20, 100, 200, overlayText.length * 20 + 10);
      ctx.fillStyle = '#00d2ff';
      ctx.font = '14px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      overlayText.forEach((text, idx) => ctx.fillText(text, 30, 105 + idx * 20));
    }
  }
}
