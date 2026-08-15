// Spec §16.4 — reads a CV file client-side into a base64 data: URL, which
// is what gets POSTed alongside "Express Interest" (no upload/storage
// service in this demo — see StudentVentureMatch's cvDataUrl field).
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('failed to read file'));
    reader.readAsDataURL(file);
  });
}
