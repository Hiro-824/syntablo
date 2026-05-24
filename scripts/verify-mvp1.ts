import { createStaticBlockViews } from "../lib/blocks/static-block-view.js";
import { HpsgAdapter } from "../lib/grammar/hpsg-adapter.js";
import { mvpLexemeSources } from "../lib/grammar/sample-lexemes.js";

const adapter = new HpsgAdapter();
const definitions = adapter.createBlockDefinitions(mvpLexemeSources);
const views = createStaticBlockViews(adapter, definitions);

const summary = {
  blockCount: views.length,
  blocks: views.map((block) => ({
    label: block.label,
    selected: block.selectedLabel,
    forms: block.formLabels,
    slots: block.slots.map((slot) => slot.kind),
    slotSides: block.slots.map((slot) => `${slot.kind}:${slot.side}`),
    head: block.headType,
    verbForm: block.verbForm ?? null,
  })),
};

console.log(JSON.stringify(summary, null, 2));
