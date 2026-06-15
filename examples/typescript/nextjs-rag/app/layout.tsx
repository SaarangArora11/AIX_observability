import './globals.css';

export const metadata = {
  title: 'Refract SDK Test',
  description: 'Testing @refract/sdk with Next.js',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
