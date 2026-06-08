let scene = null;
let camera = null;
let renderer = null;
let controls = null;
let currentAnimationId = null;
let raycaster = null;
let mouse = null;
let clickableMeshes = [];
let selectedMesh = null;
let selectedOriginalColor = null;

function clearViewer() {
  const viewer = document.getElementById("viewer3d");

  if (!viewer) {
    return;
  }

  if (currentAnimationId) {
    cancelAnimationFrame(currentAnimationId);
    currentAnimationId = null;
  }

  clickableMeshes = [];
  selectedMesh = null;
  selectedOriginalColor = null;

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

function renderPackedBox3D(usedBox, visibleStep = null, onItemClick = null) {
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

  if (THREE.OrbitControls) {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
  } else {
    controls = null;
    console.warn("OrbitControls wurde nicht geladen.");
  }

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  renderer.domElement.addEventListener("click", function (event) {
    handleViewerClick(event, viewer, onItemClick);
  });

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.72);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
  directionalLight.position.set(200, 300, 400);
  scene.add(directionalLight);

  addBoxFrame(usedBox.boxType);
  addPackedItems(usedBox, visibleStep);
  addGroundGrid(maxDimension);

  controls?.target.set(
    usedBox.boxType.length / 2,
    usedBox.boxType.height / 2,
    usedBox.boxType.width / 2
  );

  controls?.update();

  function animate() {
    currentAnimationId = requestAnimationFrame(animate);

    if (controls) {
      controls.update();
    }

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

function addPackedItems(usedBox, visibleStep) {
  const itemsToShow = usedBox.items.filter((item) => {
    if (visibleStep === null || visibleStep === undefined) {
      return true;
    }

    return (item.packStep || 1) <= visibleStep;
  });

  itemsToShow.forEach((item, index) => {
    const geometry = new THREE.BoxGeometry(
      item.length,
      item.height,
      item.width
    );

    const color = getItemColor(item.packStep || index);

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

    mesh.userData.item = item;
    mesh.userData.originalColor = color;

    clickableMeshes.push(mesh);
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

    addStepNumberLabel(item, mesh.position);
  });
}

function addStepNumberLabel(item, position) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;

  const context = canvas.getContext("2d");

  context.fillStyle = "rgba(7, 11, 22, 0.85)";
  context.roundRect(8, 8, 112, 48, 18);
  context.fill();

  context.fillStyle = "white";
  context.font = "bold 30px Arial";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(item.packStep || "?"), 64, 33);

  const texture = new THREE.CanvasTexture(canvas);

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(18, 9, 1);

  sprite.position.set(
    position.x,
    position.y + item.height / 2 + 5,
    position.z
  );

  scene.add(sprite);
}

function handleViewerClick(event, viewer, onItemClick) {
  if (!raycaster || !mouse || !camera) {
    return;
  }

  const rect = viewer.getBoundingClientRect();

  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(clickableMeshes);

  if (intersects.length === 0) {
    return;
  }

  const clickedMesh = intersects[0].object;
  const item = clickedMesh.userData.item;

  highlightSelectedMesh(clickedMesh);

  if (onItemClick) {
    onItemClick(item);
  }
}

function highlightSelectedMesh(mesh) {
  if (selectedMesh && selectedOriginalColor !== null) {
    selectedMesh.material.color.setHex(selectedOriginalColor);
  }

  selectedMesh = mesh;
  selectedOriginalColor = mesh.userData.originalColor;

  mesh.material.color.setHex(0xffffff);
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