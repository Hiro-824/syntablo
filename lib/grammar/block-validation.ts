import type { FeatureStructure, IndexedHpsgPosition } from "syntax-core";
import type { EditorBlock, EditorModel } from "../blocks/editor-model.js";
import type { HpsgAdapter } from "./hpsg-adapter.js";

export interface BlockValidationResult {
  valid: boolean;
  features: FeatureStructure[];
}

export const evaluateBlockFeature = (
  adapter: HpsgAdapter,
  block: EditorBlock,
  selectedFormIndex = block.selectedFormIndex,
): BlockValidationResult =>
  evaluateBlockFeatureWithOverrides(adapter, block, selectedFormIndex);

const evaluateBlockFeatureWithOverrides = (
  adapter: HpsgAdapter,
  block: EditorBlock,
  selectedFormIndex: number,
  childOverrides: ReadonlyMap<number, EditorBlock> = new Map(),
  extraAttachment?: {
    side: "left" | "right";
    features: FeatureStructure[];
  },
  formOverrides: ReadonlyMap<string, number> = new Map(),
): BlockValidationResult => {
  const effectiveFormIndex = formOverrides.get(block.id) ?? selectedFormIndex;
  const selectedForm = block.forms[effectiveFormIndex];
  if (!selectedForm) return { valid: false, features: [] };

  const leftAttachments = block.children.filter(
    (
      child,
    ): child is Extract<EditorBlock["children"][number], { type: "attachment" }> =>
      child.type === "attachment" && child.side === "left",
  );
  const rightAttachments = block.children.filter(
    (
      child,
    ): child is Extract<EditorBlock["children"][number], { type: "attachment" }> =>
      child.type === "attachment" && child.side === "right",
  );
  const positions: IndexedHpsgPosition[] = [];

  if (extraAttachment?.side === "left") {
    positions.push({ role: "modifier", value: extraAttachment.features });
  }
  for (const attachment of leftAttachments) {
    const result = evaluateBlockFeatureWithOverrides(
      adapter,
      attachment.content,
      attachment.content.selectedFormIndex,
      new Map(),
      undefined,
      formOverrides,
    );
    if (!result.valid) return { valid: false, features: [] };
    positions.push({ role: "modifier", value: result.features });
  }

  for (const slot of selectedForm.slots.filter((item) => item.side === "left")) {
    const content = getPlaceholderContent(block, slot.id, childOverrides);
    const result = content
      ? evaluateBlockFeatureWithOverrides(
        adapter,
        content,
        content.selectedFormIndex,
        new Map(),
        undefined,
        formOverrides,
      )
      : null;
    if (result && !result.valid) return { valid: false, features: [] };
    positions.push({ role: "specifier", value: result?.features });
  }

  positions.push({ role: "head", value: selectedForm.feature });

  for (const slot of selectedForm.slots.filter((item) => item.side === "right")) {
    const content = getPlaceholderContent(block, slot.id, childOverrides);
    const result = content
      ? evaluateBlockFeatureWithOverrides(
        adapter,
        content,
        content.selectedFormIndex,
        new Map(),
        undefined,
        formOverrides,
      )
      : null;
    if (result && !result.valid) return { valid: false, features: [] };
    positions.push({ role: "complement", value: result?.features });
  }

  for (const attachment of rightAttachments) {
    const result = evaluateBlockFeatureWithOverrides(
      adapter,
      attachment.content,
      attachment.content.selectedFormIndex,
      new Map(),
      undefined,
      formOverrides,
    );
    if (!result.valid) return { valid: false, features: [] };
    positions.push({ role: "modifier", value: result.features });
  }
  if (extraAttachment?.side === "right") {
    positions.push({ role: "modifier", value: extraAttachment.features });
  }

  const features = adapter.combinePositions(positions);

  return { valid: features.length > 0, features };
};

const getPlaceholderContent = (
  block: EditorBlock,
  placeholderId: string,
  childOverrides: ReadonlyMap<number, EditorBlock>,
): EditorBlock | null => {
  const childIndex = block.children.findIndex(
    (child) => child.type === "placeholder" && child.id === placeholderId,
  );
  if (childIndex < 0) return null;

  const child = block.children[childIndex];
  if (!child || child.type !== "placeholder") return null;
  return childOverrides.get(childIndex) ?? child.content;
};

export const canInsertBlockIntoPlaceholder = (
  model: EditorModel,
  block: EditorBlock,
  targetParent: EditorBlock,
  childIndex: number,
): boolean => {
  const targetChild = targetParent.children[childIndex];
  if (!targetChild || targetChild.type !== "placeholder") return false;

  return evaluateBlockFeatureWithOverrides(
    model.adapter,
    targetParent,
    targetParent.selectedFormIndex,
    new Map([[childIndex, block]]),
  ).valid;
};

export const canAttachBlock = (
  model: EditorModel,
  block: EditorBlock,
  targetParent: EditorBlock,
  side: "left" | "right",
): boolean => {
  const modifierResult = evaluateBlockFeature(model.adapter, block);
  if (!modifierResult.valid) return false;

  return evaluateBlockFeatureWithOverrides(
    model.adapter,
    targetParent,
    targetParent.selectedFormIndex,
    new Map(),
    { side, features: modifierResult.features },
  ).valid;
};

export const canSelectBlockForm = (
  model: EditorModel,
  block: EditorBlock,
  formIndex: number,
): boolean => {
  const rootBlock = findRootBlock(model, block.id) ?? block;

  return evaluateBlockFeatureWithOverrides(
    model.adapter,
    rootBlock,
    rootBlock.selectedFormIndex,
    new Map(),
    undefined,
    new Map([[block.id, formIndex]]),
  ).valid;
};

const findRootBlock = (
  model: EditorModel,
  blockId: string,
): EditorBlock | null => {
  const containsBlock = (block: EditorBlock): boolean => {
    if (block.id === blockId) return true;

    return block.children.some(
      (child) =>
        (child.type === "placeholder" || child.type === "attachment") &&
        child.content !== null &&
        containsBlock(child.content),
    );
  };

  return model.blocks.find(containsBlock) ?? null;
};
