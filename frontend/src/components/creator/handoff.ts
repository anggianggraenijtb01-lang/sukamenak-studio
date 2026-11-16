/**
 * Hand-off of a prompt from the Advisor to the Studio. It travels in the router's navigation state
 * (`navigate('/creator/studio', { state: studioHandoff(text) })`), never through localStorage.
 */
export interface StudioHandoff {
  /** Text for the Studio's remarks field. */
  prompt: string;
}

export const studioHandoff = (prompt: string): StudioHandoff => ({ prompt });

/** Reads the hand-off from `location.state`, tolerating anything else. Returns null when there is none. */
export function readStudioHandoff(state: unknown): StudioHandoff | null {
  if (typeof state !== 'object' || state === null) return null;
  const prompt = (state as { prompt?: unknown }).prompt;
  return typeof prompt === 'string' && prompt.trim() ? { prompt: prompt.trim() } : null;
}
