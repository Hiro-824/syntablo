import type { FeatureStructure } from "syntax-core";
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
): BlockValidationResult => {
  const selectedForm = block.forms[selectedFormIndex];
  if (!selectedForm) return { valid: false, features: [] };

  const selectedPlaceholderIds = new Set(selectedForm.slots.map((slot) => slot.id));
  const indexedChildren = block.children.filter((child) => child.type !== "attachment");
  const headIndex = indexedChildren.findIndex((child) => child.id === "head");
  if (headIndex < 0) return { valid: false, features: [] };

  const words: Record<number, FeatureStructure | FeatureStructure[]> = {
    [headIndex + 1]: selectedForm.feature,
  };

  for (let index = 0; index < indexedChildren.length; index += 1) {
    const child = indexedChildren[index];
    if (!child || child.type !== "placeholder") continue;
    if (!selectedPlaceholderIds.has(child.id)) continue;
    const content = childOverrides.get(block.children.indexOf(child)) ?? child.content;
    if (!content) continue;

    const childResult = evaluateBlockFeature(adapter, content);
    if (!childResult.valid) {
      return { valid: false, features: [] };
    }

    words[index + 1] = childResult.features;
  }

  let features = adapter.combineIndexed({
    words,
    head: headIndex + 1,
  });

  for (const child of block.children) {
    if (child.type !== "attachment") continue;

    const childResult = evaluateBlockFeature(adapter, child.content);
    if (!childResult.valid) {
      return { valid: false, features: [] };
    }

    features = features.flatMap((headFeature) =>
      childResult.features.flatMap((modifierFeature) =>
        adapter
          .combineHeadModifier(headFeature, modifierFeature)
          .map((candidate) => candidate.category),
      ),
    );

    if (features.length === 0) {
      return { valid: false, features: [] };
    }
  }

  return { valid: features.length > 0, features };
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
): boolean => {
  const headResult = evaluateBlockFeature(model.adapter, targetParent);
  const nonHeadResult = evaluateBlockFeature(model.adapter, block);
  if (!headResult.valid || !nonHeadResult.valid) {
    return false;
  }

  return headResult.features.some((headFeature) =>
    nonHeadResult.features.some((nonHeadFeature) =>
      model.adapter.combineHeadModifier(headFeature, nonHeadFeature).length > 0
    )
  );
};

export const canSelectBlockForm = (
  model: EditorModel,
  block: EditorBlock,
  formIndex: number,
): boolean => evaluateBlockFeature(model.adapter, block, formIndex).valid;
