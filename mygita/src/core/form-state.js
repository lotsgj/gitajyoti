// @ts-check
import { userMessageForError } from "./errors.js";

/** @param {HTMLFormElement} form */
export function beginFormSubmission(form) {
  if(form.dataset.submitting==="true")return null;
  form.dataset.submitting="true";
  form.setAttribute("aria-busy","true");
  const submitters=[...form.querySelectorAll("button[type=submit]")].filter(button=>button instanceof HTMLButtonElement);
  const states=submitters.map(button=>({button,disabled:button.disabled,label:button.textContent||""}));
  for(const {button} of states){button.disabled=true;button.textContent=button.dataset.pendingLabel||"Please wait…";}
  const errorView=form.querySelector("[data-form-error]");
  if(errorView instanceof HTMLElement){errorView.textContent="";errorView.hidden=true;}
  return ()=>{
    form.dataset.submitting="false";
    form.removeAttribute("aria-busy");
    for(const {button,disabled,label} of states){button.disabled=disabled;button.textContent=label;}
  };
}

/** @param {HTMLFormElement} form @param {unknown} error */
export function showFormError(form,error) {
  const errorView=form.querySelector("[data-form-error]");
  if(!(errorView instanceof HTMLElement))return false;
  errorView.textContent=userMessageForError(error);
  errorView.hidden=false;
  errorView.setAttribute("role","alert");
  errorView.setAttribute("aria-live","assertive");
  errorView.setAttribute("tabindex","-1");
  errorView.focus({preventScroll:true});
  return true;
}
