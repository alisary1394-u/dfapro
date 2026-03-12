import React, { useState, useEffect } from "react";
import {
  Link2, Unlink2, Zap, AlertCircle, CheckCircle2,
  Loader2, Eye, EyeOff, Power, PowerOff, Key, Wifi, WifiOff
} from "lucide-react";
import { authClient } from "@/api/authClient";
import { useAuth } from "@/lib/AuthContext";
import {
  connectToGateway,
  disconnectFromGateway,
  getConnectionStatus,
  getAccounts,
  getAccountSummary,
  getPositions,
  ibkrConfig,
} from "@/components/api/ibkrClient";
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

  // ── IBKR State ──
  const [ibkrConnected, setIbkrConnected] = useState(false);
  const [ibkrLoading, setIbkrLoading] = useState(false);
  const [ibkrError, setIbkrError] = useState("");
  const [ibkrAccounts, setIbkrAccounts] = useState([]);
  const [ibkrSummary, setIbkrSummary] = useState(null);
  const [ibkrPositions, setIbkrPositions] = useState([]);
  const ibkrSaved = ibkrConfig.getConfig();
  const [ibkrHost, setIbkrHost] = useState(ibkrSaved?.host || "127.0.0.1");
  const [ibkrPort, setIbkrPort] = useState(ibkrSaved?.port || 4001);

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
  const [provider, setProvider] = useState("yahoo");
  const [polygonKey, setPolygonKey] = useState("");
  const [tradierKey, setTradierKey] = useState("");
  const [tadawulKey, setTadawulKey] = useState("");
  const [showPolygonKey, setShowPolygonKey] = useState(false);
  const [showTradierKey, setShowTradierKey] = useState(false);
  const [showTadawulKey, setShowTadawulKey] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [alpacaSaveLoading, setAlpacaSaveLoading] = useState(false);
  const [alpacaSaveStatus, setAlpacaSaveStatus] = useState("");

  // ── Init: Check existing connections, auto-reconnect if keys saved ──
  useEffect(() => {
    getConnectionStatus()
      .then(s => {
        if (s.connected) {
          setIbkrConnected(true);
          loadIbkrData();
        }
      })
      .catch(() => {});
    getAlpacaStatus()
      .then(s => {
        if (s.connected) {
          setAlpacaConnected(true);
          loadAlpacaData();
        } else {
          // Auto-reconnect if keys are saved in localStorage
          const saved = alpacaConfig.getConfig();
          if (saved?.apiKey && saved?.secretKey) {
            connectAlpaca(saved.apiKey, saved.secretKey, saved.paper !== false)
              .then(r => {
                if (r.connected) {
                  setAlpacaConnected(true);
                  loadAlpacaData();
                }
              })
              .catch(() => {});
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    setAlpacaApiKey(user.alpaca_api_key || "");
    setAlpacaSecretKey(user.alpaca_secret_key || "");
    setProvider(user.market_data_provider || "yahoo");
    setPolygonKey(user.polygon_api_key || "");
    setTradierKey(user.tradier_api_key || "");
    setTadawulKey(user.tadawul_api_key || "");
  }, [user]);

  const handleSaveMarketKeys = async () => {
    setSaveLoading(true);
    setSaveError("");
    setSaveSuccess("");
    try {
      const updated = await authClient.updateMe({
        market_data_provider: provider,
        polygon_api_key: polygonKey.trim(),
        tradier_api_key: tradierKey.trim(),
        tadawul_api_key: tadawulKey.trim(),
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

  // ── IBKR Functions ──
  const loadIbkrData = async () => {
    try {
      const accts = await getAccounts();
      const list = Array.isArray(accts) ? accts : [];
      setIbkrAccounts(list);
      if (list.length > 0) {
        try {
          const summary = await getAccountSummary(list[0].id);
          setIbkrSummary(summary);
        } catch {}
        try {
          const pos = await getPositions();
          setIbkrPositions(Array.isArray(pos) ? pos : []);
        } catch {}
      }
    } catch {}
  };

  const handleIbkrConnect = async () => {
    setIbkrLoading(true);
    setIbkrError("");
    try {
      const result = await connectToGateway(ibkrHost, Number(ibkrPort), 0);
      if (result.connected) {
        setIbkrConnected(true);
        ibkrConfig.saveConfig({ host: ibkrHost, port: Number(ibkrPort), connected: true });
        await new Promise(r => setTimeout(r, 1500));
        await loadIbkrData();
      }
    } catch (err) {
      setIbkrError("تعذر الاتصال بـ IB Gateway. تأكد من تشغيله على المنفذ " + ibkrPort);
    }
    setIbkrLoading(false);
  };

  const handleIbkrDisconnect = async () => {
    try { await disconnectFromGateway(); } catch {}
    ibkrConfig.clearConfig();
    setIbkrConnected(false);
    setIbkrAccounts([]);
    setIbkrSummary(null);
    setIbkrPositions([]);
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
    setAlpacaConnected(false);
    setAlpacaAccount(null);
    setAlpacaPositions([]);
  };

  return (
    <div className="space-y-6">

      {/* ═══════ IBKR Card ═══════ */}
      <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${ibkrConnected ? "bg-emerald-500/20" : "bg-[#ff9800]/10"}`}>
              <Zap className={`w-5 h-5 ${ibkrConnected ? "text-emerald-400" : "text-[#ff9800]"}`} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Interactive Brokers</h3>
              <p className="text-xs text-[#94a3b8]">اتصال عبر IB Gateway / TWS (محلي)</p>
            </div>
          </div>
          {/* Start / Stop Button */}
          {ibkrConnected ? (
            <button onClick={handleIbkrDisconnect}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-bold hover:bg-red-500/30 transition-all">
              <PowerOff className="w-4 h-4" /> إيقاف
            </button>
          ) : (
            <button onClick={handleIbkrConnect} disabled={ibkrLoading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-bold hover:bg-emerald-500/30 disabled:opacity-50 transition-all">
              {ibkrLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
              {ibkrLoading ? "جاري الاتصال..." : "تشغيل"}
            </button>
          )}
        </div>

        {/* Connection Status */}
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border mb-4 ${ibkrConnected ? "bg-emerald-500/10 border-emerald-500/30" : "bg-[#0f1623] border-[#1e293b]"}`}>
          {ibkrConnected ? <Wifi className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4 text-[#64748b]" />}
          <span className={`text-sm font-semibold ${ibkrConnected ? "text-emerald-400" : "text-[#64748b]"}`}>
            {ibkrConnected ? "متصل" : "غير متصل"}
          </span>
          {ibkrConnected && ibkrAccounts.length > 0 && (
            <span className="text-xs text-[#94a3b8] mr-2 font-mono">({ibkrAccounts[0]?.id})</span>
          )}
        </div>

        {/* Connection Settings */}
        {!ibkrConnected && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs text-[#64748b] block mb-1.5">عنوان IP</label>
              <input value={ibkrHost} onChange={e => setIbkrHost(e.target.value)} placeholder="127.0.0.1"
                className="w-full bg-[#0a0e17] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#ff9800]/50" dir="ltr" />
            </div>
            <div>
              <label className="text-xs text-[#64748b] block mb-1.5">المنفذ</label>
              <select value={ibkrPort} onChange={e => setIbkrPort(Number(e.target.value))}
                className="w-full bg-[#0a0e17] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#ff9800]/50">
                <option value={4001}>4001 - حي (Gateway)</option>
                <option value={4002}>4002 - ورقي (Gateway)</option>
                <option value={7496}>7496 - حي (TWS)</option>
                <option value={7497}>7497 - ورقي (TWS)</option>
              </select>
            </div>
          </div>
        )}

        {/* IBKR Error */}
        {ibkrError && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl mb-4">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <p className="text-xs text-red-400">{ibkrError}</p>
          </div>
        )}

        {/* IBKR Account Summary */}
        {ibkrConnected && ibkrSummary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { label: "صافي التصفية", key: "NetLiquidation", color: "text-white" },
              { label: "القوة الشرائية", key: "BuyingPower", color: "text-emerald-400" },
              { label: "أرباح غير محققة", key: "UnrealizedPnL", color: null },
              { label: "أرباح محققة", key: "RealizedPnL", color: null },
            ].map((item, i) => {
              const val = ibkrSummary[item.key]?.value;
              const cur = ibkrSummary[item.key]?.currency || "USD";
              const numVal = Number(val);
              const clr = item.color || (numVal >= 0 ? "text-emerald-400" : "text-red-400");
              return (
                <div key={i} className="bg-[#0f1623] border border-[#1e293b] rounded-xl p-3">
                  <p className="text-xs text-[#64748b] mb-1">{item.label}</p>
                  <p className={`text-lg font-bold ${clr}`}>
                    {cur === "USD" ? "$" : cur} {numVal ? numVal.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "-"}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* IBKR Positions */}
        {ibkrConnected && ibkrPositions.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-[#94a3b8] mb-2">المراكز المفتوحة ({ibkrPositions.length})</h4>
            <div className="max-h-[160px] overflow-y-auto space-y-1 custom-scrollbar">
              {ibkrPositions.map((pos, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#0f1623] border border-[#1e293b]">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{pos.contract?.symbol || "?"}</span>
                    <span className="text-xs text-[#64748b]">×{pos.position}</span>
                  </div>
                  <span className="text-xs font-mono text-[#94a3b8]">${pos.avgCost?.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* IBKR Setup Instructions */}
        {!ibkrConnected && (
          <div className="p-3 bg-[#0f1623] border border-[#1e293b] rounded-xl mt-2">
            <p className="text-xs text-[#64748b] mb-1 font-semibold">📌 خطوات الإعداد:</p>
            <ol className="text-xs text-[#94a3b8] space-y-0.5 list-decimal list-inside">
              <li>شغّل <span className="text-[#ff9800] font-bold">IB Gateway</span> أو <span className="text-[#ff9800] font-bold">TWS</span></li>
              <li>فعّل API في Configure → API → Settings</li>
              <li>تأكد من Socket Port و Enable ActiveX and Socket Clients</li>
              <li>اضغط <span className="text-emerald-400 font-bold">تشغيل</span></li>
            </ol>
          </div>
        )}
      </div>

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
          {/* Start / Stop Button */}
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

      {/* ═══════ Market Data Providers Card ═══════ */}
      <div className="bg-[#151c2c] border border-[#1e293b] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#d4a843]/15">
              <Key className="w-5 h-5 text-[#d4a843]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">مفاتيح مزود البيانات المباشرة</h3>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs text-[#64748b] block mb-1.5">المزود الافتراضي</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full bg-[#0a0e17] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#d4a843]/50"
            >
              <option value="yahoo">Yahoo (افتراضي)</option>
              <option value="polygon">Polygon</option>
              <option value="tradier">Tradier</option>
              <option value="tadawul">Tadawul</option>
            </select>
          </div>
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

          <div>
            <label className="text-xs text-[#64748b] block mb-1.5">Tradier API Key</label>
            <div className="flex gap-2">
              <input
                type={showTradierKey ? "text" : "password"}
                value={tradierKey}
                onChange={(e) => setTradierKey(e.target.value)}
                placeholder="TRADIER_API_KEY"
                className="flex-1 bg-[#0a0e17] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#d4a843]/50"
                dir="ltr"
                autoComplete="off"
              />
              <button onClick={() => setShowTradierKey(!showTradierKey)} className="p-2 rounded-lg bg-[#1e293b] hover:bg-[#293548] transition-colors">
                {showTradierKey ? <EyeOff className="w-4 h-4 text-[#94a3b8]" /> : <Eye className="w-4 h-4 text-[#94a3b8]" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-[#64748b] block mb-1.5">Tadawul / Mubasher Key</label>
            <div className="flex gap-2">
              <input
                type={showTadawulKey ? "text" : "password"}
                value={tadawulKey}
                onChange={(e) => setTadawulKey(e.target.value)}
                placeholder="TADAWUL_API_KEY"
                className="flex-1 bg-[#0a0e17] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#d4a843]/50"
                dir="ltr"
                autoComplete="off"
              />
              <button onClick={() => setShowTadawulKey(!showTadawulKey)} className="p-2 rounded-lg bg-[#1e293b] hover:bg-[#293548] transition-colors">
                {showTadawulKey ? <EyeOff className="w-4 h-4 text-[#94a3b8]" /> : <Eye className="w-4 h-4 text-[#94a3b8]" />}
              </button>
            </div>
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