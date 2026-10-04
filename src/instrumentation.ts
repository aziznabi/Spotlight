export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.WORKFLOW_TARGET_WORLD === "local"
  ) {
    // Restore local persisted runs after a server restart. Vercel owns its queue.
    const { getWorld } = await import("workflow/runtime");
    const world = await getWorld();
    await world.start?.();
  }
}
