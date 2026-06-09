import { HpsgAdapter, type LexemeBlockSource } from "../lib/grammar/hpsg-adapter.js";

const sources: LexemeBlockSource[] = [
  { type: "pn-lxm", form: "john", reln: "named John" },
  { type: "pn-lxm", form: "mary", reln: "named Mary" },
  {
    type: "stv-lxm",
    base: "see",
    thirdSingular: "sees",
    presentParticiple: "seeing",
    pastTense: "saw",
    pastParticiple: "seen",
    reln: "see",
  },
];

const adapter = new HpsgAdapter();
const blocks = adapter.createBlockDefinitions(sources);

const john = blocks.find((block) => block.label === "john");
const mary = blocks.find((block) => block.label === "mary");
const see = blocks.find((block) => block.label === "see");

if (!john || !mary || !see) {
  throw new Error("Expected john, mary, and see blocks.");
}

const johnState = adapter.createInitialState(john);
const maryState = adapter.createInitialState(mary);
const seesForm = see.forms.find((form) => form.kind === "thirdSingular");
const seeFiniteForm = see.forms.find((form) => form.kind === "nonThirdSingular");

if (!seesForm || !seeFiniteForm) {
  throw new Error("Expected both thirdSingular and nonThirdSingular see forms.");
}

const seesState = adapter.createStateFromFeature(seesForm.feature);
const seeFiniteState = adapter.createStateFromFeature(seeFiniteForm.feature);

const seesMary = adapter.combinePositions([
  { role: "specifier" },
  { role: "head", value: seesState.feature },
  { role: "complement", value: maryState.feature },
]);
const marySees = adapter.combinePositions([
  { role: "head", value: maryState.feature },
  { role: "complement", value: seesState.feature },
]);
const completeSentence = adapter.combinePositions([
  { role: "specifier", value: johnState.feature },
  { role: "head", value: seesState.feature },
  { role: "complement", value: maryState.feature },
]);
const invalidAgreement = adapter.combinePositions([
  { role: "specifier", value: johnState.feature },
  { role: "head", value: seeFiniteState.feature },
  { role: "complement", value: maryState.feature },
]);

const seeSummary = {
  blockCount: blocks.length,
  seeForms: see.forms.map((form) => `${form.kind}:${form.label}`),
  seesSlots: seesState.slots.map((slot) => slot.kind),
  seesMaryCount: seesMary.length,
  marySeesCount: marySees.length,
  completeSentenceCount: completeSentence.length,
  invalidAgreementCount: invalidAgreement.length,
};

console.log(JSON.stringify(seeSummary, null, 2));
