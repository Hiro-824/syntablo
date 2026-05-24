import * as d3 from 'd3';
import type { Block, BlockChild } from '@/models/block';
import { Converter } from "@/grammar/converter";
import {
    horizontalPadding,
    labelFontSize,
    placeholderWidth,
    placeholderHeight,
    dropdownHeight,
    padding,
    verticalPadding,
    blockCornerRadius,
    blockStrokeWidth,
    resolvedGapRadius,
    placeholderCornerRadius,
    blockFillColor,
    blockTextColor,
    finiteClauseBlockColor,
    verbBlockColor,
    nounBlockColor,
    outlinedModifierBlockColor,
    useBlockCategoryColors
} from './const';

const getCalculationSvg = (): d3.Selection<SVGSVGElement, unknown, HTMLElement, unknown> => {
    const selectorId = '__text_calculation_svg__';
    let svg = d3.select<SVGSVGElement, unknown>(`body > svg#${selectorId}`);

    if (svg.empty()) {
        svg = d3.select('body').append('svg')
            .attr('id', selectorId)
            .style('position', 'absolute')
            .style('top', '-9999px')
            .style('left', '-9999px');
    }
    return svg;
};

const calculateTextHeightAndWidth = (content: string) => {
    const svg = getCalculationSvg();
    const testText = svg.append("text")
        .text(content)
        .attr('font-size', `${labelFontSize}pt`)
        .attr('font-weight', 'bold');
    const box = (testText.node() as SVGTextElement).getBBox();
    testText.remove();
    return box;
};

const calculateDropdownWidth = (dropdown: BlockChild) => {
    if (typeof dropdown.content !== 'object' || dropdown.content === null || !Array.isArray(dropdown.content)) return 0;
    const selected = dropdown.selected ?? 0;
    const text = dropdown.content[selected];
    const box = calculateTextHeightAndWidth(text);
    return horizontalPadding * 4 + box.width;
};

const getSelectedHeadCategory = (block: Block) => {
    const headChild = block.children.find(c => c.id === "head");
    const headIndex = headChild?.type === "dropdown" ? (headChild.selected ?? 0) : 0;
    const headWord = block.words?.[headIndex];
    return Array.isArray(headWord?.categories) ? headWord.categories[0] : null;
};

const isDeterminerBlock = (block: Block) => {
    const head = getSelectedHeadCategory(block)?.head;
    const headType = head?.type;
    return Boolean(
        (headType && typeof headType === "object" && headType.isDet === true) ||
        (headType === "interrogative" && head?.determiner === true)
    );
};

const isOutlinedTextBlock = (block: Block) => (
    block.words.some(word =>
        Array.isArray(word?.categories) &&
        word.categories.some(category => {
            const head = category?.head;
            const type = head?.type;
            return type === "adj" ||
                type === "adverb" ||
                type === "prep" ||
                (type === "interrogative" && head?.adverbial === true);
        })
    )
);

const getBlockVerticalPadding = (block: Block) => (
    isDeterminerBlock(block) ? 0 : verticalPadding
);

export const calculateBlockWidth = (block: Block): number => {
    const children = block.children.filter((child) => !child.hidden);
    const paddingNumber = children.length + 1;
    let width = 0;
    if (block.isRound) {
        width += horizontalPadding * 2;
    }

    children.forEach(child => {
        if (child.resolved && child.type === "placeholder") {
            width += resolvedGapRadius * 2;
        } else if (child.type === "placeholder") {
            const content = child.content as Block | null;
            if (content) {
                width += calculateBlockWidth(content);
            } else {
                width += placeholderWidth;
            }
        } else if (child.type === "text") {
            const box = calculateTextHeightAndWidth(child.content as string);
            width += box.width;
        } else if (child.type === "dropdown") {
            width += calculateDropdownWidth(child);
        } else if (child.type === "attachment") {
            const content = child.content as Block | null;
            if (content) {
                width += calculateBlockWidth(content);
            }
        }
    });
    width += (horizontalPadding * paddingNumber);
    return width;
};

export const calculateBlockHeight = (block: Block): number => {
    const children = block.children.filter((child) => (!child.hidden && child.resolved !== true));
    const blockVerticalPadding = getBlockVerticalPadding(block);
    const heights = [placeholderHeight - blockVerticalPadding * 2];
    children.forEach(child => {
        if (child.type === "placeholder") {
            const content = child.content as Block | null;
            if (content) {
                heights.push(calculateBlockHeight(content));
            } else {
                heights.push(placeholderHeight);
            }
        } else if (child.type === "dropdown") {
            heights.push(dropdownHeight);
        } else if (child.type === "attachment") {
            const content = child.content as Block | null;
            if (content) {
                heights.push(calculateBlockHeight(content));
            }
        }
    });
    const highest = Math.max(...heights);
    return blockVerticalPadding * 2 + highest;
};

const darkenColor = (color: string, factor: number) => {
    const rgb = d3.rgb(color);
    rgb.r = Math.max(0, rgb.r - factor);
    rgb.g = Math.max(0, rgb.g - factor);
    rgb.b = Math.max(0, rgb.b - factor);
    return rgb.toString();
};

const getBlockFillColor = (block: Block) => {
    if (!useBlockCategoryColors) {
        return blockFillColor;
    }

    if (isOutlinedTextBlock(block)) {
        return outlinedModifierBlockColor;
    }

    const headType = getSelectedHeadCategory(block)?.head?.type;
    const normalizedHeadType = typeof headType === "object" ? headType?.type : headType;

    if (normalizedHeadType === "sentence") {
        return finiteClauseBlockColor;
    }

    if (normalizedHeadType === "verb") {
        return verbBlockColor;
    }

    if (normalizedHeadType === "nominal") {
        return nounBlockColor;
    }

    return block.color || blockFillColor;
};

const getBlockTextColor = (block: Block) => (
    isOutlinedTextBlock(block)
        ? getBlockFillColor(block)
        : useBlockCategoryColors ? 'white' : blockTextColor
);

export const renderStaticBlock = <ParentDatum>(
    block: Block,
    parentSelection: d3.Selection<SVGGElement, ParentDatum, null, undefined>
) => {
    // Group for this block, offset by its coordinates
    const blockGroup = parentSelection.append("g")
        .attr("transform", `translate(${block.x ?? 0}, ${block.y ?? 0})`)
        .datum(block);

    const width = calculateBlockWidth(block);
    const height = calculateBlockHeight(block);
    const fillColor = getBlockFillColor(block);
    const strokeColor = darkenColor(fillColor, 30);
    const actualCornerRadius = block.isRound ? height / 2 : blockCornerRadius;

    // Render the main frame
    blockGroup.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", fillColor)
        .attr("rx", actualCornerRadius)
        .attr("ry", actualCornerRadius)
        .attr("stroke", strokeColor)
        .attr("stroke-width", blockStrokeWidth);

    let currentX = horizontalPadding + (block.isRound ? horizontalPadding : 0);

    // Render each visible child
    for (const child of block.children) {
        if (child.hidden) continue;

        const childContent = child.content as Block | null;

        if (child.resolved && child.type === "placeholder") {
            const circleColor = darkenColor(fillColor, 30);
            const centerY = height / 2;
            const centerX = currentX + resolvedGapRadius;
            blockGroup.append("circle")
                .attr("cx", centerX)
                .attr("cy", centerY)
                .attr("r", resolvedGapRadius)
                .attr("fill", circleColor);
            currentX += (resolvedGapRadius * 2 + horizontalPadding);

        } else if (child.type === 'placeholder' || child.type === 'attachment') {
            if (childContent) {
                // Render nested block recursively
                const childWidth = calculateBlockWidth(childContent);
                const childHeight = calculateBlockHeight(childContent);
                // Offset nested block coordinates
                childContent.x = currentX;
                childContent.y = (height - childHeight) / 2;

                renderStaticBlock(childContent, blockGroup);

                currentX += (childWidth + horizontalPadding);
            } else if (child.type === 'placeholder') {
                // Render an empty placeholder slot
                const y = (height - placeholderHeight) / 2;
                const inputColor = darkenColor(fillColor, 30);
                blockGroup.append("rect")
                    .attr("x", currentX)
                    .attr("y", y)
                    .attr("width", placeholderWidth)
                    .attr("height", placeholderHeight)
                    .attr("rx", placeholderCornerRadius)
                    .attr("ry", placeholderCornerRadius)
                    .attr("fill", inputColor);
                currentX += (placeholderWidth + horizontalPadding);
            }
        } else if (child.type === 'text') {
            const textContent = child.content as string;
            const box = calculateTextHeightAndWidth(textContent);
            const y = ((height - box.height) / 2) + box.height;
            blockGroup.append("text")
                .text(textContent)
                .attr("x", currentX)
                .attr("y", y)
                .attr('fill', getBlockTextColor(block))
                .attr('font-size', `${labelFontSize}pt`)
                .attr('font-weight', 'bold')
                .attr('dy', '-0.24em')
                .style('user-select', 'none');
            currentX += (box.width + horizontalPadding);

        } else if (child.type === 'dropdown') {
            const selectedIndex = child.selected ?? 0;
            const text = (child.content as string[])[selectedIndex];
            const box = calculateTextHeightAndWidth(text);
            const dropdownWidth = calculateDropdownWidth(child);
            const inputColor = darkenColor(fillColor, 30);
            const y = (height - dropdownHeight) / 2;

            // Dropdown background
            blockGroup.append("rect")
                .attr("x", currentX)
                .attr("y", y)
                .attr("width", dropdownWidth)
                .attr("height", dropdownHeight)
                .attr("rx", blockCornerRadius)
                .attr("ry", blockCornerRadius)
                .attr("fill", inputColor);

            // Selected text
            const textX = currentX + horizontalPadding;
            const textY = ((height - box.height) / 2) + box.height;
            blockGroup.append("text")
                .text(text)
                .attr("x", textX)
                .attr("y", textY)
                .attr('fill', getBlockTextColor(block))
                .attr('font-size', `${labelFontSize}pt`)
                .attr('font-weight', 'bold')
                .attr('dy', '-0.24em')
                .style('user-select', 'none');

            // Arrow icon
            blockGroup.append("text")
                .text("▼")
                .attr("x", textX + box.width + horizontalPadding)
                .attr("y", textY - 10) // Minor adjustment to align icon
                .attr('fill', getBlockTextColor(block))
                .attr('font-size', '10pt')
                .attr('font-weight', 'bold')
                .attr('dy', '-0.24em')
                .style('user-select', 'none');

            currentX += (dropdownWidth + horizontalPadding);
        }
    }
};

export const converter = new Converter();
