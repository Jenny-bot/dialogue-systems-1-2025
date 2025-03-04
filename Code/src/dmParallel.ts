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
    nextUtterance: "Hello and welcome!",
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

    Main: {
      type: "parallel",
      states: {
        Control: {
          initial: "Prompt",
          states: {
            Prompt: {
              entry: {
                type: "spst.speak",
                params: ({ context }) => {
                  const utt = context.nextUtterance;
                  return {
                    utterance: utt,
                  };
                },
              },
              on: { SPEAK_COMPLETE: "Ask" },
            },
            Ask: {
              entry: { type: "spst.listen" },
              on: { LISTEN_COMPLETE: "Prompt" },
            },
          },
        },
        Logic: {
          initial: "Greeting",
          states: {
            Greeting: {
              on: { RECOGNISED: "Colour", SPEAK_COMPLETE: "#DM.WaitToStart" },
            },
            Colour: {
              entry: assign({ nextUtterance: "Tell me the colour." }),
              on: { RECOGNISED: "Shape" },
            },
            Shape: {
              entry: assign({ nextUtterance: "Tell me the shape." }),
              on: { RECOGNISED: "ThankYou" },
            },
            ThankYou: {
              entry: [
                assign({ nextUtterance: "Thank You!" }),
                raise({ type: "DONE" }),
              ],
            },
          },
        },
      },
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
