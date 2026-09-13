// @ts-check
import { profileEditor } from "../features/identity/index.js";
import { statusView } from "../core/components/status-view.js";
/** @param {{user?:any}} [options] */
export async function profilePage({user=null}={}){if(!user)return statusView({title:"Sign in to open My profile.",message:"Your personal details are available after you sign in.",action:{label:"Sign in",href:"#/auth"}});return profileEditor(user.personalDetails);}
