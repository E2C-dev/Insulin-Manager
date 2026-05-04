// Global process-level safety net for uncaught errors.
// Imported for side-effects from server/index.ts at the very top of startup
// so listeners are registered before any module starts async work.
//
// Policy: log with [fatal-uncaught] prefix and KEEP SERVING.
// Crashing the process on a single bad async path takes down all users for
// every other session — strictly worse than logging and continuing in our
// single-tenant Replit deploy. If a true unrecoverable state is hit, the
// process supervisor (Replit Run / npm start watchdog) will pick that up via
// HTTP health checks rather than via a Node crash.

process.on("uncaughtException", (err: unknown) => {
  // err may not be an Error instance — handle gracefully.
  const stack =
    err && typeof err === "object" && "stack" in (err as object)
      ? (err as { stack?: string }).stack
      : undefined;
  // eslint-disable-next-line no-console
  console.error("[fatal-uncaught] uncaughtException:", stack ?? err);
  // do not exit — log and keep serving
});

process.on("unhandledRejection", (reason: unknown) => {
  // eslint-disable-next-line no-console
  console.error("[fatal-uncaught] unhandledRejection:", reason);
  // do not exit
});

// Mark module as a side-effect import for bundlers / tree-shakers.
export {};
