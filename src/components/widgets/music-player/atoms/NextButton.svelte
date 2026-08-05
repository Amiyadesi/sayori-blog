<script lang="ts">
	import Icon from "@iconify/svelte";
	import { isEnglishSite } from "../../../../utils/site-locale";

	interface Props {
		onclick: () => void;
		disabled?: boolean;
	}

	const { onclick, disabled = false }: Props = $props();
</script>

<button
	class="btn-plain w-10 h-10 rounded-lg"
	aria-label={isEnglishSite ? "Next track" : "下一首"}
	{onclick}
	{disabled}
>
	<Icon icon="material-symbols:skip-next" class="text-xl" />
</button>
