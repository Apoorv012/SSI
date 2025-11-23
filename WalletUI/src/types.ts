// Shared types for Wallet UI

export interface CredentialData {
  name: string;
  dob: string;
  pan: string;
  issuedAt: string;
}

export interface StoredCredential {
  vc: CredentialData;
  credentialHash: string;
  issuerPublicKey: string;
  issuerSignature: string;
  storedAt: string;
}

export interface VerifiablePresentation {
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

export interface ProofRequest {
  id: string;
  verifierId: string;
  attributes: string[];
  issuerPublicKey?: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  resolvedAt?: string;
  vp?: VerifiablePresentation;
}

