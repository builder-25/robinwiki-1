'use client'
import { useParams } from 'next/navigation'

export default function WikiDetailPage() {
  const { id } = useParams<{ id: string }>()
  return (
    <div className="p-6">
      <h1>Wiki: {id}</h1>
      <p className="text-muted-foreground">Content will load from API when hooks are wired.</p>
    </div>
  )
}
