// @ts-check
import { userMessageForError } from "../errors.js";
import { statusView } from "./status-view.js";

/** @param {unknown} error @param {{online?:boolean}} options */
export function requestFailureView(error,{online=true}={}) {
  return statusView({
    eyebrow:online?"We could not load this page":"You appear to be offline",
    title:online?"Something interrupted the path.":"The path will wait for you.",
    message:online?userMessageForError(error):"Reconnect to the internet, then try again.",
    action:{label:"Try again",type:"button",attributes:'data-action="retry-route"'},
  });
}
