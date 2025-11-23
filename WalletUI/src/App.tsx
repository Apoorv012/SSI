import { useEffect, useState } from "react";
import axios from "axios";

// Types based on WalletBackend API structure
interface CredentialData {
  name: string;
  dob: string;
  pan: string;
  issuedAt: string;
}

interface StoredCredential {
  vc: CredentialData;
  credentialHash: string;
  issuerPublicKey: string;
  issuerSignature: string;
  storedAt: string;
}

interface VerifiablePresentation {
  vp: Record<string, any>;
  credentialHash: string;
  issuerPublicKey: string;
  issuerSignature: string;
  backend: {
    address: string;
    timestamp: string;
  };
  backendSignature: string;
  requestId: string;
  verifierId: string;
}

interface ProofRequest {
  id: string;
  verifierId: string;
  attributes: string[];
  issuerPublicKey?: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  resolvedAt?: string;
  vp?: VerifiablePresentation;
}

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
  const WALLET_API = "http://localhost:5002";

  // Fetch credentials
  const loadCredentials = async () => {
    try {
      const res = await axios.get<Record<string, StoredCredential>>(`${WALLET_API}/credentials`);
      setCredentials(Object.values(res.data));
    } catch (error) {
      console.error("Failed to load credentials:", error);
    }
  };

  // Fetch pending requests
  const loadPendingRequests = async () => {
    try {
      const res = await axios.get<ProofRequest[]>(`${WALLET_API}/pending-requests`);
      const prevCount = pendingRequests.length;
      setPendingRequests(res.data);
      
      // Show notification if new request arrived
      if (res.data.length > prevCount && prevCount > 0) {
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 5000);
      }
    } catch (error) {
      console.error("Failed to load pending requests:", error);
    }
  };

  // Fetch all requests (for history)
  const loadAllRequests = async () => {
    try {
      const res = await axios.get<ProofRequest[]>(`${WALLET_API}/all-requests`);
      setAllRequests(res.data);
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
      await axios.post(`${WALLET_API}/respond`, {
        requestId: selectedReq.id,
        approve,
      });
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
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              SSI Wallet
            </h1>
            <div className="flex items-center gap-4">
              {pendingRequests.length > 0 && (
                <div className="relative">
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold">
                    {pendingRequests.length}
                  </div>
                  <button
                    onClick={() => setActiveTab("requests")}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
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
        <div className="bg-yellow-500/20 border-b border-yellow-500/30 px-4 py-2 text-center">
          <p className="text-yellow-400">🔔 New verification request received!</p>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-700">
          <button
            onClick={() => setActiveTab("credentials")}
            className={`px-4 py-2 font-semibold transition-colors ${
              activeTab === "credentials"
                ? "border-b-2 border-blue-400 text-blue-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            My Credentials ({credentials.length})
          </button>
          <button
            onClick={() => setActiveTab("requests")}
            className={`px-4 py-2 font-semibold transition-colors relative ${
              activeTab === "requests"
                ? "border-b-2 border-blue-400 text-blue-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Pending Requests
            {pendingRequests.length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-red-500 rounded-full text-xs">
                {pendingRequests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab("history");
              loadAllRequests();
            }}
            className={`px-4 py-2 font-semibold transition-colors ${
              activeTab === "history"
                ? "border-b-2 border-blue-400 text-blue-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Transaction History
          </button>
        </div>

        {/* Credentials Tab */}
        {activeTab === "credentials" && (
          <section>
            <h2 className="text-xl font-semibold mb-4">Stored Credentials</h2>
            {credentials.length === 0 ? (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
                <p className="text-slate-400 mb-2">No credentials stored yet.</p>
                <p className="text-sm text-slate-500">
                  Credentials will appear here once you import them.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {credentials.map((cred, i) => (
                  <div
                    key={i}
                    className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-blue-500/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-lg mb-1">{cred.vc.name}</h3>
                        <p className="text-sm text-slate-400">
                          Issued {formatTime(cred.storedAt)}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center font-bold text-xl">
                        {cred.vc.name.charAt(0)}
                      </div>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Date of Birth:</span>
                        <span className="font-medium">{cred.vc.dob}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">PAN:</span>
                        <span className="font-medium font-mono">{cred.vc.pan}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Issuer:</span>
                        <span className="font-mono text-xs">{truncateAddress(cred.issuerPublicKey)}</span>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-slate-700">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(cred.credentialHash);
                          alert("Credential hash copied to clipboard!");
                        }}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        Copy Hash: {truncateAddress(cred.credentialHash)}
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
            <h2 className="text-xl font-semibold mb-4">Pending Verification Requests</h2>
            {pendingRequests.length === 0 ? (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
                <p className="text-slate-400">No pending requests.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingRequests.map((req) => {
                  const matchingCred = findMatchingCredential(req);
                  return (
                    <div
                      key={req.id}
                      className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-yellow-500/50 transition-all cursor-pointer"
                      onClick={() => setSelectedReq(req)}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-lg mb-1">{req.verifierId}</h3>
                          <p className="text-sm text-slate-400">
                            Requested {formatTime(req.createdAt)}
                          </p>
                        </div>
                        {getStatusBadge(req.status)}
                      </div>
                      
                      <div className="space-y-2">
                        <div>
                          <span className="text-sm text-slate-400">Requesting:</span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {req.attributes.map((attr, i) => (
                              <span
                                key={i}
                                className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-sm"
                              >
                                {getAttributeLabel(attr)}
                              </span>
                            ))}
                          </div>
                        </div>
                        
                        {req.issuerPublicKey && (
                          <div className="text-sm">
                            <span className="text-slate-400">Issuer Required:</span>
                            <span className="ml-2 font-mono text-xs">
                              {truncateAddress(req.issuerPublicKey)}
                            </span>
                          </div>
                        )}
                        
                        {matchingCred && (
                          <div className="mt-2 pt-2 border-t border-slate-700">
                            <p className="text-xs text-green-400">
                              ✓ Matching credential found: {matchingCred.vc.name}
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
            <h2 className="text-xl font-semibold mb-4">Transaction History</h2>
            {allRequests.length === 0 ? (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
                <p className="text-slate-400">No transactions yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {allRequests.map((req) => (
                  <div
                    key={req.id}
                    className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 hover:border-slate-600 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold">{req.verifierId}</h3>
                        <p className="text-xs text-slate-400">
                          {formatTime(req.createdAt)}
                          {req.resolvedAt && ` • Resolved ${formatTime(req.resolvedAt)}`}
                        </p>
                      </div>
                      {getStatusBadge(req.status)}
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-slate-400">Attributes requested:</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {req.attributes.map((attr, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-xs"
                            >
                              {getAttributeLabel(attr)}
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      {req.status === "approved" && req.vp && (
                        <div className="mt-3 pt-3 border-t border-slate-700">
                          <p className="text-xs text-slate-400 mb-1">Shared data:</p>
                          <div className="bg-slate-900/50 rounded p-2 font-mono text-xs">
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
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-lg space-y-6 shadow-2xl">
            <div>
              <h3 className="text-2xl font-bold mb-2">Verification Request</h3>
              <p className="text-slate-400">{selectedReq.verifierId} wants to verify:</p>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
              <p className="text-sm text-slate-400 mb-3">You will share:</p>
              <div className="space-y-2">
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
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">{getAttributeLabel(attr)}:</span>
                      <span className="font-mono font-semibold text-blue-400">{previewValue}</span>
                    </div>
                  );
                })}
              </div>
              
              {findMatchingCredential(selectedReq) && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <p className="text-xs text-slate-400">From credential:</p>
                  <p className="text-sm font-semibold">{findMatchingCredential(selectedReq)?.vc.name}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                className="flex-1 py-3 bg-green-600 hover:bg-green-700 rounded-xl font-semibold transition-colors"
                onClick={() => respond(true)}
              >
                Approve
              </button>
              <button
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 rounded-xl font-semibold transition-colors"
                onClick={() => respond(false)}
              >
                Reject
              </button>
            </div>

            <button
              className="w-full py-2 bg-slate-700 hover:bg-slate-600 rounded-xl transition-colors"
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