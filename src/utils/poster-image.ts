import { resolveLocalImage } from "./local-image";

export async function processPosterImage(
	imagePath: string | undefined,
	filePath: string | undefined,
): Promise<string> {
	if (!imagePath) {
		return "";
	}

	const isLocal = !(
		imagePath.startsWith("/") ||
		imagePath.startsWith("http") ||
		imagePath.startsWith("https") ||
		imagePath.startsWith("data:")
	);

	if (isLocal && filePath) {
		const basePath = filePath.replace(/\/[^/]+$/, "").replace(/\\/g, "/");
		const img = await resolveLocalImage(basePath, imagePath);
		if (img) {
			return img.src;
		}
	}

	if (imagePath.startsWith("http")) {
		try {
			const response = await fetch(imagePath);
			const arrayBuffer = await response.arrayBuffer();
			const base64 = Buffer.from(arrayBuffer).toString("base64");
			const contentType =
				response.headers.get("content-type") || "image/jpeg";
			return `data:${contentType};base64,${base64}`;
		} catch {
			return imagePath;
		}
	}

	return imagePath;
}
