import { QueryProvider } from '@/providers/QueryProvider'

export const metadata = {
  title: 'Robin Wiki',
  description: 'Your personal knowledge base',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
