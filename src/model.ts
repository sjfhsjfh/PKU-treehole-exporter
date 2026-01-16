interface BaseResponse {
  code: number;
  message: string;
  timestamp: number;
  success: boolean;
}

export interface DataOkResponse<T> extends BaseResponse {
  success: true;
  data: T;
}

export interface DataErrResponse extends BaseResponse {
  success: false;
}

export type ApiResponse<T> = DataOkResponse<T> | DataErrResponse;

export interface Paged<T> {
  current_page: number;
  data: T[];
  from: number;
  to: number;
  total: number;
  last_page: number;
}

export interface Post {
  pid: number;
  text: string;
  type: "text";
  timestamp: number;
  reply: number;
  likenum: number;
  anonymous: number;
  url: string;
}

export interface Comment {
  cid: number;
  pid: number;
  text: string;
  comment_id: number;
  name: string;
  quote: { pid: number; text: string; name_tag: string } | null;
  timestamp: number;
}

export interface PostWithComments {
  post: Post;
  comments: Comment[];
  users: string[];
}
