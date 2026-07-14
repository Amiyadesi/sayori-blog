export interface ImageProps {
	id?: string;
	src: string;
	class?: string;
	alt?: string;
	position?: string;
	basePath?: string;
	loading?: "eager" | "lazy";
}
