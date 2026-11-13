export interface GenerationJob {
  generationId: string;
}

export interface GenerationQueue {
  readonly driver: 'inline' | 'bullmq';
  /** Schedules the generation for processing and returns as soon as it is accepted. */
  enqueue(generationId: string): Promise<void>;
  /** Resolves when no locally tracked job is running. Only meaningful for the inline driver (tests). */
  onIdle(): Promise<void>;
  close(): Promise<void>;
}
