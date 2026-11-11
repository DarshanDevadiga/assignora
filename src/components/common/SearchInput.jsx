import React from 'react'
import { Search, X } from 'lucide-react'

export default function SearchInput({
  value,
  onChange,
  placeholder = 'Search classes, assignments, students...',
  className = '',
  onClear,
}) {
  return (
    <div className={`relative w-full ${className}`}>
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
        <Search className="w-4 h-4" />
      </div>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-full border border-brand-line/80 bg-slate-50/80 hover:bg-white pl-10 pr-9 py-2 text-sm text-brand-heading placeholder:text-slate-400 transition-all focus:bg-white focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:shadow-glow-sm"
      />
      {value && (
        <button
          type="button"
          onClick={onClear || (() => onChange({ target: { value: '' } }))}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
