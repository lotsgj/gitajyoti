// @ts-check
import { button } from "../core/ui/button.js";
import { passwordField, profileEditor, usernameField } from "../features/identity/index.js";

export function signInPage(){return `<section class="auth-page"><div class="dipa" aria-hidden="true"><span>दी</span><i></i></div><div class="auth-panel panel"><p class="eyebrow">Welcome back</p><h1>Sign in to MyGita</h1><p>Continue with your experiences and learning journey.</p><form class="form-grid" data-form="password-login">${usernameField()}${passwordField("password","Password","current-password")}<p class="form-error" data-form-error role="alert" hidden></p>${button({label:"Sign in",type:"submit"})}</form><p class="auth-alternative">New to MyGita? <a class="text-link" href="#/auth/create">Create an account</a></p></div></section>`;}

export function createAccountPage(){return `<section class="auth-step panel"><p class="eyebrow">Your MyGita space</p><h1>Create an account</h1><p>Create a private place to join experiences and continue your learning. Mobile number and email are not required.</p><form class="form-grid" data-form="password-account">${usernameField({label:"Choose a username",withHelp:true})}${passwordField("password","Create a password","new-password","Use a memorable phrase of at least 15 characters.")}${passwordField("confirmPassword","Confirm password","new-password")}<p class="form-error" data-form-error role="alert" hidden></p>${button({label:"Create my account",type:"submit"})}</form><p class="auth-alternative">Already have an account? <a class="text-link" href="#/auth">Sign in</a></p></section>`;}

export function onboardingPage(profile={}){return profileEditor(profile,{afterRegistration:true});}
