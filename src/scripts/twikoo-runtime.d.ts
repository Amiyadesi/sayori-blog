import type { CommentConfig } from '../types/config';
export function mountTwikoo(container: HTMLElement | null, options: {
  config: NonNullable<CommentConfig['twikoo']> & { path: string; el: string };
  ownerNick: string;
  ownerAvatar: string;
  reviewOnly: boolean;
  isEnglishSite: boolean;
}): () => void;
