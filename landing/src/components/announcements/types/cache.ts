export interface ResolvableAPIChannel {
  id: string;
  name: string;
  type: number;
}

export interface ResolvableAPIRole {
  id: string;
  name: string;
  color: number;
  managed: boolean;
  position: number;
}
