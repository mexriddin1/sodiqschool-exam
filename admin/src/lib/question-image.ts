// Savol rasmini tayyorlash: fayldan yoki buferdan -> data-URL.
//
// Nega alohida fayl: QuestionBuilder savol MUHARRIRI, bu esa rasmni siqish va
// buferdan o'qish — boshqa mavzu, va brauzer API'lariga (canvas, clipboard)
// tayanadi. Ajratilgani uchun uni muharrirni ko'tarmasdan sinab ko'rish
// mumkin.

// Backend'da hali rasm endpointi yo'q: rasm savol JSON'ining ICHIDA data-URL
// bo'lib yotadi. Shuning uchun hajm cheklangan — 50 savolli test har biriga
// 200KB dan olsa, o'quvchiga 10MB javob ketardi.
export const MAX_IMAGE_BYTES = 200_000;

// Skrinshot deyarli har doim shu chegaradan oshadi. Ilgari rad etardik va
// admin rasmni o'zi kichraytirishga majbur edi; endi brauzerda kichraytiramiz.
// Qadamlar ketma-ket sinaladi — birinchi sig'gani olinadi, ya'ni sifat faqat
// kerak bo'lganda pasayadi.
const COMPRESS_STEPS = [
  { maxDim: 1600, quality: 0.85 },
  { maxDim: 1600, quality: 0.7 },
  { maxDim: 1200, quality: 0.7 },
  { maxDim: 1200, quality: 0.55 },
  { maxDim: 900, quality: 0.55 },
  { maxDim: 700, quality: 0.45 },
];

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Rasmni o'qib bo'lmadi"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Qaysi formatda qayta kodlaymiz.
 *
 * WebP afzal: alfa kanalni saqlaydi va JPEG'dan yaxshiroq siqadi. Qo'llab-
 * quvvatlanmasa JPEG — u shaffoflikni bilmaydi, shuning uchun fonni OQ qilamiz
 * (aks holda shaffof joylar QORA bo'lib chiqadi).
 */
function pickEncoding(): { type: string; needsWhiteBackground: boolean } {
  const probe = document.createElement("canvas");
  probe.width = probe.height = 1;
  const webp = probe.toDataURL("image/webp").startsWith("data:image/webp");
  return webp
    ? { type: "image/webp", needsWhiteBackground: false }
    : { type: "image/jpeg", needsWhiteBackground: true };
}

/** Chegaraga sig'guncha kichraytiradi. Sig'masa — xato. */
async function shrinkImage(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("Rasmni o'qib bo'lmadi — fayl buzuq bo'lishi mumkin.");
  });
  const { type, needsWhiteBackground } = pickEncoding();
  try {
    let smallest: Blob | undefined;
    for (const step of COMPRESS_STEPS) {
      const scale = Math.min(1, step.maxDim / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Rasmni qayta ishlab bo'lmadi.");
      if (needsWhiteBackground) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, w, h);
      }
      ctx.drawImage(bitmap, 0, 0, w, h);

      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, step.quality));
      if (!blob) continue;
      smallest = blob;
      if (blob.size <= MAX_IMAGE_BYTES) return blob;
    }
    throw new Error(
      `Rasm juda katta — eng past sifatda ham ${Math.round((smallest?.size ?? 0) / 1000)}KB.`
        + " Rasmning kerakli qismini kesib oling.",
    );
  } finally {
    bitmap.close();
  }
}

/** Faylni (yoki buferdan kelgan rasmni) savolga qo'yiladigan data-URL'ga aylantiradi. */
export async function toQuestionImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Bu rasm fayli emas.");
  // Chegaraga sig'sa qayta kodlamaymiz — u faqat sifatni yeydi. Ya'ni ilgari
  // qabul qilingan rasmlar avvalgidek, tegilmagan holda o'tadi.
  if (file.size <= MAX_IMAGE_BYTES) return blobToDataUrl(file);
  return blobToDataUrl(await shrinkImage(file));
}

/**
 * Buferdagi rasmni oladi.
 *
 * Nega kerak: skrinshotni faylga saqlab, so'ng uni tanlash uch qadam edi.
 * Endi Win+Shift+S -> "Paste" — ikki qadam.
 */
export async function imageFromClipboard(): Promise<File> {
  if (!navigator.clipboard?.read) {
    throw new Error("Bu brauzer buferdan rasm o'qiy olmaydi — \"Rasm qo'shish\" bilan fayl tanlang.");
  }
  let items: ClipboardItem[];
  try {
    items = await navigator.clipboard.read();
  } catch {
    // Ruxsat berilmagan yoki sahifa fokusda emas.
    throw new Error("Buferga ruxsat berilmadi — brauzer so'raganda \"Allow\" ni bosing.");
  }
  for (const item of items) {
    const type = item.types.find((t) => t.startsWith("image/"));
    if (!type) continue;
    const blob = await item.getType(type);
    return new File([blob], `paste.${type.split("/")[1] || "png"}`, { type });
  }
  throw new Error("Buferda rasm yo'q. Avval skrinshot oling (Win+Shift+S), keyin \"Paste\" ni bosing.");
}
