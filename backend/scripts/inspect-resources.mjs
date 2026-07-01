import mammoth from "mammoth";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESOURCE = resolve(__dirname, "../../resource");

const en = await mammoth.extractRawText({
  path: resolve(RESOURCE, "English", "Sodiq_School_Ingliz_tili_kirish_imtihoni_5-sinf.docx"),
});
console.log("ENGLISH 5-sinf, total length:", en.value.length);
console.log("---- first 4000 chars ----");
console.log(en.value.slice(0, 4000));
