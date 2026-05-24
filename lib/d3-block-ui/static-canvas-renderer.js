"use client";

import * as d3 from "d3";

const padding = 3;
const horizontalPadding = 12;
const verticalPadding = 12;
const blockCornerRadius = 10;
const blockStrokeWidth = 2;
const placeholderWidth = 100;
const placeholderHeight = 72;
const placeholderCornerRadius = 36;
const labelFontSize = 32;
const dropdownHeight = 60;
const blockFillColor = "#d4d4d4";
const blockTextColor = "#3f3f3f";
const defaultInitialZoom = 0.5;
const minZoomScale = 0.2;
const maxZoomScale = 0.8;

export function renderStaticBlockCanvas(svgElement, blockViews) {
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
  const children = [];

  for (const slot of view.slots.filter((item) => item.side === "left")) {
    children.push({
      id: slot.id,
      type: "placeholder",
      slotKind: slot.kind,
      content: null,
    });
  }

  const formOptions = Array.from(new Set(view.formLabels));
  if (view.hasDropdown) {
    const selected = Math.max(0, formOptions.indexOf(view.selectedLabel));
    children.push({
      id: "head",
      type: "dropdown",
      content: formOptions,
      selected,
    });
  } else {
    children.push({
      id: "head",
      type: "text",
      content: view.selectedLabel,
    });
  }

  for (const slot of view.slots.filter((item) => item.side === "right")) {
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
    headType: view.headType,
    verbForm: view.verbForm,
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

  renderBlockImage(block, blockGroup, svg);
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

function renderBlockImage(block, blockGroup, svg) {
  const width = calculateWidth(block, svg);
  const height = calculateHeight(block, svg);
  const fillColor = getBlockFillColor(block);
  const strokeColor = darkenColor(fillColor, 30);
  const actualCornerRadius = block.isRound ? height / 2 : blockCornerRadius;

  blockGroup.append("rect")
    .attr("id", `frame-${block.id}`)
    .attr("width", width)
    .attr("height", height)
    .attr("fill", fillColor)
    .attr("rx", actualCornerRadius)
    .attr("ry", actualCornerRadius)
    .attr("stroke", strokeColor)
    .attr("stroke-width", blockStrokeWidth);

  let x = horizontalPadding + (block.isRound ? horizontalPadding : 0);
  for (let index = 0; index < block.children.length; index += 1) {
    const child = block.children[index];
    if (child.type === "placeholder") {
      x += renderPlaceholder(child, height, block, blockGroup, x);
    } else if (child.type === "text") {
      x += renderText(child, height, block, blockGroup, svg, x);
    } else if (child.type === "dropdown") {
      x += renderDropdown(child, height, block, blockGroup, svg, x, index);
    }
  }
}

function renderPlaceholder(child, height, block, blockGroup, x) {
  const y = (height - placeholderHeight) / 2;
  const inputColor = darkenColor(getBlockFillColor(block), 30);
  blockGroup.append("rect")
    .attr("id", `placeholder-${child.id}-${block.id}`)
    .attr("x", x)
    .attr("y", y)
    .attr("width", placeholderWidth)
    .attr("height", placeholderHeight)
    .attr("rx", placeholderCornerRadius)
    .attr("ry", placeholderCornerRadius)
    .attr("fill", inputColor);

  return placeholderWidth + horizontalPadding;
}

function renderText(child, height, block, blockGroup, svg, x) {
  const box = calculateTextHeightAndWidth(svg, child.content);
  const y = ((height - box.height) / 2) + box.height;

  blockGroup.append("text")
    .text(child.content)
    .attr("x", x)
    .attr("y", y)
    .attr("fill", getBlockTextColor(block))
    .attr("font-size", `${labelFontSize}pt`)
    .attr("font-weight", "bold")
    .attr("dy", "-0.24em")
    .style("user-select", "none");

  return box.width + horizontalPadding;
}

function renderDropdown(child, height, block, blockGroup, svg, x, count) {
  const selected = child.selected ?? 0;
  const text = child.content[selected];
  const box = calculateTextHeightAndWidth(svg, text);
  const dropdownWidth = calculateDropdownWidth(svg, child);
  const inputColor = darkenColor(getBlockFillColor(block), 30);
  const y = (height - dropdownHeight) / 2;

  const dropdownGroup = blockGroup.append("g").classed("pointer", true);
  dropdownGroup.append("rect")
    .attr("id", `dropdown-${count}-${block.id}`)
    .attr("x", x)
    .attr("y", y)
    .attr("width", dropdownWidth)
    .attr("height", dropdownHeight)
    .attr("rx", blockCornerRadius)
    .attr("ry", blockCornerRadius)
    .attr("fill", inputColor);

  const textX = x + horizontalPadding;
  const textY = ((height - box.height) / 2) + box.height;
  dropdownGroup.append("text")
    .text(text)
    .attr("x", textX)
    .attr("y", textY)
    .attr("fill", getBlockTextColor(block))
    .attr("font-size", `${labelFontSize}pt`)
    .attr("font-weight", "bold")
    .attr("dy", "-0.24em")
    .style("user-select", "none");

  dropdownGroup.append("text")
    .text("▼")
    .attr("x", textX + box.width + horizontalPadding)
    .attr("y", textY - 10)
    .attr("fill", getBlockTextColor(block))
    .attr("font-size", "10pt")
    .attr("font-weight", "bold")
    .attr("dy", "-0.24em")
    .style("user-select", "none");

  const optionHeight = dropdownHeight;
  const optionsWidth = Math.max(
    ...child.content.map((option) => calculateTextHeightAndWidth(svg, option).width),
  ) + horizontalPadding * 2;

  const optionsGroup = dropdownGroup.append("g")
    .attr("display", "none")
    .classed("dropdown-options", true);

  optionsGroup.append("rect")
    .attr("x", x)
    .attr("y", y + dropdownHeight + padding)
    .attr("width", optionsWidth)
    .attr("height", optionHeight * child.content.length + blockCornerRadius * 2)
    .attr("fill", getBlockFillColor(block))
    .attr("rx", blockCornerRadius)
    .attr("ry", blockCornerRadius)
    .attr("stroke", inputColor)
    .attr("stroke-width", 2);

  child.content.forEach((option, index) => {
    const optionBox = calculateTextHeightAndWidth(svg, option);
    const optionY = y + dropdownHeight + padding + blockCornerRadius + optionHeight * index;
    const optionGroup = optionsGroup.append("g");

    optionGroup.append("rect")
      .attr("x", x)
      .attr("y", optionY)
      .attr("width", optionsWidth)
      .attr("height", optionHeight)
      .attr("fill", getBlockTextColor(block))
      .attr("opacity", 0);

    optionGroup.append("text")
      .text(option)
      .attr("x", x + horizontalPadding)
      .attr("y", optionY + optionHeight * 0.5 + optionBox.height * 0.5)
      .attr("fill", getBlockTextColor(block))
      .attr("font-size", `${labelFontSize}pt`)
      .attr("font-weight", index === selected ? "bold" : "normal")
      .attr("dy", "-0.15em")
      .style("user-select", "none");
  });

  dropdownGroup.on("click", (event) => {
    event.stopPropagation();
    const currentDisplay = optionsGroup.attr("display");
    d3.selectAll(".dropdown-options").attr("display", "none");
    optionsGroup.attr("display", currentDisplay === "none" ? "block" : "none");
    dropdownGroup.raise();
  });

  return dropdownWidth + horizontalPadding;
}

function calculateTextHeightAndWidth(svg, content) {
  const testText = svg.append("text")
    .text(content)
    .attr("fill", "white")
    .attr("font-size", `${labelFontSize}pt`)
    .attr("font-weight", "bold");
  const box = testText.node().getBBox();
  testText.remove();
  return box;
}

function calculateDropdownWidth(svg, dropdown) {
  const selected = dropdown.selected ?? 0;
  const text = dropdown.content[selected];
  const box = calculateTextHeightAndWidth(svg, text);
  return horizontalPadding * 4 + box.width;
}

function calculateWidth(block, svg) {
  const children = block.children.filter((child) => !child.hidden);
  const paddingNumber = children.length + 1;
  let width = 0;

  if (block.isRound) {
    width += horizontalPadding * 2;
  }

  children.forEach((child) => {
    if (child.type === "placeholder") {
      width += placeholderWidth;
    } else if (child.type === "text") {
      width += calculateTextHeightAndWidth(svg, child.content).width;
    } else if (child.type === "dropdown") {
      width += calculateDropdownWidth(svg, child);
    }
  });

  width += horizontalPadding * paddingNumber;
  return width;
}

function calculateHeight(block) {
  const heights = [placeholderHeight];
  block.children.forEach((child) => {
    if (child.type === "placeholder") {
      heights.push(placeholderHeight);
    } else if (child.type === "dropdown") {
      heights.push(dropdownHeight);
    }
  });

  return verticalPadding * 2 + Math.max(...heights);
}

function getBlockFillColor(block) {
  return blockFillColor;
}

function getBlockTextColor() {
  return blockTextColor;
}

function darkenColor(color, factor) {
  const rgb = d3.rgb(color);
  rgb.r = Math.max(0, rgb.r - factor);
  rgb.g = Math.max(0, rgb.g - factor);
  rgb.b = Math.max(0, rgb.b - factor);
  return rgb.toString();
}

function cssEscape(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}
