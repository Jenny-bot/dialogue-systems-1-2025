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
  // Adding autorization token for the STT
  authorizationToken: "eyJhbGciOiJFUzI1NiIsImtpZCI6ImtleTEiLCJ0eXAiOiJKV1QifQ.eyJyZWdpb24iOiJub3J0aGV1cm9wZSIsInN1YnNjcmlwdGlvbi1pZCI6IjZhYTQ2MzQ4YWM4ZTQ0MDc4NDUxNTNiOWZmYzJiOTFjIiwicHJvZHVjdC1pZCI6IlNwZWVjaFNlcnZpY2VzLkYwIiwiY29nbml0aXZlLXNlcnZpY2VzLWVuZHBvaW50IjoiaHR0cHM6Ly9hcGkuY29nbml0aXZlLm1pY3Jvc29mdC5jb20vaW50ZXJuYWwvdjEuMC8iLCJhenVyZS1yZXNvdXJjZS1pZCI6Ii9zdWJzY3JpcHRpb25zLzEzMTRkNmM4LTQ4YTAtNDkwMC05YjE2LTM2ZDY1MDgzYzZiMC9yZXNvdXJjZUdyb3Vwcy9EU19sYWJzL3Byb3ZpZGVycy9NaWNyb3NvZnQuQ29nbml0aXZlU2VydmljZXMvYWNjb3VudHMvRFNzcGVlY2giLCJzY29wZSI6InNwZWVjaHNlcnZpY2VzIiwiYXVkIjoidXJuOm1zLnNwZWVjaHNlcnZpY2VzLm5vcnRoZXVyb3BlIiwiZXhwIjoxNzQxNTQ5OTM5LCJpc3MiOiJ1cm46bXMuY29nbml0aXZlc2VydmljZXMifQ.z4KotPEDFvQJDjXOHxluEwxxxtv-bbeYT7y7MnpekzQYLy11e6iHpLosCXS6IbDDaYSM3LVSBg3XPMypzCLFkw",
};

const azureLanguageCredentials = {
  endpoint:
    "https://nlu-resource.cognitiveservices.azure.com/language/:analyze-conversations?api-version=2024-11-15-preview",
  key: NLU_KEY,
  deploymentName: "appointment1",
  projectName: "jw-nlu-project",
};


const settings: Settings = {
  azureLanguageCredentials: azureLanguageCredentials /** global activation of NLU */,
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
const yesPhrases = ["yes", "sure", "of course", "absolutely", "indeed", "aye"];
const noPhrases = ["no", "nope", "nah", "negative", "nay", "not really"];
const personInfo: {[index: string]: string} = {
  "michael jackson": "Michael Jackson is a singer, songwriter, and dancer. He is often referred to as the 'King of Pop'.",
  "madonna": "Madonna is a singer, songwriter, and actress. She is often referred to as the 'Queen of Pop'.",
  "mother teresa": "Mother Teresa was a Roman Catholic nun and missionary. She devoted her life to helping the poor and sick in India and was awarded the Nobel Peace Prize in 1979.",
  "vic": "",
};

function isInGrammar(utterance: string) {
  return utterance.toLowerCase() in grammar;
}

function getPerson(utterance: string) {
  return (grammar[utterance.toLowerCase()] || {}).person;
}

function validateDay(utterance: string) {
  return validDay.includes(utterance.toLowerCase());
}

function isYes(utterance: string) {
  return yesPhrases.includes(utterance.toLowerCase());
}

function isNo(utterance: string) {
  return noPhrases.includes(utterance.toLowerCase());
}

function getPersonInfo(person: string): string {
  return personInfo[person.toLowerCase()];
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
// The createMachine function initialises the state machine with the context and the initial state.
// The context includes a reference to a spawned speechstate machine, and a lastResult property initialised to null.
// The machine is identified by the ID "DM" and the initial state is the "Prepare" state.
}).createMachine({
  context: ({ spawn }) => ({
    spstRef: spawn(speechstate, { input: settings }),
    lastResult: null,
    // The nameResult property that I added in the context is initialised to null.
    nameResult: "",
    dayResult: "",
    timeResult: "",
    nluIntent: "",
    nluEntities: null
  }),
  id: "DM",
  initial: "Prepare",
  states: {
  
    // The Prepare state sends a "PREPARE" event to spstRef upon entry and transitions to WaitToStart when an "ASRTTS_READY" event occurs.
    Prepare: {
      entry: ({ context }) => context.spstRef.send({ type: "PREPARE" }),
      on: { ASRTTS_READY: "WaitToStart" },
    },
    WaitToStart: {
      on: { CLICK: "Greeting" },
    },

    // This is a simple state with a short hi and introduction to the appointment creation process
    Greeting: {
      entry: { 
        type: "spst.speak", 
        params: { utterance: `Hi NLU!` } 
      },
      // When TTS output is complete, transition to the AskWhat (NLU) state
      on: { SPEAK_COMPLETE: "AskWhat" },
    }, 

    AskWhat: {
      // On entry, PromptForWhat is where to start 
      initial: "PromptForWhat",
      on: {
        // Event after the ASR has finished listening
        LISTEN_COMPLETE: [
          {
            // Something was recognised, transition to ValidateInput
            target: ".ValidateInput",
            guard: ({ context }) => !!context.lastResult,
          },
          { target: ".NoInput" },
        ],
      },
      states: {
       PromptForWhat: {
          entry: { type: "spst.speak", params: { utterance: `What can I help you with?` } },
          on: { SPEAK_COMPLETE: "Listen" },
        },
         // If silence, no user speech detected, transition to NoInput state
        NoInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: `Sorry, I didn't hear anything!` },
          },
          on: { SPEAK_COMPLETE: "PromptForWhat" },
        },
        InvalidInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: `Sorry, I didn't understand that. You can ask to make an appointment or ask about a person.` },
          },
          on: { SPEAK_COMPLETE: "PromptForWhat" },
        },
        ValidInput: {
          entry: [
            () => console.log("VALID INPUT ENTERED!!!!!: "),
            {type: "spst.speak", params: { utterance: `All right, let's go!` } },
          ], 
          on: { 
            SPEAK_COMPLETE: [
              { 
                target: "#DM.AskName",
                guard: ({ context }) => context.nluIntent === "CreateMeeting",
              },
              { 
                target: "#DM.WhoIs",
                guard: ({ context }) => context.nluIntent === "WhoIs",
              },
            ]
          },
        },
        ValidateInput: {
          always: [
            {
              // If there was a an intent recognised, transition to ValidInput state
              target: "ValidInput",
              guard: ({ context }) => context.nluIntent !== "None",
            },            
            {
              // If there was not an intent recognised, transition to InvalidInput state
              target: "InvalidInput",
              guard: ({ context }) => context.nluIntent === "None",
            }
          ]        
        },
        // Listen for user speech
        Listen: {
          entry: [
            () => console.log("USING NLU!"),{ 
            type: "spst.listenNLU", 
          },
        ],
          on: {
            RECOGNISED: {
              actions: assign(({ context, event }) => {
                // console.log("NLU EVENT TESTING!!!!!!!!: ", event.nluValue);
                console.log("NLU ENTITIES TESTING!!!!!!!!: ", event.nluValue.entities);
                // console.log("NLU EVENT TESTING FOR NAME IN ARRAY!!!!!!!!: ", event.nluValue.entities![0].text);

                // Extract the entities array from the NLU event
                const entities = event.nluValue.entities || [];

                let updates: Partial<typeof context> = {};

                // Iterate over the entities array
                for (let entity of entities) {
                  console.log("GOING THROUGH ENTITIES!!! ", entity.text);
                  if (entity.category === 'personName') {
                    console.log("PERSON NAME DETECTED: ", entity.text);
                    updates.nameResult = entity.text;
                  } else if (entity.category === 'apptTime') {
                    console.log("APPOINTMENT TIME DETECTED: ", entity.text);
                    updates.timeResult = entity.text;
                  } else if (entity.category === 'apptDay') {
                    console.log("APPOINTMENT DAY DETECTED: ", entity.text);
                    updates.dayResult = entity.text;
                  }
                }
                // Do I even need this return?
                return { 
                  ...context,
                  ...updates,
                  lastResult: event.nluValue,
                  nluIntent: event.nluValue.topIntent,
                  nluEntities: event.nluValue.entities,
                 };
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ lastResult: null }),
            },
          },
        },
      },
    },

    WhoIs: {
      entry: [
       {
          type: "spst.speak",
          params: ({ context }) => {
            const name = context.nameResult ?? "Unknown";
            const personDescription = personInfo[name.toLowerCase()] || "I couldn't find any information.";

            return {
            utterance: context.nameResult === ""
            ? `Sorry, ${personDescription} I can only give information if I have the name of a person.`
            : `ok, you want to know about ${context.nameResult}. ${personDescription}`,
            };
          },
        }
      ],
      on: { SPEAK_COMPLETE: "#DM.Done" },
    },



    // context.lastResult![0].utterance

    // The AskName state is where the user is prompted to say the name of the person they are meeting with.
    AskName: {
      // On entry, PromptForName is where to start 
      initial: "CheckForName",
       on: {
        // Event after the ASR has finished listening
        LISTEN_COMPLETE: [
          {
            // Something was recognised, transition to ValidateInput
            target: ".ValidateInput",
            guard: ({ context }) => (!!context.nameResult || !!context.lastResult![0].utterance),
          },
          { target: ".NoInput" },
        ],
      },
      states: {
       CheckForName: {
        always: [
          {
            target: "ValidateInput",
            guard: ({ context }) => context.nameResult !== "",
          },
          {
            target: "PromptForName",
          },
        ],
       },
       PromptForName: {
          entry: { type: "spst.speak", params: { utterance: `Who are you meeting with?` } },
          on: { SPEAK_COMPLETE: "Listen" },
        },
        // If silence, no user speech detected, transition to NoInput state
        NoInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: `Sorry, I didn't hear anything!` },
          },
          on: { SPEAK_COMPLETE: "PromptForName" },
        },
        InvalidInput: {
          entry: {
            type: "spst.speak",
            params: ({ context }) => ({
              utterance: `sorry, but there does not seem to be a person with the name  ${context.nameResult} in our system.`,
            }),
          },
          on: { SPEAK_COMPLETE: "PromptForName" },
        },
        ValidInput: {
          entry: [
          {
            type: "spst.speak",
            params: ({ context }) => ({
              utterance: context.nameResult === "Unknown"
              ? `Sorry, I did not recognise that name.`
              : `ok, you are meeting with ${context.nameResult}`,
            }),
          }
        ],
          on: { 
            SPEAK_COMPLETE: [
              {
              target: "#DM.AskName",
              guard: ({ context }) => context.nameResult === "Unknown",
              },
              { 
              target: "#DM.AskDay",
              guard: ({ context }) => context.nameResult !== "Unknown",
              }
            ]
          },
        },
        ValidateInput: {
          entry: [
            assign({
              nameResult: ({ context }) => {
                const person = (getPerson(context.nameResult) || getPerson(context.lastResult![0].utterance));
                return person || "Unknown";
              },
            }),
          ], 
          always: [
            {
              // If the name is in the grammar, transition to ValidInput state
              target: "ValidInput",
              guard: ({ context }) => context.nameResult !== "Unknown"
            },
            {
              // If the name is not in the grammar, transition to InvalidInput state
              target: "InvalidInput",
              guard: ({ context }) => context.nameResult === "Unknown"
            }
          ]    
        },
        // Listen for user speech
        Listen: {
          entry: [
            () => console.log("USING Regular ASR!"),{ 
            type: "spst.listen", 
          },
        ],
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { lastResult: event.value };
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ lastResult: null }),
            },          
          },
        },
      },
    },
    AskDay: {
      // On entry, PromptForDay is where to start 
      initial: "CheckForDay",
      on: {
        // Event after the ASR has finished listening
        LISTEN_COMPLETE: [
          {
            // Something was recognised, transition to CheckGrammarName
            target: ".ValidateInput",
            guard: ({ context }) => (!!context.dayResult || !!context.lastResult![0].utterance),
          },
          { target: ".NoInput" },
        ],
      },
      states: {
          CheckForDay: {
          always: [
            {
              target: "#DM.AskFullDay",
              guard: ({ context }) => context.dayResult !== "",
            },
            {
              target: "PromptForDay",
            },
          ],
         },
        PromptForDay: {
          entry: { type: "spst.speak", params: { utterance: `On which day is your meeting?` } },
          on: { SPEAK_COMPLETE: "Listen" },
        },
        // If silence, no user speech detected, transition to NoInput state
        NoInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: `Sorry, I didn't hear anything!` },
          },
          on: { SPEAK_COMPLETE: "PromptForDay" },
        },
        InvalidDay: {
          entry: {
            type: "spst.speak",
            params: ({ context }) => ({
              utterance: `sorry, but ${context.lastResult![0].utterance} is not a valid weekday name.`,
            }),
          },
          on: { SPEAK_COMPLETE: "PromptForDay" },
        },
        InvalidInput: {
          entry: {
            type: "spst.speak",
            params: ({ context }) => ({
              utterance: `sorry, but ${context.lastResult![0].utterance} does not seem to be a bookable day in our system.`,
            }),
          },
          on: { SPEAK_COMPLETE: "PromptForDay" },
        },
        ValidInput: {
          entry: [
            assign({ 
              dayResult: ({ context }) => (context.lastResult![0].utterance) || "Unknown"
            }),

          {
            type: "spst.speak",
            params: ({ context }) => ({
              utterance: `ok, your meeting is on ${context.dayResult}`,
            }),
          }
        ],
          on: { SPEAK_COMPLETE: "#DM.AskFullDay" },
        },
        ValidateInput: {
          always: [
            {
              // If the day is not a valid weekday, transition to InvalidDay
              target: "InvalidDay",
              guard: ({ context }) => !validateDay(context.lastResult![0].utterance)
            },
            {
              // If the day is in the grammar, transition to ValidInput state
              target: "ValidInput",
              guard: ({ context }) => validateDay(context.lastResult![0].utterance) && isInGrammar(context.lastResult![0].utterance)
            },
            {
              // If the day is not in the grammar, transition to InvalidInput state
              target: "InvalidInput",
              guard: ({ context }) => validateDay(context.lastResult![0].utterance) && !isInGrammar(context.lastResult![0].utterance)
            }
          ]        
        },
        // Listen for user speech
        Listen: {
          entry: { 
            type: "spst.listen" 
          },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { lastResult: event.value };
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ lastResult: null }),
            },
          },
        },
      },
    },
    AskFullDay: {
      // On entry, PromptForYesNo is where to start 
      initial: "CheckForTime",
      on: {
        // Event after the ASR has finished listening
        LISTEN_COMPLETE: [
          {
            // Something was recognised, transition to CheckGrammarName
            target: ".ValidateInput",
            guard: ({ context }) => (!!context.timeResult || !!context.lastResult![0].utterance),
          },
          { target: ".NoInput" },
        ],
      },
      states: {
        CheckForTime: {
          always: [
            {
              target: "#DM.AskTime",
              guard: ({ context }) => context.timeResult !== "",
            },
            {
              target: "PromptForYesNo",
            },
          ],
         },
        PromptForYesNo: {
          entry: { type: "spst.speak", params: { utterance: `Will it take the whole day?` } },
          on: { SPEAK_COMPLETE: "Listen" },
        },
        // If silence, no user speech detected, transition to NoInput state
        NoInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: `Sorry, I didn't hear anything!` },
          },
          on: { SPEAK_COMPLETE: "PromptForYesNo" },
        },
        InvalidYesNo: {
          entry: {
            type: "spst.speak",
            params: ({ context }) => ({
              utterance: `sorry, but ${context.lastResult![0].utterance} is not a yes or no response.`,
            }),
          },
          on: { SPEAK_COMPLETE: "PromptForYesNo" },
        },
        InvalidInput: {
          entry: {
            type: "spst.speak",
            params: ({ context }) => ({
              utterance: `sorry, but I heard ${context.lastResult![0].utterance}. Please answer with yes or no.`,
            }),
          },
          on: { SPEAK_COMPLETE: "PromptForYesNo" },
        },
        WholeDay: {
          entry: [
            assign({ 
              timeResult: ({ context }) => (context.timeResult = "whole day")
            }),
          {
            type: "spst.speak",
            params: ({ context }) => ({
              utterance: `ok, ${context.timeResult}`,
            }),
          }
        ],
          on: { SPEAK_COMPLETE: "#DM.AskConfirm" },
        },
        ValidateInput: {
          always: [
            {
              // If the utterance is a (normalised) "no", transition to GetTime
              target: "#DM.AskTime",
              guard: ({ context }) => {
                if (isNo(context.lastResult![0].utterance.toLowerCase())) {
                  return true;
                }
              return false;
              }              
            },
            {
              // If the utterance is a (normalised) "yes", update
              target: "WholeDay",
              guard: ({ context }) => {
                if (isYes(context.lastResult![0].utterance.toLowerCase())) {
                  return true;
                }
              return false;
              }              
              },
            {
              // If the day is not in the grammar, transition to InvalidInput state
              target: "InvalidInput",
              guard: ({ context }) => !isNo(context.lastResult![0].utterance.toLowerCase()) || !isYes(context.lastResult![0].utterance.toLowerCase())    
            }
          ]        
        },
        // Listen for user speech
        Listen: {
          entry: { 
            type: "spst.listen" 
          },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { lastResult: event.value };
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ lastResult: null }),
            },
          },
        },
      },
    },
    AskTime: {
      // On entry, PromptForTime is where to start 
      initial: "CheckForTime",
      on: {
        // Event after the ASR has finished listening
        LISTEN_COMPLETE: [
          {
            // Something was recognised, transition to ValidateInput
            target: ".ValidateInput",
            guard: ({ context }) => (!!context.timeResult || !!context.lastResult![0].utterance),
          },
          { target: ".NoInput" },
        ],
      },
      states: {
        CheckForTime: {
          always: [
            {
              target: "ValidateInput",
              guard: ({ context }) => context.timeResult !== "",
            },
            {
              target: "PromptForTime",
            },
          ],
         },
        PromptForTime: {
          entry: { type: "spst.speak", params: { utterance: `What time is your meeting?` } },
          on: { SPEAK_COMPLETE: "Listen" },
        },
        // If silence, no user speech detected, transition to reprompt for time
        NoInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: `Sorry, I didn't hear anything!` },
          },
          on: { SPEAK_COMPLETE: "PromptForTime" },
        },
        InvalidTime: {
          entry: {
            type: "spst.speak",
            params: ({ context }) => ({
              utterance: `sorry, but ${context.lastResult![0].utterance} is not a valid time.`,
            }),
          },
          on: { SPEAK_COMPLETE: "PromptForTime" },
        },
        InvalidInput: {
          entry: {
            type: "spst.speak",
            params: ({ context }) => ({
              utterance: `sorry, but ${context.lastResult![0].utterance} does not seem to be a bookable time in our system.`,
            }),
          },
          on: { SPEAK_COMPLETE: "PromptForTime" },
        },
        ValidInput: {
          entry: [
            assign({ 
              timeResult: ({ context }) => context.timeResult || (context.lastResult![0].utterance) || "Unknown"
            }),

          {
            type: "spst.speak",
            params: ({ context }) => ({
              utterance: `ok, ${context.timeResult}`,
            }),
          }
        ],
          on: { SPEAK_COMPLETE: "#DM.AskConfirm" },
        },
        ValidateInput: {
          always: [
             {
              // If the day is in the grammar, transition to ValidInput state
              target: "ValidInput",
              guard: ({ context }) => (isInGrammar(context.timeResult) || isInGrammar(context.lastResult![0].utterance)),
            },
            {
              // If the day is not in the grammar, transition to InvalidInput state
              target: "InvalidInput",
              guard: ({ context }) => (!isInGrammar(context.timeResult) || !isInGrammar(context.lastResult![0].utterance)),
            }
          ]        
        },
        // Listen for user speech
        Listen: {
          entry: { 
            type: "spst.listen" 
          },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { lastResult: event.value };
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ lastResult: null }),
            },
          },
        },
      },
    },

  AskConfirm: {
      // On entry, PromptForYesNo is where to start 
      initial: "PromptForYesNo",
      on: {
        // Event after the ASR has finished listening
        LISTEN_COMPLETE: [
          {
            // Something was recognised, transition to CheckGrammarName
            target: ".ValidateInput",
            guard: ({ context }) => !!context.lastResult,
          },
          { target: ".NoInput" },
        ],
      },
      states: {
        //utterance: `Do you want me to create an appointment with ${context.nameResult} on Result}? ${context.timeResult === 'morning' ? 'I will make sure it is before noon.' : 'I will make sure it is in the afternoon.'}`
        PromptForYesNo: {
          entry: { type: "spst.speak", 
            params: ({ context }) => ({ 
              utterance: `Do you want me to create an appointment with ${context.nameResult} on ${context.dayResult} ${context.timeResult === 'whole day' ? 'for the whole day' : `at ${context.timeResult}`}?`  
            }),
          },
          on: { SPEAK_COMPLETE: "Listen" },
        },
        // If silence, no user speech detected, transition to NoInput state
        NoInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: `Sorry, I didn't hear anything!` },
          },
          on: { SPEAK_COMPLETE: "PromptForYesNo" },
        },
        InvalidYesNo: {
          entry: {
            type: "spst.speak",
            params: ({ context }) => ({
              utterance: `sorry, but ${context.lastResult![0].utterance} is not a yes or no response.`,
            }),
          },
          on: { SPEAK_COMPLETE: "PromptForYesNo" },
        },
        InvalidInput: {
          entry: {
            type: "spst.speak",
            params: ({ context }) => ({
              utterance: `sorry, but I heard ${context.lastResult![0].utterance}. Please answer with yes or no.`,
            }),
          },
          on: { SPEAK_COMPLETE: "PromptForYesNo" },
        },
        WholeDay: {
          entry: [
            assign({ 
              timeResult: ({ context }) => (context.timeResult = "whole day")
            }),
          {
            type: "spst.speak",
            params: ({ context }) => ({
              utterance: `ok, ${context.timeResult}`,
            }),
          }
        ],
          on: { SPEAK_COMPLETE: "#DM.DoneMeeting" },
        },
        ValidateInput: {
          always: [
            {
              // If the utterance is a (normalised) "no", transition to GetTime
              target: "#DM.AskName",
              guard: ({ context }) => {
                if (isNo(context.lastResult![0].utterance.toLowerCase())) {
                  return true;
                }
              return false;
              }              
            },
            {
              // If the utterance is a (normalised) "yes", update
              target: "#DM.DoneMeeting",
              guard: ({ context }) => {
                if (isYes(context.lastResult![0].utterance.toLowerCase())) {
                  return true;
                }
              return false;
              }              
              },
            {
              // If the day is not in the grammar, transition to InvalidInput state
              target: "InvalidInput",
              guard: ({ context }) => !isNo(context.lastResult![0].utterance.toLowerCase()) || !isYes(context.lastResult![0].utterance.toLowerCase())    
            }
          ]        
        },
        // Listen for user speech
        Listen: {
          entry: { 
            type: "spst.listen" 
          },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { lastResult: event.value };
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ lastResult: null }),
            },
          },
        },
      },
  },

    Done: {
      on: {
        CLICK: "Greeting",
      },
      entry: [
        assign({
          lastResult: null,
          nameResult: "",
          dayResult: "",
          timeResult: "",
          nluIntent: "",
          nluEntities: null
        }),
        { 
        type: "spst.speak", 
        params: { utterance: `Thank you for using Jenny's dialogue system lab! Goodbye!` } 
      },
    ],
    },
    DoneMeeting: {
      on: {
        CLICK: "Greeting",
      },
      entry: [
        assign({
          lastResult: null,
          nameResult: "",
          dayResult: "",
          timeResult: "",
          nluIntent: "",
          nluEntities: null
        }),
        { 
        type: "spst.speak", 
        params: { utterance: `Ok, your meeting has been set up! Goodbye!` } 
      },
    ],
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
