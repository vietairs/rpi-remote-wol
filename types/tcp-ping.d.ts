declare module 'tcp-ping' {
  export interface ProbeOptions {
    timeout?: number;
    attempts?: number;
  }

  export function probe(
    host: string,
    port: number,
    callback: (err: Error | null, available: boolean) => void,
    options?: ProbeOptions
  ): void;

  export function ping(
    options: {
      address: string;
      port: number;
      timeout?: number;
      attempts?: number;
    },
    callback: (err: Error | null, data: any) => void
  ): void;
}
