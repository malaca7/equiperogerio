/**
 * Converts a JPEG base64 data URL to a lightweight PDF Blob.
 * Uses a zero-dependency standard PDF structure.
 */
export function generatePdfFromJpeg(
  dataUrl: string,
  imgWidth: number,
  imgHeight: number
): Blob {
  // Extract base64 part
  const base64Data = dataUrl.split(',')[1];
  const binaryString = atob(base64Data);
  const jpegBytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    jpegBytes[i] = binaryString.charCodeAt(i);
  }

  // Page Dimensions (A4 at 72 points/inch)
  // A4 is 595.27 x 841.89 points
  const isLandscape = imgWidth > imgHeight;
  const pageWidth = isLandscape ? 841.89 : 595.27;
  const pageHeight = isLandscape ? 595.27 : 841.89;

  // Calculate scaling to fit page while maintaining aspect ratio
  const pageRatio = pageWidth / pageHeight;
  const imgRatio = imgWidth / imgHeight;
  let renderWidth = pageWidth;
  let renderHeight = pageHeight;
  let xOffset = 0;
  let yOffset = 0;

  if (imgRatio > pageRatio) {
    renderHeight = pageWidth / imgRatio;
    yOffset = (pageHeight - renderHeight) / 2;
  } else {
    renderWidth = pageHeight * imgRatio;
    xOffset = (pageWidth - renderWidth) / 2;
  }

  const encoder = new TextEncoder();
  const parts: (Uint8Array | string)[] = [];

  // PDF Header
  parts.push("%PDF-1.4\n");

  // Object 1: Catalog
  parts.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  // Object 2: Pages list
  parts.push("2 0 obj\n<< /Type /Pages /Kids [ 3 0 R ] /Count 1 >>\nendobj\n");

  // Object 3: Page definition
  parts.push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [ 0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)} ] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
  );

  // Object 4: Image XObject (embeds the raw JPEG stream)
  parts.push(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgWidth} /Height ${imgHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
  );
  parts.push(jpegBytes);
  parts.push("\nendstream\nendobj\n");

  // Object 5: Content stream (positions and draws the image)
  const content = `q\n${renderWidth.toFixed(2)} 0 0 ${renderHeight.toFixed(2)} ${xOffset.toFixed(2)} ${yOffset.toFixed(2)} cm\n/Im1 Do\nQ\n`;
  parts.push(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`);

  // Trailer
  parts.push("trailer\n<< /Size 6 /Root 1 0 R >>\n%%EOF");

  const blobParts = parts.map((p) =>
    typeof p === "string" ? encoder.encode(p) : p
  );
  return new Blob(blobParts as BlobPart[], { type: "application/pdf" });
}
