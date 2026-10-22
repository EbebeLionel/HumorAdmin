import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAll, type AdminProfile } from "@/lib/admin";
import { CUSTOM_VIBE_PREFIX, getVibeLabel, nyDateKey, nyDayStart } from "@/lib/captions";

type ProfileRow = Pick<AdminProfile, "id" | "email" | "first_name" | "last_name" | "is_superadmin"> & {
  created_at: string;
};
type ImageRow = { id: string; user_id: string; image_url: string; vibe: string; theme: string | null; created_at: string };
type CaptionRow = {
  id: string;
  image_id: string;
  user_id: string;
  content: string;
  model: string;
  upvotes: number;
  downvotes: number;
  score: number;
  created_at: string;
};
type VoteRow = { id: string; caption_id: string; user_id: string; vote: 1 | -1; created_at: string };

export type RankedCaption = CaptionRow & { image_url: string | null };

const ACTIVITY_DAYS = 30;
const MIN_VOTES_FOR_RATE = 3;

const hourFormat = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" });
const weekdayFormat = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" });
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function rate(up: number, total: number) {
  return total ? up / total : 0;
}

export async function loadStats(supabase: SupabaseClient) {
  const [profiles, images, captions, votes] = await Promise.all([
    fetchAll<ProfileRow>(supabase, "profiles", "id, email, first_name, last_name, is_superadmin, created_at"),
    fetchAll<ImageRow>(supabase, "images", "id, user_id, image_url, vibe, theme, created_at"),
    fetchAll<CaptionRow>(supabase, "captions", "id, image_id, user_id, content, model, upvotes, downvotes, score, created_at"),
    fetchAll<VoteRow>(supabase, "caption_votes", "id, caption_id, user_id, vote, created_at"),
  ]);

  const error = profiles.error ?? images.error ?? captions.error ?? votes.error;
  const imageById = new Map(images.rows.map((row) => [row.id, row]));
  const profileById = new Map(profiles.rows.map((row) => [row.id, row]));
  const captionById = new Map(captions.rows.map((row) => [row.id, row]));
  const withUrl = (c: CaptionRow): RankedCaption => ({ ...c, image_url: imageById.get(c.image_id)?.image_url ?? null });

  const allVotes = votes.rows;
  const upvotes = allVotes.filter((v) => v.vote === 1).length;

  // --- Headline numbers
  const weekAgo = nyDayStart(-6).toISOString();
  const activeVoters = new Set(allVotes.filter((v) => v.created_at >= weekAgo).map((v) => v.user_id)).size;
  const totals = {
    members: profiles.rows.length,
    admins: profiles.rows.filter((p) => p.is_superadmin).length,
    photos: images.rows.length,
    captions: captions.rows.length,
    votes: allVotes.length,
    funnyRate: rate(upvotes, allVotes.length),
    activeVoters,
    landed: rate(captions.rows.filter((c) => c.score > 0).length, captions.rows.length),
  };

  // --- Daily activity, last 30 New York days
  const dayKeys = Array.from({ length: ACTIVITY_DAYS }, (_, i) =>
    nyDateKey(new Date(nyDayStart(i - ACTIVITY_DAYS + 1).getTime() + 12 * 3_600_000))
  );
  const activity = new Map(dayKeys.map((key) => [key, { votes: 0, photos: 0, members: 0 }]));
  for (const v of allVotes) {
    const day = activity.get(nyDateKey(new Date(v.created_at)));
    if (day) day.votes++;
  }
  for (const img of images.rows) {
    const day = activity.get(nyDateKey(new Date(img.created_at)));
    if (day) day.photos++;
  }
  for (const p of profiles.rows) {
    const day = activity.get(nyDateKey(new Date(p.created_at)));
    if (day) day.members++;
  }

  // --- When is campus funniest? Votes by hour and by weekday (New York time)
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, votes: 0, up: 0 }));
  const byWeekday = WEEKDAYS.map((day) => ({ day, votes: 0, up: 0 }));
  for (const v of allVotes) {
    const at = new Date(v.created_at);
    const hour = byHour[Number(hourFormat.format(at)) % 24];
    hour.votes++;
    const weekday = byWeekday[WEEKDAYS.indexOf(weekdayFormat.format(at))];
    if (weekday) weekday.votes++;
    if (v.vote === 1) {
      hour.up++;
      if (weekday) weekday.up++;
    }
  }

  // --- Which vibe is funniest? Upvote rate on captions per vibe (custom vibes grouped)
  const vibeStats = new Map<string, { label: string; emoji: string; photos: Set<string>; up: number; total: number }>();
  for (const c of captions.rows) {
    const image = imageById.get(c.image_id);
    if (!image) continue;
    const key = image.vibe.startsWith(CUSTOM_VIBE_PREFIX) ? CUSTOM_VIBE_PREFIX : image.vibe;
    const label = key === CUSTOM_VIBE_PREFIX ? { emoji: "✍️", label: "Custom vibes" } : getVibeLabel(key);
    const entry = vibeStats.get(key) ?? { label: label?.label ?? key, emoji: label?.emoji ?? "", photos: new Set(), up: 0, total: 0 };
    entry.photos.add(image.id);
    entry.up += c.upvotes;
    entry.total += c.upvotes + c.downvotes;
    vibeStats.set(key, entry);
  }
  const vibes = [...vibeStats.values()]
    .map((v) => ({ label: `${v.emoji} ${v.label}`, photos: v.photos.size, votes: v.total, rate: rate(v.up, v.total) }))
    .sort((a, b) => b.rate - a.rate || b.votes - a.votes);

  // --- Themes: how many photos each daily theme pulled in, and how funny they were
  const themeStats = new Map<string, { photos: number; up: number; total: number }>();
  for (const img of images.rows) {
    const key = img.theme ?? "No theme";
    const entry = themeStats.get(key) ?? { photos: 0, up: 0, total: 0 };
    entry.photos++;
    themeStats.set(key, entry);
  }
  for (const c of captions.rows) {
    const key = imageById.get(c.image_id)?.theme ?? "No theme";
    const entry = themeStats.get(key);
    if (!entry) continue;
    entry.up += c.upvotes;
    entry.total += c.upvotes + c.downvotes;
  }
  const themes = [...themeStats.entries()]
    .map(([theme, s]) => ({ theme, photos: s.photos, votes: s.total, rate: rate(s.up, s.total) }))
    .sort((a, b) => b.photos - a.photos);

  // --- Does length matter? Upvote rate by caption length
  const lengthBuckets = [
    { label: "Under 50 chars", min: 0, max: 50 },
    { label: "50–79", min: 50, max: 80 },
    { label: "80–109", min: 80, max: 110 },
    { label: "110+", min: 110, max: Infinity },
  ].map((bucket) => {
    const inBucket = captions.rows.filter((c) => c.content.length >= bucket.min && c.content.length < bucket.max);
    const up = inBucket.reduce((sum, c) => sum + c.upvotes, 0);
    const total = inBucket.reduce((sum, c) => sum + c.upvotes + c.downvotes, 0);
    return { label: bucket.label, captions: inBucket.length, votes: total, rate: rate(up, total) };
  });

  // --- Caption leaderboards
  const voted = captions.rows.filter((c) => c.upvotes + c.downvotes > 0);
  const hallOfFame = [...voted].sort((a, b) => b.score - a.score || b.upvotes - a.upvotes).slice(0, 5).map(withUrl);
  const hallOfShame = voted
    .filter((c) => c.score < 0)
    .sort((a, b) => a.score - b.score || b.downvotes - a.downvotes)
    .slice(0, 5)
    .map(withUrl);
  // Most divisive: lots of votes, split close to 50/50
  const divisive = voted
    .filter((c) => c.upvotes > 0 && c.downvotes > 0 && c.upvotes + c.downvotes >= MIN_VOTES_FOR_RATE)
    .sort(
      (a, b) =>
        Math.abs(a.score) / (a.upvotes + a.downvotes) - Math.abs(b.score) / (b.upvotes + b.downvotes) ||
        b.upvotes + b.downvotes - (a.upvotes + a.downvotes)
    )
    .slice(0, 5)
    .map(withUrl);

  // --- People
  const creatorStats = new Map<string, { photos: number; score: number; up: number }>();
  for (const img of images.rows) {
    const entry = creatorStats.get(img.user_id) ?? { photos: 0, score: 0, up: 0 };
    entry.photos++;
    creatorStats.set(img.user_id, entry);
  }
  for (const c of captions.rows) {
    const entry = creatorStats.get(c.user_id);
    if (!entry) continue;
    entry.score += c.score;
    entry.up += c.upvotes;
  }
  const nameOf = (id: string) => {
    const p = profileById.get(id);
    return [p?.first_name, p?.last_name].filter(Boolean).join(" ") || p?.email || "Unknown";
  };
  const creators = [...creatorStats.entries()]
    .map(([id, s]) => ({ id, name: nameOf(id), ...s }))
    .sort((a, b) => b.score - a.score || b.photos - a.photos)
    .slice(0, 5);

  const voterStats = new Map<string, { votes: number; up: number; agree: number; judged: number }>();
  for (const v of allVotes) {
    const entry = voterStats.get(v.user_id) ?? { votes: 0, up: 0, agree: 0, judged: 0 };
    entry.votes++;
    if (v.vote === 1) entry.up++;
    // Did this vote match everyone else's majority on that caption?
    const caption = captionById.get(v.caption_id);
    if (caption) {
      const othersUp = caption.upvotes - (v.vote === 1 ? 1 : 0);
      const othersDown = caption.downvotes - (v.vote === -1 ? 1 : 0);
      if (othersUp !== othersDown) {
        entry.judged++;
        if (Math.sign(othersUp - othersDown) === v.vote) entry.agree++;
      }
    }
    voterStats.set(v.user_id, entry);
  }
  const voters = [...voterStats.entries()].map(([id, s]) => ({
    id,
    name: nameOf(id),
    votes: s.votes,
    rate: rate(s.up, s.votes),
    agreement: s.judged ? s.agree / s.judged : null,
  }));
  const qualified = voters.filter((v) => v.votes >= 10);
  const people = {
    mostActive: [...voters].sort((a, b) => b.votes - a.votes)[0] ?? null,
    easiestLaugh: [...qualified].sort((a, b) => b.rate - a.rate)[0] ?? null,
    toughestCritic: [...qualified].sort((a, b) => a.rate - b.rate)[0] ?? null,
    contrarian: [...qualified].filter((v) => v.agreement !== null).sort((a, b) => a.agreement! - b.agreement!)[0] ?? null,
  };

  // --- Which AI model wrote the captions
  const modelCounts = new Map<string, { captions: number; up: number; total: number }>();
  for (const c of captions.rows) {
    const entry = modelCounts.get(c.model) ?? { captions: 0, up: 0, total: 0 };
    entry.captions++;
    entry.up += c.upvotes;
    entry.total += c.upvotes + c.downvotes;
    modelCounts.set(c.model, entry);
  }
  const models = [...modelCounts.entries()]
    .map(([model, s]) => ({ model, captions: s.captions, votes: s.total, rate: rate(s.up, s.total) }))
    .sort((a, b) => b.captions - a.captions);

  return {
    error,
    totals,
    activity: dayKeys.map((key) => ({ day: key, ...activity.get(key)! })),
    byHour,
    byWeekday,
    vibes,
    themes,
    lengthBuckets,
    hallOfFame,
    hallOfShame,
    divisive,
    creators,
    people,
    models,
  };
}

export type Stats = Awaited<ReturnType<typeof loadStats>>;
