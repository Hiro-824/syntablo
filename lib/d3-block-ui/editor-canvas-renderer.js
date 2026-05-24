"use client";

import * as d3 from "d3";
import { blockDrawingConstants, darkenColor, renderBlockImage } from "./block-drawing.js";
import {
  attachBlock,
  findBlock,
  insertBlock,
  moveBlockToTopLevel,
  selectBlockForm,
} from "@/lib/blocks/editor-model";

const defaultInitialZoom = 0.5;
const minZoomScale = 0.2;
const maxZoomScale = 0.8;

export function renderEditorCanvas(svgElement, model) {
  const svg = d3.select(svgElement);
  svg.selectAll("*").remove();

  const width = 1440;
  const height = svgElement.clientHeight || window.innerHeight;

  svg
    .attr("viewBox", `0 0 ${width} ${height}`)
    .style("touch-action", "none")
    .on("mousedown", () => {
      d3.selectAll(".dropdown-options").attr("display", "none");
    });

  svg.append("rect")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "#f7f8fa");

  const grid = svg.append("g").attr("id", "grid");
  const dragboard = svg.append("g").attr("id", "dragboard");
  const dragState = {
    started: false,
    startX: 0,
    startY: 0,
    startBlockX: 0,
    startBlockY: 0,
    draggedBlockId: null,
  };

  const zoom = d3.zoom()
    .scaleExtent([minZoomScale, maxZoomScale])
    .translateExtent([[-width * 4, -height * 4], [width * 4, height * 4]])
    .on("zoom", (event) => {
      grid.attr("transform", event.transform);
      dragboard.attr("transform", event.transform);
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

  renderAllBlocks();
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
      handleDropdownSelect(targetBlock, child, index, renderAllBlocks);
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

function dragStart(event, d, svg, dragboard, dragState) {
  event.sourceEvent?.stopPropagation();
  grabbingCursor(d.id, true);
  dragState.started = false;
  dragState.draggedBlockId = d.id;
  svg.node().appendChild(dragboard.node());
  closeAllDropdowns();
}

function dragging(event, d, dragState, model, renderAllBlocks) {
  if (!dragState.started) {
    const wasNested = Boolean(findBlock(model, d.id).parentBlock);
    moveBlockToTopLevel(model, d.id);
    if (wasNested) {
      renderAllBlocks();
    }
    moveBlockToDragboard(d.id);
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
    detectOverlapAndHighlight(d, event);
  }
}

function dragEnd(event, d, grid, dragState, model, renderAllBlocks) {
  event.sourceEvent?.stopPropagation();
  grabbingCursor(d.id, false);
  if (!dragState.started) return;
  dragState.started = false;
  dragState.draggedBlockId = null;

  const placeholderInfo = detectPlaceholderOverlap(d, event);
  const overlapInfo = placeholderInfo ? null : detectBlockOverlap(d);
  const committed = placeholderInfo
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

function grabbingCursor(blockId, isDragging) {
  d3.select(`#${cssEscape(blockId)}`)
    .raise()
    .classed("grab", !isDragging)
    .classed("grabbing", isDragging)
    .style("cursor", isDragging ? "grabbing" : "grab");
}

function handleDropdownSelect(block, child, index, renderAllBlocks) {
  child.selected = index;
  selectBlockForm(block, index);
  closeAllDropdowns();
  renderAllBlocks();
}

function detectOverlapAndHighlight(blockData, event) {
  const placeholderInfo = detectPlaceholderOverlap(blockData, event);
  const overlapInfo = placeholderInfo ? null : detectBlockOverlap(blockData);

  if (placeholderInfo) {
    deemphasizeAllBlock();
    emphasizePlaceholder(placeholderInfo.id);
  } else if (overlapInfo) {
    deemphasizeAllPlaceholder();
    emphasizeBlock(overlapInfo.id);
  } else {
    deemphasizeAllPlaceholder();
    deemphasizeAllBlock();
  }
}

function detectPlaceholderOverlap(blockData, event) {
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
  return {
    id: bestPlaceholder.attr("id"),
    parentId: bestPlaceholder.attr("data-parent-id"),
    childIndex,
    isValid: true,
  };
}

function detectBlockOverlap(blockData) {
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
    .nodes()
    .forEach((node) => {
      const otherBlockRect = d3.select(node);
      const overlapArea = calculateOverlapArea(otherBlockRect, draggedBlockRect);
      if (overlapArea <= bestOverlapArea) return;

      const otherBounds = otherBlockRect.node().getBoundingClientRect();
      const draggedBounds = draggedBlockRect.node().getBoundingClientRect();
      const otherCenterX = otherBounds.left + otherBounds.width / 2;
      const draggedCenterX = draggedBounds.left + draggedBounds.width / 2;

      bestOverlapArea = overlapArea;
      bestOverlapBlock = {
        id: otherBlockRect.attr("id"),
        blockId: otherBlockRect.attr("id").replace(/^frame-/, ""),
        side: draggedCenterX >= otherCenterX ? "right" : "left",
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

function emphasizePlaceholder(id) {
  deemphasizeAllPlaceholder();
  d3.select(`#${cssEscape(id)}`)
    .attr("stroke-width", 6)
    .attr("stroke", "yellow");
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
