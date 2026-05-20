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