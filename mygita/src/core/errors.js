// @ts-check

/** @param {unknown} error */
export function errorCode(error) {
  return error&&typeof error==="object"?String(Reflect.get(error,"code")||""):"";
}

/** @param {unknown} error */
export function isAuthenticationError(error) {
  return ["authentication_required","invalid_token","invalid_user","session_expired"].includes(errorCode(error));
}

/** @param {unknown} error */
export function isCancellation(error) {
  return errorCode(error)==="request_cancelled"||(error instanceof DOMException&&error.name==="AbortError");
}

/** @param {unknown} error */
export function userMessageForError(error) {
  const code=errorCode(error);
  const messages={
    invalid_credentials:"Username or password is incorrect.",
    username_unavailable:"That username is unavailable. Please choose another.",
    invalid_username:"Enter a valid username.",
    account_creation_rate_limited:"Too many account-creation attempts. Please wait and try again.",
    login_rate_limited:"Too many sign-in attempts. Please wait and try again.",
    request_timeout:"This is taking longer than expected. Please try again.",
    network_error:"MyGita could not connect. Check your connection and try again.",
    duplicate_enrolment:"This Experience is already in My Journey.",
    batch_required:"Choose an available batch.",
    batch_not_open:"That batch is no longer open. Please choose another.",
    interest_already_registered:"Your interest is already registered.",
    contract_response_invalid:"MyGita received an unexpected response. Please try again later.",
  };
  if(Object.hasOwn(messages,code))return messages[code];
  return error instanceof Error&&error.message?error.message:"The request could not be completed. Please try again.";
}
