// Mock API for UI development
// Returns mock data matching the real API structure

import type { StoredCredential, ProofRequest } from './types';

const MOCK_CREDENTIALS: Record<string, StoredCredential> = {
  "ce579b1f3a471f10c2e4b72b774cbbc2471e42e79e50fd8eaabb61ead6c05053": {
    vc: {
      name: "John Doe",
      dob: "1990-05-15",
      pan: "ABCDE1234F",
      issuedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
    },
    credentialHash: "ce579b1f3a471f10c2e4b72b774cbbc2471e42e79e50fd8eaabb61ead6c05053",
    issuerPublicKey: "0xB9FD44Fbd4d8Ea518ec4E86FFC04347A168EaDbF",
    issuerSignature: "0xed0743fe2c1243804ea8998bcf24a96855668c0faeeae0ffefacbb8fac5d467c3094a6bc3528ee7943a8525b75a714cb5228abdc4b53abbba646604cb250b2601c",
    storedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
  "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456": {
    vc: {
      name: "Jane Smith",
      dob: "1985-12-20",
      pan: "XYZAB5678G",
      issuedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    },
    credentialHash: "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
    issuerPublicKey: "0xB9FD44Fbd4d8Ea518ec4E86FFC04347A168EaDbF",
    issuerSignature: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12",
    storedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
};

// Use a mutable object so we can update requests
let MOCK_REQUESTS: Record<string, ProofRequest> = {
  "pending-1": {
    id: "pending-1",
    verifierId: "Local Bar",
    attributes: ["over18"],
    issuerPublicKey: null,
    status: "pending",
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
  },
  "pending-2": {
    id: "pending-2",
    verifierId: "Bank XYZ",
    attributes: ["over18", "panLast4"],
    issuerPublicKey: "0xB9FD44Fbd4d8Ea518ec4E86FFC04347A168EaDbF",
    status: "pending",
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
  },
  "approved-1": {
    id: "approved-1",
    verifierId: "Local Bar",
    attributes: ["over18"],
    issuerPublicKey: null,
    status: "approved",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    resolvedAt: new Date(Date.now() - 2 * 60 * 60 * 1000 + 30 * 1000).toISOString(),
    vp: {
      vp: {
        over18: true,
      },
      credentialHash: "ce579b1f3a471f10c2e4b72b774cbbc2471e42e79e50fd8eaabb61ead6c05053",
      issuerPublicKey: "0xB9FD44Fbd4d8Ea518ec4E86FFC04347A168EaDbF",
      issuerSignature: "0xed0743fe2c1243804ea8998bcf24a96855668c0faeeae0ffefacbb8fac5d467c3094a6bc3528ee7943a8525b75a714cb5228abdc4b53abbba646604cb250b2601c",
      backend: {
        address: "0x9509C0E804bD0C179af9BA1Df727f45b115886bf",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000 + 30 * 1000).toISOString(),
      },
      backendSignature: "0xd6c26269a2b4f3176a484422b2f7ea6e6b87d03c4ea5c92d76b9a72d99d8c7a1742aecb2d16388608ae84376440a2ecc3468253cfb8dc59e4d19978c4bede8121b",
      requestId: "approved-1",
      verifierId: "Local Bar",
    },
  },
  "rejected-1": {
    id: "rejected-1",
    verifierId: "Unknown Service",
    attributes: ["name", "dob", "pan"],
    issuerPublicKey: null,
    status: "rejected",
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
    resolvedAt: new Date(Date.now() - 4 * 60 * 60 * 1000 + 10 * 1000).toISOString(),
  },
};

// Simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const mockApi = {
  // GET /credentials
  getCredentials: async (): Promise<Record<string, StoredCredential>> => {
    await delay(300);
    return MOCK_CREDENTIALS;
  },

  // GET /pending-requests
  getPendingRequests: async (): Promise<ProofRequest[]> => {
    await delay(200);
    return Object.values(MOCK_REQUESTS).filter(r => r.status === "pending");
  },

  // GET /all-requests
  getAllRequests: async (): Promise<ProofRequest[]> => {
    await delay(250);
    return Object.values(MOCK_REQUESTS).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  // POST /store-credential
  storeCredential: async (vcData: { vc: any; credentialHash: string; issuerPublicKey: string; issuerSignature: string }): Promise<{ ok: boolean; stored: boolean; message: string }> => {
    await delay(500);
    
    // Add to mock credentials
    MOCK_CREDENTIALS[vcData.credentialHash] = {
      vc: vcData.vc,
      credentialHash: vcData.credentialHash,
      issuerPublicKey: vcData.issuerPublicKey,
      issuerSignature: vcData.issuerSignature,
      storedAt: new Date().toISOString(),
    };
    
    return {
      ok: true,
      stored: true,
      message: "Credential successfully validated and stored",
    };
  },

  // POST /respond
  respond: async (requestId: string, approve: boolean): Promise<{ ok: boolean; vp?: any; message?: string }> => {
    await delay(500);
    const request = MOCK_REQUESTS[requestId];
    
    if (!request) {
      throw new Error("Request not found");
    }

    if (request.status !== "pending") {
      throw new Error("Request already handled");
    }

    if (approve) {
      request.status = "approved";
      request.resolvedAt = new Date().toISOString();
      request.vp = {
        vp: {
          over18: true,
          panLast4: request.attributes.includes("panLast4") ? "1234" : undefined,
        },
        credentialHash: "ce579b1f3a471f10c2e4b72b774cbbc2471e42e79e50fd8eaabb61ead6c05053",
        issuerPublicKey: "0xB9FD44Fbd4d8Ea518ec4E86FFC04347A168EaDbF",
        issuerSignature: "0xed0743fe2c1243804ea8998bcf24a96855668c0faeeae0ffefacbb8fac5d467c3094a6bc3528ee7943a8525b75a714cb5228abdc4b53abbba646604cb250b2601c",
        backend: {
          address: "0x9509C0E804bD0C179af9BA1Df727f45b115886bf",
          timestamp: new Date().toISOString(),
        },
        backendSignature: "0xd6c26269a2b4f3176a484422b2f7ea6e6b87d03c4ea5c92d76b9a72d99d8c7a1742aecb2d16388608ae84376440a2ecc3468253cfb8dc59e4d19978c4bede8121b",
        requestId: request.id,
        verifierId: request.verifierId,
      };
      return { ok: true, vp: request.vp };
    } else {
      request.status = "rejected";
      request.resolvedAt = new Date().toISOString();
      return { ok: true, message: "Request rejected" };
    }
  },
};

