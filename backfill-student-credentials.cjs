require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const p = new PrismaClient();

// Login format: LastInit + FirstInit + UID (fallback: student.id oxiri).
function buildLoginCode({ firstName, lastName, fullName, uid, id }) {
  const clean = (s) => (s ?? "").trim();
  let first = clean(firstName);
  let last = clean(lastName);
  if (!first || !last) {
    const parts = clean(fullName).split(/\s+/).filter(Boolean);
    if (!first && parts[0]) first = parts[0];
    if (!last && parts.length >= 2) last = parts.slice(1).join(" ");
  }
  const li = last.charAt(0).toUpperCase() || "X";
  const fi = first.charAt(0).toUpperCase() || "X";
  const suffix = clean(uid) || id.replace(/-/g, "").slice(-8).toUpperCase();
  return `${li}${fi}${suffix}`;
}

const PW_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
function generatePassword(length = 10) {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += PW_ALPHABET[Math.floor(Math.random() * PW_ALPHABET.length)];
  }
  return out;
}

async function uniqueLogin(base, excludeId) {
  let candidate = base;
  let n = 2;
  for (let i = 0; i < 20; i++) {
    const existing = await p.student.findFirst({
      where: { loginCode: candidate, NOT: { id: excludeId } },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${base}-${n}`;
    n++;
  }
  return `${base}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

(async () => {
  const students = await p.student.findMany({
    where: { OR: [{ loginCode: null }, { accessPasswordHash: null }] },
    select: { id: true, firstName: true, lastName: true, fullName: true, uid: true, loginCode: true, accessPasswordHash: true },
  });
  console.log("students missing credentials:", students.length);
  let touched = 0;
  for (const st of students) {
    const base = buildLoginCode(st);
    const loginCode = st.loginCode ?? (await uniqueLogin(base, st.id));
    const plain = generatePassword();
    const hash = await bcrypt.hash(plain, 12);
    await p.student.update({
      where: { id: st.id },
      data: {
        loginCode,
        accessPassword: plain,
        accessPasswordHash: hash,
      },
    });
    console.log(`SET ${st.fullName} → ${loginCode} / ${plain}`);
    touched++;
  }
  console.log("---");
  console.log("credentials issued:", touched);
  await p.$disconnect();
})();
