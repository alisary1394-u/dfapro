import React, { useState, useEffect } from "react";
import {
  AlertCircle, CheckCircle2,
  Loader2, Eye, EyeOff, Power, PowerOff, Key, Wifi, WifiOff
} from "lucide-react";
import { authClient } from "@/api/authClient";
import { useAuth } from "@/lib/AuthContext";
import { useBroker } from "@/lib/BrokerContext";
import {
  connectAlpaca,
  disconnectAlpaca,
  getAlpacaStatus,
  getAlpacaAccount,
  getAlpacaPositions,
  alpacaConfig,
} from "@/components/api/alpacaClient";

export default function BrokerManager() {
  const { user, setUser } = useAuth();
  const { setAlpacaActive } = useBroker();

  // ── Alpaca State ──
  const [alpacaConnected, setAlpacaConnected] = useState(false);
  const [alpacaLoading, setAlpacaLoading] = useState(false);
  const [alpacaError, setAlpacaError] = useState("");
  const [alpacaAccount, setAlpacaAccount] = useState(null);
  const [alpacaPositions, setAlpacaPositions] = useState([]);
  const alpacaSaved = alpacaConfig.getConfig();
  const [alpacaApiKey, setAlpacaApiKey] = useState(alpacaSaved?.apiKey || "");
  const [alpacaSecretKey, setAlpacaSecretKey] = useState(alpacaSaved?.secretKey || "");
  const [alpacaPaper, setAlpacaPaper] = useState(alpacaSaved?.paper !== false);
  const [showSecret, setShowSecret] = useState(false);

  // ── Market Data Provider Keys ──
  const [polygonKey, setPolygonKey] = useState("");
  const [showPolygonKey, setShowPolygonKey] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [alpacaSaveLoading, setAlpacaSaveLoading] = useState(false);
  const [alpacaSaveStatus, setAlpacaSaveStatus] = useState("");

  // ── Polygon S3 Keys ──
  const [polygonS3AccessKeyId, setPolygonS3AccessKeyId] = useState("");
  const [polygonS3SecretAccessKey, setPolygonS3SecretAccessKey] = useState("");
  const [polygonS3Endpoint, setPolygonS3Endpoint] = useState("");
  const [polygonS3Bucket, setPolygonS3Bucket] = useState("");
  const [polygonS3SaveStatus, setPolygonS3SaveStatus] = useState("");

  // Load S3 config from localStorage on mount
  useEffect(() => {
    try {
      const cfg = JSON.parse(localStorage.getItem('polygon_s3_config'));
      if (cfg) {
        setPolygonS3AccessKeyId(cfg.accessKeyId || "");
        setPolygonS3SecretAccessKey(cfg.secretAccessKey || "");
        setPolygonS3Endpoint(cfg.endpoint || "");
        setPolygonS3Bucket(cfg.bucket || "");
      }
    } catch {}
  }, []);

  function handleSavePolygonS3Keys() {
    const cfg = {
      accessKeyId: polygonS3AccessKeyId.trim(),
      secretAccessKey: polygonS3SecretAccessKey.trim(),
      endpoint: polygonS3Endpoint.trim(),
      bucket: polygonS3Bucket.trim(),
      enabled: true
    };
    localStorage.setItem('polygon_s3_config', JSON.stringify(cfg));
    setPolygonS3SaveStatus("تم حفظ مفاتيح S3 بنجاح.");
    setTimeout(() => setPolygonS3SaveStatus(""), 2500);
  }

  // ── Init: Check existing connections, auto-reconnect if keys saved ──
  useEffect(() => {
    getAlpacaStatus()
      .then(s => {
        if (s.connected) {
          setAlpacaConnected(true);
          setAlpacaActive(true, alpacaPaper);
          loadAlpacaData();
        } else {
          const saved = alpacaConfig.getConfig();
          if (saved?.apiKey && saved?.secretKey) {
            connectAlpaca(saved.apiKey, saved.secretKey, saved.paper !== false)
              .then(r => {
                if (r.connected) {
                  setAlpacaConnected(true);
                  setAlpacaActive(true, saved.paper !== false);
                  loadAlpacaData();
                }
              })
              .catch(() => {});
          }
        }
      })
      .catch(() => {});
  }, [alpacaPaper, setAlpacaActive]);

  useEffect(() => {
    if (!user) return;
    setAlpacaApiKey(user.alpaca_api_key || "");
    setAlpacaSecretKey(user.alpaca_secret_key || "");
    setPolygonKey(user.polygon_api_key || "");
  }, [user]);

  const handleSaveMarketKeys = async () => {
    setSaveLoading(true);
    setSaveError("");
    setSaveSuccess("");
    try {
      const updated = await authClient.updateMe({
        market_data_provider: 'polygon',
        polygon_api_key: polygonKey.trim(),
      });
      setUser(updated);
      setSaveSuccess("تم حفظ المفاتيح بنجاح. أي قيمة جديدة استبدلت القيمة القديمة.");
    } catch {
      setSaveError("تعذر حفظ المفاتيح الآن. حاول مرة أخرى.");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleSaveAlpacaKeys = async () => {
    setAlpacaSaveLoading(true);
    setAlpacaSaveStatus("");
    try {
      const updated = await authClient.updateMe({
        alpaca_api_key: alpacaApiKey.trim(),
        alpaca_secret_key: alpacaSecretKey.trim(),
      });
      setUser(updated);
      alpacaConfig.saveConfig({
        apiKey: alpacaApiKey.trim(),
        secretKey: alpacaSecretKey.trim(),
        paper: alpacaPaper,
        connected: alpacaConnected,
      });
      setAlpacaSaveStatus("تم حفظ مفاتيح Alpaca بنجاح واستبدال القيم القديمة.");
    } catch {
      setAlpacaSaveStatus("تعذر حفظ مفاتيح Alpaca حاليا.");
    } finally {
      setAlpacaSaveLoading(false);
    }
  };

  // ── Alpaca Functions ──
  const loadAlpacaData = async () => {
    try {
      const acct = await getAlpacaAccount();
      setAlpacaAccount(acct);
    } catch {}
    try {
      const pos = await getAlpacaPositions();
      setAlpacaPositions(Array.isArray(pos) ? pos : []);
    } catch {}
  };

  const handleAlpacaConnect = async () => {
    if (!alpacaApiKey || !alpacaSecretKey) {
      setAlpacaError("يرجى إدخال API Key و Secret Key");
      return;
    }
    setAlpacaLoading(true);
    setAlpacaError("");
    try {
      const result = await connectAlpaca(alpacaApiKey, alpacaSecretKey, alpacaPaper);
      if (result.connected) {
        setAlpacaConnected(true);
        setAlpacaActive(true, alpacaPaper);
        alpacaConfig.saveConfig({ apiKey: alpacaApiKey, secretKey: alpacaSecretKey, paper: alpacaPaper, connected: true });
        await loadAlpacaData();
      }
    } catch (err) {
      setAlpacaError("مفاتيح API غير صحيحة أو فشل الاتصال");
    }
    setAlpacaLoading(false);
  };

  const handleAlpacaDisconnect = async () => {
    try { await disconnectAlpaca(); } catch {}
    alpacaConfig.clearConfig();
    setAlpacaActive(false, alpacaPaper);
    setAlpacaConnected(false);
    setAlpacaAccount(null);
    setAlpacaPositions([]);
  };

  return (
    <div className="space-y-6">

      {/* ═══════ Alpaca Card ═══════ */}
      <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${alpacaConnected ? "bg-emerald-500/20" : "bg-[#ffeb3b]/10"}`}>
              <Key className={`w-5 h-5 ${alpacaConnected ? "text-emerald-400" : "text-[#ffeb3b]"}`} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Alpaca Markets</h3>
              <p className="text-xs text-[#94a3b8]">اتصال عبر API (سحابي - بدون برنامج)</p>
            </div>
          </div>
          {alpacaConnected ? (
            <button onClick={handleAlpacaDisconnect}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-bold hover:bg-red-500/30 transition-all">
              <PowerOff className="w-4 h-4" /> إيقاف
            </button>
          ) : (
            <button onClick={handleAlpacaConnect} disabled={alpacaLoading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-bold hover:bg-emerald-500/30 disabled:opacity-50 transition-all">
              {alpacaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
              {alpacaLoading ? "جاري الاتصال..." : "تشغيل"}
            </button>
          )}
        </div>

        {/* Connection Status */}
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border mb-4 ${alpacaConnected ? "bg-emerald-500/10 border-emerald-500/30" : "bg-[#0f1623] border-[#1e293b]"}`}>
          {alpacaConnected ? <Wifi className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4 text-[#64748b]" />}
          <span className={`text-sm font-semibold ${alpacaConnected ? "text-emerald-400" : "text-[#64748b]"}`}>
            {alpacaConnected ? (alpacaPaper ? "متصل (ورقي)" : "متصل (حقيقي)") : "غير متصل"}
          </span>
          {alpacaConnected && alpacaAccount && (
            <span className="text-xs text-[#94a3b8] mr-2 font-mono">({alpacaAccount.account_number})</span>
          )}
        </div>

        {/* API Keys Input */}
        {!alpacaConnected && (
          <div className="space-y-3 mb-4">
            <div>
              <label className="text-xs text-[#64748b] block mb-1.5">API Key</label>
              <input value={alpacaApiKey} onChange={e => setAlpacaApiKey(e.target.value)} placeholder="PK..."
                className="w-full bg-[#0a0e17] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#ffeb3b]/50"
                dir="ltr" autoComplete="off" />
            </div>
            <div>
              <label className="text-xs text-[#64748b] block mb-1.5">Secret Key</label>
              <div className="flex gap-2">
                <input type={showSecret ? "text" : "password"} value={alpacaSecretKey} onChange={e => setAlpacaSecretKey(e.target.value)}
                  placeholder="••••••••"
                  className="flex-1 bg-[#0a0e17] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#ffeb3b]/50"
                  dir="ltr" autoComplete="off" />
                <button onClick={() => setShowSecret(!showSecret)}
                  className="p-2 rounded-lg bg-[#1e293b] hover:bg-[#293548] transition-colors">
                  {showSecret ? <EyeOff className="w-4 h-4 text-[#94a3b8]" /> : <Eye className="w-4 h-4 text-[#94a3b8]" />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between bg-[#0a0e17] border border-[#1e293b] rounded-lg p-3 cursor-pointer" onClick={() => setAlpacaPaper(!alpacaPaper)}>
              <span className="text-sm text-[#d1d4dc]">تداول ورقي (Paper)</span>
              <div className={`w-10 h-[22px] rounded-full transition-all relative ${alpacaPaper ? "bg-[#ffeb3b]" : "bg-[#334155]"}`}>
                <span className={`absolute top-[3px] w-[16px] h-[16px] bg-white rounded-full transition-all shadow-sm ${alpacaPaper ? "right-[3px]" : "left-[3px]"}`} />
              </div>
            </div>

            <button
              onClick={handleSaveAlpacaKeys}
              disabled={alpacaSaveLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#d4a843]/20 border border-[#d4a843]/30 text-[#d4a843] text-sm font-bold hover:bg-[#d4a843]/30 disabled:opacity-60 transition-all"
            >
              {alpacaSaveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {alpacaSaveLoading ? "جاري الحفظ..." : "حفظ مفاتيح Alpaca"}
            </button>

            {alpacaSaveStatus && (
              <p className={`text-xs ${alpacaSaveStatus.includes("بنجاح") ? "text-emerald-400" : "text-red-400"}`}>
                {alpacaSaveStatus}
              </p>
            )}
          </div>
        )}

        {/* Alpaca Error */}
        {alpacaError && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl mb-4">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <p className="text-xs text-red-400">{alpacaError}</p>
          </div>
        )}

        {/* Alpaca Account Info */}
        {alpacaConnected && alpacaAccount && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { label: "رأس المال", value: alpacaAccount.cash, color: "text-white" },
              { label: "قيمة المحفظة", value: alpacaAccount.equity, color: "text-white" },
              { label: "القوة الشرائية", value: alpacaAccount.buying_power, color: "text-emerald-400" },
              { label: "الحالة", value: null, status: alpacaAccount.status },
            ].map((item, i) => (
              <div key={i} className="bg-[#0f1623] border border-[#1e293b] rounded-xl p-3">
                <p className="text-xs text-[#64748b] mb-1">{item.label}</p>
                {item.status ? (
                  <p className={`text-lg font-bold ${item.status === "ACTIVE" || item.status === "active" ? "text-emerald-400" : "text-yellow-400"}`}>
                    {item.status === "ACTIVE" || item.status === "active" ? "✓ نشط" : item.status}
                  </p>
                ) : (
                  <p className={`text-lg font-bold ${item.color}`}>
                    $ {Number(item.value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Alpaca Positions */}
        {alpacaConnected && alpacaPositions.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-[#94a3b8] mb-2">المراكز المفتوحة ({alpacaPositions.length})</h4>
            <div className="max-h-[160px] overflow-y-auto space-y-1 custom-scrollbar">
              {alpacaPositions.map((pos, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#0f1623] border border-[#1e293b]">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{pos.symbol}</span>
                    <span className="text-xs text-[#64748b]">×{pos.qty}</span>
                  </div>
                  <span className={`text-xs font-mono font-bold ${Number(pos.unrealized_pl) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {Number(pos.unrealized_pl) >= 0 ? "+" : ""}{Number(pos.unrealized_pl).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alpaca Setup Instructions */}
        {!alpacaConnected && (
          <div className="p-3 bg-[#0f1623] border border-[#1e293b] rounded-xl mt-2">
            <p className="text-xs text-[#64748b] mb-1 font-semibold">📌 خطوات الإعداد:</p>
            <ol className="text-xs text-[#94a3b8] space-y-0.5 list-decimal list-inside">
              <li>سجّل في <a href="https://alpaca.markets" target="_blank" rel="noopener noreferrer" className="text-[#ffeb3b] font-bold underline">alpaca.markets</a></li>
              <li>اذهب إلى <span className="text-[#ffeb3b] font-bold">API Keys</span> في لوحة التحكم</li>
              <li>أنشئ مفتاح API جديد</li>
              <li>أدخل API Key و Secret Key أعلاه واضغط <span className="text-emerald-400 font-bold">تشغيل</span></li>
            </ol>
          </div>
        )}
      </div>

      {/* ═══════ Polygon Market Data Card ═══════ */}
      <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#d4a843]/15">
              <Key className="w-5 h-5 text-[#d4a843]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Polygon.io — مفاتيح بيانات السوق</h3>
              <p className="text-xs text-[#94a3b8]">احفظ المفاتيح فوريا. التعديل يستبدل المفتاح القديم تلقائيا.</p>
            </div>
          </div>
          <button
            onClick={handleSaveMarketKeys}
            disabled={saveLoading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-bold hover:bg-emerald-500/30 disabled:opacity-60 transition-all"
          >
            {saveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {saveLoading ? "جاري الحفظ..." : "حفظ"}
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-[#64748b] block mb-1.5">Polygon API Key</label>
            <div className="flex gap-2">
              <input
                type={showPolygonKey ? "text" : "password"}
                value={polygonKey}
                onChange={(e) => setPolygonKey(e.target.value)}
                placeholder="POLYGON_API_KEY"
                className="flex-1 bg-[#0a0e17] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#d4a843]/50"
                dir="ltr"
                autoComplete="off"
              />
              <button onClick={() => setShowPolygonKey(!showPolygonKey)} className="p-2 rounded-lg bg-[#1e293b] hover:bg-[#293548] transition-colors">
                {showPolygonKey ? <EyeOff className="w-4 h-4 text-[#94a3b8]" /> : <Eye className="w-4 h-4 text-[#94a3b8]" />}
              </button>
            </div>
          </div>

          {/* Polygon S3 Flat Files Keys */}
          <div className="mt-6 p-4 bg-[#0f1623] border border-[#1e293b] rounded-xl">
            <h4 className="text-base font-bold text-[#d4a843] mb-2">مفاتيح S3 Polygon Flat Files</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
              <div>
                <label className="text-xs text-[#64748b] block mb-1.5">S3 Access Key ID</label>
                <input
                  value={polygonS3AccessKeyId}
                  onChange={e => setPolygonS3AccessKeyId(e.target.value)}
                  placeholder="ACCESS_KEY_ID"
                  className="w-full bg-[#0a0e17] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#d4a843]/50"
                  dir="ltr"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="text-xs text-[#64748b] block mb-1.5">S3 Secret Access Key</label>
                <input
                  type="password"
                  value={polygonS3SecretAccessKey}
                  onChange={e => setPolygonS3SecretAccessKey(e.target.value)}
                  placeholder="SECRET_ACCESS_KEY"
                  className="w-full bg-[#0a0e17] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#d4a843]/50"
                  dir="ltr"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="text-xs text-[#64748b] block mb-1.5">S3 Endpoint</label>
                <input
                  value={polygonS3Endpoint}
                  onChange={e => setPolygonS3Endpoint(e.target.value)}
                  placeholder="https://s3.amazonaws.com"
                  className="w-full bg-[#0a0e17] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#d4a843]/50"
                  dir="ltr"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="text-xs text-[#64748b] block mb-1.5">S3 Bucket</label>
                <input
                  value={polygonS3Bucket}
                  onChange={e => setPolygonS3Bucket(e.target.value)}
                  placeholder="اسم البكت"
                  className="w-full bg-[#0a0e17] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#d4a843]/50"
                  dir="ltr"
                  autoComplete="off"
                />
              </div>
            </div>
            <button
              onClick={handleSavePolygonS3Keys}
              className="mt-2 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#d4a843]/20 border border-[#d4a843]/30 text-[#d4a843] text-sm font-bold hover:bg-[#d4a843]/30 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" /> حفظ مفاتيح S3
            </button>
            {polygonS3SaveStatus && (
              <p className="text-xs text-emerald-400 mt-2">{polygonS3SaveStatus}</p>
            )}
          </div>
        </div>

        {saveError && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl mt-4">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <p className="text-xs text-red-400">{saveError}</p>
          </div>
        )}

        {saveSuccess && (
          <div className="flex items-start gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl mt-4">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <p className="text-xs text-emerald-400">{saveSuccess}</p>
          </div>
        )}
      </div>
    </div>
  );
}
