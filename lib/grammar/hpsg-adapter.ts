import {
  FeatureStructure,
  HPSG,
  type ConstantLexemeInput,
  type LexemeInput,
  type TerminalEntry,
  type VerbLexemeInput,
} from "syntax-core";

export type HpsgCombineRule =
  | "head-complement"
  | "head-specifier"
  | "head-modifier";

export type WordFormKind =
  | "word"
  | "singular"
  | "plural"
  | "base"
  | "nonThirdSingular"
  | "thirdSingular"
  | "presentParticiple"
  | "pastTense"
  | "pastParticiple";

export type BlockSlotKind = "complement" | "specifier";

export type LexemeBlockSource = LexemeInput | LexemeBlockSpec;

export interface LexemeBlockSpec {
  id: string;
  label?: string;
  lexemes: LexemeInput[];
}

export interface WordFormOption {
  id: string;
  label: string;
  kind: WordFormKind;
  feature: FeatureStructure;
  lexeme: LexemeInput;
}

export interface WordBlockDefinition {
  id: string;
  label: string;
  lexemes: LexemeInput[];
  forms: WordFormOption[];
}

export interface HpsgCombineCandidate {
  rule: HpsgCombineRule;
  category: FeatureStructure;
}

export interface BlockSlot {
  id: string;
  kind: BlockSlotKind;
  index: number;
  expected: FeatureStructure;
}

export interface BlockGrammarState {
  feature: FeatureStructure;
  candidates: HpsgCombineCandidate[];
  activeCandidateIndex: number;
  slots: BlockSlot[];
  headType?: string;
  verbForm?: string;
  canAttachAsModifier: boolean;
}

type FeaturePath = string[];

export class HpsgAdapter {
  readonly grammar: HPSG;

  constructor(grammar = new HPSG()) {
    this.grammar = grammar;
  }

  createBlockDefinitions(sources: LexemeBlockSource[]): WordBlockDefinition[] {
    return sources.map((source, index) => this.createBlockDefinition(source, index));
  }

  createInitialState(block: WordBlockDefinition, formId = block.forms[0]?.id): BlockGrammarState {
    const form = block.forms.find((option) => option.id === formId) ?? block.forms[0];
    if (!form) {
      throw new Error(`Block '${block.id}' has no word forms.`);
    }

    return this.createStateFromFeature(form.feature);
  }

  createStateFromFeature(
    feature: FeatureStructure,
    candidates: HpsgCombineCandidate[] = [],
    activeCandidateIndex = 0,
  ): BlockGrammarState {
    return {
      feature,
      candidates,
      activeCandidateIndex,
      slots: this.getVisibleSlots(feature),
      headType: this.getHeadType(feature),
      verbForm: this.getVerbForm(feature),
      canAttachAsModifier: this.canAttachAsModifier(feature),
    };
  }

  combineHeadComplement(
    head: FeatureStructure,
    complement: FeatureStructure,
  ): HpsgCombineCandidate[] {
    return this.grammar
      .combineHeadComplement(head, complement)
      .map((result) => ({ rule: "head-complement", category: result.category }));
  }

  combineHeadSpecifier(
    head: FeatureStructure,
    specifier: FeatureStructure,
  ): HpsgCombineCandidate[] {
    return this.grammar
      .combineHeadSpecifier(head, specifier)
      .map((result) => ({ rule: "head-specifier", category: result.category }));
  }

  combineHeadModifier(
    head: FeatureStructure,
    modifier: FeatureStructure,
  ): HpsgCombineCandidate[] {
    return this.grammar
      .combineHeadModifier(head, modifier)
      .map((result) => ({ rule: "head-modifier", category: result.category }));
  }

  combineByRule(
    rule: HpsgCombineRule,
    head: FeatureStructure,
    nonHead: FeatureStructure,
  ): HpsgCombineCandidate[] {
    if (rule === "head-complement") {
      return this.combineHeadComplement(head, nonHead);
    }

    if (rule === "head-specifier") {
      return this.combineHeadSpecifier(head, nonHead);
    }

    return this.combineHeadModifier(head, nonHead);
  }

  getVisibleSlots(feature: FeatureStructure): BlockSlot[] {
    const slots: BlockSlot[] = [];

    this.readExpList(feature, ["SYN", "VAL", "COMPS"]).forEach((expected, index) => {
      slots.push({
        id: `complement-${index}`,
        kind: "complement",
        index,
        expected,
      });
    });

    if (this.shouldShowSpecifierSlot(feature)) {
      this.readExpList(feature, ["SYN", "VAL", "SPR"]).forEach((expected, index) => {
        slots.push({
          id: `specifier-${index}`,
          kind: "specifier",
          index,
          expected,
        });
      });
    }

    return slots;
  }

  shouldShowSpecifierSlot(feature: FeatureStructure): boolean {
    return this.getHeadType(feature) === "verb" && this.getVerbForm(feature) === "fin" || this.getHeadType(feature) === "noun";
  }

  canAttachAsModifier(feature: FeatureStructure): boolean {
    return this.readExpList(feature, ["SYN", "VAL", "MOD"]).length > 0;
  }

  getHeadType(feature: FeatureStructure): string | undefined {
    return feature.getIn(["SYN", "HEAD"])?.getType();
  }

  getVerbForm(feature: FeatureStructure): string | undefined {
    return feature.getIn(["SYN", "HEAD", "FORM"])?.getType();
  }

  toTerminalEntries(blocks: WordBlockDefinition[]): TerminalEntry<FeatureStructure>[] {
    return blocks.flatMap((block) =>
      block.forms.map((form) => ({
        terminal: form.label,
        category: form.feature,
      })),
    );
  }

  private createBlockDefinition(source: LexemeBlockSource, index: number): WordBlockDefinition {
    const spec = this.normalizeSource(source, index);
    const forms = spec.lexemes.flatMap((lexeme, lexemeIndex) =>
      this.buildForms(spec.id, lexeme, lexemeIndex),
    );

    return {
      id: spec.id,
      label: spec.label ?? forms[0]?.label ?? spec.id,
      lexemes: spec.lexemes,
      forms,
    };
  }

  private normalizeSource(source: LexemeBlockSource, index: number): LexemeBlockSpec {
    if ("lexemes" in source) {
      return source;
    }

    const label = getLexemePrimaryLabel(source);
    return {
      id: `${toIdentifier(label)}-${index}`,
      label,
      lexemes: [source],
    };
  }

  private buildForms(
    blockId: string,
    lexeme: LexemeInput,
    lexemeIndex: number,
  ): WordFormOption[] {
    const makeOption = (
      kind: WordFormKind,
      label: string,
      feature: FeatureStructure,
    ): WordFormOption => ({
      id: `${blockId}-${lexemeIndex}-${kind}`,
      label,
      kind,
      feature,
      lexeme,
    });

    if (lexeme.type === "cntn-lxm") {
      const words = this.grammar.buildCountNounWords(lexeme);
      return [
        makeOption("singular", lexeme.singular, words.singular),
        makeOption("plural", lexeme.plural, words.plural),
      ];
    }

    if (lexeme.type === "massn-lxm") {
      const words = this.grammar.buildMassNounWords(lexeme);
      return [makeOption("singular", lexeme.form, words.singular)];
    }

    if (isVerbLexeme(lexeme)) {
      const words = this.grammar.buildVerbWords(lexeme);
      return [
        makeOption("base", lexeme.base, words.base),
        makeOption("nonThirdSingular", lexeme.base, words.nonThirdSingular),
        makeOption("thirdSingular", lexeme.thirdSingular, words.thirdSingular),
        makeOption("presentParticiple", lexeme.presentParticiple, words.presentParticiple),
        makeOption("pastTense", lexeme.pastTense, words.pastTense),
        makeOption("pastParticiple", lexeme.pastParticiple, words.pastParticiple),
      ];
    }

    const words = this.grammar.buildConstantWords(lexeme as ConstantLexemeInput);
    return [makeOption("word", lexeme.form, words.word)];
  }

  private readExpList(feature: FeatureStructure, path: FeaturePath): FeatureStructure[] {
    const values: FeatureStructure[] = [];
    let current = feature.getIn(path);

    while (current?.getType() === "exp-list-cons") {
      const first = current.get("FIRST");
      if (first) {
        values.push(first);
      }
      current = current.get("REST");
    }

    return values;
  }
}

const verbLexemeTypes = new Set<LexemeInput["type"]>([
  "siv-lxm",
  "piv-lxm",
  "stv-lxm",
  "dtv-lxm",
  "ptv-lxm",
]);

const isVerbLexeme = (lexeme: LexemeInput): lexeme is VerbLexemeInput =>
  verbLexemeTypes.has(lexeme.type);

const getLexemePrimaryLabel = (lexeme: LexemeInput): string => {
  if (lexeme.type === "cntn-lxm") {
    return lexeme.singular;
  }

  if (isVerbLexeme(lexeme)) {
    return lexeme.base;
  }

  return lexeme.form;
};

const toIdentifier = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "lexeme";

