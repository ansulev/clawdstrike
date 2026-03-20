import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

export interface LessonMeta {
  title: string;
  order: number;
  track: string;
  slug: string;
  path: string;
}

export interface TrackMeta {
  slug: string;
  title: string;
  lessons: LessonMeta[];
}

const TRACKS_DIR = path.join(process.cwd(), 'src/app/tracks');

function slugToTitle(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function getAllTracks(): TrackMeta[] {
  if (!fs.existsSync(TRACKS_DIR)) {
    return [];
  }

  const trackDirs = fs.readdirSync(TRACKS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory());

  const tracks: TrackMeta[] = [];

  for (const trackDir of trackDirs) {
    const trackSlug = trackDir.name;
    const trackPath = path.join(TRACKS_DIR, trackSlug);
    const lessonDirs = fs.readdirSync(trackPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory());

    const lessons: LessonMeta[] = [];

    for (const lessonDir of lessonDirs) {
      const mdxPath = path.join(trackPath, lessonDir.name, 'page.mdx');
      if (!fs.existsSync(mdxPath)) {
        continue;
      }

      const fileContents = fs.readFileSync(mdxPath, 'utf8');
      const { data } = matter(fileContents);

      if (data.title && typeof data.order === 'number' && data.track) {
        lessons.push({
          title: data.title as string,
          order: data.order as number,
          track: data.track as string,
          slug: lessonDir.name,
          path: `/tracks/${trackSlug}/${lessonDir.name}`,
        });
      }
    }

    lessons.sort((a, b) => a.order - b.order);

    if (lessons.length > 0) {
      tracks.push({
        slug: trackSlug,
        title: slugToTitle(trackSlug),
        lessons,
      });
    }
  }

  tracks.sort((a, b) => a.slug.localeCompare(b.slug));

  return tracks;
}

export function getTrackLessons(trackSlug: string): LessonMeta[] {
  const tracks = getAllTracks();
  const track = tracks.find((t) => t.slug === trackSlug);
  return track?.lessons ?? [];
}

export function getLessonNavigation(
  trackSlug: string,
  lessonSlug: string,
): { prev: LessonMeta | null; next: LessonMeta | null } {
  const lessons = getTrackLessons(trackSlug);
  const index = lessons.findIndex((l) => l.slug === lessonSlug);

  if (index === -1) {
    return { prev: null, next: null };
  }

  return {
    prev: index > 0 ? lessons[index - 1] : null,
    next: index < lessons.length - 1 ? lessons[index + 1] : null,
  };
}
