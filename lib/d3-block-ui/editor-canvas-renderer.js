"use client";

import * as d3 from "d3";
import { renderBlockImage } from "./block-drawing.js";

const defaultInitialZoom = 0.5;
const minZoomScale = 0.2;
const maxZoomScale = 0.8;

export function renderEditorCanvas(svgElement, blockViews) {
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

  blockViews.forEach((view, index) => {
    const block = createRenderableBlock(view, index);
    renderBlock(block, grid, svg, grid, dragboard, dragState);
  });
}

function createRenderableBlock(view, index) {
  const selectedFormIndex = view.selectedFormIndex ?? 0;
  const selectedForm = view.forms[selectedFormIndex] ?? view.forms[0];
  const children = [];

  for (const slot of selectedForm.slots.filter((item) => item.side === "left")) {
    children.push({
      id: slot.id,
      type: "placeholder",
      slotKind: slot.kind,
      content: null,
    });
  }

  const formOptions = view.forms.map((form) => form.label);
  if (view.hasDropdown) {
    children.push({
      id: "head",
      type: "dropdown",
      content: formOptions,
      selected: selectedFormIndex,
    });
  } else {
    children.push({
      id: "head",
      type: "text",
      content: selectedForm.label,
    });
  }

  for (const slot of selectedForm.slots.filter((item) => item.side === "right")) {
    children.push({
      id: slot.id,
      type: "placeholder",
      slotKind: slot.kind,
      content: null,
    });
  }

  return {
    id: view.id,
    x: view.x,
    y: view.y,
    isRound: false,
    selectedFormIndex,
    forms: view.forms,
    headType: selectedForm.headType,
    verbForm: selectedForm.verbForm,
    children,
  };
}

function renderBlock(block, parent, svg, grid, dragboard, dragState) {
  const blockGroup = parent.append("g")
    .attr("transform", `translate(${block.x}, ${block.y})`)
    .attr("id", block.id)
    .classed("grab", true)
    .datum(block);

  blockGroup.call(d3.drag()
    .container(grid.node())
    .on("start", (event, d) => dragStart(event, d, svg, dragboard, dragState))
    .on("drag", (event, d) => dragging(event, d, dragState))
    .on("end", (event, d) => dragEnd(event, d, grid, dragState)));

  renderBlockImage(block, blockGroup, svg, {
    onDropdownSelect: (targetBlock, child, index) => {
      handleDropdownSelect(targetBlock, child, index, svg);
    },
  });
}

function dragStart(event, d, svg, dragboard, dragState) {
  event.sourceEvent?.stopPropagation();
  grabbingCursor(d.id, true);
  dragState.started = false;
  svg.node().appendChild(dragboard.node());
}

function dragging(event, d, dragState) {
  if (!dragState.started) {
    moveBlockToDragboard(d.id);
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
  }
}

function dragEnd(event, d, grid, dragState) {
  event.sourceEvent?.stopPropagation();
  grabbingCursor(d.id, false);
  if (!dragState.started) return;
  dragState.started = false;
  moveBlockToGrid(d.id, grid);
  d3.select(`#${cssEscape(d.id)}`).attr("transform", `translate(${d.x}, ${d.y})`);
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

function handleDropdownSelect(block, child, index, svg) {
  child.selected = index;
  block.selectedFormIndex = index;
  applySelectedForm(block);
  d3.selectAll(".dropdown-options").attr("display", "none");
  const currentBlockGroup = d3.select(`#${cssEscape(block.id)}`);
  renderBlockImage(block, currentBlockGroup, svg, {
    onDropdownSelect: (nextBlock, nextChild, nextIndex) => {
      handleDropdownSelect(nextBlock, nextChild, nextIndex, svg);
    },
  });
}

function applySelectedForm(block) {
  const selectedForm = block.forms?.[block.selectedFormIndex];
  if (!selectedForm) return;

  const nextChildren = [];
  for (const slot of selectedForm.slots.filter((item) => item.side === "left")) {
    nextChildren.push({
      id: slot.id,
      type: "placeholder",
      slotKind: slot.kind,
      content: null,
    });
  }

  const dropdown = block.children.find((child) => child.type === "dropdown");
  if (dropdown) {
    nextChildren.push({
      ...dropdown,
      selected: block.selectedFormIndex,
    });
  } else {
    nextChildren.push({
      id: "head",
      type: "text",
      content: selectedForm.label,
    });
  }

  for (const slot of selectedForm.slots.filter((item) => item.side === "right")) {
    nextChildren.push({
      id: slot.id,
      type: "placeholder",
      slotKind: slot.kind,
      content: null,
    });
  }

  block.children = nextChildren;
  block.headType = selectedForm.headType;
  block.verbForm = selectedForm.verbForm;
}

function cssEscape(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}
