export const BLOCK_REGISTRY = {
  'water': {
    isSolid: false,
    isFluid: true
  },
  'water_flow': {
    isSolid: false,
    isFluid: true
  },
  'lava': {
    isSolid: false,
    isFluid: true,
    damagePerSecond: 150
  },
  'acid': {
    isSolid: false,
    isFluid: true,
    damagePerSecond: 50
  },
  'mud': {
    isSolid: true,
    isFluid: false,
    speedMultiplier: 0.5 // Slows movement by 50%
  },
  'ice': {
    isSolid: true,
    isFluid: false,
    slipperiness: 0.95 // Momentum retention factor
  },
  'air': {
    isSolid: false,
    isFluid: false
  }
  // Any block not explicitly defined here will fallback to the defaults below.
};

/**
 * Returns the physical properties for a given texture name.
 */
export function getBlockProps(textureName) {
  if (!textureName) return { isSolid: true, isFluid: false };
  return BLOCK_REGISTRY[textureName] || { isSolid: true, isFluid: false };
}