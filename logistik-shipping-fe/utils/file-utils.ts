import {
	File,
	FileArchive,
	FileCode,
	FileImage,
	FileSpreadsheet,
	FileText,
	type LucideIcon,
} from "lucide-react";

/**
 * Get the appropriate file icon based on file extension
 */
export function getFileIcon(filename: string): LucideIcon {
	// Handle null, undefined, or non-string values
	if (!filename || typeof filename !== "string") {
		return File;
	}

	const extension = filename.split(".").pop()?.toLowerCase() || "";

	// Document files
	if (["pdf", "doc", "docx", "txt", "rtf"].includes(extension)) {
		return FileText;
	}

	// Image files
	if (["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp"].includes(extension)) {
		return FileImage;
	}

	// Spreadsheet files
	if (["xls", "xlsx", "csv"].includes(extension)) {
		return FileSpreadsheet;
	}

	// Code files
	if (
		["js", "ts", "jsx", "tsx", "json", "html", "css", "py", "java"].includes(
			extension,
		)
	) {
		return FileCode;
	}

	// Archive files
	if (["zip", "rar", "7z", "tar", "gz"].includes(extension)) {
		return FileArchive;
	}

	// Default file icon
	return File;
}

/**
 * Extract filename from a full URL or path
 */
export function getFilenameFromPath(path: string): string {
	// Handle null, undefined, or non-string values
	if (!path || typeof path !== "string") {
		return "Unknown file";
	}

	const parts = path.split("/");
	const filename = parts.pop() || path;

	// Decode URL-encoded characters (e.g., %20 -> space)
	try {
		return decodeURIComponent(filename);
	} catch (_error) {
		// If decoding fails, return the original filename
		return filename;
	}
}

/**
 * Format file size to human readable format
 */
export function formatFileSize(bytes: number): string {
	if (bytes === 0) return "0 Bytes";

	const k = 1024;
	const sizes = ["Bytes", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
}

/**
 * Trigger browser download from a blob
 * @param blob - The blob data to download
 * @param filename - The filename to save as
 */
export function downloadBlob(blob: Blob, filename: string): void {
	// Create a temporary URL for the blob
	const url = window.URL.createObjectURL(blob);

	// Create a temporary anchor element
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;

	// Append to body, click, and clean up
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);

	// Release the blob URL
	window.URL.revokeObjectURL(url);
}
