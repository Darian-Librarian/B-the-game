export class TerrainGenerator {
  constructor(engine) {
    this.engine = engine;
  }

  hash(x, y) {
    let val = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123;
    return val - Math.floor(val);
  }

  smoothNoise(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;

    const ux = fx * fx * (3.0 - 2.0 * fx);
    const uy = fy * fy * (3.0 - 2.0 * fy);

    const n00 = this.hash(ix, iy);
    const n10 = this.hash(ix + 1, iy);
    const n01 = this.hash(ix, iy + 1);
    const n11 = this.hash(ix + 1, iy + 1);

    const nx0 = n00 * (1.0 - ux) + n10 * ux;
    const nx1 = n01 * (1.0 - ux) + n11 * ux;

    return nx0 * (1.0 - uy) + nx1 * uy;
  }

  fractalNoise(x, y, octaves) {
    let val = 0;
    let amp = 1.0;
    let freq = 1.0;
    let max = 0;
    for (let i = 0; i < octaves; i++) {
      val += this.smoothNoise(x * freq, y * freq) * amp;
      max += amp;
      amp *= 0.5;
      freq *= 2.0;
    }
    return val / max;
  }

  getElevation(wx, wy) {
    const noiseVal = this.fractalNoise(wx * 0.05, wy * 0.05, 4);
    let elevation = Math.floor(noiseVal * 3);
    return isNaN(elevation) ? 0 : elevation;
  }

  generateChunk(cx, cy, chunkSize) {
    const voxels = new Map();

    for (let x = 0; x < chunkSize; x++) {
      for (let y = 0; y < chunkSize; y++) {
        const worldX = (cx * chunkSize) + x;
        const worldY = (cy * chunkSize) + y;

        const elevation = this.getElevation(worldX, worldY);

        const noiseVal = this.fractalNoise(worldX * 0.05, worldY * 0.05, 4);
        const shift = Math.floor((noiseVal - 0.5) * 30);
        const r = Math.max(0, Math.min(255, 81 + shift));
        const g = Math.max(0, Math.min(255, 133 + shift));
        const b = Math.max(0, Math.min(255, 46 + shift));
        let colorHex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        if (colorHex.includes('NaN')) colorHex = '#51852E';
        
        const dirtNoise = this.fractalNoise(worldX * 0.08, worldY * 0.08, 2);
        const isDirt = dirtNoise > 0.65;
        const surfaceTex = isDirt ? 'dirt' : 'grass';
        const surfaceColor = isDirt ? '#ffffff' : colorHex;

        for (let vz = -3; vz <= elevation; vz++) {
          const voxelKey = `${x}_${y}_${vz}`;
          let tex = 'stone';
          let color = '#ffffff';

          if (vz === elevation) {
            tex = surfaceTex;
            color = surfaceColor;
          }

          voxels.set(voxelKey, {
            tex: tex,
            color: color,
            shape: 'cube'
          });
        }

        const elevN = this.getElevation(worldX, worldY - 1);
        const elevS = this.getElevation(worldX, worldY + 1);
        const elevE = this.getElevation(worldX + 1, worldY);
        const elevW = this.getElevation(worldX - 1, worldY);

        let rampShape = null;
        if (elevN === elevation + 1) rampShape = 'ramp_n';
        else if (elevS === elevation + 1) rampShape = 'ramp_s';
        else if (elevE === elevation + 1) rampShape = 'ramp_e';
        else if (elevW === elevation + 1) rampShape = 'ramp_w';

        if (rampShape) {
           voxels.set(`${x}_${y}_${elevation + 1}`, {
             tex: surfaceTex,
             color: surfaceColor,
             shape: rampShape
           });
        }
      }
    }

    return voxels;
  }
}