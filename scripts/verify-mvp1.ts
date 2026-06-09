import {
  attachBlock,
  createEditorModel,
  insertBlock,
  moveBlockToTopLevel,
  selectBlockFormInModel,
} from "../lib/blocks/editor-model.js";
import {
  canAttachBlock,
  canInsertBlockIntoPlaceholder,
  canSelectBlockForm,
  evaluateBlockFeature,
} from "../lib/grammar/block-validation.js";
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

const dropdownChangeModel = createEditorModel(adapter, definitions);
const dropdownSeeBlock = dropdownChangeModel.blocks.find((block) => block.id === seeId);
const dropdownComplementIndex =
  dropdownSeeBlock?.children.findIndex((child) => child.type === "placeholder" && child.slotKind === "complement") ?? -1;
const presentParticipleIndex =
  dropdownSeeBlock?.forms.findIndex((form) => form.kind === "presentParticiple") ?? -1;
if (dropdownComplementIndex >= 0) {
  insertBlock(dropdownChangeModel, girlId, seeId, dropdownComplementIndex);
}
const dropdownChanged = presentParticipleIndex >= 0
  ? selectBlockFormInModel(dropdownChangeModel, seeId, presentParticipleIndex)
  : false;

const validationModel = createEditorModel(adapter, definitions);
const validationSee = validationModel.blocks.find((block) => block.id === seeId);
const validationMary = validationModel.blocks.find((block) => block.id === maryId);
const validationGirl = validationModel.blocks.find((block) => block.id === girlId);
const validationJohn = validationModel.blocks.find((block) => block.id === johnId);
const validationQuickly = validationModel.blocks.find((block) => block.label === "quickly");
const validationComplementIndex =
  validationSee?.children.findIndex((child) => child.type === "placeholder" && child.slotKind === "complement") ?? -1;
const validationSpecifierIndex =
  validationSee?.children.findIndex((child) => child.type === "placeholder" && child.slotKind === "specifier") ?? -1;
const validationPresentParticipleIndex =
  validationSee?.forms.findIndex((form) => form.kind === "presentParticiple") ?? -1;

if (!validationSee || !validationMary || !validationGirl || !validationJohn || !validationQuickly) {
  throw new Error("Expected validation blocks for see, mary, girl, john, and quickly.");
}
if (canAttachBlock(validationModel, validationMary, validationSee, "left")) {
  throw new Error("Expected noun attachment to the left of a transitive verb to be rejected.");
}
if (canAttachBlock(validationModel, validationMary, validationSee, "right")) {
  throw new Error("Expected noun attachment to the right of a transitive verb to be rejected.");
}
if (!canAttachBlock(validationModel, validationQuickly, validationSee, "left")) {
  throw new Error("Expected a compatible adverb attachment on the left to succeed.");
}
if (!canAttachBlock(validationModel, validationQuickly, validationSee, "right")) {
  throw new Error("Expected a compatible adverb attachment on the right to succeed.");
}
if (canAttachBlock(validationModel, validationMary, validationJohn, "right")) {
  throw new Error("Expected a noun with empty MOD to be rejected as an attachment.");
}

const multipleAttachmentModel = createEditorModel(adapter, definitions);
const multipleAttachmentSee = multipleAttachmentModel.blocks.find((block) => block.label === "see");
const multipleAttachmentQuickly = multipleAttachmentModel.blocks.find((block) => block.label === "quickly");
const multipleAttachmentSlowly = multipleAttachmentModel.blocks.find((block) => block.label === "slowly");
if (!multipleAttachmentSee || !multipleAttachmentQuickly || !multipleAttachmentSlowly) {
  throw new Error("Expected see, quickly, and slowly blocks.");
}
if (!attachBlock(
  multipleAttachmentModel,
  multipleAttachmentQuickly.id,
  multipleAttachmentSee.id,
  "left",
)) {
  throw new Error("Expected direct setup of the left adverb attachment to succeed.");
}
if (!canAttachBlock(
  multipleAttachmentModel,
  multipleAttachmentSlowly,
  multipleAttachmentSee,
  "right",
)) {
  throw new Error("Expected a second compatible attachment on the opposite side to succeed.");
}
if (!attachBlock(
  multipleAttachmentModel,
  multipleAttachmentSlowly.id,
  multipleAttachmentSee.id,
  "right",
)) {
  throw new Error("Expected direct setup of the right adverb attachment to succeed.");
}
const multipleAttachmentResult = evaluateBlockFeature(adapter, multipleAttachmentSee);
if (!multipleAttachmentResult.valid || multipleAttachmentResult.features.length === 0) {
  throw new Error("Expected evaluation with left and right adverb attachments to succeed.");
}

const invalidDropdownModel = createEditorModel(adapter, definitions);
attachBlock(invalidDropdownModel, maryId, seeId, "right");
const invalidDropdownSee = invalidDropdownModel.blocks.find((block) => block.id === seeId);
const invalidDropdownPresentParticipleIndex =
  invalidDropdownSee?.forms.findIndex((form) => form.kind === "presentParticiple") ?? -1;

const indexedGapModel = createEditorModel(adapter, definitions);
const indexedGapGive = indexedGapModel.blocks.find((block) => block.label === "give");
const indexedGapMary = indexedGapModel.blocks.find((block) => block.label === "mary");
const indexedGapSecondComplementIndex =
  indexedGapGive?.children.findIndex(
    (child) => child.type === "placeholder" && child.id === "complement-1",
  ) ?? -1;
if (!indexedGapGive || !indexedGapMary || indexedGapSecondComplementIndex < 0) {
  throw new Error("Expected give, mary, and give's second complement placeholder.");
}
if (!insertBlock(
  indexedGapModel,
  indexedGapMary.id,
  indexedGapGive.id,
  indexedGapSecondComplementIndex,
)) {
  throw new Error("Expected mary insertion into give's second complement to succeed.");
}
const indexedGapResult = evaluateBlockFeature(adapter, indexedGapGive);
if (!indexedGapResult.valid || indexedGapResult.features.length === 0) {
  throw new Error("Expected indexed evaluation of give ___ mary to succeed.");
}
if (!indexedGapResult.features.every((feature) => readExpListLength(feature, ["SYN", "GAP"]) >= 1)) {
  throw new Error("Expected give ___ mary candidates to contain the omitted first complement in GAP.");
}

const standaloneGiveResult = evaluateBlockFeature(
  adapter,
  createEditorModel(adapter, definitions).blocks.find((block) => block.label === "give")!,
);
if (standaloneGiveResult.features.length < 2) {
  throw new Error("Expected standalone give evaluation to retain multiple edge GAP candidates.");
}

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
  dropdownModelChangeCheck: {
    input: "after inserting girl into see, change see dropdown from sees to seeing",
    committed: dropdownChanged,
    topLevelIds: dropdownChangeModel.blocks.map((block) => block.id),
    seeSelected: dropdownChangeModel.blocks.find((block) => block.id === seeId)?.forms[
      dropdownChangeModel.blocks.find((block) => block.id === seeId)?.selectedFormIndex ?? 0
    ]?.label,
    seeChildren: dropdownChangeModel.blocks.find((block) => block.id === seeId)?.children.map((child) => ({
      id: child.id,
      type: child.type,
      contentId:
        (child.type === "placeholder" || child.type === "attachment") && child.content
          ? child.content.id
          : null,
      })),
  },
  hpsgPreviewValidationCheck: {
    input: "validate candidate operations before committing them",
    maryIntoSeeComplement:
      validationSee && validationMary && validationComplementIndex >= 0
        ? canInsertBlockIntoPlaceholder(validationModel, validationMary, validationSee, validationComplementIndex)
        : null,
    girlIntoSeeSpecifier:
      validationSee && validationGirl && validationSpecifierIndex >= 0
        ? canInsertBlockIntoPlaceholder(validationModel, validationGirl, validationSee, validationSpecifierIndex)
        : null,
    maryAttachJohn:
      canAttachBlock(validationModel, validationMary, validationJohn, "right"),
    maryAttachSeeLeft:
      canAttachBlock(validationModel, validationMary, validationSee, "left"),
    maryAttachSeeRight:
      canAttachBlock(validationModel, validationMary, validationSee, "right"),
    quicklyAttachSeeLeft:
      canAttachBlock(validationModel, validationQuickly, validationSee, "left"),
    quicklyAttachSeeRight:
      canAttachBlock(validationModel, validationQuickly, validationSee, "right"),
    seeDropdownToSeeing:
      validationSee && validationPresentParticipleIndex >= 0
        ? canSelectBlockForm(validationModel, validationSee, validationPresentParticipleIndex)
        : null,
  },
  dropdownInvalidCancelCheck: {
    input: "with an incompatible attachment on see, preview changing see dropdown to seeing",
    canCommit:
      invalidDropdownSee && invalidDropdownPresentParticipleIndex >= 0
        ? canSelectBlockForm(invalidDropdownModel, invalidDropdownSee, invalidDropdownPresentParticipleIndex)
        : null,
    expectedUiBehavior: "cancel dropdown change and keep previous selection",
  },
  indexedValidationCheck: {
    standaloneGiveCandidateCount: standaloneGiveResult.features.length,
    internalGapCandidateCount: indexedGapResult.features.length,
    internalGapLengths: indexedGapResult.features.map((feature) =>
      readExpListLength(feature, ["SYN", "GAP"])
    ),
  },
  multipleAttachmentCheck: {
    valid: multipleAttachmentResult.valid,
    candidateCount: multipleAttachmentResult.features.length,
  },
};

console.log(JSON.stringify(summary, null, 2));

function readExpListLength(feature: import("syntax-core").FeatureStructure, path: string[]): number {
  let length = 0;
  let current = feature.getIn(path);

  while (current?.getType() === "exp-list-cons") {
    length += 1;
    current = current.get("REST");
  }

  return length;
}
