export const signedOutEvent = "atlas-admin-signedout";

// a session can expire under any screen; one event lets the app return to sign-in from all of them
export const adminFetch = async (input: string, init?: RequestInit) => {
  const response = await fetch(input, init);
  if (response.status === 401) window.dispatchEvent(new Event(signedOutEvent));
  return response;
};
