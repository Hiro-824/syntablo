import {
  attachBlock,
  createEditorModel,
  insertBlock,
  moveBlockToTopLevel,
} from "../lib/blocks/editor-model.js";
import { HpsgAdapter } from "../lib/grammar/hpsg-adapter.js";
import { mvpLexemeSources } from "../lib/grammar/sample-lexemes.js";

const adapter = new HpsgAdapter();
const definitions = adapter.createBlockDefinitions(mvpLexemeSources);
const model = createEditorModel(adapter, definitions);
const insertModel = createEditorModel(adapter, definitions);
const johnId = model.blocks.find((block) => block.label === "john")?.id ?? "john";
const maryId = model.blocks.find((block) => block.label === "mary")?.id ?? "mary";
const seeId = model.blocks.find((block) => block.label === "see")?.id ?? "see";
const girlId = model.blocks.find((block) => block.label === "girl")?.id ?? "girl";
const seeBlock = insertModel.blocks.find((block) => block.id === seeId);
const seeComplementIndex =
  seeBlock?.children.findIndex((child) => child.type === "placeholder" && child.slotKind === "complement") ?? -1;
const inserted = seeComplementIndex >= 0
  ? insertBlock(insertModel, girlId, seeId, seeComplementIndex)
  : false;

const attachModel = createEditorModel(adapter, definitions);
const attached = attachBlock(attachModel, maryId, johnId, "right");
const detachInsertModel = createEditorModel(adapter, definitions);
const detachInsertSeeBlock = detachInsertModel.blocks.find((block) => block.id === seeId);
const detachInsertComplementIndex =
  detachInsertSeeBlock?.children.findIndex((child) => child.type === "placeholder" && child.slotKind === "complement") ?? -1;
if (detachInsertComplementIndex >= 0) {
  insertBlock(detachInsertModel, girlId, seeId, detachInsertComplementIndex);
}
const detachedFromPlaceholder = moveBlockToTopLevel(detachInsertModel, girlId);

const detachAttachModel = createEditorModel(adapter, definitions);
attachBlock(detachAttachModel, maryId, johnId, "right");
const detachedFromAttachment = moveBlockToTopLevel(detachAttachModel, maryId);

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
  freeInsertCheck: {
    input: "insert girl into see's complement placeholder",
    committed: inserted,
    topLevelIds: insertModel.blocks.map((block) => block.id),
    seeChildren: insertModel.blocks.find((block) => block.id === seeId)?.children.map((child) => ({
      id: child.id,
      type: child.type,
      contentId:
        (child.type === "placeholder" || child.type === "attachment") && child.content
          ? child.content.id
          : null,
    })),
  },
  freeAttachCheck: {
    input: "attach mary to john on the right",
    committed: attached,
    topLevelIds: attachModel.blocks.map((block) => block.id),
    johnChildren: attachModel.blocks.find((block) => block.id === johnId)?.children.map((child) => ({
      id: child.id,
      type: child.type,
      side: "side" in child ? child.side : null,
      contentId:
        (child.type === "placeholder" || child.type === "attachment") && child.content
          ? child.content.id
          : null,
      })),
  },
  freeDetachCheck: {
    input: "after insertion, drag girl out from see's complement placeholder",
    detachedBlockId: detachedFromPlaceholder?.id ?? null,
    topLevelIds: detachInsertModel.blocks.map((block) => block.id),
    seeChildren: detachInsertModel.blocks.find((block) => block.id === seeId)?.children.map((child) => ({
      id: child.id,
      type: child.type,
      contentId:
        (child.type === "placeholder" || child.type === "attachment") && child.content
          ? child.content.id
          : null,
    })),
  },
  freeDetachAttachmentCheck: {
    input: "after attachment, drag mary out from john's right attachment",
    detachedBlockId: detachedFromAttachment?.id ?? null,
    topLevelIds: detachAttachModel.blocks.map((block) => block.id),
    johnChildren: detachAttachModel.blocks.find((block) => block.id === johnId)?.children.map((child) => ({
      id: child.id,
      type: child.type,
      side: "side" in child ? child.side : null,
      contentId:
        (child.type === "placeholder" || child.type === "attachment") && child.content
          ? child.content.id
          : null,
    })),
  },
};

console.log(JSON.stringify(summary, null, 2));
