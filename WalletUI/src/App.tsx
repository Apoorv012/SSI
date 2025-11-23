import { useEffect, useState } from "react";
import axios from "axios";
import type { StoredCredential, ProofRequest, CredentialData } from "./types";
import { mockApi } from "./mockApi";
import "./App.css";

// Check if mock API should be used
const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === "true";
const WALLET_API = import.meta.env.VITE_WALLET_API || "http://localhost:5002";

// Utility functions
const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  return date.toLocaleDateString();
};

const truncateAddress = (address: string): string => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const getAttributeLabel = (attr: string): string => {
  const labels: Record<string, string> = {
    over18: "Age 18+",
    panLast4: "PAN Last 4",
    name: "Full Name",
    dob: "Date of Birth",
    pan: "PAN Number",
  };
  return labels[attr] || attr;
};

// Root Wallet UI
export default function WalletApp() {
  const [credentials, setCredentials] = useState<StoredCredential[]>([]);
  const [pendingRequests, setPendingRequests] = useState<ProofRequest[]>([]);
  const [allRequests, setAllRequests] = useState<ProofRequest[]>([]);
  const [selectedReq, setSelectedReq] = useState<ProofRequest | null>(null);
  const [activeTab, setActiveTab] = useState<"credentials" | "requests" | "history">("credentials");
  const [showNotification, setShowNotification] = useState(false);

  // Fetch credentials
  const loadCredentials = async () => {
    try {
      if (USE_MOCK_API) {
        const data = await mockApi.getCredentials();
        setCredentials(Object.values(data));
      } else {
        const res = await axios.get<Record<string, StoredCredential>>(`${WALLET_API}/credentials`);
        setCredentials(Object.values(res.data));
      }
    } catch (error) {
      console.error("Failed to load credentials:", error);
    }
  };

  // Fetch pending requests
  const loadPendingRequests = async () => {
    try {
      if (USE_MOCK_API) {
        const data = await mockApi.getPendingRequests();
        const prevCount = pendingRequests.length;
        setPendingRequests(data);
        
        // Show notification if new request arrived
        if (data.length > prevCount && prevCount > 0) {
          setShowNotification(true);
          setTimeout(() => setShowNotification(false), 5000);
        }
      } else {
        const res = await axios.get<ProofRequest[]>(`${WALLET_API}/pending-requests`);
        const prevCount = pendingRequests.length;
        setPendingRequests(res.data);
        
        // Show notification if new request arrived
        if (res.data.length > prevCount && prevCount > 0) {
          setShowNotification(true);
          setTimeout(() => setShowNotification(false), 5000);
        }
      }
    } catch (error) {
      console.error("Failed to load pending requests:", error);
    }
  };

  // Fetch all requests (for history)
  const loadAllRequests = async () => {
    try {
      if (USE_MOCK_API) {
        const data = await mockApi.getAllRequests();
        setAllRequests(data);
      } else {
        const res = await axios.get<ProofRequest[]>(`${WALLET_API}/all-requests`);
        setAllRequests(res.data);
      }
    } catch (error) {
      console.error("Failed to load all requests:", error);
    }
  };

  useEffect(() => {
    loadCredentials();
    loadPendingRequests();
    loadAllRequests();
    
    // Poll for new requests every 2 seconds
    const interval = setInterval(() => {
      loadPendingRequests();
      if (activeTab === "history") {
        loadAllRequests();
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [activeTab]);

  const respond = async (approve: boolean) => {
    if (!selectedReq) return;
    try {
      if (USE_MOCK_API) {
        await mockApi.respond(selectedReq.id, approve);
      } else {
        await axios.post(`${WALLET_API}/respond`, {
          requestId: selectedReq.id,
          approve,
        });
      }
      setSelectedReq(null);
      loadPendingRequests();
      loadAllRequests();
      loadCredentials();
    } catch (error) {
      console.error("Failed to respond:", error);
      alert("Failed to respond to request. Please try again.");
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      approved: "bg-green-500/20 text-green-400 border-green-500/30",
      rejected: "bg-red-500/20 text-red-400 border-red-500/30",
    };
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${styles[status as keyof typeof styles] || styles.pending}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  // Find matching credential for a request
  const findMatchingCredential = (request: ProofRequest): StoredCredential | null => {
    for (const cred of credentials) {
      if (request.issuerPublicKey && cred.issuerPublicKey !== request.issuerPublicKey) {
        continue;
      }
      
      // Check if credential can fulfill all attributes
      const canFulfill = request.attributes.every(attr => {
        if (attr === "over18" && cred.vc.dob) return true;
        if (attr === "panLast4" && cred.vc.pan) return true;
        return cred.vc[attr as keyof CredentialData] !== undefined;
      });
      
      if (canFulfill) return cred;
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {/* Mock API Indicator */}
      {USE_MOCK_API && (
        <div className="bg-yellow-500/20 border-b border-yellow-500/30 px-6 sm:px-8 lg:px-12 py-3 text-center">
          <p className="text-yellow-400 text-sm font-semibold">
            🧪 Using Mock API - Backend services not required
          </p>
        </div>
      )}
      
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-xl border-b border-slate-700/50 sticky top-0 z-10 shadow-xl shadow-slate-950/50">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                SSI Wallet
              </h1>
              <p className="text-sm text-slate-400 mt-1">Secure Identity Management</p>
            </div>
            <div className="flex items-center gap-4">
              {pendingRequests.length > 0 && (
                <div className="relative">
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white animate-pulse shadow-lg shadow-red-500/50">
                    {pendingRequests.length}
                  </div>
                  <button
                    onClick={() => setActiveTab("requests")}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 rounded-lg font-semibold transition-all hover:scale-105 shadow-lg shadow-blue-500/30 text-white"
                  >
                    Pending Requests
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Notification Banner */}
      {showNotification && (
        <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-b border-yellow-500/30 px-6 sm:px-8 lg:px-12 py-4 text-center animate-slide-down">
          <p className="text-yellow-300 font-semibold">🔔 New verification request received!</p>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-10 sm:py-12 lg:py-16">
        {/* Tabs */}
        <div className="flex gap-2 mb-10 border-b-2 border-slate-700/50 overflow-x-auto">
          <button
            onClick={() => setActiveTab("credentials")}
            className={`px-6 py-4 font-semibold transition-all relative whitespace-nowrap ${
              activeTab === "credentials"
                ? "text-blue-400"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            <span>My Credentials</span>
            <span className="ml-2 text-xs opacity-70 bg-slate-700/40 px-2 py-1 rounded-full">({credentials.length})</span>
            {activeTab === "credentials" && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab("requests")}
            className={`px-6 py-4 font-semibold transition-all relative whitespace-nowrap ${
              activeTab === "requests"
                ? "text-blue-400"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            <span>Pending Requests</span>
            {pendingRequests.length > 0 && (
              <span className="ml-2 px-3 py-1 bg-red-500/30 text-red-300 rounded-full text-xs font-bold border border-red-500/50">
                {pendingRequests.length}
              </span>
            )}
            {activeTab === "requests" && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full"></div>
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab("history");
              loadAllRequests();
            }}
            className={`px-6 py-4 font-semibold transition-all relative whitespace-nowrap ${
              activeTab === "history"
                ? "text-blue-400"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            Transaction History
            {activeTab === "history" && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full"></div>
            )}
          </button>
        </div>

        {/* Credentials Tab */}
        {activeTab === "credentials" && (
          <section>
            <h2 className="text-3xl sm:text-4xl font-bold mb-10 text-slate-100">Stored Credentials</h2>
            {credentials.length === 0 ? (
              <div className="bg-gradient-to-br from-slate-800/50 to-slate-800/20 border border-slate-700 rounded-2xl p-12 text-center">
                <div className="text-4xl mb-4">📋</div>
                <p className="text-slate-300 mb-3 text-lg font-medium">No credentials stored yet.</p>
                <p className="text-sm text-slate-500">
                  Credentials will appear here once you import them.
                </p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {credentials.map((cred, i) => (
                  <div
                    key={i}
                    className="bg-gradient-to-br from-slate-800/80 to-slate-800/40 border border-slate-700/60 rounded-2xl p-7 hover:border-blue-500/60 hover:shadow-2xl hover:shadow-blue-500/20 transition-all duration-300 hover:-translate-y-1.5 hover:from-slate-800 backdrop-blur-sm"
                  >
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex-1">
                        <h3 className="font-bold text-xl mb-1 text-white">{cred.vc.name}</h3>
                        <p className="text-sm text-slate-400">
                          Issued {formatTime(cred.storedAt)}
                        </p>
                      </div>
                      <div className="w-14 h-14 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center font-bold text-2xl text-white shadow-lg shadow-purple-500/50 ml-4">
                        {cred.vc.name.charAt(0)}
                      </div>
                    </div>
                    
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center justify-between bg-slate-900/40 rounded-lg px-4 py-3">
                        <span className="text-slate-400 text-sm">Date of Birth:</span>
                        <span className="font-medium text-slate-100">{cred.vc.dob}</span>
                      </div>
                      <div className="flex items-center justify-between bg-slate-900/40 rounded-lg px-4 py-3">
                        <span className="text-slate-400 text-sm">PAN:</span>
                        <span className="font-medium font-mono text-blue-300">{cred.vc.pan}</span>
                      </div>
                      <div className="flex items-center justify-between bg-slate-900/40 rounded-lg px-4 py-3">
                        <span className="text-slate-400 text-sm">Issuer:</span>
                        <span className="font-mono text-xs text-purple-300">{truncateAddress(cred.issuerPublicKey)}</span>
                      </div>
                    </div>
                    
                    <div className="pt-6 border-t border-slate-700/50">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(cred.credentialHash);
                          alert("Credential hash copied to clipboard!");
                        }}
                        className="w-full text-sm text-blue-400 hover:text-blue-300 transition-colors py-2 px-3 rounded-lg hover:bg-blue-500/10"
                      >
                        📋 Copy Hash: {truncateAddress(cred.credentialHash)}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Pending Requests Tab */}
        {activeTab === "requests" && (
          <section>
            <h2 className="text-3xl sm:text-4xl font-bold mb-10 text-slate-100">Pending Verification Requests</h2>
            {pendingRequests.length === 0 ? (
              <div className="bg-gradient-to-br from-slate-800/50 to-slate-800/20 border border-slate-700 rounded-2xl p-12 text-center">
                <div className="text-4xl mb-4">⏳</div>
                <p className="text-slate-300 text-lg font-medium">No pending requests.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {pendingRequests.map((req) => {
                  const matchingCred = findMatchingCredential(req);
                  return (
                    <div
                      key={req.id}
                      className="bg-gradient-to-br from-slate-800/80 to-slate-800/40 border border-slate-700/60 rounded-2xl p-7 hover:border-yellow-500/60 hover:shadow-2xl hover:shadow-yellow-500/20 transition-all duration-300 hover:-translate-y-1.5 cursor-pointer backdrop-blur-sm"
                      onClick={() => setSelectedReq(req)}
                    >
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex-1">
                          <h3 className="font-bold text-xl mb-1 text-white">{req.verifierId}</h3>
                          <p className="text-sm text-slate-400">
                            Requested {formatTime(req.createdAt)}
                          </p>
                        </div>
                        {getStatusBadge(req.status)}
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <span className="text-sm text-slate-300 font-semibold mb-3 block">Requesting:</span>
                          <div className="flex flex-wrap gap-3">
                            {req.attributes.map((attr, i) => (
                              <span
                                key={i}
                                className="px-4 py-2 bg-blue-500/20 text-blue-300 rounded-lg text-sm font-medium border border-blue-500/30"
                              >
                                {getAttributeLabel(attr)}
                              </span>
                            ))}
                          </div>
                        </div>
                        
                        {req.issuerPublicKey && (
                          <div className="bg-slate-900/40 rounded-lg px-4 py-3">
                            <span className="text-slate-400 text-sm">Issuer Required:</span>
                            <span className="ml-2 font-mono text-xs text-purple-300">
                              {truncateAddress(req.issuerPublicKey)}
                            </span>
                          </div>
                        )}
                        
                        {matchingCred && (
                          <div className="mt-4 pt-4 border-t border-slate-700/50 bg-green-500/5 rounded-lg p-4">
                            <p className="text-sm text-green-400 font-medium">
                              ✅ Matching credential found: <span className="text-green-300">{matchingCred.vc.name}</span>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Transaction History Tab */}
        {activeTab === "history" && (
          <section>
            <h2 className="text-3xl sm:text-4xl font-bold mb-10 text-slate-100">Transaction History</h2>
            {allRequests.length === 0 ? (
              <div className="bg-gradient-to-br from-slate-800/50 to-slate-800/20 border border-slate-700 rounded-2xl p-12 text-center">
                <div className="text-4xl mb-4">📜</div>
                <p className="text-slate-300 text-lg font-medium">No transactions yet.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {allRequests.map((req) => (
                  <div
                    key={req.id}
                    className="bg-gradient-to-br from-slate-800/80 to-slate-800/40 border border-slate-700/60 rounded-2xl p-7 hover:border-slate-600/80 hover:shadow-xl hover:shadow-slate-950/50 transition-all duration-300 backdrop-blur-sm"
                  >
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex-1">
                        <h3 className="font-bold text-xl text-white">{req.verifierId}</h3>
                        <p className="text-sm text-slate-400 mt-1">
                          {formatTime(req.createdAt)}
                          {req.resolvedAt && ` • Resolved ${formatTime(req.resolvedAt)}`}
                        </p>
                      </div>
                      {getStatusBadge(req.status)}
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <span className="text-sm text-slate-300 font-semibold mb-3 block">Attributes requested:</span>
                        <div className="flex flex-wrap gap-3">
                          {req.attributes.map((attr, i) => (
                            <span
                              key={i}
                              className="px-4 py-2 bg-slate-700/50 text-slate-200 rounded-lg text-sm font-medium border border-slate-600/50"
                            >
                              {getAttributeLabel(attr)}
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      {req.status === "approved" && req.vp && (
                        <div className="mt-4 pt-4 border-t border-slate-700/50 bg-slate-900/40 rounded-lg p-4">
                          <p className="text-sm text-slate-300 mb-3 font-semibold">Shared data:</p>
                          <div className="bg-slate-950/60 rounded-lg p-4 font-mono text-xs text-slate-300 overflow-x-auto border border-slate-700/30">
                            <pre>{JSON.stringify(req.vp.vp, null, 2)}</pre>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Approval Modal */}
      {selectedReq && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 border border-slate-700/50 rounded-3xl p-8 w-full max-w-lg space-y-8 shadow-2xl shadow-slate-950/50 animate-scale-in">
            <div>
              <h3 className="text-3xl font-bold text-white mb-2">Verification Request</h3>
              <p className="text-slate-400">
                <span className="font-semibold text-blue-400">{selectedReq.verifierId}</span> wants to verify:
              </p>
            </div>

            <div className="bg-slate-900/60 rounded-2xl p-6 border border-slate-700/50 backdrop-blur-sm">
              <p className="text-sm text-slate-300 mb-5 font-semibold">You will share:</p>
              <div className="space-y-4">
                {selectedReq.attributes.map((attr, i) => {
                  const matchingCred = findMatchingCredential(selectedReq);
                  let previewValue = "N/A";
                  
                  if (matchingCred) {
                    if (attr === "over18") {
                      const age = new Date().getFullYear() - new Date(matchingCred.vc.dob).getFullYear();
                      previewValue = age >= 18 ? "Yes (18+)" : "No (< 18)";
                    } else if (attr === "panLast4") {
                      previewValue = matchingCred.vc.pan.slice(-4);
                    } else {
                      previewValue = matchingCred.vc[attr as keyof CredentialData] || "N/A";
                    }
                  }
                  
                  return (
                    <div key={i} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-4 py-3 border border-slate-700/30">
                      <span className="text-slate-300 font-medium">{getAttributeLabel(attr)}:</span>
                      <span className="font-mono font-semibold text-blue-400">{previewValue}</span>
                    </div>
                  );
                })}
              </div>
              
              {findMatchingCredential(selectedReq) && (
                <div className="mt-6 pt-6 border-t border-slate-700/50 bg-green-500/10 rounded-lg p-4">
                  <p className="text-xs text-slate-400 mb-2 font-semibold">From credential:</p>
                  <p className="text-base font-bold text-green-400">{findMatchingCredential(selectedReq)?.vc.name}</p>
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <button
                className="flex-1 py-3.5 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 rounded-xl font-bold transition-all transform hover:scale-105 shadow-lg shadow-green-500/30 text-white"
                onClick={() => respond(true)}
              >
                ✓ Approve
              </button>
              <button
                className="flex-1 py-3.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 rounded-xl font-bold transition-all transform hover:scale-105 shadow-lg shadow-red-500/30 text-white"
                onClick={() => respond(false)}
              >
                ✕ Reject
              </button>
            </div>

            <button
              className="w-full py-3 bg-slate-700/50 hover:bg-slate-600/50 rounded-xl transition-all text-slate-300 hover:text-slate-100 font-medium border border-slate-600/50"
              onClick={() => setSelectedReq(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}