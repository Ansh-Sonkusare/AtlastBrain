import { OPTIONS, text, withUser } from '../_lib/http';

export { OPTIONS };

export const GET = withUser(async ({ userId, deps }) => {
  const [projects, concepts] = await Promise.all([deps.graph.listProjects(userId), deps.graph.listConcepts(userId)]);
  const names = new Set([...projects, ...concepts].map((x) => x.name.trim()).filter(Boolean));
  return text([...names].join('\n'));
});
