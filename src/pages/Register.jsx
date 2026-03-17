import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

export default function Register() {
  const { isAuthenticated, setUser, setIsAuthenticated, setAuthError } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const validatePassword = (pw) => {
    if (pw.length < 8) return 'كلمة المرور يجب أن تكون 8 أحرف على الأقل';
    if (!/[A-Z]/.test(pw)) return 'كلمة المرور يجب أن تحتوي على حرف كبير';
    if (!/[a-z]/.test(pw)) return 'كلمة المرور يجب أن تحتوي على حرف صغير';
    if (!/[0-9]/.test(pw)) return 'كلمة المرور يجب أن تحتوي على رقم';
    return null;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    const pwError = validatePassword(password);
    if (pwError) {
      setError(pwError);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email, password })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'فشل إنشاء الحساب');
      }
      // Auto-login after registration
      if (data.user) {
        setUser(data.user);
        setIsAuthenticated(true);
        setAuthError(null);
      }
      setMessage('تم إنشاء الحساب بنجاح.');
    } catch (submitError) {
      setError(submitError.message || 'فشل إنشاء الحساب');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b1120] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#111827] border border-[#1f2937] rounded-2xl p-8">
        <h1 className="text-3xl font-bold mb-2">إنشاء حساب</h1>
        <p className="text-sm text-slate-400 mb-6">أنشئ حسابًا جديدًا للوصول إلى التطبيق</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            type="text"
            placeholder="الاسم"
            className="w-full rounded-xl bg-[#0f172a] border border-[#334155] px-4 py-3 outline-none"
            required
          />
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
            minLength={8}
            required
          />
          {error ? <div className="text-sm text-red-400">{error}</div> : null}
          {message ? <div className="text-sm text-emerald-400">{message}</div> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#d4a843] text-[#0f172a] font-bold py-3 disabled:opacity-60"
          >
            {loading ? 'جاري الإنشاء...' : 'إنشاء الحساب'}
          </button>
        </form>
        <div className="mt-6 text-sm text-slate-400">
          لديك حساب بالفعل؟{' '}
          <Link to="/login" className="text-[#d4a843]">تسجيل الدخول</Link>
        </div>
      </div>
    </div>
  );
}
