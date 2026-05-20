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
    eng.player.actionTimer = 7 * (eng.player.frameInterval / 2); 

    const px = eng.player.x;
    const py = eng.player.y;
    const pz = eng.player.z || 0;

    let targetX = px;
    let targetY = py;

    if (eng.mouseWorldPos) {
      const dx = eng.mouseWorldPos.x - px;
      const dy = eng.mouseWorldPos.y - py;
      const dist = Math.hypot(dx, dy) || 1;
      targetX = px + (dx / dist) * 100;
      targetY = py + (dy / dist) * 100;
    }

    const dx = targetX - px;
    const dy = targetY - py;

    let angle = Math.atan2(dy, dx);
    let normalizedAngle = angle + Math.PI / 8;
    if (normalizedAngle < 0) normalizedAngle += Math.PI * 2;
    const dirs = ['down-left', 'down', 'down-right', 'right', 'up-right', 'up', 'up-left', 'left'];
    eng.player.dir = dirs[Math.floor(normalizedAngle / (Math.PI / 4)) % 8];

    let facingAngle = Math.atan2(dy, dx);

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
    const dmg = isCrit ? 35 : 25;

    eng.npcs.forEach(npc => {
      if (npc.state !== 'dead') {
        if (checkHit(npc.x, npc.y, npc.z)) {
          if (npc.type === 'trainer') {
            const words = ['Miss', 'Dodge', 'Deflect'];
            const word = words[Math.floor(Math.random() * words.length)];
            eng.floatingTexts.push({ x: npc.x, y: npc.y, offsetY: 90, rndX: (Math.random() - 0.5) * 50, rndY: (Math.random() - 0.5) * 40, text: word, life: 1.0, color: '#bdc3c7' });
          } else {
            eng.network.sendNpcHit({ targetUuid: npc.uuid, damage: dmg, isCrit: isCrit });
          }
        }
      }
    });

    const myAlignment = eng.playerData.alignment || 'hero';
    for (let id in eng.otherPlayers) {
      const op = eng.otherPlayers[id];
      if (op.state !== 'death') {
        const opAlignment = op.alignment || 'hero';
        if (myAlignment === 'hero' && opAlignment === 'hero') continue;

        if (checkHit(op.x, op.y, op.z)) {
          eng.network.sendPlayerHit({ targetId: id, damage: dmg, isCrit: isCrit });
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
    eng.player.actionTimer = 2.5 * eng.player.frameInterval; 

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
      if (eng.mouseWorldPos) {
        const dx = eng.mouseWorldPos.x - px;
        const dy = eng.mouseWorldPos.y - py;
        const dist = Math.hypot(dx, dy) || 1;
        tx = px + (dx / dist) * 400; // Project 400 units outward in the calculated direction
        tx = px + (dx / dist) * 400;
        ty = py + (dy / dist) * 400;
      } else {
        tx = px + 400;
        ty = py;
      }
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

    let angle = Math.atan2(dy, dx);
    let normalizedAngle = angle + Math.PI / 8;
    if (normalizedAngle < 0) normalizedAngle += Math.PI * 2;
    const dirIndex = Math.floor(normalizedAngle / (Math.PI / 4)) % 8;
    const dirs = ['down-left', 'down', 'down-right', 'right', 'up-right', 'up', 'up-left', 'left'];
    eng.player.dir = dirs[dirIndex];

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
           hitTarget.targetId = id;
          hitType = type;
        }
      }
    };

    eng.npcs.forEach(npc => checkHit(npc, 'npc', npc.uuid));
    for (let id in eng.otherPlayers) {
      checkHit(eng.otherPlayers[id], 'player', id);
    }

    const destZ = hitTarget ? (hitTarget.z || 0) + 30 : eng.getTerrainZ(finalTx, finalTy) + 30;

        const blockSteps = Math.ceil(finalDist / 16);
    for (let i = 1; i <= blockSteps; i++) {
      const sampleX = px + (dx / dist) * finalDist * (i / blockSteps);
      const sampleY = py + (dy / dist) * finalDist * (i / blockSteps);
      const terrainZ = eng.getTerrainZ(sampleX, sampleY);
      
      const currentProjZ = (pz + 30) + ((destZ - (pz + 30)) * (i / blockSteps));
      
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

    let targetX = hitTarget ? hitTarget.x : finalTx;
    let targetY = hitTarget ? hitTarget.y : finalTy;
    let targetZ;
    if (hitTarget) {
      targetZ = hitType === 'block' ? hitTarget.z : (hitTarget.z || 0) + 30;
    } else {
      targetZ = eng.getTerrainZ(finalTx, finalTy) + 30;
    }

    const isCritLoop = Math.random() <= 0.25;

    eng.network.sendProjectile({
      isAirplane: true,
      isCritLoop: isCritLoop,
      startX: px, startY: py, startZ: pz + 30,
      targetX: targetX, targetY: targetY, targetZ: targetZ,
      speed: 400
    });

    eng.projectiles.push({
      isAirplane: true,
      isCritLoop: isCritLoop,
      startX: px, startY: py, startZ: pz + 30, // Adjusted from 45 to 30 to hit 1-block walls but clear slopes
      startX: px, startY: py, startZ: pz + 30,
      x: px, y: py, z: pz + 30,
      targetX: targetX, targetY: targetY, targetZ: targetZ,
      speed: 400,
      distTravelled: 0,
      maxDist: Math.max(1, Math.hypot(targetX - px, targetY - py)),
      trail: true,
      trailColor: 'rgba(200, 230, 255, 0.6)',
      trailSize: 2.5,
      onHit: () => {
        if (hitTarget) {
          if (hitType === 'npc' && hitTarget.type === 'trainer') {
            const words = ['Miss', 'Dodge', 'Deflect'];
            const word = words[Math.floor(Math.random() * words.length)];
            eng.floatingTexts.push({ x: hitTarget.x, y: hitTarget.y, offsetY: 90, rndX: (Math.random() - 0.5) * 50, rndY: (Math.random() - 0.5) * 40, text: word, life: 1.0, color: '#bdc3c7' });
          } else if (hitType === 'npc') {
            const dmg = isCritLoop ? Math.floor(Math.random() * 2) + 3 : Math.floor(Math.random() * 2) + 1;
            eng.network.sendNpcHit({ targetUuid: hitTarget.uuid || hitTarget.targetId, damage: dmg, isCrit: isCritLoop });
          } else if (hitType === 'player' || hitType === 'block') {
            const dmg = isCritLoop ? Math.floor(Math.random() * 2) + 3 : Math.floor(Math.random() * 2) + 1;
            eng.floatingTexts.push({ x: hitTarget.x, y: hitTarget.y, offsetY: 90, rndX: (Math.random() - 0.5) * 50, rndY: (Math.random() - 0.5) * 40, text: isCritLoop ? 'Crit Bonk!' : 'Bonk', life: 1.0, color: isCritLoop ? '#f39c12' : '#fff' });
            if (hitType === 'player' && hitTarget.targetId) {
              eng.network.sendPlayerHit({ targetId: hitTarget.targetId, damage: dmg, isCrit: isCritLoop });
            }
          }
        }
        
        eng.debris.push({
          x: targetX, y: targetY, z: targetZ,
          vx: (Math.random() - 0.5) * 150,
          vy: (Math.random() - 0.5) * 150,
          vz: 100 + Math.random() * 150,
          life: 5.0,
          maxLife: 5.0,
          crumpleTimer: 0.3,
          wasteTex: Math.random() > 0.5 ? 'waste_1' : 'waste_2',
          rotation: Math.random() * Math.PI * 2
        });
      }
    });
  }
}
