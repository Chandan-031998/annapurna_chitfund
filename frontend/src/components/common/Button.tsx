import { ButtonHTMLAttributes } from 'react'

export function Button({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`inline-flex min-h-10 items-center justify-center rounded-lg bg-gradient-to-r from-brand-600 to-cyan-500 px-4 py-2 font-semibold text-white shadow-lg shadow-sky-200/60 transition hover:from-brand-700 hover:to-cyan-600 ${className}`} {...props} />
}
