import type { FeatureStructure } from "syntax-core";
import type { EditorBlock, EditorModel } from "../blocks/editor-model.js";
import type { HpsgAdapter } from "./hpsg-adapter.js";

export interface BlockValidationResult {
  valid: boolean;
  feature: FeatureStructure | null;
}

export const evaluateBlockFeature = (
  adapter: HpsgAdapter,
  block: EditorBlock,
  selectedFormIndex = block.selectedFormIndex,
): BlockValidationResult => {
  const selectedForm = block.forms[selectedFormIndex];
  if (!selectedForm) return { valid: false, feature: null };

  let currentFeature: FeatureStructure = selectedForm.feature;
  const selectedPlaceholderIds = new Set(selectedForm.slots.map((slot) => slot.id));

  for (const child of block.children) {
    if (child.type !== "placeholder" && child.type !== "attachment") continue;
    if (child.type === "placeholder" && !selectedPlaceholderIds.has(child.id)) continue;
    if (!child.content) continue;

    const childResult = evaluateBlockFeature(adapter, child.content);
    if (!childResult.valid || !childResult.feature) {
      return { valid: false, feature: null };
    }

    const candidates = child.type === "attachment"
      ? adapter.combineHeadModifier(currentFeature, childResult.feature)
      : child.slotKind === "specifier"
        ? adapter.combineHeadSpecifier(currentFeature, childResult.feature)
        : adapter.combineHeadComplement(currentFeature, childResult.feature);

    if (candidates.length === 0) {
      return { valid: false, feature: null };
    }

    currentFeature = candidates[0].category;
  }

  return { valid: true, feature: currentFeature };
};

export const canInsertBlockIntoPlaceholder = (
  model: EditorModel,
  block: EditorBlock,
  targetParent: EditorBlock,
  childIndex: number,
): boolean => {
  const targetChild = targetParent.children[childIndex];
  if (!targetChild || targetChild.type !== "placeholder") return false;

  const headResult = evaluateBlockFeature(model.adapter, targetParent);
  const nonHeadResult = evaluateBlockFeature(model.adapter, block);
  if (!headResult.valid || !headResult.feature || !nonHeadResult.valid || !nonHeadResult.feature) {
    return false;
  }

  const candidates = targetChild.slotKind === "specifier"
    ? model.adapter.combineHeadSpecifier(headResult.feature, nonHeadResult.feature)
    : model.adapter.combineHeadComplement(headResult.feature, nonHeadResult.feature);

  return candidates.length > 0;
};

export const canAttachBlock = (
  model: EditorModel,
  block: EditorBlock,
  targetParent: EditorBlock,
): boolean => {
  const headResult = evaluateBlockFeature(model.adapter, targetParent);
  const nonHeadResult = evaluateBlockFeature(model.adapter, block);
  if (!headResult.valid || !headResult.feature || !nonHeadResult.valid || !nonHeadResult.feature) {
    return false;
  }

  return model.adapter.combineHeadModifier(headResult.feature, nonHeadResult.feature).length > 0;
};

export const canSelectBlockForm = (
  model: EditorModel,
  block: EditorBlock,
  formIndex: number,
): boolean => evaluateBlockFeature(model.adapter, block, formIndex).valid;
