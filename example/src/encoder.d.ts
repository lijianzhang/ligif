import './lzw-encode';
interface IFrame {
    w: number;
    h: number;
    x?: number;
    y?: number;
    pixels: number[];
    delay?: number;
}
export default function encoder(frames: IFrame[], time?: number): Promise<number[]>;
export {};
