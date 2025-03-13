import { Hypothesis, SpeechStateExternalEvent } from "speechstate";
import { AnyActorRef } from "xstate";

export interface DMContext {
  spstRef: AnyActorRef;
  lastResult: Hypothesis[] | null;
  nameResult: string | "";
  dayResult: string | "null";
  timeResult: string | "null";
  nluIntent: string | "null";
  nluEntities: Hypothesis[] | null;
}

export type DMEvents = SpeechStateExternalEvent | { type: "CLICK" } | {type: "DONE"};
