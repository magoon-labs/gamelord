import { Tag } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { ALL_GENRES } from "../utils/genreFilter";

export interface GenreFilterSelectProps {
  /** Distinct genres to offer, already sorted. The control is hidden when empty. */
  genres: Array<string>;
  onValueChange: (genre: string) => void;
  /** Selected genre, or `ALL_GENRES`. */
  value: string;
}

/** Toolbar Select for narrowing the library to one genre. */
export function GenreFilterSelect({ genres, onValueChange, value }: GenreFilterSelectProps) {
  if (genres.length === 0) {
    return null;
  }

  return (
    <Select onValueChange={onValueChange} value={value}>
      <SelectTrigger aria-label="Filter by genre" className="w-[160px]">
        <Tag className="h-4 w-4 mr-2 shrink-0" />
        <SelectValue placeholder="Genre" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_GENRES}>All Genres</SelectItem>
        {genres.map((genre) => (
          <SelectItem key={genre} value={genre}>
            {genre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
