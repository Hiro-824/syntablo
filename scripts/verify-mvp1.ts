import { createEditorModel } from "../lib/blocks/editor-model.js";
import { HpsgAdapter } from "../lib/grammar/hpsg-adapter.js";
import { mvpLexemeSources } from "../lib/grammar/sample-lexemes.js";

const adapter = new HpsgAdapter();
const definitions = adapter.createBlockDefinitions(mvpLexemeSources);
const model = createEditorModel(adapter, definitions);

const summary = {
  blockCount: model.blocks.length,
  topLevelIds: model.blocks.map((block) => block.id),
  blocks: model.blocks.map((block) => ({
    label: block.label,
    selected: block.forms[block.selectedFormIndex]?.label,
    forms: block.forms.map((form) => `${form.kind}:${form.label}`),
    selectedSlots: block.forms[block.selectedFormIndex]?.slots.map((slot) => slot.kind) ?? [],
    selectedSlotSides:
      block.forms[block.selectedFormIndex]?.slots.map((slot) => `${slot.kind}:${slot.side}`) ?? [],
    formSlotSummary: block.forms.map((form) => ({
      form: `${form.kind}:${form.label}`,
      slots: form.slots.map((slot) => `${slot.kind}:${slot.side}`),
    })),
    children: block.children.map((child) => ({
      id: child.id,
      type: child.type,
      side: "side" in child ? child.side : null,
      slotKind: "slotKind" in child ? child.slotKind : null,
      hasContent: "content" in child && typeof child.content === "object" && child.content !== null,
    })),
    position: { x: block.x, y: block.y },
    head: block.forms[block.selectedFormIndex]?.headType,
    verbForm: block.forms[block.selectedFormIndex]?.verbForm ?? null,
  })),
};

console.log(JSON.stringify(summary, null, 2));
