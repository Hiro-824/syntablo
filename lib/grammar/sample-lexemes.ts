import type { LexemeBlockSource } from "./hpsg-adapter.js";

export const mvpLexemeSources = [
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
  { type: "cntn-lxm", singular: "girl", plural: "girls", reln: "girl" },
] satisfies LexemeBlockSource[];
