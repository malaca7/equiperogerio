declare module 'https://esm.sh/html-to-image' {
  export function toPng(node: HTMLElement, options?: any): Promise<string>;
  export function toJpeg(node: HTMLElement, options?: any): Promise<string>;
  export function toBlob(node: HTMLElement, options?: any): Promise<Blob | null>;
  export function toPixelData(node: HTMLElement, options?: any): Promise<Uint8ClampedArray>;
  export function toSvg(node: HTMLElement, options?: any): Promise<string>;
  export function toCanvas(node: HTMLElement, options?: any): Promise<HTMLCanvasElement>;
}
