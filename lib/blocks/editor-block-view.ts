import { HpsgAdapter, type BlockSlotKind, type WordBlockDefinition } from "../grammar/hpsg-adapter.js";

export interface EditorBlockSlotView {
  id: string;
  kind: BlockSlotKind;
  side: "left" | "right";
}

export interface EditorBlockFormView {
  label: string;
  kind: string;
  slots: EditorBlockSlotView[];
  headType?: string;
  verbForm?: string;
}

export interface EditorBlockView {
  id: string;
  label: string;
  selectedFormIndex: number;
  forms: EditorBlockFormView[];
  hasDropdown: boolean;
  x: number;
  y: number;
}

export const createEditorBlockViews = (
  adapter: HpsgAdapter,
  blocks: WordBlockDefinition[],
): EditorBlockView[] => {
  const preferredFormKinds = new Map([
    ["see", "thirdSingular"],
    ["girl", "singular"],
  ]);

  return blocks.map((block, index) => {
    const preferredKind = preferredFormKinds.get(block.label);
    const selectedFormIndex = Math.max(
      0,
      block.forms.findIndex((form) => form.kind === preferredKind),
    );
    const hasDropdown = block.forms.length > 1;
    const forms = block.forms.map((form) => {
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

    return {
      id: block.id,
      label: block.label,
      selectedFormIndex,
      forms,
      hasDropdown,
      x: 180,
      y: 140 + index * 132,
    };
  });
};

