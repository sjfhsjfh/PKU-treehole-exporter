import type { ApiResponse, Paged, Post, Comment } from "./model";

const API_BASE = "https://treehole.pku.edu.cn/api/";

// -------- Request helpers --------
async function httpGet<T>(
  path: string,
  params?: Record<string, string | number>,
): Promise<T> {
  const url = new URL(path, API_BASE);
  if (params) {
    Object.entries(params).forEach(([k, v]) =>
      url.searchParams.set(k, String(v)),
    );
  }

  const token = getCookie("pku_token");
  const xsrf = getCookie("XSRF-TOKEN");
  const uuid = localStorage.getItem("pku-uuid") || undefined;

  const res = await fetch(url.toString(), {
    method: "GET",
    credentials: "include", // 需要带 cookie
    headers: {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}),
      ...(uuid ? { Uuid: uuid } : {}),
    },
  });

  if (!res.ok) {
    // 直接抛出，交给上层决定如何提示
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as T;
}

export interface TreeholeAPI {
  fetchPost(pid: number): Promise<ApiResponse<Post>>;
  fetchComments(
    pid: number,
    page: number,
    limit: number,
    sort: "asc" | "desc",
  ): Promise<ApiResponse<Paged<Comment>>>;
  /** 拉取所有评论并按排序返回合并列表 */
  fetchAllComments(
    pid: number,
    sort?: "asc" | "desc",
    pageSize?: number,
  ): Promise<Comment[]>;
}

export class TreeholeHttpClient implements TreeholeAPI {
  private requester: typeof httpGet;

  constructor(opts?: { requester?: typeof httpGet }) {
    this.requester = opts?.requester ?? httpGet;
  }

  async fetchPost(pid: number): Promise<ApiResponse<Post>> {
    // path 不能以 / 开头，否则会覆盖 base pathname 导致丢失 /api/
    return this.requester<ApiResponse<Post>>(`pku/${pid}`);
  }

  async fetchComments(
    pid: number,
    page: number,
    limit: number,
    sort: "asc" | "desc",
  ): Promise<ApiResponse<Paged<Comment>>> {
    return this.requester<ApiResponse<Paged<Comment>>>(
      `pku_comment_v3/${pid}`,
      {
        page,
        limit,
        sort,
      },
    );
  }

  async fetchAllComments(
    pid: number,
    sort: "asc" | "desc" = "asc",
    pageSize = 15,
  ): Promise<Comment[]> {
    const first = await this.fetchComments(pid, 1, pageSize, sort);
    if (!first.success) throw new Error(first.message);

    const firstPage = first.data;
    const pageData = firstPage?.data ?? [];
    const lastPage = firstPage?.last_page ?? 1;

    const all: Comment[] = [...pageData];

    for (let page = 2; page <= lastPage; page++) {
      const resp = await this.fetchComments(pid, page, pageSize, sort);
      if (!resp.success) throw new Error(resp.message);
      const rows = resp.data?.data ?? [];
      all.push(...rows);
    }

    return all;
  }
}

// 默认导出一个可直接使用的客户端实例
export const treeholeClient = new TreeholeHttpClient();

/**
 * 在油猴环境下的请求注意事项：
 * 1) 当前脚本匹配域名与接口同源，可直接用 fetch + credentials: 'include'，能带上登录 cookie。
 * 2) 若未来要跨域或遭遇 CORS，可切换 requester，使用 GM.xmlHttpRequest 包一层：
 *
 * const gmRequester: typeof httpGet = (path, params) =>
 *   new Promise((resolve, reject) => {
 *     const url = new URL(path, API_BASE);
 *     if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
 *     const token = getCookie("pku_token");
 *     // @ts-ignore
 *     GM.xmlHttpRequest({
 *       method: 'GET', url: url.toString(),
 *       headers: token ? { Authorization: `Bearer ${token}` } : {},
 *       onload: (res) => resolve(JSON.parse(res.responseText)),
 *       onerror: (err) => reject(err),
 *     });
 *   });
 *
 * 然后 new TreeholeHttpClient({ requester: gmRequester }) 即可。
 */

// 简单的 cookie 读取工具
function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
