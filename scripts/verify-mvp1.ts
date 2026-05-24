import { createEditorBlockViews } from "../lib/blocks/editor-block-view.js";
import { HpsgAdapter } from "../lib/grammar/hpsg-adapter.js";
import { mvpLexemeSources } from "../lib/grammar/sample-lexemes.js";

const adapter = new HpsgAdapter();
const definitions = adapter.createBlockDefinitions(mvpLexemeSources);
const views = createEditorBlockViews(adapter, definitions);

const summary = {
  blockCount: views.length,
  blocks: views.map((block) => ({
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
    position: { x: block.x, y: block.y },
    head: block.forms[block.selectedFormIndex]?.headType,
    verbForm: block.forms[block.selectedFormIndex]?.verbForm ?? null,
  })),
};

console.log(JSON.stringify(summary, null, 2));
