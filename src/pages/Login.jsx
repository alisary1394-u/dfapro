import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { isAuthenticated, setUser, setIsAuthenticated, setAuthError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'فشل تسجيل الدخول');
      }

      setUser(data.user);
      setIsAuthenticated(true);
      setAuthError(null);
      navigate('/');
    } catch (submitError) {
      setError(submitError.message || 'فشل تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b1120] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#111827] border border-[#1f2937] rounded-2xl p-8">
        <h1 className="text-3xl font-bold mb-2">تسجيل الدخول</h1>
        <p className="text-sm text-slate-400 mb-6">ادخل إلى حسابك للمتابعة</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="البريد الإلكتروني"
            className="w-full rounded-xl bg-[#0f172a] border border-[#334155] px-4 py-3 outline-none"
            required
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="كلمة المرور"
            className="w-full rounded-xl bg-[#0f172a] border border-[#334155] px-4 py-3 outline-none"
            required
          />
          {error ? <div className="text-sm text-red-400">{error}</div> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#d4a843] text-[#0f172a] font-bold py-3 disabled:opacity-60"
          >
            {loading ? 'جاري الدخول...' : 'دخول'}
          </button>
        </form>
        <div className="mt-6 text-sm text-slate-400">
          ليس لديك حساب؟{' '}
          <Link to="/register" className="text-[#d4a843]">إنشاء حساب</Link>
        </div>
      </div>
    </div>
  );
}
