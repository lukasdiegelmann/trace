/**
 * Every settings topic, grouped by theme (not by app). `path` is relative to
 * /settings; an absolute path is a screen another feature owns.
 */
export const TOPIC_GROUPS = [
  {
    id: "you",
    topics: [
      { id: "profile", path: "profile" },
      { id: "appearance", path: "appearance" },
      { id: "regional", path: "regional" },
      { id: "notifications", path: "notifications" },
      { id: "assistant", path: "assistant" },
    ],
  },
  {
    id: "nutrition",
    topics: [
      { id: "diary", path: "diary" },
      { id: "goals", path: "goals" },
      { id: "foods", path: "foods" },
      { id: "nutrients", path: "nutrients" },
      { id: "foodSources", path: "food-sources" },
      { id: "wellness", path: "/nutrition/wellness/settings" },
      { id: "statistics", path: "/nutrition/statistics/settings" },
      { id: "bodyStats", path: "/nutrition/statistics/body-stats" },
    ],
  },
  {
    id: "cooking",
    topics: [
      { id: "cooking", path: "cooking" },
      { id: "kitchens", path: "kitchens" },
      { id: "manage", path: "/cooking/manage" },
    ],
  },
  {
    id: "training",
    topics: [
      { id: "training", path: "training" },
      { id: "catalog", path: "catalog" },
      { id: "radio", path: "radio" },
    ],
  },
  {
    id: "data",
    topics: [
      { id: "connections", path: "connections" },
      { id: "import", path: "import" },
      { id: "backup", path: "backup" },
    ],
  },
  {
    id: "server",
    topics: [
      { id: "sharing", path: "sharing" },
      { id: "users", path: "users", isAdminOnly: true },
      { id: "authentication", path: "authentication", isAdminOnly: true },
      { id: "email", path: "email", isAdminOnly: true },
      { id: "apiTokens", path: "api-tokens", isAdminOnly: true },
      { id: "webhooks", path: "webhooks", isAdminOnly: true },
    ],
  },
  {
    id: "system",
    topics: [
      { id: "updates", path: "updates" },
      { id: "diagnostics", path: "diagnostics" },
      { id: "about", path: "about" },
    ],
  },
] as const;

export type TopicGroup = (typeof TOPIC_GROUPS)[number];
export type Topic = TopicGroup["topics"][number];

export function topicHref(path: string): string {
  return path.startsWith("/") ? path : `/settings/${path}`;
}

export interface TopicText {
  title: string;
  description: string;
  keywords: string;
}

/** Every word of the query must appear in the title, description or keywords */
export function matchesQuery(text: TopicText, query: string): boolean {
  const haystack =
    `${text.title} ${text.description} ${text.keywords}`.toLocaleLowerCase();
  return query
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

/** The screen's address, with the search it was found by: it jumps there */
export function withQuery(href: string, query: string): string {
  const wanted = query.trim();
  return wanted ? `${href}?q=${encodeURIComponent(wanted)}` : href;
}
