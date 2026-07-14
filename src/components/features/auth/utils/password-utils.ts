/**
 * Password utility functions for encryption/decryption
 *
 * Note: These functions are designed to run in the browser where CryptoJS
 * is available as a global variable after loading /assets/js/crypto-js.min.js
 */

// Declare CryptoJS as a global variable
declare const CryptoJS: any;

/**
 * Decrypt content using AES
 */
export async function decryptContent(
	encryptedContent: string,
	password: string,
): Promise<string | null> {
	if (typeof CryptoJS === "undefined") {
		await loadCryptoLibraries();
	}

	try {
		const decryptedBytes = CryptoJS.AES.decrypt(encryptedContent, password);
		const decryptedString = decryptedBytes.toString(CryptoJS.enc.Utf8);

		// Verify the decrypted content has the expected prefix
		if (!decryptedString || !decryptedString.startsWith("MIZUKI-VERIFY:")) {
			return null;
		}

		return decryptedString.replace("MIZUKI-VERIFY:", "");
	} catch (error) {
		console.error("Decryption error:", error);
		return null;
	}
}

/**
 * Load CryptoJS library dynamically
 */
export async function loadCryptoLibraries(): Promise<void> {
	if (typeof CryptoJS === "undefined") {
		await new Promise((resolve, reject) => {
			const script = document.createElement("script");
			script.src = "/assets/js/crypto-js.min.js";
			script.onload = resolve;
			script.onerror = reject;
			document.head.appendChild(script);
		});
	}
}
