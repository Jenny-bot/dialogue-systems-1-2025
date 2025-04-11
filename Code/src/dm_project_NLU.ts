import { assign, createActor, setup } from "xstate";
import { Settings, speechstate } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import { KEY, NLU_KEY } from "./azure";
import { DMContext, DMEvents } from "./types";

const inspector = createBrowserInspector();

const azureCredentials = {
  endpoint:
    "https://northeurope.api.cognitive.microsoft.com/sts/v1.0/issuetoken",
  key: KEY,
};

const azureLanguageCredentials = {
  endpoint:
    // "https://nlu-resource.cognitiveservices.azure.com/language/:analyze-conversations?api-version=2024-11-15-preview",
    "https://nlu-resource.cognitiveservices.azure.com/language/:analyze-conversations?api-version=2024-11-15-preview",
  key: NLU_KEY,
  deploymentName: "safety1",
  projectName: "jw-nlu-project",
};

const settings: Settings = {
  azureCredentials: azureCredentials,
  azureLanguageCredentials: azureLanguageCredentials,
  azureRegion: "northeurope",
  asrDefaultCompleteTimeout: 0,
  asrDefaultNoInputTimeout: 5000,
  locale: "en-US",
  ttsDefaultVoice: "en-GB-AdaMultilingualNeural",
};

interface GrammarEntry {
  person?: string;
  day?: string;
  time?: string;
  yesno?: string;
}

const grammar: { [index: string]: GrammarEntry } = {
  vlad: { person: "Vladislav Maraev" },
  aya: { person: "Nayat Astaiza Soriano" },
  victoria: { person: "Victoria Daniilidou" },
  monday: { day: "Monday" },
  tuesday: { day: "Tuesday" },
  yes: { yesno: "Yes" },
  no: { yesno: "No" },
  "10": { time: "10:00" },
  "11": { time: "11:00" },
};

const validDay = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const yesPhrases = ["yes", "sure", "of course", "absolutely", "indeed", "aye", "affirmative", "you've got it"];
const noPhrases = ["no", "nope", "nah", "negative", "nay", "not really", "no thanks", "not a chance"];

// These are my prompts
const promptGreeting = "Hello? This is agent Laagom from the Swedish Contingencies Agency calling!";
// const promptGreeting = "Hello?";

const promptNoInput = "Sorry, I didn't hear you say anything!";

const promptName0 = "If you can hear me, please state your name!";
const promptName1 = "I need to know what to call you. Just say your first name or make one up.";
const promptName2 = "Just make up a name that I can call you!";

const missionStatement = "We are launching operation safe home and your mission - should you choose to accept it - is to secure your safe house and ensure the occupants are fully preapared for any crisis. This message will self-destruct in five seconds... ... Just kidding! But do take your mission seriously!";
// const missionStatement = "Explaining mission";

const promptYesNo0 = "Do you want to proceed?";
const promptYesNo1 = "Do you want to proceed with your mission?";
const promptYesNo2 = "Answering yes or no. Do you accept the mission?";

const promptWhat0 = "Do you know what to do?";
const promptWhat1 = "Do you know what to do next?";
const promptWhat2 = "Do you know what to do now?";

const promptSilence1 = "I didn't hear you say anything.";
const promptSilence2 = "I still did not hear anything.";
const promptSilence3 = "I really cannot hear anything! Mission aborted!";

const humansStatement = "Before we deploy, I need a full report on your team.";

const promptHumans0 = "How many human operatives are stationed at your safe house?";
const promptHumans1 = "Please state the number of human operatives stationed at your house.";
const promptHumans2 = "I need you to say a number. How many humans stationed in your house?";

const petsStatement = "And what about your four-legged partners?";

const promptPets0 = "Please state how many pets are in your household.";
const promptPets1 = "Please state the number of pets stationed at your house.";
const promptPets2 = "I need you to say a number. How many pets are in your household?";

const waterStatement = "Listen very carefully, I shall say this only once. Water is the lifeblood of our operation. In a crisis, every drop counts. Our guidelines mandate that each human operative requires 3 litres of water per day for drinking and cooking. Any four-legged partners also need their share, approximatesly 1 litre per day each."

const promptWater0 = "For a 7-day mission, calculate the total water required for your team.";
const promptWater1 = "How many litres of water does your team need to manage for 7 days?";
const promptWater2 = "A human needs 3 litres of water per day, a pet needs one litre of water per day. How many litres do you need for one week?";

/*
function isInGrammar(utterance: string) {
  return utterance.toLowerCase() in grammar;
}

function getPerson(utterance: string) {
  return (grammar[utterance.toLowerCase()] || {}).person;
}

function validateDay(utterance: string) {
  return validDay.includes(utterance.toLowerCase());
}
*/

function isYes(utterance: string) {
  return yesPhrases.includes(utterance.toLowerCase());
}
function isNo(utterance: string) {
  return noPhrases.includes(utterance.toLowerCase());
}
function calculateWater(numHumans: number, numPets: number): number {
  const waterPerHumanPerDay = 3;  // liters per human per day
  const waterPerPetPerDay = 1;    // liters per pet per day
  return 7 * (numHumans * waterPerHumanPerDay + numPets * waterPerPetPerDay);
}

const dmMachine = setup({
  types: {
    /** you might need to extend these */
    context: {} as DMContext,
    events: {} as DMEvents,
  },
  actions: {
    /** define your actions here */
    // The spst.speak action takes the context and a parameter object containing the utterance to speak.
    // It sends a "SPEAK" event to a speech syntesis reference: spstRef.
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
    "spst.listenNLU": ({ context }) => {
      console.log("NLU ACTION CALLED!");
      context.spstRef.send({
        type: "LISTEN",
        value: { nlu: true },
      });
    },
  },
 
}).createMachine({
  context: ({ spawn }) => ({
    spstRef: spawn(speechstate, { input: settings }),
    lastResult: null,
    nameResult: "",
    dayResult: "",
    timeResult: "",
    silCount: 0,
    numHumans: 0,
    numPets: 0,
    waterRequired: 0,
    userGuess: 0,
    waterBadge: "",
    nluIntent: "",
    // nluEntities: null,
  }),
  id: "DM",
  initial: "Prepare",
  states: {
    Prepare: {
      entry: ({ context }) => context.spstRef.send({ type: "PREPARE" }),
      on: { ASRTTS_READY: "WaitToStart" },
    },
    WaitToStart: {
      on: { CLICK: "Greeting" },
    },
    Greeting: {
      entry: { 
        type: "spst.speak", 
        params: { utterance: promptGreeting } 
      },
      on: { SPEAK_COMPLETE: "#DM.Main.AskWhat" },
    }, 
    NoInput: {
      always: {
        target: "#DM.Main.AbortMission",
        guard: ({ context }) => context.silCount >= 3,    
      },
      entry: [
        assign({ 
          silCount: ({ context }) => (context.silCount + 1)
        }),
      {
        type: "spst.speak",
        params: ({ context }) => ({
          utterance: eval(`promptSilence${context.silCount}`),
        }),
      },
    ],
      on: { SPEAK_COMPLETE: "Main.hist" },
    },
    Main: {
      initial: "AskName",
      on: {
        RECOGNISED: {
          actions: assign(({ event }) => {
            // () => console.log("Global RECOGNISED event received");
            return {
              lastResult: event.value,
              silCount: 0
            };
          }),
        },
        LISTEN_COMPLETE: [
          {
            // Do this
            target: "NoInput",
            guard: ({ context }) => !context.lastResult,
          },
        ],
        ASR_NOINPUT: {
          actions: assign({ lastResult: null }),
        },
      },
      states: {
        hist: { type: "history" },
        AskName: {
          initial: "Prompt",
          on: {
            LISTEN_COMPLETE: {
              target: ".Confirm",
              guard: ({ context }) => !!context.lastResult,
            },
          },
          states: {
            Prompt: {
              entry: {
                type: "spst.speak",
                params: ({ context }) => ({
                  utterance: eval(`promptName${context.silCount}`),
                }),
              },
              on: { SPEAK_COMPLETE: "Listen" },
            },
            Listen: {
              entry: { type: "spst.listen" },
            },
            Confirm: {
              entry: [
                assign({
                  nameResult: ({ context }) => (context.nameResult = context.lastResult![0].utterance)
                }),
                {
                  type: "spst.speak",
                  params: ({ context }) => ({
                    utterance: `Good to connect with you, agent ${context.nameResult}.`,
                  }),
                },
              ],
              on: { SPEAK_COMPLETE: "#DM.Main.AskWhat" },
            },
          },
        },
        AskWhat: {
          initial: "Prompt",
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                console.log("RECOGNISED EVENT FROM AskWhat", event);
                // console.log("NLU INTENT:", context.nluIntent);
                return {
                  lastResult: event.nluValue![0].category,
                  silCount: 0
                };
              }),
            },
            LISTEN_COMPLETE: {
              target: ".Validate",
              guard: ({ context }) => {
                console.log("Checking lastResult:", context.lastResult);
                return !!context.lastResult;
              },
            },
          },
          states: {
             Prompt: {
              entry: [
                {
                  type: "spst.speak",
                  params: ({ context }) => ({
                    utterance: eval(`promptWhat${context.silCount}`),
                  }),
                },
              ],
              on: { SPEAK_COMPLETE: "Listen" },
            },
            Listen: {
              entry: [
                () => console.log("CALLING THE NLU ASR!"),{ 
                type: "spst.listenNLU", 
              },
            ],
    
            },
            Validate: {
              always: [
                {
                  target: "#DM.Main.AbortMission",
                  guard: ({ context }) => isNo(context.lastResult![0].utterance.toLowerCase())
                },
                {
                  target: "Confirm",
                  guard: ({ context }) => isYes(context.lastResult![0].utterance.toLowerCase())
                },
                {
                  target: "InvalidInput",
                  guard: ({ context }) =>
                    !isNo(context.lastResult![0].utterance.toLowerCase()) &&
                    !isYes(context.lastResult![0].utterance.toLowerCase())
                }            
              ]
            },
            InvalidInput: {
              entry: {
                type: "spst.speak",
                params: ({ context }) => ({
                  utterance: `Sorry, but I heard ${context.lastResult![0].utterance}. Please answer with yes or no.`,
                }),
              },
              on: { SPEAK_COMPLETE: "#DM.Main.AskAccept" },
            },
            Confirm: {
              entry: [
                {
                  type: "spst.speak",
                  params: { utterance: `Glad to hear that! Let's go!` },
                },
              ],
              on: { SPEAK_COMPLETE: "#DM.Main.Done" },
            },
          },
        },
        MissionStatement: { 
          entry: { type: "spst.speak", params: { utterance: missionStatement } },
          on: { SPEAK_COMPLETE: "AskAccept" },
        },
        AskAccept: {
          initial: "Prompt",
          on: {
            LISTEN_COMPLETE: {
              target: ".Validate",
              guard: ({ context }) => !!context.lastResult,
            },
          },
          states: {
             Prompt: {
              entry: [
                {
                  type: "spst.speak",
                  params: ({ context }) => ({
                    utterance: eval(`promptYesNo${context.silCount}`),
                  }),
                },
              ],
              on: { SPEAK_COMPLETE: "Listen" },
            },
            Listen: {
              entry: { type: "spst.listen" },
            },
            Validate: {
              always: [
                {
                  target: "#DM.Main.AbortMission",
                  guard: ({ context }) => isNo(context.lastResult![0].utterance.toLowerCase())
                },
                {
                  target: "Confirm",
                  guard: ({ context }) => isYes(context.lastResult![0].utterance.toLowerCase())
                },
                {
                  target: "InvalidInput",
                  guard: ({ context }) =>
                    !isNo(context.lastResult![0].utterance.toLowerCase()) &&
                    !isYes(context.lastResult![0].utterance.toLowerCase())
                }            
              ]
            },
            InvalidInput: {
              entry: {
                type: "spst.speak",
                params: ({ context }) => ({
                  utterance: `Sorry, but I heard ${context.lastResult![0].utterance}. Please answer with yes or no.`,
                }),
              },
              on: { SPEAK_COMPLETE: "#DM.Main.AskAccept" },
            },
            Confirm: {
              entry: [
                {
                  type: "spst.speak",
                  params: { utterance: `Glad to hear that! Let's go!` },
                },
              ],
              on: { SPEAK_COMPLETE: "#DM.Main.HumansStatement" },
            },
          },
        },
        HumansStatement: { 
          entry: { type: "spst.speak", params: { utterance: humansStatement } },
          on: { SPEAK_COMPLETE: "AskHumans" },
        },
        AskHumans: {
          initial: "Prompt",
          on: {
            LISTEN_COMPLETE: {
              target: ".Validate",
              guard: ({ context }) => !!context.lastResult,
            },
          },
          states: {
             Prompt: {
              entry: [
                {
                  type: "spst.speak",
                  params: ({ context }) => ({
                    utterance: eval(`promptHumans${context.silCount}`),
                  }),
                },
              ],
              on: { SPEAK_COMPLETE: "Listen" },
            },
            Listen: {
              entry: { type: "spst.listen" },
            },
            Validate: {
              always: [
                {
                  // If utterance is not a valid number, go to InvalidInput
                  target: "InvalidInput",
                  guard: ({ context }) => isNaN(Number(context.lastResult![0].utterance)) || context.lastResult![0].utterance.trim() === "",
                },
                {
                  // If valid, proceed normally
                  target: "Confirm",
                  actions: assign(({ context }) => ({ 
                    numHumans: Number(context.lastResult![0].utterance),
                  })),
                },
              ],
            },
            InvalidInput: {
              entry: {
                type: "spst.speak",
                params: ({ context }) => ({
                  utterance: `Sorry, but I heard ${context.lastResult![0].utterance}. Please answer with a number.`,
                }),
              },
              on: { SPEAK_COMPLETE: "#DM.Main.AskHumans" },
            },
            Confirm: {
              entry: [
                {
                  type: "spst.speak",
                  params: ({ context }) => ({
                    utterance: `Ok ${context.numHumans} human operatives.`,
                  }),
                },
              ],
              on: { SPEAK_COMPLETE: "#DM.Main.PetsStatement" },
            },
          },
        },
        PetsStatement: { 
          entry: { type: "spst.speak", params: { utterance: petsStatement } },
          on: { SPEAK_COMPLETE: "AskPets" },
        },
        AskPets: {
          initial: "Prompt",
          on: {
            LISTEN_COMPLETE: {
              target: ".Validate",
              guard: ({ context }) => !!context.lastResult,
            },
          },
          states: {
             Prompt: {
              entry: [
                {
                  type: "spst.speak",
                  params: ({ context }) => ({
                    utterance: eval(`promptPets${context.silCount}`),
                  }),
                },
              ],
              on: { SPEAK_COMPLETE: "Listen" },
            },
            Listen: {
              entry: { type: "spst.listen" },
            },
            Validate: {
              always: [
                {
                  // If utterance is not a valid number, go to InvalidInput
                  target: "InvalidInput",
                  guard: ({ context }) => isNaN(Number(context.lastResult![0].utterance)) || context.lastResult![0].utterance.trim() === "",
                },
                {
                  // If valid, proceed normally
                  target: "Confirm",
                  actions: assign(({ context }) => ({ 
                    numPets: Number(context.lastResult![0].utterance),
                  })),
                },
              ],
            },
            InvalidInput: {
              entry: {
                type: "spst.speak",
                params: ({ context }) => ({
                  utterance: `Sorry, but I heard ${context.lastResult![0].utterance}. Please answer with a number.`,
                }),
              },
              on: { SPEAK_COMPLETE: "#DM.Main.AskPets" },
            },
            Confirm: {
              entry: [
                {
                  type: "spst.speak",
                  params: ({ context }) => ({
                    utterance: `Copy that, agent ${context.nameResult}, we have ${context.numHumans} humans and ${context.numPets} trusted pets.`,
                  }),
                },
              ],
              on: { SPEAK_COMPLETE: "#DM.Main.WaterMissionStatement" },
            },
          },
        },
        WaterMissionStatement: { 
          entry: { type: "spst.speak", params: { utterance: waterStatement } },
          on: { SPEAK_COMPLETE: "#DM.Main.WaterMission" },
        },
        WaterMission: {
          initial: "Prompt",
          on: {
            LISTEN_COMPLETE: {
              target: ".Validate",
              guard: ({ context }) => !!context.lastResult,
            },
          },
          states: {
             Prompt: {
              entry: [
               {
                  type: "spst.speak",
                  params: ({ context }) => ({
                    utterance: eval(`promptWater${context.silCount}`),
                  }),
                },
              ],
              on: { SPEAK_COMPLETE: "Listen" },
            },
            Listen: {
              entry: { type: "spst.listen" },
            },
            Validate: {
              always: [
                {
                  // If utterance is not a valid number, go to InvalidInput
                  target: "InvalidInput",
                  guard: ({ context }) => isNaN(Number(context.lastResult![0].utterance)) || context.lastResult![0].utterance.trim() === "",
                },
                {
                  // If valid, proceed normally
                  target: "Confirm",
                  actions: assign(({ context }) => ({ 
                    userGuess: Number(context.lastResult![0].utterance),
                  })),
                },
              ],
            },
            InvalidInput: {
              entry: {
                type: "spst.speak",
                params: ({ context }) => ({
                  utterance: `Sorry, but I heard ${context.lastResult![0].utterance}. Please answer with a number.`,
                }),
              },
              on: { SPEAK_COMPLETE: "#DM.Main.WaterMission" },
            },
            Confirm: {
              entry: [
                assign({ 
                  waterRequired: ({ context }) => calculateWater(context.numHumans, context.numPets)
                }),
                {
                  type: "spst.speak",
                  params: ({ context }) => {
                    const userGuess = Number(context.userGuess);
                    const waterRequired = Number(context.waterRequired);
                    const tolerance = 0.1 * waterRequired;
                    let utterance: string;
            
                    if (userGuess === waterRequired) {
                      context.waterBadge = "3";
                      utterance = `Exactly correct, agent ${context.nameResult}! You guessed ${context.userGuess} liters, which is exactly right.`;
                    } else if (Math.abs(userGuess - waterRequired) <= tolerance) {
                      context.waterBadge = "2";
                      utterance = `Pretty good, agent ${context.nameResult}! The correct calculation was ${context.waterRequired}, but your guess of ${context.userGuess} liters is within our tolerance range.`;
                    } else if (userGuess > waterRequired) {
                      context.waterBadge = "1";
                      utterance = `Not so good, agent ${context.nameResult}. Your guess was ${context.userGuess} liters, but the correct amount is ${context.waterRequired} liters. Too much water is better than too little, but it takes up space to store more than you need!`;
                    } else {
                      context.waterBadge = "1";  
                      utterance = `Not so good, agent ${context.nameResult}. Your guess was ${context.userGuess} liters, but the correct amount is ${context.waterRequired} liters. Make sure you will have enough water in the future!`;
                    }       
                    return { utterance };
                  }         
                },
              ],
              on: { SPEAK_COMPLETE: "#DM.Main.QuestSummary" },
            },
          },
        },
        QuestSummary: {
          entry: {
            type: "spst.speak",
            params: ({ context }) => {
             let utterance: string;
      
              if (context.waterBadge === "3") {
                utterance = `That's the end of our quest, agent ${context.nameResult}! You completed the water mission which earned you the Master of Hydration badge. Good work!`;
              } else if (context.waterBadge === "2") {
                utterance = `That's the end of our quest, agent ${context.nameResult}! You completed the water mission which earned you the Certified Hydration Responder badge. Keep it up!`;
              } else {
                utterance = `That's the end of our quest, agent ${context.nameResult}! You completed the water mission which earned you the Trainee Hydration Handler badge. You can do better!`;
              }           
              return { utterance };
            }         
          },
          on: { SPEAK_COMPLETE: "#DM.Main.Done" },
        },
        AbortMission: {
          on: {
            CLICK: "#DM.Greeting",
          },
          entry: [
            () => console.log("ENTERING ABORT MISSION STATE"),
            assign({
              silCount: ({ context }) => (context.silCount = 0)
            }),
            { 
              type: "spst.speak", 
              // Problem: the utterance below is not played --- WHY?
              params: { utterance: "Mission aborted!" }
            },
          ],
        },
        Done: {
          on: {
            CLICK: "#DM.Greeting",
          },
          entry: { 
            type: "spst.speak", 
            params: { utterance: `Thank you for playing! Over and out!` }
          },
        },
 
      },
    },
  },
  })
  
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
  };
  