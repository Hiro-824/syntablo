"use client";

import * as d3 from "d3";

export const blockDrawingConstants = {
  padding: 3,
  horizontalPadding: 12,
  verticalPadding: 12,
  compactVerticalPadding: 6,
  blockCornerRadius: 10,
  blockStrokeWidth: 2,
  placeholderWidth: 100,
  placeholderHeight: 72,
  placeholderCornerRadius: 36,
  labelFontSize: 32,
  dropdownHeight: 60,
  blockFillColor: "#d4d4d4",
  blockTextColor: "#3f3f3f",
};

const supportedShapeTypes = new Set(["noun", "verb", "det", "prep"]);

export function renderBlockImage(block, blockGroup, svg, options = {}) {
  const {
    padding,
    blockStrokeWidth,
  } = blockDrawingConstants;

  blockGroup.selectAll("*").remove();
  const width = calculateWidth(block, svg);
  const height = calculateHeight(block, svg);
  const fillColor = getBlockFillColor(block);
  const strokeColor = darkenColor(fillColor, 30);
  const shapeType = getShapeType(block.headType);

  blockGroup.append("path")
    .attr("id", `frame-${block.id}`)
    .attr("d", getShapePath(shapeType, 0, 0, width, height, {
      shoulderX: shapeType === "prep" ? calculatePrepShoulderX(block, svg) : undefined,
    }))
    .attr("fill", fillColor)
    .attr("stroke", strokeColor)
    .attr("stroke-width", blockStrokeWidth);

  let x = getBlockContentStartX(block, height);
  for (let index = 0; index < block.children.length; index += 1) {
    const child = block.children[index];
    if (child.type === "placeholder") {
      x += renderPlaceholder(child, height, block, blockGroup, svg, index, x, options);
    } else if (child.type === "text") {
      x += renderText(child, height, block, blockGroup, svg, x);
    } else if (child.type === "dropdown") {
      x += renderDropdown(child, height, block, blockGroup, svg, x, index, options);
    } else if (child.type === "attachment") {
      x += renderAttachment(child, height, blockGroup, svg, x, options);
    }
  }

  return { width, height, padding };
}

export function renderPlaceholder(child, height, block, blockGroup, svg, childIndex, x, options = {}) {
  const {
    horizontalPadding,
    placeholderWidth,
    placeholderHeight,
  } = blockDrawingConstants;
  const isFlushDetSlot = isFlushLeadingDetChild(block, child);

  if (child.content) {
    const childWidth = calculateWidth(child.content, svg);
    const childHeight = calculateHeight(child.content, svg);
    child.content.x = x;
    child.content.y = isFlushDetSlot ? 0 : (height - childHeight) / 2;

    const childGroup = blockGroup.append("g")
      .attr("transform", `translate(${child.content.x}, ${child.content.y})`)
      .attr("id", child.content.id)
      .classed("grab", true)
      .datum(child.content);
    options.decorateBlockGroup?.(child.content, childGroup);
    renderBlockImage(child.content, childGroup, svg, options);

    return childWidth + horizontalPadding;
  }

  const renderedPlaceholderHeight = isFlushDetSlot ? height : placeholderHeight;
  const y = isFlushDetSlot ? 0 : (height - placeholderHeight) / 2;
  const inputColor = darkenColor(getBlockFillColor(block), 30);
  const shapeType = getPlaceholderShapeType(child.expectedHeadType);
  blockGroup.append("path")
    .attr("id", `placeholder-${child.id}-${block.id}`)
    .attr("data-parent-id", block.id)
    .attr("data-child-index", childIndex)
    .attr("data-child-id", child.id)
    .attr("d", getShapePath(shapeType, x, y, placeholderWidth, renderedPlaceholderHeight))
    .attr("fill", inputColor);

  return placeholderWidth + horizontalPadding;
}

export function renderAttachment(child, height, blockGroup, svg, x, options = {}) {
  const { horizontalPadding } = blockDrawingConstants;
  const childWidth = calculateWidth(child.content, svg);
  const childHeight = calculateHeight(child.content, svg);
  child.content.x = x;
  child.content.y = (height - childHeight) / 2;

  const childGroup = blockGroup.append("g")
    .attr("transform", `translate(${child.content.x}, ${child.content.y})`)
    .attr("id", child.content.id)
    .classed("grab", true)
    .datum(child.content);
  options.decorateBlockGroup?.(child.content, childGroup);
  renderBlockImage(child.content, childGroup, svg, options);

  return childWidth + horizontalPadding;
}

export function renderText(child, height, block, blockGroup, svg, x) {
  const { horizontalPadding, labelFontSize } = blockDrawingConstants;
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

export function renderDropdown(child, height, block, blockGroup, svg, x, count, options = {}) {
  const {
    padding,
    horizontalPadding,
    blockCornerRadius,
    labelFontSize,
    dropdownHeight,
  } = blockDrawingConstants;
  const selected = child.selected ?? 0;
  const text = child.content[selected];
  const box = calculateTextHeightAndWidth(svg, text);
  const dropdownWidth = calculateDropdownWidth(svg, child);
  const inputColor = darkenColor(getBlockFillColor(block), 30);
  const y = (height - dropdownHeight) / 2;

  const dropdownGroup = blockGroup.append("g")
    .classed("pointer", true)
    .style("cursor", "pointer");
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
  const optionLabels = child.optionLabels ?? child.content;
  const optionsWidth = Math.max(
    ...optionLabels.map((option) => calculateTextHeightAndWidth(svg, option).width),
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

  optionLabels.forEach((option, index) => {
    const optionBox = calculateTextHeightAndWidth(svg, option);
    const optionY = y + dropdownHeight + padding + blockCornerRadius + optionHeight * index;
    const optionGroup = optionsGroup.append("g")
      .classed("pointer", true)
      .style("cursor", "pointer")
      .attr("id", `option-${index}-dropdown-${count}-${block.id}`)
      .on("mousedown", (event) => {
        event.stopPropagation();
        options.onDropdownSelect?.(block, child, index);
      });

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

    optionGroup
      .on("mouseenter", function () {
        d3.select(this).select("rect").attr("opacity", 0.2);
      })
      .on("mouseleave", function () {
        d3.select(this).select("rect").attr("opacity", 0);
      });
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

export function calculateTextHeightAndWidth(svg, content) {
  const { labelFontSize } = blockDrawingConstants;
  const testText = svg.append("text")
    .text(content)
    .attr("fill", "white")
    .attr("font-size", `${labelFontSize}pt`)
    .attr("font-weight", "bold");
  const box = testText.node().getBBox();
  testText.remove();
  return box;
}

export function calculateDropdownWidth(svg, dropdown) {
  const { horizontalPadding } = blockDrawingConstants;
  const selected = dropdown.selected ?? 0;
  const text = dropdown.content[selected];
  const box = calculateTextHeightAndWidth(svg, text);
  return horizontalPadding * 4 + box.width;
}

export function calculateWidth(block, svg) {
  const { horizontalPadding, placeholderWidth } = blockDrawingConstants;
  const children = block.children.filter((child) => !child.hidden);
  const hasFlushDetSlot = hasFlushLeadingDetSlot(block, children);
  const paddingNumber = children.length + 1 - (hasFlushDetSlot ? 1 : 0);
  const shapeInsets = getShapeInsets(getShapeType(block.headType), calculateHeight(block, svg));
  let width = (hasFlushDetSlot ? 0 : shapeInsets.left) + shapeInsets.right;

  children.forEach((child) => {
    if (child.type === "placeholder") {
      width += child.content ? calculateWidth(child.content, svg) : placeholderWidth;
    } else if (child.type === "text") {
      width += calculateTextHeightAndWidth(svg, child.content).width;
    } else if (child.type === "dropdown") {
      width += calculateDropdownWidth(svg, child);
    } else if (child.type === "attachment") {
      width += calculateWidth(child.content, svg);
    }
  });

  width += horizontalPadding * paddingNumber;
  return width;
}

export function calculateHeight(block, svg) {
  const {
    verticalPadding,
    compactVerticalPadding,
    placeholderHeight,
    dropdownHeight,
  } = blockDrawingConstants;
  const shapeType = getShapeType(block.headType);
  const blockVerticalPadding =
    shapeType === "noun" || shapeType === "det"
      ? compactVerticalPadding
      : verticalPadding;
  const heights = [placeholderHeight];
  let flushChildHeight = 0;
  block.children.forEach((child) => {
    if (child.type === "placeholder") {
      const childHeight = child.content ? calculateHeight(child.content, svg) : placeholderHeight;
      if (child.content && isFlushLeadingDetChild(block, child)) {
        flushChildHeight = Math.max(flushChildHeight, childHeight);
      } else {
        heights.push(childHeight);
      }
    } else if (child.type === "dropdown") {
      heights.push(dropdownHeight);
    } else if (child.type === "attachment") {
      heights.push(calculateHeight(child.content, svg));
    }
  });

  const paddedContentHeight = blockVerticalPadding * 2 + Math.max(...heights);
  return Math.max(paddedContentHeight, flushChildHeight);
}

export function getBlockFillColor() {
  return blockDrawingConstants.blockFillColor;
}

export function getBlockTextColor() {
  return blockDrawingConstants.blockTextColor;
}

export function getShapeType(headType) {
  return supportedShapeTypes.has(headType) ? headType : "default";
}

export function getPlaceholderShapeType(expectedHeadType) {
  return supportedShapeTypes.has(expectedHeadType) ? expectedHeadType : "generic-slot";
}

export function getShapePath(shapeType, x, y, width, height, options = {}) {
  const { blockCornerRadius } = blockDrawingConstants;
  const right = x + width;
  const bottom = y + height;
  const cornerRadius = Math.min(blockCornerRadius, height / 2, width / 2);

  if (shapeType === "noun") {
    const radius = Math.min(height / 2, width / 2);
    return [
      `M ${x + radius} ${y}`,
      `H ${right - radius}`,
      `A ${radius} ${radius} 0 0 1 ${right - radius} ${bottom}`,
      `H ${x + radius}`,
      `A ${radius} ${radius} 0 0 1 ${x + radius} ${y}`,
      "Z",
    ].join(" ");
  }

  if (shapeType === "generic-slot") {
    const radius = Math.min(height / 2, width / 2);
    return roundedRectanglePath(x, y, width, height, radius);
  }

  if (shapeType === "det") {
    const leftRadius = Math.min(height / 2, width / 2);
    return [
      `M ${x + leftRadius} ${y}`,
      `H ${right - cornerRadius}`,
      `Q ${right} ${y} ${right} ${y + cornerRadius}`,
      `V ${bottom - cornerRadius}`,
      `Q ${right} ${bottom} ${right - cornerRadius} ${bottom}`,
      `H ${x + leftRadius}`,
      `A ${leftRadius} ${leftRadius} 0 0 1 ${x + leftRadius} ${y}`,
      "Z",
    ].join(" ");
  }

  if (shapeType === "prep") {
    const stemHeight = Math.min(height * 0.62, 60);
    const stemTop = y + (height - stemHeight) / 2;
    const stemBottom = stemTop + stemHeight;
    const requestedShoulder = options.shoulderX ?? x + width * 0.42;
    const shoulderX = Math.max(
      x + cornerRadius * 2,
      Math.min(right - cornerRadius * 2, requestedShoulder),
    );

    return [
      `M ${x + cornerRadius} ${stemTop}`,
      `H ${shoulderX}`,
      `V ${y + cornerRadius}`,
      `Q ${shoulderX} ${y} ${shoulderX + cornerRadius} ${y}`,
      `H ${right - cornerRadius}`,
      `Q ${right} ${y} ${right} ${y + cornerRadius}`,
      `V ${bottom - cornerRadius}`,
      `Q ${right} ${bottom} ${right - cornerRadius} ${bottom}`,
      `H ${shoulderX + cornerRadius}`,
      `Q ${shoulderX} ${bottom} ${shoulderX} ${bottom - cornerRadius}`,
      `V ${stemBottom}`,
      `H ${x + cornerRadius}`,
      `Q ${x} ${stemBottom} ${x} ${stemBottom - cornerRadius}`,
      `V ${stemTop + cornerRadius}`,
      `Q ${x} ${stemTop} ${x + cornerRadius} ${stemTop}`,
      "Z",
    ].join(" ");
  }

  return roundedRectanglePath(x, y, width, height, cornerRadius);
}

function roundedRectanglePath(x, y, width, height, radius) {
  const right = x + width;
  const bottom = y + height;
  return [
    `M ${x + radius} ${y}`,
    `H ${right - radius}`,
    `Q ${right} ${y} ${right} ${y + radius}`,
    `V ${bottom - radius}`,
    `Q ${right} ${bottom} ${right - radius} ${bottom}`,
    `H ${x + radius}`,
    `Q ${x} ${bottom} ${x} ${bottom - radius}`,
    `V ${y + radius}`,
    `Q ${x} ${y} ${x + radius} ${y}`,
    "Z",
  ].join(" ");
}

function getShapeInsets(shapeType, height) {
  if (shapeType === "noun") {
    // Reserve both semicircular caps so labels and controls stay entirely
    // within the straight center section of the capsule.
    const inset = Math.max(0, height / 2 - blockDrawingConstants.horizontalPadding);
    return { left: inset, right: inset };
  }
  if (shapeType === "det") {
    return {
      // Keep the label out of the semicircular cap. This matters most for
      // short determiners such as "a", whose frame would otherwise collapse
      // into an unbalanced oval.
      left: Math.max(0, height / 2 - blockDrawingConstants.horizontalPadding),
      right: 0,
    };
  }
  return { left: 0, right: 0 };
}

function getBlockContentStartX(block, height) {
  if (hasFlushLeadingDetSlot(block)) {
    return 0;
  }

  return blockDrawingConstants.horizontalPadding +
    getShapeInsets(getShapeType(block.headType), height).left;
}

function hasFlushLeadingDetSlot(block, visibleChildren = null) {
  if (getShapeType(block.headType) !== "noun") {
    return false;
  }

  const children = visibleChildren ?? block.children.filter((child) => !child.hidden);
  const firstChild = children[0];
  return isFlushLeadingDetChild(block, firstChild);
}

function isFlushLeadingDetChild(block, child) {
  return getShapeType(block.headType) === "noun" &&
    child?.type === "placeholder" &&
    child.side === "left" &&
    child.expectedHeadType === "det";
}

function calculatePrepShoulderX(block, svg) {
  const { horizontalPadding, placeholderWidth } = blockDrawingConstants;
  const shapeInsets = getShapeInsets("prep", calculateHeight(block, svg));
  let x = horizontalPadding + shapeInsets.left;

  for (const child of block.children) {
    if (child.type === "placeholder" && child.side === "right") {
      return x;
    }
    if (child.type === "placeholder") {
      x += child.content ? calculateWidth(child.content, svg) : placeholderWidth;
    } else if (child.type === "text") {
      x += calculateTextHeightAndWidth(svg, child.content).width;
    } else if (child.type === "dropdown") {
      x += calculateDropdownWidth(svg, child);
    } else if (child.type === "attachment") {
      x += calculateWidth(child.content, svg);
    }
    x += horizontalPadding;
  }

  return undefined;
}

export function darkenColor(color, factor) {
  const rgb = d3.rgb(color);
  rgb.r = Math.max(0, rgb.r - factor);
  rgb.g = Math.max(0, rgb.g - factor);
  rgb.b = Math.max(0, rgb.b - factor);
  return rgb.toString();
}
