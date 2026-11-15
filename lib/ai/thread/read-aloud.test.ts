import { describe, expect, it } from "vitest";

import { pendingSpeech, READ_ALOUD_LANGUAGE, speechErrorMessage } from "./read-aloud";

function spoken(reply: string): string[] {
  return pendingSpeech(reply, 0, true).utterances;
}

describe("pendingSpeech", () => {
  it("holds an unfinished sentence until a boundary arrives", () => {
    expect(pendingSpeech("The agent is draft", 0, false)).toEqual({
      utterances: [],
      spoken: 0,
    });
  });

  it("speaks a finished sentence and keeps the fragment after it", () => {
    const reply = "The design is ready. Next";

    expect(pendingSpeech(reply, 0, false)).toEqual({
      utterances: ["The design is ready."],
      spoken: "The design is ready. ".length,
    });
  });

  it("continues from the offset without repeating what was already spoken", () => {
    const reply = "The design is ready. Next up is the API.";
    const first = pendingSpeech(reply, 0, false);

    expect(first.utterances).toEqual(["The design is ready."]);
    expect(pendingSpeech(reply, first.spoken, true)).toEqual({
      utterances: ["Next up is the API."],
      spoken: reply.length,
    });
  });

  it("waits for the end of the turn before speaking a trailing terminator", () => {
    expect(pendingSpeech("The design is ready.", 0, false)).toEqual({
      utterances: [],
      spoken: 0,
    });
    expect(pendingSpeech("The design is ready.", 0, true).utterances).toEqual([
      "The design is ready.",
    ]);
  });

  it("has nothing more to say once the whole reply was spoken", () => {
    const result = pendingSpeech("Ready. Set. Go.", 0, true);

    expect(result.utterances).toEqual(["Ready.", "Set.", "Go."]);
    expect(pendingSpeech("Ready. Set. Go.", result.spoken, true)).toEqual({
      utterances: [],
      spoken: result.spoken,
    });
  });

  it("treats a line break as a boundary, as headings and lists do", () => {
    expect(pendingSpeech("## Plan\nThe design", 0, false)).toEqual({
      utterances: ["Plan"],
      spoken: "## Plan\n".length,
    });
  });

  it("keeps a decimal number inside its sentence", () => {
    expect(spoken("Version 3.14 is out.")).toEqual(["Version 3.14 is out."]);
  });

  it("keeps a common abbreviation inside its sentence", () => {
    expect(spoken("Use e.g. this shape. Then stop.")).toEqual([
      "Use e.g. this shape.",
      "Then stop.",
    ]);
    expect(spoken("Dr. Smith wrote it. Done.")).toEqual(["Dr. Smith wrote it.", "Done."]);
  });

  it("ends a sentence at punctuation wrapped in markdown emphasis", () => {
    expect(spoken("**Ready.** The `api` [doc](/docs) is live.")).toEqual([
      "Ready.",
      "The api doc is live.",
    ]);
  });

  it("skips fenced code and speaks the prose around it", () => {
    expect(spoken("First.\n```ts\nconst x = 1;\n```\nAfter.")).toEqual(["First.", "After."]);
  });

  it("does not speak an unclosed code block", () => {
    expect(spoken("Before.\n```ts\nconst x = 1")).toEqual(["Before."]);
  });

  it("flattens a table row into words", () => {
    expect(spoken("| Name | Type |\nOK.")).toEqual(["Name Type", "OK."]);
  });

  it("keeps a link's text and drops a bare URL", () => {
    expect(spoken("Read the [guide](https://example.com/x). Then go.")).toEqual([
      "Read the guide.",
      "Then go.",
    ]);
    expect(spoken("https://example.com/docs")).toEqual([]);
  });

  it("strips list markers, headings, quotes and rules", () => {
    expect(spoken("## Plan\n- Draft the schema\n- Ship it\n")).toEqual([
      "Plan",
      "Draft the schema",
      "Ship it",
    ]);
    expect(spoken("> Quoted.\n\n---\nDone.")).toEqual(["Quoted.", "Done."]);
  });

  it("has nothing to speak for an empty reply", () => {
    expect(pendingSpeech("", 0, true)).toEqual({ utterances: [], spoken: 0 });
  });

  it("clamps an offset past the end of the reply", () => {
    expect(pendingSpeech("Done.", 99, true)).toEqual({ utterances: [], spoken: 5 });
  });
});

describe("speechErrorMessage", () => {
  it("explains blocked audio and an unavailable output", () => {
    expect(speechErrorMessage("not-allowed")).toMatch(/allow audio/i);
    expect(speechErrorMessage("audio-busy")).toMatch(/audio output/i);
    expect(speechErrorMessage("audio-hardware")).toMatch(/audio output/i);
  });

  it("explains a missing voice and an unreachable service", () => {
    expect(speechErrorMessage("language-unavailable")).toMatch(/voice/i);
    expect(speechErrorMessage("voice-unavailable")).toMatch(/voice/i);
    expect(speechErrorMessage("network")).toMatch(/speech service/i);
  });

  it("stays quiet when the person stopped the speech on purpose", () => {
    expect(speechErrorMessage("canceled")).toBeNull();
    expect(speechErrorMessage("interrupted")).toBeNull();
  });

  it("offers a retry for anything else", () => {
    expect(speechErrorMessage("synthesis-failed")).toMatch(/try again/i);
  });

  it("speaks US English, like dictation", () => {
    expect(READ_ALOUD_LANGUAGE).toBe("en-US");
  });
});
