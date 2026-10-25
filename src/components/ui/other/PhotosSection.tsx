import { Image as ImageProps } from "tmdb-ts";
import { Image } from "@heroui/react";
import { getImageUrl } from "@/utils/movies";
import Gallery from "@/components/ui/overlay/Gallery";
import { Slide } from "yet-another-react-lightbox";
import { useState } from "react";
import SectionTitle from "@/components/ui/other/SectionTitle";
import RowHeader from "@/components/ui/other/RowHeader";
import { Eye } from "@/utils/icons";

interface PhotosSectionProps {
  images: ImageProps[];
  type?: "movie" | "tv";
  heading?: "section" | "row";
}

const PhotosSection: React.FC<PhotosSectionProps> = ({ images, type = "movie", heading = "section" }) => {
  const [index, setIndex] = useState<number>(-1);
  const slides: Slide[] = (images || []).map(({ file_path, width, height }) => ({
    src: getImageUrl(file_path, "backdrop", true),
    description: `${width}x${height}`,
  }));

  if (!images?.length) return null;

  return (
    <section id="gallery" className="z-3 flex flex-col gap-3">
      {heading === "row" ? (
        <RowHeader title="Photos" className="px-4 md:px-12" />
      ) : (
        <SectionTitle color="primary">Photos</SectionTitle>
      )}
      <div
        className={
          heading === "row"
            ? "grid grid-cols-2 gap-3 px-4 sm:grid-cols-4 md:px-12"
            : "grid grid-cols-2 place-items-center gap-3 sm:grid-cols-4"
        }
      >
        {images.slice(0, 4).map(({ file_path }, photoIndex) => (
          <div key={`${file_path}-${photoIndex}`} className="group relative w-full">
            {heading === "row" ? (
              <button
                type="button"
                onClick={() => setIndex(photoIndex)}
                className="poster-frame block aspect-video w-full overflow-hidden"
              >
                <img
                  src={getImageUrl(file_path, "backdrop")}
                  alt={`Image ${photoIndex + 1}`}
                  className="size-full object-cover transition duration-300 group-hover:scale-105"
                />
              </button>
            ) : (
            <Image
              onClick={() => setIndex(photoIndex)}
              isBlurred
              isZoomed
              width={300}
              alt={`Image ${photoIndex + 1}`}
              src={getImageUrl(file_path, "backdrop")}
              className="aspect-video cursor-pointer"
            />
            )}

            {photoIndex === 3 && images.length > 4 ? (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[1.15rem] bg-black/45 text-xl font-bold text-white backdrop-blur-xs">
                +{images.length - 4}
              </div>
            ) : (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                <div className="z-10 flex h-12 w-12 items-center justify-center rounded-full bg-black/35 opacity-0 backdrop-blur-xs transition-opacity group-hover:opacity-100">
                  <Eye className="h-6 w-6 text-white" />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <Gallery open={index >= 0} index={index} close={() => setIndex(-1)} slides={slides} />
    </section>
  );
};

export default PhotosSection;
