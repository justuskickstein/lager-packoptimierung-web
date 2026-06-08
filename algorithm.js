function getVolume(item) {
  return item.length * item.width * item.height;
}

function getOrientations(item) {
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
        u.length === orientation.length &&
        u.width === orientation.width &&
        u.height === orientation.height
      );
    });

    if (!exists) {
      unique.push(orientation);
    }
  });

  return unique;
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

function boxesOverlap(a, b) {
  const overlapX = a.x < b.x + b.length && a.x + a.length > b.x;
  const overlapY = a.y < b.y + b.width && a.y + a.width > b.y;
  const overlapZ = a.z < b.z + b.height && a.z + a.height > b.z;

  return overlapX && overlapY && overlapZ;
}

function isInsideBox(positionedItem, boxType) {
  return (
    positionedItem.x >= 0 &&
    positionedItem.y >= 0 &&
    positionedItem.z >= 0 &&
    positionedItem.x + positionedItem.length <= boxType.length &&
    positionedItem.y + positionedItem.width <= boxType.width &&
    positionedItem.z + positionedItem.height <= boxType.height
  );
}

function canPlaceAt(positionedItem, placedItems, boxType) {
  if (!isInsideBox(positionedItem, boxType)) {
    return false;
  }

  return !placedItems.some((placedItem) => {
    return boxesOverlap(positionedItem, placedItem);
  });
}

function createCandidatePositions(placedItems) {
  const positions = [
    { x: 0, y: 0, z: 0 }
  ];

  placedItems.forEach((item) => {
    positions.push({ x: item.x + item.length, y: item.y, z: item.z });
    positions.push({ x: item.x, y: item.y + item.width, z: item.z });
    positions.push({ x: item.x, y: item.y, z: item.z + item.height });
  });

  const unique = [];

  positions.forEach((pos) => {
    const exists = unique.some((u) => {
      return u.x === pos.x && u.y === pos.y && u.z === pos.z;
    });

    if (!exists) {
      unique.push(pos);
    }
  });

  unique.sort((a, b) => {
    if (a.z !== b.z) return a.z - b.z;
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });

  return unique;
}

function findPlacement(item, usedBox) {
  const orientations = getOrientations(item);
  const candidatePositions = createCandidatePositions(usedBox.items);

  for (const pos of candidatePositions) {
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

      if (canPlaceAt(positionedItem, usedBox.items, usedBox.boxType)) {
        return positionedItem;
      }
    }
  }

  return null;
}

function canStartNewBox(item, boxType) {
  const orientations = getOrientations(item);

  return orientations.some((orientation) => {
    return (
      orientation.length <= boxType.length &&
      orientation.width <= boxType.width &&
      orientation.height <= boxType.height &&
      item.weight <= boxType.maxWeight
    );
  });
}

function createNewBoxWithItem(item, boxType, boxId) {
  const emptyBox = {
    boxId,
    boxType,
    items: []
  };

  const placedItem = findPlacement(item, emptyBox);

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

function runPackingAlgorithm(articles, boxes) {
  const items = expandArticles(articles);

  const sortedItems = [...items].sort((a, b) => {
    return getVolume(b) - getVolume(a);
  });

  const sortedBoxes = [...boxes].sort((a, b) => {
    return getVolume(a) - getVolume(b);
  });

  const usedBoxes = [];
  const unpackedItems = [];
  let globalPackStep = 1;

  sortedItems.forEach((item) => {
    let placed = false;

    for (const usedBox of usedBoxes) {
      const currentWeight = usedBox.items.reduce((sum, placedItem) => {
        return sum + placedItem.weight;
      }, 0);

      const weightFit = currentWeight + item.weight <= usedBox.boxType.maxWeight;

      if (!weightFit) {
        continue;
      }

      const placedItem = findPlacement(item, usedBox);

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

    const matchingBox = sortedBoxes.find((boxType) => {
      return canStartNewBox(item, boxType);
    });

    if (!matchingBox) {
      unpackedItems.push(item);
      return;
    }

    const newBox = createNewBoxWithItem(
      item,
      matchingBox,
      usedBoxes.length + 1
    );

    if (!newBox) {
      unpackedItems.push(item);
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