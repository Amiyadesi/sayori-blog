import path from "node:path";

type ImageLoader = () => Promise<ImageMetadata>;

const localImages = import.meta.glob<ImageMetadata>(
	[
		"/src/content/**/*.{jpg,jpeg,png,gif,webp,avif,svg}",
		"/src/assets/**/*.{jpg,jpeg,png,gif,webp,avif,svg}",
	],
	{ import: "default" },
) as Record<string, ImageLoader>;

export async function resolveLocalImage(
	basePath: string,
	imagePath: string,
): Promise<ImageMetadata | undefined> {
	const normalizedPath = path
		.normalize(path.join("/src", basePath, imagePath))
		.replace(/\\/g, "/");
	const file = localImages[normalizedPath];
	return file ? file() : undefined;
}

