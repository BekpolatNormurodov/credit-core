import axios, { AxiosInstance } from 'axios';
import type {
  AuthUser,
  BranchDto,
  CreditCaseDto,
  CreditCaseListItem,
  ImportParseResult,
  LoginResponse,
  TransitionPayload,
  UpsertRealEstateCasePayload,
} from '@credit-core/shared';

const TOKEN_KEY = 'cc_token';

export const apiBaseUrl: string =
  (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL ??
  'http://localhost:3000';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

const http: AxiosInstance = axios.create({ baseURL: `${apiBaseUrl}/api` });
http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const api = {
  async login(login: string, password: string): Promise<LoginResponse> {
    const { data } = await http.post<LoginResponse>('/auth/login', { login, password });
    return data;
  },
  async me(): Promise<AuthUser> {
    const { data } = await http.get<AuthUser>('/auth/me');
    return data;
  },
  async branches(): Promise<BranchDto[]> {
    const { data } = await http.get<BranchDto[]>('/branches');
    return data;
  },
  async cases(inbox = false): Promise<CreditCaseListItem[]> {
    const { data } = await http.get<CreditCaseListItem[]>('/cases', { params: { inbox: inbox ? 1 : 0 } });
    return data;
  },
  async case(id: string): Promise<CreditCaseDto> {
    const { data } = await http.get<CreditCaseDto>(`/cases/${id}`);
    return data;
  },
  async createRealEstate(payload: UpsertRealEstateCasePayload): Promise<CreditCaseDto> {
    const { data } = await http.post<CreditCaseDto>('/cases/real-estate', payload);
    return data;
  },
  async updateRealEstate(id: string, payload: UpsertRealEstateCasePayload): Promise<CreditCaseDto> {
    const { data } = await http.put<CreditCaseDto>(`/cases/${id}/real-estate`, payload);
    return data;
  },
  async transition(id: string, payload: TransitionPayload): Promise<CreditCaseDto> {
    const { data } = await http.post<CreditCaseDto>(`/cases/${id}/transition`, payload);
    return data;
  },
  async setKatmPrice(id: string, katmPrice: number): Promise<CreditCaseDto> {
    const { data } = await http.put<CreditCaseDto>(`/cases/${id}/katm-price`, { katmPrice });
    return data;
  },
  async parseExcel(file: File): Promise<ImportParseResult> {
    const fd = new FormData();
    fd.append('file', file);
    const { data } = await http.post<ImportParseResult>('/import/real-estate/parse', fd);
    return data;
  },
  async uploadDocument(caseId: string, type: string, file: File) {
    const fd = new FormData();
    fd.append('file', file);
    await http.post('/documents/upload', fd, { params: { caseId, type } });
  },
  async katmStatus() {
    const { data } = await http.get('/katm/status');
    return data as { available: boolean; message: string; reports: string[] };
  },
  documentUrl(id: string): string {
    return `${apiBaseUrl}/api/documents/${id}/download`;
  },
  async generatePdf(id: string): Promise<Blob> {
    const { data } = await http.post(`/output/${id}/pdf/valuation-act`, {}, { responseType: 'blob' });
    return data as Blob;
  },
  async exportExcel(id: string): Promise<Blob> {
    const { data } = await http.get(`/output/${id}/excel`, { responseType: 'blob' });
    return data as Blob;
  },
};

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
