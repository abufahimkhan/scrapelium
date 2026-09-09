// Unsigned upload via plain fetch — no Cloudinary SDK dependency.
// Requires CLOUDINARY_CLOUD_NAME + CLOUDINARY_UPLOAD_PRESET env vars (never hardcode credentials).
export async function uploadToCloudinary(imageUrl: string): Promise<string> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) {
    throw new Error(
      "CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET env vars are required to upload images",
    );
  }

  const body = new URLSearchParams({
    file: imageUrl,
    upload_preset: uploadPreset,
  });
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: "POST",
      body,
    },
  );

  if (!res.ok) {
    throw new Error(
      `Cloudinary upload failed (${res.status}): ${await res.text()}`,
    );
  }

  const data = (await res.json()) as { secure_url?: string };
  if (!data.secure_url)
    throw new Error("Cloudinary response missing secure_url");
  return data.secure_url;
}
