import { HpsgAdapter, type BlockSlotKind, type WordBlockDefinition } from "../grammar/hpsg-adapter.js";

export interface StaticBlockSlotView {
  id: string;
  kind: BlockSlotKind;
  side: "left" | "right";
}

export interface StaticBlockView {
  id: string;
  label: string;
  selectedLabel: string;
  formLabels: string[];
  hasDropdown: boolean;
  slots: StaticBlockSlotView[];
  headType?: string;
  verbForm?: string;
}

export const createStaticBlockViews = (
  adapter: HpsgAdapter,
  blocks: WordBlockDefinition[],
): StaticBlockView[] => {
  const preferredFormKinds = new Map([
    ["see", "thirdSingular"],
    ["girl", "singular"],
  ]);

  return blocks.map((block, index) => {
    const preferredKind = preferredFormKinds.get(block.label);
    const selectedForm =
      block.forms.find((form) => form.kind === preferredKind) ?? block.forms[0];
    const state = adapter.createStateFromFeature(selectedForm.feature);
    const hasDropdown = block.forms.length > 1;
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
      id: block.id,
      label: block.label,
      selectedLabel: selectedForm.label,
      formLabels: block.forms.map((form) => form.label),
      hasDropdown,
      slots,
      headType: state.headType,
      verbForm: state.verbForm,
    };
  });
};
