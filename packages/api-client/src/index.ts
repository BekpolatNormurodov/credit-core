import axios, { AxiosInstance } from 'axios';
import type {
  AuthUser,
  BranchDto,
  CreditCaseDto,
  CreditCaseListItem,
  DirectoryUser,
  ImportParseResult,
  LoginResponse,
  MessageDto,
  NotificationItem,
  Role,
  StatsResponse,
  TransitionPayload,
  UpsertCasePayload,
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
  async createCase(payload: UpsertCasePayload): Promise<CreditCaseDto> {
    const { data } = await http.post<CreditCaseDto>('/cases', payload);
    return data;
  },
  async updateCase(id: string, payload: UpsertCasePayload): Promise<CreditCaseDto> {
    const { data } = await http.put<CreditCaseDto>(`/cases/${id}`, payload);
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

  // ── Documents (authenticated download/view — fixes 401 from <a href>) ──
  async downloadDocument(id: string): Promise<Blob> {
    const { data } = await http.get(`/documents/${id}/download`, { responseType: 'blob' });
    return data as Blob;
  },

  // ── Analytics / monitoring ──
  async stats(): Promise<StatsResponse> {
    const { data } = await http.get<StatsResponse>('/stats');
    return data;
  },

  // ── Admin: branches & users ──
  async createBranch(payload: { name: string; symbol: string; region?: string }): Promise<BranchDto> {
    const { data } = await http.post<BranchDto>('/branches', payload);
    return data;
  },
  async users(): Promise<any[]> {
    const { data } = await http.get('/users');
    return data as any[];
  },
  async createUser(payload: { fullName: string; login: string; password: string; role: Role; branchId?: string }) {
    const { data } = await http.post('/users', payload);
    return data;
  },

  // ── Chat / messages ──
  async messages(caseId: string): Promise<MessageDto[]> {
    const { data } = await http.get<MessageDto[]>(`/cases/${caseId}/messages`);
    return data;
  },
  async sendMessage(caseId: string, payload: { text?: string; toRole?: Role; file?: File }) {
    const fd = new FormData();
    if (payload.text) fd.append('text', payload.text);
    if (payload.toRole) fd.append('toRole', payload.toRole);
    if (payload.file) fd.append('file', payload.file);
    await http.post(`/cases/${caseId}/messages`, fd);
  },
  async unreadCount(): Promise<number> {
    const { data } = await http.get<{ count: number }>('/messages/unread');
    return data.count;
  },
  async notifications(): Promise<NotificationItem[]> {
    const { data } = await http.get<NotificationItem[]>('/messages/feed');
    return data;
  },
  async directory(role?: Role, q?: string): Promise<DirectoryUser[]> {
    const { data } = await http.get<DirectoryUser[]>('/directory', { params: { role, q } });
    return data;
  },
};

/**
 * Open a document inline in a new browser tab (renders PDFs/images natively).
 * Uses a tokenized URL with inline disposition so the browser displays rather
 * than downloads. Falls back to an authenticated blob download if blocked.
 */
export async function viewDocument(id: string, fileName: string) {
  const token = getToken();
  const url = `${apiBaseUrl}/api/documents/${id}/download?inline=1&token=${encodeURIComponent(token ?? '')}`;
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  if (!w) downloadBlob(await api.downloadDocument(id), fileName);
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
