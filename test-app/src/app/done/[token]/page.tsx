"use client";

// Yakuniy sahifa — testni tugatgan bolaga xabar. Natijalar admin
// tomonidan draft'dan publishga o'tkazilgach ko'rishi mumkin bo'ladi.

export default function DonePage() {
  return (
    <div className="max-w-md mx-auto p-6 pt-16 text-center space-y-4">
      <div className="text-5xl">🎉</div>
      <h1 className="text-2xl font-semibold text-navy">Testni muvaffaqiyatli tugatdingiz!</h1>
      <p className="text-sm text-gray-600">
        Javoblaringiz saqlandi va tekshirish uchun ma'muriyatga yuborildi.
        Natijangizni ma'muriyat tekshirib bo'lganidan so'ng, sizga
        login va parol beriladi. Iltimos, qabulxonaga murojaat qiling.
      </p>
      <div className="text-xs text-gray-400 pt-4">
        Bu oyna endi yopilishi mumkin.
      </div>
    </div>
  );
}
