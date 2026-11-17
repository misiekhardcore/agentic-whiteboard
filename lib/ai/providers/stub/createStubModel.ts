import { type LanguageModel } from "ai";
import { MockLanguageModelV4 } from "ai/test";

import { chooseStream } from "./internals";
import { STUB_MODEL_ID } from "./STUB_MODEL_ID";

export function createStubModel(): LanguageModel {
  return new MockLanguageModelV4({
    modelId: STUB_MODEL_ID,
    // The scripted answer is chosen synchronously; wrapping it in a resolved
    // promise keeps this method free of async work of its own.
    doStream: ({ prompt, tools }) => {
      return Promise.resolve(chooseStream({ prompt, tools }));
    },
  });
}
