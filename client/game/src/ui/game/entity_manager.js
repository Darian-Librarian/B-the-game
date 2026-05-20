import { getBlockProps } from './blocks.js?v=new-engine-240';

export class EntityManager {
  constructor(engine) {
    this.engine = engine;
  }

  getFrameCount(state) {
    if (!state) return 8;
    if (state === 'idle') return 12;
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
      if (eng.keys['w']) screenDy -= 1;
      if (eng.keys['s']) screenDy += 1;
      if (eng.keys['a']) screenDx -= 1;
      if (eng.keys['d']) screenDx += 1;
      const camSens = eng.clientSettings.cameraSensitivity !== undefined ? eng.clientSettings.cameraSensitivity : 120;
      const invertCam = eng.clientSettings.invertCameraRotation ? -1 : 1;
      if (eng.keys['q']) {
        if (eng.renderer && eng.renderer.rotateCamera) eng.renderer.rotateCamera(-camSens * invertCam * (dt / 1000));
      }
      if (eng.keys['e']) {
        if (eng.renderer && eng.renderer.rotateCamera) eng.renderer.rotateCamera(camSens * invertCam * (dt / 1000));
      }
      isPressingShift = eng.clientSettings.alwaysSprint ? !eng.keys['shift'] : !!eng.keys['shift'];
      isPressingSpace = eng.keys[' '];
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
      if (isPressingSpace && !player.wasPressingSpace && player.actionTimer <= 0) {
        const targetZ = eng.getTerrainZ(player.x, player.y);
        if (player.energy >= 25 && (player.z || 0) <= targetZ + 1) {
          player.energy -= 25;
          eng.ui.update();
          player.state = 'jump';
          player.frame = 0;
          player.frameTimer = 0;
          player.actionTimer = 4 * player.frameInterval;
          player.vz = 450;
        }
      }
    }
    player.wasPressingSpace = isPressingSpace;

    if (player.state === 'death') {
      speed = 0;
    } else if (player.actionTimer > 0) {
      if (player.state === 'dash') speed = player.runSpeed * 1.5;
      else if (player.state === 'jump') speed = isMoving ? (isPressingShift ? player.runSpeed : player.speed) : 0;
      else if (player.state.startsWith('attack') || player.state.startsWith('throw_attack')) speed = 0;

      if (player.wasInWater && speed > 0) speed *= 0.4; // Slower actions in water
    } else {
      if (isMoving) {
        player.state = isPressingShift ? 'run' : 'walk';
        speed = isPressingShift ? player.runSpeed : player.speed;
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
        player.state = 'idle';
      }
    }

    let inputMoveX = 0, inputMoveY = 0;
    if (isMoving && speed > 0) {
      const inputSpeed = speed * (dt / 1000);
      const len = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
      inputMoveX = (player.vx / len) * inputSpeed;
      inputMoveY = (player.vy / len) * inputSpeed;
    }

    let totalMoveX = 0, totalMoveY = 0;
    if (isMoving) {
      totalMoveX = inputMoveX;
      totalMoveY = inputMoveY;
      player.momentumX = inputMoveX;
      player.momentumY = inputMoveY;
    } else {
      totalMoveX = player.momentumX;
      totalMoveY = player.momentumY;
    }
    
    const isEffectivelyMoving = Math.hypot(totalMoveX, totalMoveY) > 0.1;

    if (isEffectivelyMoving) {
      let nextX = player.x + totalMoveX;
      let nextY = player.y + totalMoveY;
      const maxMapSize = 128 * 32;

      if (nextX < 0) { nextX = 0; player.vx = 0; }
      if (nextX > maxMapSize) { nextX = maxMapSize; player.vx = 0; }
      if (nextY < 0) { nextY = 0; player.vy = 0; }
      if (nextY > maxMapSize) { nextY = maxMapSize; player.vy = 0; }

      const finalMoveX = nextX - player.x;
      const finalMoveY = nextY - player.y;

      if (!eng.checkCollision(player.x + finalMoveX, player.y, player.z || 0)) {
        player.x += finalMoveX;
      } else if (!eng.checkCollision(player.x + finalMoveX, player.y, (player.z || 0) + 16)) {
        player.x += finalMoveX;
        player.z = (player.z || 0) + 16;
      }

      if (!eng.checkCollision(player.x, player.y + finalMoveY, player.z || 0)) {
        player.y += finalMoveY;
      } else if (!eng.checkCollision(player.x, player.y + finalMoveY, (player.z || 0) + 16)) {
        player.y += finalMoveY;
        player.z = (player.z || 0) + 16;
      }

      if (!player.state.startsWith('attack') && !player.state.startsWith('throw_attack')) {
        let angle;
        if (isMoving) { // Prioritize input direction
          angle = Math.atan2(player.vy, player.vx);
        } else { // Use momentum direction if sliding
          angle = Math.atan2(player.momentumY, player.momentumX);
        }
        let normalizedAngle = angle + Math.PI / 8;
        if (normalizedAngle < 0) normalizedAngle += Math.PI * 2;
        const dirIndex = Math.floor(normalizedAngle / (Math.PI / 4)) % 8;
        const dirs = ['down-left', 'down', 'down-right', 'right', 'up-right', 'up', 'up-left', 'left'];
        player.dir = dirs[dirIndex];
      }
    }

    // Update momentum for next frame
    let groundSlipperiness = 0;
    let groundTex = null;
    const v = eng.mapManager.getVoxelAt(player.x, player.y, (player.z || 0) - 16);
    if (v) {
        const props = getBlockProps(v.tex);
        if (props.isSolid) {
            groundSlipperiness = props.slipperiness || 0;
            groundTex = v.tex;
        }
    }

    if (groundTex === 'ice' && isEffectivelyMoving && Math.random() > 0.4) {
      eng.particles.push({
        x: player.x + (Math.random() - 0.5) * 16,
        y: player.y + (Math.random() - 0.5) * 16,
        z: (player.z || 0) - 8,
        vx: -totalMoveX * 15 + (Math.random() - 0.5) * 30, // Kick backwards
        vy: -totalMoveY * 15 + (Math.random() - 0.5) * 30,
        vz: 10 + Math.random() * 20, // Pop up slightly
        life: 0.15 + Math.random() * 0.15,
        maxLife: 0.3,
        color: '#e0f7fa', // Light ice blue
        size: 1 + Math.random() * 1.5
      });
    }

    if (!isMoving) {
        player.momentumX = totalMoveX * groundSlipperiness;
        player.momentumY = totalMoveY * groundSlipperiness;
    }

    if (Math.hypot(player.momentumX, player.momentumY) < 0.1) {
        player.momentumX = 0;
        player.momentumY = 0;
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
    });
  }
}