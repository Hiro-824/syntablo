"use client";

import * as d3 from "d3";

export const blockDrawingConstants = {
  padding: 3,
  horizontalPadding: 12,
  verticalPadding: 12,
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

export function renderBlockImage(block, blockGroup, svg, options = {}) {
  const {
    padding,
    horizontalPadding,
    blockCornerRadius,
    blockStrokeWidth,
  } = blockDrawingConstants;

  blockGroup.selectAll("*").remove();
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
      x += renderDropdown(child, height, block, blockGroup, svg, x, index, options);
    }
  }

  return { width, height, padding };
}

export function renderPlaceholder(child, height, block, blockGroup, x) {
  const {
    horizontalPadding,
    placeholderWidth,
    placeholderHeight,
    placeholderCornerRadius,
  } = blockDrawingConstants;
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

export function calculateHeight(block) {
  const { verticalPadding, placeholderHeight, dropdownHeight } = blockDrawingConstants;
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

export function getBlockFillColor() {
  return blockDrawingConstants.blockFillColor;
}

export function getBlockTextColor() {
  return blockDrawingConstants.blockTextColor;
}

export function darkenColor(color, factor) {
  const rgb = d3.rgb(color);
  rgb.r = Math.max(0, rgb.r - factor);
  rgb.g = Math.max(0, rgb.g - factor);
  rgb.b = Math.max(0, rgb.b - factor);
  return rgb.toString();
}

