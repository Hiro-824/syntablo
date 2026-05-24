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

  const previousDropdown = block.children.find(
    (child): child is Extract<EditorBlockChild, { type: "dropdown" }> =>
      child.type === "dropdown",
  );

  const children: EditorBlockChild[] = [];

  for (const slot of selectedForm.slots.filter((item) => item.side === "left")) {
    children.push({
      id: slot.id,
      type: "placeholder",
      slotKind: slot.kind,
      side: slot.side,
      content: null,
    });
  }

  if (block.forms.length > 1) {
    children.push({
      id: "head",
      type: "dropdown",
      content: block.forms.map((form) => form.label),
      selected: block.selectedFormIndex,
      ...(previousDropdown ? {} : null),
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
      content: null,
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

