/** The app's one outbox of coaching messages */
import { createOutbox } from "@/features/training/lib/coachingOutbox";

import { coachingApi } from "./api";

export const coachOutbox = createOutbox({
  send: coachingApi.sendMessage,
  remove: coachingApi.deleteMessage,
});

// Waiting messages go when the connection is back or the app comes to the
// front. Without any, a flush asks the server nothing.
if (typeof window !== "undefined") {
  window.addEventListener("online", () => void coachOutbox.flush());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void coachOutbox.flush();
  });
}
