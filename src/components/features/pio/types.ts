export interface PioConfig {
	enable: boolean;
	mode?: string;
	hiddenOnMobile?: boolean;
	position?: "left" | "right";
	width?: number;
	height?: number;
	dialog?: Record<string, string>;
	models?: string[];
}

export interface PioProps {
	config?: Partial<PioConfig>;
}
