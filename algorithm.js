// ============================================================
// SMART 3D PACKING ALGORITHM V2
// Ziel:
// - möglichst wenige Boxen
// - stabile Packung
// - keine unrealistischen Mini-Auflagen
// - flache Orientierung bei kippgefährdeten Artikeln
// - Packschritte für 3D-Visualisierung
// ============================================================

const EPS = 0.0001;

const PACKING_RULES = {
  // Mindestauflage: Ein Artikel auf anderen Artikeln muss mindestens
  // diesen Anteil seiner Grundfläche unterstützt bekommen.
  minSupportRatio: 0.72,

  // Für schwere Artikel noch strenger.
  heavyItemSupportRatio: 0.82,

  // Ab diesem Gewicht gilt ein Artikel als schwer.
  heavyItemKg: 8,

  // Wenn ein Artikel sehr hoch und schmal steht, gilt er als kippgefährdet.
  maxHeightToBaseRatio: 1.65,

  // Sehr kleine Auflageflächen bei hohen Artikeln werden vermieden.
  minBaseAreaFactorForTallItems: 0.42,

  // Zerbrechliche Artikel sollen möglichst nicht als tragende Basis dienen.
  avoidStackingOnFragile: true,

  // Zeit-/Kandidatenlimit, damit die Website nicht endlos rechnet.
  maxCandidatePositions: 2500
};

function getVolume(item) {
  return item.length * item.width * item.height;
}

function getBaseArea(item) {
  return item.length * item.width;
}

function getFootprintCenter(item) {
  return {
    x: item.x + item.length / 2,
    y: item.y + item.width / 2
  };
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
// ORIENTIERUNGEN
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

function isTallAndUnstableOrientation(orientation, originalItem) {
  const baseMax = Math.max(orientation.length, orientation.width);
  const baseMin = Math.min(orientation.length, orientation.width);
  const height = orientation.height;

  const sortedOriginalDims = [
    originalItem.length,
    originalItem.width,
    originalItem.height
  ].sort((a, b) => a - b);

  const originalSmall = sortedOriginalDims[0];
  const originalMedium = sortedOriginalDims[1];
  const originalLarge = sortedOriginalDims[2];

  const originalIsLongThin =
    originalLarge >= originalMedium * 2.2 &&
    originalMedium <= originalLarge * 0.45;

  const heightToBaseRatio = height / Math.max(baseMax, EPS);

  const baseArea = orientation.length * orientation.width;
  const largestPossibleBaseArea = originalLarge * originalMedium;

  const baseTooSmall =
    baseArea < largestPossibleBaseArea * PACKING_RULES.minBaseAreaFactorForTallItems;

  const clearlyStandingTall =
    heightToBaseRatio > PACKING_RULES.maxHeightToBaseRatio ||
    (height === originalLarge && baseMin === originalSmall);

  return originalIsLongThin && clearlyStandingTall && baseTooSmall;
}

function getStableOrientations(item) {
  const orientations = getAllOrientations(item);

  const stable = orientations.filter((orientation) => {
    return !isTallAndUnstableOrientation(orientation, item);
  });

  const usable = stable.length > 0 ? stable : orientations;

  usable.sort((a, b) => {
    // flachere Orientierung bevorzugen
    if (a.height !== b.height) return a.height - b.height;

    // größere Grundfläche bevorzugen
    const baseA = a.length * a.width;
    const baseB = b.length * b.width;

    return baseB - baseA;
  });

  return usable;
}

// ============================================================
// GEOMETRIE
// ============================================================

function boxesOverlap(a, b) {
  const overlapX = a.x < b.x + b.length - EPS && a.x + a.length > b.x + EPS;
  const overlapY = a.y < b.y + b.width - EPS && a.y + a.width > b.y + EPS;
  const overlapZ = a.z < b.z + b.height - EPS && a.z + a.height > b.z + EPS;

  return overlapX && overlapY && overlapZ;
}

function isInsideBox(item, boxType) {
  return (
    item.x >= -EPS &&
    item.y >= -EPS &&
    item.z >= -EPS &&
    item.x + item.length <= boxType.length + EPS &&
    item.y + item.width <= boxType.width + EPS &&
    item.z + item.height <= boxType.height + EPS
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

function pointInsideFootprint(point, item) {
  return (
    point.x >= item.x - EPS &&
    point.x <= item.x + item.length + EPS &&
    point.y >= item.y - EPS &&
    point.y <= item.y + item.width + EPS
  );
}

// ============================================================
// STABILITÄT
// ============================================================

function getSupportingItems(positionedItem, placedItems) {
  if (positionedItem.z <= EPS) {
    return [];
  }

  return placedItems.filter((placedItem) => {
    const topZ = placedItem.z + placedItem.height;
    return Math.abs(topZ - positionedItem.z) < EPS;
  });
}

function calculateSupport(positionedItem, placedItems) {
  if (positionedItem.z <= EPS) {
    return {
      supported: true,
      supportRatio: 1,
      centerSupported: true,
      supportingItems: []
    };
  }

  const supportingItems = getSupportingItems(positionedItem, placedItems);

  const footprintArea = positionedItem.length * positionedItem.width;

  let supportArea = 0;

  supportingItems.forEach((supportItem) => {
    supportArea += rectangleOverlapArea(positionedItem, supportItem);
  });

  const supportRatio = supportArea / Math.max(footprintArea, EPS);

  const center = getFootprintCenter(positionedItem);

  const centerSupported = supportingItems.some((supportItem) => {
    return pointInsideFootprint(center, supportItem);
  });

  const requiredSupport =
    positionedItem.weight >= PACKING_RULES.heavyItemKg
      ? PACKING_RULES.heavyItemSupportRatio
      : PACKING_RULES.minSupportRatio;

  const supported =
    supportRatio >= requiredSupport &&
    centerSupported;

  return {
    supported,
    supportRatio,
    centerSupported,
    supportingItems
  };
}

function canBeStackedOn(positionedItem, supportInfo) {
  if (positionedItem.z <= EPS) {
    return true;
  }

  for (const supportItem of supportInfo.supportingItems) {
    if (!supportItem.stackable) {
      return false;
    }

    if (PACKING_RULES.avoidStackingOnFragile && supportItem.fragile) {
      // leichte Artikel dürfen auf zerbrechlichen Artikeln eventuell liegen,
      // schwere aber nicht.
      if (positionedItem.weight > 1.5) {
        return false;
      }
    }
  }

  return true;
}

function hasNoCollision(positionedItem, placedItems) {
  return !placedItems.some((placedItem) => {
    return boxesOverlap(positionedItem, placedItem);
  });
}

function canPlaceItem(positionedItem, usedBox) {
  if (!isInsideBox(positionedItem, usedBox.boxType)) {
    return {
      ok: false,
      reason: "outside_box"
    };
  }

  if (!hasNoCollision(positionedItem, usedBox.items)) {
    return {
      ok: false,
      reason: "collision"
    };
  }

  const supportInfo = calculateSupport(positionedItem, usedBox.items);

  if (!supportInfo.supported) {
    return {
      ok: false,
      reason: "not_enough_support"
    };
  }

  if (!canBeStackedOn(positionedItem, supportInfo)) {
    return {
      ok: false,
      reason: "bad_stack_support"
    };
  }

  return {
    ok: true,
    supportInfo
  };
}

// ============================================================
// KANDIDATENPOSITIONEN
// ============================================================

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
    // immer erst unten packen
    if (a.z !== b.z) return a.z - b.z;

    // dann möglichst weit hinten/links geordnet
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });

  return positions.slice(0, PACKING_RULES.maxCandidatePositions);
}

function uniqueNumbers(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const unique = [];

  sorted.forEach((value) => {
    const exists = unique.some((u) => Math.abs(u - value) < EPS);

    if (!exists) {
      unique.push(value);
    }
  });

  return unique;
}

// ============================================================
// BEWERTUNG EINER POSITION
// ============================================================

function scorePlacement(positionedItem, usedBox, supportInfo) {
  const box = usedBox.boxType;

  const supportRatio = supportInfo ? supportInfo.supportRatio : 1;

  const bottomScore = positionedItem.z * 8;
  const backScore = positionedItem.y * 1.2;
  const leftScore = positionedItem.x * 1.2;

  const heightPenalty = positionedItem.height * 0.5;

  const supportBonus = (1 - supportRatio) * 500;

  const centerX = positionedItem.x + positionedItem.length / 2;
  const centerY = positionedItem.y + positionedItem.width / 2;

  const centerPenalty =
    Math.abs(centerX - box.length / 2) * 0.08 +
    Math.abs(centerY - box.width / 2) * 0.08;

  return (
    bottomScore +
    backScore +
    leftScore +
    heightPenalty +
    supportBonus +
    centerPenalty
  );
}

function findBestPlacement(item, usedBox) {
  const orientations = getStableOrientations(item);
  const positions = createCandidatePositions(usedBox.items, usedBox.boxType);

  let bestPlacement = null;
  let bestScore = Infinity;

  for (const pos of positions) {
    for (const orientation of orientations) {
      const positionedItem = {
        ...item,
        length: orientation.length,
        width: orientation.width,
        height: orientation.height,
        x: pos.x,
        y: pos.y,
        z: pos.z
      };

      const placementCheck = canPlaceItem(positionedItem, usedBox);

      if (!placementCheck.ok) {
        continue;
      }

      const score = scorePlacement(
        positionedItem,
        usedBox,
        placementCheck.supportInfo
      );

      if (score < bestScore) {
        bestScore = score;
        bestPlacement = positionedItem;
      }
    }
  }

  return bestPlacement;
}

// ============================================================
// BOX-LOGIK
// ============================================================

function currentBoxWeight(usedBox) {
  return usedBox.items.reduce((sum, item) => sum + item.weight, 0);
}

function canStartNewBox(item, boxType) {
  if (item.weight > boxType.maxWeight) {
    return false;
  }

  const orientations = getStableOrientations(item);

  return orientations.some((orientation) => {
    return (
      orientation.length <= boxType.length + EPS &&
      orientation.width <= boxType.width + EPS &&
      orientation.height <= boxType.height + EPS
    );
  });
}

function createNewBoxWithItem(item, boxType, boxId) {
  const emptyBox = {
    boxId,
    boxType,
    items: []
  };

  const placedItem = findBestPlacement(item, emptyBox);

  if (!placedItem) {
    return null;
  }

  return {
    boxId,
    boxType,
    items: [placedItem]
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
// SORTIERSTRATEGIEN
// ============================================================

function getPackingOrders(items) {
  const byVolumeHeavyStable = [...items].sort((a, b) => {
    // nicht zerbrechlich zuerst
    if (a.fragile !== b.fragile) return a.fragile ? 1 : -1;

    // schwere Artikel eher nach unten
    if (a.weight !== b.weight) return b.weight - a.weight;

    // große Artikel zuerst
    return getVolume(b) - getVolume(a);
  });

  const byVolume = [...items].sort((a, b) => {
    return getVolume(b) - getVolume(a);
  });

  const byLargestSide = [...items].sort((a, b) => {
    const maxA = Math.max(a.length, a.width, a.height);
    const maxB = Math.max(b.length, b.width, b.height);

    if (maxA !== maxB) return maxB - maxA;

    return getVolume(b) - getVolume(a);
  });

  const byBaseArea = [...items].sort((a, b) => {
    const baseA = Math.max(
      a.length * a.width,
      a.length * a.height,
      a.width * a.height
    );

    const baseB = Math.max(
      b.length * b.width,
      b.length * b.height,
      b.width * b.height
    );

    if (baseA !== baseB) return baseB - baseA;

    return getVolume(b) - getVolume(a);
  });

  return [
    byVolumeHeavyStable,
    byVolume,
    byLargestSide,
    byBaseArea
  ];
}

// ============================================================
// EINE PACKUNG BERECHNEN
// ============================================================

function packWithOrder(items, boxes) {
  const sortedBoxes = [...boxes].sort((a, b) => {
    return getVolume(a) - getVolume(b);
  });

  const usedBoxes = [];
  const unpackedItems = [];
  let globalPackStep = 1;

  items.forEach((item) => {
    let placed = false;

    // Erst versuchen, in bestehende Boxen zu packen.
    // Boxen mit weniger Restvolumen werden zuerst getestet.
    const usedBoxesSorted = [...usedBoxes].sort((a, b) => {
      const freeA = getVolume(a.boxType) - a.items.reduce((sum, i) => sum + getVolume(i), 0);
      const freeB = getVolume(b.boxType) - b.items.reduce((sum, i) => sum + getVolume(i), 0);

      return freeA - freeB;
    });

    for (const usedBox of usedBoxesSorted) {
      const weightFit =
        currentBoxWeight(usedBox) + item.weight <= usedBox.boxType.maxWeight + EPS;

      if (!weightFit) {
        continue;
      }

      const placedItem = findBestPlacement(item, usedBox);

      if (placedItem) {
        usedBox.items.push({
          ...placedItem,
          packStep: globalPackStep
        });

        globalPackStep++;
        placed = true;
        break;
      }
    }

    if (placed) {
      return;
    }

    // Wenn keine vorhandene Box passt, neue möglichst kleine Box öffnen.
    const matchingBox = sortedBoxes.find((boxType) => {
      return canStartNewBox(item, boxType);
    });

    if (!matchingBox) {
      unpackedItems.push({
        ...item,
        failReason: "Passt in keine verfügbare Box oder überschreitet Gewicht."
      });
      return;
    }

    const newBox = createNewBoxWithItem(
      item,
      matchingBox,
      usedBoxes.length + 1
    );

    if (!newBox) {
      unpackedItems.push({
        ...item,
        failReason: "Keine stabile Position gefunden."
      });
      return;
    }

    newBox.items = newBox.items.map((placedItem) => {
      return {
        ...placedItem,
        packStep: globalPackStep
      };
    });

    globalPackStep++;

    usedBoxes.push(newBox);
  });

  const calculatedBoxes = usedBoxes.map(calculateBoxStats);

  return {
    usedBoxes: calculatedBoxes,
    unpackedItems
  };
}

// ============================================================
// LÖSUNG BEWERTEN
// ============================================================

function evaluateSolution(solution) {
  const boxCountPenalty = solution.usedBoxes.length * 100000;
  const unpackedPenalty = solution.unpackedItems.length * 1000000;

  const freeVolumePenalty = solution.usedBoxes.reduce((sum, usedBox) => {
    return sum + usedBox.freeVolumePercent * 100;
  }, 0);

  const heightPenalty = solution.usedBoxes.reduce((sum, usedBox) => {
    const maxHeight = usedBox.items.reduce((max, item) => {
      return Math.max(max, item.z + item.height);
    }, 0);

    return sum + maxHeight * 12;
  }, 0);

  const stabilityPenalty = solution.usedBoxes.reduce((sum, usedBox) => {
    let penalty = 0;

    usedBox.items.forEach((item) => {
      if (item.z <= EPS) {
        return;
      }

      const support = calculateSupport(item, usedBox.items.filter((i) => i !== item));

      if (!support.supported) {
        penalty += 50000;
      } else {
        penalty += (1 - support.supportRatio) * 1000;
      }
    });

    return sum + penalty;
  }, 0);

  return (
    unpackedPenalty +
    boxCountPenalty +
    freeVolumePenalty +
    heightPenalty +
    stabilityPenalty
  );
}

// ============================================================
// HAUPTFUNKTION FÜR DIE WEBSITE
// ============================================================

function runPackingAlgorithm(articles, boxes) {
  const items = expandArticles(articles);

  if (items.length === 0 || boxes.length === 0) {
    return {
      usedBoxes: [],
      unpackedItems: items
    };
  }

  const packingOrders = getPackingOrders(items);

  const solutions = packingOrders.map((order) => {
    return packWithOrder(order, boxes);
  });

  solutions.sort((a, b) => {
    return evaluateSolution(a) - evaluateSolution(b);
  });

  const bestSolution = solutions[0];

  // Packsteps innerhalb der gewählten Lösung sauber neu durchnummerieren.
  let step = 1;

  bestSolution.usedBoxes.forEach((usedBox) => {
    usedBox.items.sort((a, b) => {
      if (a.z !== b.z) return a.z - b.z;
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });

    usedBox.items = usedBox.items.map((item) => {
      return {
        ...item,
        packStep: step++
      };
    });
  });

  const recalculated = {
    usedBoxes: bestSolution.usedBoxes.map(calculateBoxStats),
    unpackedItems: bestSolution.unpackedItems
  };

  return recalculated;
}