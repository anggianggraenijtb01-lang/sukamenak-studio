/**
 * Default core prompts, written in English (image models follow English best) per the plan rules:
 * - `[___]` blanks are filled in order by the template slots listed in `blankKeys`;
 * - the text area is only ever described as a "flat empty colour field": the model must never be
 *   asked to render lettering (those words are banned in core prompts; the app overlays text later);
 * - only whitelisted `{{...}}` placeholders are used.
 *
 * These strings are SECRET. They are encrypted before they reach the database, must never be
 * logged or returned by an API, and are only exported here for the seed script and tests.
 */
export interface SeedCorePrompt {
  key: string;
  subject: 'product' | 'human_model';
  publication: 'poster' | 'psa' | 'social_post' | 'product_shot' | 'human_model';
  /** Slot keys, in blank order: the n-th key fills the n-th `[___]`. */
  blankKeys: readonly string[];
  body: string;
}

export const SEED_CORE_PROMPTS: readonly SeedCorePrompt[] = [
  {
    key: 'product.poster',
    subject: 'product',
    publication: 'poster',
    blankKeys: ['product', 'color', 'background', 'lighting', 'style', 'composition', 'remarks'],
    body: [
      'Create a professional promotional poster artwork in {{aspect_ratio}} format. The hero subject is [___], placed prominently and rendered with accurate shape, material and proportions.',
      'Colour palette: [___], in harmony with {{brand_palette}}.',
      'Setting and background: [___].',
      'Lighting: [___].',
      'Visual style and mood: [___].',
      'Camera angle and composition: [___].',
      'Keep {{text_zone}} completely clean and free of any detail so that a layout can be placed over it later.',
      'Additional art direction: [___].',
      'Constraints: {{subject_lock}}; {{negative}}.',
    ].join('\n'),
  },
  {
    key: 'product.psa',
    subject: 'product',
    publication: 'psa',
    blankKeys: ['product', 'color', 'background', 'lighting', 'style', 'composition', 'remarks'],
    body: [
      'Create a clear, trustworthy public-service announcement banner in {{aspect_ratio}} format, calm and respectful in tone, built around [___] as the central visual idea.',
      'Colour palette: [___], using {{brand_palette}} as the base.',
      'Setting and background: [___].',
      'Lighting: [___].',
      'Visual style: [___], clean and easy to read at a glance, suitable for all ages.',
      'Composition: [___].',
      'Keep {{text_zone}} completely clean and uncluttered, with generous margins, so that information can be placed there later.',
      'Additional direction: [___].',
      'Constraints: {{subject_lock}}; {{negative}}.',
    ].join('\n'),
  },
  {
    key: 'product.social_post',
    subject: 'product',
    publication: 'social_post',
    blankKeys: ['product', 'color', 'background', 'lighting', 'style', 'remarks'],
    body: [
      'Create a scroll-stopping social media visual in {{aspect_ratio}} format featuring [___] as the clear focal point.',
      'Colour palette: [___], echoing {{brand_palette}}.',
      'Background and setting: [___].',
      'Lighting: [___].',
      'Visual style and mood: [___].',
      'Keep {{text_zone}} completely clean so that a short message can be added later, and give the subject comfortable breathing room around it.',
      'Additional direction: [___].',
      'Constraints: {{subject_lock}}; {{negative}}.',
    ].join('\n'),
  },
  {
    key: 'product.product_shot',
    subject: 'product',
    publication: 'product_shot',
    blankKeys: ['product', 'background', 'lighting', 'angle', 'color', 'remarks'],
    body: [
      'Create a high-end commercial product photograph in {{aspect_ratio}} format of [___], sharply focused with true-to-life colour, accurate proportions and crisp material detail.',
      'Background and surface: [___].',
      'Lighting: [___].',
      'Camera angle: [___].',
      'Colour accents and props palette: [___], balanced with {{brand_palette}}.',
      'Additional direction: [___].',
      'Keep any empty margin as a plain, uncluttered colour field.',
      'Constraints: {{subject_lock}}; {{negative}}.',
    ].join('\n'),
  },
  {
    key: 'human_model.portrait',
    subject: 'human_model',
    publication: 'human_model',
    blankKeys: ['model', 'outfit', 'pose', 'background', 'lighting', 'color', 'style', 'remarks'],
    body: [
      "Create a professional portrait photograph in {{aspect_ratio}} format of [___], keeping the person's identity and facial features from the reference image unchanged when one is provided.",
      'Outfit: [___].',
      'Pose and expression: [___].',
      'Setting and background: [___].',
      'Lighting: [___].',
      'Colour palette: [___], in harmony with {{brand_palette}}.',
      'Visual style: [___].',
      'Additional direction: [___].',
      'Constraints: {{subject_lock}}; {{negative}}.',
    ].join('\n'),
  },
];
