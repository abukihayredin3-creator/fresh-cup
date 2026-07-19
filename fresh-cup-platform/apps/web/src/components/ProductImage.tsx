import Image from "next/image";

export function renderProductImage({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(min-width: 640px) 320px, 50vw"
      className="object-cover"
    />
  );
}
