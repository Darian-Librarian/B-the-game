
import { TerrainGenerator } from './generator.js?v=new-engine-311';

export class MapManager {
  constructor(engine) {
    this.engine = engine;
    this.mapWidth = 128;
    this.mapHeight = 128;
    this.voxels = new Map();
    this.generator = new TerrainGenerator(engine);
  }

  update(dt) {
  }

  loadFullMap() {
    this.voxels = this.generator.generateChunk(0, 0, this.mapWidth);
    
    if (this.engine.socket) {
      this.engine.network.sendRequestFullMap();
    }
  }

  getVoxelAt(worldX, worldY, worldZ) {
    const localX = Math.round(worldX / 32);
    const localY = Math.round(worldY / 32);
    const localZ = Math.round(worldZ / 32);
    return this.voxels.get(`${localX}_${localY}_${localZ}`);
  }

  setVoxelAt(worldX, worldY, worldZ, voxelData, broadcast = true) {
    const localX = Math.round(worldX / 32);
    const localY = Math.round(worldY / 32);
    const localZ = Math.round(worldZ / 32);
    
    if (localX < 0 || localX >= this.mapWidth || localY < 0 || localY >= this.mapHeight) return false;

    const key = `${localX}_${localY}_${localZ}`;
    // Treat 0, null, or undefined as air/deletion
    if (voxelData === null || voxelData === undefined || voxelData === 0) {
      this.voxels.delete(key);
    } else {
      this.voxels.set(key, voxelData);
    }
    
    if (this.engine.renderer) {
      this.engine.renderer.updateBlockOcclusion(localX, localY, localZ);
      this.engine.renderer.needsVoxelUpdate = true;
    }
    
    if (broadcast && this.engine.socket) {
      this.engine.network.sendUpdateBlock({ worldX, worldY, worldZ, voxelData });
    }
    return true;
  }
}