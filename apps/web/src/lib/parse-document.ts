import mammoth from "mammoth";

export async function parseDocument(
  buffer: Buffer,
  fileName: string,
  mimeType?: string,
): Promise<{ text: string; format: string }> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".html")) {
    return { text: buffer.toString("utf8"), format: lower.split(".").pop() ?? "txt" };
  }
  if (lower.endsWith(".docx") || mimeType?.includes("wordprocessingml")) {
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value, format: "docx" };
  }
  if (lower.endsWith(".pdf") || mimeType === "application/pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);
    return { text: data.text, format: "pdf" };
  }
  return { text: buffer.toString("utf8"), format: "unknown" };
}
