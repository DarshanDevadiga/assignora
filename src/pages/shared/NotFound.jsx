import React from 'react'
import { useNavigate } from 'react-router-dom'
import { GraduationCap, ArrowLeft, Home, Compass } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/common/Button'

export default function NotFound() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const handleReturn = () => {
    if (user?.role === 'admin') {
      navigate('/admin')
    } else if (user?.role === 'student') {
      navigate('/student')
    } else {
      navigate('/login')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FF] via-[#F5F3FF] to-[#EDE9FE] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 -left-20 w-96 h-96 bg-brand-light/70 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-20 w-96 h-96 bg-brand-border/40 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-white rounded-3xl border border-brand-line/80 shadow-2xl p-8 text-center space-y-6 relative z-10 animate-fadeIn">
        <div className="w-16 h-16 rounded-2xl bg-brand-light text-brand-primary flex items-center justify-center mx-auto border border-brand-border shadow-xs">
          <Compass className="w-8 h-8 animate-spin-slow" />
        </div>

        <div className="space-y-2">
          <span className="text-4xl font-extrabold text-brand-primary tracking-tight">
            404
          </span>
          <h1 className="text-2xl font-bold text-brand-heading">
            Page Not Found
          </h1>
          <p className="text-sm text-brand-muted leading-relaxed">
            The page you are looking for doesn't exist, has been moved, or is temporarily unavailable.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="primary"
            icon={Home}
            onClick={handleReturn}
            className="w-full justify-center shadow-purple-glow font-semibold"
          >
            Back to Dashboard
          </Button>

          <Button
            variant="outline"
            icon={ArrowLeft}
            onClick={() => navigate(-1)}
            className="w-full justify-center"
          >
            Go Back
          </Button>
        </div>
      </div>
    </div>
  )
}
