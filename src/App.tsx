import React, { useEffect, useMemo, useState } from 'react'

type Job = {
  id: string
  company: string
  role: string
  link?: string
  notes?: string
  applied: boolean
  date?: string // ISO
}

const STORAGE_KEY = 'job-tracker-data-v1'
const uid = () => Math.random().toString(36).slice(2, 10)

export default function App() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [search, setSearch] = useState('')
  const [onlyUnapplied, setOnlyUnapplied] = useState(false)

  // Form
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [link, setLink] = useState('')
  const [notes, setNotes] = useState('')
  const [applied, setApplied] = useState(false)

  // Load/save
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      try { setJobs(JSON.parse(raw)) } catch {}
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs))
  }, [jobs])

  const totals = useMemo(() => {
    const total = jobs.length
    const appliedCount = jobs.filter(j => j.applied).length
    return { total, appliedCount, unappliedCount: total - appliedCount }
  }, [jobs])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return jobs.filter(j => {
      const matches = (j.company + ' ' + j.role + ' ' + (j.notes ?? '')).toLowerCase().includes(q)
      const pass = onlyUnapplied ? !j.applied : true
      return matches && pass
    })
  }, [jobs, search, onlyUnapplied])

  function clearForm() {
    setCompany(''); setRole(''); setLink(''); setNotes(''); setApplied(false)
  }

  function addJob() {
    if (!company.trim() || !role.trim()) return
    const job: Job = {
      id: uid(),
      company: company.trim(),
      role: role.trim(),
      link: link.trim() || undefined,
      notes: notes.trim() || undefined,
      applied,
      date: new Date().toISOString(),
    }
    setJobs(prev => [job, ...prev])
    clearForm()
  }

  function toggleApplied(id: string) {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, applied: !j.applied } : j))
  }

  function removeJob(id: string) {
    setJobs(prev => prev.filter(j => j.id !== id))
  }

  function removeAll() {
    if (confirm('Delete ALL jobs?')) setJobs([])
  }

  // CSV export/import
  function exportCSV() {
    const header = ['Company','Role','Link','Applied','Date','Notes']
    const lines = jobs.map(j => [
      esc(j.company),
      esc(j.role),
      esc(j.link ?? ''),
      j.applied ? 'Yes' : 'No',
      j.date ? new Date(j.date).toLocaleDateString() : '',
      esc(j.notes ?? ''),
    ].join(','))
    const csv = [header.join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `job-tracker-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function esc(v: string) {
    if (v.includes(',') || v.includes('\n') || v.includes('"')) {
      return '"' + v.replaceAll('"', '""') + '"'
    }
    return v
  }

  function importCSVText(text: string) {
    const rows = text.split(/\r?\n/).filter(Boolean)
    if (!rows.length) return
    const header = rows.shift()!.toLowerCase()
    const hs = header.split(',')
    const idx = {
      company: hs.findIndex(h => h.includes('company')),
      role: hs.findIndex(h => h.includes('role')),
      link: hs.findIndex(h => h.includes('link')),
      applied: hs.findIndex(h => h.includes('applied')),
      date: hs.findIndex(h => h.includes('date')),
      notes: hs.findIndex(h => h.includes('note')),
    }
    const parsed: Job[] = rows.map(r => {
      const cols = splitCsvRow(r)
      const appliedVal = (idx.applied >= 0 ? (cols[idx.applied] || '').toLowerCase() : '').startsWith('y') || (cols[idx.applied] || '').toLowerCase() === 'true'
      return {
        id: uid(),
        company: cols[idx.company] || '',
        role: cols[idx.role] || '',
        link: cols[idx.link] || undefined,
        notes: cols[idx.notes] || undefined,
        applied: appliedVal,
        date: cols[idx.date] ? new Date(cols[idx.date]).toISOString() : undefined,
      }
    }).filter(j => j.company && j.role)
    setJobs(prev => [...parsed, ...prev])
  }

  function splitCsvRow(row: string): string[] {
    const out: string[] = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < row.length; i++) {
      const ch = row[i]
      if (ch === '"') {
        if (inQuotes && row[i+1] === '"') { cur += '"'; i++ } else { inQuotes = !inQuotes }
      } else if (ch === ',' && !inQuotes) {
        out.push(cur); cur = ''
      } else {
        cur += ch
      }
    }
    out.push(cur)
    return out.map(s => s.trim())
  }

  const [dragOver, setDragOver] = useState(false)

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = () => importCSVText(String(reader.result || ''))
    reader.readAsText(file)
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = () => importCSVText(String(reader.result || ''))
    reader.readAsText(file)
    e.currentTarget.value = '' // reset
  }

  return (
    <div className="container">
      <div className="row" style={{justifyContent:'space-between'}}>
        <h1>Job Application Tracker</h1>
        <div className="row">
          <button className="btn" onClick={exportCSV} title="Export CSV">Export</button>
          <button className="btn danger" onClick={removeAll} title="Delete all">Clear</button>
        </div>
      </div>

      <div className="row" style={{marginTop: 12}}>
        <div className="card grow">
          <div className="card-body">
            <div className="row">
              <div className="grow">
                <div className="muted">Total Jobs</div>
                <div className="kpi">{totals.total}</div>
              </div>
              <div className="grow">
                <div className="muted">Applied</div>
                <div className="kpi">{totals.appliedCount}</div>
              </div>
              <div className="grow">
                <div className="muted">Not Yet Applied</div>
                <div className="kpi">{totals.unappliedCount}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{marginTop: 12}}>
        <div className="card-body">
          <div className="row">
            <input className="grow" type="text" placeholder="Company" value={company} onChange={e=>setCompany(e.target.value)} />
            <input className="grow" type="text" placeholder="Role / Title" value={role} onChange={e=>setRole(e.target.value)} />
            <input className="grow" type="url" placeholder="Link (optional)" value={link} onChange={e=>setLink(e.target.value)} />
            <label className="row" style={{gap:8}}>
              <input type="checkbox" checked={applied} onChange={e=>setApplied(e.target.checked)} />
              Applied
            </label>
            <button className="btn primary" onClick={addJob}>Add</button>
          </div>
          <div className="row" style={{marginTop: 10}}>
            <textarea className="grow" placeholder="Notes (optional)" value={notes} onChange={e=>setNotes(e.target.value)} rows={2}></textarea>
          </div>
        </div>
      </div>

      <div className="row" style={{marginTop: 12}}>
        <input className="grow" type="text" placeholder="Search company, role, notes…" value={search} onChange={e=>setSearch(e.target.value)} />
        <button className="btn" onClick={()=>setOnlyUnapplied(v=>!v)}>{onlyUnapplied ? 'Show All' : 'Only Not Applied'}</button>

        <label className={"dragzone"} onDragOver={(e)=>{e.preventDefault(); setDragOver(true)}} onDragLeave={()=>setDragOver(false)} onDrop={onDrop}>
          <input type="file" accept=".csv" style={{display:'none'}} onChange={onPick} />
          Drag & drop CSV to import (or click)
        </label>
        <a className="btn" href="/job_tracker_seed.csv" download>Seed CSV</a>
      </div>

      <div className="card" style={{marginTop: 12}}>
        <div className="card-body" style={{padding:0}}>
          <div style={{overflowX:'auto'}}>
            <table>
              <thead>
                <tr>
                  <th>Applied</th>
                  <th>Company</th>
                  <th>Role</th>
                  <th>Date</th>
                  <th>Link</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{padding:24, textAlign:'center'}} className="muted">No jobs yet. Add some above ✨</td></tr>
                ) : filtered.map(j => (
                  <tr key={j.id}>
                    <td><input type="checkbox" checked={j.applied} onChange={()=>toggleApplied(j.id)} /></td>
                    <td><strong>{j.company}</strong></td>
                    <td>{j.role}</td>
                    <td>{j.date ? new Date(j.date).toLocaleDateString() : '—'}</td>
                    <td>{j.link ? <a href={j.link} target="_blank" rel="noreferrer">Open</a> : '—'}</td>
                    <td style={{whiteSpace:'pre-wrap'}}>{j.notes || '—'}</td>
                    <td><button className="btn" onClick={()=>removeJob(j.id)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <p className="muted" style={{textAlign:'center', marginTop: 16}}>Your data is saved locally in your browser (no server).</p>
    </div>
  )
}