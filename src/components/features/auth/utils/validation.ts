/**
 * Validation utilities for password protection
 */

export function validatePassword(password: string | null | undefined): boolean {
	return Boolean(password && password.trim().length > 0);
}

export function showError(
	errorMessage: HTMLElement | null,
	message: string,
): void {
	if (errorMessage) {
		errorMessage.textContent = message;
		errorMessage.style.display = "block";
	}
}

export function hideError(errorMessage: HTMLElement | null): void {
	if (errorMessage) {
		errorMessage.style.display = "none";
	}
}

export function setInputEnabled(
	input: HTMLInputElement | null,
	enabled: boolean,
): void {
	if (input) {
		input.disabled = !enabled;
	}
}

export function setButtonEnabled(
	button: HTMLButtonElement | null,
	enabled: boolean,
	text?: string,
): void {
	if (button) {
		button.disabled = !enabled;
		if (text) {
			button.textContent = text;
		}
	}
}

export function focusInput(input: HTMLInputElement | null): void {
	if (input) {
		input.focus();
	}
}

export function getInputValue(input: HTMLInputElement | null): string {
	return input?.value.trim() || "";
}

export function clearInput(input: HTMLInputElement | null): void {
	if (input) {
		input.value = "";
	}
}
