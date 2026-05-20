import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { BlockRegistry } from './registry.js?v=new-engine-240';

export class Renderer {
  constructor(engine) {
    this.engine = engine;
    
    THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

    this.cameraAngle = 0; 
    this.needsVoxelUpdate = true;
    this.initialLoadComplete = false;
    
    this.setupWebGL();
    this.setupCamera();
    this.setupScene();
    this.setupInstancedMesh();
    this.setupCompass();
    this.setupDebugOverlay();
    this.loadAssets();
  }

  setupWebGL() {
    this.webgl = new THREE.WebGLRenderer({ 
      canvas: this.engine.canvas, 
      antialias: false,
      alpha: false 
    });
    this.webgl.setPixelRatio(1);
    this.webgl.setSize(window.innerWidth, window.innerHeight);
    this.webgl.setClearColor(0x0b0e14, 1);
  }

  setupCamera() {
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 1000;
    
    this.camera = new THREE.OrthographicCamera(
      frustumSize * aspect / -2, 
      frustumSize * aspect / 2, 
      frustumSize / 2, 
      frustumSize / -2, 
      -50000, 
      50000
    );
    
    this.camera.rotation.order = 'YXZ';
    this.updateCameraRotation();
  }

  updateCameraRotation() {
    // Strict Isometric Locking Logic
    const baseIsoAngle = Math.PI / 4; 
    const zRotOffset = -this.cameraAngle * (Math.PI / 180);
    
    this.camera.rotation.x = Math.atan(1 / Math.sqrt(2));
    this.camera.rotation.y = 0; // Handled by Z up
    this.camera.rotation.z = baseIsoAngle + zRotOffset;
    this.updateCompass();
  }

  rotateCamera(direction) {
    this.cameraAngle = (this.cameraAngle + direction + 360) % 360;
    this.updateCameraRotation();
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.0)); 

    this.arrowHelper = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 0),
      100,
      0xff0000
    );
    
    this.arrowHelper.line.material.depthTest = false;
    this.arrowHelper.line.material.depthWrite = false;
    this.arrowHelper.line.renderOrder = 999;
    
    this.arrowHelper.cone.material.depthTest = false;
    this.arrowHelper.cone.material.depthWrite = false;
    this.arrowHelper.cone.renderOrder = 999;
    
    this.arrowHelper.visible = true;
    this.scene.add(this.arrowHelper);

    const boxGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(32.5, 32.5, 32.5));
    const boxMat = new THREE.LineBasicMaterial({ color: 0xf1c40f, depthTest: false, linewidth: 2 });
    this.highlightBox = new THREE.LineSegments(boxGeo, boxMat);
    this.highlightBox.renderOrder = 999;
    this.highlightBox.visible = false;
    this.scene.add(this.highlightBox);
    
    this.setupDebugMeshes();
  }

  setupDebugMeshes() {
    this.debugMeshes = new THREE.Group();
    this.scene.add(this.debugMeshes);

    const ringGeo = new THREE.RingGeometry(25, 30, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false });
    this.targetRing = new THREE.Mesh(ringGeo, ringMat);
    this.targetRing.add(new THREE.LineSegments(new THREE.EdgesGeometry(ringGeo), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthTest: false })));
    this.targetRing.visible = false;
    this.debugMeshes.add(this.targetRing);

    const circleGeo = new THREE.CircleGeometry(200, 32);
    const meleeMat = new THREE.MeshBasicMaterial({ color: 0xf39c12, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false });
    this.meleeCircle = new THREE.Mesh(circleGeo, meleeMat);
    this.meleeCircle.add(new THREE.LineSegments(new THREE.EdgesGeometry(circleGeo), new THREE.LineBasicMaterial({ color: 0xf39c12, transparent: true, opacity: 0.8, depthTest: false })));
    this.meleeCircle.visible = false;
    this.debugMeshes.add(this.meleeCircle);

    const fov = Math.PI / 3;
    const coneGeo = new THREE.CircleGeometry(200, 32, -fov, fov * 2);
    const coneMat = new THREE.MeshBasicMaterial({ color: 0xe74c3c, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false });
    this.meleeCone = new THREE.Mesh(coneGeo, coneMat);
    this.meleeCone.add(new THREE.LineSegments(new THREE.EdgesGeometry(coneGeo), new THREE.LineBasicMaterial({ color: 0xe74c3c, transparent: true, opacity: 0.8, depthTest: false })));
    this.meleeCone.visible = false;
    this.debugMeshes.add(this.meleeCone);
    
    const meleeHitGeo = new THREE.CircleGeometry(35, 32);
    const meleeHitMat = new THREE.MeshBasicMaterial({ color: 0xe74c3c, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false });
    this.meleeHitMesh = new THREE.InstancedMesh(meleeHitGeo, meleeHitMat, 100);
    this.meleeHitMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.meleeHitMesh.visible = false;
    this.debugMeshes.add(this.meleeHitMesh);

    const meleeHitEdgeGeo = new THREE.RingGeometry(34, 35, 32);
    const meleeHitEdgeMat = new THREE.MeshBasicMaterial({ color: 0xe74c3c, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
    this.meleeHitLineMesh = new THREE.InstancedMesh(meleeHitEdgeGeo, meleeHitEdgeMat, 100);
    this.meleeHitLineMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.meleeHitLineMesh.visible = false;
    this.debugMeshes.add(this.meleeHitLineMesh);

    const losGeo = new THREE.CircleGeometry(35, 32);
    const losMat = new THREE.MeshBasicMaterial({ color: 0xf1c40f, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false });
    this.losMesh = new THREE.InstancedMesh(losGeo, losMat, 100);
    this.losMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.losMesh.visible = false;
    this.debugMeshes.add(this.losMesh);

    const losEdgeGeo = new THREE.RingGeometry(34, 35, 32);
    const losEdgeMat = new THREE.MeshBasicMaterial({ color: 0xf1c40f, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
    this.losLineMesh = new THREE.InstancedMesh(losEdgeGeo, losEdgeMat, 100);
    this.losLineMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.losLineMesh.visible = false;
    this.debugMeshes.add(this.losLineMesh);
    
    const losConeGeo = new THREE.CircleGeometry(400, 32, -Math.PI/3, (Math.PI/3)*2);
    const losConeMat = new THREE.MeshBasicMaterial({ color: 0xf1c40f, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false });
    this.losCone = new THREE.Mesh(losConeGeo, losConeMat);
    this.losCone.add(new THREE.LineSegments(new THREE.EdgesGeometry(losConeGeo), new THREE.LineBasicMaterial({ color: 0xf1c40f, transparent: true, opacity: 0.8, depthTest: false })));
    this.losCone.visible = false;
    this.debugMeshes.add(this.losCone);

    this.debugTileMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(32, 32, 32), new THREE.MeshBasicMaterial({ color: 0xff4757, wireframe: true, depthTest: false }), 100);
    this.debugTileMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.debugTileMesh.visible = false;
    this.debugMeshes.add(this.debugTileMesh);
    
    const chunkBoxGeo = new THREE.BoxGeometry(1024, 1024, 2048);
    const chunkBoxMat = new THREE.LineBasicMaterial({ color: 0x9b59b6, depthTest: false, transparent: true, opacity: 0.5, linewidth: 2 });
    this.chunkBox = new THREE.LineSegments(new THREE.EdgesGeometry(chunkBoxGeo), chunkBoxMat);
    this.chunkBox.visible = false;
    this.debugMeshes.add(this.chunkBox);
  }

  setupInstancedMesh() {
    const maxInstances = 100000;

    this.instancedMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xffffff,
      alphaTest: 0.1
    }); 

    this.instancedMaterial.userData = { time: { value: 0 } };

    this.instancedMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.instancedMaterial.userData.time;
      shader.vertexShader = `
        attribute float isFluid;
        attribute vec4 instanceUVTop;
        attribute vec4 instanceUVSide;
        attribute vec4 instanceUVBottom;
        varying float vIsFluid;
        varying vec4 vInstanceUVTop;
        varying vec4 vInstanceUVSide;
        varying vec4 vInstanceUVBottom;
        varying vec3 vWorldNormal;
        varying vec3 vLocalPosition;
        varying vec3 vInstancePosition;
      ` + shader.vertexShader.replace(
        '#include <uv_vertex>',
        `
        #include <uv_vertex>
        vIsFluid = isFluid;
        vInstanceUVTop = instanceUVTop;
        vInstanceUVSide = instanceUVSide;
        vInstanceUVBottom = instanceUVBottom;
        vWorldNormal = normalize( mat3( modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz ) * normal );
        vLocalPosition = position;
        vInstancePosition = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        `
      );
      shader.fragmentShader = `
        uniform float uTime;
        varying float vIsFluid;
        varying vec4 vInstanceUVTop;
        varying vec4 vInstanceUVSide;
        varying vec4 vInstanceUVBottom;
        varying vec3 vWorldNormal;
        varying vec3 vLocalPosition;
        varying vec3 vInstancePosition;
      ` + shader.fragmentShader.replace(
        '#include <map_fragment>',
        `
        #ifdef USE_MAP
          vec2 baseUV = vMapUv;
          
          vec4 iuv;
          if (vWorldNormal.z > 0.5) { // Top
            iuv = vInstanceUVTop;
          } else if (vWorldNormal.z < -0.5) { // Bottom
            iuv = vInstanceUVBottom;
          } else { // Sides
            iuv = vInstanceUVSide;
            // Force ALL side faces to mathematically orient V directly downwards (-Z)
            if (abs(vWorldNormal.x) > 0.5) {
                baseUV.x = vWorldNormal.x > 0.0 ? (0.5 - vLocalPosition.y / 32.0) : (vLocalPosition.y / 32.0 + 0.5);
            } else {
                baseUV.x = vWorldNormal.y > 0.0 ? (vLocalPosition.x / 32.0 + 0.5) : (0.5 - vLocalPosition.x / 32.0);
            }
            baseUV.y = vLocalPosition.z / 32.0 + 0.5;
          }

          // --- Fluid Animation Override ---
          if (vIsFluid > 0.5) {
              vec3 worldPos = vInstancePosition + vLocalPosition;
              if (vWorldNormal.z > 0.9) { // Flat Top face ONLY
                  // Seamless world-aligned mapping, NO time sliding
                  baseUV = fract(vec2(worldPos.x, -worldPos.y) / 32.0);
              }
          }

          vec2 modifiedUV = baseUV * iuv.zw + iuv.xy;
          vec4 sampledDiffuseColor = texture2D( map, modifiedUV );

          // --- Fake AO/Lighting for Depth Perception ---
          float lighting = 1.0;
          if (abs(vWorldNormal.z) < 0.9) { 
            lighting = 0.75;
          } else if (vWorldNormal.z < -0.9) { 
            lighting = 0.5;
          }
          sampledDiffuseColor.rgb *= lighting;

          diffuseColor *= sampledDiffuseColor;
        #endif
        `
      );
    };

    const createMesh = (geometry, material = this.instancedMaterial) => {
      const uvsTop = new Float32Array(maxInstances * 4);
      geometry.setAttribute('instanceUVTop', new THREE.InstancedBufferAttribute(uvsTop, 4));
      const uvsSide = new Float32Array(maxInstances * 4);
      geometry.setAttribute('instanceUVSide', new THREE.InstancedBufferAttribute(uvsSide, 4));
      const uvsBottom = new Float32Array(maxInstances * 4);
      geometry.setAttribute('instanceUVBottom', new THREE.InstancedBufferAttribute(uvsBottom, 4));
      geometry.setAttribute('isFluid', new THREE.InstancedBufferAttribute(new Float32Array(maxInstances), 1));
      
      const mesh = new THREE.InstancedMesh(geometry, material, maxInstances);
      
      mesh.frustumCulled = false;
      mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1000000);
      geometry.boundingSphere = mesh.boundingSphere;
      
      const colors = new Float32Array(maxInstances * 3);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
      
      this.scene.add(mesh);
      return mesh;
    };

    const cubeGeo = new THREE.BoxGeometry(32, 32, 32);
    cubeGeo.computeBoundingBox();
    cubeGeo.computeBoundingSphere();
    this.voxelMesh = createMesh(cubeGeo);

    const slabGeo = new THREE.BoxGeometry(32, 32, 16);
    slabGeo.translate(0, 0, -8);
    slabGeo.computeBoundingBox();
    slabGeo.computeBoundingSphere();
    this.slabMesh = createMesh(slabGeo);

    const rampGeo = new THREE.BoxGeometry(32, 32, 32);
    let pos = rampGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) < 0 && pos.getZ(i) > 0) {
        pos.setZ(i, -16);
      }
    }
    let rampUv = rampGeo.attributes.uv;
    for (let i = 0; i < rampUv.count; i++) {
      if (i < 12) {
        rampUv.setY(i, 1.0 - rampUv.getY(i));
      }
    }
    rampGeo.computeVertexNormals();
    rampGeo.computeBoundingBox();
    rampGeo.computeBoundingSphere();
    this.rampMesh = createMesh(rampGeo);

    this.previewMaterial = this.instancedMaterial.clone();
    this.previewMaterial.onBeforeCompile = this.instancedMaterial.onBeforeCompile;
    this.previewMaterial.transparent = true;
    this.previewMaterial.opacity = 0.6;
    this.previewMaterial.depthTest = true;
    this.previewMaterial.polygonOffset = true;
    this.previewMaterial.polygonOffsetFactor = -2;
    this.previewMaterial.polygonOffsetUnits = -2;

    const createPreviewMesh = (geometry) => {
      geometry.setAttribute('instanceUVTop', new THREE.InstancedBufferAttribute(new Float32Array(4), 4));
      geometry.setAttribute('instanceUVSide', new THREE.InstancedBufferAttribute(new Float32Array(4), 4));
      geometry.setAttribute('instanceUVBottom', new THREE.InstancedBufferAttribute(new Float32Array(4), 4));
      geometry.setAttribute('isFluid', new THREE.InstancedBufferAttribute(new Float32Array(4), 1));
      const mesh = new THREE.InstancedMesh(geometry, this.previewMaterial, 1);
      mesh.frustumCulled = false; mesh.count = 0; mesh.renderOrder = 998;
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(3), 3);
      this.scene.add(mesh); return mesh;
    };
    
    this.previewCubeMesh = createPreviewMesh(cubeGeo.clone());
    this.previewSlabMesh = createPreviewMesh(slabGeo.clone());
    this.previewRampMesh = createPreviewMesh(rampGeo.clone());

    this.decorMaterial = this.instancedMaterial.clone();
    this.decorMaterial.side = THREE.DoubleSide;
    this.decorMaterial.depthWrite = true;
    this.decorMaterial.alphaTest = 0.5;
    this.decorMaterial.onBeforeCompile = (shader) => {
      shader.vertexShader = `
        attribute vec4 instanceUVTop;
        varying vec4 vInstanceUVTop;
        varying vec3 vWorldNormal;
      ` + shader.vertexShader.replace(
        '#include <uv_vertex>',
        `
        #include <uv_vertex>
        vInstanceUVTop = instanceUVTop;
        vWorldNormal = normalize( mat3( modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz ) * normal );
        `
      );
      shader.fragmentShader = `
        varying vec4 vInstanceUVTop;
        varying vec3 vWorldNormal;
      ` + shader.fragmentShader.replace(
        '#include <map_fragment>',
        `
        #ifdef USE_MAP
          vec2 modifiedUV = vMapUv * vInstanceUVTop.zw + vInstanceUVTop.xy;
          vec4 sampledDiffuseColor = texture2D( map, modifiedUV );
          float lighting = 1.0;
          if (abs(vWorldNormal.z) < 0.9) lighting = 0.75;
          else if (vWorldNormal.z < -0.9) lighting = 0.5;
          sampledDiffuseColor.rgb *= lighting;
          diffuseColor *= sampledDiffuseColor;
        #endif
        `
      );
    };

    const decorGeo = new THREE.BufferGeometry();
    const verts = new Float32Array([
      -16, 0, 32,  16, 0, 32,  -16, 0, 0,   16, 0, 32,  16, 0, 0,  -16, 0, 0,
       0, -16, 32,  0, 16, 32,  0, -16, 0,   0, 16, 32,  0, 16, 0,  0, -16, 0
    ]);
    const uvsGeo = new Float32Array([
      0, 1,  1, 1,  0, 0,   1, 1,  1, 0,  0, 0,
      0, 1,  1, 1,  0, 0,   1, 1,  1, 0,  0, 0
    ]);
    decorGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    decorGeo.setAttribute('uv', new THREE.BufferAttribute(uvsGeo, 2));
    decorGeo.computeVertexNormals();
    this.decorMesh = createMesh(decorGeo);
    this.decorMesh.material = this.decorMaterial;
  }

  setupCompass() {
    let compass = document.getElementById('compass-ui');
    if (!compass) {
      compass = document.createElement('div');
      compass.id = 'compass-ui';
      compass.style.cssText = 'position: absolute; top: 85px; right: 35px; width: 40px; height: 40px; background: rgba(5, 7, 10, 0.8); border: 2px solid #3498db; border-radius: 50%; display: flex; align-items: center; justify-content: center; z-index: 1000; pointer-events: auto; cursor: pointer; font-family: var(--font-mono); font-weight: bold; box-shadow: 0 4px 10px rgba(0,0,0,0.8); transition: background 0.2s;';
      
      compass.onmouseenter = () => compass.style.background = 'rgba(52, 152, 219, 0.3)';
      compass.onmouseleave = () => compass.style.background = 'rgba(5, 7, 10, 0.8)';
      compass.onclick = () => {
        const snapAngle = this.engine.clientSettings.cameraAngleSnap !== undefined ? this.engine.clientSettings.cameraAngleSnap : 0;
        this.cameraAngle = parseInt(snapAngle, 10);
        this.updateCameraRotation();
      };
      
      const needle = document.createElement('div');
      needle.id = 'compass-needle';
      needle.style.cssText = 'position: relative; width: 4px; height: 32px; background: linear-gradient(to bottom, #e74c3c 50%, #bdc3c7 50%); border-radius: 2px;';
      
      const nLabel = document.createElement('div');
      nLabel.innerText = 'N';
      nLabel.style.cssText = 'position: absolute; top: -12px; left: 50%; transform: translateX(-50%); font-size: 10px; color: #e74c3c; text-shadow: 1px 1px 0 #000;';
      needle.appendChild(nLabel);
      
      compass.appendChild(needle);
      document.body.appendChild(compass);
    }
  }

  updateCompass() {
    const needle = document.getElementById('compass-needle');
    if (needle) {
      needle.style.transform = `rotate(${-this.cameraAngle}deg)`;
    }
  }

  setupDebugOverlay() {
    let overlay = document.getElementById('3d-debug-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = '3d-debug-overlay';
      overlay.style.cssText = 'position: absolute; pointer-events: none; background: rgba(0,0,0,0.8); border: 1px solid #f1c40f; color: #fff; font-family: var(--font-mono); font-size: 12px; padding: 10px; border-radius: 4px; z-index: 1000; display: none; white-space: nowrap; box-shadow: 0 0 10px rgba(0,0,0,0.8);';
      document.body.appendChild(overlay);
    }
    this.debugOverlay = overlay;

    let dCanvas = document.getElementById('debug-canvas');
    if (!dCanvas) {
      dCanvas = document.createElement('canvas');
      dCanvas.id = 'debug-canvas';
      dCanvas.style.cssText = 'position: absolute; top: 0; left: 0; pointer-events: none; z-index: 10;';
      document.body.appendChild(dCanvas);
    }
    this.debugCanvas = dCanvas;
    this.debugCtx = dCanvas.getContext('2d');
  }

  loadAssets() {
    this.textures = {};
    this.entityMeshes = new Map();
    this.projectileMeshes = new Map();
    this.debrisMeshes = new Map();
    this.atlasMap = {};
    
    this.buildTextureAtlas();
    
    const loader = new THREE.TextureLoader();
    const cb = '?v=phase2-3d';

    loader.load(`assets/sprites/projectiles/paper-airplane-right.png${cb}`, (tex) => {
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.repeat.set(1/4, 1);
      this.textures['proj_airplane'] = tex;
    });

    ['crumpled-cronched-paper-1', 'crumpled-cronched-paper-2', 'crumpled-cronched-paper-3'].forEach((name, i) => {
      loader.load(`assets/sprites/projectiles/${name}.png${cb}`, (tex) => {
        tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
        this.textures[`cronched_${i+1}`] = tex;
      });
    });

    ['crumpled-paper-1', 'crumpled-paper-2'].forEach((name, i) => {
      loader.load(`assets/sprites/projectiles/${name}.png${cb}`, (tex) => {
        tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
        this.textures[`waste_${i+1}`] = tex;
      });
    });

    loader.load(`assets/sprites/projectiles/crumpled-cronched-charred-paper-1.png${cb}`, (tex) => {
      tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
      this.textures['charred_1'] = tex;
    });

    const spriteConfigs = [
      { state: 'idle', file: 'idle-template', rows: 12 },
      { state: 'walk', file: 'walk-template', rows: 8 },
      { state: 'run', file: 'run-template', rows: 8 },
      { state: 'dash', file: 'dash-template', rows: 8 },
      { state: 'jump', file: 'jump-template', rows: 8 },
      { state: 'attack1', file: 'attack-template', rows: 7 },
      { state: 'attack2', file: 'attack-template', rows: 7 },
      { state: 'throw_attack1', file: 'attack-ranged', rows: 7 },
      { state: 'hurt', file: 'idle-template', rows: 12 },
      { state: 'death', file: 'idle-template', rows: 12 }
    ];

    const path = 'assets/sprites/characters';

    spriteConfigs.forEach(config => {
      loader.load(`${path}/${config.file}.png${cb}`, (tex) => {
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.repeat.set(1/8, 1/config.rows);
        tex.userData = { rows: config.rows };
        this.textures[config.state] = tex;
      });
    });
  }

  buildTextureAtlas() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    this.atlasMap = {
      'white': { x: 0, y: 1 },
      'mud1': { x: 2, y: 1 },
      'mud2': { x: 3, y: 1 },
      'mud3': { x: 0, y: 2 },
      'bubble': { x: 2, y: 2 },
      'smoke': { x: 0, y: 1 }, // Maps directly to the white square fallback
      'water_flow': { x: 1, y: 3 },
      'lava_flow': { x: 3, y: 3 }
    };

    for (const id in BlockRegistry) {
      const block = BlockRegistry[id];
      if (block.faces) {
        if (block.faces.top && !this.atlasMap[block.name]) this.atlasMap[block.name] = { x: block.faces.top[0], y: block.faces.top[1] };
        if (block.faces.sides && !this.atlasMap[block.name + '_flow']) this.atlasMap[block.name + '_flow'] = { x: block.faces.sides[0], y: block.faces.sides[1] };
        if (block.faces.bottom && !this.atlasMap[block.name + '_bottom']) this.atlasMap[block.name + '_bottom'] = { x: block.faces.bottom[0], y: block.faces.bottom[1] };
      }
    }

    const atlasTexture = new THREE.CanvasTexture(canvas);
    atlasTexture.magFilter = THREE.NearestFilter;
    atlasTexture.minFilter = THREE.NearestFilter;
    atlasTexture.generateMipmaps = false;
    atlasTexture.colorSpace = THREE.SRGBColorSpace;
    
    this.instancedMaterial.map = atlasTexture;
    this.instancedMaterial.needsUpdate = true;

    this.atlasCtx = ctx;
    this.atlasTexture = atlasTexture;
    this.animatedTiles = [];

    const loadTile = (id, src, isAnimated = false) => {
      const img = new Image();
      img.src = src + '?v=' + Date.now();
      img.onload = () => {
        const pos = this.atlasMap[id];
        let sequence = null;
        let frametime = 150;
        
        const baseName = id.replace('_flow', '');
        for (const key in BlockRegistry) {
          if (BlockRegistry[key].name === baseName) {
            if (BlockRegistry[key].animated) {
              isAnimated = true;
              sequence = BlockRegistry[key].sequence;
              frametime = BlockRegistry[key].frametime || 150;
            }
            break;
          }
        }

        if (isAnimated) {
          this.animatedTiles.push({ id, img, pos, frames: img.height / img.width, lastFrame: -1, sequence, frametime });
        } else {
          if (pos) {
            ctx.drawImage(img, 0, 0, img.width, img.height, pos.x * 64, pos.y * 64, 64, 64);
            atlasTexture.needsUpdate = true;
          }
        }
      };
    };

    loadTile('grass', 'assets/tiles/base/floor/grass_block_top.png');
    loadTile('dirt', 'assets/tiles/base/all-facing/dirt.png');
    loadTile('stone', 'assets/tiles/base/all-facing/stone.png');
    loadTile('water', 'assets/tiles/base/fluid/water_still.png', true);
    loadTile('water_flow', 'assets/tiles/base/fluid/water_flow.png', true);
    loadTile('mud1', 'assets/tiles/base/all-facing/packed_mud1.png');
    loadTile('mud2', 'assets/tiles/base/all-facing/packed_mud2.png');
    loadTile('mud3', 'assets/tiles/base/all-facing/packed_mud3.png');
    loadTile('ice', 'assets/tiles/base/all-facing/ice.png');
    loadTile('acid', 'assets/tiles/base/fluid/water_still.png');
    loadTile('lava', 'assets/tiles/base/fluid/lava_still.png');
    loadTile('lava_flow', 'assets/tiles/base/fluid/lava_flow.png');
    loadTile('bubble', 'assets/sprites/fx/bubble-grayscale.png');
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 64, 64, 64);
  }

  updateAnimatedTiles() {
    if (!this.animatedTiles || this.animatedTiles.length === 0) return;
    let updated = false;
    
    this.animatedTiles.forEach(tile => {
      let currentFrame;
      if (tile.sequence) {
        let seqIdx = Math.floor(performance.now() / (tile.frametime || 150)) % tile.sequence.length;
        currentFrame = tile.sequence[seqIdx];
      } else {
        const frameCount = tile.frames || 1;
        currentFrame = Math.floor(performance.now() / (tile.frametime || 150)) % frameCount; 
      }
      
      if (tile.lastFrame !== currentFrame) {
        tile.lastFrame = currentFrame;
        const sy = currentFrame * tile.img.width; 
        this.atlasCtx.clearRect(tile.pos.x * 64, tile.pos.y * 64, 64, 64);
        this.atlasCtx.drawImage(tile.img, 0, sy, tile.img.width, tile.img.width, tile.pos.x * 64, tile.pos.y * 64, 64, 64);
        updated = true;
      }
    });
    
    if (updated) {
      this.atlasTexture.needsUpdate = true;
    }
  }

  isBlockOccluded(x, y, z, shape) {
    if (shape !== 'cube') return false;
    const cm = this.engine.mapManager;
    if (!cm) return false;

    const getShape = (v) => v ? (v.shape || 'cube') : null;

    const top = cm.getVoxelAt(x, y, z + 32);
    const bottom = z <= -96 ? { shape: 'cube' } : cm.getVoxelAt(x, y, z - 32);
    const north = cm.getVoxelAt(x, y - 32, z);
    const south = cm.getVoxelAt(x, y + 32, z);
    const east = cm.getVoxelAt(x + 32, y, z);
    const west = cm.getVoxelAt(x - 32, y, z);

    if (getShape(top) === 'cube' && getShape(bottom) === 'cube' && 
        getShape(north) === 'cube' && getShape(south) === 'cube' && 
        getShape(east) === 'cube' && getShape(west) === 'cube') {
      return true;
    }
    return false;
  }

  cacheOcclusion() {
    if (!this.engine.mapManager) return;
    for (const [key, voxel] of this.engine.mapManager.voxels.entries()) {
      const [vx, vy, vz] = key.split('_').map(Number);
      voxel.isOccluded = this.isBlockOccluded(vx * 32, vy * 32, vz * 32, voxel.shape || 'cube');
    }
  }

  updateBlockOcclusion(localX, localY, localZ) {
    if (!this.engine.mapManager) return;
    const offsets = [
      [0, 0, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0], [0, 1, 0], [1, 0, 0], [-1, 0, 0]
    ];
    for (const [dx, dy, dz] of offsets) {
      const nx = localX + dx;
      const ny = localY + dy;
      const nz = localZ + dz;
      const voxel = this.engine.mapManager.voxels.get(`${nx}_${ny}_${nz}`);
      if (voxel) voxel.isOccluded = this.isBlockOccluded(nx * 32, ny * 32, nz * 32, voxel.shape || 'cube');
    }
  }

  getRelativeSpriteDirection(absoluteDir) {
    const dirs = ['down-left', 'down', 'down-right', 'right', 'up-right', 'up', 'up-left', 'left'];
    let dirIdx = dirs.indexOf(absoluteDir);
    if (dirIdx === -1) dirIdx = 0;

    const shift = Math.round((-this.cameraAngle || 0) / 45);
    
    let relativeIdx = (dirIdx + shift) % 8;
    if (relativeIdx < 0) relativeIdx += 8;

    return dirs[relativeIdx];
  }

  updateVoxels() {
    if (!this.engine.mapManager) return;
    
    if (!this.needsVoxelUpdate) return;
    this.needsVoxelUpdate = false;

    const nameToId = {};
    for (const id in BlockRegistry) {
      nameToId[BlockRegistry[id].name] = id;
    }

    let iCube = 0, iSlab = 0, iRamp = 0, iDecor = 0;
    const dummy = new THREE.Object3D();
    
    const fluidAttrCube = this.voxelMesh.geometry.attributes.isFluid;
    const fluidAttrSlab = this.slabMesh.geometry.attributes.isFluid;
    const fluidAttrRamp = this.rampMesh.geometry.attributes.isFluid;
    const fluidAttrDecor = this.decorMesh.geometry.attributes.isFluid;

    this.engine.splashPoints = [];
    this.engine.lavaPoints = [];

    for (const [key, voxel] of this.engine.mapManager.voxels.entries()) {
      if (voxel.isOccluded) continue;

        const [vx, vy, vz] = key.split('_').map(Number);
        const absX = vx * 32;
        const absY = vy * 32;
        const absZ = vz * 32;

        if (voxel.tex === 'water_flow') {
           const bottomVoxel = this.engine.mapManager.getVoxelAt(absX, absY, absZ - 32);
           if (bottomVoxel && bottomVoxel.tex === 'water') {
              let wColor = bottomVoxel.color;
              if (!wColor || typeof wColor !== 'string' || !wColor.startsWith('#') || wColor.includes('NaN')) {
                wColor = '#3498db';
              }
              
              let fallHeight = 1;
              while (this.engine.mapManager.getVoxelAt(absX, absY, absZ + (fallHeight * 32))?.tex === 'water_flow') {
                 fallHeight++;
              }
              this.engine.splashPoints.push({ x: absX, y: absY, z: absZ - 16, color: wColor, fallHeight });
           }
        }

        if (voxel.tex === 'lava' || voxel.tex === 'acid') {
           const topVoxel = this.engine.mapManager.getVoxelAt(absX, absY, absZ + 32);
           if (!topVoxel || topVoxel.shape !== 'cube') {
              let lColor = voxel.color;
              if (!lColor || typeof lColor !== 'string' || !lColor.startsWith('#') || lColor.includes('NaN')) {
                lColor = voxel.tex === 'acid' ? '#2ecc71' : '#ff5d00';
              }
              this.engine.lavaPoints.push({ x: absX, y: absY, z: absZ, color: lColor, isAcid: voxel.tex === 'acid' });
           }
        }

        const shape = voxel.shape || 'cube';
        let currentMesh, currentI, currentUVTop, currentUVSide, currentUVBottom, currentFluidAttr;

        dummy.rotation.set(0, 0, 0);
        const isFluid = voxel.tex === 'water' || voxel.tex === 'water_flow' || voxel.tex === 'lava' || voxel.tex === 'acid';

        if (shape === 'decor') {
          currentMesh = this.decorMesh; currentI = iDecor;
          currentUVTop = this.decorMesh.geometry.attributes.instanceUVTop;
          currentUVSide = this.decorMesh.geometry.attributes.instanceUVSide;
          currentUVBottom = this.decorMesh.geometry.attributes.instanceUVBottom;
          currentFluidAttr = fluidAttrDecor;
          iDecor++;
        } else if (shape === 'slab') {
          currentMesh = this.slabMesh; currentI = iSlab;
          currentUVTop = this.slabMesh.geometry.attributes.instanceUVTop;
          currentUVSide = this.slabMesh.geometry.attributes.instanceUVSide;
          currentUVBottom = this.slabMesh.geometry.attributes.instanceUVBottom;
          currentFluidAttr = fluidAttrSlab;
          iSlab++;
        } else if (shape.startsWith('ramp')) {
          currentMesh = this.rampMesh; currentI = iRamp;
          currentUVTop = this.rampMesh.geometry.attributes.instanceUVTop;
          currentUVSide = this.rampMesh.geometry.attributes.instanceUVSide;
          currentUVBottom = this.rampMesh.geometry.attributes.instanceUVBottom;
          currentFluidAttr = fluidAttrRamp;
          iRamp++;
          if (shape === 'ramp_e') dummy.rotation.set(0, 0, -Math.PI / 2);
          else if (shape === 'ramp_n') dummy.rotation.set(0, 0, Math.PI);
          else if (shape === 'ramp_w') dummy.rotation.set(0, 0, Math.PI / 2);
        } else {
          currentMesh = this.voxelMesh; currentI = iCube;
          currentUVTop = this.voxelMesh.geometry.attributes.instanceUVTop;
          currentUVSide = this.voxelMesh.geometry.attributes.instanceUVSide;
          currentUVBottom = this.voxelMesh.geometry.attributes.instanceUVBottom;
          currentFluidAttr = fluidAttrCube;
          iCube++;
        }
        if (currentI >= 100000) continue;

        dummy.position.set(absX, absY, absZ);
        dummy.updateMatrix();
        currentMesh.setMatrixAt(currentI, dummy.matrix);

        let blockColor = voxel.color;
        if (!blockColor || typeof blockColor !== 'string' || !blockColor.startsWith('#') || blockColor.includes('NaN')) {
          if (voxel.tex === 'lava') blockColor = '#ff5d00';
          else if (voxel.tex === 'acid') blockColor = '#2ecc71';
          else blockColor = voxel.tex === 'grass' ? '#51852E' : '#ffffff';
        }
        
        let finalColor = new THREE.Color(blockColor);
        if (isFluid) {
            let depth = 0;
            let checkZ = absZ + 32;
            while (true) {
                const topVoxel = this.engine.mapManager.getVoxelAt(absX, absY, checkZ);
                if (topVoxel && (topVoxel.tex === 'water' || topVoxel.tex === 'water_flow' || topVoxel.tex === 'lava' || topVoxel.tex === 'acid')) {
                    depth++;
                    checkZ += 32;
                } else {
                    break;
                }
            }
            if (depth > 0) {
                const darkenFactor = Math.max(0.3, 1.0 - (depth * 0.2));
                finalColor.multiplyScalar(darkenFactor);
            }
        }
        currentMesh.setColorAt(currentI, finalColor);

        const blockId = nameToId[voxel.tex];
        const voxelDef = blockId ? BlockRegistry[blockId] : null;
        let mainAtlasPos, sidesAtlasPos, bottomAtlasPos;

        if (voxelDef && voxelDef.faces) {
          mainAtlasPos = this.atlasMap[voxelDef.name];
          sidesAtlasPos = this.atlasMap[voxelDef.name + '_flow'];
          if (!sidesAtlasPos) sidesAtlasPos = mainAtlasPos;
          bottomAtlasPos = this.atlasMap[voxelDef.name + '_bottom'] || mainAtlasPos;
        } else {
          let blockType = voxel.tex || 'grass';
          if (blockType === 'mud') {
            const hash = Math.abs(Math.sin(vx * 12.9898 + vy * 78.233 + vz * 37.719)) * 10000;
            blockType = `mud${Math.floor(hash) % 3 + 1}`;
          }
          mainAtlasPos = this.atlasMap[blockType] || this.atlasMap['stone'];
          sidesAtlasPos = mainAtlasPos;
          bottomAtlasPos = mainAtlasPos;
        }

        const uvScaleX = 64 / 256; const uvScaleY = 64 / 256;
        
        if (currentFluidAttr) currentFluidAttr.setX(currentI, isFluid ? 1.0 : 0.0);
        
        if (currentUVTop) {
          const tx = mainAtlasPos ? mainAtlasPos.x : 0; const ty = mainAtlasPos ? mainAtlasPos.y : 0;
          currentUVTop.setXYZW(currentI, tx * uvScaleX, 1.0 - ((ty + 1) * uvScaleY), uvScaleX, uvScaleY);
        }
        if (currentUVSide) {
          const sx = sidesAtlasPos ? sidesAtlasPos.x : 0; const sy = sidesAtlasPos ? sidesAtlasPos.y : 0;
          currentUVSide.setXYZW(currentI, sx * uvScaleX, 1.0 - ((sy + 1) * uvScaleY), uvScaleX, uvScaleY);
        }
        if (currentUVBottom) {
          const bx = bottomAtlasPos ? bottomAtlasPos.x : 0; const by = bottomAtlasPos ? bottomAtlasPos.y : 0;
          currentUVBottom.setXYZW(currentI, bx * uvScaleX, 1.0 - ((by + 1) * uvScaleY), uvScaleX, uvScaleY);
        }
    }
    
    this.voxelMesh.count = iCube;
    this.slabMesh.count = iSlab;
    this.rampMesh.count = iRamp;
    this.decorMesh.count = iDecor;
    
    [this.voxelMesh, this.slabMesh, this.rampMesh, this.decorMesh].forEach(m => {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      if (m.geometry.attributes.instanceUVTop) m.geometry.attributes.instanceUVTop.needsUpdate = true;
      if (m.geometry.attributes.instanceUVSide) m.geometry.attributes.instanceUVSide.needsUpdate = true;
      if (m.geometry.attributes.instanceUVBottom) m.geometry.attributes.instanceUVBottom.needsUpdate = true;
      if (m.geometry.attributes.isFluid) m.geometry.attributes.isFluid.needsUpdate = true;
    });
    
    if (!this.initialLoadComplete) {
      this.initialLoadComplete = true;
      if (this.engine.ui) this.engine.ui.hideLoadingScreen();
    }
  }

  updateEntities() {
    const activeEntities = new Set();

    const updateEntityMesh = (entity, id) => {
      activeEntities.add(id);
      let group = this.entityMeshes.get(id);
      
      if (!group) {
        group = new THREE.Group();

        const mat = new THREE.SpriteMaterial({ 
          transparent: true, 
          alphaTest: 0.1,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1
        });
        const sprite = new THREE.Sprite(mat);
        group.add(sprite);
        group.userData.sprite = sprite;

        if (!id.startsWith('proj_')) {
          const shadowGeo = new THREE.CircleGeometry(12, 16);
          const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false });
          const shadow = new THREE.Mesh(shadowGeo, shadowMat);
          group.add(shadow);
          group.userData.shadow = shadow;
        }

        this.scene.add(group);
        this.entityMeshes.set(id, group);
      }

      const sprite = group.userData.sprite;
      const shadow = group.userData.shadow;

      let state = entity.state || 'idle';
      if (state === 'dead') state = 'death';
      else if (entity.hurtTimer > 0) state = 'hurt';

      let width = 192;
      let height = 192;
      let zOffset = 0;
      if (state === 'attack1' || state === 'attack2' || state === 'throw_attack1') {
        width = 288;
        height = 288;
        zOffset = -48;
      }
      sprite.scale.set(width, height, 1);

      // This is PLAYER SPRITE HEIGHT
      const groundOffset = -50

      sprite.position.set(0, 0, (height / 2) + zOffset + groundOffset);
      
      group.position.set(entity.x, entity.y, entity.z || 0);

      if (shadow) {
        shadow.visible = !!this.engine.clientSettings.showBaseplates;
        const terrainZ = this.engine.getTerrainZ(entity.x, entity.y, entity.z || 0);
        shadow.position.set(0, 0, terrainZ - (entity.z || 0) + 0.5);

        const heightDiff = Math.max(0, (entity.z || 0) - terrainZ);
        const shadowScale = Math.max(0.1, 1 - (heightDiff / 200));
        shadow.scale.set(shadowScale, shadowScale, 1);
      }

      const relDir = this.getRelativeSpriteDirection(entity.dir || 'down');
      const tex = this.textures[state] || this.textures['idle'];
      
      if (tex) {
        
        if (sprite.userData.state !== state) {
          sprite.material.map = tex.clone();
          sprite.userData.state = state;
          sprite.material.needsUpdate = true;
        }
        
        let dirCols = {
          'up-left': 0, 'left': 1, 'down-left': 2, 'down': 3,
          'down-right': 4, 'right': 5, 'up-right': 6, 'up': 7
        };

        const colIndex = dirCols[relDir] !== undefined ? dirCols[relDir] : 3;
        const rows = tex.userData.rows || 8;

        sprite.material.map.offset.x = colIndex / 8;
        sprite.material.map.offset.y = 1.0 - (((entity.frame || 0) % rows) + 1) * (1 / rows);

        const maxFrames = this.engine.entityManager.getFrameCount(entity.state || 'idle');
        if (state === 'death' && (entity.frame || 0) >= maxFrames - 1) {
          group.visible = false;
        } else {
          group.visible = true;
        }
      }
    };
    if (this.engine.player) updateEntityMesh(this.engine.player, 'player_self');
    for (const id in this.engine.otherPlayers) updateEntityMesh(this.engine.otherPlayers[id], `player_${id}`);
    this.engine.npcs.forEach(npc => updateEntityMesh(npc, `npc_${npc.uuid}`));
    for (const [id, group] of this.entityMeshes.entries()) {
      if (!activeEntities.has(id) && !id.startsWith('proj_')) {
        this.scene.remove(group);
        if (group.userData.sprite) group.userData.sprite.material.dispose();
        if (group.userData.shadow) {
          group.userData.shadow.material.dispose();
          group.userData.shadow.geometry.dispose();
        }
        this.entityMeshes.delete(id);
      }
    }
  }

  updateProjectiles() {
    if (!this.engine.projectiles) return;
    const activeProjs = new Set();
    
    this.engine.projectiles.forEach((proj, idx) => {
      const id = `proj_${idx}`;
      activeProjs.add(id);
      
      let group = this.projectileMeshes.get(id);
      if (!group) {
        group = new THREE.Group();
        const mat = new THREE.SpriteMaterial({ transparent: true, alphaTest: 0.1 });
        const sprite = new THREE.Sprite(mat);
        group.add(sprite);
        group.userData.sprite = sprite;

        const shadowGeo = new THREE.CircleGeometry(6, 16);
        const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false });
        const shadow = new THREE.Mesh(shadowGeo, shadowMat);
        group.add(shadow);
        group.userData.shadow = shadow;

        this.scene.add(group);
        this.projectileMeshes.set(id, group);
      }

      const sprite = group.userData.sprite;
      const shadow = group.userData.shadow;

      let isLeft = false;
      
      if (proj.isCritLoop && proj.loopPitch !== undefined) {
        const v1 = new THREE.Vector3(proj.startX, proj.startY, proj.startZ).project(this.camera);
        const v2 = new THREE.Vector3(proj.targetX, proj.targetY, proj.targetZ).project(this.camera);
        const baseAngle = Math.atan2(v2.y - v1.y, v2.x - v1.x);
        
        isLeft = Math.abs(baseAngle) > Math.PI / 2;
        sprite.material.rotation = baseAngle + (isLeft ? -proj.loopPitch : proj.loopPitch);
        proj.lastAngle = sprite.material.rotation;
      } else if (proj.lastX !== undefined) {
        const v1 = new THREE.Vector3(proj.lastX, proj.lastY, proj.lastZ).project(this.camera);
        const v2 = new THREE.Vector3(proj.x, proj.y, proj.z).project(this.camera);
        const dxScreen = v2.x - v1.x;
        const dyScreen = v2.y - v1.y;
        if (Math.abs(dxScreen) > 0.00001 || Math.abs(dyScreen) > 0.00001) {
          const angle = Math.atan2(dyScreen, dxScreen);
          sprite.material.rotation = angle;
          isLeft = Math.abs(angle) > Math.PI / 2;
          proj.lastAngle = angle;
        } else if (proj.lastAngle !== undefined) {
          sprite.material.rotation = proj.lastAngle;
          isLeft = Math.abs(proj.lastAngle) > Math.PI / 2;
        }
      } else {
        const v1 = new THREE.Vector3(proj.startX, proj.startY, proj.startZ).project(this.camera);
        const v2 = new THREE.Vector3(proj.targetX, proj.targetY, proj.targetZ).project(this.camera);
        const angle = Math.atan2(v2.y - v1.y, v2.x - v1.x);
        sprite.material.rotation = angle;
        isLeft = Math.abs(angle) > Math.PI / 2;
        proj.lastAngle = angle;
      }
      
      proj.lastX = proj.x;
      proj.lastY = proj.y;
      proj.lastZ = proj.z;

      sprite.scale.set(64, 64, 1);

      sprite.position.set(0, 0, 0);
      group.position.set(proj.x, proj.y, proj.z);

      if (shadow) {
        const tz = this.engine.getTerrainZ(proj.x, proj.y, proj.z);
        const heightDiff = Math.max(0, proj.z - tz);
        const shadowScale = Math.max(0.5, 1 - (heightDiff / 200));
        shadow.scale.set(shadowScale, shadowScale, 1);
        shadow.position.set(0, 0, tz - proj.z + 0.5); 
      }

      const tex = this.textures['proj_airplane'];
      if (tex) {
        if (sprite.userData.tex !== 'proj_airplane') {
          sprite.material.map = tex.clone();
          sprite.userData.tex = 'proj_airplane';
          sprite.material.needsUpdate = true;
        }
        const frameCount = 4;
        const frameIndex = Math.floor(performance.now() / 80) % frameCount; 
        
        if (isLeft) {
          sprite.material.map.repeat.set(1 / frameCount, -1);
          sprite.material.map.offset.set(frameIndex / frameCount, 1);
        } else {
          sprite.material.map.repeat.set(1 / frameCount, 1);
          sprite.material.map.offset.set(frameIndex / frameCount, 0);
        }
      }
    });

    for (const [id, group] of this.projectileMeshes.entries()) {
      if (!activeProjs.has(id)) {
        this.scene.remove(group);
        if (group.userData.sprite) group.userData.sprite.material.dispose();
        if (group.userData.shadow) {
          group.userData.shadow.material.dispose();
          group.userData.shadow.geometry.dispose();
        }
        this.projectileMeshes.delete(id);
      }
    }
  }

  updateParticles() {
    if (!this.engine.particles) return;
    
    if (!this.particleMesh) {
      const pGeo = new THREE.PlaneGeometry(1, 1);
      const uvsMain = new Float32Array(2000 * 4);
      const uvsSides = new Float32Array(2000 * 4);
      pGeo.setAttribute('instanceUVTop', new THREE.InstancedBufferAttribute(uvsMain, 4));
      pGeo.setAttribute('instanceUVSide', new THREE.InstancedBufferAttribute(uvsSides, 4));
      pGeo.setAttribute('instanceUVBottom', new THREE.InstancedBufferAttribute(uvsSides, 4));
      
      const pMat = this.instancedMaterial.clone();
      pMat.onBeforeCompile = this.instancedMaterial.onBeforeCompile;
      pMat.side = THREE.DoubleSide;
      pMat.transparent = true;
      pMat.alphaTest = 0.1;
      this.particleMesh = new THREE.InstancedMesh(pGeo, pMat, 2000);
      this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.particleMesh.frustumCulled = false;
      
      const colors = new Float32Array(2000 * 3);
      this.particleMesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
      this.scene.add(this.particleMesh);
    }

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const uvAttr = this.particleMesh.geometry.attributes.instanceUVTop;
    const uvAttrSides = this.particleMesh.geometry.attributes.instanceUVSide;
    const uvAttrBottom = this.particleMesh.geometry.attributes.instanceUVBottom;
    let count = 0;

    this.engine.particles.forEach(p => {
      if (count >= 2000) return;
      dummy.position.set(p.x, p.y, p.z);
      dummy.quaternion.copy(this.camera.quaternion);
      if (p.rot) dummy.rotateZ(p.rot);
      
      let scale = p.size * 2 * Math.max(0.1, p.life / p.maxLife);
      if (p.isPop) {
        scale = p.size * 2 * (1.0 + (1.0 - (p.life / p.maxLife)) * 1.5);
      }
      
      dummy.scale.set(scale, scale, 1);
      dummy.updateMatrix();
      
      this.particleMesh.setMatrixAt(count, dummy.matrix);
      
      const colorStr = p.color || '#ffffff';
      let rgbaMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (rgbaMatch) {
         color.setRGB(parseInt(rgbaMatch[1])/255, parseInt(rgbaMatch[2])/255, parseInt(rgbaMatch[3])/255);
      } else {
         color.setStyle(colorStr);
      }
      
      if (p.isPop) {
        color.lerp(new THREE.Color(0xffffff), 1.0 - (p.life / p.maxLife));
      }
      this.particleMesh.setColorAt(count, color);

      // Map a random subset of the block's texture to the particle
      let blockType = p.tex || 'white';
      
      // Force 'bubble' or 'smoke' textures correctly
      if (p.tex === 'bubble') blockType = 'bubble';
      else if (p.tex === 'smoke') blockType = 'smoke';
      else if (blockType === 'mud') blockType = 'mud1'; // Fallback mapping for particle chunks
      if (blockType === 'ice') blockType = 'ice';
      const atlasPos = this.atlasMap[blockType] || this.atlasMap['white'];
      const uvScaleX = 64 / 256;
      const uvScaleY = 64 / 256;
      
      let subUvX = p.uvOffsetX !== undefined ? p.uvOffsetX : 0;
      let subUvY = p.uvOffsetY !== undefined ? p.uvOffsetY : 0;
      let subScale = p.uvScale !== undefined ? p.uvScale : 1;
      
      const finalUvOffsetX = (atlasPos.x + subUvX) * uvScaleX;
      const finalUvOffsetY = 1.0 - ((atlasPos.y + 1 - subUvY) * uvScaleY);
      
      uvAttr.setXYZW(count, finalUvOffsetX, finalUvOffsetY, uvScaleX * subScale, uvScaleY * subScale);
      uvAttrSides.setXYZW(count, finalUvOffsetX, finalUvOffsetY, uvScaleX * subScale, uvScaleY * subScale);
      uvAttrBottom.setXYZW(count, finalUvOffsetX, finalUvOffsetY, uvScaleX * subScale, uvScaleY * subScale);

      count++;
    });

    this.particleMesh.count = count;
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
    uvAttr.needsUpdate = true;
    uvAttrSides.needsUpdate = true;
    uvAttrBottom.needsUpdate = true;
  }

  updateDebris() {
    if (!this.engine.debris) return;
    const activeDebris = new Set();

    this.engine.debris.forEach((deb, idx) => {
      const id = `deb_${idx}`;
      activeDebris.add(id);

      let group = this.debrisMeshes.get(id);
      if (!group) {
        group = new THREE.Group();
        const mat = new THREE.SpriteMaterial({ transparent: true, alphaTest: 0.01 });
        const sprite = new THREE.Sprite(mat);
        group.add(sprite);
        group.userData.sprite = sprite;

        const shadowGeo = new THREE.CircleGeometry(4, 16);
        const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false });
        const shadow = new THREE.Mesh(shadowGeo, shadowMat);
        group.add(shadow);
        group.userData.shadow = shadow;

        this.scene.add(group);
        this.debrisMeshes.set(id, group);
      }

      const sprite = group.userData.sprite;
      const shadow = group.userData.shadow;

      let texName = deb.wasteTex;
      if (deb.isCharred) texName = 'charred_1';
      else if (deb.crumpleTimer > 0.2) texName = 'cronched_1';
      else if (deb.crumpleTimer > 0.1) texName = 'cronched_2';
      else if (deb.crumpleTimer > 0) texName = 'cronched_3';

      const tex = this.textures[texName];
      if (tex && sprite.userData.tex !== texName) {
        sprite.material.map = tex;
        sprite.userData.tex = texName;
        sprite.material.needsUpdate = true;
      }

      sprite.scale.set(48, 48, 1);
      sprite.material.rotation = deb.rotation || 0;
      sprite.material.opacity = deb.life < 1.0 ? deb.life : 1.0;
      
      const fadeStart = 3.0;
      const currentOpacity = deb.life < fadeStart ? Math.max(0, deb.life / fadeStart) : 1.0;
      sprite.material.opacity = currentOpacity;

      sprite.position.set(0, 0, 0);
      group.position.set(deb.x, deb.y, deb.z);

      if (shadow) {
        const tz = this.engine.getTerrainZ(deb.x, deb.y, deb.z);
        const heightDiff = Math.max(0, deb.z - tz);
        const shadowScale = Math.max(0.1, 1 - (heightDiff / 100));
        shadow.scale.set(shadowScale, shadowScale, 1);
        shadow.material.opacity = currentOpacity * 0.4;
      }
    });

    for (const [id, group] of this.debrisMeshes.entries()) {
      if (!activeDebris.has(id)) {
        this.scene.remove(group);
        if (group.userData.sprite) group.userData.sprite.material.dispose();
        if (group.userData.shadow) {
          group.userData.shadow.material.dispose();
          group.userData.shadow.geometry.dispose();
        }
        this.debrisMeshes.delete(id);
      }
    }
  }

  updateCameraTracking() {
    const p = this.engine.player;
    if (!p) return;
    
    // The camera stays fixed at an isometric angle, but its physical location
    // must orbit the player based on the current cameraAngle.
    const camOffsetDist = 500;
    const zRotOffset = -this.cameraAngle * (Math.PI / 180);
    // Calculate the orbit angle relative to the player
    const orbitAngle = (Math.PI / 4) + zRotOffset; 
    
    const cx = this.engine.camera.x ?? 0;
    const cy = this.engine.camera.y ?? 0;
    const cz = this.engine.camera.z ?? 0;
    
    this.camera.position.x = cx + (Math.sin(orbitAngle) * camOffsetDist);
    this.camera.position.y = cy + (Math.cos(orbitAngle) * camOffsetDist);
    this.camera.position.z = cz + (camOffsetDist * Math.tan(Math.atan(1 / Math.sqrt(2))));
    
    this.camera.lookAt(cx, cy, cz);
    // Force a matrix update so the Raycaster perfectly aligns with the new camera position!
    this.camera.updateMatrixWorld();
  }

  updateArrowHelper() {
    const eng = this.engine;
    if (!eng.player || eng.player.state === 'death' || !this.camera || !this.arrowHelper) {
      if (this.arrowHelper) this.arrowHelper.visible = false;
      if (this.debugOverlay) this.debugOverlay.style.display = 'none';
      return;
    }
    
    const mouse = new THREE.Vector2();
    mouse.x = (eng.input.mousePos.x / window.innerWidth) * 2 - 1;
    mouse.y = -(eng.input.mousePos.y / window.innerHeight) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);

    let targetPoint = null;
    let blockHit = null;
    
    if (this.previewCubeMesh) this.previewCubeMesh.count = 0;
    if (this.previewSlabMesh) this.previewSlabMesh.count = 0;
    if (this.previewRampMesh) this.previewRampMesh.count = 0;

    eng.cursorGridPos = null;

    const buildMeshes = [this.voxelMesh, this.slabMesh, this.rampMesh].filter(Boolean);
    if (buildMeshes.length > 0) {
      const hits = raycaster.intersectObjects(buildMeshes);
      if (hits.length > 0) {
        targetPoint = hits[0].point;
        blockHit = hits[0];
      }
    }

    if (!targetPoint) {
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -(eng.player.z || 0));
      targetPoint = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(plane, targetPoint)) targetPoint = null;
    }

    this.highlightBox.visible = false;

    if (eng.editMode && targetPoint && (eng.devOptions.showTile || eng.devOptions.useBlockPreview)) {
      let hitPos = new THREE.Vector3();
      let normal = new THREE.Vector3(0, 0, 1);
      
      if (blockHit) {
        const matrix = new THREE.Matrix4();
        blockHit.object.getMatrixAt(blockHit.instanceId, matrix);
        hitPos.setFromMatrixPosition(matrix);
        const rawNormal = blockHit.face ? blockHit.face.normal.clone() : new THREE.Vector3(0, 0, 1);
        const absX = Math.abs(rawNormal.x); const absY = Math.abs(rawNormal.y); const absZ = Math.abs(rawNormal.z);
        if (absZ >= absX && absZ >= absY) normal.set(0, 0, Math.sign(rawNormal.z));
        else if (absX > absY) normal.set(Math.sign(rawNormal.x), 0, 0);
        else normal.set(0, Math.sign(rawNormal.y), 0);
      } else {
        hitPos.copy(targetPoint);
      }

      let targetX = Math.round(hitPos.x / 32) * 32; 
      let targetY = Math.round(hitPos.y / 32) * 32; 
      let targetZ = Math.round(hitPos.z / 32) * 32;
      eng.cursorGridPos = { x: targetX, y: targetY, z: targetZ };

      if (eng.devOptions.showTile && !eng.devOptions.useBlockPreview) {
        this.highlightBox.position.set(targetX, targetY, targetZ);
        this.highlightBox.material.color.setHex(0xf1c40f);
        this.highlightBox.visible = true;
      }

      if (eng.devOptions.useBlockPreview) {
        const activeSlot = document.querySelector('.hotbar-slot.active');
        const tex = activeSlot ? activeSlot.dataset.tex : 'stone';
        const isDeleting = eng.input.keys['shift'] || tex === 'erase';
        const isPicker = tex === 'picker';

        if (isPicker) {
           this.highlightBox.position.set(targetX, targetY, targetZ);
           this.highlightBox.material.color.setHex(0x9b59b6); // Purple for picker
           this.highlightBox.visible = true;
        } else if (isDeleting) {
           this.highlightBox.position.set(targetX, targetY, targetZ);
           this.highlightBox.material.color.setHex(0xff4757); // Red for delete
           this.highlightBox.visible = true;
        } else {
           let placeShape = eng.editShape || 'cube';
           if (placeShape === 'ramp_player') {
              const pDir = eng.player.dir;
              if (pDir.includes('up')) placeShape = 'ramp_n';
              else if (pDir.includes('down')) placeShape = 'ramp_s';
              else if (pDir.includes('right')) placeShape = 'ramp_e';
              else if (pDir.includes('left')) placeShape = 'ramp_w';
              else placeShape = 'ramp_s';
           }
           const colorPicker = document.getElementById('build-color-picker');
           const colorHex = colorPicker ? colorPicker.value : '#ffffff';
           const clickedVoxel = eng.mapManager.getVoxelAt(targetX, targetY, targetZ);

           if (clickedVoxel && clickedVoxel.shape === 'slab' && normal.z === 1 && clickedVoxel.tex === tex && clickedVoxel.color === colorHex) {
             placeShape = 'cube';
           } else {
             targetX += normal.x * 32; targetY += normal.y * 32; targetZ += normal.z * 32;
           }

           let currentMesh; const dummy = new THREE.Object3D(); dummy.position.set(targetX, targetY, targetZ);
           if (placeShape === 'slab') { currentMesh = this.previewSlabMesh; }
           else if (placeShape.startsWith('ramp')) { 
             currentMesh = this.previewRampMesh; 
             if (placeShape === 'ramp_e') dummy.rotation.set(0, 0, -Math.PI / 2);
             else if (placeShape === 'ramp_n') dummy.rotation.set(0, 0, Math.PI); // Corrected from -Math.PI to Math.PI
             else if (placeShape === 'ramp_w') dummy.rotation.set(0, 0, Math.PI / 2);
           } else { currentMesh = this.previewCubeMesh; }

           dummy.updateMatrix(); currentMesh.setMatrixAt(0, dummy.matrix); currentMesh.setColorAt(0, new THREE.Color(colorHex));
           
           const nameToId = {};
           for (const id in BlockRegistry) {
             nameToId[BlockRegistry[id].name] = id;
           }

           const blockId = nameToId[tex];
           const voxelDef = blockId ? BlockRegistry[blockId] : null;
           let mainAtlasPos, sidesAtlasPos, bottomAtlasPos;
           if (voxelDef && voxelDef.faces) {
             mainAtlasPos = { x: voxelDef.faces.top[0], y: voxelDef.faces.top[1] };
             sidesAtlasPos = { x: voxelDef.faces.sides[0], y: voxelDef.faces.sides[1] };
             bottomAtlasPos = { x: voxelDef.faces.bottom[0], y: voxelDef.faces.bottom[1] };
           } else {
             mainAtlasPos = this.atlasMap[tex] || this.atlasMap['stone'];
             sidesAtlasPos = mainAtlasPos;
             bottomAtlasPos = mainAtlasPos;
           }

           const setUVs = (uvAttr, atlasPos) => {
             uvAttr.setXYZW(0, atlasPos.x * (64/256), 1.0 - ((atlasPos.y + 1) * (64/256)), 64/256, 64/256);
           };
           setUVs(currentMesh.geometry.attributes.instanceUVTop, mainAtlasPos);
           setUVs(currentMesh.geometry.attributes.instanceUVSide, sidesAtlasPos);
           setUVs(currentMesh.geometry.attributes.instanceUVBottom, bottomAtlasPos);
           const isFluid = tex === 'water' || tex === 'water_flow' || tex === 'lava' || tex === 'acid';
           if (currentMesh.geometry.attributes.isFluid) currentMesh.geometry.attributes.isFluid.setX(0, isFluid ? 1.0 : 0.0);

           currentMesh.count = 1; currentMesh.instanceMatrix.needsUpdate = true;
           if (currentMesh.instanceColor) currentMesh.instanceColor.needsUpdate = true;
           currentMesh.geometry.attributes.instanceUVTop.needsUpdate = true;
           currentMesh.geometry.attributes.instanceUVSide.needsUpdate = true;
           currentMesh.geometry.attributes.instanceUVBottom.needsUpdate = true;
           if (currentMesh.geometry.attributes.isFluid) currentMesh.geometry.attributes.isFluid.needsUpdate = true;
        }
      }
    }

    if (targetPoint) {
      const feetPos = new THREE.Vector3(eng.player.x, eng.player.y, eng.player.z || 0);
      const chestPos = new THREE.Vector3(eng.player.x, eng.player.y, (eng.player.z || 0) + 20);
      
      this.arrowHelper.visible = false;
      if (this.debugOverlay) this.debugOverlay.style.display = 'none';

      if (eng.devOptions.showDistPlayerToMouse && eng.devOptions.useDebugTooltip) {
        const mathDir = new THREE.Vector3().copy(targetPoint).sub(feetPos);
        const dist = mathDir.length();
        
        this.arrowHelper.visible = true;
        
        if (dist > 0.001) {
          const visualDir = new THREE.Vector3().copy(targetPoint).sub(chestPos);
          const visualDist = visualDir.length();
          visualDir.normalize();
          this.arrowHelper.setDirection(visualDir);
          this.arrowHelper.setLength(visualDist, Math.min(visualDist * 0.2, 20), Math.min(visualDist * 0.05, 10));
          this.arrowHelper.position.copy(chestPos);
        }
        if (this.debugOverlay) {
          this.debugOverlay.style.display = 'block';
          this.debugOverlay.style.left = (eng.input.mousePos.x + 20) + 'px';
          this.debugOverlay.style.top = (eng.input.mousePos.y + 20) + 'px';
          this.debugOverlay.innerHTML = `
            <strong style="color: #f1c40f; border-bottom: 1px solid #f1c40f; padding-bottom: 3px; display: inline-block; margin-bottom: 5px;">Raycast Trace</strong><br>
            Cursor XYZ: <span style="color: #2ecc71;">${Math.round(targetPoint.x)}, ${Math.round(targetPoint.y)}, ${Math.round(targetPoint.z)}</span><br>
            Player XYZ: <span style="color: #3498db;">${Math.round(feetPos.x)}, ${Math.round(feetPos.y)}, ${Math.round(feetPos.z)}</span><br>
            Trace Diff: <span style="color: #e74c3c;">${Math.round(targetPoint.x - feetPos.x)}, ${Math.round(targetPoint.y - feetPos.y)}, ${Math.round(targetPoint.z - feetPos.z)}</span><br>
            Distance: &nbsp;&nbsp;<span style="color: #f39c12;">${Math.round(dist)}</span>
          `;
        }
      }

      if (this.debugCtx && !eng.devOptions.useDebugTooltip) {
        const ctx = this.debugCtx;
        
        const drawDashedTrace = (origin, target, originLabel, targetLabel, color) => {
          const p1 = origin.clone().project(this.camera);
          const p2 = target.clone().project(this.camera);
          const sx1 = (p1.x + 1) / 2 * window.innerWidth;
          const sy1 = -(p1.y - 1) / 2 * window.innerHeight;
          const sx2 = (p2.x + 1) / 2 * window.innerWidth;
          const sy2 = -(p2.y - 1) / 2 * window.innerHeight;
          
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(sx1, sy1);
            ctx.lineTo(sx2, sy2);
            ctx.stroke();
            ctx.fillStyle = '#ff4757';
            ctx.fillRect(sx1 - 2, sy1 - 2, 4, 4);
            ctx.fillRect(sx2 - 2, sy2 - 2, 4, 4);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'left';
            ctx.strokeStyle = 'rgba(0,0,0,0.8)';
            ctx.lineWidth = 3;
            ctx.strokeText(`${originLabel} X:${Math.round(origin.x)} Y:${Math.round(origin.y)} Z:${Math.round(origin.z)}`, sx1 + 10, sy1);
            ctx.fillText(`${originLabel} X:${Math.round(origin.x)} Y:${Math.round(origin.y)} Z:${Math.round(origin.z)}`, sx1 + 10, sy1);
            ctx.strokeText(`${targetLabel} X:${Math.round(target.x)} Y:${Math.round(target.y)} Z:${Math.round(target.z)}`, sx2 + 10, sy2);
            ctx.fillText(`${targetLabel} X:${Math.round(target.x)} Y:${Math.round(target.y)} Z:${Math.round(target.z)}`, sx2 + 10, sy2);
            ctx.textAlign = 'center';
            const midX = (sx1 + sx2) / 2;
            const midY = (sy1 + sy2) / 2;
            const dx = target.x - origin.x;
            const dy = target.y - origin.y;
            const dz = target.z - origin.z;
            const dist = Math.hypot(Math.hypot(dx, dy), dz);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            const text = `Dist: ${Math.round(dist)} | XYZ: ${Math.round(dx)}, ${Math.round(dy)}, ${Math.round(dz)} | Ang: ${Math.round(angle)}°`;
            
            let screenAngle = Math.atan2(sy2 - sy1, sx2 - sx1);
            if (sx1 > sx2) screenAngle += Math.PI; // Prevent text from rendering upside down
            ctx.save();
            ctx.translate(midX, midY);
            ctx.rotate(screenAngle);
            ctx.strokeText(text, 0, -10);
            ctx.fillText(text, 0, -10);
            ctx.restore();
            ctx.restore();
        };

        if (eng.devOptions.showDistPlayerToMouse) {
          drawDashedTrace(feetPos, targetPoint, "Player", "Mouse", "#2ecc71");
        }
        
        if (eng.selectedTarget && eng.selectedTarget.type === 'npc') {
          const npc = eng.npcs.find(n => n.uuid === eng.selectedTarget.id);
          if (npc) {
            const npcPos = new THREE.Vector3(npc.x, npc.y, npc.z || 0);
            if (eng.devOptions.showDistToNPC) drawDashedTrace(feetPos, npcPos, "Player", "NPC", "#f1c40f");
            if (eng.devOptions.showDistNpcToMouse) drawDashedTrace(npcPos, targetPoint, "NPC", "Mouse", "#e74c3c");
          }
        }
      }
    }
    
    eng.mouseWorldPos = targetPoint;
  }

  draw() {
    const eng = this.engine;
    
    if (this.instancedMaterial && this.instancedMaterial.userData.time) {
        this.instancedMaterial.userData.time.value = performance.now() / 1000;
    }

    // Handle resizing logic
    if (this.webgl.domElement.width !== window.innerWidth || this.webgl.domElement.height !== window.innerHeight) {
      this.webgl.setSize(window.innerWidth, window.innerHeight);
      const aspect = window.innerWidth / window.innerHeight;
      const frustumSize = 1000;
      this.camera.left = frustumSize * aspect / -2;
      this.camera.right = frustumSize * aspect / 2;
      this.camera.updateProjectionMatrix();
    }

    if (this.debugCanvas) {
      if (this.debugCanvas.width !== window.innerWidth || this.debugCanvas.height !== window.innerHeight) {
        this.debugCanvas.width = window.innerWidth;
        this.debugCanvas.height = window.innerHeight;
      }
      this.debugCtx.clearRect(0, 0, this.debugCanvas.width, this.debugCanvas.height);
    }

    this.updateAnimatedTiles();
    this.updateVoxels();
    this.updateEntities();
    this.updateProjectiles();
    this.updateParticles();
    this.updateDebris();
    this.updateCameraTracking();
    this.updateArrowHelper();
    this.update3DDebug();

    if (this.debugCtx) {
      const ctx = this.debugCtx;
      this.update2DOverlay();
      ctx.save();
      ctx.fillStyle = '#f1c40f';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'right';
      ctx.strokeStyle = '#000';
      let textY = window.innerHeight - 80;

      if (eng.clientSettings.showCoords && eng.player) {
        const text = `XYZ: ${Math.round(eng.player.x)}, ${Math.round(eng.player.y)}, ${Math.round(eng.player.z || 0)}`;
        ctx.strokeText(text, window.innerWidth - 20, textY);
        ctx.fillText(text, window.innerWidth - 20, textY);
        textY -= 20;
      }

      if (eng.clientSettings.showPing) {
        const text = `Ping: ${eng.ping}ms`;
        ctx.strokeText(text, window.innerWidth - 20, textY);
        ctx.fillText(text, window.innerWidth - 20, textY);
        textY -= 20;
      }
      if (eng.clientSettings.showFPS) {
        const text = `FPS: ${eng.fps}`;
        ctx.strokeText(text, window.innerWidth - 20, textY);
        ctx.fillText(text, window.innerWidth - 20, textY);
        textY -= 20;
      }
      ctx.restore();
    }
    this.webgl.render(this.scene, this.camera);
  }

  update3DDebug() {
    const eng = this.engine;
    if (!eng.player || eng.player.state === 'death') {
      this.targetRing.visible = false;
      this.meleeCircle.visible = false;
      this.meleeCone.visible = false;
      this.losCone.visible = false;
      this.losMesh.visible = false;
      this.losLineMesh.visible = false;
      this.meleeHitMesh.visible = false;
      this.meleeHitLineMesh.visible = false;
      this.debugTileMesh.visible = false;
      this.chunkBox.visible = false;
      return;
    }

    if (eng.selectedTarget) {
      let tx, ty, tz;
      if (eng.selectedTarget.type === 'npc') {
        const npc = eng.npcs.find(n => n.uuid === eng.selectedTarget.id);
        if (npc && npc.state !== 'dead') { tx = npc.x; ty = npc.y; tz = npc.z; }
      } else if (eng.selectedTarget.type === 'player') {
        const op = eng.otherPlayers[eng.selectedTarget.id];
        if (op && op.state !== 'death') { tx = op.x; ty = op.y; tz = op.z; }
      } else if (eng.selectedTarget.type === 'self' && eng.player.state !== 'death') {
        tx = eng.player.x; ty = eng.player.y; tz = eng.player.z;
      }
      if (tx !== undefined) {
        this.targetRing.position.set(tx, ty, (tz || 0) + 1);
        this.targetRing.visible = true;
      } else {
        this.targetRing.visible = false;
      }
    } else {
      this.targetRing.visible = false;
    }

    if (eng.devOptions.showMelee) {
      this.meleeCircle.visible = true;

      const dirAngleMap = {
        'down-left': 0, 'down': Math.PI / 4, 'down-right': Math.PI / 2, 'right': Math.PI * 0.75,
        'up-right': Math.PI, 'up': -Math.PI * 0.75, 'up-left': -Math.PI / 2, 'left': -Math.PI / 4
      };
      this.meleeCone.position.set(eng.player.x, eng.player.y, (eng.player.z || 0) + 1.1);
      this.meleeCone.rotation.z = dirAngleMap[eng.player.dir] || 0;
      this.meleeCone.visible = true;

      let hitCount = 0;
      const dummy = new THREE.Object3D();
      const checkMeleeHit = (tx, ty, tz) => {
        const pz = eng.player.z || 0;
        if (Math.abs(pz - (tz || 0)) > 48) return false;
        const dist = Math.hypot(tx - eng.player.x, ty - eng.player.y);
        if (dist > 200) return false;
        let angleDiff = Math.atan2(ty - eng.player.y, tx - eng.player.x) - this.meleeCone.rotation.z;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        if (Math.abs(angleDiff) > Math.PI / 3) return false;
        return true;
      }
      const addMeleeBaseplate = (entity) => {
        if (hitCount >= 100) return;
        if (checkMeleeHit(entity.x, entity.y, entity.z)) {
          dummy.position.set(entity.x, entity.y, (entity.z || 0) + 1);
          dummy.updateMatrix();
          this.meleeHitMesh.setMatrixAt(hitCount, dummy.matrix);
          this.meleeHitLineMesh.setMatrixAt(hitCount++, dummy.matrix);
        }
      };
      Object.values(eng.otherPlayers).forEach(op => { if (op.state !== 'death') addMeleeBaseplate(op); });
      eng.npcs.forEach(npc => { if (npc.state !== 'dead') addMeleeBaseplate(npc); });
      
      this.meleeHitMesh.count = hitCount; this.meleeHitLineMesh.count = hitCount;
      this.meleeHitMesh.instanceMatrix.needsUpdate = true; this.meleeHitLineMesh.instanceMatrix.needsUpdate = true;
      this.meleeHitMesh.visible = true; this.meleeHitLineMesh.visible = true;
    } else {
      this.meleeCircle.visible = false;
      this.meleeCone.visible = false;
      this.meleeHitMesh.visible = false;
      this.meleeHitLineMesh.visible = false;
    }

    if (eng.devOptions.showLoS) {
      const maxDist = eng.devOptions.losDistance !== undefined ? eng.devOptions.losDistance : 400; 
      const losAngle = eng.devOptions.losAngle !== undefined ? eng.devOptions.losAngle : 60;
      const fov = (losAngle / 2) * (Math.PI / 180);

      if (this.losCone.userData.fov !== fov || this.losCone.userData.maxDist !== maxDist) {
        this.losCone.geometry.dispose();
        this.losCone.geometry = new THREE.CircleGeometry(maxDist, 32, -fov, fov * 2);
        this.losCone.children[0].geometry.dispose();
        this.losCone.children[0].geometry = new THREE.EdgesGeometry(this.losCone.geometry);
        this.losCone.userData.fov = fov;
        this.losCone.userData.maxDist = maxDist;
      }
      
      const dirAngleMap = {
        'down-left': 0, 'down': Math.PI / 4, 'down-right': Math.PI / 2, 'right': Math.PI * 0.75,
        'up-right': Math.PI, 'up': -Math.PI * 0.75, 'up-left': -Math.PI / 2, 'left': -Math.PI / 4
      };
      let facingAngle = dirAngleMap[eng.player.dir] || 0;
      
      this.losCone.position.set(eng.player.x, eng.player.y, (eng.player.z || 0) + 1.1);
      this.losCone.rotation.z = facingAngle;
      this.losCone.visible = true;

      const checkHitLoS = (tx, ty, tz) => {
        const pz = eng.player.z || 0;
        tz = tz || 0;
        if (Math.abs(pz - tz) > 48) return false; 
        const dist = Math.hypot(tx - eng.player.x, ty - eng.player.y);
        if (dist > maxDist) return false;
        const angleToTarget = Math.atan2(ty - eng.player.y, tx - eng.player.x);
        let angleDiff = angleToTarget - facingAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        if (Math.abs(angleDiff) > fov) return false; 
        const steps = Math.ceil(dist / 16);
        for (let i = 1; i <= steps; i++) {
          const sampleX = eng.player.x + ((tx - eng.player.x) * (i / steps));
          const sampleY = eng.player.y + ((ty - eng.player.y) * (i / steps));
          const terrainZ = eng.getTerrainZ(sampleX, sampleY, pz, true);
          if (terrainZ > pz + 16 && terrainZ > tz + 16) return false; 
        }
        return true;
      };

      const dummy = new THREE.Object3D();
      let hitCount = 0;
      const addLoSBaseplate = (entity) => {
        if (hitCount >= 100) return;
        if (checkHitLoS(entity.x, entity.y, entity.z)) {
          dummy.position.set(entity.x, entity.y, (entity.z || 0) + 1);
          dummy.updateMatrix();
            this.losMesh.setMatrixAt(hitCount, dummy.matrix);
            this.losLineMesh.setMatrixAt(hitCount++, dummy.matrix);
        }
      };

      Object.values(eng.otherPlayers).forEach(op => { if (op.state !== 'death') addLoSBaseplate(op); });
      eng.npcs.forEach(npc => { if (npc.state !== 'dead') addLoSBaseplate(npc); });
      
      this.losMesh.count = hitCount;
      this.losMesh.instanceMatrix.needsUpdate = true;
      this.losMesh.visible = true;
    } else {
      this.losCone.visible = false;
      this.losMesh.visible = false;
    }

    let tileHitCount = 0;
    const dummy = new THREE.Object3D();
    const addTileBox = (entity) => {
      if (tileHitCount >= 100) return;
      const tx = Math.round(entity.x / 32) * 32;
      const ty = Math.round(entity.y / 32) * 32;
      const tz = Math.round((entity.z || 0) / 32) * 32;
      dummy.position.set(tx, ty, tz);
      dummy.updateMatrix();
      this.debugTileMesh.setMatrixAt(tileHitCount++, dummy.matrix);
    };

    if (eng.devOptions.showPlayerTile && eng.player) addTileBox(eng.player);
    if (eng.devOptions.showEntityTile) {
      eng.npcs.forEach(npc => { if (npc.state !== 'dead') addTileBox(npc); });
      Object.values(eng.otherPlayers).forEach(op => { if (op.state !== 'death') addTileBox(op); });
    }
    
    this.debugTileMesh.count = tileHitCount;
    this.debugTileMesh.instanceMatrix.needsUpdate = true;
    this.debugTileMesh.visible = tileHitCount > 0;
  }

  update2DOverlay() {
    if (!this.debugCtx) return;
    const ctx = this.debugCtx;
    const eng = this.engine;

    const drawEntityBubbles = (entity) => {
        const p3d = new THREE.Vector3(entity.x, entity.y, (entity.z || 0) + 145).project(this.camera);
        const sx = (p3d.x + 1) / 2 * window.innerWidth;
        const sy = -(p3d.y - 1) / 2 * window.innerHeight;
        eng.chat.drawBubbles(ctx, sx, sy, entity.chatBubbles);
    };

    eng.npcs.forEach(npc => drawEntityBubbles(npc));
    Object.values(eng.otherPlayers).forEach(op => drawEntityBubbles(op));
    if (eng.player) drawEntityBubbles(eng.player);

    const drawNameplate = (entity, isPlayer) => {
      const showName = (isPlayer && eng.clientSettings.showPlayerNames) || (!isPlayer && eng.clientSettings.showEntityNames);
      const showHealth = (isPlayer && eng.clientSettings.showPlayerHealth) || (!isPlayer && eng.clientSettings.showEntityHealth);
      
      if (!showName && !showHealth && !entity.isTyping) return;

      const p3d = new THREE.Vector3(entity.x, entity.y, (entity.z || 0) + 120).project(this.camera);
      const sx = (p3d.x + 1) / 2 * window.innerWidth;
      const sy = -(p3d.y - 1) / 2 * window.innerHeight;

      if (showName || entity.isTyping) {
        const name = isPlayer ? (entity === eng.player ? eng.playerData.name : entity.name) : (entity.name || '');
        const dots = entity.isTyping ? '.'.repeat(Math.floor(performance.now() / 400) % 4) : '';
        const textToShow = showName ? name + dots : dots;
        if (textToShow) {
          ctx.fillStyle = isPlayer ? '#2ecc71' : (entity.uuid ? '#ff4757' : '#3498db');
          ctx.font = 'bold 12px monospace';
          ctx.textAlign = 'center';
          ctx.strokeStyle = 'rgba(0,0,0,0.8)';
          ctx.lineWidth = 3;
          ctx.strokeText(textToShow, sx, sy - 10);
          ctx.fillText(textToShow, sx, sy - 10);
        }
      }

      if (showHealth) {
        const hpPercent = Math.max(0, entity.hp / entity.maxHp);
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(sx - 15, sy, 30, 4);
        ctx.fillStyle = isPlayer ? '#2ecc71' : (entity.uuid ? '#ff4757' : '#3498db');
        ctx.fillRect(sx - 15, sy, 30 * hpPercent, 4);
        
        if (entity.energy !== undefined && entity.maxEnergy) {
           const epPercent = Math.max(0, entity.energy / entity.maxEnergy);
           ctx.fillStyle = '#0984e3';
           ctx.fillRect(sx - 15, sy + 4, 30 * epPercent, 4);
        }
      }
    };

    eng.npcs.forEach(npc => drawNameplate(npc, false));
    Object.values(eng.otherPlayers).forEach(op => drawNameplate(op, true));
    drawNameplate(eng.player, true);

    // --- Toggle Player / Entity POS ---
    const drawPosDot = (entity, z, colorHex) => {
      const p3d = new THREE.Vector3(entity.x, entity.y, z).project(this.camera);
      const sx = (p3d.x + 1) / 2 * window.innerWidth;
      const sy = -(p3d.y - 1) / 2 * window.innerHeight;
      ctx.fillStyle = colorHex;
      ctx.fillRect(sx - 2, sy - 2, 4, 4);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'left';
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 3;
      ctx.strokeText(`X:${Math.round(entity.x)} Y:${Math.round(entity.y)} Z:${Math.round(z)}`, sx + 10, sy);
      ctx.fillText(`X:${Math.round(entity.x)} Y:${Math.round(entity.y)} Z:${Math.round(z)}`, sx + 10, sy);
    };

    if (eng.devOptions.showPlayerPos && eng.player) {
      drawPosDot(eng.player, eng.player.z || 0, '#2ecc71');
    }

    if (eng.devOptions.showEntityPos) {
      eng.npcs.forEach(npc => {
        if (npc.state !== 'dead') {
          drawPosDot(npc, npc.z || 0, '#ff4757');
        }
      });
      Object.values(eng.otherPlayers).forEach(op => {
        if (op.state !== 'death') {
          drawPosDot(op, op.z || 0, '#3498db');
        }
      });
    }

    // --- Toggle Chunk Boundaries ---
    if (eng.devOptions.showChunk) {
      const chunkSize = 1024;
      const cx = Math.floor(eng.player.x / chunkSize);
      const cy = Math.floor(eng.player.y / chunkSize);
      
      const minX = cx * chunkSize; const minY = cy * chunkSize;
      const p3d = new THREE.Vector3(minX, minY, eng.player.z || 0).project(this.camera);
      const sx = (p3d.x + 1) / 2 * window.innerWidth;
      const sy = -(p3d.y - 1) / 2 * window.innerHeight;

      ctx.save();
      ctx.fillStyle = '#9b59b6'; ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center'; ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 4;
      ctx.strokeText(`Chunk [${cx}, ${cy}] NW`, sx, sy - 20);
      ctx.fillText(`Chunk [${cx}, ${cy}] NW`, sx, sy - 20);
      ctx.restore();
    }

    if (eng.devOptions.showHitboxes) {
      ctx.lineWidth = 2;
      const drawRect = (entity, color) => {
        const p3d = new THREE.Vector3(entity.x, entity.y, entity.z || 0).project(this.camera);
        const sx = (p3d.x + 1) / 2 * window.innerWidth;
        const sy = -(p3d.y - 1) / 2 * window.innerHeight;
        ctx.strokeStyle = color;
        ctx.strokeRect(sx - 30, sy - 145, 60, 180);
      };

      drawRect(eng.player, '#2ecc71');
      Object.values(eng.otherPlayers).forEach(op => { if (op.state !== 'death') drawRect(op, '#3498db'); });
      eng.npcs.forEach(npc => { if (npc.state !== 'dead') drawRect(npc, '#ff4757'); });
    }
    
    // Render Combat Floating Texts
    eng.floatingTexts.forEach(ft => {
      const p3d = new THREE.Vector3(ft.x, ft.y, ft.z || 0).project(this.camera);
      const sx = (p3d.x + 1) / 2 * window.innerWidth;
      const sy = -(p3d.y - 1) / 2 * window.innerHeight;
      
      const zoom = this.camera.zoom;
      const zScale = Math.pow(zoom, 0.6); // Scale text gently to prevent it from getting massively bloated
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.life);
      ctx.font = `bold ${Math.max(12, 18 * zScale)}px monospace`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = Math.max(2, 3 * zScale);
      const drawX = sx + ((ft.rndX || 0) * zScale);
      const drawY = sy - (ft.offsetY * zScale) + ((ft.rndY || 0) * zScale);
      ctx.strokeText(ft.text, drawX, drawY);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, drawX, drawY);
      ctx.restore();
    });
  }
}
