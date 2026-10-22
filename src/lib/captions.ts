export const CAPTION_IMAGES_BUCKET = "caption-images";

// Caption styles a user can pick. `instructions` goes straight into the AI prompt.
export const VIBES = [
  {
    id: "chronically-online",
    label: "Chronically online",
    emoji: "📱",
    instructions:
      "Write like a chronically online college student: current internet slang, meme formats, lowercase energy, Twitter/TikTok cadence.",
  },
  {
    id: "midwest-in-nyc",
    label: "Midwesterner in NYC",
    emoji: "🌽",
    instructions:
      "Write from the point of view of a polite Midwesterner who just moved to New York City and is baffled, delighted, or overwhelmed by it.",
  },
  {
    id: "columbia",
    label: "Columbia insider",
    emoji: "🦁",
    instructions:
      "Write inside jokes a Columbia University undergrad would get: Butler Library all-nighters, the Core Curriculum, Lit Hum, dining halls, Low Steps, the 1 train, dorm life, midterm season.",
  },
  {
    id: "nature-doc",
    label: "Nature documentary",
    emoji: "🎙️",
    instructions:
      "Narrate the photo like a hushed, dramatic nature documentary narrator observing New Yorkers in their natural habitat.",
  },
  {
    id: "unhinged",
    label: "Unhinged",
    emoji: "🌀",
    instructions: "Be absurd, chaotic, and surreal, but still clearly about what's in the photo.",
  },
] as const;

export type VibeId = (typeof VIBES)[number]["id"];

export function getVibe(id: string) {
  return VIBES.find((vibe) => vibe.id === id);
}

// A vibe the user typed themselves is stored in images.vibe as "custom:<their text>"
export const CUSTOM_VIBE_PREFIX = "custom:";
export const CUSTOM_VIBE_MAX_LENGTH = 120;

export function cleanCustomVibe(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, CUSTOM_VIBE_MAX_LENGTH);
}

// Label + emoji for showing an image's vibe, preset or custom
export function getVibeLabel(stored: string) {
  if (stored.startsWith(CUSTOM_VIBE_PREFIX)) {
    return { emoji: "✍️", label: stored.slice(CUSTOM_VIBE_PREFIX.length) };
  }
  const vibe = getVibe(stored);
  return vibe ? { emoji: vibe.emoji, label: vibe.label } : null;
}

// A new theme every day gives people a reason to come back and something to go photograph.
// `blurb` is shown to users; `context` goes into the AI prompt so captions use real
// Columbia references instead of generic college jokes.
export const THEMES = [
  {
    name: "Subway moments",
    blurb: "The 1 train, the 116th St platform, and everything between Morningside and downtown.",
    context:
      "the 1 train at 116th St–Columbia University, local vs express confusion at 96th St, crowded rush-hour cars, subway performers, delays when you have a 10:10 class",
  },
  {
    name: "Dining hall reviews",
    blurb: "John Jay, Ferris, JJ's Place at midnight. Rate the plate.",
    context:
      "John Jay Dining Hall, Ferris Booth Commons, JJ's Place late night, swipes and dining dollars running out, the same pasta station every day, Hewitt at Barnard",
  },
  {
    name: "Things only NYC has",
    blurb: "Only in New York (and only 20 minutes from campus).",
    context:
      "New York from a Columbia student's point of view: Morningside Heights vs downtown, Riverside Park, $18 salads, rats with confidence, bodegas, the MTA, tourists in Times Square",
  },
  {
    name: "Dorm life",
    blurb: "Columbia housing in all its glory: shoebox singles, the lottery, and the radiator that won't quit.",
    context:
      "Columbia housing: John Jay singles the size of a closet, Carman doubles, Wien, Furnald, East Campus, Broadway Hall, Hartley/Wallach suites, the housing lottery and bad lottery numbers, radiators you can't turn off, thin walls, suitemates, shared bathrooms, move-in day on College Walk",
  },
  {
    name: "Weekend adventures",
    blurb: "Escaping the Morningside bubble, even for an afternoon.",
    context:
      "leaving the Morningside Heights bubble: taking the 1 downtown, Central Park, Brooklyn trips that take forever, coming back to Butler on Sunday night with nothing done",
  },
  {
    name: "Midterm survival",
    blurb: "Butler, caffeine, and a Core reading you were supposed to finish last week.",
    context:
      "Columbia midterm season: Butler Library all-nighters, the Core Curriculum (Lit Hum, CC, Frontiers, UWriting), Orgo, office-hours lines, Joe Coffee, CourseWorks deadlines at 11:59pm",
  },
  {
    name: "NYC prices",
    blurb: "How much?? For THAT?",
    context:
      "being a broke Columbia student in New York: Morningside rent, $9 lattes on Amsterdam, the halal cart as a budget meal, dining dollars, splitting Ubers, Book Culture prices",
  },
  {
    name: "Bodega cats & bodega finds",
    blurb: "Your local bodega cat deserves a caption.",
    context:
      "bodegas on Broadway and Amsterdam near Columbia, the bodega cat as a campus celebrity, a chopped cheese at 1am, the bodega guy who knows your order",
  },
  {
    name: "Campus wildlife (squirrels count)",
    blurb: "Squirrels, pigeons, and the occasional raccoon near Low Steps.",
    context:
      "Columbia campus wildlife: fearless squirrels on College Walk, pigeons on Low Steps, squirrels stealing your Ferris bagel, the owl hidden on Alma Mater, rats by the dumpsters on Broadway",
  },
  {
    name: "Fits seen on Broadway",
    blurb: "The outfits of Morningside Heights, from Canada Goose to pajama pants in Butler.",
    context:
      "Columbia student fashion on Broadway and College Walk: Canada Goose jackets, finance-bro quarter-zips, pajama pants in Butler, Book Culture tote bags, Columbia-blue everything",
  },
  {
    name: "Library at 2am",
    blurb: "Butler 209, Avery, Uris. Who's still here?",
    context:
      "late nights in Columbia libraries: Butler 209, the Butler stacks, Milstein, Avery, Uris, fighting for an outlet, seeing the same people every night",
  },
  {
    name: "Central Park",
    blurb: "Morningside Park is closer, but Central Park is the main character.",
    context:
      "Columbia students in Central Park and Morningside Park: the walk down from 110th St, picnics instead of studying, the Harlem Meer, joggers, dogs that live better than students",
  },
  {
    name: "Overheard in New York",
    blurb: "Things you overheard on campus or in the city that need context.",
    context:
      "things overheard around Columbia: conversations on College Walk, CS majors talking about internships, tour groups at the Sundial, finance recruiting, someone on the 1 train narrating their life",
  },
  {
    name: "The view from your window",
    blurb: "Hudson sunsets, brick walls, or the air shaft. Show us what you get.",
    context:
      "the view from a Columbia dorm window: a brick wall, the air shaft, the Hudson from a lucky high floor, Broadway traffic, Low Library at night, someone else's window across the courtyard",
  },
] as const;

export type Theme = (typeof THEMES)[number];

const TIME_ZONE = "America/New_York";

// "YYYY-MM-DD" for the New York calendar day containing `date`
export function nyDateKey(date = new Date()) {
  return date.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

// New York's UTC offset at `at`, in ms (e.g. -4h during daylight time)
function nyOffsetMs(at: Date) {
  const name =
    new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, timeZoneName: "longOffset" })
      .formatToParts(at)
      .find((part) => part.type === "timeZoneName")?.value ?? "";
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  if (!match) return 0;
  return (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) * 60_000;
}

// Midnight in New York at the start of today (offsetDays = 0), yesterday (-1), tomorrow (1)…
export function nyDayStart(offsetDays = 0, now = new Date()) {
  const [year, month, day] = nyDateKey(now).split("-").map(Number);
  const utcMidnight = Date.UTC(year, month - 1, day + offsetDays);
  const guess = utcMidnight - nyOffsetMs(new Date(utcMidnight));
  return new Date(utcMidnight - nyOffsetMs(new Date(guess)));
}

// Theme for the New York day `offsetDays` from today, so it flips at local midnight
export function getDailyTheme(offsetDays = 0): Theme {
  const [year, month, day] = nyDateKey().split("-").map(Number);
  const dayNumber = Date.UTC(year, month - 1, day + offsetDays) / 86_400_000;
  return THEMES[dayNumber % THEMES.length];
}

export function getThemeOfTheDay() {
  return getDailyTheme().name;
}

export function getThemeByName(name: string | null) {
  return THEMES.find((theme) => theme.name === name);
}

export type Caption = {
  id: string;
  image_id: string;
  content: string;
  upvotes: number;
  downvotes: number;
  score: number;
  created_at: string;
};

export type ImageWithCaptions = {
  id: string;
  user_id: string;
  image_url: string;
  vibe: string;
  theme: string | null;
  created_at: string;
  captions: Caption[];
};

export const IMAGE_WITH_CAPTIONS_SELECT =
  "id, user_id, image_url, vibe, theme, created_at, captions (id, image_id, content, upvotes, downvotes, score, created_at)";
