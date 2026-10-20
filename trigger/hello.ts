import { logger, task } from "@trigger.dev/sdk"

/** Setup check: proves the app can trigger a task and the worker runs it. Removed once export works. */
export const hello = task({
  id: "hello",
  run: async (payload: { name: string }) => {
    logger.info("Hello task ran", { name: payload.name })
    return { message: `Hello ${payload.name}!`, at: new Date().toISOString() }
  },
})
