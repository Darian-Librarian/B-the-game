import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'https://unpkg.com/three@0.160.0/examples/jsm/utils/BufferGeometryUtils.js';
import { BlockRegistry, FURNITURE_REGISTRY } from './registry.js?v=new-engine-314';

export class Renderer {
  constructor(engine) {
    this.engine = engine;
    
    THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

    this.cameraAngle = this.engine.clientSettings.cameraAngle !== undefined ? this.engine.clientSettings.cameraAngle : 0; 
    this.cameraPitch = Math.atan(1 / Math.sqrt(2));
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

    this.webgl.shadowMap.enabled = this.engine.clientSettings.enableShadows !== false;
    this.webgl.shadowMap.type = THREE.PCFSoftShadowMap;
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
    
    this.camera.rotation.x = this.cameraPitch;
    this.camera.rotation.y = 0; // Handled by Z up
    this.camera.rotation.z = baseIsoAngle + zRotOffset;
    this.updateCompass();
  }

  rotateCamera(direction, deltaY = 0) {
    this.cameraAngle = (this.cameraAngle + direction + 360) % 360;

    if (deltaY !== 0) {
      this.cameraPitch += deltaY * 0.01;
      this.cameraPitch = Math.max(0.1, Math.min(this.cameraPitch, 80 * (Math.PI / 180)));
    }

    this.engine.clientSettings.cameraAngle = this.cameraAngle;
    localStorage.setItem('b_client_settings', JSON.stringify(this.engine.clientSettings));
    this.updateCameraRotation();
  }

  setupScene() {
    this.scene = new THREE.Scene();
    
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    this.sunLight.castShadow = this.engine.clientSettings.enableShadows !== false;
    
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    const d = 1000;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 5000;
    this.sunLight.shadow.bias = -0.0005;

    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

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
    
    const selBoxGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    const selBoxMat = new THREE.LineBasicMaterial({ color: 0x3498db, depthTest: false, linewidth: 2 });
    this.selectionBox = new THREE.LineSegments(selBoxGeo, selBoxMat);
    this.selectionBox.renderOrder = 999;
    this.selectionBox.visible = false;
    this.scene.add(this.selectionBox);

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
    this.meleeHitMesh.frustumCulled = false;
    this.meleeHitMesh.visible = false;
    this.debugMeshes.add(this.meleeHitMesh);

    const meleeHitEdgeGeo = new THREE.RingGeometry(34, 35, 32);
    const meleeHitEdgeMat = new THREE.MeshBasicMaterial({ color: 0xe74c3c, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
    this.meleeHitLineMesh = new THREE.InstancedMesh(meleeHitEdgeGeo, meleeHitEdgeMat, 100);
    this.meleeHitLineMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.meleeHitLineMesh.frustumCulled = false;
    this.meleeHitLineMesh.visible = false;
    this.debugMeshes.add(this.meleeHitLineMesh);

    const losGeo = new THREE.CircleGeometry(35, 32);
    const losMat = new THREE.MeshBasicMaterial({ color: 0xf1c40f, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false });
    this.losMesh = new THREE.InstancedMesh(losGeo, losMat, 100);
    this.losMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.losMesh.frustumCulled = false;
    this.losMesh.visible = false;
    this.debugMeshes.add(this.losMesh);

    const losEdgeGeo = new THREE.RingGeometry(34, 35, 32);
    const losEdgeMat = new THREE.MeshBasicMaterial({ color: 0xf1c40f, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
    this.losLineMesh = new THREE.InstancedMesh(losEdgeGeo, losEdgeMat, 100);
    this.losLineMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.losLineMesh.frustumCulled = false;
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
    this.debugTileMesh.frustumCulled = false;
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

    this.instancedMaterial = new THREE.MeshLambertMaterial({
      color: 0xffffff
    }); 
    this.instancedMaterial.userData = { time: { value: 0 } };

    this.glassMaterial = new THREE.MeshLambertMaterial({ 
      color: 0xffffff,
      transparent: true,
      alphaTest: 0.05,
      depthWrite: false
    }); 
    this.glassMaterial.userData = { time: { value: 0 } };

    this.modelMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.modelMaterial.onBeforeCompile = (shader) => {
      shader.vertexShader = `
        attribute vec4 instanceUVTop;
        varying vec4 vInstanceUVTop;
        varying vec3 vWorldNormal;
        varying vec3 vLocalNormal;
        varying vec3 vLocalPosition;
      ` + shader.vertexShader.replace(
        '#include <uv_vertex>',
        `
        #include <uv_vertex>
        vInstanceUVTop = instanceUVTop;
        vLocalNormal = normal;
        vWorldNormal = normalize( ( modelMatrix * vec4( mat3( instanceMatrix ) * normal, 0.0 ) ).xyz );
        vLocalPosition = position;
        `
      );
      shader.fragmentShader = `
        varying vec4 vInstanceUVTop;
        varying vec3 vWorldNormal;
        varying vec3 vLocalNormal;
        varying vec3 vLocalPosition;
      ` + shader.fragmentShader.replace(
        '#include <map_fragment>',
        `
        #ifdef USE_MAP
          vec2 baseUV = vec2(0.0);
          if (abs(vLocalNormal.z) > 0.5) {
             baseUV = vec2(vLocalPosition.x, -vLocalPosition.y) / 32.0;
          } else if (abs(vLocalNormal.x) > 0.5) {
             baseUV = vec2(vLocalNormal.x > 0.0 ? -vLocalPosition.y : vLocalPosition.y, -vLocalPosition.z) / 32.0;
          } else {
             baseUV = vec2(vLocalNormal.y > 0.0 ? vLocalPosition.x : -vLocalPosition.x, -vLocalPosition.z) / 32.0;
          }
          vec2 modifiedUV = fract(baseUV) * vInstanceUVTop.zw + vInstanceUVTop.xy;
          vec4 sampledDiffuseColor = texture2D( map, modifiedUV );
          diffuseColor *= sampledDiffuseColor;
        #endif
        `
      );
    };

    this.previewModelMaterial = this.modelMaterial.clone();
    this.previewModelMaterial.onBeforeCompile = this.modelMaterial.onBeforeCompile;
    this.previewModelMaterial.transparent = true;
    this.previewModelMaterial.opacity = 0.6;
    this.previewModelMaterial.depthTest = true;
    this.previewModelMaterial.polygonOffset = true;
    this.previewModelMaterial.polygonOffsetFactor = -2;
    this.previewModelMaterial.polygonOffsetUnits = -2;

    const setupShader = (shader, userData) => {
      shader.uniforms.uTime = userData.time;
      shader.vertexShader = `
        attribute float isFluid;
        attribute vec4 instanceUVTop;
        attribute vec4 instanceUVSide;
        attribute vec4 instanceUVBottom;
        attribute vec4 instanceNeighbors1;
        attribute vec2 instanceNeighbors2;
        varying float vIsFluid;
        varying vec4 vInstanceUVTop;
        varying vec4 vInstanceUVSide;
        varying vec4 vInstanceUVBottom;
        varying vec4 vInstanceNeighbors1;
        varying vec2 vInstanceNeighbors2;
        varying vec3 vWorldNormal;
        varying vec3 vLocalNormal;
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
        vInstanceNeighbors1 = instanceNeighbors1;
        vInstanceNeighbors2 = instanceNeighbors2;
        vLocalNormal = normal;
        vWorldNormal = normalize( ( modelMatrix * vec4( mat3( instanceMatrix ) * normal, 0.0 ) ).xyz );
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
        varying vec4 vInstanceNeighbors1;
        varying vec2 vInstanceNeighbors2;
        varying vec3 vWorldNormal;
        varying vec3 vLocalNormal;
        varying vec3 vLocalPosition;
        varying vec3 vInstancePosition;
      ` + shader.fragmentShader.replace(
        '#include <map_fragment>',
        `
        #ifdef USE_MAP
          vec2 baseUV = vMapUv;
          
          vec4 iuv;
          if (vLocalNormal.z > 0.5) { // Top
            iuv = vInstanceUVTop;
          } else if (vLocalNormal.z < -0.5) { // Bottom
            iuv = vInstanceUVBottom;
          } else { // Sides
            iuv = vInstanceUVSide;
            // Force ALL side faces to mathematically orient V directly downwards (-Z)
            if (abs(vLocalNormal.x) > 0.5) {
                baseUV.x = vLocalNormal.x > 0.0 ? fract(0.5 - vLocalPosition.y / 32.0) : fract(vLocalPosition.y / 32.0 + 0.5);
            } else {
                baseUV.x = vLocalNormal.y > 0.0 ? fract(vLocalPosition.x / 32.0 + 0.5) : fract(0.5 - vLocalPosition.x / 32.0);
            }
            baseUV.y = fract(vLocalPosition.z / 32.0 + 0.5);
          }

          // --- Fluid Animation Override ---
          if (vIsFluid > 0.5) {
              vec3 worldPos = vInstancePosition + vLocalPosition;
              if (vLocalNormal.z > 0.9) { // Flat Top face ONLY
                  // Seamless world-aligned mapping, NO time sliding
                  baseUV = fract(vec2(worldPos.x, -worldPos.y) / 32.0);
              }
          }

          vec2 modifiedUV = baseUV * iuv.zw + iuv.xy;
          vec4 sampledDiffuseColor = texture2D( map, modifiedUV );

          // --- Interior Face Culling ---
          float faceVis = 1.0;
          if (vLocalNormal.z > 0.5) faceVis = vInstanceNeighbors2.x;
          else if (vLocalNormal.z < -0.5) faceVis = vInstanceNeighbors2.y;
          else if (vLocalNormal.x > 0.5) faceVis = vInstanceNeighbors1.x; // East
          else if (vLocalNormal.x < -0.5) faceVis = vInstanceNeighbors1.y; // West
          else if (vLocalNormal.y > 0.5) faceVis = vInstanceNeighbors1.z; // South
          else if (vLocalNormal.y < -0.5) faceVis = vInstanceNeighbors1.w; // North

          if (faceVis < 0.5) discard;

          diffuseColor *= sampledDiffuseColor;
        #endif
        `
      );
    };

    this.instancedMaterial.onBeforeCompile = (shader) => setupShader(shader, this.instancedMaterial.userData);
    this.glassMaterial.onBeforeCompile = (shader) => setupShader(shader, this.glassMaterial.userData);

    const createMesh = (geometry, material = this.instancedMaterial) => {
      const uvsTop = new Float32Array(maxInstances * 4);
      geometry.setAttribute('instanceUVTop', new THREE.InstancedBufferAttribute(uvsTop, 4));
      const uvsSide = new Float32Array(maxInstances * 4);
      geometry.setAttribute('instanceUVSide', new THREE.InstancedBufferAttribute(uvsSide, 4));
      const uvsBottom = new Float32Array(maxInstances * 4);
      geometry.setAttribute('instanceUVBottom', new THREE.InstancedBufferAttribute(uvsBottom, 4));
      geometry.setAttribute('isFluid', new THREE.InstancedBufferAttribute(new Float32Array(maxInstances), 1));
      
      const neighbors1 = new Float32Array(maxInstances * 4);
      geometry.setAttribute('instanceNeighbors1', new THREE.InstancedBufferAttribute(neighbors1, 4));
      const neighbors2 = new Float32Array(maxInstances * 2);
      geometry.setAttribute('instanceNeighbors2', new THREE.InstancedBufferAttribute(neighbors2, 2));

      const mesh = new THREE.InstancedMesh(geometry, material, maxInstances);
      mesh.castShadow = this.engine.clientSettings.enableShadows !== false;
      mesh.receiveShadow = this.engine.clientSettings.enableShadows !== false;
      
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
    this.glassMesh = createMesh(cubeGeo.clone(), this.glassMaterial);
    this.glassMesh.renderOrder = 1;

    const slabGeo = new THREE.BoxGeometry(32, 32, 16);
    slabGeo.translate(0, 0, -8);
    slabGeo.computeBoundingBox();
    slabGeo.computeBoundingSphere();
    this.slabMesh = createMesh(slabGeo);
    this.glassSlabMesh = createMesh(slabGeo.clone(), this.glassMaterial);
    this.glassSlabMesh.renderOrder = 1;

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
    this.glassRampMesh = createMesh(rampGeo.clone(), this.glassMaterial);
    this.glassRampMesh.renderOrder = 1;

    // Merge two boxes manually to form a stair block
    const stairGeo = new THREE.BufferGeometry();
    const bottomBox = new THREE.BoxGeometry(32, 32, 16);
    bottomBox.translate(0, 0, -8);
    const topBox = new THREE.BoxGeometry(32, 16, 16);
    topBox.translate(0, 8, 8);
    
    const pos1 = bottomBox.attributes.position.array;
    const pos2 = topBox.attributes.position.array;
    const mergedPos = new Float32Array(pos1.length + pos2.length);
    mergedPos.set(pos1, 0); mergedPos.set(pos2, pos1.length);
    stairGeo.setAttribute('position', new THREE.BufferAttribute(mergedPos, 3));
    
    const uv1 = bottomBox.attributes.uv.array;
    const uv2 = topBox.attributes.uv.array;
    const mergedUv = new Float32Array(uv1.length + uv2.length);
    mergedUv.set(uv1, 0); mergedUv.set(uv2, uv1.length);
    stairGeo.setAttribute('uv', new THREE.BufferAttribute(mergedUv, 2));
    
    const norm1 = bottomBox.attributes.normal.array;
    const norm2 = topBox.attributes.normal.array;
    const mergedNorm = new Float32Array(norm1.length + norm2.length);
    mergedNorm.set(norm1, 0); mergedNorm.set(norm2, norm1.length);
    stairGeo.setAttribute('normal', new THREE.BufferAttribute(mergedNorm, 3));
    
    const idx1 = bottomBox.index.array;
    const idx2 = topBox.index.array;
    const mergedIdx = new Uint16Array(idx1.length + idx2.length);
    mergedIdx.set(idx1, 0);
    const offset = pos1.length / 3;
    for(let i = 0; i < idx2.length; i++) mergedIdx[idx1.length + i] = idx2[i] + offset;
    stairGeo.setIndex(new THREE.BufferAttribute(mergedIdx, 1));
    
    stairGeo.computeBoundingBox();
    stairGeo.computeBoundingSphere();
    this.stairMesh = createMesh(stairGeo);
    this.glassStairMesh = createMesh(stairGeo.clone(), this.glassMaterial);
    this.glassStairMesh.renderOrder = 1;

    const doorGeo = new THREE.BufferGeometry();
    const doorBaseBox = new THREE.BoxGeometry(32, 4, 32);
    const handleBox = new THREE.BoxGeometry(2, 6, 4);
    handleBox.translate(12, 0, 0);
    
    const p1 = doorBaseBox.attributes.position.array;
    const p2 = handleBox.attributes.position.array;
    const mPos = new Float32Array(p1.length + p2.length);
    mPos.set(p1, 0); mPos.set(p2, p1.length);
    doorGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
    
    const u1 = doorBaseBox.attributes.uv.array;
    const u2 = handleBox.attributes.uv.array;
    const mUv = new Float32Array(u1.length + u2.length);
    mUv.set(u1, 0); mUv.set(u2, u1.length);
    doorGeo.setAttribute('uv', new THREE.BufferAttribute(mUv, 2));
    
    const n1 = doorBaseBox.attributes.normal.array;
    const n2 = handleBox.attributes.normal.array;
    const mNorm = new Float32Array(n1.length + n2.length);
    mNorm.set(n1, 0); mNorm.set(n2, n1.length);
    doorGeo.setAttribute('normal', new THREE.BufferAttribute(mNorm, 3));
    
    const i1 = doorBaseBox.index.array;
    const i2 = handleBox.index.array;
    const mIdx = new Uint16Array(i1.length + i2.length);
    mIdx.set(i1, 0);
    const off = p1.length / 3;
    for(let i = 0; i < i2.length; i++) mIdx[i1.length + i] = i2[i] + off;
    doorGeo.setIndex(new THREE.BufferAttribute(mIdx, 1));
    
    doorGeo.computeBoundingBox();
    doorGeo.computeBoundingSphere();
    this.doorMesh = createMesh(doorGeo);
    this.glassDoorMesh = createMesh(doorGeo.clone(), this.glassMaterial);
    this.glassDoorMesh.renderOrder = 1;

    this.previewMaterial = this.instancedMaterial.clone();
    this.previewMaterial.onBeforeCompile = this.instancedMaterial.onBeforeCompile;
    this.previewMaterial.transparent = true;
    this.previewMaterial.opacity = 0.6;
    this.previewMaterial.depthTest = true;
    this.previewMaterial.polygonOffset = true;
    this.previewMaterial.polygonOffsetFactor = -2;
    this.previewMaterial.polygonOffsetUnits = -2;

    const createPreviewMesh = (geometry) => {
      const maxPreview = 4096;
      geometry.setAttribute('instanceUVTop', new THREE.InstancedBufferAttribute(new Float32Array(maxPreview * 4), 4));
      geometry.setAttribute('instanceUVSide', new THREE.InstancedBufferAttribute(new Float32Array(maxPreview * 4), 4));
      geometry.setAttribute('instanceUVBottom', new THREE.InstancedBufferAttribute(new Float32Array(maxPreview * 4), 4));
      geometry.setAttribute('isFluid', new THREE.InstancedBufferAttribute(new Float32Array(maxPreview), 1));
      const n1 = new Float32Array(maxPreview * 4); n1.fill(1);
      geometry.setAttribute('instanceNeighbors1', new THREE.InstancedBufferAttribute(n1, 4));
      const n2 = new Float32Array(maxPreview * 2); n2.fill(1);
      geometry.setAttribute('instanceNeighbors2', new THREE.InstancedBufferAttribute(n2, 2));
      const mesh = new THREE.InstancedMesh(geometry, this.previewMaterial, maxPreview);
      mesh.castShadow = this.engine.clientSettings.enableShadows !== false;
      mesh.receiveShadow = this.engine.clientSettings.enableShadows !== false;
      mesh.frustumCulled = false; mesh.count = 0; mesh.renderOrder = 998;
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(maxPreview * 3), 3);
      this.scene.add(mesh); return mesh;
    };
    
    this.previewCubeMesh = createPreviewMesh(cubeGeo.clone());
    this.previewSlabMesh = createPreviewMesh(slabGeo.clone());
    this.previewRampMesh = createPreviewMesh(rampGeo.clone());
    this.previewStairMesh = createPreviewMesh(stairGeo.clone());
    this.previewDoorMesh = createPreviewMesh(doorGeo.clone());

    this.decorMaterial = this.instancedMaterial.clone();
    this.decorMaterial.side = THREE.DoubleSide;
    this.decorMaterial.depthWrite = true;
    this.decorMaterial.alphaTest = 0.5;
    this.decorMaterial.onBeforeCompile = (shader) => {
      shader.vertexShader = `
        attribute vec4 instanceUVTop;
        attribute vec4 instanceNeighbors1;
        attribute vec2 instanceNeighbors2;
        varying vec4 vInstanceUVTop;
        varying vec3 vWorldNormal;
      ` + shader.vertexShader.replace(
        '#include <uv_vertex>',
        `
        #include <uv_vertex>
        vInstanceUVTop = instanceUVTop;
        vWorldNormal = normalize( ( modelMatrix * vec4( mat3( instanceMatrix ) * normal, 0.0 ) ).xyz );
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
    this.decorMesh.castShadow = false;
  }

  setupCompass() {
    let compassWrapper = document.getElementById('compass-wrapper');
    if (!compassWrapper) {
      compassWrapper = document.createElement('div');
      compassWrapper.id = 'compass-wrapper';
      compassWrapper.style.cssText = 'position: absolute; top: 85px; right: 35px; display: flex; flex-direction: column; align-items: center; gap: 8px; z-index: 1000;';

      let compass = document.createElement('div');
      compass.id = 'compass-ui';
      compass.style.cssText = 'position: relative; width: 40px; height: 40px; background: rgba(5, 7, 10, 0.8); border: 2px solid #3498db; border-radius: 50%; display: flex; align-items: center; justify-content: center; pointer-events: auto; cursor: pointer; font-family: var(--font-mono); font-weight: bold; box-shadow: 0 4px 10px rgba(0,0,0,0.8); transition: background 0.2s;';

      compass.onmouseenter = () => compass.style.background = 'rgba(52, 152, 219, 0.3)';
      compass.onmouseleave = () => compass.style.background = 'rgba(5, 7, 10, 0.8)';
      compass.onclick = () => {
        const snapAngle = this.engine.clientSettings.cameraAngleSnap !== undefined ? this.engine.clientSettings.cameraAngleSnap : 0;
        this.cameraAngle = parseInt(snapAngle, 10);
        this.cameraPitch = Math.atan(1 / Math.sqrt(2));
        this.engine.clientSettings.cameraAngle = this.cameraAngle;
        localStorage.setItem('b_client_settings', JSON.stringify(this.engine.clientSettings));
        this.updateCameraRotation();
      };
      
      const needle = document.createElement('div');
      needle.id = 'compass-needle';
      needle.style.cssText = 'position: relative; width: 4px; height: 32px; background: linear-gradient(to bottom, #e74c3c 50%, #bdc3c7 50%); border-radius: 2px; z-index: 2;';
      
      const nLabel = document.createElement('div');
      nLabel.innerText = 'N';
      nLabel.style.cssText = 'position: absolute; top: -12px; left: 50%; transform: translateX(-50%); font-size: 10px; color: #e74c3c; text-shadow: 1px 1px 0 #000;';
      needle.appendChild(nLabel);
      
      compass.appendChild(needle);

      const sunIcon = document.createElement('div');
      sunIcon.id = 'compass-sun';
      sunIcon.style.cssText = 'position: absolute; width: 10px; height: 10px; background: #f1c40f; border-radius: 50%; box-shadow: 0 0 8px #f1c40f; top: 50%; left: 50%; transform: translate(-50%, -50%); transition: background 0.5s, box-shadow 0.5s; pointer-events: none; z-index: 1;';
      compass.appendChild(sunIcon);
      
      compassWrapper.appendChild(compass);

      const clockDisplay = document.createElement('div');
      clockDisplay.id = 'in-game-clock';
      clockDisplay.style.cssText = 'background: rgba(5, 7, 10, 0.8); border: 1px solid #3498db; color: #fff; padding: 2px 6px; border-radius: 4px; font-family: var(--font-mono); font-size: 0.75rem; font-weight: bold; text-shadow: 1px 1px 0 #000; pointer-events: auto; cursor: default; white-space: nowrap;';
      clockDisplay.innerText = '06:00 AM';
      compassWrapper.appendChild(clockDisplay);

      document.body.appendChild(compassWrapper);
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
        
    this.modelMaterial.map = this.atlasTexture;
    if (this.previewModelMaterial) this.previewModelMaterial.map = this.atlasTexture;
    
    this.modelMeshes = {};
    this.previewModelMeshes = {};
    this.modelCounts = {};

    const gltfLoader = new GLTFLoader();
    for (const [id, data] of Object.entries(FURNITURE_REGISTRY)) {
      gltfLoader.load(`models/${id}.glb`, (gltf) => {
        gltf.scene.updateMatrixWorld(true);
        const geometries = [];
        gltf.scene.traverse((child) => {
          if (child.isMesh) {
            const geo = child.geometry.clone();
            geo.applyMatrix4(child.matrixWorld);
            for (const key in geo.attributes) {
              if (key !== 'position' && key !== 'normal' && key !== 'uv') geo.deleteAttribute(key);
            }
            geometries.push(geo);
          }
        });
        
        if (geometries.length > 0) {
          let geo = mergeGeometries(geometries, false);
          geo.computeVertexNormals();
          if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
          const uvArray = geo.attributes.uv.array;
          for (let i = 1; i < uvArray.length; i += 2) uvArray[i] = 1.0 - uvArray[i];
          geo.attributes.uv.needsUpdate = true;
          geo.scale(2, 2, 2);
          geo.rotateX(Math.PI / 2);
          geo.center();
          geo.computeBoundingBox();
          geo.translate(0, 0, -16 - geo.boundingBox.min.z);
          geo.computeBoundingBox();
          geo.computeBoundingSphere();
          
          const meshGeo = geo.clone();
          meshGeo.setAttribute('instanceUVTop', new THREE.InstancedBufferAttribute(new Float32Array(10000 * 4), 4));

          const mesh = new THREE.InstancedMesh(meshGeo, this.modelMaterial, 10000);
          mesh.castShadow = this.engine.clientSettings.enableShadows !== false;
          mesh.receiveShadow = this.engine.clientSettings.enableShadows !== false;
          mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          mesh.frustumCulled = false;
          mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1000000);
          meshGeo.boundingSphere = mesh.boundingSphere;
          mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(10000 * 3), 3);
          this.scene.add(mesh);
          this.modelMeshes[id] = mesh;
          this.needsVoxelUpdate = true;

          const previewGeo = geo.clone();
          previewGeo.setAttribute('instanceUVTop', new THREE.InstancedBufferAttribute(new Float32Array(4096 * 4), 4));

          const previewMesh = new THREE.InstancedMesh(previewGeo, this.previewModelMaterial, 4096);
          previewMesh.castShadow = this.engine.clientSettings.enableShadows !== false;
          previewMesh.receiveShadow = this.engine.clientSettings.enableShadows !== false;
          previewMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          previewMesh.frustumCulled = false; previewMesh.count = 0; previewMesh.renderOrder = 998;
          previewMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(4096 * 3), 3);
          this.scene.add(previewMesh);
          this.previewModelMeshes[id] = previewMesh;
        }
      }, undefined, (error) => {
        console.error(`[GLTFLoader] Critical Error: Failed to load ${id}.glb!`);
      });
    }
    
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
      { state: 'death', file: 'idle-template', rows: 12 },
      { state: 'fly', file: 'fly-template', rows: 8 },
      { state: 'fly-idle', file: 'fly-idle-template', rows: 8 }
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
    canvas.width = 2048;
    canvas.height = 2048;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    this.atlasMap = {
      'white': { x: 0, y: 1 },
      'mud1': { x: 2, y: 1 },
      'mud2': { x: 3, y: 1 },
      'mud3': { x: 0, y: 2 },
      'bubble': { x: 2, y: 2 },
      'glass': { x: 1, y: 1 },
      'glass-stained': { x: 0, y: 3 },
      'smoke': { x: 0, y: 1 }, // Maps directly to the white square fallback
      'water_flow': { x: 1, y: 3 },
      'lava_flow': { x: 3, y: 3 },
      'stone-bricks1': { x: 0, y: 4 },
      'stone-bricks2': { x: 1, y: 4 },
      'stone-bricks3': { x: 2, y: 4 },
      'stone-bricks4': { x: 3, y: 4 },
      'stone-bricks5': { x: 4, y: 4 },
      'stone-bricks6': { x: 5, y: 4 }
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
    if (this.glassMaterial) {
      this.glassMaterial.map = atlasTexture;
      this.glassMaterial.needsUpdate = true;
    }

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
      img.onerror = () => {
        console.warn(`[Texture Atlas] Missing texture: ${src}`);
        const pos = this.atlasMap[id];
        if (pos) {
          ctx.fillStyle = '#ff00ff';
          ctx.fillRect(pos.x * 64, pos.y * 64, 64, 64);
          ctx.fillStyle = '#000000';
          ctx.fillRect(pos.x * 64 + 32, pos.y * 64, 32, 32);
          ctx.fillRect(pos.x * 64, pos.y * 64 + 32, 32, 32);
          atlasTexture.needsUpdate = true;
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
    loadTile('glass', 'assets/tiles/base/all-facing/glass.png');
    loadTile('glass-stained', 'assets/tiles/base/all-facing/glass-stained.png');
    loadTile('bubble', 'assets/sprites/fx/bubble-grayscale.png');
    
    for (let i = 1; i <= 6; i++) {
      loadTile(`stone-bricks${i}`, `assets/tiles/base/all-facing/stone-bricks${i}.png`);
    }
    
    loadTile('wood-planks', 'assets/tiles/base/all-facing/wood-planks.png');
    loadTile('wood-stripped', 'assets/tiles/base/all-facing/wood-stripped.png');
    
    loadTile('wood-door-bottom', 'assets/tiles/base/interactable/wood_door-bottom.png');
    loadTile('wood-door-top', 'assets/tiles/base/interactable/wood_door-top.png');

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

    const getShape = (v) => {
      if (!v) return null;
      if (v.tex && v.tex.startsWith('glass')) return 'transparent'; 
      return v.shape || 'cube';
    };

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

    this.doorMap = {};
    if (this.doorPhysics) {
      for (const key in this.doorPhysics) {
        this.doorPhysics[key].initialized = false;
      }
    }

    const nameToId = {};
    for (const id in BlockRegistry) {
      nameToId[BlockRegistry[id].name] = id;
    }

    let iCube = 0, iSlab = 0, iRamp = 0, iStair = 0, iDecor = 0, iGlass = 0, iGlassSlab = 0, iGlassRamp = 0, iGlassStair = 0, iDoor = 0, iGlassDoor = 0;
    for (const id in this.modelMeshes) this.modelCounts[id] = 0;
    const dummy = new THREE.Object3D();

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
        const isGlassBlock = voxel.tex && voxel.tex.startsWith('glass');
        
        let currentMesh, currentI, currentUVTop, currentUVSide, currentUVBottom, currentFluidAttr, currentN1, currentN2;

        dummy.rotation.set(0, 0, 0);
        let fluidType = 0.0;
        if (voxel.tex === 'water' || voxel.tex === 'water_flow') fluidType = 1.0;
        else if (voxel.tex === 'lava' || voxel.tex === 'lava_flow') fluidType = 2.0;
        else if (voxel.tex === 'acid') fluidType = 3.0;
        const isFluid = fluidType > 0.0;

        if (shape === 'decor') {
          currentMesh = this.decorMesh; currentI = iDecor; iDecor++;
        } else if (this.modelMeshes && this.modelMeshes[shape]) {
          currentMesh = this.modelMeshes[shape]; 
          currentI = this.modelCounts[shape]; 
          this.modelCounts[shape]++;
          let rot = 0;
          if (voxel.dir === 'e') rot = -Math.PI / 2;
          else if (voxel.dir === 'n') rot = Math.PI;
          else if (voxel.dir === 'w') rot = Math.PI / 2;
          dummy.rotation.set(0, 0, rot);
          currentUVSide = null; currentUVBottom = null;
          currentFluidAttr = null; currentN1 = null; currentN2 = null;
        } else if (shape === 'slab') {
          if (isGlassBlock) { currentMesh = this.glassSlabMesh; currentI = iGlassSlab; iGlassSlab++; }
          else { currentMesh = this.slabMesh; currentI = iSlab; iSlab++; }
        } else if (shape.startsWith('ramp')) {
          if (isGlassBlock) { currentMesh = this.glassRampMesh; currentI = iGlassRamp; iGlassRamp++; }
          else { currentMesh = this.rampMesh; currentI = iRamp; iRamp++; }
          if (shape === 'ramp_e') dummy.rotation.set(0, 0, -Math.PI / 2);
          else if (shape === 'ramp_n') dummy.rotation.set(0, 0, Math.PI);
          else if (shape === 'ramp_w') dummy.rotation.set(0, 0, Math.PI / 2);
        } else if (shape.startsWith('stair')) {
          if (isGlassBlock) { currentMesh = this.glassStairMesh; currentI = iGlassStair; iGlassStair++; }
          else { currentMesh = this.stairMesh; currentI = iStair; iStair++; }
          if (shape === 'stair_e') dummy.rotation.set(0, 0, -Math.PI / 2);
          else if (shape === 'stair_n') dummy.rotation.set(0, 0, Math.PI);
          else if (shape === 'stair_w') dummy.rotation.set(0, 0, Math.PI / 2);
        } else if (shape.startsWith('door')) {
          if (isGlassBlock) { currentMesh = this.glassDoorMesh; currentI = iGlassDoor; iGlassDoor++; }
          else { currentMesh = this.doorMesh; currentI = iDoor; iDoor++; }
          
          let baseRot = 0;
          if (shape.includes('door_e')) baseRot = -Math.PI / 2;
          else if (shape.includes('door_n')) baseRot = Math.PI;
          else if (shape.includes('door_w')) baseRot = Math.PI / 2;
          else if (shape.includes('door_s')) baseRot = 0;
          
          let rot = baseRot;
          const isOp = shape.includes('_open');
          const isFlip = shape.includes('_flip');
          
          if (isOp) rot += isFlip ? -Math.PI / 2 : Math.PI / 2;
          
          this.doorMap[`${absX}_${absY}_${absZ}`] = { 
            id: currentI, targetRot: rot, baseRot: baseRot, isGlass: isGlassBlock, 
            cx: absX, cy: absY, cz: absZ, flip: isFlip
          };
          dummy.rotation.set(0, 0, rot);
        } else {
          if (isGlassBlock) { currentMesh = this.glassMesh; currentI = iGlass; iGlass++; }
          else { currentMesh = this.voxelMesh; currentI = iCube; iCube++; }
        }

        currentUVTop = currentMesh.geometry.attributes.instanceUVTop;
        currentUVSide = currentMesh.geometry.attributes.instanceUVSide;
        currentUVBottom = currentMesh.geometry.attributes.instanceUVBottom;
        currentFluidAttr = currentMesh.geometry.attributes.isFluid;
        currentN1 = currentMesh.geometry.attributes.instanceNeighbors1;
        currentN2 = currentMesh.geometry.attributes.instanceNeighbors2;

        if (currentI >= 100000) continue;

        dummy.scale.set(1, 1, 1);
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
        
        let blockType = voxel.tex || 'grass';
        if (blockType === 'mud') {
          const hash = Math.abs(Math.sin(vx * 12.9898 + vy * 78.233 + vz * 37.719)) * 10000;
          blockType = `mud${Math.floor(hash) % 3 + 1}`;
        } else if (blockType === 'stone-bricks') {
          const hash = Math.abs(Math.sin(vx * 12.9898 + vy * 78.233 + vz * 37.719)) * 10000;
          blockType = `stone-bricks${Math.floor(hash) % 6 + 1}`;
        }

        if (voxelDef && voxelDef.faces && blockType === voxel.tex) {
          mainAtlasPos = this.atlasMap[voxelDef.name];
          sidesAtlasPos = this.atlasMap[voxelDef.name + '_flow'];
          if (!sidesAtlasPos) sidesAtlasPos = mainAtlasPos;
          bottomAtlasPos = this.atlasMap[voxelDef.name + '_bottom'] || mainAtlasPos;
        } else {
          mainAtlasPos = this.atlasMap[blockType] || this.atlasMap['stone'];
          sidesAtlasPos = mainAtlasPos;
          bottomAtlasPos = mainAtlasPos;
        }

        const uvScaleX = 64 / 2048; const uvScaleY = 64 / 2048;
        
        if (currentFluidAttr) currentFluidAttr.setX(currentI, fluidType);
        
        let visE = 1, visW = 1, visS = 1, visN = 1, visT = 1, visB = 1;
        if (isGlassBlock || isFluid) {
           const checkCull = (v) => v && v.tex === voxel.tex && (v.shape || 'cube') === shape;
           if (checkCull(this.engine.mapManager.getVoxelAt(absX + 32, absY, absZ))) visE = 0;
           if (checkCull(this.engine.mapManager.getVoxelAt(absX - 32, absY, absZ))) visW = 0;
           if (checkCull(this.engine.mapManager.getVoxelAt(absX, absY + 32, absZ))) visS = 0;
           if (checkCull(this.engine.mapManager.getVoxelAt(absX, absY - 32, absZ))) visN = 0;
           if (checkCull(this.engine.mapManager.getVoxelAt(absX, absY, absZ + 32))) visT = 0;
           if (checkCull(this.engine.mapManager.getVoxelAt(absX, absY, absZ - 32))) visB = 0;
        }

        if (currentN1) currentN1.setXYZW(currentI, visE, visW, visS, visN);
        if (currentN2) currentN2.setXY(currentI, visT, visB);

        if (currentUVTop) {
          const tx = mainAtlasPos ? mainAtlasPos.x : 0; const ty = mainAtlasPos ? mainAtlasPos.y : 0;
          let tw = uvScaleX; let to = tx * uvScaleX;
          if (shape.includes('_flip')) { tw = -uvScaleX; to += uvScaleX; }
          currentUVTop.setXYZW(currentI, to, 1.0 - ((ty + 1) * uvScaleY), tw, uvScaleY);
        }
        if (currentUVSide) {
          const sx = sidesAtlasPos ? sidesAtlasPos.x : 0; const sy = sidesAtlasPos ? sidesAtlasPos.y : 0;
          let sw = uvScaleX; let so = sx * uvScaleX;
          if (shape.includes('_flip')) { sw = -uvScaleX; so += uvScaleX; }
          currentUVSide.setXYZW(currentI, so, 1.0 - ((sy + 1) * uvScaleY), sw, uvScaleY);
        }
        if (currentUVBottom) {
          const bx = bottomAtlasPos ? bottomAtlasPos.x : 0; const by = bottomAtlasPos ? bottomAtlasPos.y : 0;
          let bw = uvScaleX; let bo = bx * uvScaleX;
          if (shape.includes('_flip')) { bw = -uvScaleX; bo += uvScaleX; }
          currentUVBottom.setXYZW(currentI, bo, 1.0 - ((by + 1) * uvScaleY), bw, uvScaleY);
        }
    }
    
    this.voxelMesh.count = iCube;
    this.slabMesh.count = iSlab;
    this.rampMesh.count = iRamp;
    this.stairMesh.count = iStair;
    this.decorMesh.count = iDecor;
    this.glassMesh.count = iGlass;
    this.glassSlabMesh.count = iGlassSlab;
    this.glassRampMesh.count = iGlassRamp;
    this.glassStairMesh.count = iGlassStair;
    this.doorMesh.count = iDoor;
    this.glassDoorMesh.count = iGlassDoor;
    
    [this.voxelMesh, this.slabMesh, this.rampMesh, this.stairMesh, this.decorMesh, this.glassMesh, this.glassSlabMesh, this.glassRampMesh, this.glassStairMesh, this.doorMesh, this.glassDoorMesh].forEach(m => {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      if (m.geometry.attributes.instanceUVTop) m.geometry.attributes.instanceUVTop.needsUpdate = true;
      if (m.geometry.attributes.instanceUVSide) m.geometry.attributes.instanceUVSide.needsUpdate = true;
      if (m.geometry.attributes.instanceUVBottom) m.geometry.attributes.instanceUVBottom.needsUpdate = true;
      if (m.geometry.attributes.isFluid) m.geometry.attributes.isFluid.needsUpdate = true;
      if (m.geometry.attributes.instanceNeighbors1) m.geometry.attributes.instanceNeighbors1.needsUpdate = true;
      if (m.geometry.attributes.instanceNeighbors2) m.geometry.attributes.instanceNeighbors2.needsUpdate = true;
    });
    
    for (const [id, mesh] of Object.entries(this.modelMeshes)) {
      mesh.count = this.modelCounts[id] || 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      if (mesh.geometry.attributes.instanceUVTop) mesh.geometry.attributes.instanceUVTop.needsUpdate = true;
    }

    if (!this.initialLoadComplete) {
      this.initialLoadComplete = true;
      if (this.engine.ui) this.engine.ui.hideLoadingScreen();
    }
  }

  updateEntities() {
    const activeEntities = new Set();
    const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);

    const updateEntityMesh = (entity, id) => {
      activeEntities.add(id);
      let group = this.entityMeshes.get(id);
      
      if (!group) {
        group = new THREE.Group();

        const mat = new THREE.MeshLambertMaterial({ 
          transparent: true, 
          alphaTest: 0.5,
          depthWrite: true,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1
        });
        // Force the sprite normal to always point UP in world space so the daylight hits it uniformly!
        mat.onBeforeCompile = (shader) => {
          shader.vertexShader = shader.vertexShader.replace(
            '#include <defaultnormal_vertex>',
            `vec3 transformedNormal = normalize((viewMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);`
          );
        };
        const geo = new THREE.PlaneGeometry(1, 1);
        const sprite = new THREE.Mesh(geo, mat);
        sprite.castShadow = this.engine.clientSettings.enableShadows !== false;
        sprite.receiveShadow = true;
        sprite.frustumCulled = false;

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

      if (state === 'attack1' || state === 'attack2' || state === 'throw_attack1') {
        width = 288;
        height = 288;
      }

      sprite.scale.set(width, height, 1);

      // By shifting the sprite 46 units along the camera's local Y axis, 
      // its physical feet perfectly anchor to the exact center of the world group!
      sprite.position.copy(camUp).multiplyScalar(46);
      sprite.quaternion.copy(this.camera.quaternion);
      
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
        const mat = new THREE.MeshLambertMaterial({ transparent: true, alphaTest: 0.5, depthWrite: true, side: THREE.DoubleSide });
        mat.onBeforeCompile = (shader) => {
          shader.vertexShader = shader.vertexShader.replace(
            '#include <defaultnormal_vertex>',
            `vec3 transformedNormal = normalize((viewMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);`
          );
        };
        const geo = new THREE.PlaneGeometry(1, 1);
        const sprite = new THREE.Mesh(geo, mat);
        sprite.castShadow = this.engine.clientSettings.enableShadows !== false;
        sprite.receiveShadow = true;
        sprite.frustumCulled = false;
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
      let rotAngle = 0;
      
      if (proj.isCritLoop && proj.loopPitch !== undefined) {
        const v1 = new THREE.Vector3(proj.startX, proj.startY, proj.startZ).project(this.camera);
        const v2 = new THREE.Vector3(proj.targetX, proj.targetY, proj.targetZ).project(this.camera);
        const baseAngle = Math.atan2(v2.y - v1.y, v2.x - v1.x);
        
        isLeft = Math.abs(baseAngle) > Math.PI / 2;
        rotAngle = baseAngle + (isLeft ? -proj.loopPitch : proj.loopPitch);
        proj.lastAngle = rotAngle;
      } else if (proj.lastX !== undefined) {
        const v1 = new THREE.Vector3(proj.lastX, proj.lastY, proj.lastZ).project(this.camera);
        const v2 = new THREE.Vector3(proj.x, proj.y, proj.z).project(this.camera);
        const dxScreen = v2.x - v1.x;
        const dyScreen = v2.y - v1.y;
        if (Math.abs(dxScreen) > 0.00001 || Math.abs(dyScreen) > 0.00001) {
          rotAngle = Math.atan2(dyScreen, dxScreen);
          isLeft = Math.abs(rotAngle) > Math.PI / 2;
          proj.lastAngle = rotAngle;
        } else if (proj.lastAngle !== undefined) {
          rotAngle = proj.lastAngle;
          isLeft = Math.abs(proj.lastAngle) > Math.PI / 2;
        }
      } else {
        const v1 = new THREE.Vector3(proj.startX, proj.startY, proj.startZ).project(this.camera);
        const v2 = new THREE.Vector3(proj.targetX, proj.targetY, proj.targetZ).project(this.camera);
        rotAngle = Math.atan2(v2.y - v1.y, v2.x - v1.x);
        isLeft = Math.abs(rotAngle) > Math.PI / 2;
        proj.lastAngle = rotAngle;
      }
      
      proj.lastX = proj.x;
      proj.lastY = proj.y;
      proj.lastZ = proj.z;

      sprite.scale.set(64, 64, 1);

      sprite.position.set(0, 0, 0);
      sprite.quaternion.copy(this.camera.quaternion);
      sprite.rotateZ(rotAngle);
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
      pGeo.setAttribute('isFluid', new THREE.InstancedBufferAttribute(new Float32Array(2000), 1));
      
      const n1 = new Float32Array(2000 * 4); n1.fill(1);
      pGeo.setAttribute('instanceNeighbors1', new THREE.InstancedBufferAttribute(n1, 4));
      const n2 = new Float32Array(2000 * 2); n2.fill(1);
      pGeo.setAttribute('instanceNeighbors2', new THREE.InstancedBufferAttribute(n2, 2));
      
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
      else if (blockType === 'stone-bricks') blockType = 'stone-bricks1';
      if (blockType === 'ice') blockType = 'ice';
      const atlasPos = this.atlasMap[blockType] || this.atlasMap['white'];
      const uvScaleX = 64 / 2048;
      const uvScaleY = 64 / 2048;
      
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
        const mat = new THREE.MeshLambertMaterial({ transparent: true, alphaTest: 0.5, depthWrite: true, side: THREE.DoubleSide });
        mat.onBeforeCompile = (shader) => {
          shader.vertexShader = shader.vertexShader.replace(
            '#include <defaultnormal_vertex>',
            `vec3 transformedNormal = normalize((viewMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);`
          );
        };
        const geo = new THREE.PlaneGeometry(1, 1);
        const sprite = new THREE.Mesh(geo, mat);
        sprite.castShadow = this.engine.clientSettings.enableShadows !== false;
        sprite.receiveShadow = true;
        sprite.frustumCulled = false;
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
      sprite.quaternion.copy(this.camera.quaternion);
      sprite.rotateZ(deb.rotation || 0);
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
    this.camera.position.z = cz + (camOffsetDist * Math.tan(this.cameraPitch));
    
    this.camera.lookAt(cx, cy, cz);
    // Force a matrix update so the Raycaster perfectly aligns with the new camera position!
    this.camera.updateMatrixWorld();

    if (this.sunLight) {
      this.sunLight.position.set(cx + (this.sunOffsetX || 0), cy + (this.sunOffsetY || 500), cz + (this.sunOffsetZ || 1500));
      this.sunLight.target.position.set(cx, cy, cz);
      this.sunLight.target.updateMatrixWorld();
    }
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
    if (this.previewStairMesh) this.previewStairMesh.count = 0;
    if (this.previewDoorMesh) this.previewDoorMesh.count = 0;
    for (const id in this.previewModelMeshes) this.previewModelMeshes[id].count = 0;

    eng.cursorGridPos = null;

    const modelMeshArr = this.modelMeshes ? Object.values(this.modelMeshes) : [];
    const buildMeshes = [this.voxelMesh, this.slabMesh, this.rampMesh, this.stairMesh, this.glassMesh, this.glassSlabMesh, this.glassRampMesh, this.glassStairMesh, this.doorMesh, this.glassDoorMesh, ...modelMeshArr].filter(Boolean);
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
    if (this.selectionBox) this.selectionBox.visible = false;

    if (eng.editMode && targetPoint && (eng.devOptions.showTile || eng.devOptions.useBlockPreview)) {
      let hitPos = new THREE.Vector3();
      let normal = new THREE.Vector3(0, 0, 1);
      
      if (blockHit) {
        let isDoor = false;
        if (this.doorMap && (blockHit.object === this.doorMesh || (this.glassDoorMesh && blockHit.object === this.glassDoorMesh))) {
          for (const [key, data] of Object.entries(this.doorMap)) {
            if (data.id === blockHit.instanceId && ((data.isGlass && blockHit.object === this.glassDoorMesh) || (!data.isGlass && blockHit.object === this.doorMesh))) {
              hitPos.set(data.cx, data.cy, data.cz);
              isDoor = true;
              break;
            }
          }
        }
        
        if (!isDoor) {
          const matrix = new THREE.Matrix4();
          blockHit.object.getMatrixAt(blockHit.instanceId, matrix);
          hitPos.setFromMatrixPosition(matrix);
        }
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
      eng.cursorGridPos = { x: targetX, y: targetY, z: targetZ, normal: normal.clone(), hitExisting: !!blockHit };

      if (eng.isDraggingSelection && eng.selectionStart && eng.selectionEnd) {
        const minX = Math.min(eng.selectionStart.x, eng.selectionEnd.x);
        const maxX = Math.max(eng.selectionStart.x, eng.selectionEnd.x);
        const minY = Math.min(eng.selectionStart.y, eng.selectionEnd.y);
        const maxY = Math.max(eng.selectionStart.y, eng.selectionEnd.y);
        const minZ = Math.min(eng.selectionStart.z, eng.selectionEnd.z);
        const maxZ = Math.max(eng.selectionStart.z, eng.selectionEnd.z);

        const width = maxX - minX + 32;
        const height = maxY - minY + 32;
        const depth = maxZ - minZ + 32;

        const centerX = minX + (width / 2) - 16;
        const centerY = minY + (height / 2) - 16;
        const centerZ = minZ + (depth / 2) - 16;

        this.selectionBox.scale.set(width + 0.5, height + 0.5, depth + 0.5);
        this.selectionBox.position.set(centerX, centerY, centerZ);

        const activeSlot = document.querySelector('.hotbar-slot.active');
        const tex = activeSlot ? activeSlot.dataset.tex : 'stone';
        const isDeleting = eng.input.keys['shift'] || tex === 'erase';
        const isPicker = tex === 'picker' || eng.input.keys['alt'];

        if (isDeleting) {
          this.selectionBox.material.color.setHex(0xff4757); // Red for deleting
          this.selectionBox.visible = true;
        } else if (isPicker) {
          this.selectionBox.material.color.setHex(0x9b59b6); // Purple for picker
          this.selectionBox.visible = true;
        } else {
          this.selectionBox.material.color.setHex(0x3498db); // Blue for building
          this.selectionBox.visible = true;
        }
      }

      if (eng.devOptions.showTile && !eng.devOptions.useBlockPreview) {
        this.highlightBox.scale.set(1, 1, 1);
        this.highlightBox.position.set(targetX, targetY, targetZ);
        this.highlightBox.material.color.setHex(0xf1c40f);
        this.highlightBox.visible = true;
      }

      if (eng.devOptions.useBlockPreview) {
        const activeSlot = document.querySelector('.hotbar-slot.active');
        const tex = activeSlot ? activeSlot.dataset.tex : 'stone';
        const isDeleting = eng.input.keys['shift'] || tex === 'erase';
        const isPicker = tex === 'picker' || eng.input.keys['alt'];

        if (isPicker) {
           this.highlightBox.scale.set(1, 1, 1);
           this.highlightBox.position.set(targetX, targetY, targetZ);
           this.highlightBox.material.color.setHex(0x9b59b6); // Purple for picker
           this.highlightBox.visible = !eng.isDraggingSelection;
        } else if (isDeleting) {
           const clickedVoxel = eng.mapManager.getVoxelAt(targetX, targetY, targetZ);
           if (clickedVoxel && clickedVoxel.shape && clickedVoxel.shape.startsWith('door')) {
             this.highlightBox.scale.set(1, 1, 2);
             if (clickedVoxel.tex && clickedVoxel.tex.includes('door-bottom')) {
               this.highlightBox.position.set(targetX, targetY, targetZ + 16);
             } else {
               this.highlightBox.position.set(targetX, targetY, targetZ - 16);
             }
           } else {
             this.highlightBox.scale.set(1, 1, 1);
             this.highlightBox.position.set(targetX, targetY, targetZ);
           }
           this.highlightBox.material.color.setHex(0xff4757); // Red for delete
           this.highlightBox.visible = !eng.isDraggingSelection;
        } else {
           this.highlightBox.scale.set(1, 1, 1);
           let placeShape = eng.editShape || 'cube';
           if (placeShape === 'none') {
             this.highlightBox.visible = false;
           } else {
             if (placeShape.endsWith('_player')) {
                const base = placeShape.split('_')[0];
                const pDir = eng.player.dir;
                if (pDir.includes('up')) placeShape = base + '_n';
                else if (pDir.includes('down')) placeShape = base + '_s';
                else if (pDir.includes('right')) placeShape = base + '_e';
                else if (pDir.includes('left')) placeShape = base + '_w';
                else placeShape = base + '_s';
             }
             const colorHex = eng.buildColor || '#ffffff';

             let tilesToPreview = [];
             if (eng.isDraggingSelection && eng.selectedTiles && eng.selectedTiles.length > 0) {
               tilesToPreview = [...eng.selectedTiles];
             } else {
               const clickedVoxel = eng.mapManager.getVoxelAt(targetX, targetY, targetZ);
               if (clickedVoxel && clickedVoxel.shape === 'slab' && normal.z === 1 && clickedVoxel.tex === tex && clickedVoxel.color === colorHex) {
                 placeShape = 'cube';
               } else {
                 targetX += normal.x * 32; targetY += normal.y * 32; targetZ += normal.z * 32;
               }
               tilesToPreview = [{ x: targetX, y: targetY, z: targetZ }];
             }
             
             if (placeShape.startsWith('door')) {
               const extraTiles = [];
               const isTopTex = tex.includes('door-top');
               tilesToPreview.forEach(t => {
                 if (isTopTex) {
                   extraTiles.push({ x: t.x, y: t.y, z: t.z - 32, isBottomDoor: true });
                 } else {
                   extraTiles.push({ x: t.x, y: t.y, z: t.z + 32, isTopDoor: true });
                 }
               });
               tilesToPreview = tilesToPreview.concat(extraTiles);
             }

             let currentMesh; const dummy = new THREE.Object3D(); 
             if (placeShape === 'slab') { currentMesh = this.previewSlabMesh; }
             else if (placeShape.startsWith('ramp')) { 
               currentMesh = this.previewRampMesh; 
               if (placeShape === 'ramp_e') dummy.rotation.set(0, 0, -Math.PI / 2);
               else if (placeShape === 'ramp_n') dummy.rotation.set(0, 0, Math.PI); // Corrected from -Math.PI to Math.PI
               else if (placeShape === 'ramp_w') dummy.rotation.set(0, 0, Math.PI / 2);
             } else if (placeShape.startsWith('stair')) { 
               currentMesh = this.previewStairMesh; 
               if (placeShape === 'stair_e') dummy.rotation.set(0, 0, -Math.PI / 2);
               else if (placeShape === 'stair_n') dummy.rotation.set(0, 0, Math.PI);
               else if (placeShape === 'stair_w') dummy.rotation.set(0, 0, Math.PI / 2);
             } else if (placeShape.startsWith('door')) { 
               currentMesh = this.previewDoorMesh; 
               let rot = 0;
               const isOp = placeShape.includes('_open');
               const isOpIn = placeShape.includes('_open_in');
               const isOpOut = placeShape.includes('_open_out');
               const isFlip = placeShape.includes('_flip');
               if (placeShape.includes('door_e')) rot = -Math.PI / 2;
               else if (placeShape.includes('door_n')) rot = Math.PI;
               else if (placeShape.includes('door_w')) rot = Math.PI / 2;
               else if (placeShape.includes('door_s')) rot = 0;
               
               if (isOp) {
                 rot += isFlip ? -Math.PI / 2 : Math.PI / 2;
               }
               dummy.rotation.set(0, 0, rot);
             } else if (this.previewModelMeshes && this.previewModelMeshes[placeShape]) {
               currentMesh = this.previewModelMeshes[placeShape]; 
               let rot = 0;
               if (eng.editShapeDir === 'e') rot = -Math.PI / 2;
               else if (eng.editShapeDir === 'n') rot = Math.PI;
               else if (eng.editShapeDir === 'w') rot = Math.PI / 2;
               dummy.rotation.set(0, 0, rot);
             } else { currentMesh = this.previewCubeMesh; }

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

             let fluidType = 0.0;
             if (tex === 'water' || tex === 'water_flow') fluidType = 1.0;
             else if (tex === 'lava' || tex === 'lava_flow') fluidType = 2.0;
             else if (tex === 'acid') fluidType = 3.0;
             const isFluid = fluidType > 0.0;
             const isGlassBlock = tex.startsWith('glass');
             const parsedColor = new THREE.Color(colorHex);

             const maxPreview = Math.min(tilesToPreview.length, 4096);
             
             const previewSet = new Set();
             for (let i = 0; i < maxPreview; i++) {
               previewSet.add(`${tilesToPreview[i].x}_${tilesToPreview[i].y}_${tilesToPreview[i].z}`);
             }

             for (let i = 0; i < maxPreview; i++) {
               const t = tilesToPreview[i];
               dummy.position.set(t.x, t.y, t.z);
               dummy.updateMatrix(); 
               currentMesh.setMatrixAt(i, dummy.matrix); 
               currentMesh.setColorAt(i, parsedColor);
               
               let tMainAtlasPos = mainAtlasPos;
               let tSidesAtlasPos = sidesAtlasPos;
               let tBottomAtlasPos = bottomAtlasPos;

               if (t.isTopDoor) {
                 const topTex = tex.replace('bottom', 'top');
                 tMainAtlasPos = this.atlasMap[topTex] || mainAtlasPos;
                 tSidesAtlasPos = tMainAtlasPos; tBottomAtlasPos = tMainAtlasPos;
               } else if (t.isBottomDoor) {
                 const botTex = tex.replace('top', 'bottom');
                 tMainAtlasPos = this.atlasMap[botTex] || mainAtlasPos;
                 tSidesAtlasPos = tMainAtlasPos; tBottomAtlasPos = tMainAtlasPos;
               }

               const setUVs = (uvAttr, atlasPos, idx) => {
                 if (!uvAttr) return;
                 let tw = 64/2048; let to = atlasPos.x * (64/2048);
                 if (placeShape.includes('_flip')) { tw = -tw; to += (64/2048); }
                 uvAttr.setXYZW(idx, to, 1.0 - ((atlasPos.y + 1) * (64/2048)), tw, 64/2048);
               };
               setUVs(currentMesh.geometry.attributes.instanceUVTop, tMainAtlasPos, i);
               setUVs(currentMesh.geometry.attributes.instanceUVSide, tSidesAtlasPos, i);
               setUVs(currentMesh.geometry.attributes.instanceUVBottom, tBottomAtlasPos, i);
               if (currentMesh.geometry.attributes.isFluid) currentMesh.geometry.attributes.isFluid.setX(i, fluidType);

               let visE = 1, visW = 1, visS = 1, visN = 1, visT = 1, visB = 1;
               
               const checkCull = (nx, ny, nz) => {
                 if (previewSet.has(`${nx}_${ny}_${nz}`)) return true;
                 if (isGlassBlock || isFluid) {
                   const v = eng.mapManager.getVoxelAt(nx, ny, nz);
                   if (v && v.tex === tex && (v.shape || 'cube') === placeShape) return true;
                 }
                 return false;
               };

               if (checkCull(t.x + 32, t.y, t.z)) visE = 0;
               if (checkCull(t.x - 32, t.y, t.z)) visW = 0;
               if (checkCull(t.x, t.y + 32, t.z)) visS = 0;
               if (checkCull(t.x, t.y - 32, t.z)) visN = 0;
               if (checkCull(t.x, t.y, t.z + 32)) visT = 0;
               if (checkCull(t.x, t.y, t.z - 32)) visB = 0;

               if (currentMesh.geometry.attributes.instanceNeighbors1) currentMesh.geometry.attributes.instanceNeighbors1.setXYZW(i, visE, visW, visS, visN);
               if (currentMesh.geometry.attributes.instanceNeighbors2) currentMesh.geometry.attributes.instanceNeighbors2.setXY(i, visT, visB);
             }

             currentMesh.count = maxPreview; 
             currentMesh.instanceMatrix.needsUpdate = true;
             if (currentMesh.instanceColor) currentMesh.instanceColor.needsUpdate = true;
             if (currentMesh.geometry.attributes.instanceUVTop) currentMesh.geometry.attributes.instanceUVTop.needsUpdate = true;
             if (currentMesh.geometry.attributes.instanceUVSide) currentMesh.geometry.attributes.instanceUVSide.needsUpdate = true;
             if (currentMesh.geometry.attributes.instanceUVBottom) currentMesh.geometry.attributes.instanceUVBottom.needsUpdate = true;
             if (currentMesh.geometry.attributes.isFluid) currentMesh.geometry.attributes.isFluid.needsUpdate = true;
             if (currentMesh.geometry.attributes.instanceNeighbors1) currentMesh.geometry.attributes.instanceNeighbors1.needsUpdate = true;
             if (currentMesh.geometry.attributes.instanceNeighbors2) currentMesh.geometry.attributes.instanceNeighbors2.needsUpdate = true;
           }
        }
      }
    }

    if (targetPoint) {
      const feetPos = new THREE.Vector3(eng.player.x, eng.player.y, eng.player.z || 0);
      const chestPos = new THREE.Vector3(eng.player.x, eng.player.y, (eng.player.z || 0) + 20);
      
      this.arrowHelper.visible = false;
      if (this.debugOverlay) this.debugOverlay.style.display = 'none';

      let tooltipHTML = '';

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
        
        let vx = Math.round(targetPoint.x / 32) * 32;
        let vy = Math.round(targetPoint.y / 32) * 32;
        let vz = Math.round(targetPoint.z / 32) * 32;
        
        if (blockHit) {
            let isDoor = false;
            if (this.doorMap && (blockHit.object === this.doorMesh || (this.glassDoorMesh && blockHit.object === this.glassDoorMesh))) {
              for (const [key, data] of Object.entries(this.doorMap)) {
                if (data.id === blockHit.instanceId && ((data.isGlass && blockHit.object === this.glassDoorMesh) || (!data.isGlass && blockHit.object === this.doorMesh))) {
                  vx = data.cx; vy = data.cy; vz = data.cz;
                  isDoor = true; break;
                }
              }
            }
            if (!isDoor) {
                const matrix = new THREE.Matrix4();
                blockHit.object.getMatrixAt(blockHit.instanceId, matrix);
                const blockPos = new THREE.Vector3();
                blockPos.setFromMatrixPosition(matrix);
                vx = Math.round(blockPos.x); vy = Math.round(blockPos.y); vz = Math.round(blockPos.z);
            }
        } else if (eng.cursorGridPos && eng.cursorGridPos.hitExisting) {
           vx = eng.cursorGridPos.x;
           vy = eng.cursorGridPos.y;
           vz = eng.cursorGridPos.z;
        }
        
        const voxel = eng.mapManager.getVoxelAt(vx, vy, vz);
        let voxelInfo = '<span style="color: #aaa;">Empty Space (Air)</span>';
        if (voxel) {
           let baseShape = voxel.shape || 'cube';
           let shapeDisplay = baseShape;
           
           let isStandard = baseShape === 'cube' || baseShape === 'slab' || baseShape === 'decor' || baseShape.startsWith('ramp') || baseShape.startsWith('stair') || baseShape.startsWith('door');
           
           if (FURNITURE_REGISTRY && FURNITURE_REGISTRY[baseShape]) {
               shapeDisplay = `Model (${FURNITURE_REGISTRY[baseShape].name})`;
           } else if (isStandard) {
               shapeDisplay = `Block (${baseShape})`;
           } else {
               shapeDisplay = `<span style="color: #ff4757;">Orphaned Data (${baseShape} &rarr; Cube)</span>`;
           }

           const dirNames = { 'n': 'North', 'e': 'East', 's': 'South', 'w': 'West' };
           const dirDisplay = dirNames[voxel.dir || 'n'] || (voxel.dir || 'North');

           voxelInfo = `Material: <span style="color: #f1c40f;">${voxel.tex}</span><br>Shape: <span style="color: #9b59b6;">${shapeDisplay}</span><br>Direction: <span style="color: #e67e22;">${dirDisplay}</span>`;
        }

        tooltipHTML += `
            <strong style="color: #3498db; border-bottom: 1px solid #3498db; padding-bottom: 3px; display: inline-block; margin-bottom: 5px;">Voxel Inspector</strong><br>
            XYZ: <span style="color: #2ecc71;">${vx}, ${vy}, ${vz}</span><br>
            Distance: <span style="color: #f39c12;">${Math.round(dist)}</span><br>
            ${voxelInfo}
        `;
      }
      
      if (tooltipHTML !== '' && this.debugOverlay) {
         this.debugOverlay.style.display = 'block';
         this.debugOverlay.style.left = (eng.input.mousePos.x + 20) + 'px';
         this.debugOverlay.style.top = (eng.input.mousePos.y + 20) + 'px';
         this.debugOverlay.innerHTML = tooltipHTML;
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

        if (eng.devOptions.showDistPlayerToMouse && eng.mouseWorldPos) {
          const feetPos = new THREE.Vector3(eng.player.x, eng.player.y, eng.player.z || 0);
          drawDashedTrace(feetPos, eng.mouseWorldPos, "Player", "Mouse", "#2ecc71");
        }
        
        if (eng.selectedTarget && eng.selectedTarget.type === 'npc') {
          const npc = eng.npcs.find(n => n.uuid === eng.selectedTarget.id);
          if (npc) {
            const npcPos = new THREE.Vector3(npc.x, npc.y, npc.z || 0);
            const feetPos = new THREE.Vector3(eng.player.x, eng.player.y, eng.player.z || 0);
            if (eng.devOptions.showDistToNPC) drawDashedTrace(feetPos, npcPos, "Player", "NPC", "#f1c40f");
            if (eng.devOptions.showDistNpcToMouse && eng.mouseWorldPos) drawDashedTrace(npcPos, eng.mouseWorldPos, "NPC", "Mouse", "#e74c3c");
          }
        }
      }
    }
    
    eng.mouseWorldPos = targetPoint;
  }

  handleResize() {
    this.webgl.setSize(window.innerWidth, window.innerHeight);
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 1000;
    this.camera.left = frustumSize * aspect / -2;
    this.camera.right = frustumSize * aspect / 2;
    this.camera.updateProjectionMatrix();

    if (this.debugCanvas) {
      this.debugCanvas.width = window.innerWidth;
      this.debugCanvas.height = window.innerHeight;
    }
  }

  toggleShadows(isEnabled) {
    this.webgl.shadowMap.enabled = isEnabled;
    if (this.sunLight) this.sunLight.castShadow = isEnabled;

    const meshes = [
      this.voxelMesh, this.slabMesh, this.rampMesh, this.stairMesh, this.decorMesh,
      this.glassMesh, this.glassSlabMesh, this.glassRampMesh, this.glassStairMesh,
      this.doorMesh, this.glassDoorMesh, ...Object.values(this.modelMeshes || {}),
      ...Object.values(this.previewModelMeshes || {}),
      this.previewCubeMesh, this.previewSlabMesh, this.previewRampMesh, this.previewStairMesh, this.previewDoorMesh
    ].filter(Boolean);

    meshes.forEach(mesh => {
      mesh.castShadow = isEnabled;
      mesh.receiveShadow = isEnabled;
      if (mesh.material) mesh.material.needsUpdate = true;
    });

    const updateSpriteShadows = (map) => {
      if (map) {
        for (const group of map.values()) {
          if (group.userData.sprite && group.userData.sprite.isMesh) {
            group.userData.sprite.castShadow = isEnabled;
            group.userData.sprite.receiveShadow = isEnabled;
            if (group.userData.sprite.material) group.userData.sprite.material.needsUpdate = true;
          }
        }
      }
    };

    updateSpriteShadows(this.entityMeshes);
    updateSpriteShadows(this.projectileMeshes);
    updateSpriteShadows(this.debrisMeshes);
  }

  updateTimeOfDay() {
    const cycleDuration = 120000; 
    const t = (performance.now() % cycleDuration) / cycleDuration;
    
    let angle;
    if (t < (2 / 3)) {
      angle = (t / (2 / 3)) * Math.PI; // Expand daytime (0 to PI) over the first 66% of the cycle
    } else {
      angle = Math.PI + ((t - (2 / 3)) / (1 / 3)) * Math.PI; // Compress nighttime (PI to 2PI) into the last 33%
    }

    const sunDist = 2000;
    const height = Math.sin(angle);
    this.sunOffsetZ = Math.abs(height) * sunDist; 
    this.sunOffsetY = Math.cos(angle) * sunDist;
    this.sunOffsetX = Math.cos(angle) * sunDist * 0.5;

    if (height > 0.2) {
      this.hemiLight.color.setHex(0xffffff);
      this.hemiLight.groundColor.setHex(0x444444);
      this.hemiLight.intensity = 0.7;
      this.sunLight.color.setHex(0xffffee);
      this.sunLight.intensity = 1.2;
    } else if (height > 0) {
      this.hemiLight.color.setHex(0xffaa55);
      this.hemiLight.groundColor.setHex(0x221100);
      this.hemiLight.intensity = 0.55;
      this.sunLight.color.setHex(0xff6600);
      this.sunLight.intensity = 0.9;
    } else {
      this.hemiLight.color.setHex(0x334466);
      this.hemiLight.groundColor.setHex(0x1a2233);
      this.hemiLight.intensity = 0.4; // Boosted ambient light at night
      this.sunLight.color.setHex(0x6677aa);
      this.sunLight.intensity = 0.6; // Boosted moonlight casting shadows
    }

    const sunEl = document.getElementById('compass-sun');
    const clockEl = document.getElementById('in-game-clock');
    if (sunEl && clockEl) {
      const r = 26; 
      const sx = -Math.cos(angle) * r;
      const sy = -height * r;
      sunEl.style.transform = `translate(calc(-50% + ${sx}px), calc(-50% + ${sy}px))`;

      if (height > 0.2) {
        sunEl.style.background = '#f1c40f';
        sunEl.style.boxShadow = '0 0 8px #f1c40f';
      } else if (height > 0) {
        sunEl.style.background = '#e67e22';
        sunEl.style.boxShadow = '0 0 8px #e67e22';
      } else {
        sunEl.style.background = '#bdc3c7'; 
        sunEl.style.boxShadow = '0 0 8px #bdc3c7';
      }

      let hours = ((angle / (Math.PI * 2)) * 24 + 6) % 24;
      const h = Math.floor(hours);
      const m = Math.floor((hours - h) * 60);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayH = h % 12 === 0 ? 12 : h % 12;
      const displayM = m < 10 ? '0' + m : m;
      clockEl.innerText = `${displayH}:${displayM} ${ampm}`;
    }
  }

  draw() {
    const eng = this.engine;
    
    if (this.instancedMaterial && this.instancedMaterial.userData.time) {
        this.instancedMaterial.userData.time.value = performance.now() / 1000;
    }

    if (this.debugCanvas) {
      this.debugCtx.clearRect(0, 0, this.debugCanvas.width, this.debugCanvas.height);
    }

    this.updateTimeOfDay();
    this.updateCameraTracking();
    this.updateAnimatedTiles();
    this.updateVoxels();
    this.updateEntities();
    this.updateProjectiles();
    this.updateParticles();
    this.updateDebris();
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

    if (this.doorMap) {
      this.doorPhysics = this.doorPhysics || {};
      let doorsUpdated = false;
      const spring = 0.15;
      const friction = 0.80;
      
      const rootObj = new THREE.Object3D();
      const pivotObj = new THREE.Object3D();
      const doorObj = new THREE.Object3D();
      rootObj.add(pivotObj);
      pivotObj.add(doorObj);

      for (const [key, data] of Object.entries(this.doorMap)) {
        let phys = this.doorPhysics[key];
        if (!phys) { phys = { rot: data.targetRot, vel: 0 }; this.doorPhysics[key] = phys; }
        
        phys.vel += (data.targetRot - phys.rot) * spring;
        phys.vel *= friction;
        phys.rot += phys.vel;

        if (Math.abs(phys.vel) > 0.001 || Math.abs(data.targetRot - phys.rot) > 0.001 || !phys.initialized) {
          phys.initialized = true;
          
          rootObj.position.set(data.cx, data.cy, data.cz);
          rootObj.rotation.set(0, 0, data.baseRot);
          
          pivotObj.position.set(data.flip ? 16 : -16, -14, 0);
          pivotObj.rotation.set(0, 0, phys.rot - data.baseRot);
          
          doorObj.position.set(data.flip ? -16 : 16, 0, 0);
          doorObj.rotation.set(0, 0, data.flip ? Math.PI : 0);
          
          rootObj.updateMatrixWorld(true);
          
          if (data.isGlass) this.glassDoorMesh.setMatrixAt(data.id, doorObj.matrixWorld);
          else this.doorMesh.setMatrixAt(data.id, doorObj.matrixWorld);
          doorsUpdated = true;
        }
      }
      if (doorsUpdated) {
        this.doorMesh.instanceMatrix.needsUpdate = true;
        if (this.glassDoorMesh) this.glassDoorMesh.instanceMatrix.needsUpdate = true;
      }
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
      
      const minX = cx * chunkSize;
      const minY = cy * chunkSize;
      const maxX = minX + chunkSize;
      const maxY = minY + chunkSize;
      const pZ = eng.player.z || 0;

      const toScreen = (vx, vy, vz) => {
        const p = new THREE.Vector3(vx, vy, vz).project(this.camera);
        return {
          x: (p.x + 1) / 2 * window.innerWidth,
          y: -(p.y - 1) / 2 * window.innerHeight
        };
      };

      const pNW = toScreen(minX, minY, pZ);
      const pNE = toScreen(maxX, minY, pZ);
      const pSE = toScreen(maxX, maxY, pZ);
      const pSW = toScreen(minX, maxY, pZ);
      const pNW_top = toScreen(minX, minY, pZ + 512); // Upwards line (Z+)

      ctx.save();
      ctx.strokeStyle = '#9b59b6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      
      ctx.beginPath();
      ctx.moveTo(pNW.x, pNW.y); ctx.lineTo(pNE.x, pNE.y);
      ctx.lineTo(pSE.x, pSE.y); ctx.lineTo(pSW.x, pSW.y);
      ctx.closePath(); ctx.stroke();
      
      ctx.beginPath(); ctx.moveTo(pNW.x, pNW.y); ctx.lineTo(pNW_top.x, pNW_top.y); ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#9b59b6'; ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center'; ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 4;
      ctx.strokeText(`Chunk [${cx}, ${cy}] NW`, pNW_top.x, pNW_top.y - 20);
      ctx.fillText(`Chunk [${cx}, ${cy}] NW`, pNW_top.x, pNW_top.y - 20);
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

    // --- Drag Selection Indicators ---
    if (eng.editMode && eng.input.keys['control'] && eng.cursorGridPos) {
      const activeSlot = document.querySelector('.hotbar-slot.active');
      const tex = activeSlot ? activeSlot.dataset.tex : 'stone';
      const isDeleting = eng.input.keys['shift'] || tex === 'erase';
      const color = isDeleting ? 'rgba(255, 71, 87, 0.6)' : 'rgba(52, 152, 219, 0.6)';
      
      ctx.save();
      const drawIsoArrow = (ox, oy, oz, dx, dy) => {
        const p1 = new THREE.Vector3(ox + dx*16, oy + dy*16, oz).project(this.camera);
        const p2 = new THREE.Vector3(ox + dx*48, oy + dy*48, oz).project(this.camera);
        
        const sx1 = (p1.x + 1) / 2 * window.innerWidth;
        const sy1 = -(p1.y - 1) / 2 * window.innerHeight;
        const sx2 = (p2.x + 1) / 2 * window.innerWidth;
        const sy2 = -(p2.y - 1) / 2 * window.innerHeight;

        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.stroke();

        const angle = Math.atan2(sy2 - sy1, sx2 - sx1);
        ctx.beginPath();
        ctx.moveTo(sx2, sy2);
        ctx.lineTo(sx2 - 12 * Math.cos(angle - Math.PI/6), sy2 - 12 * Math.sin(angle - Math.PI/6));
        ctx.lineTo(sx2 - 12 * Math.cos(angle + Math.PI/6), sy2 - 12 * Math.sin(angle + Math.PI/6));
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      };

      if (eng.isDraggingSelection && eng.selectionStart && eng.selectionEnd) {
        const minX = Math.min(eng.selectionStart.x, eng.selectionEnd.x);
        const maxX = Math.max(eng.selectionStart.x, eng.selectionEnd.x);
        const minY = Math.min(eng.selectionStart.y, eng.selectionEnd.y);
        const maxY = Math.max(eng.selectionStart.y, eng.selectionEnd.y);
        const cz = eng.selectionStart.z + 16;
        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;
        drawIsoArrow(maxX, midY, cz, 1, 0); drawIsoArrow(minX, midY, cz, -1, 0);
        drawIsoArrow(midX, maxY, cz, 0, 1); drawIsoArrow(midX, minY, cz, 0, -1);
      } else {
        const cz = eng.cursorGridPos.z + 16;
        drawIsoArrow(eng.cursorGridPos.x, eng.cursorGridPos.y, cz, 1, 0); drawIsoArrow(eng.cursorGridPos.x, eng.cursorGridPos.y, cz, -1, 0);
        drawIsoArrow(eng.cursorGridPos.x, eng.cursorGridPos.y, cz, 0, 1); drawIsoArrow(eng.cursorGridPos.x, eng.cursorGridPos.y, cz, 0, -1);
      }
      ctx.restore();
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
