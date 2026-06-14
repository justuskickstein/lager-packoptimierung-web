// ============================================================
// EXTREME SMART 3D PACKING ALGORITHM V3
// Fokus:
// - möglichst wenige Boxen
// - realistische stabile Packung
// - lange/schmale Artikel niemals senkrecht
// - lieber eine große Box als mehrere kleine Boxen
// - kompatibel mit 3D-Viewer: x, y, z, packStep
// ============================================================

const ALGORITHM_VERSION = "EXTREME_SMART_3D_STABILITY_V3";
console.log("Aktiver Algorithmus:", ALGORITHM_VERSION);

const EPS = 0.0001;

const RULES = {
  minSupportRatio: 0.76,
  heavySupportRatio: 0.86,
  heavyKg: 8,

  // Wenn ein Objekt lang und schmal ist, darf die längste Seite NICHT Höhe sein.
  longThinRatio: 2.15,

  // Wenn die Grundfläche sehr klein ist, wird die Orientierung verboten.
  minFlatBaseFactorForLongThin: 0.78,

  // Kandidatenlimit pro Box, damit Browser nicht abstürzt.
  maxCandidatePositions: 4500,

  // Je mehr Strategien, desto besser, aber langsamer.
  maxStrategies: 10
};

// ============================================================
// BASIC HELPERS
// ============================================================

function getVolume(item) {
  return item.length * item.width * item.height;
}

function getBaseArea(item) {
  return item.length * item.width;
}

function getMaxDim(item) {
  return Math.max(item.length, item.width, item.height);
}

function getMinDim(item) {
  return Math.min(item.length, item.width, item.height);
}

function roundNum(value) {
  return Math.round(value * 10000) / 10000;
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function expandArticles(articles) {
  const expanded = [];

  articles.forEach((article) => {
    for (let i = 1; i <= article.quantity; i++) {
      expanded.push({
        ...article,
        copyNo: i,
        singleName: `${article.name} #${i}`
      });
    }
  });

  return expanded;
}

// ============================================================
// ORIENTATION LOGIC
// ============================================================

function getAllOrientations(item) {
  if (!item.rotatable) {
    return [
      {
        length: item.length,
        width: item.width,
        height: item.height
      }
    ];
  }

  const values = [
    [item.length, item.width, item.height],
    [item.length, item.height, item.width],
    [item.width, item.length, item.height],
    [item.width, item.height, item.length],
    [item.height, item.length, item.width],
    [item.height, item.width, item.length]
  ];

  const unique = [];

  values.forEach((v) => {
    const orientation = {
      length: v[0],
      width: v[1],
      height: v[2]
    };

    const exists = unique.some((u) => {
      return (
        Math.abs(u.length - orientation.length) < EPS &&
        Math.abs(u.width - orientation.width) < EPS &&
        Math.abs(u.height - orientation.height) < EPS
      );
    });

    if (!exists) {
      unique.push(orientation);
    }
  });

  return unique;
}

function isLongThinItem(item) {
  const dims = [item.length, item.width, item.height].sort((a, b) => a - b);

  const small = dims[0];
  const medium = dims[1];
  const large = dims[2];

  return (
    large >= medium * RULES.longThinRatio &&
    medium <= large * 0.55 &&
    small <= large * 0.35
  );
}

function isForbiddenStandingOrientation(item, orientation) {
  if (!isLongThinItem(item)) {
    return false;
  }

  const originalDims = [item.length, item.width, item.height].sort((a, b) => a - b);

  const originalSmall = originalDims[0];
  const originalMedium = originalDims[1];
  const originalLarge = originalDims[2];

  const largestSideIsHeight =
    Math.abs(orientation.height - originalLarge) < EPS;

  const bestFlatBaseArea = originalLarge * originalMedium;
  const currentBaseArea = orientation.length * orientation.width;

  const baseTooSmall =
    currentBaseArea < bestFlatBaseArea * RULES.minFlatBaseFactorForLongThin;

  const standingOnSmallFace =
    Math.min(orientation.length, orientation.width) <= originalSmall + EPS &&
    Math.max(orientation.length, orientation.width) <= originalMedium + EPS;

  return largestSideIsHeight && (baseTooSmall || standingOnSmallFace);
}

function getAllowedOrientations(item) {
  const all = getAllOrientations(item);

  let allowed = all.filter((orientation) => {
    return !isForbiddenStandingOrientation(item, orientation);
  });

  if (allowed.length === 0) {
    allowed = all;
  }

  allowed.sort((a, b) => {
    // 1. flache Orientierung bevorzugen
    if (a.height !== b.height) return a.height - b.height;

    // 2. große Grundfläche bevorzugen
    const baseA = a.length * a.width;
    const baseB = b.length * b.width;

    if (baseA !== baseB) return baseB - baseA;

    // 3. längere Seite nach Länge bevorzugen
    return b.length - a.length;
  });

  return allowed;
}

// ============================================================
// GEOMETRY
// ============================================================

function boxesOverlap(a, b) {
  const overlapX = a.x < b.x + b.length - EPS && a.x + a.length > b.x + EPS;
  const overlapY = a.y < b.y + b.width - EPS && a.y + a.width > b.y + EPS;
  const overlapZ = a.z < b.z + b.height - EPS && a.z + a.height > b.z + EPS;

  return overlapX && overlapY && overlapZ;
}

function isInsideBox(item, box) {
  return (
    item.x >= -EPS &&
    item.y >= -EPS &&
    item.z >= -EPS &&
    item.x + item.length <= box.length + EPS &&
    item.y + item.width <= box.width + EPS &&
    item.z + item.height <= box.height + EPS
  );
}

function rectangleOverlapArea(a, b) {
  const xOverlap = Math.max(
    0,
    Math.min(a.x + a.length, b.x + b.length) - Math.max(a.x, b.x)
  );

  const yOverlap = Math.max(
    0,
    Math.min(a.y + a.width, b.y + b.width) - Math.max(a.y, b.y)
  );

  return xOverlap * yOverlap;
}

function getCenterPoint(item) {
  return {
    x: item.x + item.length / 2,
    y: item.y + item.width / 2
  };
}

function pointInsideFootprint(point, item) {
  return (
    point.x >= item.x - EPS &&
    point.x <= item.x + item.length + EPS &&
    point.y >= item.y - EPS &&
    point.y <= item.y + item.width + EPS
  );
}

// ============================================================
// SUPPORT / STABILITY
// ============================================================

function getSupportItems(item, placedItems) {
  if (item.z <= EPS) {
    return [];
  }

  return placedItems.filter((placed) => {
    const topZ = placed.z + placed.height;
    return Math.abs(topZ - item.z) < EPS;
  });
}

function calculateSupport(item, placedItems) {
  if (item.z <= EPS) {
    return {
      supported: true,
      supportRatio: 1,
      centerSupported: true,
      supportItems: []
    };
  }

  const supportItems = getSupportItems(item, placedItems);

  let supportArea = 0;

  supportItems.forEach((support) => {
    supportArea += rectangleOverlapArea(item, support);
  });

  const footprintArea = item.length * item.width;
  const supportRatio = supportArea / Math.max(footprintArea, EPS);

  const center = getCenterPoint(item);

  const centerSupported = supportItems.some((support) => {
    return pointInsideFootprint(center, support);
  });

  const requiredSupport =
    item.weight >= RULES.heavyKg ? RULES.heavySupportRatio : RULES.minSupportRatio;

  const supported =
    supportRatio >= requiredSupport &&
    centerSupported;

  return {
    supported,
    supportRatio,
    centerSupported,
    supportItems
  };
}

function canStackOnSupports(item, supportInfo) {
  if (item.z <= EPS) {
    return true;
  }

  for (const support of supportInfo.supportItems) {
    if (!support.stackable) {
      return false;
    }

    if (support.fragile && item.weight > 1.2) {
      return false;
    }
  }

  return true;
}

function hasCollision(item, placedItems) {
  return placedItems.some((placed) => boxesOverlap(item, placed));
}

function checkPlacement(item, usedBox) {
  if (!isInsideBox(item, usedBox.boxType)) {
    return {
      ok: false,
      reason: "outside_box"
    };
  }

  if (hasCollision(item, usedBox.items)) {
    return {
      ok: false,
      reason: "collision"
    };
  }

  const support = calculateSupport(item, usedBox.items);

  if (!support.supported) {
    return {
      ok: false,
      reason: "not_enough_support"
    };
  }

  if (!canStackOnSupports(item, support)) {
    return {
      ok: false,
      reason: "bad_support_item"
    };
  }

  return {
    ok: true,
    support
  };
}

// ============================================================
// CANDIDATE POSITIONS
// ============================================================

function uniqueNumbers(values) {
  const sorted = [...values].map(roundNum).sort((a, b) => a - b);
  const unique = [];

  sorted.forEach((value) => {
    const exists = unique.some((u) => Math.abs(u - value) < EPS);

    if (!exists) {
      unique.push(value);
    }
  });

  return unique;
}

function createCandidatePositions(placedItems, boxType) {
  const xs = [0];
  const ys = [0];
  const zs = [0];

  placedItems.forEach((item) => {
    xs.push(item.x);
    xs.push(item.x + item.length);

    ys.push(item.y);
    ys.push(item.y + item.width);

    zs.push(item.z);
    zs.push(item.z + item.height);

    // zusätzliche Positionen an Kanten verbessern die Packdichte
    xs.push(Math.max(0, item.x - 1));
    ys.push(Math.max(0, item.y - 1));
  });

  const uniqueXs = uniqueNumbers(xs).filter((x) => x >= -EPS && x <= boxType.length + EPS);
  const uniqueYs = uniqueNumbers(ys).filter((y) => y >= -EPS && y <= boxType.width + EPS);
  const uniqueZs = uniqueNumbers(zs).filter((z) => z >= -EPS && z <= boxType.height + EPS);

  const positions = [];

  for (const z of uniqueZs) {
    for (const y of uniqueYs) {
      for (const x of uniqueXs) {
        positions.push({ x, y, z });
      }
    }
  }

  positions.sort((a, b) => {
    // absolute Priorität: unten bleiben
    if (a.z !== b.z) return a.z - b.z;

    // dann möglichst hinten/links beginnen
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });

  return positions.slice(0, RULES.maxCandidatePositions);
}

// ============================================================
// PLACEMENT SCORING
// ============================================================

function getUsedHeight(usedBox) {
  if (usedBox.items.length === 0) {
    return 0;
  }

  return Math.max(...usedBox.items.map((item) => item.z + item.height));
}

function getUsedVolumeInBox(usedBox) {
  return usedBox.items.reduce((sum, item) => sum + getVolume(item), 0);
}

function getWeightInBox(usedBox) {
  return usedBox.items.reduce((sum, item) => sum + item.weight, 0);
}

function scorePlacement(item, usedBox, support) {
  const box = usedBox.boxType;

  const itemTop = item.z + item.height;

  const bottomPenalty = item.z * 120;
  const heightPenalty = itemTop * 20;

  const supportPenalty = support ? (1 - support.supportRatio) * 2500 : 0;

  const sideCompactness =
    item.x * 4 +
    item.y * 4;

  const centerX = item.x + item.length / 2;
  const centerY = item.y + item.width / 2;

  const centerPenalty =
    Math.abs(centerX - box.length / 2) * 0.25 +
    Math.abs(centerY - box.width / 2) * 0.25;

  const longThinStandingPenalty =
    isForbiddenStandingOrientation(item, item) ? 100000 : 0;

  return (
    bottomPenalty +
    heightPenalty +
    supportPenalty +
    sideCompactness +
    centerPenalty +
    longThinStandingPenalty
  );
}

function findBestPlacement(item, usedBox) {
  const positions = createCandidatePositions(usedBox.items, usedBox.boxType);
  const orientations = getAllowedOrientations(item);

  let best = null;
  let bestScore = Infinity;

  for (const pos of positions) {
    for (const orientation of orientations) {
      const candidate = {
        ...item,
        length: orientation.length,
        width: orientation.width,
        height: orientation.height,
        x: pos.x,
        y: pos.y,
        z: pos.z
      };

      const check = checkPlacement(candidate, usedBox);

      if (!check.ok) {
        continue;
      }

      const score = scorePlacement(candidate, usedBox, check.support);

      if (score < bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
  }

  return best;
}

// ============================================================
// BOX SELECTION
// ============================================================

function canItemFitInEmptyBox(item, boxType) {
  if (item.weight > boxType.maxWeight + EPS) {
    return false;
  }

  const orientations = getAllowedOrientations(item);

  return orientations.some((o) => {
    return (
      o.length <= boxType.length + EPS &&
      o.width <= boxType.width + EPS &&
      o.height <= boxType.height + EPS
    );
  });
}

function createEmptyUsedBox(boxType, boxId) {
  return {
    boxId,
    boxType,
    items: []
  };
}

function calculateBoxStats(usedBox) {
  const boxVolume = getVolume(usedBox.boxType);

  const usedVolume = usedBox.items.reduce((sum, item) => {
    return sum + getVolume(item);
  }, 0);

  const usedWeight = usedBox.items.reduce((sum, item) => {
    return sum + item.weight;
  }, 0);

  return {
    ...usedBox,
    usedVolume,
    usedWeight,
    usedVolumePercent: Number(((usedVolume / boxVolume) * 100).toFixed(2)),
    freeVolumePercent: Number((100 - (usedVolume / boxVolume) * 100).toFixed(2))
  };
}

// ============================================================
// PACKING STRATEGIES
// ============================================================

function getItemStrategies(items) {
  const strategies = [];

  strategies.push([...items].sort((a, b) => {
    // schwere, nicht fragile, große Teile zuerst
    if (a.fragile !== b.fragile) return a.fragile ? 1 : -1;
    if (a.weight !== b.weight) return b.weight - a.weight;
    return getVolume(b) - getVolume(a);
  }));

  strategies.push([...items].sort((a, b) => getVolume(b) - getVolume(a)));

  strategies.push([...items].sort((a, b) => {
    const maxA = getMaxDim(a);
    const maxB = getMaxDim(b);
    if (maxA !== maxB) return maxB - maxA;
    return getVolume(b) - getVolume(a);
  }));

  strategies.push([...items].sort((a, b) => {
    const baseA = Math.max(a.length * a.width, a.length * a.height, a.width * a.height);
    const baseB = Math.max(b.length * b.width, b.length * b.height, b.width * b.height);
    if (baseA !== baseB) return baseB - baseA;
    return getVolume(b) - getVolume(a);
  }));

  strategies.push([...items].sort((a, b) => {
    // lange/schmale Teile früh, damit sie flach unten Platz bekommen
    const thinA = isLongThinItem(a) ? 1 : 0;
    const thinB = isLongThinItem(b) ? 1 : 0;
    if (thinA !== thinB) return thinB - thinA;
    return getVolume(b) - getVolume(a);
  }));

  strategies.push([...items].sort((a, b) => {
    // nicht stapelbare Teile eher nach oben/später
    if (a.stackable !== b.stackable) return a.stackable ? -1 : 1;
    return getVolume(b) - getVolume(a);
  }));

  return strategies.slice(0, RULES.maxStrategies);
}

// ============================================================
// CORE PACKING INTO FIXED BOX LIST
// ============================================================

function tryPackItemsIntoGivenBoxes(items, usedBoxes) {
  const unpackedItems = [];
  let step = 1;

  for (const item of items) {
    let placed = false;

    // Beste Box unter allen vorhandenen Boxen suchen.
    let bestBox = null;
    let bestPlacedItem = null;
    let bestScore = Infinity;

    for (const usedBox of usedBoxes) {
      const weightFit =
        getWeightInBox(usedBox) + item.weight <= usedBox.boxType.maxWeight + EPS;

      if (!weightFit) {
        continue;
      }

      const placedCandidate = findBestPlacement(item, usedBox);

      if (!placedCandidate) {
        continue;
      }

      const simulatedBox = {
        ...usedBox,
        items: [...usedBox.items, placedCandidate]
      };

      const score =
        getUsedHeight(simulatedBox) * 120 +
        (getVolume(simulatedBox.boxType) - getUsedVolumeInBox(simulatedBox)) * 0.002 +
        placedCandidate.z * 300;

      if (score < bestScore) {
        bestScore = score;
        bestBox = usedBox;
        bestPlacedItem = placedCandidate;
      }
    }

    if (bestBox && bestPlacedItem) {
      bestBox.items.push({
        ...bestPlacedItem,
        packStep: step++
      });

      placed = true;
    }

    if (!placed) {
      unpackedItems.push({
        ...item,
        failReason: "Keine stabile Position in den ausgewählten Boxen gefunden."
      });
    }
  }

  return {
    usedBoxes: usedBoxes.filter((box) => box.items.length > 0),
    unpackedItems
  };
}

// ============================================================
// TRY ONE BOX TYPE FIRST
// ============================================================

function tryPackAllIntoOneBoxType(items, boxType, strategy) {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);

  if (totalWeight > boxType.maxWeight + EPS) {
    return null;
  }

  const totalVolume = items.reduce((sum, item) => sum + getVolume(item), 0);

  if (totalVolume > getVolume(boxType) + EPS) {
    return null;
  }

  const everyItemCanFit = items.every((item) => canItemFitInEmptyBox(item, boxType));

  if (!everyItemCanFit) {
    return null;
  }

  const usedBoxes = [createEmptyUsedBox(boxType, 1)];

  const result = tryPackItemsIntoGivenBoxes(strategy, usedBoxes);

  if (result.unpackedItems.length > 0) {
    return null;
  }

  return result;
}

// ============================================================
// GREEDY MULTI BOX PACKING
// ============================================================

function packGreedyWithBoxPreference(items, boxes, strategy) {
  const sortedBoxesSmallToLarge = [...boxes].sort((a, b) => getVolume(a) - getVolume(b));
  const sortedBoxesLargeToSmall = [...boxes].sort((a, b) => getVolume(b) - getVolume(a));

  // Sehr wichtig:
  // Wir öffnen neue Boxen nicht immer klein.
  // Wenn die restlichen Artikel zusammen wahrscheinlich in eine große Box passen,
  // nehmen wir lieber eine große Box als mehrere kleine.
  const usedBoxes = [];
  const unpackedItems = [];
  let step = 1;

  for (const item of strategy) {
    let placed = false;

    let bestExistingBox = null;
    let bestExistingPlacement = null;
    let bestExistingScore = Infinity;

    for (const usedBox of usedBoxes) {
      const weightFit =
        getWeightInBox(usedBox) + item.weight <= usedBox.boxType.maxWeight + EPS;

      if (!weightFit) {
        continue;
      }

      const placedCandidate = findBestPlacement(item, usedBox);

      if (!placedCandidate) {
        continue;
      }

      const score =
        placedCandidate.z * 1000 +
        getUsedHeight({
          ...usedBox,
          items: [...usedBox.items, placedCandidate]
        }) * 70 +
        usedBoxes.length * 10000;

      if (score < bestExistingScore) {
        bestExistingScore = score;
        bestExistingBox = usedBox;
        bestExistingPlacement = placedCandidate;
      }
    }

    if (bestExistingBox && bestExistingPlacement) {
      bestExistingBox.items.push({
        ...bestExistingPlacement,
        packStep: step++
      });

      placed = true;
    }

    if (placed) {
      continue;
    }

    // Neue Box wählen:
    // Nicht automatisch kleinste, sondern beste Balance.
    let bestNewBoxType = null;
    let bestNewBoxScore = Infinity;

    for (const boxType of sortedBoxesSmallToLarge) {
      if (!canItemFitInEmptyBox(item, boxType)) {
        continue;
      }

      const candidateBox = createEmptyUsedBox(boxType, usedBoxes.length + 1);
      const placedCandidate = findBestPlacement(item, candidateBox);

      if (!placedCandidate) {
        continue;
      }

      const volumeWaste = getVolume(boxType) - getVolume(item);

      const score =
        volumeWaste * 0.001 +
        getVolume(boxType) * 0.0001;

      if (score < bestNewBoxScore) {
        bestNewBoxScore = score;
        bestNewBoxType = boxType;
      }
    }

    // Wenn schon mehrere kleine Boxen drohen, große Box bevorzugen.
    if (!bestNewBoxType && sortedBoxesLargeToSmall.length > 0) {
      bestNewBoxType = sortedBoxesLargeToSmall.find((boxType) => {
        return canItemFitInEmptyBox(item, boxType);
      });
    }

    if (!bestNewBoxType) {
      unpackedItems.push({
        ...item,
        failReason: "Passt in keine verfügbare Box."
      });
      continue;
    }

    const newBox = createEmptyUsedBox(bestNewBoxType, usedBoxes.length + 1);
    const placedCandidate = findBestPlacement(item, newBox);

    if (!placedCandidate) {
      unpackedItems.push({
        ...item,
        failReason: "Keine stabile Startposition gefunden."
      });
      continue;
    }

    newBox.items.push({
      ...placedCandidate,
      packStep: step++
    });

    usedBoxes.push(newBox);
  }

  return {
    usedBoxes,
    unpackedItems
  };
}

// ============================================================
// SOLUTION EVALUATION
// ============================================================

function evaluateSolution(solution) {
  const usedBoxes = solution.usedBoxes || [];
  const unpackedItems = solution.unpackedItems || [];

  const boxCountPenalty = usedBoxes.length * 10000000;
  const unpackedPenalty = unpackedItems.length * 100000000;

  const totalBoxVolume = usedBoxes.reduce((sum, box) => {
    return sum + getVolume(box.boxType);
  }, 0);

  const totalUsedVolume = usedBoxes.reduce((sum, box) => {
    return sum + getUsedVolumeInBox(box);
  }, 0);

  const volumeWastePenalty = (totalBoxVolume - totalUsedVolume) * 0.4;

  const heightPenalty = usedBoxes.reduce((sum, box) => {
    return sum + getUsedHeight(box) * 250;
  }, 0);

  const stabilityPenalty = usedBoxes.reduce((sum, box) => {
    let penalty = 0;

    box.items.forEach((item) => {
      if (item.z <= EPS) {
        return;
      }

      const others = box.items.filter((i) => i !== item);
      const support = calculateSupport(item, others);

      if (!support.supported) {
        penalty += 1000000;
      } else {
        penalty += (1 - support.supportRatio) * 6000;
      }
    });

    return sum + penalty;
  }, 0);

  const standingPenalty = usedBoxes.reduce((sum, box) => {
    let penalty = 0;

    box.items.forEach((item) => {
      if (isForbiddenStandingOrientation(item, item)) {
        penalty += 5000000;
      }
    });

    return sum + penalty;
  }, 0);

  return (
    unpackedPenalty +
    boxCountPenalty +
    standingPenalty +
    stabilityPenalty +
    heightPenalty +
    volumeWastePenalty
  );
}

function normalizePackSteps(solution) {
  let step = 1;

  solution.usedBoxes.forEach((box, boxIndex) => {
    box.boxId = boxIndex + 1;

    box.items.sort((a, b) => {
      if (a.z !== b.z) return a.z - b.z;
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });

    box.items = box.items.map((item) => {
      return {
        ...item,
        packStep: step++
      };
    });
  });

  return solution;
}

function addStats(solution) {
  return {
    usedBoxes: solution.usedBoxes.map(calculateBoxStats),
    unpackedItems: solution.unpackedItems,
    algorithmVersion: ALGORITHM_VERSION
  };
}

// ============================================================
// MAIN FUNCTION FOR WEBSITE
// ============================================================

function runPackingAlgorithm(articles, boxes) {
  const items = expandArticles(articles);

  if (items.length === 0 || boxes.length === 0) {
    return {
      usedBoxes: [],
      unpackedItems: items,
      algorithmVersion: ALGORITHM_VERSION
    };
  }

  const sortedBoxesSmallToLarge = [...boxes].sort((a, b) => getVolume(a) - getVolume(b));
  const sortedBoxesLargeToSmall = [...boxes].sort((a, b) => getVolume(b) - getVolume(a));

  const strategies = getItemStrategies(items);
  const candidateSolutions = [];

  // ==========================================================
  // 1. Erst versuchen: ALLES IN EINE EINZIGE BOX
  //    Und zwar nicht nur kleinste, sondern jede Box testen.
  // ==========================================================

  for (const boxType of sortedBoxesSmallToLarge) {
    for (const strategy of strategies) {
      const oneBoxSolution = tryPackAllIntoOneBoxType(items, boxType, strategy);

      if (oneBoxSolution) {
        candidateSolutions.push(oneBoxSolution);
      }
    }
  }

  // ==========================================================
  // 2. Falls eine Ein-Box-Lösung existiert:
  //    Immer beste Ein-Box-Lösung nehmen.
  //    Eine große Box ist besser als zwei kleine.
  // ==========================================================

  const oneBoxSolutions = candidateSolutions.filter((solution) => {
    return solution.usedBoxes.length === 1 && solution.unpackedItems.length === 0;
  });

  if (oneBoxSolutions.length > 0) {
    oneBoxSolutions.sort((a, b) => evaluateSolution(a) - evaluateSolution(b));

    const bestOneBox = normalizePackSteps(oneBoxSolutions[0]);
    return addStats(bestOneBox);
  }

  // ==========================================================
  // 3. Wenn nicht alles in eine Box geht:
  //    mehrere Strategien mit Multi-Box testen.
  // ==========================================================

  for (const strategy of strategies) {
    const greedySolution = packGreedyWithBoxPreference(items, sortedBoxesSmallToLarge, strategy);
    candidateSolutions.push(greedySolution);
  }

  // Extra: große Boxen bevorzugen, falls dadurch weniger Boxen entstehen.
  for (const strategy of strategies) {
    const greedyLargePreference = packGreedyWithBoxPreference(items, sortedBoxesLargeToSmall, strategy);
    candidateSolutions.push(greedyLargePreference);
  }

  candidateSolutions.sort((a, b) => evaluateSolution(a) - evaluateSolution(b));

  const best = normalizePackSteps(candidateSolutions[0]);
  return addStats(best);
}