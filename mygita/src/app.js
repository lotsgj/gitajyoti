// @ts-check
import { setDocumentTitle } from "./core/dom.js";
import { defineRoute, navigate, startRouter } from "./core/router.js";
import { identityRepository } from "./features/identity/index.js";
import { journeyRepository } from "./features/journey/index.js";
import { activityPage, sessionPage } from "./pages/activity-page.js";
import { authMethodsPage, mobilePage, onboardingPage, otpPage } from "./pages/authentication-page.js";
import { discoverPage } from "./pages/discover-page.js";
import { enrolPage, confirmationPage } from "./pages/enrolment-page.js";
import { experiencePage } from "./pages/experience-page.js";
import { journeyPage } from "./pages/journey-page.js";
import { profilePage } from "./pages/profile-page.js";
import { reviewPage } from "./pages/review-page.js";
import { systemPage } from "./pages/system-page.js";
import { renderShell } from "./shell/app-shell.js";

const rootElement=document.querySelector("#app");
if(!(rootElement instanceof HTMLElement))throw new Error("My Gita application root was not found.");
const root=rootElement;

/** @param {{title:string,content:string,route:string}} view */
async function render({title,content,route}){const user=await identityRepository.getCurrentUser();const outlet=renderShell(root,user);setDocumentTitle(title);outlet.innerHTML=content;outlet.focus({preventScroll:true});}
async function loadRoute(title,path,content){await render({title,content:systemPage("loading"),route:path});try{await render({title,content:await content()||systemPage("not-found"),route:path});}catch(error){console.error(error);await render({title:"Something went wrong",content:systemPage(navigator.onLine?"error":"offline"),route:path});}}
function page(title,content){return ({path})=>loadRoute(title,path,()=>typeof content==="function"?content():content);}
function feature(title,factory){return ({path,params})=>loadRoute(title,path,()=>factory(params));}

defineRoute("/discover",page("Discover",discoverPage));
defineRoute("/experience/:slug",feature("Experience",params=>experiencePage(params.slug)));
defineRoute("/experience/:slug/enrol",feature("Choose your path",params=>enrolPage(params.slug)));
defineRoute("/experience/:slug/enrolled",feature("Enrolment confirmed",params=>confirmationPage(params.slug,"enrol")));
defineRoute("/experience/:slug/interested",feature("Interest registered",params=>confirmationPage(params.slug,"interest")));
defineRoute("/auth",page("Sign up or sign in",authMethodsPage));
defineRoute("/auth/mobile",page("Your mobile number",mobilePage));
defineRoute("/auth/otp",page("Verify OTP",()=>otpPage(sessionStorage.getItem("mygita.pending.mobile")||"")));
defineRoute("/onboarding",page("Complete your profile",async()=>onboardingPage((await identityRepository.getCurrentUser())?.personalDetails)));
defineRoute("/journey",page("My Journey",journeyPage));
defineRoute("/activity/:id",feature("Activity",params=>activityPage(params.id)));
defineRoute("/activity/:id/session",feature("Activity session",params=>sessionPage(params.id)));
defineRoute("/profile",page("Profile",profilePage));
defineRoute("/states/:type",feature("System state",params=>systemPage(params.type)));
defineRoute("/review",page("Prototype screen map",reviewPage));
defineRoute("/not-found",({path})=>render({title:"Page not found",content:systemPage("not-found"),route:path}));

document.addEventListener("click",async event=>{const target=event.target;if(!(target instanceof Element))return;const action=target.closest("[data-action]");if(!(action instanceof HTMLElement))return;const name=action.dataset.action;if(name==="toggle-menu"||name==="toggle-mobile-menu"){const menu=document.getElementById(name==="toggle-menu"?"account-menu":"mobile-menu");if(!menu)return;const opening=menu.hidden;menu.hidden=!opening;action.setAttribute("aria-expanded",String(opening));}if(name==="sign-out"){await Promise.all([identityRepository.signOut(),journeyRepository.reset()]);navigate("/discover");}if(name==="reset-fixtures"){await Promise.all([identityRepository.reset(),journeyRepository.reset()]);navigate("/review");}});

document.addEventListener("submit",async event=>{const target=event.target;if(!(target instanceof HTMLFormElement)||!target.matches("form[data-form]"))return;event.preventDefault();const form=target;const data=Object.fromEntries(new FormData(form));const type=form.dataset.form;const error=form.querySelector("[data-form-error]");if(type==="mobile"){sessionStorage.setItem("mygita.pending.mobile",String(data.mobile||""));navigate("/auth/otp");}if(type==="otp"){if(data.otp!=="123456"){if(error instanceof HTMLElement){error.textContent="Use prototype OTP 123456.";error.hidden=false;}return;}navigate("/onboarding");}if(type==="onboarding"){await identityRepository.signIn(data);const destination=sessionStorage.getItem("mygita.pending.destination")||"/discover";sessionStorage.removeItem("mygita.pending.destination");navigate(destination);}if(type==="enrol"){if(!await identityRepository.getCurrentUser()){sessionStorage.setItem("mygita.pending.destination",`/experience/${form.dataset.slug}/enrol`);navigate("/auth");return;}await journeyRepository.enrol(String(form.dataset.experience),String(data.batchId||""));navigate(`/experience/${form.dataset.slug}/enrolled`);}if(type==="interest"){if(!await identityRepository.getCurrentUser()){sessionStorage.setItem("mygita.pending.destination",`/experience/${form.dataset.slug}/enrol`);navigate("/auth");return;}await journeyRepository.registerInterest(String(form.dataset.experience));navigate(`/experience/${form.dataset.slug}/interested`);}if(type==="complete-activity"){await journeyRepository.completeActivity(String(form.dataset.activity));navigate(`/activity/${form.dataset.activity}/session`);}if(type==="profile"){await identityRepository.updateProfile(data);await render({title:"Profile",content:await profilePage(),route:"/profile"});const notice=document.querySelector("[data-profile-notice]");if(notice instanceof HTMLElement)notice.hidden=false;}});

window.addEventListener("unhandledrejection",event=>{console.error(event.reason);void render({title:"Something went wrong",route:"error",content:systemPage("error")});});
startRouter();
