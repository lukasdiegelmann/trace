import { ImageOff } from "lucide-react";
import { useState } from "react";

import { type ProgressPhoto, photoSrc } from "../lib/progressPhotos";

export interface PhotoImageProps {
  photo: ProgressPhoto;
  alt: string;
  isEager?: boolean;
}

/** One progress photo, filling its frame */
export function PhotoImage(props: PhotoImageProps) {
  return <Picture key={props.photo.id} {...props} />;
}

function Picture({ photo, alt, isEager = false }: PhotoImageProps) {
  const [failures, setFailures] = useState(0);
  // One retry: a dropped connection shouldn't leave a broken tile.
  if (failures > 1) {
    return (
      <div
        className="flex size-full items-center justify-center"
        role="img"
        aria-label={alt}
      >
        <ImageOff aria-hidden className="text-muted" />
      </div>
    );
  }
  return (
    <img
      key={failures}
      className="size-full object-cover"
      src={photoSrc(photo)}
      alt={alt}
      loading={isEager ? "eager" : "lazy"}
      draggable={false}
      onError={() => {
        setFailures((count) => count + 1);
      }}
    />
  );
}
