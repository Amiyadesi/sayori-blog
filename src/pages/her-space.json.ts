import { HER_OWN_POSTS } from '../data/p34-own-posts';

export function GET() {
  return Response.json(HER_OWN_POSTS.map(({ Content: _, ...post }) => post));
}
