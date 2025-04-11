import { Hypothesis, SpeechStateExternalEvent } from "speechstate";
import { AnyActorRef } from "xstate";
/*
export interface DMContext {
  spstRef: AnyActorRef;
  lastResult: Hypothesis[] | null;
  nameResult: string | "";
  dayResult: string | "";
  timeResult: string | "";
  silCount: number;
  numHumans: number;
  numPets: number;
  waterRequired: number;
  userGuess: number;
  waterBadge: string | "";
  // nluIntent: string | "";
  // nluEntities: Hypothesis[] | null;
}
*/

export interface DMContext {
  spstRef: AnyActorRef;
  lastResult: Hypothesis[] | null;
  nameResult: string;
  dayResult: string;
  timeResult: string;
  nluIntent: string;
  nluEntities: Hypothesis[] | null;
  isNameValid: boolean;
}

export type DMEvents = SpeechStateExternalEvent | { type: "CLICK" } | {type: "DONE"};
