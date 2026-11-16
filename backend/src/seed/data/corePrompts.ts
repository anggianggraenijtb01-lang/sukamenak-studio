/**
 * Core prompt STAND-INS. This repository is public, so the real core prompts are not here and must never be committed.
 *
 * What lives here is the public structure (key, subject, publication, the order of the blanks the template slots fill)
 * and a neutral stand-in body that carries PLACEHOLDER_CORE_PROMPT_MARKER. Seeding installs the stand-ins; the real
 * prompts are then entered through the admin Core Prompt Manager (write-only, stored AES-256-GCM encrypted in the
 * database) and activated as a new version. Outside production the stand-ins let the whole pipeline run with the mock
 * provider.
 *
 * A stand-in body must still be a valid core prompt (the rules the real ones follow):
 * - `[___]` blanks are filled in order by the template slots listed in `blankKeys`;
 * - the empty area is only ever described as a "plain empty colour field": lettering words are banned in core prompts
 *   (the application overlays the text afterwards);
 * - only whitelisted `{{...}}` placeholders are used, and {{subject_lock}}, {{negative}} and {{aspect_ratio}} are present.
 */
import { PLACEHOLDER_CORE_PROMPT_MARKER } from '../../engine/placeholderCorePrompt.js';

export interface SeedCorePrompt {
  key: string;
  subject: 'product' | 'human_model';
  publication: 'poster' | 'psa' | 'social_post' | 'product_shot' | 'human_model';
  /** Slot keys, in blank order: the n-th key fills the n-th `[___]`. */
  blankKeys: readonly string[];
  body: string;
}

const note = (what: string): string =>
  `${PLACEHOLDER_CORE_PROMPT_MARKER} for ${what}: a neutral stand-in kept in the public repository. The real prompt is entered in the admin Core Prompt Manager.`;

export const SEED_CORE_PROMPTS: readonly SeedCorePrompt[] = [
  {
    key: 'product.poster',
    subject: 'product',
    publication: 'poster',
    blankKeys: ['product', 'color', 'background', 'lighting', 'style', 'composition', 'remarks'],
    body: [
      note('the product poster'),
      'Format {{aspect_ratio}}. Main subject of the poster: [___], shown large with accurate shape, material and proportions.',
      'Colour palette: [___], in line with {{brand_palette}}.',
      'Setting and background: [___].',
      'Lighting: [___].',
      'Visual style and mood: [___].',
      'Composition and camera angle: [___].',
      'Leave {{text_zone}} as a plain empty colour field; the application fills it afterwards.',
      'Extra direction: [___].',
      'Constraints: {{subject_lock}}; {{negative}}.',
    ].join('\n'),
  },
  {
    key: 'product.psa',
    subject: 'product',
    publication: 'psa',
    blankKeys: ['product', 'color', 'background', 'lighting', 'style', 'composition', 'remarks'],
    body: [
      note('the public-service banner'),
      'Format {{aspect_ratio}}. A calm and trustworthy announcement visual built around [___] as its central idea.',
      'Colour palette: [___], based on {{brand_palette}}.',
      'Setting and background: [___].',
      'Lighting: [___].',
      'Visual style: [___], simple and easy to take in at a glance.',
      'Composition: [___].',
      'Keep {{text_zone}} clear, with generous margins around it.',
      'Extra direction: [___].',
      'Constraints: {{subject_lock}}; {{negative}}.',
    ].join('\n'),
  },
  {
    key: 'product.social_post',
    subject: 'product',
    publication: 'social_post',
    blankKeys: ['product', 'color', 'background', 'lighting', 'style', 'remarks'],
    body: [
      note('the social media post'),
      'Format {{aspect_ratio}}. A social media visual with [___] as the clear focal point.',
      'Colour palette: [___], echoing {{brand_palette}}.',
      'Background and setting: [___].',
      'Lighting: [___].',
      'Visual style and mood: [___].',
      'Keep {{text_zone}} as an empty colour field with comfortable space around the subject.',
      'Extra direction: [___].',
      'Constraints: {{subject_lock}}; {{negative}}.',
    ].join('\n'),
  },
  {
    key: 'product.product_shot',
    subject: 'product',
    publication: 'product_shot',
    blankKeys: ['product', 'background', 'lighting', 'angle', 'color', 'remarks'],
    body: [
      note('the product photograph'),
      'Format {{aspect_ratio}}. A commercial product photograph of [___], sharply focused with true colour.',
      'Background and surface: [___].',
      'Lighting: [___].',
      'Camera angle: [___].',
      'Accent colours and props: [___], balanced with {{brand_palette}}.',
      'Extra direction: [___].',
      'Keep any empty margin as a plain colour field.',
      'Constraints: {{subject_lock}}; {{negative}}.',
    ].join('\n'),
  },
  {
    key: 'human_model.portrait',
    subject: 'human_model',
    publication: 'human_model',
    blankKeys: ['model', 'outfit', 'pose', 'background', 'lighting', 'color', 'style', 'remarks'],
    body: [
      note('the portrait'),
      "Format {{aspect_ratio}}. A portrait photograph of [___], keeping the person's identity and facial features from the reference image unchanged when one is provided.",
      'Outfit: [___].',
      'Pose and expression: [___].',
      'Setting and background: [___].',
      'Lighting: [___].',
      'Colour palette: [___], in harmony with {{brand_palette}}.',
      'Visual style: [___].',
      'Extra direction: [___].',
      'Constraints: {{subject_lock}}; {{negative}}.',
    ].join('\n'),
  },
];
