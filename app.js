let articles = [];
let boxes = [];
let latestSolution = null;
let currentBoxIndex = 0;
let currentPackStep = null;

const orderNumberInput = document.getElementById("orderNumber");
const customerNameInput = document.getElementById("customerName");

const articleNameInput = document.getElementById("articleName");
const articleLengthInput = document.getElementById("articleLength");
const articleWidthInput = document.getElementById("articleWidth");
const articleHeightInput = document.getElementById("articleHeight");
const articleWeightInput = document.getElementById("articleWeight");
const articleQuantityInput = document.getElementById("articleQuantity");
const articleFragileInput = document.getElementById("articleFragile");
const articleStackableInput = document.getElementById("articleStackable");
const articleRotatableInput = document.getElementById("articleRotatable");

const boxNameInput = document.getElementById("boxName");
const boxLengthInput = document.getElementById("boxLength");
const boxWidthInput = document.getElementById("boxWidth");
const boxHeightInput = document.getElementById("boxHeight");
const boxMaxWeightInput = document.getElementById("boxMaxWeight");

const addArticleBtn = document.getElementById("addArticleBtn");
const addBoxBtn = document.getElementById("addBoxBtn");
const loadExampleBtn = document.getElementById("loadExampleBtn");
const runAlgorithmBtn = document.getElementById("runAlgorithmBtn");

const articleTableBody = document.getElementById("articleTableBody");
const boxTableBody = document.getElementById("boxTableBody");
const resultOutput = document.getElementById("resultOutput");

const articleTypeCount = document.getElementById("articleTypeCount");
const totalItemCount = document.getElementById("totalItemCount");
const boxTypeCount = document.getElementById("boxTypeCount");
const usedBoxCount = document.getElementById("usedBoxCount");
const boxSelect = document.getElementById("boxSelect");
const prevStepBtn = document.getElementById("prevStepBtn");
const nextStepBtn = document.getElementById("nextStepBtn");
const stepStatusText = document.getElementById("stepStatusText");
const itemInfoPanel = document.getElementById("itemInfoPanel");

addArticleBtn.addEventListener("click", addArticle);
addBoxBtn.addEventListener("click", addBox);
loadExampleBtn.addEventListener("click", loadExampleOrder);
runAlgorithmBtn.addEventListener("click", calculateSolution);
boxSelect.addEventListener("change", handleBoxSelectionChange);
prevStepBtn.addEventListener("click", goToPreviousPackStep);
nextStepBtn.addEventListener("click", goToNextPackStep);

function addArticle() {
  const article = {
    id: crypto.randomUUID(),
    name: articleNameInput.value.trim(),
    length: Number(articleLengthInput.value),
    width: Number(articleWidthInput.value),
    height: Number(articleHeightInput.value),
    weight: Number(articleWeightInput.value),
    quantity: Number(articleQuantityInput.value),
    fragile: articleFragileInput.checked,
    stackable: articleStackableInput.checked,
    rotatable: articleRotatableInput.checked
  };

  if (!isValidArticle(article)) {
    alert("Bitte fülle alle Artikeldaten korrekt aus.");
    return;
  }

  articles.push(article);

  clearArticleForm();
  renderArticles();
  updateSummary();
}

function addBox() {
  const box = {
    id: crypto.randomUUID(),
    name: boxNameInput.value.trim(),
    length: Number(boxLengthInput.value),
    width: Number(boxWidthInput.value),
    height: Number(boxHeightInput.value),
    maxWeight: Number(boxMaxWeightInput.value)
  };

  if (!isValidBox(box)) {
    alert("Bitte fülle alle Boxdaten korrekt aus.");
    return;
  }

  boxes.push(box);

  clearBoxForm();
  renderBoxes();
  updateSummary();
}

function isValidArticle(article) {
  return (
    article.name.length > 0 &&
    article.length > 0 &&
    article.width > 0 &&
    article.height > 0 &&
    article.weight >= 0 &&
    article.quantity > 0
  );
}

function isValidBox(box) {
  return (
    box.name.length > 0 &&
    box.length > 0 &&
    box.width > 0 &&
    box.height > 0 &&
    box.maxWeight > 0
  );
}

function clearArticleForm() {
  articleNameInput.value = "";
  articleLengthInput.value = "";
  articleWidthInput.value = "";
  articleHeightInput.value = "";
  articleWeightInput.value = "";
  articleQuantityInput.value = "";
  articleFragileInput.checked = false;
  articleStackableInput.checked = true;
  articleRotatableInput.checked = true;
}

function clearBoxForm() {
  boxNameInput.value = "";
  boxLengthInput.value = "";
  boxWidthInput.value = "";
  boxHeightInput.value = "";
  boxMaxWeightInput.value = "";
}

function renderArticles() {
  articleTableBody.innerHTML = "";

  if (articles.length === 0) {
    articleTableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="6">Noch keine Artikel hinzugefügt.</td>
      </tr>
    `;
    return;
  }

  articles.forEach((article) => {
    const tr = document.createElement("tr");

    const info = [
      article.fragile ? "zerbrechlich" : null,
      article.stackable ? "stapelbar" : "nicht stapelbar",
      article.rotatable ? "drehbar" : "nicht drehbar"
    ]
      .filter(Boolean)
      .join(", ");

    tr.innerHTML = `
      <td>${article.name}</td>
      <td>${article.length} × ${article.width} × ${article.height}</td>
      <td>${article.weight} kg</td>
      <td>${article.quantity}</td>
      <td>${info}</td>
      <td>
        <button class="delete-btn" onclick="deleteArticle('${article.id}')">
          Entfernen
        </button>
      </td>
    `;

    articleTableBody.appendChild(tr);
  });
}

function renderBoxes() {
  boxTableBody.innerHTML = "";

  if (boxes.length === 0) {
    boxTableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="5">Noch keine Boxen hinzugefügt.</td>
      </tr>
    `;
    return;
  }

  boxes.forEach((box) => {
    const tr = document.createElement("tr");

    const volumeLiter = (getVolume(box) / 1000).toFixed(1);

    tr.innerHTML = `
      <td>${box.name}</td>
      <td>${box.length} × ${box.width} × ${box.height}</td>
      <td>${box.maxWeight} kg</td>
      <td>${volumeLiter} Liter</td>
      <td>
        <button class="delete-btn" onclick="deleteBox('${box.id}')">
          Entfernen
        </button>
      </td>
    `;

    boxTableBody.appendChild(tr);
  });
}

function deleteArticle(id) {
  articles = articles.filter((article) => article.id !== id);
  latestSolution = null;

  renderArticles();
  updateSummary();

  resultOutput.innerHTML = "Artikel wurde entfernt. Bitte Algorithmus erneut starten.";
  resetViewerAfterDataChange();
}

function deleteBox(id) {
  boxes = boxes.filter((box) => box.id !== id);
  latestSolution = null;

  renderBoxes();
  updateSummary();

  resultOutput.innerHTML = "Box wurde entfernt. Bitte Algorithmus erneut starten.";
  resetViewerAfterDataChange();
}

function updateSummary() {
  articleTypeCount.textContent = articles.length;

  const totalItems = articles.reduce((sum, article) => {
    return sum + article.quantity;
  }, 0);

  totalItemCount.textContent = totalItems;
  boxTypeCount.textContent = boxes.length;

  if (latestSolution) {
    usedBoxCount.textContent = latestSolution.usedBoxes.length;
  } else {
    usedBoxCount.textContent = "0";
  }
}

function calculateSolution() {
  if (articles.length === 0) {
    alert("Bitte füge zuerst mindestens einen Artikel hinzu.");
    return;
  }

  if (boxes.length === 0) {
    alert("Bitte füge zuerst mindestens einen Box-Typ hinzu.");
    return;
  }

  latestSolution = runPackingAlgorithm(articles, boxes);

  renderResult(latestSolution);
  renderBoxSelect(latestSolution);
  renderFirstBoxInViewer(latestSolution);
  updateSummary();
}

function renderResult(solution) {
  if (!solution) {
    resultOutput.innerHTML = "Noch keine Berechnung durchgeführt.";
    return;
  }

  let html = "";

  if (solution.usedBoxes.length === 0) {
    html += `
      <p class="danger">
        Es konnte keine passende Box verwendet werden.
      </p>
    `;
  } else {
    html += `
      <p class="success">
        Packlösung erfolgreich berechnet.
      </p>
    `;

    solution.usedBoxes.forEach((usedBox) => {
      html += `
        <div class="result-box">
          <h4>Box ${usedBox.boxId}: ${usedBox.boxType.name}</h4>

          <p>
            Maße:
            ${usedBox.boxType.length} × ${usedBox.boxType.width} × ${usedBox.boxType.height} cm
          </p>

          <p>
            Gewicht:
            ${usedBox.usedWeight.toFixed(2)} kg von ${usedBox.boxType.maxWeight} kg
          </p>

          <p>
            Volumenauslastung:
            ${usedBox.usedVolumePercent} %
          </p>

          <p>
            Freies Volumen:
            ${usedBox.freeVolumePercent} %
          </p>

          <strong>Gepackte Artikel:</strong>

          <ul>
            ${usedBox.items
              .map((item) => {
                return `
                  <li>
                    ${item.singleName}
                    — ${item.length} × ${item.width} × ${item.height} cm,
                    ${item.weight} kg
                  </li>
                `;
              })
              .join("")}
          </ul>
        </div>
      `;
    });
  }

  if (solution.unpackedItems.length > 0) {
    html += `
      <div class="result-box">
        <h4 class="warning">Nicht packbare Artikel</h4>

        <ul>
          ${solution.unpackedItems
            .map((item) => {
              return `
                <li>
                  ${item.singleName}
                  — ${item.length} × ${item.width} × ${item.height} cm,
                  ${item.weight} kg
                </li>
              `;
            })
            .join("")}
        </ul>
      </div>
    `;
  }

  resultOutput.innerHTML = html;
}

function loadExampleOrder() {
  orderNumberInput.value = "1001";
  customerNameInput.value = "IKEA Testauftrag";

  articles = [
    {
      id: crypto.randomUUID(),
      name: "Billy Regalbrett",
      length: 80,
      width: 30,
      height: 2,
      weight: 3,
      quantity: 4,
      fragile: false,
      stackable: true,
      rotatable: true
    },
    {
      id: crypto.randomUUID(),
      name: "Schubladenelement",
      length: 45,
      width: 35,
      height: 15,
      weight: 6,
      quantity: 2,
      fragile: false,
      stackable: true,
      rotatable: true
    },
    {
      id: crypto.randomUUID(),
      name: "Glasplatte",
      length: 60,
      width: 40,
      height: 1,
      weight: 4,
      quantity: 1,
      fragile: true,
      stackable: false,
      rotatable: true
    },
    {
      id: crypto.randomUUID(),
      name: "Tischbein",
      length: 70,
      width: 8,
      height: 8,
      weight: 2,
      quantity: 4,
      fragile: false,
      stackable: true,
      rotatable: true
    }
  ];

  boxes = [
    {
      id: crypto.randomUUID(),
      name: "Box S",
      length: 60,
      width: 40,
      height: 30,
      maxWeight: 15
    },
    {
      id: crypto.randomUUID(),
      name: "Box M",
      length: 100,
      width: 60,
      height: 50,
      maxWeight: 30
    },
    {
      id: crypto.randomUUID(),
      name: "Box L",
      length: 120,
      width: 80,
      height: 70,
      maxWeight: 50
    }
  ];

  latestSolution = null;

  renderArticles();
renderBoxes();
renderResult(null);
renderBoxSelect(null);
showViewerEmptyMessage("Beispielauftrag geladen. Starte den Algorithmus für die 3D-Ansicht.");
updateSummary();
}
function renderBoxSelect(solution) {
  boxSelect.innerHTML = "";

  if (!solution || solution.usedBoxes.length === 0) {
    boxSelect.innerHTML = `
      <option value="">Keine Box berechnet</option>
    `;
    return;
  }

  solution.usedBoxes.forEach((usedBox, index) => {
    const option = document.createElement("option");

    option.value = index;
    option.textContent = `Box ${usedBox.boxId}: ${usedBox.boxType.name} (${usedBox.usedVolumePercent} %)`;

    boxSelect.appendChild(option);
  });
}

function renderFirstBoxInViewer(solution) {
  if (!solution || solution.usedBoxes.length === 0) {
    showViewerEmptyMessage("Es gibt keine berechnete Box für die 3D-Ansicht.");
    stepStatusText.textContent = "Keine Packreihenfolge vorhanden.";
    return;
  }

  currentBoxIndex = 0;
  boxSelect.value = "0";

  const selectedBox = solution.usedBoxes[0];
  currentPackStep = getMaxStepForBox(selectedBox);

  updateStepStatus(selectedBox);
  renderPackedBox3D(selectedBox, currentPackStep, handleItemClick);
}

function handleBoxSelectionChange() {
  if (!latestSolution) {
    return;
  }

  const selectedIndex = Number(boxSelect.value);

  if (Number.isNaN(selectedIndex)) {
    return;
  }

  const selectedBox = latestSolution.usedBoxes[selectedIndex];

  if (!selectedBox) {
    return;
  }

  currentBoxIndex = selectedIndex;
  currentPackStep = getMaxStepForBox(selectedBox);

  updateStepStatus(selectedBox);
  renderPackedBox3D(selectedBox, currentPackStep, handleItemClick);
  resetItemInfoPanel();
}

function resetViewerAfterDataChange() {
  currentBoxIndex = 0;
  currentPackStep = null;

  renderBoxSelect(null);
  showViewerEmptyMessage("Daten wurden geändert. Starte den Algorithmus erneut.");

  stepStatusText.textContent = "Daten wurden geändert. Bitte Algorithmus erneut starten.";
  resetItemInfoPanel();
}

function getSelectedBox() {
  if (!latestSolution) {
    return null;
  }

  return latestSolution.usedBoxes[currentBoxIndex] || null;
}

function getMinStepForBox(usedBox) {
  if (!usedBox || usedBox.items.length === 0) {
    return 0;
  }

  return Math.min(...usedBox.items.map((item) => item.packStep || 1));
}

function getMaxStepForBox(usedBox) {
  if (!usedBox || usedBox.items.length === 0) {
    return 0;
  }

  return Math.max(...usedBox.items.map((item) => item.packStep || 1));
}

function goToPreviousPackStep() {
  const selectedBox = getSelectedBox();

  if (!selectedBox) {
    return;
  }

  const minStep = getMinStepForBox(selectedBox);

  if (currentPackStep > minStep) {
    currentPackStep--;
    updateStepStatus(selectedBox);
    renderPackedBox3D(selectedBox, currentPackStep, handleItemClick);
    resetItemInfoPanel();
  }
}

function goToNextPackStep() {
  const selectedBox = getSelectedBox();

  if (!selectedBox) {
    return;
  }

  const maxStep = getMaxStepForBox(selectedBox);

  if (currentPackStep < maxStep) {
    currentPackStep++;
    updateStepStatus(selectedBox);
    renderPackedBox3D(selectedBox, currentPackStep, handleItemClick);
    resetItemInfoPanel();
  }
}

function updateStepStatus(usedBox) {
  if (!usedBox || usedBox.items.length === 0) {
    stepStatusText.textContent = "Keine Artikel in dieser Box.";
    return;
  }

  const visibleItems = usedBox.items.filter((item) => {
    return (item.packStep || 1) <= currentPackStep;
  });

  const maxStep = getMaxStepForBox(usedBox);

  stepStatusText.textContent =
    `Packschritt ${currentPackStep} von ${maxStep} · ` +
    `${visibleItems.length} von ${usedBox.items.length} Artikeln sichtbar`;
}

function handleItemClick(item) {
  if (!itemInfoPanel || !item) {
    return;
  }

  itemInfoPanel.innerHTML = `
    <h4>${item.singleName}</h4>
    <p>Dieser Artikel wurde im Packschritt ${item.packStep} platziert.</p>

    <div class="item-info-grid">
      <div class="item-info-field">
        <span>Maße</span>
        <strong>${item.length} × ${item.width} × ${item.height} cm</strong>
      </div>

      <div class="item-info-field">
        <span>Gewicht</span>
        <strong>${item.weight} kg</strong>
      </div>

      <div class="item-info-field">
        <span>Position</span>
        <strong>x=${item.x}, y=${item.y}, z=${item.z}</strong>
      </div>

      <div class="item-info-field">
        <span>Eigenschaften</span>
        <strong>
          ${item.fragile ? "zerbrechlich" : "nicht zerbrechlich"},
          ${item.stackable ? "stapelbar" : "nicht stapelbar"}
        </strong>
      </div>
    </div>
  `;
}

function resetItemInfoPanel() {
  if (!itemInfoPanel) {
    return;
  }

  itemInfoPanel.innerHTML = `
    <h4>Artikeldetails</h4>
    <p>Klicke im 3D-Modell auf einen Artikel, um Details zu sehen.</p>
  `;
}

renderArticles();
renderBoxes();
updateSummary();
