import { HpsgAdapter, type BlockSlotKind, type WordBlockDefinition } from "../grammar/hpsg-adapter.js";

export interface EditorBlockSlot {
  id: string;
  kind: BlockSlotKind;
  side: "left" | "right";
}

export interface EditorBlockForm {
  label: string;
  kind: string;
  slots: EditorBlockSlot[];
  headType?: string;
  verbForm?: string;
}

export type EditorBlockChild =
  | { id: "head"; type: "dropdown"; content: string[]; selected: number }
  | { id: "head"; type: "text"; content: string }
  | { id: string; type: "placeholder"; slotKind: BlockSlotKind; side: "left" | "right"; content: EditorBlock | null }
  | { id: string; type: "attachment"; side: "left" | "right"; content: EditorBlock };

export interface EditorBlock {
  id: string;
  label: string;
  x: number;
  y: number;
  isRound: boolean;
  selectedFormIndex: number;
  forms: EditorBlockForm[];
  headType?: string;
  verbForm?: string;
  children: EditorBlockChild[];
}

export interface EditorModel {
  blocks: EditorBlock[];
}

export interface EditorBlockSearchResult {
  foundBlock: EditorBlock | null;
  parentBlock: EditorBlock | null;
  childIndex: number;
  absoluteX: number;
  absoluteY: number;
  rootParent: EditorBlock | null;
}

export const createEditorModel = (
  adapter: HpsgAdapter,
  definitions: WordBlockDefinition[],
): EditorModel => ({
  blocks: createInitialEditorBlocks(adapter, definitions),
});

export const createInitialEditorBlocks = (
  adapter: HpsgAdapter,
  definitions: WordBlockDefinition[],
): EditorBlock[] => {
  const preferredFormKinds = new Map([
    ["see", "thirdSingular"],
    ["girl", "singular"],
  ]);

  return definitions.map((definition, index) => {
    const preferredKind = preferredFormKinds.get(definition.label);
    const selectedFormIndex = Math.max(
      0,
      definition.forms.findIndex((form) => form.kind === preferredKind),
    );
    const forms = definition.forms.map((form) => {
      const state = adapter.createStateFromFeature(form.feature);
      const leftSlots = state.slots.filter((slot) => slot.kind === "specifier");
      const rightSlots = state.slots.filter((slot) => slot.kind === "complement");
      const slots = [
        ...leftSlots.map((slot) => ({
          id: slot.id,
          kind: slot.kind,
          side: "left" as const,
        })),
        ...rightSlots.map((slot) => ({
          id: slot.id,
          kind: slot.kind,
          side: "right" as const,
        })),
      ];

      return {
        label: form.label,
        kind: form.kind,
        slots,
        headType: state.headType,
        verbForm: state.verbForm,
      };
    });

    const block: EditorBlock = {
      id: definition.id,
      label: definition.label,
      x: 180,
      y: 140 + index * 132,
      isRound: false,
      selectedFormIndex,
      forms,
      children: [],
    };

    applySelectedForm(block);
    return block;
  });
};

export const applySelectedForm = (block: EditorBlock) => {
  const selectedForm = block.forms[block.selectedFormIndex];
  if (!selectedForm) return;

  const previousPlaceholderContents = new Map(
    block.children
      .filter(
        (
          child,
        ): child is Extract<EditorBlockChild, { type: "placeholder" }> =>
          child.type === "placeholder",
      )
      .map((child) => [child.id, child.content]),
  );

  const children: EditorBlockChild[] = [];

  for (const slot of selectedForm.slots.filter((item) => item.side === "left")) {
    children.push({
      id: slot.id,
      type: "placeholder",
      slotKind: slot.kind,
      side: slot.side,
      content: previousPlaceholderContents.get(slot.id) ?? null,
    });
  }

  if (block.forms.length > 1) {
    children.push({
      id: "head",
      type: "dropdown",
      content: block.forms.map((form) => form.label),
      selected: block.selectedFormIndex,
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
      side: slot.side,
      content: previousPlaceholderContents.get(slot.id) ?? null,
    });
  }

  block.children = children;
  block.headType = selectedForm.headType;
  block.verbForm = selectedForm.verbForm;
};

export const selectBlockForm = (block: EditorBlock, formIndex: number) => {
  if (!block.forms[formIndex]) return;
  block.selectedFormIndex = formIndex;
  applySelectedForm(block);
};

export const findTopLevelBlock = (model: EditorModel, blockId: string) =>
  model.blocks.find((block) => block.id === blockId) ?? null;

export const findBlock = (model: EditorModel, blockId: string): EditorBlockSearchResult => {
  const result: EditorBlockSearchResult = {
    foundBlock: null,
    parentBlock: null,
    childIndex: -1,
    absoluteX: 0,
    absoluteY: 0,
    rootParent: null,
  };

  const searchRecursively = (
    blocks: EditorBlock[],
    offsetX = 0,
    offsetY = 0,
    candidateRoot: EditorBlock | null = null,
  ): boolean => {
    for (const block of blocks) {
      const currentRoot = candidateRoot ?? block;

      if (block.id === blockId) {
        result.foundBlock = block;
        result.rootParent = currentRoot;
        result.absoluteX = offsetX + block.x;
        result.absoluteY = offsetY + block.y;
        return true;
      }

      for (let index = 0; index < block.children.length; index += 1) {
        const child = block.children[index];
        if ((child.type === "placeholder" || child.type === "attachment") && child.content) {
          if (child.content.id === blockId) {
            result.foundBlock = child.content;
            result.parentBlock = block;
            result.childIndex = index;
            result.rootParent = currentRoot;
            result.absoluteX = offsetX + block.x + child.content.x;
            result.absoluteY = offsetY + block.y + child.content.y;
            return true;
          }

          if (
            searchRecursively(
              [child.content],
              offsetX + block.x,
              offsetY + block.y,
              currentRoot,
            )
          ) {
            return true;
          }
        }
      }
    }

    return false;
  };

  searchRecursively(model.blocks);
  return result;
};

export const removeBlock = (model: EditorModel, blockId: string): EditorBlock | null => {
  const foundResult = findBlock(model, blockId);
  if (!foundResult.foundBlock) return null;

  if (foundResult.parentBlock) {
    removeBlockFromParent(foundResult.parentBlock, foundResult.childIndex);
  } else {
    model.blocks = model.blocks.filter((block) => block.id !== blockId);
  }

  return foundResult.foundBlock;
};

export const moveBlockToTopLevel = (
  model: EditorModel,
  blockId: string,
  hop = false,
): EditorBlock | null => {
  const foundResult = findBlock(model, blockId);
  if (!foundResult.foundBlock) return null;
  if (!foundResult.parentBlock) return foundResult.foundBlock;

  const block = foundResult.foundBlock;
  block.x = foundResult.absoluteX + (hop ? 16 : 0);
  block.y = foundResult.absoluteY + (hop ? 16 : 0);
  removeBlock(model, blockId);
  model.blocks.push(block);
  return block;
};

export const insertBlock = (
  model: EditorModel,
  blockId: string,
  targetParentId: string,
  childIndex: number,
): boolean => {
  if (blockId === targetParentId) return false;

  const movedBlock = removeBlock(model, blockId);
  if (!movedBlock) return false;

  const targetParent = findBlock(model, targetParentId).foundBlock;
  const targetChild = targetParent?.children[childIndex];
  if (!targetParent || !targetChild || targetChild.type !== "placeholder") {
    model.blocks.push(movedBlock);
    return false;
  }

  movedBlock.x = 0;
  movedBlock.y = 0;
  targetChild.content = movedBlock;
  return true;
};

export const attachBlock = (
  model: EditorModel,
  blockId: string,
  targetParentId: string,
  side: "left" | "right",
): boolean => {
  if (blockId === targetParentId) return false;

  const movedBlock = removeBlock(model, blockId);
  if (!movedBlock) return false;

  const targetParent = findBlock(model, targetParentId).foundBlock;
  if (!targetParent) {
    model.blocks.push(movedBlock);
    return false;
  }

  movedBlock.x = 0;
  movedBlock.y = 0;
  const attachment: EditorBlockChild = {
    id: `attachment-${side}-${movedBlock.id}`,
    type: "attachment",
    side,
    content: movedBlock,
  };

  if (side === "left") {
    targetParent.children.unshift(attachment);
  } else {
    targetParent.children.push(attachment);
  }
  return true;
};

const removeBlockFromParent = (parent: EditorBlock, childIndex: number) => {
  const child = parent.children[childIndex];
  if (!child) return;

  if (child.type === "placeholder") {
    child.content = null;
  } else if (child.type === "attachment") {
    parent.children.splice(childIndex, 1);
  }
};
