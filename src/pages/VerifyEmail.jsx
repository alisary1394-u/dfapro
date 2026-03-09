import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export default function VerifyEmail() {
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setStatus('success');
    setMessage('تم تعطيل التحقق بالبريد الإلكتروني. يمكنك تسجيل الدخول مباشرة.');
  }, []);

  return (
    <div className="min-h-screen bg-[#0b1120] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#111827] border border-[#1f2937] rounded-2xl p-8 text-center">
        <h1 className="text-3xl font-bold mb-4">التحقق من البريد</h1>
        <p className="text-slate-300 mb-6">{status === 'loading' ? 'جاري التحقق...' : message}</p>
        {status !== 'loading' ? (
          <Link to="/login" className="inline-block rounded-xl bg-[#d4a843] text-[#0f172a] font-bold px-6 py-3">
            الذهاب إلى تسجيل الدخول
          </Link>
        ) : null}
      </div>
    </div>
  );
}
