// Lead / o'quvchini va u bilan bog'liq HAMMA narsani o'chirish.
//
// Nega alohida: lead o'chirish (bulk) va o'quvchi o'chirish bir xil cascade'ni
// talab qiladi. Mantiq nusxalansa, ikkisi vaqt o'tib bir-biridan ajralib
// ketardi — biri natijani o'chirib, ikkinchisi qoldirib yuborardi.
//
// Cascade tartibi schema.prisma dagi onDelete'ga tayanadi:
//   - SubjectResult.result = Cascade  -> natija o'chsa fan natijalari ham
//   - TestAttempt.lead     = Cascade  -> lead o'chsa urinishlar ham
//   - Result.student       = Restrict -> shuning uchun natijani AVVAL o'chiramiz
//     (aks holda o'quvchini o'chirish bloklanardi). Schema O'ZGARTIRILMAYDI —
//     jonli DBda FK cheklovini o'zgartirgandan ko'ra shu yerda tartib bilan
//     o'chirish xavfsizroq va ko'rinarli.

import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";

type Tx = Prisma.TransactionClient;

/**
 * O'quvchi + uning barcha natijalari (nashr qilingani ham), fan natijalari,
 * leadlari va urinishlarini o'chiradi. Guardrailsiz — chaqiruvchi tasdiqni
 * o'zi so'raydi.
 */
async function deleteStudentWithin(tx: Tx, studentId: string): Promise<void> {
  // Natijalar (SubjectResult Cascade orqali ular bilan birga ketadi).
  await tx.result.deleteMany({ where: { studentId } });
  // Shu o'quvchiga bog'langan leadlar (TestAttempt Cascade orqali urinishlar
  // ham). Funnel'da o'quvchi bitta leaddan tug'iladi, lekin bir nechta bo'lsa
  // ham hammasi tozalanadi.
  await tx.lead.deleteMany({ where: { studentId } });
  await tx.student.delete({ where: { id: studentId } });
}

/** O'quvchini butunlay o'chiradi (bitta tranzaksiya). */
export async function deleteStudentCascade(studentId: string): Promise<void> {
  await prisma.$transaction((tx) => deleteStudentWithin(tx, studentId));
}

/**
 * Leadni butunlay o'chiradi.
 *   - O'quvchi yaratgan bo'lsa (imtihonni tugatgan) — butun odamni o'chiradi
 *     (natija/hisobot ham), ya'ni deleteStudentWithin.
 *   - Chala qolgan bo'lsa — faqat lead + urinishlari (Cascade).
 */
export async function deleteLeadCascade(leadId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findUnique({ where: { id: leadId }, select: { studentId: true } });
    if (!lead) return;
    if (lead.studentId) {
      await deleteStudentWithin(tx, lead.studentId);
    } else {
      await tx.lead.delete({ where: { id: leadId } });
    }
  });
}
