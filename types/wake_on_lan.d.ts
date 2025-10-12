declare module 'wake_on_lan' {
  export function wake(
    macAddress: string,
    callback: (error: Error | null) => void
  ): void;

  export function wake(
    macAddress: string,
    options: { address?: string; port?: number },
    callback: (error: Error | null) => void
  ): void;
}
