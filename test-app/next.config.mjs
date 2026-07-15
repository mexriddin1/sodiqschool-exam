/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `output: "standalone"` ATAYLAB yo'q.
  //
  // Izohda u "admin deploymentiga o'xshaydi" deb yozilgan edi, lekin admin
  // standalone ishlatmaydi — u `next start` bilan yuradi. Natijada serverda
  // pm2 `next start` ni ishga tushirib, Next har so'rovda
  // `"next start" does not work with "output: standalone"` deb ogohlantirardi
  // (sayt baribir `.next` dan ishlab turardi, ya'ni xato jimgina qolgan).
  //
  // Endi admin bilan bir xil: `next start -p 3020`.
};

export default nextConfig;
