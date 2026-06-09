"use client";

import * as d3 from "d3";
import { blockDrawingConstants, darkenColor, renderBlockImage } from "./block-drawing.js";
import {
  canAttachBlock,
  canInsertBlockIntoPlaceholder,
  canSelectBlockForm,
} from "@/lib/grammar/block-validation";
import {
  attachBlock,
  createEditorBlock,
  createEditorBlockInstance,
  findBlock,
  insertBlock,
  moveBlockToTopLevel,
  selectBlockForm,
  selectBlockFormInModel,
} from "@/lib/blocks/editor-model";

const defaultInitialZoom = 0.5;
const minZoomScale = 0.2;
const maxZoomScale = 0.8;
const sidebarPadding = { top: 64, bottom: 100, right: 80, left: 12 };
const sidebarSearchPadding = { top: 24, bottom: 24, horizontal: 24 };
const blockListSpacing = 20;
const sidebarMinWidth = 300;

export function renderEditorCanvas(svgElement, model, options = {}) {
  const svg = d3.select(svgElement);
  svg.selectAll("*").remove();

  const width = svgElement.clientWidth || window.innerWidth || 1440;
  const height = svgElement.clientHeight || window.innerHeight;
  const sidebarState = createSidebarState(model, options.sidebarDefinitions ?? [], height);

  svg
    .attr("viewBox", null)
    .attr("width", "100%")
    .attr("height", "100%")
    .style("touch-action", "none")
    .on("mousedown", () => {
      d3.selectAll(".dropdown-options").attr("display", "none");
    });

  svg.append("rect")
    .attr("id", "canvas-background")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "#f7f8fa");

  const grid = svg.append("g").attr("id", "grid");
  const sidebar = svg.append("g").attr("id", "sidebar");
  const dragboard = svg.append("g").attr("id", "dragboard");
  const dragState = {
    started: false,
    startX: 0,
    startY: 0,
    startBlockX: 0,
    startBlockY: 0,
    draggedBlockId: null,
    fromSidebar: false,
    sidebarPreviewId: null,
    sidebarState,
  };

  const zoom = d3.zoom()
    .scaleExtent([minZoomScale, maxZoomScale])
    .translateExtent([[-width * 4, -height * 4], [width * 4, height * 4]])
    .on("zoom", (event) => {
      grid.attr("transform", event.transform);
      dragboard.attr("transform", event.transform);
      setBlockBoardTransform(sidebarState, grid);
    })
    .filter((event) => !event.type.includes("dblclick"));

  svg.call(zoom).on("wheel", (event) => {
    event.preventDefault();
  }, { passive: false });

  const initialTransform = d3.zoomIdentity.translate(0, 0).scale(defaultInitialZoom);
  svg.call(zoom.transform, initialTransform);

  const renderAllBlocks = () => {
    grid.selectAll("*").remove();
    dragboard.selectAll("*").remove();
    model.blocks.forEach((block) => {
      renderBlock(block, grid, svg, grid, dragboard, dragState, model, renderAllBlocks);
    });
  };

  renderSidebar(sidebar, svg, grid, dragboard, dragState, model, renderAllBlocks, sidebarState);
  renderAllBlocks();

  const handleResize = () => {
    const nextWidth = svgElement.clientWidth || window.innerWidth || 1440;
    const nextHeight = svgElement.clientHeight || window.innerHeight;
    sidebarState.canvasHeight = nextHeight;
    sidebarState.cachedBlockListWidth = null;

    svg.select("#canvas-background")
      .attr("width", nextWidth)
      .attr("height", nextHeight);

    d3.select("#sidebar-background")
      .attr("height", window.innerHeight);

    setBlockBoardTransform(sidebarState, grid);
  };

  window.addEventListener("resize", handleResize);
  return () => {
    window.removeEventListener("resize", handleResize);
  };
}

function createSidebarState(model, definitions, canvasHeight) {
  const fullBlockList = { "": definitions };
  return {
    blockBoard: null,
    blockList: fullBlockList,
    cachedBlockListWidth: null,
    canvasHeight,
    contentContainer: null,
    fullBlockList,
    model,
    previousZoomExtent: null,
    scrollContainer: null,
    searchAreaHeight: 0,
    sidebarContent: null,
    sidebarSelection: null,
    svg: null,
    sideBarContentHeight: 0,
    sideBarScrollExtent: 0,
    variant: "sandbox",
  };
}

function renderSidebar(sidebar, svg, grid, dragboard, dragState, model, renderAllBlocks, sidebarState) {
  sidebar.selectAll("*").remove();
  sidebarState.cachedBlockListWidth = null;
  sidebarState.canvasHeight = svg.node()?.clientHeight || window.innerHeight;
  sidebarState.sidebarSelection = sidebar;
  sidebarState.svg = svg;

  const blockListWidth = calculateBlockListWidth(sidebarState, svg);
  const totalWidth = blockListWidth + getSidebarNavWidth(sidebarState);

  sidebar.append("rect")
    .attr("id", "sidebar-background")
    .attr("width", totalWidth)
    .attr("height", window.innerHeight)
    .attr("fill", "#fafafa")
    .attr("stroke", "#f0f0f0")
    .attr("stroke-width", 1)
    .on("mousedown", (event) => {
      event.stopPropagation();
    });

  sidebarState.contentContainer = sidebar.append("g")
    .attr("id", "sidebar-content-container")
    .attr("transform", `translate(${getSidebarNavWidth(sidebarState)}, 0)`);

  renderSideBarContent(sidebarState.contentContainer, svg, grid, dragboard, dragState, model, renderAllBlocks, sidebarState);
  enableSideBarScroll(sidebarState, grid);
}

function renderSideBarContent(parentGroup, svg, grid, dragboard, dragState, model, renderAllBlocks, sidebarState) {
  initializeSidebarContent(parentGroup, sidebarState);
  renderBlockList(svg, grid, dragboard, dragState, model, renderAllBlocks, sidebarState);
}

function initializeSidebarContent(parentGroup, sidebarState) {
  sidebarState.scrollContainer?.remove();

  sidebarState.scrollContainer = parentGroup.append("g")
    .attr("id", "sidebar-scroll-container")
    .attr("transform", `translate(0, ${sidebarState.searchAreaHeight})`);

  sidebarState.sidebarContent = sidebarState.scrollContainer.append("g");
  sidebarState.blockBoard = sidebarState.sidebarContent.append("g")
    .attr("transform", `translate(${sidebarSearchPadding.horizontal}, 0)`);
}

function renderBlockList(svg, grid, dragboard, dragState, model, renderAllBlocks, sidebarState) {
  if (!sidebarState.blockBoard) return;

  sidebarState.blockBoard.selectAll("*").remove();
  sidebarState.cachedBlockListWidth = calculateBlockListWidth(sidebarState, svg);

  let y = sidebarPadding.top;
  const entries = Object.entries(sidebarState.blockList || {});

  entries.forEach(([, definitions]) => {
    definitions.forEach((definition) => {
      y += blockListSpacing + renderSideBarBlock(
        definition,
        generateSidebarPreviewId(),
        y,
        svg,
        grid,
        dragboard,
        dragState,
        model,
        renderAllBlocks,
        sidebarState,
      );
    });

    y += sidebarPadding.bottom;
  });

  sidebarState.sideBarContentHeight = y;
  setBlockBoardTransform(sidebarState, grid);
}

function renderSideBarBlock(definition, id, y, svg, grid, dragboard, dragState, model, renderAllBlocks, sidebarState) {
  sidebarState.blockBoard
    .append("g")
    .attr("transform", `translate(0, ${y})`)
    .attr("id", id)
    .datum(definition);

  renderPreviewBlock(id, svg, grid, dragboard, dragState, model, renderAllBlocks);

  const measuringBlock = createEditorBlock(model.adapter, definition, {
    id: `measure-${definition.id}`,
  });
  return renderBlockMetrics(measuringBlock, svg).height;
}

function renderPreviewBlock(id, svg, grid, dragboard, dragState, model, renderAllBlocks) {
  const previewBlockGroup = d3.select(`#${cssEscape(id)}`);
  if (previewBlockGroup.empty()) return;

  const definition = previewBlockGroup.datum();
  previewBlockGroup.selectAll("*").remove();

  const realData = createEditorBlockInstance(model, definition, 0, 0);
  const blockGroup = previewBlockGroup.append("g")
    .attr("transform", "translate(0, 0)")
    .attr("id", realData.id)
    .classed("grab", true)
    .style("cursor", "grab")
    .datum(realData);

  blockGroup.call(d3.drag()
    .container(grid.node())
    .on("start", (event, d) => dragStart(event, d, svg, dragboard, dragState, true, id))
    .on("drag", (event, d) => dragging(event, d, dragState, model, renderAllBlocks))
    .on("end", (event, d) => dragEnd(event, d, grid, dragState, model, renderAllBlocks)));

  const renderPreviewImage = () => {
    renderBlockImage(realData, blockGroup, svg, {
      onDropdownSelect: (targetBlock, child, index) => {
        child.selected = index;
        selectBlockForm(targetBlock, index);
        renderPreviewImage();
        closeAllDropdowns();
      },
    });
  };

  renderPreviewImage();
}

function renderBlockMetrics(block, svg) {
  const temporary = svg.append("g").attr("visibility", "hidden");
  const result = renderBlockImage(block, temporary, svg, { onDropdownSelect: () => {} });
  temporary.remove();
  return result;
}

function calculateBlockListWidth(sidebarState, svg) {
  if (sidebarState.cachedBlockListWidth) {
    return sidebarState.cachedBlockListWidth;
  }

  let maxWidth = 0;
  Object.values(sidebarState.blockList || {}).forEach((definitions) => {
    definitions.forEach((definition) => {
      const block = createEditorBlock(sidebarState.model.adapter, definition, {
        id: `width-${definition.id}`,
      });
      maxWidth = Math.max(maxWidth, renderBlockMetrics(block, svg).width);
    });
  });

  const blockListWidth = maxWidth + sidebarSearchPadding.horizontal + sidebarPadding.right;
  sidebarState.cachedBlockListWidth = Math.max(blockListWidth, sidebarMinWidth);
  return sidebarState.cachedBlockListWidth;
}

function getSidebarNavWidth() {
  return 0;
}

function enableSideBarScroll(sidebarState, grid) {
  sidebarState.sidebarSelection?.node()?.addEventListener(
    "wheel",
    (event) => {
      event.stopPropagation();
      sidebarState.sideBarScrollExtent -= event.deltaY;
      setBlockBoardTransform(sidebarState, grid);
    },
    { passive: false, capture: true },
  );
}

function setBlockBoardTransform(sidebarState, grid) {
  if (!sidebarState.sidebarContent) return;

  const zoomExtent = getCurrentZoomExtent(grid);
  const scrollableHeight = Math.max(0, sidebarState.canvasHeight - (sidebarState.searchAreaHeight || 0));
  const contentHeight = (sidebarState.sideBarContentHeight || 0) * zoomExtent;

  if (sidebarState.previousZoomExtent) {
    const zoomRatio = zoomExtent / sidebarState.previousZoomExtent;
    sidebarState.sideBarScrollExtent *= zoomRatio;
  }

  const maxScroll = 0;
  const minScroll = Math.min(0, scrollableHeight - contentHeight);
  sidebarState.sideBarScrollExtent = Math.max(minScroll, Math.min(maxScroll, sidebarState.sideBarScrollExtent));

  sidebarState.sidebarContent
    ?.attr("transform", `translate(0, ${sidebarState.sideBarScrollExtent}) scale(${zoomExtent})`);

  const blockListWidth = sidebarState.cachedBlockListWidth || calculateBlockListWidth(sidebarState, sidebarState.svg);
  const newWidth = getSidebarNavWidth(sidebarState) + blockListWidth * zoomExtent;
  d3.select("#sidebar-background").attr("width", newWidth).attr("height", window.innerHeight);
  sidebarState.previousZoomExtent = zoomExtent;
}

function getCurrentZoomExtent(grid) {
  const transform = d3.zoomTransform(grid.node());
  return transform && typeof transform.k === "number" && Number.isFinite(transform.k)
    ? transform.k
    : 1;
}

function generateSidebarPreviewId() {
  return `b${crypto.randomUUID().replaceAll("-", "")}`;
}

function renderBlock(block, parent, svg, grid, dragboard, dragState, model, renderAllBlocks) {
  const blockGroup = parent.append("g")
    .attr("transform", `translate(${block.x}, ${block.y})`)
    .attr("id", block.id)
    .classed("grab", true)
    .datum(block);

  decorateBlockGroup(block, blockGroup, svg, grid, dragboard, dragState, model, renderAllBlocks);

  renderBlockImage(block, blockGroup, svg, {
    decorateBlockGroup: (nestedBlock, nestedGroup) => {
      decorateBlockGroup(nestedBlock, nestedGroup, svg, grid, dragboard, dragState, model, renderAllBlocks);
    },
    onDropdownSelect: (targetBlock, child, index) => {
      handleDropdownSelect(targetBlock, child, index, model, renderAllBlocks);
    },
  });
}

function decorateBlockGroup(block, blockGroup, svg, grid, dragboard, dragState, model, renderAllBlocks) {
  blockGroup
    .classed("grab", true)
    .style("cursor", "grab")
    .datum(block)
    .call(d3.drag()
    .container(grid.node())
    .on("start", (event, d) => dragStart(event, d, svg, dragboard, dragState))
    .on("drag", (event, d) => dragging(event, d, dragState, model, renderAllBlocks))
    .on("end", (event, d) => dragEnd(event, d, grid, dragState, model, renderAllBlocks)));
}

function dragStart(event, d, svg, dragboard, dragState, fromSidebar = false, sidebarPreviewId = null) {
  event.sourceEvent?.stopPropagation();
  grabbingCursor(d.id, true);
  dragState.started = false;
  dragState.draggedBlockId = d.id;
  dragState.fromSidebar = fromSidebar;
  dragState.sidebarPreviewId = sidebarPreviewId;
  svg.node().appendChild(dragboard.node());
  closeAllDropdowns();
}

function dragging(event, d, dragState, model, renderAllBlocks) {
  if (!dragState.started) {
    let sideBarId = null;

    if (dragState.fromSidebar) {
      model.blocks.push(d);
      placeSidebarBlockOnGrid(d);
      sideBarId = dragState.sidebarPreviewId;
    } else {
      const wasNested = Boolean(findBlock(model, d.id).parentBlock);
      moveBlockToTopLevel(model, d.id);
      if (wasNested) {
        renderAllBlocks();
      }
    }

    moveBlockToDragboard(d.id);

    if (dragState.fromSidebar && sideBarId) {
      renderPreviewBlock(
        sideBarId,
        dragState.sidebarState.svg,
        d3.select("#grid"),
        d3.select("#dragboard"),
        dragState,
        model,
        renderAllBlocks,
      );
    }

    grabbingCursor(d.id, true);
    dragState.startX = event.x;
    dragState.startY = event.y;
    dragState.startBlockX = d.x;
    dragState.startBlockY = d.y;
    d3.select(`#${cssEscape(d.id)}`).attr("transform", `translate(${d.x}, ${d.y})`);
    dragState.started = true;
  } else {
    const dx = event.x - dragState.startX;
    const dy = event.y - dragState.startY;
    d.x = dragState.startBlockX + dx;
    d.y = dragState.startBlockY + dy;
    d3.select(`#${cssEscape(d.id)}`).attr("transform", `translate(${d.x}, ${d.y})`);
    detectOverlapAndHighlight(d, event, model);
  }
}

function dragEnd(event, d, grid, dragState, model, renderAllBlocks) {
  event.sourceEvent?.stopPropagation();
  grabbingCursor(d.id, false);
  if (!dragState.started) {
    dragState.draggedBlockId = null;
    dragState.fromSidebar = false;
    dragState.sidebarPreviewId = null;
    return;
  }
  dragState.started = false;
  dragState.draggedBlockId = null;
  dragState.fromSidebar = false;
  dragState.sidebarPreviewId = null;

  const placeholderInfo = detectPlaceholderOverlap(d, event, model);
  const overlapInfo = placeholderInfo ? null : detectBlockOverlap(d, model);
  const committed = placeholderInfo?.isValid
    ? insertBlock(model, d.id, placeholderInfo.parentId, placeholderInfo.childIndex)
    : overlapInfo
      ? attachBlock(model, d.id, overlapInfo.blockId, overlapInfo.side)
      : false;

  deemphasizeAllPlaceholder();
  deemphasizeAllBlock();

  if (committed) {
    renderAllBlocks();
  } else {
    moveBlockToGrid(d.id, grid);
    d3.select(`#${cssEscape(d.id)}`).attr("transform", `translate(${d.x}, ${d.y})`);
    renderAllBlocks();
  }
}

function moveBlockToDragboard(id) {
  const blockUI = d3.select(`#${cssEscape(id)}`).node();
  const dragboard = d3.select("#dragboard").node();
  if (!blockUI || !dragboard) return;
  dragboard.appendChild(blockUI);
}

function moveBlockToGrid(id, grid) {
  const blockUI = d3.select(`#${cssEscape(id)}`).node();
  if (!blockUI) return;
  grid.node().appendChild(blockUI);
}

function placeSidebarBlockOnGrid(block) {
  const blockUI = d3.select(`#${cssEscape(block.id)}`).node();
  const gridNode = d3.select("#grid").node();
  if (!blockUI || !gridNode) return;

  const blockRect = blockUI.getBoundingClientRect();
  const transform = d3.zoomTransform(gridNode);
  block.x = (blockRect.left - transform.x) / transform.k;
  block.y = (blockRect.top - transform.y) / transform.k;
}

function grabbingCursor(blockId, isDragging) {
  d3.select(`#${cssEscape(blockId)}`)
    .raise()
    .classed("grab", !isDragging)
    .classed("grabbing", isDragging)
    .style("cursor", isDragging ? "grabbing" : "grab");
}

function handleDropdownSelect(block, child, index, model, renderAllBlocks) {
  const prevSelected = child.selected ?? 0;
  const isValid = canSelectBlockForm(model, block, index);
  if (!isValid || !selectBlockFormInModel(model, block.id, index)) {
    child.selected = prevSelected;
  }
  closeAllDropdowns();
  renderAllBlocks();
}

function detectOverlapAndHighlight(blockData, event, model) {
  const placeholderInfo = detectPlaceholderOverlap(blockData, event, model);
  const overlapInfo = placeholderInfo ? null : detectBlockOverlap(blockData, model);

  if (placeholderInfo?.isValid) {
    deemphasizeAllBlock();
    emphasizePlaceholder(placeholderInfo.id);
  } else if (placeholderInfo) {
    deemphasizeAllBlock();
    emphasizePlaceholder(placeholderInfo.id, true);
  } else if (overlapInfo) {
    deemphasizeAllPlaceholder();
    emphasizeBlock(overlapInfo.id);
  } else {
    deemphasizeAllPlaceholder();
    deemphasizeAllBlock();
  }
}

function detectPlaceholderOverlap(blockData, event, model) {
  const draggedBlockRect = d3.select(`#${cssEscape(`frame-${blockData.id}`)}`);
  if (draggedBlockRect.empty()) return null;

  const mouseX = event.sourceEvent?.clientX ?? event.x;
  const mouseY = event.sourceEvent?.clientY ?? event.y;
  let bestScore = Infinity;
  let bestPlaceholder = null;

  d3.selectAll("rect")
    .filter(function () {
      const id = d3.select(this).attr("id");
      return id && id.startsWith("placeholder-");
    })
    .filter(function () {
      return !this.closest("#sidebar");
    })
    .filter(function () {
      const excludedParent = d3.select(`#${cssEscape(blockData.id)}`).node();
      return !excludedParent || !excludedParent.contains(this);
    })
    .nodes()
    .reverse()
    .forEach((node) => {
      const placeholder = d3.select(node);
      const overlapArea = calculateOverlapArea(placeholder, draggedBlockRect);
      if (overlapArea === 0) return;

      const distance = calculateCursorDistance(placeholder, mouseX, mouseY);
      const score = distance / (overlapArea + 1);
      if (score < bestScore) {
        bestScore = score;
        bestPlaceholder = placeholder;
      }
    });

  if (!bestPlaceholder) return null;

  const childIndex = Number(bestPlaceholder.attr("data-child-index"));
  const parentId = bestPlaceholder.attr("data-parent-id");
  const targetParent = findBlock(model, parentId).foundBlock;
  const draggedBlock = findBlock(model, blockData.id).foundBlock ?? blockData;
  const isValid = targetParent
    ? canInsertBlockIntoPlaceholder(model, draggedBlock, targetParent, childIndex)
    : false;

  return {
    id: bestPlaceholder.attr("id"),
    parentId,
    childIndex,
    isValid,
  };
}

function detectBlockOverlap(blockData, model) {
  const draggedBlockRect = d3.select(`#${cssEscape(`frame-${blockData.id}`)}`);
  if (draggedBlockRect.empty()) return null;

  const descendantFrameIds = collectDescendantFrameIds(blockData);
  let bestOverlapArea = 0;
  let bestOverlapBlock = null;

  d3.selectAll("rect")
    .filter(function () {
      const id = d3.select(this).attr("id");
      return id &&
        id.startsWith("frame-") &&
        id !== `frame-${blockData.id}` &&
        !descendantFrameIds.has(id);
    })
    .filter(function () {
      return !this.closest("#sidebar");
    })
    .nodes()
    .forEach((node) => {
      const otherBlockRect = d3.select(node);
      const overlapArea = calculateOverlapArea(otherBlockRect, draggedBlockRect);
      if (overlapArea <= bestOverlapArea) return;

      const otherBounds = otherBlockRect.node().getBoundingClientRect();
      const draggedBounds = draggedBlockRect.node().getBoundingClientRect();
      const otherCenterX = otherBounds.left + otherBounds.width / 2;
      const draggedCenterX = draggedBounds.left + draggedBounds.width / 2;

      const blockId = otherBlockRect.attr("id").replace(/^frame-/, "");
      const targetParent = findBlock(model, blockId).foundBlock;
      const draggedBlock = findBlock(model, blockData.id).foundBlock ?? blockData;
      const side = draggedCenterX >= otherCenterX ? "right" : "left";
      if (!targetParent || !canAttachBlock(model, draggedBlock, targetParent, side)) return;

      bestOverlapArea = overlapArea;
      bestOverlapBlock = {
        id: otherBlockRect.attr("id"),
        blockId,
        side,
      };
    });

  return bestOverlapBlock;
}

function collectDescendantFrameIds(block) {
  const ids = new Set();

  block.children?.forEach((child) => {
    if ((child.type === "placeholder" || child.type === "attachment") && child.content) {
      ids.add(`frame-${child.content.id}`);
      collectDescendantFrameIds(child.content).forEach((id) => ids.add(id));
    }
  });

  return ids;
}

function calculateOverlapArea(rect1, rect2) {
  const rect1Bounds = rect1.node().getBoundingClientRect();
  const rect2Bounds = rect2.node().getBoundingClientRect();
  const xOverlap = Math.max(
    0,
    Math.min(rect1Bounds.right, rect2Bounds.right) - Math.max(rect1Bounds.left, rect2Bounds.left),
  );
  const yOverlap = Math.max(
    0,
    Math.min(rect1Bounds.bottom, rect2Bounds.bottom) - Math.max(rect1Bounds.top, rect2Bounds.top),
  );
  return xOverlap * yOverlap;
}

function calculateCursorDistance(rect, mouseX, mouseY) {
  const rectBounds = rect.node().getBoundingClientRect();
  if (
    mouseX >= rectBounds.left &&
    mouseX <= rectBounds.right &&
    mouseY >= rectBounds.top &&
    mouseY <= rectBounds.bottom
  ) {
    return 0;
  }

  const rectCenterX = rectBounds.left + rectBounds.width / 2;
  const rectCenterY = rectBounds.top + rectBounds.height / 2;
  return Math.sqrt((mouseX - rectCenterX) ** 2 + (mouseY - rectCenterY) ** 2);
}

function emphasizePlaceholder(id, isError = false) {
  deemphasizeAllPlaceholder();
  d3.select(`#${cssEscape(id)}`)
    .attr("stroke-width", 6)
    .attr("stroke", isError ? "red" : "yellow");
}

function deemphasizeAllPlaceholder() {
  d3.selectAll("rect")
    .filter(function () {
      const id = d3.select(this).attr("id");
      return id && id.startsWith("placeholder-");
    })
    .attr("stroke", "none")
    .attr("stroke-width", 0);
}

function emphasizeBlock(id) {
  deemphasizeAllBlock();
  d3.select(`#${cssEscape(id)}`)
    .attr("stroke-width", 6)
    .attr("stroke", "yellow");
}

function deemphasizeAllBlock() {
  d3.selectAll("rect")
    .filter(function () {
      const id = d3.select(this).attr("id");
      return id && id.startsWith("frame-") && !d3.select(this.parentNode).classed("grabbing");
    })
    .each(function () {
      const fillColor = blockDrawingConstants.blockFillColor;
      d3.select(this)
        .attr("stroke", darkenColor(fillColor, 30))
        .attr("stroke-width", blockDrawingConstants.blockStrokeWidth);
    });
}

function closeAllDropdowns() {
  d3.selectAll(".dropdown-options").attr("display", "none");
}

function cssEscape(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}
