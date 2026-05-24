export const BlockRegistry = {
  1: {
    name: 'grass',
    type: 'block',
    shape: 'cube',
    solid: true,
    faces: { top: [0, 0], bottom: [1, 0], sides: [1, 0] }
  },
  2: {
    name: 'dirt',
    type: 'block',
    shape: 'cube',
    solid: true,
    faces: { top: [1, 0], bottom: [1, 0], sides: [1, 0] }
  },
  3: {
    name: 'stone',
    type: 'block',
    shape: 'cube',
    solid: true,
    faces: { top: [2, 0], bottom: [2, 0], sides: [2, 0] }
  },
  4: {
    name: 'mud',
    type: 'block',
    shape: 'cube',
    solid: true,
    faces: { top: [2, 1], bottom: [2, 1], sides: [2, 1] }
  },
  5: {
    name: 'ice',
    type: 'block',
    shape: 'cube',
    solid: true,
    faces: { top: [1, 2], bottom: [1, 2], sides: [1, 2] }
  },
  6: {
    name: 'stone-bricks',
    type: 'block',
    shape: 'cube',
    solid: true,
    faces: { top: [0, 4], bottom: [0, 4], sides: [0, 4] }
  },
  7: {
    name: 'wood-planks',
    type: 'block',
    shape: 'cube',
    solid: true,
    faces: { top: [0, 5], bottom: [0, 5], sides: [0, 5] }
  },
  8: {
    name: 'wood-stripped',
    type: 'block',
    shape: 'cube',
    solid: true,
    faces: { top: [1, 5], bottom: [1, 5], sides: [1, 5] }
  },
  15: {
    name: 'wood-door-bottom',
    type: 'block',
    shape: 'door',
    solid: true,
    faces: { top: [0, 6], bottom: [0, 6], sides: [0, 6] }
  },
  16: {
    name: 'wood-door-top',
    type: 'block',
    shape: 'door',
    solid: true,
    faces: { top: [1, 6], bottom: [1, 6], sides: [1, 6] }
  },
  42: {
    name: 'water',
    type: 'fluid',
    shape: 'cube',
    solid: false,
    animated: true,
    frametime: 100,
    faces: { top: [3, 0], bottom: [3, 0], sides: [3, 0] }
  },
  43: {
    name: 'lava',
    type: 'fluid',
    shape: 'cube',
    solid: false,
    animated: true,
    frametime: 100,
    faces: { top: [2, 3], bottom: [2, 3], sides: [2, 3] }
  },
  44: {
    name: 'acid',
    type: 'fluid',
    shape: 'cube',
    solid: false,
    animated: true,
    frametime: 100,
    faces: { top: [3, 2], bottom: [3, 2], sides: [3, 2] }
  },
  105: {
    name: 'dandelion',
    type: 'decor',
    shape: 'decor',
    solid: false,
    faces: { top: [0, 3], bottom: [0, 3], sides: [0, 3] }
  }
};

export const FURNITURE_REGISTRY = {
  'wood-bookshelf-small': { name: 'Small Wood Bookhelf' },
  'wood-bookshelf-tall': { name: 'Tall Wood Bookhelf' },
  'wood-chair': { name: 'Wood Chair' },
  'wood-bench-small': { name: 'Small Bench' },
  'wood-bench-medium': { name: 'Medium Bench' },
  'wood-bench-large': { name: 'Large Bench' },
  'wood-table-2x2': { name: '2x2 Wood Table' },
  'wood-table-3x3': { name: '3x3 Wood Table' },
  'plant-pot-small': { name: 'Small Plant Pot' },
  'plant-pot-medium': { name: 'Medium Plant Pot' }
};

export const POWERSET_REGISTRY = {
  'inherited': {
    name: 'Inherited',
    description: 'Basic abilities innate to all entities.',
    powers: ['brawl', 'throw_airplane']
  },
  'developer': {
    name: 'Developer',
    description: 'God-like tools for world shaping and testing.',
    powers: ['dev_noclip', 'dev_heal', 'dev_smite', 'fly', 'super_jump', 'super_speed']
  },
  'travel': {
    name: 'Travel',
    description: 'Powers that manipulate your movement and traversal.',
    powers: ['fly', 'super_jump', 'super_speed', 'teleport']
  }
};

export const POWER_REGISTRY = {
  'brawl': {
    name: 'Brawl',
    type: 'melee',
    energyCost: 20,
    damage: 25,
    critDamage: 35,
    range: 200,
    cooldown: 1.0,
    description: 'A standard melee attack.'
  },
  'throw_airplane': {
    name: 'Throw Airplane',
    type: 'ranged',
    energyCost: 15,
    damage: 1,
    critDamage: 3,
    range: 800,
    cooldown: 2.5,
    description: 'Throw a paper airplane at your enemies.'
  },
  'dev_noclip': {
    name: 'Noclip',
    type: 'utility',
    energyCost: 0,
    description: 'Toggle noclip mode.'
  },
  'dev_heal': {
    name: 'Full Heal',
    type: 'utility',
    energyCost: 0,
    description: 'Fully restore health and energy.'
  },
  'dev_smite': {
    name: 'Smite',
    type: 'ranged',
    energyCost: 0,
    damage: 9999,
    range: 2000,
    description: 'Instantly destroy target.'
  },
  'fly': {
    name: 'Fly',
    type: 'utility',
    energyCost: 0,
    description: 'Take to the skies and glide. Hold Space to ascend.'
  },
  'super_jump': {
    name: 'Super Jump',
    type: 'utility',
    energyCost: 0,
    description: 'Leap incredible heights.'
  },
  'super_speed': {
    name: 'Super Speed',
    type: 'utility',
    energyCost: 0,
    description: 'Run at incredible speeds. Builds up over time.'
  },
  'teleport': {
    name: 'Teleport',
    type: 'utility',
    energyCost: 30,
    description: 'Click to select a destination, then warp there after a brief delay.'
  }
};
