import { getBlockProps } from './blocks.js?v=new-engine-311';

const DIRECTIONS = ['down-left', 'down', 'down-right', 'right', 'up-right', 'up', 'up-left', 'left'];

export class EntityManager {
  constructor(engine) {
    this.engine = engine;
  }

  getFrameCount(state) {
    if (!state) return 8;
    if (state === 'idle' || state === 'fly-idle') return 12;
    if (state.startsWith('attack') || state.startsWith('throw_attack')) return 7;
    return 8; // walk, run, dash, jump, hurt, death
  }

  update(dt) {
    const updateBubbles = (entity) => {
      
      if (entity.chatBubble) {
        if (!entity.chatBubbles) entity.chatBubbles = [];
        entity.chatBubbles.push({ text: entity.chatBubble.text, timer: 4000, opacity: 0 });
        delete entity.chatBubble;
      }
      if (!entity.chatBubbles) return;
      for (let i = entity.chatBubbles.length - 1; i >= 0; i--) {
        const b = entity.chatBubbles[i];
        b.timer -= dt;
        
                if (b.timer > 0 && b.opacity < 1) b.opacity = Math.min(1, b.opacity + dt / 150);
        else if (b.timer <= 0) b.opacity -= dt / 300;
        
                if (b.currentY === undefined) b.currentY = b.targetY || 0;
        b.currentY += ((b.targetY || 0) - b.currentY) * 15 * (dt / 1000);
        
        if (b.opacity <= 0) entity.chatBubbles.splice(i, 1);
      }
    };

    updateBubbles(this.engine.player);
    for (let id in this.engine.otherPlayers) updateBubbles(this.engine.otherPlayers[id]);

    this.updatePlayer(dt);
    this.updateNpcs(dt);
    this.updateOtherPlayers(dt);
  }

  updatePlayer(dt) {
    const eng = this.engine;
    const player = eng.player;

    if (player.teleportTarget) {
      player.teleportTarget.timer -= dt / 1000;
      
      for (let i = 0; i < 8; i++) {
          eng.particles.push({
              x: player.x + (Math.random() - 0.5) * 32,
              y: player.y + (Math.random() - 0.5) * 32,
              z: (player.z || 0) + Math.random() * 64,
              vx: (Math.random() - 0.5) * 80,
              vy: (Math.random() - 0.5) * 80,
              vz: 50 + Math.random() * 100,
              noGravity: true,
              life: 0.2 + Math.random() * 0.3,
              maxLife: 0.5,
              color: '#9b59b6',
              size: 2 + Math.random() * 4
          });
      }

      if (player.teleportTarget.timer <= 0) {
          const targetX = player.teleportTarget.x;
          const targetY = player.teleportTarget.y;
          const targetZ = eng.getTerrainZ(targetX, targetY);
          
          player.x = targetX;
          player.y = targetY;
          player.z = targetZ;
          eng.camera.x = player.x;
          eng.camera.y = player.y;

          for (let i = 0; i < 60; i++) {
              eng.particles.push({
                  x: targetX + (Math.random() - 0.5) * 40,
                  y: targetY + (Math.random() - 0.5) * 40,
                  z: targetZ + Math.random() * 80,
                  vx: (Math.random() - 0.5) * 300,
                  vy: (Math.random() - 0.5) * 300,
                  vz: (Math.random() - 0.5) * 300,
                  life: 0.3 + Math.random() * 0.4,
                  maxLife: 0.7,
                  color: '#8e44ad',
                  size: 3 + Math.random() * 5
              });
          }
          for (let i = 0; i < 40; i++) {
             const angle = (i / 40) * Math.PI * 2;
             eng.particles.push({
                 x: targetX,
                 y: targetY,
                 z: targetZ + 5,
                 vx: Math.cos(angle) * 500,
                 vy: Math.sin(angle) * 500,
                 vz: 0,
                 life: 0.4,
                 maxLife: 0.4,
                 color: '#9b59b6',
                 size: 6
             });
          }

          player.teleportTarget = null;
      }
    }

    if (player.actionTimer > 0) {
      player.actionTimer -= dt;
      if (player.actionTimer <= 0) {
        if (player.state !== 'death') player.state = 'idle';
      }
    }

    if (player.hurtTimer > 0) player.hurtTimer -= dt;

    if (player.state !== 'death' && player.hp < player.maxHp) {
      const integrity = eng.playerData.integrity || 0;
      if (integrity === 0) {
        player.hp += 1 * (dt / 1000);
        if (player.hp > player.maxHp) player.hp = player.maxHp;
        eng.ui.update();
      }
    }

    if (player.energy < player.maxEnergy) {
      player.energy += 50 * (dt / 1000);
      if (player.energy > player.maxEnergy) player.energy = player.maxEnergy;
      if (player.state !== 'death') eng.ui.update();
    }

    let screenDx = 0; let screenDy = 0;
    let isPressingShift = false;
    let isPressingSpace = false;

    if (player.state === 'death') {
      eng.screenFade = Math.min(1.0, eng.screenFade + (dt / 3000));
      player.respawnTimer -= dt;
      if (player.respawnTimer <= 0) {
        player.state = 'idle';
        player.hp = player.maxHp;
        player.frame = 0;
        const mapCenter = (128 * 32) / 2;
        player.x = mapCenter + (Math.random() - 0.5) * 300;
        player.y = mapCenter + (Math.random() - 0.5) * 300;
        player.z = eng.getTerrainZ(player.x, player.y) + 45;
        eng.camera.x = player.x;
        eng.camera.y = player.y;
        eng.ui.update();
        eng.chat.addMessage('system', 'System', 'You have respawned!');
        eng.lastEmit.state = 'respawning';
      }
    } else {
      if (eng.screenFade > 0) eng.screenFade = Math.max(0, eng.screenFade - (dt / 2000));

      if (player.isSitting && (eng.keys['w'] || eng.keys['s'] || eng.keys['a'] || eng.keys['d'] || eng.keys[' '])) {
         player.isSitting = false;
         if (player.preSitPos) {
           player.x = player.preSitPos.x;
           player.y = player.preSitPos.y;
           player.z = player.preSitPos.z;
           if (eng.checkCollision(player.x, player.y, player.z)) {
              eng.findSafeSpawn();
           }
           eng.camera.x = player.x;
           eng.camera.y = player.y;
           player.preSitPos = null;
         }
      }

      const camSens = eng.clientSettings.cameraSensitivity !== undefined ? eng.clientSettings.cameraSensitivity : 120;
      const invertCam = eng.clientSettings.invertCameraRotation ? -1 : 1;
      if (eng.keys['q']) {
        if (eng.renderer && eng.renderer.rotateCamera) eng.renderer.rotateCamera(-camSens * invertCam * (dt / 1000));
      }
      if (eng.keys['e']) {
        if (eng.renderer && eng.renderer.rotateCamera) eng.renderer.rotateCamera(camSens * invertCam * (dt / 1000));
      }

      if (player.isSitting || player.teleportTarget) {
         screenDx = 0; screenDy = 0;
         isPressingShift = false; isPressingSpace = false;
         player.vx = 0; player.vy = 0;
         player.momentumX = 0; player.momentumY = 0;
         player.state = player.teleportTarget ? player.state : 'idle'; 
         player.frame = player.teleportTarget ? player.frame : 0;
      } else {
         if (eng.keys['w']) screenDy -= 1;
         if (eng.keys['s']) screenDy += 1;
         if (eng.keys['a']) screenDx -= 1;
         if (eng.keys['d']) screenDx += 1;
         isPressingShift = eng.clientSettings.alwaysSprint ? !eng.keys['shift'] : !!eng.keys['shift'];
         isPressingSpace = eng.keys[' '];
      }
    }

    player.vx = 0;
    player.vy = 0;

    if (screenDx !== 0 || screenDy !== 0) {
      player.moveTarget = null;
      
      const camAngle = eng.renderer ? (eng.renderer.cameraAngle || 0) : 0;
      const totalRotation = -Math.PI / 4 + (camAngle * Math.PI / 180);

      const length = Math.sqrt(screenDx * screenDx + screenDy * screenDy);
      const nx = -screenDx / length;
      const ny = screenDy / length;

      player.vx = nx * Math.cos(totalRotation) - ny * Math.sin(totalRotation);
      player.vy = nx * Math.sin(totalRotation) + ny * Math.cos(totalRotation);
    } else if (player.moveTarget) {
      player.moveTarget.timer -= (dt / 1000);
      if (player.moveTarget.timer <= 0) {
        player.moveTarget = null;
      } else {
        const dist = Math.hypot(player.moveTarget.x - player.x, player.moveTarget.y - player.y);
        if (dist < 5) {
          player.moveTarget = null;
        } else {
          player.vx = player.moveTarget.x - player.x;
          player.vy = player.moveTarget.y - player.y;
          if (player.moveTarget.sprint) isPressingShift = true;
        }
      }
    }

    const isMoving = player.vx !== 0 || player.vy !== 0;
    let speed = player.speed;

    if (isPressingShift && !player.wasPressingShift && isMoving && player.actionTimer <= 0) {
      if (player.energy >= 50) {
        player.energy -= 50;
        eng.ui.update();
        player.state = 'dash';
        player.frame = 0;
        player.frameTimer = 0;
        player.actionTimer = 400;
      }
    }
    player.wasPressingShift = isPressingShift;

    if (player.wasInWater) {
      if (isPressingSpace) {
        player.vz = (player.vz || 0) + 1200 * (dt / 1000); // Smooth swim force
        if (player.vz > 200) player.vz = 200; // Terminal swim up velocity
      }
    } else {
      if (isPressingSpace && player.actionTimer <= 0) {
        const targetZ = eng.getTerrainZ(player.x, player.y);
        if (player.energy >= 25 && (player.z || 0) <= targetZ + 1) {
          player.energy -= 25;
          eng.ui.update();
          player.state = 'jump';
          player.frame = 0;
          player.frameTimer = 0;
          player.actionTimer = 4 * player.frameInterval;
          player.vz = (player.activePowers && player.activePowers.includes('super_jump')) ? 900 : 450;
        }
      }
    }
    player.wasPressingSpace = isPressingSpace;

    if (player.state === 'death' || player.teleportTarget) {
      speed = 0;
    } else {
      if (isMoving) {
        speed = isPressingShift ? player.runSpeed : player.speed;
        
        if (player.activePowers && player.activePowers.includes('super_speed')) {
          player.superSpeedMult = Math.min(4.0, (player.superSpeedMult || 1.0) + (dt / 1000) * 1.75);
          speed *= player.superSpeedMult;

          const particleCount = Math.floor(player.superSpeedMult);
          for (let p = 0; p < particleCount; p++) {
            if (Math.random() > 0.2) {
              eng.particles.push({
                x: player.x + (Math.random() - 0.5) * 16,
                y: player.y + (Math.random() - 0.5) * 16,
                z: (player.z || 0) + 2,
                vx: -(player.momentumX || 0) * 0.1 + (Math.random() - 0.5) * 50,
                vy: -(player.momentumY || 0) * 0.1 + (Math.random() - 0.5) * 50,
                vz: 10 + Math.random() * 40,
                life: 0.2 + Math.random() * 0.3,
                maxLife: 0.5,
                color: '#f1c40f',
                size: 2 + Math.random() * 4
              });
            }
          }
        } else {
          player.superSpeedMult = 1.0;
        }

        if (player.wasInWater) speed *= 0.4; // Wading/swimming penalty
        else if (eng.mapManager) {
          const currentGridZ = Math.round((player.z || 0) / 32);
          for (let offset = 0; offset >= -1; offset--) {
            const v = eng.mapManager.getVoxelAt(player.x, player.y, (currentGridZ + offset) * 32);
            if (v) {
              const props = getBlockProps(v.tex);
              if (props.isSolid) {
                if (props.speedMultiplier) speed *= props.speedMultiplier;
                break;
              }
            }
          }
        }
      } else {
        speed = 0;
        player.superSpeedMult = 1.0;
      }

      if (player.actionTimer > 0) {
        if (player.state === 'dash') {
          speed = player.runSpeed * 1.5;
          if (player.wasInWater) speed *= 0.4;
        }
      } else {
        if (player.isSitting) {
          player.state = 'idle';
        } else if (player.activePowers && player.activePowers.includes('fly')) {
          player.state = isMoving ? 'fly' : 'fly-idle';
        } else {
          player.state = isMoving ? (isPressingShift ? 'run' : 'walk') : 'idle';
        }
      }
    }

    
    let groundTex = null;
    const groundZ = eng.getTerrainZ(player.x, player.y, player.z, true);
    if (groundZ > -96) {
      for (let zOffset = 1; zOffset >= -1; zOffset--) {
        const checkZ = Math.floor(groundZ / 32) + zOffset;
        const v = eng.mapManager.getVoxelAt(player.x, player.y, checkZ * 32);
        if (v) {
          const props = getBlockProps(v.tex);
          if (props.isSolid) {
            const top = eng.getVoxelTop(v, checkZ, player.x, player.y);
            if (Math.abs(top - groundZ) < 0.5) {
              groundTex = v.tex;
              break;
            }
          }
        }
      }
    }
    
    let targetVx = 0;
    let targetVy = 0;
    if (isMoving && speed > 0) {
      const len = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
      targetVx = (player.vx / len) * speed;
      targetVy = (player.vy / len) * speed;
    }

    if (player.momentumX === undefined) player.momentumX = 0;
    if (player.momentumY === undefined) player.momentumY = 0;

    
    if (groundTex === 'ice') {
      
      
      const slopeCheckDist = 5;
      const zNorth = eng.getTerrainZ(player.x, player.y - slopeCheckDist, player.z, true);
      const zSouth = eng.getTerrainZ(player.x, player.y + slopeCheckDist, player.z, true);
      const zEast = eng.getTerrainZ(player.x + slopeCheckDist, player.y, player.z, true);
      const zWest = eng.getTerrainZ(player.x - slopeCheckDist, player.y, player.z, true);

      if (zNorth > -96 && zSouth > -96 && zEast > -96 && zWest > -96) {
        const gradX = zEast - zWest;
        const gradY = zSouth - zNorth;

        if (Math.abs(gradX) > 0.1 || Math.abs(gradY) > 0.1) {
          const gradLen = Math.hypot(gradX, gradY);
          if (gradLen > 0.1) {
            const slopeForce = 600; 
            player.momentumX -= (gradX / gradLen) * slopeForce * (dt / 1000);
            player.momentumY -= (gradY / gradLen) * slopeForce * (dt / 1000);
          }
        }
      }

      
      if (isMoving) {
        const accel = 450; 
        if (player.momentumX < targetVx) player.momentumX = Math.min(targetVx, player.momentumX + accel * (dt / 1000));
        else if (player.momentumX > targetVx) player.momentumX = Math.max(targetVx, player.momentumX - accel * (dt / 1000));
        
        if (player.momentumY < targetVy) player.momentumY = Math.min(targetVy, player.momentumY + accel * (dt / 1000));
        else if (player.momentumY > targetVy) player.momentumY = Math.max(targetVy, player.momentumY - accel * (dt / 1000));
      }

      
      const friction = 100; 
      let currentSpeed = Math.hypot(player.momentumX, player.momentumY);
      if (currentSpeed > 0) {
        const frictionEffect = friction * (dt / 1000);
        if (currentSpeed < frictionEffect) {
          player.momentumX = 0;
          player.momentumY = 0;
        } else {
          player.momentumX -= (player.momentumX / currentSpeed) * frictionEffect;
          player.momentumY -= (player.momentumY / currentSpeed) * frictionEffect;
        }
      }

      
      const maxIceSpeed = speed * 1.6;
      currentSpeed = Math.hypot(player.momentumX, player.momentumY);
      if (currentSpeed > maxIceSpeed) {
        player.momentumX = (player.momentumX / currentSpeed) * maxIceSpeed;
        player.momentumY = (player.momentumY / currentSpeed) * maxIceSpeed;
      }
    } else {
      player.momentumX = targetVx;
      player.momentumY = targetVy;
    }

    if (Math.hypot(player.momentumX, player.momentumY) < 5) {
      player.momentumX = 0;
      player.momentumY = 0;
    }

    const totalMoveX = player.momentumX * (dt / 1000);
    const totalMoveY = player.momentumY * (dt / 1000);
    const isEffectivelyMoving = Math.hypot(player.momentumX, player.momentumY) > 10;
    player.doorPushedThisFrame = false;

    if (isEffectivelyMoving) {
      let nextX = player.x + totalMoveX;
      let nextY = player.y + totalMoveY;
      const maxMapSize = 127 * 32;

      if (nextX < 0) { nextX = 0; player.momentumX = 0; }
      if (nextX > maxMapSize) { nextX = maxMapSize; player.momentumX = 0; }
      if (nextY < 0) { nextY = 0; player.momentumY = 0; }
      if (nextY > maxMapSize) { nextY = maxMapSize; player.momentumY = 0; }

      const finalMoveX = nextX - player.x;
      const finalMoveY = nextY - player.y;

      if (!eng.checkCollision(player.x + finalMoveX, player.y, player.z || 0)) {
        player.x += finalMoveX;
      }

      if (!eng.checkCollision(player.x, player.y + finalMoveY, player.z || 0)) {
        player.y += finalMoveY;
      }

      if (!player.state.startsWith('attack') && !player.state.startsWith('throw_attack')) {
        const angle = Math.atan2(totalMoveY, totalMoveX);
        let normalizedAngle = angle + Math.PI / 8;
        if (normalizedAngle < 0) normalizedAngle += Math.PI * 2;
        const dirIndex = Math.floor(normalizedAngle / (Math.PI / 4)) % 8;
        player.dir = DIRECTIONS[dirIndex];
      }
    }
    
    if (!player.doorPushedThisFrame) {
      player.doorPushTimer = 0;
    }

    if (groundTex === 'ice' && isEffectivelyMoving && Math.random() > 0.4) {
      eng.particles.push({
        x: player.x + (Math.random() - 0.5) * 16,
        y: player.y + (Math.random() - 0.5) * 16,
        z: (player.z || 0) - 8,
        vx: -player.momentumX * 0.15 + (Math.random() - 0.5) * 30,
        vy: -player.momentumY * 0.15 + (Math.random() - 0.5) * 30,
        vz: 10 + Math.random() * 20,
        life: 0.15 + Math.random() * 0.15,
        maxLife: 0.3,
        color: '#e0f7fa', 
        size: 1 + Math.random() * 1.5
      });
    }

    if (!isMoving && isEffectivelyMoving && player.actionTimer <= 0) {
      player.state = 'walk';
    }

    player.frameTimer += dt;
    let currentInterval = player.frameInterval;
    if (player.state === 'death') currentInterval *= 3;
    else if (player.state.startsWith('throw_attack')) currentInterval /= 2;
    else if (player.state.startsWith('attack')) currentInterval /= 2;
    if (player.frameTimer >= currentInterval) {
      player.frameTimer = 0;
      const maxFrames = this.getFrameCount(player.state);
      if (player.state === 'death') {
        if (player.frame < maxFrames - 1) player.frame++;
      } else {
        player.frame = (player.frame + 1) % maxFrames;
      }
    }
  }

  updateNpcs(dt) {
    this.engine.npcs.forEach(npc => {
      if (npc.hurtTimer > 0) npc.hurtTimer -= dt;
      npc.frameTimer += dt;
      let npcInterval = this.engine.player.frameInterval;
      if (npc.state === 'death') npcInterval *= 3;
      else if (npc.state && npc.state.startsWith('throw_attack')) npcInterval /= 2;
      else if (npc.state && npc.state.startsWith('attack')) npcInterval /= 2;
      if (npc.frameTimer >= npcInterval) {
        npc.frameTimer = 0;
        const maxFrames = this.getFrameCount(npc.state);
        if (npc.state === 'dead') {
          if (npc.frame < maxFrames - 1) npc.frame++;
        } else {
          npc.frame = (npc.frame + 1) % maxFrames;
        }
      }
    });
  }

  updateOtherPlayers(dt) {
    Object.values(this.engine.otherPlayers).forEach(op => {
      if (op.hurtTimer > 0) op.hurtTimer -= dt;
      op.frameTimer = (op.frameTimer || 0) + dt;
      let opInterval = this.engine.player.frameInterval;
      if (op.state === 'death') opInterval *= 3;
      else if (op.state && op.state.startsWith('throw_attack')) opInterval /= 2;
      else if (op.state && op.state.startsWith('attack')) opInterval /= 2;
      if (op.frameTimer >= opInterval) {
        op.frameTimer = 0;
        const maxFrames = this.getFrameCount(op.state || 'idle');
        if (op.state === 'death') {
          if ((op.frame || 0) < maxFrames - 1) op.frame = (op.frame || 0) + 1;
        } else {
          op.frame = ((op.frame || 0) + 1) % maxFrames;
        }
      }
      
      if (op.activePowers && op.activePowers.includes('super_speed') && (op.state === 'run' || op.state === 'dash')) {
         if (Math.random() > 0.4) {
             this.engine.particles.push({
                x: op.x + (Math.random() - 0.5) * 16,
                y: op.y + (Math.random() - 0.5) * 16,
                z: (op.z || 0) + 2,
                vx: (Math.random() - 0.5) * 50,
                vy: (Math.random() - 0.5) * 50,
                vz: 10 + Math.random() * 40,
                life: 0.2 + Math.random() * 0.3,
                maxLife: 0.5,
                color: '#f1c40f',
                size: 2 + Math.random() * 4
             });
         }
      }
    });
  }
}