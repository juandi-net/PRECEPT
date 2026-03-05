export default async function InspectTaskPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div style={{
      fontFamily: "'Times New Roman', Times, serif",
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      color: '#111',
    }}>
      <h1 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Task {id}</h1>
      <p style={{ color: '#999' }}>Task inspection coming soon.</p>
      <a href="/interface" style={{ marginTop: '1rem', color: '#111' }}>Back to Interface</a>
    </div>
  )
}
