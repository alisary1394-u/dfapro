import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setUser, setIsAuthenticated, setAuthError } = useAuth();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('رابط التحقق غير صالح');
      return;
    }

    const verify = async () => {
      try {
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ token })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.message || 'فشل التحقق من البريد الإلكتروني');
        }
        setUser(data.user);
        setIsAuthenticated(true);
        setAuthError(null);
        setStatus('success');
        setMessage('تم التحقق من بريدك الإلكتروني بنجاح. سيتم تحويلك إلى التطبيق.');
        setTimeout(() => navigate('/'), 1500);
      } catch (verifyError) {
        setStatus('error');
        setMessage(verifyError.message || 'فشل التحقق من البريد الإلكتروني');
      }
    };

    verify();
  }, [navigate, searchParams, setAuthError, setIsAuthenticated, setUser]);

  return (
    <div className="min-h-screen bg-[#0b1120] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#111827] border border-[#1f2937] rounded-2xl p-8 text-center">
        <h1 className="text-3xl font-bold mb-4">التحقق من البريد</h1>
        <p className="text-slate-300 mb-6">{status === 'loading' ? 'جاري التحقق...' : message}</p>
        {status === 'error' ? (
          <Link to="/login" className="inline-block rounded-xl bg-[#d4a843] text-[#0f172a] font-bold px-6 py-3">
            العودة إلى تسجيل الدخول
          </Link>
        ) : null}
      </div>
    </div>
  );
}
