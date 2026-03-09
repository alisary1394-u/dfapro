import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  Link2, Unlink2, Zap, AlertCircle, CheckCircle2,
  Loader2, Eye, EyeOff, Copy, Check, Save
} from "lucide-react";

export default function BrokerManager() {
  const [mode, setMode] = useState("paper"); // "paper" | "live"
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [account, setAccount] = useState(null);
  const [error, setError] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [savedKeys, setSavedKeys] = useState(null); // { hasKeys, apiKeyHint, baseUrl }
  const [credentials, setCredentials] = useState({
    apiKey: "",
    secretKey: "",
    baseUrl: "https://paper-api.alpaca.markets",
  });
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load initial account data + check for saved keys
  useEffect(() => {
    if (mode === "paper") {
      fetchAccount("paper");
    }
    // Check if keys are saved in secrets
    base44.functions.invoke("brokerIntegration", { action: "getSavedKeys" })
      .then(res => {
        if (res.data?.hasKeys) {
          setSavedKeys(res.data);
        }
      }).catch(() => {});
  }, []);

  const fetchAccount = async (tradingMode) => {
    setLoading(true);
    setError("");
    try {
      const res = await base44.functions.invoke("brokerIntegration", {
        action: "account",
        mode: tradingMode,
      });
      setAccount(res.data);
      setConnected(true);
    } catch (err) {
      setError(err.message || "Failed to connect to broker");
      setConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectLive = async (overrideCredentials = null) => {
    const creds = overrideCredentials || credentials;
    const usingSaved = !creds.apiKey && !creds.secretKey && savedKeys?.hasKeys;
    if (!usingSaved && (!creds.apiKey || !creds.secretKey)) {
      setError("يرجى إدخال API Key و Secret Key");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const payload = { action: "account", mode: "live" };
      if (!usingSaved) {
        payload.apiKey = creds.apiKey;
        payload.secretKey = creds.secretKey;
        payload.baseUrl = creds.baseUrl;
      }
      const res = await base44.functions.invoke("brokerIntegration", payload);
      if (res.data?.error) {
        setError(res.data.error);
        return;
      }
      setAccount(res.data);
      setConnected(true);
      setShowConfig(false);
      setMode("live");
      setSavedKeys(null);
    } catch (err) {
      setError(err.message || "فشل الاتصال بالوسيط");
    } finally {
      setLoading(false);
    }
  };

  const disconnect = () => {
    setConnected(false);
    setAccount(null);
    setMode("paper");
    setCredentials({ apiKey: "", secretKey: "", baseUrl: "https://paper-api.alpaca.markets" });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveCredentials = async () => {
    if (!credentials.apiKey || !credentials.secretKey) {
      setError("يرجى إدخال API Key و Secret Key أولاً");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await base44.auth.updateMe({
        alpaca_api_key: credentials.apiKey,
        alpaca_secret_key: credentials.secretKey,
        alpaca_base_url: credentials.baseUrl,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError("فشل الحفظ، يرجى المحاولة مرة أخرى");
    }
    setSaving(false);
  };

  return (
    <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${connected ? 'bg-emerald-500/20' : 'bg-[#1e293b]'}`}>
            {connected ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <Link2 className="w-5 h-5 text-[#94a3b8]" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">إدارة الوسيط</h3>
            <p className="text-xs text-[#94a3b8]">
              {connected ? `متصل - ${mode === 'live' ? 'تداول حقيقي' : 'تداول تجريبي'}` : 'غير متصل'}
            </p>
          </div>
        </div>
        {connected && (
          <button
            onClick={disconnect}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-bold hover:bg-red-500/30 transition-all"
          >
            <Unlink2 className="w-4 h-4" /> قطع الاتصال
          </button>
        )}
      </div>

      {/* Mode Selector */}
      <div className="mb-6">
        <label className="text-xs text-[#64748b] block mb-2">وضع التداول</label>
        <div className="flex gap-2">
          <button
            onClick={() => { setMode("paper"); setShowConfig(false); }}
            className={`flex-1 py-2 px-4 rounded-xl font-semibold text-sm transition-all ${
              mode === "paper"
                ? "bg-[#d4a843]/20 border border-[#d4a843]/60 text-[#d4a843]"
                : "bg-[#0f1623] border border-[#1e293b] text-[#94a3b8] hover:text-white"
            }`}
          >
            📊 تجريبي (محاكاة)
          </button>
          <button
            onClick={() => { setMode("live"); setShowConfig(true); }}
            className={`flex-1 py-2 px-4 rounded-xl font-semibold text-sm transition-all ${
              mode === "live"
                ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
                : "bg-[#0f1623] border border-[#1e293b] text-[#94a3b8] hover:text-white"
            }`}
          >
            ⚡ حقيقي (Alpaca)
          </button>
        </div>
      </div>

      {/* Live Configuration */}
      {showConfig && (
        <div className="mb-6 p-4 bg-[#0f1623] border border-[#1e293b] rounded-xl space-y-4">
          {/* Saved Keys Banner */}
          {savedKeys?.hasKeys && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-emerald-400 font-semibold">✓ مفاتيح محفوظة متاحة</p>
                <p className="text-xs text-[#94a3b8]">API Key: {savedKeys.apiKeyHint}</p>
              </div>
              <button
                onClick={() => handleConnectLive({ apiKey: "", secretKey: "", baseUrl: "" })}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold hover:bg-emerald-500/30 transition-all"
              >
                استخدامها تلقائياً
              </button>
            </div>
          )}
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-xs text-blue-300 mb-1 font-semibold">📌 كيف تحصل على مفاتيح API؟</p>
            <ol className="text-xs text-[#94a3b8] space-y-1 list-decimal list-inside">
              <li>اذهب إلى <a href="https://app.alpaca.markets" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline font-bold">app.alpaca.markets</a></li>
              <li>سجّل حساب مجاني (Paper Trading)</li>
              <li>اذهب إلى Account → API Keys</li>
              <li>انسخ API Key و Secret Key</li>
            </ol>
          </div>
          <div>
            <label className="text-xs text-[#64748b] block mb-2">API Key</label>
            <input
              type="password"
              value={credentials.apiKey}
              onChange={(e) => setCredentials({ ...credentials, apiKey: e.target.value })}
              placeholder="sk_live_..."
              className="w-full bg-[#0a0e17] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#d4a843]/50"
            />
          </div>
          <div>
            <label className="text-xs text-[#64748b] block mb-2">Secret Key</label>
            <div className="flex gap-2">
              <input
                type={showSecret ? "text" : "password"}
                value={credentials.secretKey}
                onChange={(e) => setCredentials({ ...credentials, secretKey: e.target.value })}
                placeholder="••••••••"
                className="flex-1 bg-[#0a0e17] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#d4a843]/50"
              />
              <button
                onClick={() => setShowSecret(!showSecret)}
                className="p-2 rounded-lg bg-[#1e293b] hover:bg-[#293548] transition-colors"
              >
                {showSecret ? (
                  <EyeOff className="w-4 h-4 text-[#94a3b8]" />
                ) : (
                  <Eye className="w-4 h-4 text-[#94a3b8]" />
                )}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-[#64748b] block mb-2">Base URL (Endpoint)</label>
            <select
              value={credentials.baseUrl}
              onChange={(e) => setCredentials({ ...credentials, baseUrl: e.target.value })}
              className="w-full bg-[#0a0e17] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#d4a843]/50 mb-2"
            >
              <option value="https://paper-api.alpaca.markets">تجريبي - Paper Trading</option>
              <option value="https://api.alpaca.markets">حقيقي - Live Trading</option>
            </select>
            <input
              type="text"
              value={credentials.baseUrl}
              onChange={(e) => setCredentials({ ...credentials, baseUrl: e.target.value })}
              placeholder="https://paper-api.alpaca.markets"
              className="w-full bg-[#0a0e17] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#d4a843]/50"
            />
            <p className="text-[10px] text-[#64748b] mt-1">يمكنك تعديل الرابط يدوياً إذا كنت تستخدم endpoint مخصص</p>
          </div>
          {/* Save Button */}
          <button
            onClick={handleSaveCredentials}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[#d4a843]/20 border border-[#d4a843]/40 text-[#d4a843] font-semibold text-sm hover:bg-[#d4a843]/30 disabled:opacity-50 transition-all"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</>
            ) : saved ? (
              <><Check className="w-4 h-4" /> تم الحفظ بنجاح!</>
            ) : (
              <><Save className="w-4 h-4" /> حفظ المفاتيح والرابط</>
            )}
          </button>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleConnectLive}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-semibold hover:bg-emerald-500/30 disabled:opacity-50 transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> جاري الاتصال...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" /> اتصال
                </>
              )}
            </button>
            <button
              onClick={() => setShowConfig(false)}
              className="flex-1 py-2 rounded-lg bg-[#1e293b] text-[#94a3b8] font-semibold hover:text-white transition-all"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Account Info */}
      {account && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-[#0f1623] border border-[#1e293b] rounded-xl p-3">
              <p className="text-xs text-[#64748b] mb-1">رأس المال</p>
              <p className="text-lg font-bold text-white">
                ${account.cash?.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-[#0f1623] border border-[#1e293b] rounded-xl p-3">
              <p className="text-xs text-[#64748b] mb-1">قيمة المحفظة</p>
              <p className="text-lg font-bold text-white">
                ${account.portfolio_value?.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-[#0f1623] border border-[#1e293b] rounded-xl p-3">
              <p className="text-xs text-[#64748b] mb-1">قوة الشراء</p>
              <p className="text-lg font-bold text-emerald-400">
                ${account.buying_power?.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-[#0f1623] border border-[#1e293b] rounded-xl p-3">
              <p className="text-xs text-[#64748b] mb-1">الحالة</p>
              <p className={`text-lg font-bold ${account.status === 'active' || account.status === 'paper_trading' ? 'text-emerald-400' : 'text-yellow-400'}`}>
                {account.status === 'active' ? '✓ نشط' : account.status === 'paper_trading' ? '✓ تجريبي' : `⏳ ${account.status || 'قيد المراجعة'}`}
              </p>
            </div>
          </div>

          {/* API Docs Link */}
          {mode === "live" && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-xs text-blue-400">
                📚 الحصول على مفاتيح API من{" "}
                <a
                  href="https://app.alpaca.markets/paper-trading/overview"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold underline hover:opacity-80"
                >
                  Alpaca Dashboard
                </a>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Paper Trading Info */}
      {!connected && mode === "paper" && (
        <button
          onClick={() => fetchAccount("paper")}
          className="w-full py-2 px-4 rounded-xl bg-[#d4a843]/20 border border-[#d4a843]/60 text-[#d4a843] font-semibold hover:bg-[#d4a843]/30 transition-all"
        >
          تحميل حساب التداول التجريبي
        </button>
      )}
    </div>
  );
}