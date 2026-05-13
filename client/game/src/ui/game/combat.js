export class CombatManager {
  constructor(engine) {
    this.engine = engine;
  }

  triggerAttack() {
    const eng = this.engine;
    
    if (eng.player.state === 'dash' || eng.player.state === 'death' || eng.player.actionTimer > 0) return;

    if (eng.player.energy < 20) return;
    eng.player.energy -= 20;
    eng.ui.update();

    eng.player.state = `attack${eng.player.nextAttack}`;
    eng.player.nextAttack = eng.player.nextAttack === 1 ? 2 : 1;
    eng.player.frame = 0;
    eng.player.frameTimer = 0;
    eng.player.actionTimer = 8 * eng.player.frameInterval; 

    const px = eng.player.x;
    const py = eng.player.y;
    const pz = eng.player.z || 0;

    let facingAngle = 0;
    if (eng.player.dir === 'up') facingAngle = -Math.PI * 0.75;
    else if (eng.player.dir === 'down') facingAngle = Math.PI * 0.25;
    else if (eng.player.dir === 'left') facingAngle = Math.PI * 0.75;
    else if (eng.player.dir === 'right') facingAngle = -Math.PI * 0.25;

    const fov = Math.PI / 3;

    const checkHit = (tx, ty, tz) => {
      tz = tz || 0;
      
      if (Math.abs(pz - tz) > 48) return false; 
      
      const dist = Math.hypot(tx - px, ty - py);
      if (dist > 200) return false;

      const angleToTarget = Math.atan2(ty - py, tx - px);
      let angleDiff = angleToTarget - facingAngle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      
      if (Math.abs(angleDiff) > fov) return false; 

      const steps = Math.ceil(dist / 16);
      for (let i = 1; i <= steps; i++) {
        const sampleX = px + ((tx - px) * (i / steps));
        const sampleY = py + ((ty - py) * (i / steps));
        const terrainZ = eng.getTerrainZ(sampleX, sampleY);
        
        if (terrainZ >= pz + 64 && terrainZ >= tz + 64) return false; 
      }

      return true;
    };

    const isCrit = Math.random() > 0.85;
    const dmg = isCrit ? 300 : 200;

    eng.npcs.forEach(npc => {
      if (npc.state !== 'dead' && npc.type !== 'trainer') {
        if (checkHit(npc.x, npc.y, npc.z)) {
          eng.socket.emit('npc_hit', { targetUuid: npc.uuid, damage: dmg, isCrit: isCrit });
        }
      }
    });

    for (let id in eng.otherPlayers) {
      const op = eng.otherPlayers[id];
      if (op.state !== 'death') {
        if (checkHit(op.x, op.y, op.z)) {
          eng.socket.emit('player_hit', { targetId: id, damage: dmg, isCrit: isCrit });
        }
      }
    }
  }

  triggerThrowAirplane() {
    const eng = this.engine;
    
    if (eng.player.state === 'dash' || eng.player.state === 'death' || eng.player.actionTimer > 0) return;

    if (eng.player.energy < 15) return;
    eng.player.energy -= 15;
    eng.ui.update();

    eng.player.state = 'throw_attack1';
    eng.player.frame = 0;
    eng.player.frameTimer = 0;
    eng.player.actionTimer = 8 * (eng.player.frameInterval / 8); 

    const px = eng.player.x;
    const py = eng.player.y;
    const pz = eng.player.z || 0;

    let tx, ty;
    let targetEntity = null;
    let wasAutoAim = false;

    if (eng.selectedTarget) {
      let stx, sty, stz;
      let sEntity = null;
      if (eng.selectedTarget.type === 'npc') {
        sEntity = eng.npcs.find(n => n.uuid === eng.selectedTarget.id);
      } else if (eng.selectedTarget.type === 'player') {
        sEntity = eng.otherPlayers[eng.selectedTarget.id];
      }
      
      if (sEntity && sEntity.state !== 'dead' && sEntity.state !== 'death') {
        stx = sEntity.x;
        sty = sEntity.y;
        stz = sEntity.z || 0;
        
        const pos = eng.getScreenPos(stx, sty, stz);
        const mouseDist = Math.hypot(eng.mousePos.x - pos.x, eng.mousePos.y - pos.y);
        
        
        if (mouseDist < 100) {
          targetEntity = sEntity;
          tx = stx;
          ty = sty;
          wasAutoAim = true;
        }
      }
    }

    if (!targetEntity) {
      const ray = eng.getIsoRaycast(eng.mousePos.x, eng.mousePos.y);
      tx = ray.exactX;
      ty = ray.exactY;
    }

        tx += (Math.random() - 0.5) * 50;
    ty += (Math.random() - 0.5) * 50;

    const dx = tx - px;
    const dy = ty - py;
    let dist = Math.hypot(dx, dy);
    if (dist < 1) dist = 1;

        const distanceMultiplier = 0.9 + Math.random() * 2.1;
    const finalDist = dist * distanceMultiplier;

    const finalTx = px + (dx / dist) * finalDist;
    const finalTy = py + (dy / dist) * finalDist;

    const screenDx = dx - dy;
    const screenDy = dx + dy;
    if (Math.abs(screenDy) > Math.abs(screenDx)) {
      eng.player.dir = screenDy > 0 ? 'down' : 'up';
    } else {
      eng.player.dir = screenDx > 0 ? 'right' : 'left';
    }

    let facingAngle = Math.atan2(dy, dx);

    const hitWidth = 45; 

    let hitTarget = null;
    let hitType = null;
    let closestDist = finalDist;

    
    const checkHit = (entity, type, id) => {
      if (entity.state === 'dead' || entity.state === 'death') return;
      const edx = entity.x - px;
      const edy = entity.y - py;
      const edist = Math.hypot(edx, edy);
      
      if (edist > finalDist || Math.abs(pz - (entity.z || 0)) > 48) return;

      const angleToEntity = Math.atan2(edy, edx);
      let angleDiff = angleToEntity - facingAngle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      
      const perpDist = Math.abs(edist * Math.sin(angleDiff));
      if (perpDist <= hitWidth && Math.cos(angleDiff) > 0) {
        let clear = true;
        const steps = Math.ceil(edist / 16);
        for (let i = 1; i <= steps; i++) {
           const sampleX = px + (edx * (i / steps));
           const sampleY = py + (edy * (i / steps));
           const terrainZ = eng.getTerrainZ(sampleX, sampleY);
           if (terrainZ >= pz + 64 && terrainZ >= (entity.z || 0) + 64) {
             clear = false; break;
           }
        }
        if (clear && edist < closestDist) {
          closestDist = edist;
          hitTarget = entity;
          hitType = type;
        }
      }
    };

    eng.npcs.forEach(npc => checkHit(npc, 'npc', npc.uuid));
    for (let id in eng.otherPlayers) {
      checkHit(eng.otherPlayers[id], 'player', id);
    }

    const destZ = hitTarget ? (hitTarget.z || 0) + 45 : eng.getTerrainZ(finalTx, finalTy);

        const blockSteps = Math.ceil(finalDist / 16);
    for (let i = 1; i <= blockSteps; i++) {
      const sampleX = px + (dx / dist) * finalDist * (i / blockSteps);
      const sampleY = py + (dy / dist) * finalDist * (i / blockSteps);
      const terrainZ = eng.getTerrainZ(sampleX, sampleY);
      
      const currentProjZ = (pz + 45) + ((destZ - (pz + 45)) * (i / blockSteps));
      
      if (terrainZ >= currentProjZ) {
        const bDist = finalDist * (i / blockSteps);
        if (bDist < closestDist) {
          closestDist = bDist;
          hitTarget = { x: sampleX, y: sampleY, z: currentProjZ };
          hitType = 'block';
        }
        break;
      }
    }

    eng.playSound('assets/audio/sfx/combat/throw_toss.mp3', 0.6);

    let targetX = hitTarget ? hitTarget.x : finalTx;
    let targetY = hitTarget ? hitTarget.y : finalTy;
    let targetZ;
    if (hitTarget) {
      targetZ = hitType === 'block' ? hitTarget.z : (hitTarget.z || 0) + 45;
    } else {
      targetZ = eng.getTerrainZ(finalTx, finalTy);
    }

    eng.projectiles.push({
      startX: px, startY: py, startZ: pz + 45, // Adding +45 casts from the chest instead of the feet
      x: px, y: py, z: pz + 45,
      targetX: targetX, targetY: targetY, targetZ: targetZ,
      speed: 400,
      distTravelled: 0,
      maxDist: Math.max(1, Math.hypot(targetX - px, targetY - py)),
      trail: true,
      trailColor: 'rgba(200, 230, 255, 0.6)',
      trailSize: 2.5,
      onHit: () => {
        if (hitTarget) {
          let hitSuccess = true;
          if (wasAutoAim && Math.random() > 0.75) hitSuccess = false;

          if (!hitSuccess) {
            eng.playSound('assets/audio/sfx/combat/throw_miss.mp3', 0.5);
            eng.floatingTexts.push({ x: hitTarget.x, y: hitTarget.y, offsetY: 204, rndX: (Math.random() - 0.5) * 50, rndY: (Math.random() - 0.5) * 40, text: 'Deflected', life: 1.0, color: '#bdc3c7' });
          } else if (hitType === 'npc' && hitTarget.type === 'trainer') {
            eng.playSound('assets/audio/sfx/combat/throw_miss.mp3', 0.5);
            const words = ['Miss', 'Dodge', 'Deflect'];
            const word = words[Math.floor(Math.random() * words.length)];
            eng.floatingTexts.push({ x: hitTarget.x, y: hitTarget.y, offsetY: 204, rndX: (Math.random() - 0.5) * 50, rndY: (Math.random() - 0.5) * 40, text: word, life: 1.0, color: '#bdc3c7' });
          } else if (hitType === 'npc') {
            const isCrit = Math.random() > 0.85;
            const dmg = isCrit ? Math.floor(Math.random() * 5) + 6 : Math.floor(Math.random() * 5) + 1;
            eng.playSound('assets/audio/sfx/combat/throw_hit.mp3', 0.6);
            eng.socket.emit('npc_hit', { targetUuid: hitTarget.uuid, damage: dmg, isCrit: isCrit });
          } else if (hitType === 'player' || hitType === 'block') {
            const isCrit = Math.random() > 0.85;
            eng.playSound('assets/audio/sfx/combat/throw_hit.mp3', 0.6);
            eng.floatingTexts.push({ x: hitTarget.x, y: hitTarget.y, offsetY: 204, rndX: (Math.random() - 0.5) * 50, rndY: (Math.random() - 0.5) * 40, text: isCrit ? 'Crit Bonk!' : 'Bonk', life: 1.0, color: isCrit ? '#f39c12' : '#fff' });
          }
        } else {
          eng.playSound('assets/audio/sfx/combat/throw_miss.mp3', 0.3);
        }
      }
    });
  }
}
