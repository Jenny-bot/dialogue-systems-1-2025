import { assign, createActor, setup } from "xstate";
import { Settings, speechstate } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import { KEY } from "./azure";
import { DMContext, DMEvents } from "./types";

const inspector = createBrowserInspector();

const azureCredentials = {
  endpoint:
    "https://northeurope.api.cognitive.microsoft.com/sts/v1.0/issuetoken",
  key: KEY,
};

const settings: Settings = {
  azureCredentials: azureCredentials,
  azureRegion: "northeurope",
  asrDefaultCompleteTimeout: 0,
  asrDefaultNoInputTimeout: 5000,
  locale: "en-US",
  ttsDefaultVoice: "en-US-DavisNeural",
};

interface GrammarEntry {
  person?: string;
  day?: string;
  time?: string;
}

const grammar: { [index: string]: GrammarEntry } = {
  vlad: { person: "Vladislav Maraev" },
  aya: { person: "Nayat Astaiza Soriano" },
  victoria: { person: "Victoria Daniilidou" },
  monday: { day: "Monday" },
  tuesday: { day: "Tuesday" },
  "10": { time: "10:00" },
  "11": { time: "11:00" },
};

function isInGrammar(utterance: string) {
  return utterance.toLowerCase() in grammar;
}

function getPerson(utterance: string) {
  return (grammar[utterance.toLowerCase()] || {}).person;
}

const dmMachine = setup({
  types: {
    /** you might need to extend these */
    context: {} as DMContext,
    events: {} as DMEvents,
  },
  actions: {
    /** define your actions here */
    "spst.speak": ({ context }, params: { utterance: string }) =>
      context.spstRef.send({
        type: "SPEAK",
        value: {
          utterance: params.utterance,
        },
      }),
    "spst.listen": ({ context }) =>
      context.spstRef.send({
        type: "LISTEN",
      }),
  },
  delays: {
    READ_THE_INSTRUCTION: 5000,
  },
}).createMachine({
  context: ({ spawn }) => ({
    spstRef: spawn(speechstate, { input: settings }),
    lastResult: null,
  }),
  id: "DM",
  initial: "Prepare",
  states: {
    Prepare: {
      entry: ({ context }) => context.spstRef.send({ type: "PREPARE" }),
      on: { ASRTTS_READY: "WaitToStart" },
    },

    /** Timers example*/
    ReadTheInstruction: {
      after: {
        READ_THE_INSTRUCTION: { target: "WaitToStart" },
      },
    },
    WaitToStart: {
      on: { CLICK: "Main" },
    },

    NoInput: {
      entry: {
        type: "spst.speak",
        params: { utterance: `I can't hear you!` },
      },
      on: { SPEAK_COMPLETE: "Main.hist" },
    },

    Main: {
      initial: "Colour",
      on: {
        RECOGNISED: {
          actions: assign(({ event }) => {
            return { lastResult: event.value };
          }),
        },
        ASR_NOINPUT: {
          actions: assign({ lastResult: null }),
        },
        LISTEN_COMPLETE: {
          target: "NoInput",
          guard: ({ context }) => !context.lastResult,
        },
      },
      states: {
        hist: { type: "history", history: "deep" },
        Colour: {
          initial: "Prompt",
          on: {
            LISTEN_COMPLETE: {
              target: "Shape",
              guard: ({ context }) => !!context.lastResult,
            },
          },
          states: {
            Prompt: {
              entry: {
                type: "spst.speak",
                params: { utterance: `Tell me the colour.` },
              },
              on: { SPEAK_COMPLETE: "Ask" },
            },
            Ask: {
              entry: { type: "spst.listen" },
            },
          },
        },
        Shape: {
          initial: "Prompt",
          on: {
            LISTEN_COMPLETE: {
              target: "Done",
              guard: ({ context }) => !!context.lastResult,
            },
          },
          states: {
            Prompt: {
              entry: {
                type: "spst.speak",
                params: { utterance: `Tell me the shape.` },
              },
              on: { SPEAK_COMPLETE: "Ask" },
            },
            Ask: {
              entry: { type: "spst.listen" },
            },
          },
        },

        Done: {
          on: {
            CLICK: "Colour",
          },
        },
      },
    },

    CheckGrammar: {
      entry: {
        type: "spst.speak",
        params: ({ context }) => ({
          utterance: `You just said: ${context.lastResult![0].utterance}. And it ${
            isInGrammar(context.lastResult![0].utterance) ? "is" : "is not"
          } in the grammar.`,
        }),
      },
      // on: { SPEAK_COMPLETE: "Done" },
    },
  },
});

const dmActor = createActor(dmMachine, {
  inspect: inspector.inspect,
}).start();

dmActor.subscribe((state) => {
  console.group("State update");
  console.log("State value:", state.value);
  console.log("State context:", state.context);
  console.groupEnd();
});

export function setupButton(element: HTMLButtonElement) {
  element.addEventListener("click", () => {
    dmActor.send({ type: "CLICK" });
  });
  dmActor.subscribe((snapshot) => {
    const meta: { view?: string } = Object.values(
      snapshot.context.spstRef.getSnapshot().getMeta(),
    )[0] || {
      view: undefined,
    };
    element.innerHTML = `${meta.view}`;
  });
}
