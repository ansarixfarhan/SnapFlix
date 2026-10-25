import DetailFacts, { languageLabel } from "@/components/sections/Detail/DetailFacts";
import Link from "next/link";

interface CreatedBy {
  id?: number;
  name?: string;
}

interface SeriesFactsProps {
  show: {
    overview?: string;
    tagline?: string;
    status?: string;
    original_language?: string;
    number_of_seasons?: number;
    number_of_episodes?: number;
    genres?: { id: number; name: string }[];
    created_by?: CreatedBy[];
    networks?: { name?: string }[];
    production_companies?: { name?: string }[];
  };
  overrideSeasonCount?: number;
}

const PersonLink: React.FC<{ id?: number; name?: string }> = ({ id, name }) => {
  if (!name) return null;
  if (!id) return <>{name}</>;
  return (
    <Link href={`/person/${id}`} className="transition hover:text-white hover:underline">
      {name}
    </Link>
  );
};

const SeriesFacts: React.FC<SeriesFactsProps> = ({ show, overrideSeasonCount }) => {
  const creators = show.created_by?.filter((person) => Boolean(person.name)).slice(0, 3) || [];
  const seasonCount = overrideSeasonCount || show.number_of_seasons;
  const seasons =
    seasonCount && show.number_of_episodes
      ? `${seasonCount} season${seasonCount > 1 ? "s" : ""} · ${show.number_of_episodes} episodes`
      : seasonCount
        ? `${seasonCount} season${seasonCount > 1 ? "s" : ""}`
        : null;

  return (
    <DetailFacts
      overview={show.overview}
      tagline={show.tagline}
      facts={[
        [
          "Creators",
          creators.length > 0 ? (
            <>
              {creators.map((creator, index) => (
                <span key={creator.id ?? creator.name}>
                  <PersonLink id={creator.id} name={creator.name} />
                  {index < creators.length - 1 ? ", " : ""}
                </span>
              ))}
            </>
          ) : undefined,
        ],
        ["Genres", show.genres?.map((genre) => genre.name).join(", ")],
        ["Seasons", seasons],
        ["Network", show.networks?.slice(0, 2).map((network) => network.name).join(", ")],
        [
          "Studio",
          show.production_companies
            ?.slice(0, 2)
            .map((company) => company.name)
            .join(", "),
        ],
        ["Language", languageLabel(show.original_language)],
        ["Status", show.status],
      ]}
    />
  );
};

export default SeriesFacts;
