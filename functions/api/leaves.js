// GET /api/leaves — public, non-sensitive list of leaves for the tree.
// Only returns id + display name; never exposes any secret.
import { LEAF_REGISTRY, json } from '../_shared.js';

export function onRequest(context) {
  return json({ leaves: LEAF_REGISTRY.map(({ id, name }) => ({ id, name })) });
}