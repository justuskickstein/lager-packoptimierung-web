let scene = null;
let camera = null;
let renderer = null;
let controls = null;
let currentAnimationId = null;

function clearViewer() {
  const viewer = document.getElementById("viewer3d");

  if (!viewer) {
    return;
  }

  if (currentAnimationId) {
    cancelAnimationFrame(currentAnimationId);
    currentAnimationId = null;
  }

  viewer.innerHTML = "";
}

function showViewerEmptyMessage(message) {
  const viewer = document.getElementById("viewer3d");

  if (!viewer) {
    return;
  }

  clearViewer();

  viewer.innerHTML = `
    <div class="viewer-empty">
      <div class="cube-icon"></div>
      <p>${message}</p>
    </div>
  `;
}

function renderPackedBox3D(usedBox) {
  const viewer = document.getElementById("viewer3d");

  if (!viewer || !usedBox) {
    return;
  }

  clearViewer();

  const width = viewer.clientWidth;
  const height = viewer.clientHeight;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101827);

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000);

  const maxDimension = Math.max(
    usedBox.boxType.length,
    usedBox.boxType.width,
    usedBox.boxType.height
  );

  camera.position.set(
    maxDimension * 1.4,
    maxDimension * 1.2,
    maxDimension * 1.6
  );

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
  });

  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio || 1);

  viewer.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.72);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
  directionalLight.position.set(200, 300, 400);
  scene.add(directionalLight);

  addBoxFrame(usedBox.boxType);
  addPackedItems(usedBox);
  addGroundGrid(maxDimension);

  controls.target.set(
    usedBox.boxType.length / 2,
    usedBox.boxType.height / 2,
    usedBox.boxType.width / 2
  );

  controls.update();

  function animate() {
    currentAnimationId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }

  animate();
}

function addBoxFrame(boxType) {
  const geometry = new THREE.BoxGeometry(
    boxType.length,
    boxType.height,
    boxType.width
  );

  const edges = new THREE.EdgesGeometry(geometry);

  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.9
  });

  const wireframe = new THREE.LineSegments(edges, lineMaterial);

  wireframe.position.set(
    boxType.length / 2,
    boxType.height / 2,
    boxType.width / 2
  );

  scene.add(wireframe);

  const transparentMaterial = new THREE.MeshBasicMaterial({
    color: 0x6c7cff,
    transparent: true,
    opacity: 0.06
  });

  const transparentBox = new THREE.Mesh(geometry, transparentMaterial);

  transparentBox.position.copy(wireframe.position);
  scene.add(transparentBox);
}

function addPackedItems(usedBox) {
  usedBox.items.forEach((item, index) => {
    const geometry = new THREE.BoxGeometry(
      item.length,
      item.height,
      item.width
    );

    const color = getItemColor(index);

    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.55,
      metalness: 0.08
    });

    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(
      item.x + item.length / 2,
      item.z + item.height / 2,
      item.y + item.width / 2
    );

    scene.add(mesh);

    const edges = new THREE.EdgesGeometry(geometry);

    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0x070b16,
      transparent: true,
      opacity: 0.75
    });

    const edgeLines = new THREE.LineSegments(edges, edgeMaterial);
    edgeLines.position.copy(mesh.position);

    scene.add(edgeLines);
  });
}

function addGroundGrid(maxDimension) {
  const size = Math.max(200, maxDimension * 2);
  const divisions = 20;

  const gridHelper = new THREE.GridHelper(size, divisions, 0x6c7cff, 0x26324d);

  gridHelper.position.y = -0.5;
  scene.add(gridHelper);
}

function getItemColor(index) {
  const colors = [
    0x6c7cff,
    0x3ee88f,
    0xffb020,
    0xff5c7c,
    0x9b5cff,
    0x2eb7ff,
    0xff8f3e,
    0x4ef0c4
  ];

  return colors[index % colors.length];
}

function resizeViewer() {
  const viewer = document.getElementById("viewer3d");

  if (!viewer || !renderer || !camera) {
    return;
  }

  const width = viewer.clientWidth;
  const height = viewer.clientHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
}

window.addEventListener("resize", resizeViewer);