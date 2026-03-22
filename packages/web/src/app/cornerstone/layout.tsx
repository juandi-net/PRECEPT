export default function CornerstoneLayout({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ maxWidth: '48rem', marginLeft: 'auto', marginRight: 'auto', padding: '1.5rem' }}>
      {children}
    </main>
  )
}
