const DIRECTIONS = ['down-left', 'down', 'down-right', 'right', 'up-right', 'up', 'up-left', 'left'];

export class CombatManager {
  constructor(engine) {
    this.engine = engine;
  }

  closeNearbyDoors(px, py, pz) {
    const eng = this.engine;

    for (let dx = -64; dx <= 64; dx += 32) {
      for (let dy = -64; dy <= 64; dy += 32) {
        for (let dz = -64; dz <= 64; dz += 32) {
          const vx = Math.round((px + dx) / 32) * 32;
          const vy = Math.round((py + dy) / 32) * 32;
          const vz = Math.round((pz + dz) / 32) * 32;

          const voxel = eng.mapManager.getVoxelAt(vx, vy, vz);

          if (
            voxel &&
            voxel.shape &&
            voxel.shape.startsWith('door') &&
            voxel.shape.includes('_open')
          ) {
            voxel.shape = voxel.shape.replace('_open', '');
            eng.mapManager.setVoxelAt(vx, vy, vz, voxel);
          }
        }
      }
    }
  }

  toggleTravelPower(powerName) {
    const eng = this.engine;

    if (!eng.player.activePowers) eng.player.activePowers = [];
    const idx = eng.player.activePowers.indexOf(powerName);
    if (idx !== -1) {
      eng.player.activePowers.splice(idx, 1);
      if (powerName === 'super_speed') eng.player.superSpeedMult = 1.0;
    } else {
      eng.player.activePowers.push(powerName);
    }
    
    if (eng.ui && eng.ui.powerbar) eng.ui.powerbar.updatePowerbar();
  }

  triggerAttack() {
    const eng = this.engine;

    if (
      eng.player.state === 'dash' ||
      eng.player.state === 'death' ||
      (eng.player.actionTimer > 0 && eng.player.state !== 'jump') ||
      eng.player.isSitting
    ) return;

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

    this.closeNearbyDoors(px, py, pz);

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

    if (normalizedAngle < 0) {
      normalizedAngle += Math.PI * 2;
    }

    eng.player.dir =
      DIRECTIONS[Math.floor(normalizedAngle / (Math.PI / 4)) % 8];

    const facingAngle = Math.atan2(dy, dx);

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

        if (terrainZ >= pz + 64 && terrainZ >= tz + 64) {
          return false;
        }
      }

      return true;
    };

    const isCrit = Math.random() > 0.8;
    const dmg = isCrit ? 35 : 25;

    eng.npcs.forEach(npc => {
      if (npc.state !== 'dead') {
        if (checkHit(npc.x, npc.y, npc.z)) {
          if (npc.type === 'trainer') {
            const words = ['Miss', 'Dodge', 'Deflect'];

            const word =
              words[Math.floor(Math.random() * words.length)];

            eng.floatingTexts.push({
              x: npc.x,
              y: npc.y,
              offsetY: 90,
              rndX: (Math.random() - 0.5) * 50,
              rndY: (Math.random() - 0.5) * 40,
              text: word,
              life: 1.0,
              color: '#bdc3c7'
            });
          } else {
            eng.network.sendNpcHit({
              targetUuid: npc.uuid,
              damage: dmg,
              isCrit: isCrit
            });
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
          eng.network.sendPlayerHit({
            targetId: id,
            damage: dmg,
            isCrit: isCrit
          });
        }
      }
    }
  }

  triggerThrowAirplane() {
    const eng = this.engine;
    if (
      eng.player.state === 'dash' ||
      eng.player.state === 'death' ||
      (eng.player.actionTimer > 0 && eng.player.state !== 'jump') ||
      eng.player.isSitting
    ) return;

    if (eng.player.energy < 15) return;
    eng.player.energy -= 15;
    eng.ui.update();

    eng.player.state = 'throw_attack1';
    eng.player.frame = 0;
    eng.player.frameTimer = 0;
    eng.player.actionTimer = 7 * (eng.player.frameInterval / 2);

    const px = eng.player.x;
    const py = eng.player.y;
    const pz = eng.player.z || 0;

    this.closeNearbyDoors(px, py, pz);

    let targetX = px;
    let targetY = py;

    if (eng.mouseWorldPos) {
      targetX = eng.mouseWorldPos.x;
      targetY = eng.mouseWorldPos.y;
    }

    const dx = targetX - px;
    const dy = targetY - py;
    let angle = Math.atan2(dy, dx);
    let normalizedAngle = angle + Math.PI / 8;
    if (normalizedAngle < 0) normalizedAngle += Math.PI * 2;
    eng.player.dir = DIRECTIONS[Math.floor(normalizedAngle / (Math.PI / 4)) % 8];

    const isCrit = Math.random() > 0.8;
    
    if (!eng.myRecentThrows) eng.myRecentThrows = [];
    eng.myRecentThrows.push({ x: px, y: py, time: performance.now() });
    eng.myRecentThrows = eng.myRecentThrows.filter(t => performance.now() - t.time < 5000);

    eng.network.sendProjectile({
      senderId: eng.socket && eng.socket.id,
      startX: px, startY: py, startZ: pz + 24,
      targetX: targetX, targetY: targetY, targetZ: (eng.getTerrainZ(targetX, targetY) || 0) + 10,
      speed: 400,
      isAirplane: true,
      isCritLoop: isCrit,
      isCrit: isCrit,
      damage: isCrit ? 3 : 1
    });
  }

  triggerSmite() {
    const eng = this.engine;
    if (eng.selectedTarget) {
      let targetEntity = null;
      let targetId = null;
      
      if (eng.selectedTarget.type === 'npc') {
        targetEntity = eng.npcs.find(n => n.uuid === eng.selectedTarget.id);
        if (targetEntity) { targetId = targetEntity.uuid; eng.network.sendNpcHit({ targetUuid: targetId, damage: 9999, isCrit: true }); }
      } else if (eng.selectedTarget.type === 'player') {
        targetEntity = eng.otherPlayers[eng.selectedTarget.id];
        if (targetEntity) { targetId = eng.selectedTarget.id; eng.network.sendPlayerHit({ targetId: targetId, damage: 9999, isCrit: true }); }
      }
      
      if (targetEntity) {
        eng.floatingTexts.push({ x: targetEntity.x, y: targetEntity.y, offsetY: 90, rndX: (Math.random() - 0.5) * 50, rndY: (Math.random() - 0.5) * 40, text: 'SMITED', life: 2.0, color: '#f1c40f' });
        for (let i = 0; i < 30; i++) {
          eng.particles.push({ x: targetEntity.x + (Math.random() - 0.5) * 32, y: targetEntity.y + (Math.random() - 0.5) * 32, z: targetEntity.z + Math.random() * 64, vx: (Math.random() - 0.5) * 200, vy: (Math.random() - 0.5) * 200, vz: 100 + Math.random() * 200, life: 0.5 + Math.random() * 0.5, maxLife: 1.0, color: '#f1c40f', size: 3 + Math.random() * 4 });
        }
      }
    }
  }

  triggerTeleport() {
    const eng = this.engine;
    if (eng.targetingPower === 'teleport') {
      eng.targetingPower = null;
      eng.chat.addMessage('system', 'System', 'Teleport cancelled.');
      if (eng.canvas) eng.canvas.style.cursor = '';
      document.body.style.cursor = '';
      return;
    }
    eng.targetingPower = 'teleport';
    eng.chat.addMessage('system', 'System', 'Select a location to teleport.');
    if (eng.canvas) eng.canvas.style.cursor = 'crosshair';
    document.body.style.cursor = 'crosshair';
  }

  executeTeleport(targetX, targetY) {
    const eng = this.engine;
    if (eng.player.state === 'death' || eng.player.teleportTarget) return;

    if (eng.player.energy < 30) {
      eng.chat.addMessage('system', 'System', 'Not enough energy to teleport.');
      return;
    }
    eng.player.energy -= 30;
    eng.ui.update();

    eng.player.teleportTarget = { x: targetX, y: targetY, timer: 0.5 };
    eng.player.vx = 0;
    eng.player.vy = 0;
    eng.player.momentumX = 0;
    eng.player.momentumY = 0;
    eng.player.moveTarget = null;
  }
}
